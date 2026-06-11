import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

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

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ── SQLite ────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'siren.db'));
db.pragma('journal_mode = WAL');

const HISTORY_COLS = `
    id            TEXT PRIMARY KEY,
    ts            TEXT NOT NULL,
    call_date     TEXT,
    prospect      TEXT,
    rep           TEXT,
    rep_role      TEXT,
    contact_title TEXT,
    stage         TEXT,
    total         INTEGER DEFAULT 0,
    letter_grade  TEXT,
    grade_label   TEXT,
    top_strength  TEXT,
    top_priority  TEXT,
    results_html  TEXT,
    participants  TEXT,
    dimensions    TEXT,
    next_steps    TEXT,
    overview      TEXT
`;

db.exec(`
  CREATE TABLE IF NOT EXISTS history_prod (${HISTORY_COLS});
  CREATE TABLE IF NOT EXISTS history_demo (${HISTORY_COLS});
  CREATE TABLE IF NOT EXISTS prospects (
    name     TEXT PRIMARY KEY,
    industry TEXT
  );
`);

// One-time migrations
db.transaction(() => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);

  // Rename old 'history' table → history_prod
  if (tables.includes('history') && !tables.includes('history_prod')) {
    db.prepare('ALTER TABLE history RENAME TO history_prod').run();
    console.log('[db] Renamed history → history_prod');
  }

  // Move any demo rows that landed in history_prod into history_demo
  // (only if the old schema's is_demo column still exists on the table)
  const hasDemoCol = db.prepare("PRAGMA table_info(history_prod)").all().some(c => c.name === 'is_demo');
  if (hasDemoCol) {
    const demoRows = db.prepare("SELECT * FROM history_prod WHERE is_demo = 1").all();
    if (demoRows.length) {
      const cols = Object.keys(demoRows[0]).filter(k => k !== 'is_demo').join(', ');
      const placeholders = Object.keys(demoRows[0]).filter(k => k !== 'is_demo').map(k => `@${k}`).join(', ');
      const ins = db.prepare(`INSERT OR IGNORE INTO history_demo (${cols}) VALUES (${placeholders})`);
      demoRows.forEach(r => { const { is_demo, ...rest } = r; ins.run(rest); });
      db.prepare("DELETE FROM history_prod WHERE is_demo = 1").run();
      console.log(`[db] Migrated ${demoRows.length} demo rows → history_demo`);
    }
  }
})();

const DB_COLS = `id, ts, call_date, prospect, rep, rep_role, contact_title, stage,
     total, letter_grade, grade_label, top_strength, top_priority,
     results_html, participants, dimensions, next_steps, overview`;
const DB_VALS = `@id, @ts, @call_date, @prospect, @rep, @rep_role, @contact_title, @stage,
     @total, @letter_grade, @grade_label, @top_strength, @top_priority,
     @results_html, @participants, @dimensions, @next_steps, @overview`;

const stmtUpsertReal = db.prepare(`INSERT OR REPLACE INTO history_prod (${DB_COLS}) VALUES (${DB_VALS})`);
const stmtUpsertDemo = db.prepare(`INSERT OR REPLACE INTO history_demo (${DB_COLS}) VALUES (${DB_VALS})`);

function isDemo(r) { return !!(r.is_demo) || String(r.id || '').startsWith('demo-'); }

function dbRowToRecord(row, demoFlag) {
  return {
    id:           row.id,
    ts:           row.ts,
    callDate:     row.call_date     || '',
    prospect:     row.prospect      || '',
    rep:          row.rep           || '',
    repRole:      row.rep_role      || '',
    contactTitle: row.contact_title || '',
    stage:        row.stage         || '',
    total:        row.total         || 0,
    letter_grade: row.letter_grade  || '',
    grade_label:  row.grade_label   || '',
    top_strength: row.top_strength  || '',
    top_priority: row.top_priority  || '',
    resultsHtml:  row.results_html  || '',
    is_demo:      !!demoFlag,
    participants: row.participants ? JSON.parse(row.participants) : undefined,
    dimensions:   row.dimensions   ? JSON.parse(row.dimensions)   : undefined,
    next_steps:   row.next_steps   ? JSON.parse(row.next_steps)   : undefined,
    overview:     row.overview      || undefined,
  };
}

function recordToDbRow(r) {
  return {
    id:            String(r.id),
    ts:            r.ts || new Date().toISOString(),
    call_date:     r.callDate      || null,
    prospect:      r.prospect      || null,
    rep:           r.rep           || null,
    rep_role:      r.repRole       || null,
    contact_title: r.contactTitle  || null,
    stage:         r.stage         || null,
    total:         r.total         || 0,
    letter_grade:  r.letter_grade  || null,
    grade_label:   r.grade_label   || null,
    top_strength:  r.top_strength  || null,
    top_priority:  r.top_priority  || null,
    results_html:  r.resultsHtml   || null,
    participants:  r.participants  ? JSON.stringify(r.participants) : null,
    dimensions:    r.dimensions    ? JSON.stringify(r.dimensions)   : null,
    next_steps:    r.next_steps    ? JSON.stringify(r.next_steps)   : null,
    overview:      r.overview      || null,
  };
}

