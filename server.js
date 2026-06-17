import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
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
  total INTEGER DEFAULT 0, normalized_score INTEGER DEFAULT 0, letter_grade TEXT, grade_label TEXT,
  top_strength TEXT, top_priority TEXT, results_html TEXT,
  participants TEXT, dimensions TEXT, next_steps TEXT, overview TEXT,
  partner_scores TEXT, rep_scores TEXT, spiced TEXT
`;

await client.batch([
  { sql: `CREATE TABLE IF NOT EXISTS history_prod (${HISTORY_COLS})` },
  { sql: `CREATE TABLE IF NOT EXISTS prospects (name TEXT PRIMARY KEY, industry TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS third_parties (name TEXT PRIMARY KEY, role TEXT, organization TEXT, notes TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS transcripts (id TEXT PRIMARY KEY, label TEXT NOT NULL, prospect TEXT, stage TEXT, rep TEXT, call_date TEXT, transcript TEXT NOT NULL, saved_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS team (name TEXT PRIMARY KEY, role TEXT, idx INTEGER DEFAULT 0)` },
  { sql: `CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, cost REAL DEFAULT 0, calls INTEGER DEFAULT 0)` },
  { sql: `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS roadmap (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'planned', created_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT, entity_label TEXT, rep TEXT, stage TEXT, score TEXT, letter_grade TEXT, details TEXT, created_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS account_profiles (company TEXT PRIMARY KEY, profile TEXT NOT NULL, updated_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS usage_daily (
      day TEXT, model TEXT,
      cost REAL DEFAULT 0, calls INTEGER DEFAULT 0,
      tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0,
      cache_write INTEGER DEFAULT 0, cache_read INTEGER DEFAULT 0,
      PRIMARY KEY (day, model)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS usage_feature (
      day TEXT, feature TEXT,
      cost REAL DEFAULT 0, calls INTEGER DEFAULT 0,
      tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0,
      PRIMARY KEY (day, feature)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_reps (
      call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      total INTEGER DEFAULT 0,
      letter_grade TEXT,
      role_max INTEGER DEFAULT 0,
      grade_label TEXT,
      top_strength TEXT,
      top_priority TEXT,
      normalized_score INTEGER DEFAULT 0,
      PRIMARY KEY (call_id, name)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_dimensions (
      call_id TEXT NOT NULL,
      rep_name TEXT NOT NULL,
      name TEXT NOT NULL,
      max INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      feedback TEXT,
      PRIMARY KEY (call_id, rep_name, name)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_next_steps (
      call_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (call_id, idx)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_spiced (
      call_id TEXT NOT NULL,
      aspect TEXT NOT NULL,
      touched INTEGER NOT NULL DEFAULT 0,
      summary TEXT,
      PRIMARY KEY (call_id, aspect)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_rep_summary (
      call_id TEXT NOT NULL,
      rep_name TEXT NOT NULL,
      type TEXT NOT NULL,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (call_id, rep_name, type, idx)
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS call_partners (
      call_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      total INTEGER DEFAULT 0,
      letter_grade TEXT,
      role_max INTEGER DEFAULT 0,
      grade_label TEXT,
      top_strength TEXT,
      top_priority TEXT,
      normalized_score INTEGER DEFAULT 0,
      PRIMARY KEY (call_id, name)
    )` },
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

  // Add partner_scores / rep_scores / spiced / normalized_score columns to history_prod if missing
  if (tables.includes('history_prod')) {
    const cols = (await client.execute('PRAGMA table_info(history_prod)')).rows.map(r => String(r.name));
    if (!cols.includes('partner_scores')) { await client.execute('ALTER TABLE history_prod ADD COLUMN partner_scores TEXT'); }
    if (!cols.includes('rep_scores'))     { await client.execute('ALTER TABLE history_prod ADD COLUMN rep_scores TEXT'); }
    if (!cols.includes('spiced'))         { await client.execute('ALTER TABLE history_prod ADD COLUMN spiced TEXT'); }
    if (!cols.includes('normalized_score')) {
      await client.execute('ALTER TABLE history_prod ADD COLUMN normalized_score INTEGER DEFAULT 0');
      await client.execute('UPDATE history_prod SET normalized_score = total WHERE normalized_score = 0 AND total > 0');
    }
  }

  // Add new columns to call_reps if missing (table already existed before these were added)
  {
    const crCols = (await client.execute('PRAGMA table_info(call_reps)')).rows.map(r => String(r.name));
    if (!crCols.includes('role_max'))        await client.execute('ALTER TABLE call_reps ADD COLUMN role_max INTEGER DEFAULT 0');
    if (!crCols.includes('grade_label'))     await client.execute('ALTER TABLE call_reps ADD COLUMN grade_label TEXT');
    if (!crCols.includes('top_strength'))    await client.execute('ALTER TABLE call_reps ADD COLUMN top_strength TEXT');
    if (!crCols.includes('top_priority'))    await client.execute('ALTER TABLE call_reps ADD COLUMN top_priority TEXT');
    if (!crCols.includes('normalized_score')) await client.execute('ALTER TABLE call_reps ADD COLUMN normalized_score INTEGER DEFAULT 0');
  }

  // Backfill all normalized call tables from rep_scores/partner_scores/spiced/next_steps JSON
  {
    const [repCount, dimCount, stepsCount, spicedCount] = await Promise.all([
      client.execute('SELECT COUNT(*) as n FROM call_reps'),
      client.execute('SELECT COUNT(*) as n FROM call_dimensions'),
      client.execute('SELECT COUNT(*) as n FROM call_next_steps'),
      client.execute('SELECT COUNT(*) as n FROM call_spiced'),
    ]);
    const needsBackfill = Number(dimCount.rows[0].n) === 0 || Number(repCount.rows[0].n) === 0;
    if (needsBackfill) {
      const rows = (await client.execute('SELECT id, rep, rep_scores, partner_scores, spiced, next_steps FROM history_prod')).rows;
      const stmts = [];
      for (const row of rows) {
        const callId = String(row.id);
        const primaryRep = row.rep ? String(row.rep).trim() : null;
        let rs = []; try { rs = JSON.parse(String(row.rep_scores || '[]')); } catch {}
        let ps = []; try { ps = JSON.parse(String(row.partner_scores || '[]')); } catch {}
        let spiced = null; try { spiced = JSON.parse(String(row.spiced || 'null')); } catch {}
        let nextSteps = []; try { nextSteps = JSON.parse(String(row.next_steps || '[]')); } catch {}

        // call_reps
        const seenReps = new Set();
        for (const r of rs) {
          if (!r.name) continue;
          const name = String(r.name).trim();
          seenReps.add(name.toLowerCase());
          stmts.push({ sql: `INSERT OR REPLACE INTO call_reps (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            args: [callId, name, primaryRep && name.toLowerCase()===primaryRep.toLowerCase() ? 1 : 0,
                   r.total||0, r.letter_grade||null, r.role_max||0, r.grade_label||null,
                   r.top_strength||null, r.top_priority||null, r.normalized_score||0] });
          // call_dimensions
          for (const d of (r.dimensions||[])) {
            stmts.push({ sql: `INSERT OR IGNORE INTO call_dimensions (call_id,rep_name,name,max,score,feedback) VALUES (?,?,?,?,?,?)`,
              args: [callId, name, d.name||'', d.max||0, d.score||0, d.feedback||null] });
          }
          // call_rep_summary
          const cs = r.call_summary || {};
          for (const type of ['positives','missed','improvements']) {
            (cs[type]||[]).forEach((text, idx) => {
              stmts.push({ sql: `INSERT OR IGNORE INTO call_rep_summary (call_id,rep_name,type,idx,text) VALUES (?,?,?,?,?)`,
                args: [callId, name, type, idx, text] });
            });
          }
        }
        if (primaryRep && !seenReps.has(primaryRep.toLowerCase())) {
          stmts.push({ sql: `INSERT OR IGNORE INTO call_reps (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            args: [callId, primaryRep, 1, 0, null, 0, null, null, null, 0] });
        }

        // call_partners
        for (const p of ps) {
          if (!p.name) continue;
          stmts.push({ sql: `INSERT OR REPLACE INTO call_partners (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            args: [callId, String(p.name).trim(), 0, p.total||0, p.letter_grade||null, p.role_max||0, p.grade_label||null, p.top_strength||null, p.top_priority||null, p.normalized_score||0] });
        }

        // call_spiced
        if (spiced && typeof spiced === 'object') {
          for (const [aspect, val] of Object.entries(spiced)) {
            if (val && typeof val === 'object') {
              stmts.push({ sql: `INSERT OR IGNORE INTO call_spiced (call_id,aspect,touched,summary) VALUES (?,?,?,?)`,
                args: [callId, aspect, val.touched ? 1 : 0, val.summary||null] });
            }
          }
        }

        // call_next_steps
        if (Array.isArray(nextSteps)) {
          nextSteps.forEach((text, idx) => {
            stmts.push({ sql: `INSERT OR IGNORE INTO call_next_steps (call_id,idx,text) VALUES (?,?,?)`,
              args: [callId, idx, String(text)] });
          });
        }
      }
      if (stmts.length) await client.batch(stmts, 'write');
      console.log(`[db] Backfilled normalized call tables with ${stmts.length} rows`);
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
  total, normalized_score, letter_grade, grade_label, top_strength, top_priority,
  results_html, participants, dimensions, next_steps, overview, partner_scores, rep_scores, spiced`;

const DB_PARAMS = `?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?, ?, ?`;

function dbRowToRecord(row) {
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
    total:            Number(row.total) || 0,
    normalized_score: Number(row.normalized_score) || 0,
    letter_grade: s('letter_grade'),
    grade_label:  s('grade_label'),
    top_strength: s('top_strength'),
    top_priority: s('top_priority'),
    resultsHtml:  s('results_html'),
    participants:   j('participants'),
    dimensions:     j('dimensions'),
    next_steps:     j('next_steps'),
    overview:       row.overview ? String(row.overview) : undefined,
    partner_scores: j('partner_scores'),
    rep_scores:     j('rep_scores'),
    spiced:         j('spiced'),
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
    r.total            || 0,
    r.normalized_score || 0,
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
    ser(r.spiced),
  ];
}

async function syncNormalizedTables(r) {
  const callId = String(r.id);
  const primaryRep = r.rep ? String(r.rep).trim() : null;
  const rs  = Array.isArray(r.rep_scores)     ? r.rep_scores     : [];
  const ps  = Array.isArray(r.partner_scores) ? r.partner_scores : [];
  const nextSteps = Array.isArray(r.next_steps) ? r.next_steps : [];
  const spiced    = r.spiced && typeof r.spiced === 'object' ? r.spiced : null;

  const stmts = [
    { sql: `DELETE FROM call_reps       WHERE call_id = ?`, args: [callId] },
    { sql: `DELETE FROM call_partners   WHERE call_id = ?`, args: [callId] },
    { sql: `DELETE FROM call_dimensions WHERE call_id = ?`, args: [callId] },
    { sql: `DELETE FROM call_rep_summary WHERE call_id = ?`, args: [callId] },
    { sql: `DELETE FROM call_next_steps WHERE call_id = ?`, args: [callId] },
    { sql: `DELETE FROM call_spiced     WHERE call_id = ?`, args: [callId] },
  ];

  const seenReps = new Set();
  for (const entry of rs) {
    if (!entry.name) continue;
    const name = String(entry.name).trim();
    seenReps.add(name.toLowerCase());
    stmts.push({ sql: `INSERT INTO call_reps (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [callId, name, primaryRep && name.toLowerCase()===primaryRep.toLowerCase() ? 1 : 0,
             entry.total||0, entry.letter_grade||null, entry.role_max||0,
             entry.grade_label||null, entry.top_strength||null, entry.top_priority||null, entry.normalized_score||0] });
    for (const d of (entry.dimensions||[])) {
      stmts.push({ sql: `INSERT INTO call_dimensions (call_id,rep_name,name,max,score,feedback) VALUES (?,?,?,?,?,?)`,
        args: [callId, name, d.name||'', d.max||0, d.score||0, d.feedback||null] });
    }
    const cs = entry.call_summary || {};
    for (const type of ['positives','missed','improvements']) {
      (cs[type]||[]).forEach((text, idx) => {
        stmts.push({ sql: `INSERT INTO call_rep_summary (call_id,rep_name,type,idx,text) VALUES (?,?,?,?,?)`,
          args: [callId, name, type, idx, String(text)] });
      });
    }
  }
  if (primaryRep && !seenReps.has(primaryRep.toLowerCase())) {
    stmts.push({ sql: `INSERT INTO call_reps (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [callId, primaryRep, 1, 0, null, 0, null, null, null, 0] });
  }

  for (const p of ps) {
    if (!p.name) continue;
    stmts.push({ sql: `INSERT INTO call_partners (call_id,name,is_primary,total,letter_grade,role_max,grade_label,top_strength,top_priority,normalized_score) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [callId, String(p.name).trim(), 0, p.total||0, p.letter_grade||null, p.role_max||0,
             p.grade_label||null, p.top_strength||null, p.top_priority||null, p.normalized_score||0] });
  }

  if (spiced) {
    for (const [aspect, val] of Object.entries(spiced)) {
      if (val && typeof val === 'object') {
        stmts.push({ sql: `INSERT INTO call_spiced (call_id,aspect,touched,summary) VALUES (?,?,?,?)`,
          args: [callId, aspect, val.touched ? 1 : 0, val.summary||null] });
      }
    }
  }

  nextSteps.forEach((text, idx) => {
    stmts.push({ sql: `INSERT INTO call_next_steps (call_id,idx,text) VALUES (?,?,?)`,
      args: [callId, idx, String(text)] });
  });

  await client.batch(stmts, 'write');
}

async function upsertOne(r) {
  await client.execute({
    sql:  `INSERT OR REPLACE INTO history_prod (${DB_COLS}) VALUES (${DB_PARAMS})`,
    args: recordToArgs(r),
  });
  await syncNormalizedTables(r);
}

async function bulkUpsert(records) {
  if (!records.length) return;
  await client.batch(records.map(r => ({
    sql:  `INSERT OR REPLACE INTO history_prod (${DB_COLS}) VALUES (${DB_PARAMS})`,
    args: recordToArgs(r),
  })), 'write');
  for (const r of records) await syncNormalizedTables(r);
}

// ── API call metering ─────────────────────────────────────────
// Every /api/claude proxy call is metered here (server-side), so all
// modules — grading, pre-scan, FORGE, ATLAS, COACH — are counted.
// Accumulates into the shared Turso `usage` table: an all-time row
// ('global') and a per-month row ('mYYYY-MM') so the PULSE tile can
// match the Claude console's "spend this month" window.

function _usageMonthKey() { return 'm' + new Date().toISOString().slice(0, 7); }

async function meterApiCall(model, usage, feature) {
  if (!usage) return;
  const p = _ccPrice(model);
  const inTok  = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheW = usage.cache_creation_input_tokens || 0;
  const cacheR = usage.cache_read_input_tokens || 0;
  const cost = (inTok * p.in + cacheW * p.in * 1.25 + cacheR * p.in * 0.1 + outTok * p.out) / 1_000_000;
  const sql = `INSERT INTO usage (id, cost, calls) VALUES (?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET cost = usage.cost + excluded.cost, calls = usage.calls + 1`;
  const sqlDaily = `INSERT INTO usage_daily (day, model, cost, calls, tokens_in, tokens_out, cache_write, cache_read)
                    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
                    ON CONFLICT(day, model) DO UPDATE SET
                      cost        = usage_daily.cost + excluded.cost,
                      calls       = usage_daily.calls + 1,
                      tokens_in   = usage_daily.tokens_in + excluded.tokens_in,
                      tokens_out  = usage_daily.tokens_out + excluded.tokens_out,
                      cache_write = usage_daily.cache_write + excluded.cache_write,
                      cache_read  = usage_daily.cache_read + excluded.cache_read`;
  const sqlFeature = `INSERT INTO usage_feature (day, feature, cost, calls, tokens_in, tokens_out)
                      VALUES (?, ?, ?, 1, ?, ?)
                      ON CONFLICT(day, feature) DO UPDATE SET
                        cost      = usage_feature.cost + excluded.cost,
                        calls     = usage_feature.calls + 1,
                        tokens_in = usage_feature.tokens_in + excluded.tokens_in,
                        tokens_out= usage_feature.tokens_out + excluded.tokens_out`;
  const day = new Date().toISOString().slice(0, 10);
  const feat = (feature || 'Other').trim();
  try {
    await client.batch([
      { sql, args: ['global', cost] },
      { sql, args: [_usageMonthKey(), cost] },
      { sql: sqlDaily, args: [day, model || 'unknown', cost, inTok, outTok, cacheW, cacheR] },
      { sql: sqlFeature, args: [day, feat, cost, inTok, outTok] },
    ], 'write');
  } catch (e) { console.error('[meter] write failed:', e.message); }
}

// Extract usage from a buffered Anthropic response (JSON or SSE stream)
function meterFromResponse(reqModel, raw, feature) {
  try {
    let model = reqModel, usage = null;
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('{')) {
      const data = JSON.parse(trimmed);
      model = data.model || model;
      usage = data.usage || null;
    } else {
      let inTok = 0, outTok = 0, cacheW = 0, cacheR = 0, seen = false;
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        let ev; try { ev = JSON.parse(payload); } catch { continue; }
        if (ev.type === 'message_start') {
          const u = ev.message?.usage || {};
          inTok  = u.input_tokens || 0;
          cacheW = u.cache_creation_input_tokens || 0;
          cacheR = u.cache_read_input_tokens || 0;
          model  = ev.message?.model || model;
          seen = true;
        } else if (ev.type === 'message_delta' && ev.usage) {
          outTok = ev.usage.output_tokens || outTok;
          seen = true;
        }
      }
      if (seen) usage = { input_tokens: inTok, output_tokens: outTok, cache_creation_input_tokens: cacheW, cache_read_input_tokens: cacheR };
    }
    if (usage) meterApiCall(model, usage, feature);
  } catch (e) { console.error('[meter] parse failed:', e.message); }
}

// ── Claude Code usage scanner ─────────────────────────────────
// Reads local Claude Code session transcripts (~/.claude/projects/**/*.jsonl)
// and aggregates token usage + estimated cost by day. Per-file results are
// cached by mtime+size so only changed files are re-parsed.

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const _ccFileCache = new Map(); // filePath -> { mtimeMs, size, days: { 'YYYY-MM-DD': cost } }

// USD per million tokens; cache reads 0.1x input, 5m cache writes 1.25x, 1h writes 2x
function _ccPrice(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('fable')) return { in: 10, out: 50 };
  if (m.includes('opus'))  return { in: 5,  out: 25 };
  if (m.includes('haiku')) return { in: 1,  out: 5  };
  return { in: 3, out: 15 }; // sonnet (default)
}

function _ccLocalDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function _ccParseFile(filePath) {
  const days = {};
  const seenIds = new Set();
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.includes('"usage"') || !line.includes('"assistant"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const msg = o && o.message;
    const u = msg && msg.usage;
    if (o.type !== 'assistant' || !u || !o.timestamp) continue;
    // Streaming writes the same message across multiple lines — count each id once
    if (msg.id) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);
    }
    const p = _ccPrice(msg.model);
    const w5 = u.cache_creation?.ephemeral_5m_input_tokens ?? (u.cache_creation_input_tokens || 0);
    const w1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const cost =
      ((u.input_tokens || 0) * p.in +
       (u.output_tokens || 0) * p.out +
       (u.cache_read_input_tokens || 0) * p.in * 0.1 +
       w5 * p.in * 1.25 +
       w1 * p.in * 2) / 1e6;
    const day = _ccLocalDate(o.timestamp);
    days[day] = (days[day] || 0) + cost;
  }
  return days;
}

async function getClaudeUsage() {
  const days = {}; // 'YYYY-MM-DD' -> cost
  if (fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    const stack = [CLAUDE_PROJECTS_DIR];
    const files = [];
    while (stack.length) {
      const dir = stack.pop();
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.name.endsWith('.jsonl')) files.push(full);
      }
    }
    for (const f of files) {
      const st = fs.statSync(f);
      let entry = _ccFileCache.get(f);
      if (!entry || entry.mtimeMs !== st.mtimeMs || entry.size !== st.size) {
        entry = { mtimeMs: st.mtimeMs, size: st.size, days: await _ccParseFile(f) };
        _ccFileCache.set(f, entry);
      }
      for (const [day, cost] of Object.entries(entry.days)) {
        days[day] = (days[day] || 0) + cost;
      }
    }
  }
  const todayStr = _ccLocalDate(new Date().toISOString());
  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = _ccLocalDate(cutoff30.toISOString());
  let today = 0, last30 = 0, total = 0;
  for (const [day, cost] of Object.entries(days)) {
    total += cost;
    if (day === todayStr) today += cost;
    if (day >= cutoff30Str) last30 += cost;
  }
  return { today, last30, total };
}

