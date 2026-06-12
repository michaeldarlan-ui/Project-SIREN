import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Env ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DB_URL  = process.env.TURSO_DATABASE_URL || 'file:siren.db';

// ── Database client ───────────────────────────────────────────
const client = createClient({
  url:       DB_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

if (!process.env.TURSO_DATABASE_URL) {
  console.warn('  ⚠  TURSO_DATABASE_URL not set — using local file:siren.db');
}

// ── Schema ────────────────────────────────────────────────────
const HISTORY_COLS = `
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, call_date TEXT, prospect TEXT,
  rep TEXT, rep_role TEXT, contact_title TEXT, stage TEXT,
  total INTEGER DEFAULT 0, letter_grade TEXT, grade_label TEXT,
  top_strength TEXT, top_priority TEXT, results_html TEXT,
  participants TEXT, dimensions TEXT, next_steps TEXT, overview TEXT,
  partner_scores TEXT, rep_scores TEXT
`;

await client.batch([
  { sql: `CREATE TABLE IF NOT EXISTS history_prod (${HISTORY_COLS})` },
  { sql: `CREATE TABLE IF NOT EXISTS history_demo (${HISTORY_COLS})` },
  { sql: `CREATE TABLE IF NOT EXISTS prospects (name TEXT PRIMARY KEY, industry TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS third_parties (name TEXT PRIMARY KEY, role TEXT, organization TEXT, notes TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS transcripts (id TEXT PRIMARY KEY, label TEXT NOT NULL, prospect TEXT, stage TEXT, rep TEXT, call_date TEXT, transcript TEXT NOT NULL, saved_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS team (name TEXT PRIMARY KEY, role TEXT, idx INTEGER DEFAULT 0)` },
  { sql: `CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, cost REAL DEFAULT 0, calls INTEGER DEFAULT 0)` },
], 'write');

// ── One-time migrations ───────────────────────────────────────
{
  const tables = (await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
  )).rows.map(r => String(r.name));

  // Rename old 'history' table → history_prod
  if (tables.includes('history') && !tables.includes('history_prod')) {
    await client.execute('ALTER TABLE history RENAME TO history_prod');
    console.log('[db] Renamed history → history_prod');
  }

  // Add partner_scores / rep_scores columns if missing
  for (const tbl of ['history_prod', 'history_demo']) {
    if (!tables.includes(tbl)) continue;
    const cols = (await client.execute(`PRAGMA table_info(${tbl})`)).rows.map(r => String(r.name));
    if (!cols.includes('partner_scores')) {
      await client.execute(`ALTER TABLE ${tbl} ADD COLUMN partner_scores TEXT`);
      console.log(`[db] Added partner_scores column to ${tbl}`);
    }
    if (!cols.includes('rep_scores')) {
      await client.execute(`ALTER TABLE ${tbl} ADD COLUMN rep_scores TEXT`);
      console.log(`[db] Added rep_scores column to ${tbl}`);
    }
  }

  // Migrate old transcripts table (history_id PK) to new standalone schema
  if (tables.includes('transcripts')) {
    const tCols = (await client.execute('PRAGMA table_info(transcripts)')).rows.map(r => String(r.name));
    if (!tCols.includes('label')) {
      const old = (await client.execute('SELECT * FROM transcripts')).rows;
      await client.execute('DROP TABLE transcripts');
      await client.execute(`CREATE TABLE transcripts (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, prospect TEXT, stage TEXT,
        rep TEXT, call_date TEXT, transcript TEXT NOT NULL, saved_at TEXT NOT NULL
      )`);
      if (old.length) {
        await client.batch(old.map(r => ({
          sql: `INSERT OR IGNORE INTO transcripts (id,label,prospect,stage,rep,call_date,transcript,saved_at)
                VALUES (?,?,?,?,?,?,?,?)`,
          args: [String(r.history_id), String(r.history_id), null, null, null, null,
                 String(r.transcript), String(r.saved_at)],
        })), 'write');
      }
      console.log(`[db] Migrated ${old.length} transcript rows to standalone schema`);
    }
  }
}

// ── Row helpers ───────────────────────────────────────────────
const DB_COLS = `id, ts, call_date, prospect, rep, rep_role, contact_title, stage,
  total, letter_grade, grade_label, top_strength, top_priority,
  results_html, participants, dimensions, next_steps, overview, partner_scores, rep_scores`;

const DB_PARAMS = `?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?`;

function isDemo(r) { return !!(r.is_demo) || String(r.id || '').startsWith('demo-'); }

function dbRowToRecord(row, demoFlag) {
  const j = k => { const v = row[k]; return v ? JSON.parse(String(v)) : undefined; };
  const s = k => { const v = row[k]; return v != null ? String(v) : ''; };
  return {
    id:           s('id'),
    ts:           s('ts'),
    callDate:     s('call_date'),
    prospect:     s('prospect'),
    rep:          s('rep'),
    repRole:      s('rep_role'),
    contactTitle: s('contact_title'),
    stage:        s('stage'),
    total:        Number(row.total) || 0,
    letter_grade: s('letter_grade'),
    grade_label:  s('grade_label'),
    top_strength: s('top_strength'),
    top_priority: s('top_priority'),
    resultsHtml:  s('results_html'),
    is_demo:      !!demoFlag,
    participants:   j('participants'),
    dimensions:     j('dimensions'),
    next_steps:     j('next_steps'),
    overview:       row.overview ? String(row.overview) : undefined,
    partner_scores: j('partner_scores'),
    rep_scores:     j('rep_scores'),
  };
}

function recordToArgs(r) {
  const ser = v => (v != null && typeof v === 'object') ? JSON.stringify(v) : (v ?? null);
  return [
    String(r.id),
    r.ts || new Date().toISOString(),
    r.callDate      || null,
    r.prospect      || null,
    r.rep           || null,
    r.repRole       || null,
    r.contactTitle  || null,
    r.stage         || null,
    r.total         || 0,
    r.letter_grade  || null,
    r.grade_label   || null,
    r.top_strength  || null,
    r.top_priority  || null,
    r.resultsHtml   || null,
    ser(r.participants),
    ser(r.dimensions),
    ser(r.next_steps),
    r.overview       || null,
    ser(r.partner_scores),
    ser(r.rep_scores),
  ];
}

async function upsertOne(r) {
  const tbl = isDemo(r) ? 'history_demo' : 'history_prod';
  await client.execute({
    sql:  `INSERT OR REPLACE INTO ${tbl} (${DB_COLS}) VALUES (${DB_PARAMS})`,
    args: recordToArgs(r),
  });
}

async function bulkUpsert(records) {
  if (!records.length) return;
  await client.batch(records.map(r => ({
    sql:  `INSERT OR REPLACE INTO ${isDemo(r) ? 'history_demo' : 'history_prod'} (${DB_COLS}) VALUES (${DB_PARAMS})`,
    args: recordToArgs(r),
  })), 'write');
}

// ── Utilities ─────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

// ── HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  console.log(`[${req.method}] ${req.url}`);

  // ── Claude API proxy ───────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/claude') {
    if (!API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not configured on server.' } }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Cache-Control': 'no-cache',
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
      });
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── History API ────────────────────────────────────────────

  // GET /api/history
  if (req.method === 'GET' && req.url.startsWith('/api/history') &&
      !req.url.startsWith('/api/history/')) {
    const real = (await client.execute('SELECT * FROM history_prod ORDER BY ts DESC')).rows
                   .map(r => dbRowToRecord(r, false));
    const demo = (await client.execute('SELECT * FROM history_demo ORDER BY ts DESC')).rows
                   .map(r => dbRowToRecord(r, true));
    const all  = [...real, ...demo].sort((a, b) => (b.ts > a.ts ? 1 : -1));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(all));
    return;
  }

  // POST /api/history/bulk
  if (req.method === 'POST' && req.url === '/api/history/bulk') {
    try {
      const records = await readBody(req);
      await bulkUpsert(Array.isArray(records) ? records : []);
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history/migrate
  if (req.method === 'POST' && req.url === '/api/history/migrate') {
    try {
      const records = await readBody(req);
      await bulkUpsert(Array.isArray(records) ? records : []);
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history/rename
  if (req.method === 'POST' && req.url === '/api/history/rename') {
    try {
      const { oldName, newName } = await readBody(req);
      await client.batch([
        { sql: 'UPDATE history_prod SET prospect = ? WHERE prospect = ?', args: [newName, oldName] },
        { sql: 'UPDATE history_demo SET prospect = ? WHERE prospect = ?', args: [newName, oldName] },
        { sql: 'UPDATE prospects SET name = ? WHERE name = ?',           args: [newName, oldName] },
      ], 'write');
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history (single upsert)
  if (req.method === 'POST' && req.url === '/api/history') {
    try {
      const record = await readBody(req);
      await upsertOne(record);
      res.writeHead(201); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // PUT /api/history/:id
  if (req.method === 'PUT' && req.url.startsWith('/api/history/')) {
    try {
      const id    = decodeURIComponent(req.url.slice('/api/history/'.length));
      const patch = await readBody(req);
      const colMap = { rep: 'rep', repRole: 'rep_role', prospect: 'prospect',
                       callDate: 'call_date', stage: 'stage', total: 'total',
                       letter_grade: 'letter_grade', resultsHtml: 'results_html' };
      const sets = [], vals = [];
      for (const [k, v] of Object.entries(patch)) {
        sets.push(`${colMap[k] || k} = ?`);
        vals.push(v);
      }
      if (sets.length) {
        const setClause = `SET ${sets.join(', ')} WHERE id = ?`;
        const args = [...vals, id];
        const [r1, r2] = await Promise.all([
          client.execute({ sql: `UPDATE history_prod ${setClause}`, args }),
          client.execute({ sql: `UPDATE history_demo ${setClause}`, args }),
        ]);
        if (!r1.rowsAffected && !r2.rowsAffected) console.warn(`[PUT] id not found: ${id}`);
      }
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // DELETE /api/history/demo
  if (req.method === 'DELETE' && req.url === '/api/history/demo') {
    await client.execute('DELETE FROM history_demo');
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/real
  if (req.method === 'DELETE' && req.url === '/api/history/real') {
    await client.execute('DELETE FROM history_prod');
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/:id
  if (req.method === 'DELETE' && req.url.startsWith('/api/history/')) {
    const id = decodeURIComponent(req.url.slice('/api/history/'.length));
    await client.batch([
      { sql: 'DELETE FROM history_prod WHERE id = ?', args: [id] },
      { sql: 'DELETE FROM history_demo WHERE id = ?', args: [id] },
    ], 'write');
    res.writeHead(200); res.end();
    return;
  }

  // ── Prospects API ──────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/prospects') {
    const rows = (await client.execute('SELECT * FROM prospects ORDER BY name ASC')).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({ name: String(r.name), industry: r.industry ? String(r.industry) : null }))));
    return;
  }

  if (req.method === 'PUT' && req.url.startsWith('/api/prospects/')) {
    try {
      const name   = decodeURIComponent(req.url.slice('/api/prospects/'.length));
      const fields = await readBody(req);
      await client.execute({
        sql:  'INSERT INTO prospects (name, industry) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET industry = excluded.industry',
        args: [name, fields.industry || null],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Third-parties API ──────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/third-parties') {
    const rows = (await client.execute('SELECT * FROM third_parties ORDER BY name ASC')).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({
      name: String(r.name), role: r.role ? String(r.role) : null,
      organization: r.organization ? String(r.organization) : null,
      notes: r.notes ? String(r.notes) : null,
    }))));
    return;
  }

  if (req.method === 'PUT' && req.url.startsWith('/api/third-parties/')) {
    try {
      const name   = decodeURIComponent(req.url.slice('/api/third-parties/'.length));
      const fields = await readBody(req);
      await client.execute({
        sql:  `INSERT INTO third_parties (name, role, organization, notes) VALUES (?, ?, ?, ?)
               ON CONFLICT(name) DO UPDATE SET role=excluded.role, organization=excluded.organization, notes=excluded.notes`,
        args: [name, fields.role || null, fields.organization || null, fields.notes || null],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/third-parties/')) {
    const name = decodeURIComponent(req.url.slice('/api/third-parties/'.length));
    await client.execute({ sql: 'DELETE FROM third_parties WHERE name = ?', args: [name] });
    res.writeHead(200); res.end();
    return;
  }

  // ── Usage API ──────────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/usage') {
    const row = (await client.execute("SELECT cost, calls FROM usage WHERE id = 'global'")).rows[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(row ? { cost: Number(row.cost), calls: Number(row.calls) } : { cost: 0, calls: 0 }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/usage') {
    try {
      const { cost, calls } = await readBody(req);
      await client.execute({
        sql: `INSERT INTO usage (id, cost, calls) VALUES ('global', ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                cost  = MAX(cost,  excluded.cost),
                calls = MAX(calls, excluded.calls)`,
        args: [cost || 0, calls || 0],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Team API ───────────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/team') {
    const rows = (await client.execute('SELECT name, role, idx FROM team ORDER BY idx ASC, name ASC')).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({
      name: String(r.name),
      role: r.role ? String(r.role) : '',
    }))));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/team') {
    try {
      const members = await readBody(req);
      if (!Array.isArray(members)) { res.writeHead(400); res.end('Expected array'); return; }
      const ops = [{ sql: 'DELETE FROM team' }];
      members.forEach((m, i) => {
        if (!m.name) return;
        ops.push({
          sql:  'INSERT OR REPLACE INTO team (name, role, idx) VALUES (?, ?, ?)',
          args: [String(m.name), m.role ? String(m.role) : '', i],
        });
      });
      await client.batch(ops, 'write');
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Transcripts API ────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/transcripts') {
    const rows = (await client.execute(
      'SELECT id,label,prospect,stage,rep,call_date,saved_at FROM transcripts ORDER BY saved_at DESC'
    )).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({
      id: String(r.id), label: String(r.label),
      prospect: r.prospect ? String(r.prospect) : null,
      stage: r.stage ? String(r.stage) : null,
      rep: r.rep ? String(r.rep) : null,
      call_date: r.call_date ? String(r.call_date) : null,
      saved_at: String(r.saved_at),
    }))));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcripts') {
    try {
      const { id, label, prospect, stage, rep, call_date, transcript } = await readBody(req);
      await client.execute({
        sql:  `INSERT OR REPLACE INTO transcripts (id,label,prospect,stage,rep,call_date,transcript,saved_at) VALUES (?,?,?,?,?,?,?,?)`,
        args: [String(id), label || prospect || 'Untitled', prospect||null, stage||null,
               rep||null, call_date||null, transcript, new Date().toISOString()],
      });
      res.writeHead(201); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/transcripts/')) {
    const id  = decodeURIComponent(req.url.slice('/api/transcripts/'.length));
    const row = (await client.execute({ sql: 'SELECT * FROM transcripts WHERE id = ?', args: [id] })).rows[0];
    if (!row) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: String(row.id), label: String(row.label),
      prospect: row.prospect ? String(row.prospect) : null,
      stage: row.stage ? String(row.stage) : null,
      rep: row.rep ? String(row.rep) : null,
      call_date: row.call_date ? String(row.call_date) : null,
      transcript: String(row.transcript),
      saved_at: String(row.saved_at),
    }));
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/transcripts/')) {
    const id = decodeURIComponent(req.url.slice('/api/transcripts/'.length));
    await client.execute({ sql: 'DELETE FROM transcripts WHERE id = ?', args: [id] });
    res.writeHead(200); res.end();
    return;
  }

  // ── Static files ───────────────────────────────────────────
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    return;
  }

  const filePath = path.join(__dirname, 'public', req.url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext  = path.extname(filePath);
    const mime = { '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  OneAxiom SIREN running at http://localhost:${PORT}\n`);
  if (!API_KEY) console.warn('  ⚠  ANTHROPIC_API_KEY not set — API calls will fail.\n');
});