function upsertOne(r) {
  const row = recordToDbRow(r);
  (isDemo(r) ? stmtUpsertDemo : stmtUpsertReal).run(row);
}

const bulkUpsert = db.transaction(records => records.forEach(upsertOne));

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
        console.log(`[proxy] ${proxyRes.statusCode} from Anthropic`);
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

  // GET /api/history — real + demo records, newest first
  if (req.method === 'GET' && req.url.startsWith('/api/history')) {
    const real = db.prepare('SELECT * FROM history_prod ORDER BY ts DESC').all().map(r => dbRowToRecord(r, false));
    const demo = db.prepare('SELECT * FROM history_demo ORDER BY ts DESC').all().map(r => dbRowToRecord(r, true));
    const all  = [...real, ...demo].sort((a, b) => (b.ts > a.ts ? 1 : -1));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(all));
    return;
  }

  // POST /api/history/bulk — insert/replace many records, routed by is_demo
  if (req.method === 'POST' && req.url === '/api/history/bulk') {
    try {
      const records = await readBody(req);
      bulkUpsert(Array.isArray(records) ? records : []);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // POST /api/history/migrate — one-time import from localStorage, routed by is_demo
  if (req.method === 'POST' && req.url === '/api/history/migrate') {
    try {
      const records = await readBody(req);
      bulkUpsert(Array.isArray(records) ? records : []);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // POST /api/history/rename — rename prospect in history + prospects tables
  if (req.method === 'POST' && req.url === '/api/history/rename') {
    try {
      const { oldName, newName } = await readBody(req);
      const stmt = 'UPDATE %t SET prospect = ? WHERE prospect = ?';
      db.prepare(stmt.replace('%t', 'history_prod')).run(newName, oldName);
      db.prepare(stmt.replace('%t', 'history_demo')).run(newName, oldName);
      db.prepare('UPDATE prospects SET name = ? WHERE name = ?').run(newName, oldName);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // ── Prospects API ──────────────────────────────────────────

  // GET /api/prospects — all prospect records
  if (req.method === 'GET' && req.url === '/api/prospects') {
    const rows = db.prepare('SELECT * FROM prospects ORDER BY name ASC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // PUT /api/prospects/:name — upsert industry (and future fields)
  if (req.method === 'PUT' && req.url.startsWith('/api/prospects/')) {
    try {
      const name = decodeURIComponent(req.url.slice('/api/prospects/'.length));
      const fields = await readBody(req);
      db.prepare('INSERT INTO prospects (name, industry) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET industry = excluded.industry')
        .run(name, fields.industry || null);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // POST /api/history — upsert one record, routed by is_demo
  if (req.method === 'POST' && req.url === '/api/history') {
    try {
      const record = await readBody(req);
      upsertOne(record);
      res.writeHead(201); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // PUT /api/history/:id — partial update, try real table then demo table
  if (req.method === 'PUT' && req.url.startsWith('/api/history/')) {
    try {
      const id = decodeURIComponent(req.url.slice('/api/history/'.length));
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
        const sql = `SET ${sets.join(', ')} WHERE id = ?`;
        const changed = db.prepare(`UPDATE history_prod ${sql}`).run(...vals, id).changes
                      + db.prepare(`UPDATE history_demo ${sql}`).run(...vals, id).changes;
        if (!changed) console.warn(`[PUT] id not found in either table: ${id}`);
      }
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // DELETE /api/history/demo — clear entire demo table
  if (req.method === 'DELETE' && req.url === '/api/history/demo') {
    db.prepare('DELETE FROM history_demo').run();
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/real — clear entire real table
  if (req.method === 'DELETE' && req.url === '/api/history/real') {
    db.prepare('DELETE FROM history_prod').run();
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/:id — delete from whichever table holds it
  if (req.method === 'DELETE' && req.url.startsWith('/api/history/')) {
    const id = decodeURIComponent(req.url.slice('/api/history/'.length));
    db.prepare('DELETE FROM history_prod     WHERE id = ?').run(id);
    db.prepare('DELETE FROM history_demo WHERE id = ?').run(id);
    res.writeHead(200); res.end();
    return;
  }

  // ── Static files ───────────────────────────────────────────
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(htmlPath));
    return;
  }

  const filePath = path.join(__dirname, 'public', req.url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
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