// ── Utilities ─────────────────────────────────────────────────
function _groupBy(rows, key) {
  const out = {};
  for (const row of rows) {
    const k = String(row[key]);
    if (!out[k]) out[k] = [];
    out[k].push(row);
  }
  return out;
}

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
      let reqModel = '', reqFeature = '', proxyBody = body;
      try {
        const parsed = JSON.parse(body);
        reqModel = parsed.model || '';
        reqFeature = parsed.source || '';
        if (parsed.source !== undefined) {
          const { source, ...rest } = parsed;
          proxyBody = JSON.stringify(rest);
        }
      } catch {}
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(proxyBody),
        },
      };
      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Cache-Control': 'no-cache',
        });
        // Buffer while piping so the response usage can be metered
        let respBuf = '';
        proxyRes.on('data', chunk => { respBuf += chunk; res.write(chunk); });
        proxyRes.on('end', () => {
          res.end();
          if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
            meterFromResponse(reqModel, respBuf, reqFeature);
          }
        });
      });
      proxyReq.on('error', err => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
      });
      proxyReq.write(proxyBody);
      proxyReq.end();
    });
    return;
  }

  // ── History API ────────────────────────────────────────────

  // GET /api/history
  if (req.method === 'GET' && req.url.startsWith('/api/history') &&
      !req.url.startsWith('/api/history/')) {
    const [histRows, repRows, dimRows, summaryRows, stepRows, spicedRows, partnerRows] = await Promise.all([
      client.execute('SELECT * FROM history_prod ORDER BY ts DESC'),
      client.execute('SELECT * FROM call_reps'),
      client.execute('SELECT * FROM call_dimensions'),
      client.execute('SELECT * FROM call_rep_summary ORDER BY idx'),
      client.execute('SELECT * FROM call_next_steps ORDER BY idx'),
      client.execute('SELECT * FROM call_spiced'),
      client.execute('SELECT * FROM call_partners'),
    ]);

    // Index normalized rows by call_id
    const repsByCall     = _groupBy(repRows.rows,     'call_id');
    const dimsByCall     = _groupBy(dimRows.rows,     'call_id');
    const summaryByCall  = _groupBy(summaryRows.rows, 'call_id');
    const stepsByCall    = _groupBy(stepRows.rows,    'call_id');
    const spicedByCall   = _groupBy(spicedRows.rows,  'call_id');
    const partnersByCall = _groupBy(partnerRows.rows,  'call_id');

    const all = histRows.rows.map(row => {
      const base = dbRowToRecord(row);
      const callId = base.id;

      // Reassemble rep_scores from normalized tables
      const reps = repsByCall[callId] || [];
      const dims = dimsByCall[callId] || [];
      const summaries = summaryByCall[callId] || [];

      base.rep_scores = reps.map(rep => {
        const repDims = dims.filter(d => String(d.rep_name) === String(rep.name));
        const repSums = summaries.filter(s => String(s.rep_name) === String(rep.name));
        const cs = {};
        for (const type of ['positives','missed','improvements']) {
          const items = repSums.filter(s => String(s.type) === type).map(s => String(s.text));
          if (items.length) cs[type] = items;
        }
        return {
          name:          String(rep.name),
          is_primary:    Number(rep.is_primary) === 1,
          total:         Number(rep.total) || 0,
          letter_grade:  rep.letter_grade ? String(rep.letter_grade) : null,
          role_max:      Number(rep.role_max) || 0,
          grade_label:   rep.grade_label ? String(rep.grade_label) : null,
          top_strength:  rep.top_strength ? String(rep.top_strength) : null,
          top_priority:  rep.top_priority ? String(rep.top_priority) : null,
          normalized_score: Number(rep.normalized_score) || 0,
          dimensions:    repDims.map(d => ({ name: String(d.name), max: Number(d.max)||0, score: Number(d.score)||0, feedback: d.feedback ? String(d.feedback) : null })),
          ...(Object.keys(cs).length ? { call_summary: cs } : {}),
        };
      });

      // Reassemble partner_scores
      const partners = partnersByCall[callId] || [];
      base.partner_scores = partners.length ? partners.map(p => ({
        name: String(p.name), total: Number(p.total)||0, letter_grade: p.letter_grade ? String(p.letter_grade) : null,
        role_max: Number(p.role_max)||0, grade_label: p.grade_label ? String(p.grade_label) : null,
        top_strength: p.top_strength ? String(p.top_strength) : null, top_priority: p.top_priority ? String(p.top_priority) : null,
        normalized_score: Number(p.normalized_score)||0,
      })) : undefined;

      // Reassemble next_steps
      const steps = (stepsByCall[callId] || []).map(s => String(s.text));
      if (steps.length) base.next_steps = steps;

      // Reassemble spiced
      const spicedRows2 = spicedByCall[callId] || [];
      if (spicedRows2.length) {
        base.spiced = {};
        for (const s of spicedRows2) {
          base.spiced[String(s.aspect)] = { touched: Number(s.touched) === 1, summary: s.summary ? String(s.summary) : null };
        }
      }

      return base;
    });

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
        const r1 = await client.execute({ sql: `UPDATE history_prod ${setClause}`, args });
        if (!r1.rowsAffected) console.warn(`[PUT] id not found: ${id}`);
      }
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
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
    await client.execute({ sql: 'DELETE FROM history_prod WHERE id = ?', args: [id] });
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
    const monthKey = _usageMonthKey();
    const rows = (await client.execute({
      sql: "SELECT id, cost, calls FROM usage WHERE id IN ('global', ?)",
      args: [monthKey],
    })).rows;
    const find = id => rows.find(r => r.id === id);
    const g = find('global'), m = find(monthKey);
    const globalCost = g ? Number(g.cost) : 0;
    const monthCost  = m ? Number(m.cost) : 0;

    // Console mirror: baseline values entered by the user, advanced by
    // everything metered since the baseline was saved.
    let consoleMirror = null;
    try {
      const bRow = (await client.execute("SELECT value FROM settings WHERE key = 'usage_baseline'")).rows[0];
      if (bRow) {
        const b = JSON.parse(String(bRow.value));
        const spentSince = Math.max(0, globalCost - (b.offsetGlobalCost || 0));
        const monthSpend = (monthKey === b.monthKey)
          ? (b.monthSpend || 0) + Math.max(0, monthCost - (b.offsetMonthCost || 0))
          : monthCost; // new month: console resets, meter is authoritative
        consoleMirror = {
          balance: (b.balance || 0) - spentSince,
          monthSpend,
          savedAt: b.savedAt || null,
        };
      }
    } catch (e) { console.error('[usage] baseline read failed:', e.message); }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      cost:  globalCost,
      calls: g ? Number(g.calls) : 0,
      month: { key: monthKey.slice(1), cost: monthCost, calls: m ? Number(m.calls) : 0 },
      console: consoleMirror,
    }));
    return;
  }

  // Save console baseline: { balance, monthSpend } — offsets captured now
  if (req.method === 'POST' && req.url === '/api/usage/baseline') {
    try {
      const { balance, monthSpend } = await readBody(req);
      const monthKey = _usageMonthKey();
      const rows = (await client.execute({
        sql: "SELECT id, cost FROM usage WHERE id IN ('global', ?)",
        args: [monthKey],
      })).rows;
      const find = id => rows.find(r => r.id === id);
      const baseline = {
        balance: Number(balance) || 0,
        monthSpend: Number(monthSpend) || 0,
        monthKey,
        offsetGlobalCost: find('global') ? Number(find('global').cost) : 0,
        offsetMonthCost:  find(monthKey) ? Number(find(monthKey).cost) : 0,
        savedAt: new Date().toISOString(),
      };
      await client.execute({
        sql: `INSERT INTO settings (key, value) VALUES ('usage_baseline', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [JSON.stringify(baseline)],
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(baseline));
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // Daily per-model metrics for the USAGE dashboard
  if (req.method === 'GET' && req.url.startsWith('/api/usage-metrics')) {
    try {
      const days = Math.min(365, Math.max(1, parseInt(new URL(req.url, 'http://x').searchParams.get('days')) || 30));
      const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      const rows = (await client.execute({
        sql: 'SELECT * FROM usage_daily WHERE day >= ? ORDER BY day ASC',
        args: [since],
      })).rows.map(r => ({
        day: String(r.day), model: String(r.model),
        cost: Number(r.cost), calls: Number(r.calls),
        tokens_in: Number(r.tokens_in), tokens_out: Number(r.tokens_out),
        cache_write: Number(r.cache_write), cache_read: Number(r.cache_read),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ days, since, rows }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/usage/reset') {
    try {
      await client.batch([
        { sql: 'DELETE FROM usage' },
        { sql: 'DELETE FROM usage_daily' },
      ], 'write');
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(500); res.end(e.message); }
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

  // ── Usage by feature API ──────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/api/usage/by-feature')) {
    try {
      const params = new URL(req.url, 'http://x').searchParams;
      const days = Math.min(parseInt(params.get('days') || '30', 10), 365);
      const cutoff = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      const rows = (await client.execute({
        sql: 'SELECT feature, SUM(cost) as cost, SUM(calls) as calls, SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out FROM usage_feature WHERE day >= ? GROUP BY feature ORDER BY cost DESC',
        args: [cutoff],
      })).rows;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map(r => ({
        feature: String(r.feature),
        cost: Number(r.cost) || 0,
        calls: Number(r.calls) || 0,
        tokens_in: Number(r.tokens_in) || 0,
        tokens_out: Number(r.tokens_out) || 0,
      }))));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── Claude Code usage API ──────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/claude-usage') {
    try {
      const usage = await getClaudeUsage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(usage));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
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

  // ── Roadmap API ────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/roadmap') {
    const rows = (await client.execute('SELECT id, title, description, status, created_at FROM roadmap ORDER BY id DESC')).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({
      id: Number(r.id), title: String(r.title),
      desc: r.description ? String(r.description) : '',
      status: String(r.status), ts: String(r.created_at),
    }))));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/roadmap') {
    try {
      const { title, desc, status } = await readBody(req);
      if (!title) { res.writeHead(400); res.end('title required'); return; }
      const now = new Date().toISOString();
      const result = await client.execute({
        sql: 'INSERT INTO roadmap (title, description, status, created_at) VALUES (?, ?, ?, ?)',
        args: [String(title), desc ? String(desc) : '', status || 'planned', now],
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: Number(result.lastInsertRowid) }));
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'PATCH' && req.url.startsWith('/api/roadmap/')) {
    try {
      const id = parseInt(req.url.slice('/api/roadmap/'.length));
      const { status, title, desc } = await readBody(req);
      if (status)  await client.execute({ sql: 'UPDATE roadmap SET status = ? WHERE id = ?',      args: [String(status), id] });
      if (title)   await client.execute({ sql: 'UPDATE roadmap SET title = ? WHERE id = ?',       args: [String(title), id] });
      if (desc !== undefined) await client.execute({ sql: 'UPDATE roadmap SET description = ? WHERE id = ?', args: [String(desc), id] });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/roadmap/')) {
    try {
      const id = parseInt(req.url.slice('/api/roadmap/'.length));
      await client.execute({ sql: 'DELETE FROM roadmap WHERE id = ?', args: [id] });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Audit Log API ──────────────────────────────────────────

  if (req.method === 'GET' && req.url.startsWith('/api/audit')) {
    const params = new URL(req.url, 'http://x').searchParams;
    const limit  = Math.min(500, Math.max(1, parseInt(params.get('limit')) || 200));
    const action = params.get('action') || null;
    const sql    = action
      ? 'SELECT * FROM audit_log WHERE action = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?';
    const args   = action ? [action, limit] : [limit];
    const rows   = (await client.execute({ sql, args })).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({
      id:           Number(r.id),
      action:       String(r.action),
      entity_id:    r.entity_id   ? String(r.entity_id)   : null,
      entity_label: r.entity_label ? String(r.entity_label) : null,
      rep:          r.rep          ? String(r.rep)          : null,
      stage:        r.stage        ? String(r.stage)        : null,
      score:        r.score        ? String(r.score)        : null,
      letter_grade: r.letter_grade ? String(r.letter_grade) : null,
      details:      r.details      ? JSON.parse(String(r.details)) : null,
      created_at:   String(r.created_at),
    }))));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/audit') {
    try {
      const { action, entity_id, entity_label, rep, stage, score, letter_grade, details } = await readBody(req);
      if (!action) { res.writeHead(400); res.end('action required'); return; }
      await client.execute({
        sql: 'INSERT INTO audit_log (action, entity_id, entity_label, rep, stage, score, letter_grade, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          String(action),
          entity_id    ? String(entity_id)    : null,
          entity_label ? String(entity_label) : null,
          rep          ? String(rep)          : null,
          stage        ? String(stage)        : null,
          score        != null ? String(score) : null,
          letter_grade ? String(letter_grade) : null,
          details      ? JSON.stringify(details) : null,
          new Date().toISOString(),
        ],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/audit/backfill') {
    try {
      const prodRows = await client.execute('SELECT id, ts, call_date, prospect, rep, rep_role, stage, normalized_score, letter_grade, grade_label, top_priority FROM history_prod ORDER BY ts ASC');
      const allRows = prodRows.rows.slice();

      // Get entity_ids already in audit_log (action='grade') to avoid duplicates
      const existingRes = await client.execute("SELECT entity_id FROM audit_log WHERE action = 'grade'");
      const existingIds = new Set(existingRes.rows.map(r => String(r.entity_id)));

      const toInsert = allRows.filter(r => !existingIds.has(String(r.id)));
      if (!toInsert.length) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ inserted: 0, skipped: allRows.length }));
        return;
      }

      // Batch insert — libSQL batch limit: insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        await client.batch(chunk.map(r => ({
          sql: 'INSERT INTO audit_log (action, entity_id, entity_label, rep, stage, score, letter_grade, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            'grade',
            String(r.id),
            r.prospect  ? String(r.prospect)  : null,
            r.rep       ? String(r.rep)       : null,
            r.stage     ? String(r.stage)     : null,
            r.normalized_score != null ? String(r.normalized_score) : null,
            r.letter_grade ? String(r.letter_grade) : null,
            JSON.stringify({
              grade_label:  r.grade_label  ? String(r.grade_label)  : null,
              top_priority: r.top_priority ? String(r.top_priority) : null,
              rep_role:     r.rep_role     ? String(r.rep_role)     : null,
              backfilled:   true,
            }),
            r.ts ? String(r.ts) : new Date().toISOString(),
          ],
        })), 'write');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ inserted: toInsert.length, skipped: allRows.length - toInsert.length }));
    } catch (e) { res.writeHead(500); res.end(e.message); }
    return;
  }

  // ── Account Profiles API ──────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/account-profiles') {
    const rows = (await client.execute('SELECT company, profile FROM account_profiles')).rows;
    const out = {};
    rows.forEach(r => {
      try { out[String(r.company)] = JSON.parse(String(r.profile)); } catch {}
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }

  if (req.method === 'PUT' && req.url.startsWith('/api/account-profiles/')) {
    try {
      const company = decodeURIComponent(req.url.slice('/api/account-profiles/'.length));
      const body = await readBody(req);
      await client.execute({
        sql: 'INSERT OR REPLACE INTO account_profiles (company, profile, updated_at) VALUES (?, ?, ?)',
        args: [company, JSON.stringify(body), new Date().toISOString()],
      });
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

  if (req.method === 'GET' && req.url.startsWith('/transcript/')) {
    const id  = decodeURIComponent(req.url.slice('/transcript/'.length));
    const row = (await client.execute({ sql: 'SELECT * FROM transcripts WHERE id = ?', args: [id] })).rows[0];
    if (!row) { res.writeHead(404); res.end('Transcript not found'); return; }
    const label     = String(row.label || '');
    const prospect  = row.prospect ? String(row.prospect) : '';
    const stage     = row.stage    ? String(row.stage)    : '';
    const rep       = row.rep      ? String(row.rep)      : '';
    const callDate  = row.call_date ? String(row.call_date) : '';
    const text      = String(row.transcript);
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const meta = [prospect && `<b>Account:</b> ${esc(prospect)}`, stage && `<b>Stage:</b> ${esc(stage)}`, rep && `<b>Rep:</b> ${esc(rep)}`, callDate && `<b>Date:</b> ${esc(callDate)}`].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(label)}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#0d0f14;color:#d4d8e2;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.7;padding:2rem}
      h1{font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:.5rem}
      .meta{font-size:12px;color:#7a8499;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,.08)}
      pre{white-space:pre-wrap;word-break:break-word;color:#c9d1e0}
    </style></head><body>
    <h1>${esc(label)}</h1>
    <div class="meta">${meta}</div>
    <pre>${esc(text)}</pre>
    </body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
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

  const urlPath  = req.url.split('?')[0];
  const filePath = path.join(__dirname, 'public', urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext  = path.extname(filePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' }[ext] || 'text/plain';
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
