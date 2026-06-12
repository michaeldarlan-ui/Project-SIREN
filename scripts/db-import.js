// db-import.js — seed local siren.db from data/export.json
// Usage: npm run db:import

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath  = path.join(__dirname, '..', 'siren.db');
const inPath  = path.join(__dirname, '..', 'data', 'export.json');

if (!fs.existsSync(inPath)) {
  console.error('data/export.json not found. Run npm run db:export on the source machine first.');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ── Ensure schema exists (mirrors server.js) ──────────────────
const HISTORY_COLS = `
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, call_date TEXT, prospect TEXT,
  rep TEXT, rep_role TEXT, contact_title TEXT, stage TEXT,
  total INTEGER DEFAULT 0, letter_grade TEXT, grade_label TEXT,
  top_strength TEXT, top_priority TEXT, results_html TEXT,
  participants TEXT, dimensions TEXT, next_steps TEXT, overview TEXT,
  partner_scores TEXT, rep_scores TEXT
`;

db.exec(`
  CREATE TABLE IF NOT EXISTS history_prod (${HISTORY_COLS});
  CREATE TABLE IF NOT EXISTS history_demo (${HISTORY_COLS});
  CREATE TABLE IF NOT EXISTS prospects (name TEXT PRIMARY KEY, industry TEXT);
  CREATE TABLE IF NOT EXISTS third_parties (
    name TEXT PRIMARY KEY, role TEXT, organization TEXT, notes TEXT
  );
  CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, prospect TEXT, stage TEXT,
    rep TEXT, call_date TEXT, transcript TEXT NOT NULL, saved_at TEXT NOT NULL
  );
`);

// ── Import each table ─────────────────────────────────────────
const UPSERTS = {
  history_prod: db.prepare(`INSERT OR REPLACE INTO history_prod
    (id,ts,call_date,prospect,rep,rep_role,contact_title,stage,total,letter_grade,
     grade_label,top_strength,top_priority,results_html,participants,dimensions,
     next_steps,overview,partner_scores,rep_scores)
    VALUES (@id,@ts,@call_date,@prospect,@rep,@rep_role,@contact_title,@stage,@total,
     @letter_grade,@grade_label,@top_strength,@top_priority,@results_html,@participants,
     @dimensions,@next_steps,@overview,@partner_scores,@rep_scores)`),

  history_demo: db.prepare(`INSERT OR REPLACE INTO history_demo
    (id,ts,call_date,prospect,rep,rep_role,contact_title,stage,total,letter_grade,
     grade_label,top_strength,top_priority,results_html,participants,dimensions,
     next_steps,overview,partner_scores,rep_scores)
    VALUES (@id,@ts,@call_date,@prospect,@rep,@rep_role,@contact_title,@stage,@total,
     @letter_grade,@grade_label,@top_strength,@top_priority,@results_html,@participants,
     @dimensions,@next_steps,@overview,@partner_scores,@rep_scores)`),

  prospects: db.prepare(
    `INSERT OR REPLACE INTO prospects (name, industry) VALUES (@name, @industry)`
  ),

  third_parties: db.prepare(
    `INSERT OR REPLACE INTO third_parties (name, role, organization, notes)
     VALUES (@name, @role, @organization, @notes)`
  ),

  transcripts: db.prepare(
    `INSERT OR REPLACE INTO transcripts (id, label, prospect, stage, rep, call_date, transcript, saved_at)
     VALUES (@id, @label, @prospect, @stage, @rep, @call_date, @transcript, @saved_at)`
  ),
};

let totalRows = 0;

db.transaction(() => {
  for (const [tbl, rows] of Object.entries(payload)) {
    if (!rows || !rows.length) { console.log(`  ${tbl}: 0 rows (skipped)`); continue; }
    const stmt = UPSERTS[tbl];
    if (!stmt) { console.warn(`  ${tbl}: no upsert defined, skipping`); continue; }

    for (const row of rows) {
      // Serialize any objects back to JSON strings (rep_scores, dimensions, etc.)
      const flat = {};
      for (const [k, v] of Object.entries(row)) {
        flat[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
      }
      stmt.run(flat);
    }
    totalRows += rows.length;
    console.log(`  ${tbl}: ${rows.length} rows`);
  }
})();

console.log(`\nImported ${totalRows} rows into siren.db`);
console.log('Start the server normally: npm start');
