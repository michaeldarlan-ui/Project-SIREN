// db-import.js — seed local siren.db from data/export.json
// Usage: npm run db:import

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'siren.db');
const inPath = path.join(__dirname, '..', 'data', 'export.json');

if (!fs.existsSync(inPath)) {
  console.error('data/export.json not found. Run npm run db:export on the source machine first.');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const client  = createClient({ url: 'file:' + dbPath });

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
], 'write');

let totalRows = 0;

for (const [tbl, rows] of Object.entries(payload)) {
  if (!rows?.length) { console.log(`  ${tbl}: 0 rows (skipped)`); continue; }

  const cols   = Object.keys(rows[0]).filter(k => isNaN(k));
  const params = cols.map(() => '?').join(', ');

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await client.batch(chunk.map(row => ({
      sql:  `INSERT OR REPLACE INTO ${tbl} (${cols.join(', ')}) VALUES (${params})`,
      args: cols.map(c => {
        const v = row[c];
        // Re-serialize any objects that were stored as JSON strings
        return (v !== null && typeof v === 'object') ? JSON.stringify(v) : (v ?? null);
      }),
    })), 'write');
  }

  totalRows += rows.length;
  console.log(`  ${tbl}: ${rows.length} rows`);
}

console.log(`\nImported ${totalRows} rows into siren.db`);
console.log('Start the server normally: npm start');
