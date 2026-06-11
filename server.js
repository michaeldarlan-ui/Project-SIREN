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

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
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
    is_demo       INTEGER DEFAULT 0,
    participants  TEXT,
    dimensions    TEXT,
    next_steps    TEXT,
    overview      TEXT
  )
`);

function dbRowToRecord(row) {
  return {
    id:           row.id,
    ts:           row.ts,
    callDate:     row.call_date  || '',
    prospect:     row.prospect   || '',
    rep:          row.rep        || '',
    repRole:      row.rep_role   || '',
    contactTitle: row.contact_title || '',
    stage:        row.stage      || '',
    total:        row.total      || 0,
    letter_grade: row.letter_grade || '',
    grade_label:  row.grade_label  || '',
    top_strength: row.top_strength || '',
    top_priority: row.top_priority || '',
    resultsHtml:  row.results_html || '',
    is_demo:      !!row.is_demo,
    participants: row.participants ? JSON.parse(row.participants) : undefined,
    dimensions:   row.dimensions   ? JSON.parse(row.dimensions)   : undefined,
    next_steps:   row.next_steps   ? JSON.parse(row.next_steps)   : undefined,
    overview:     row.overview     || undefined,
  };
}

function recordToDbRow(r) {
  const id = String(r.id);
  return {
    id,
    ts:            r.ts || new Date().toISOString(),
    call_date:     r.callDate     || null,
    prospect:      r.prospect     || null,
    rep:           r.rep          || null,
    rep_role:      r.repRole      || null,
    contact_title: r.contactTitle || null,
    stage:         r.stage        || null,
    total:         r.total        || 0,
    letter_grade:  r.letter_grade || null,
    grade_label:   r.grade_label  || null,
    top_strength:  r.top_strength || null,
    top_priority:  r.top_priority || null,
    results_html:  r.resultsHtml  || null,
    is_demo:       r.is_demo ? 1 : (id.startsWith('demo-') ? 1 : 0),
    participants:  r.participants ? JSON.stringify(r.participants) : null,
    dimensions:    r.dimensions   ? JSON.stringify(r.dimensions)   : null,
    next_steps:    r.next_steps   ? JSON.stringify(r.next_steps)   : null,
    overview:      r.overview     || null,
  };
}

const stmtUpsert = db.prepare(`
  INSERT OR REPLACE INTO history
    (id, ts, call_date, prospect, rep, rep_role, contact_title, stage,
     total, letter_grade, grade_label, top_strength, top_priority,
     results_html, is_demo, participants, dimensions, next_steps, overview)
  VALUES
    (@id, @ts, @call_date, @prospect, @rep, @rep_role, @contact_title, @stage,
     @total, @letter_grade, @grade_label, @top_strength, @top_priority,
     @results_html, @is_demo, @participants, @dimensions, @next_steps, @overview)
`);
const bulkUpsert = db.transaction(records => records.forEach(r => stmtUpsert.run(recordToDbRow(r))));

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

  // GET /api/history — all records ordered newest first
  if (req.method === 'GET' && req.url.startsWith('/api/history')) {
    const rows = db.prepare('SELECT * FROM history ORDER BY ts DESC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(dbRowToRecord)));
    return;
  }

  // POST /api/history/bulk — insert/replace many records at once
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

  // POST /api/history/migrate — one-time import from localStorage
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

  // POST /api/history/rename — rename prospect across all records
  if (req.method === 'POST' && req.url === '/api/history/rename') {
    try {
      const { oldName, newName } = await readBody(req);
      db.prepare('UPDATE history SET prospect = ? WHERE prospect = ?').run(newName, oldName);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // POST /api/history — upsert one record
  if (req.method === 'POST' && req.url === '/api/history') {
    try {
      const record = await readBody(req);
      stmtUpsert.run(recordToDbRow(record));
      res.writeHead(201); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // PUT /api/history/:id — partial field update
  if (req.method === 'PUT' && req.url.startsWith('/api/history/')) {
    try {
      const id = decodeURIComponent(req.url.slice('/api/history/'.length));
      const patch = await readBody(req);
      // Map camelCase patch keys to DB columns
      const colMap = { rep: 'rep', repRole: 'rep_role', prospect: 'prospect',
                       callDate: 'call_date', stage: 'stage', total: 'total',
                       letter_grade: 'letter_grade', resultsHtml: 'results_html' };
      const sets = [], vals = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = colMap[k] || k;
        sets.push(`${col} = ?`);
        vals.push(v);
      }
      if (sets.length) db.prepare(`UPDATE history SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
      res.writeHead(200); res.end();
    } catch (e) {
      res.writeHead(400); res.end(e.message);
    }
    return;
  }

  // DELETE /api/history/demo — delete all demo records
  if (req.method === 'DELETE' && req.url === '/api/history/demo') {
    db.prepare("DELETE FROM history WHERE is_demo = 1").run();
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/real — delete all non-demo records
  if (req.method === 'DELETE' && req.url === '/api/history/real') {
    db.prepare("DELETE FROM history WHERE is_demo = 0").run();
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/:id — delete one record
  if (req.method === 'DELETE' && req.url.startsWith('/api/history/')) {
    const id = decodeURIComponent(req.url.slice('/api/history/'.length));
    db.prepare('DELETE FROM history WHERE id = ?').run(id);
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
