// db-turso-push.js — migrate local siren.db → Turso cloud
// Usage: npm run db:push
//
// Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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

const remoteUrl   = process.env.TURSO_DATABASE_URL;
const remoteToken = process.env.TURSO_AUTH_TOKEN;

if (!remoteUrl || remoteUrl.startsWith('file:')) {
  console.error('TURSO_DATABASE_URL must be set to a Turso libsql:// URL in .env');
  process.exit(1);
}

const localPath = path.join(__dirname, '..', 'siren.db');
if (!fs.existsSync(localPath)) {
  console.error('siren.db not found. Run the server at least once to create it, or use npm run db:import first.');
  process.exit(1);
}

const local  = createClient({ url: 'file:' + localPath });
const remote = createClient({ url: remoteUrl, authToken: remoteToken });

const HISTORY_COLS = `
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, call_date TEXT, prospect TEXT,
  rep TEXT, rep_role TEXT, contact_title TEXT, stage TEXT,
  total INTEGER DEFAULT 0, letter_grade TEXT, grade_label TEXT,
  top_strength TEXT, top_priority TEXT, results_html TEXT,
  participants TEXT, dimensions TEXT, next_steps TEXT, overview TEXT,
  partner_scores TEXT, rep_scores TEXT
`;

// Ensure schema exists on remote
await remote.batch([
  { sql: `CREATE TABLE IF NOT EXISTS history_prod (${HISTORY_COLS})` },
  { sql: `CREATE TABLE IF NOT EXISTS history_demo (${HISTORY_COLS})` },
  { sql: `CREATE TABLE IF NOT EXISTS prospects (name TEXT PRIMARY KEY, industry TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS third_parties (name TEXT PRIMARY KEY, role TEXT, organization TEXT, notes TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS transcripts (id TEXT PRIMARY KEY, label TEXT NOT NULL, prospect TEXT, stage TEXT, rep TEXT, call_date TEXT, transcript TEXT NOT NULL, saved_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS team (name TEXT PRIMARY KEY, role TEXT, idx INTEGER DEFAULT 0)` },
  { sql: `CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, cost REAL DEFAULT 0, calls INTEGER DEFAULT 0)` },
], 'write');

const TABLES = ['history_prod', 'history_demo', 'prospects', 'third_parties', 'transcripts', 'team', 'usage'];
let totalPushed = 0;

for (const tbl of TABLES) {
  const exists = (await local.execute(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${tbl}'`
  )).rows.length > 0;

  if (!exists) { console.log(`  ${tbl}: not found locally, skipping`); continue; }

  const rows = (await local.execute(`SELECT * FROM ${tbl}`)).rows;
  if (!rows.length) { console.log(`  ${tbl}: 0 rows`); continue; }

  // Build insert for this table using its actual columns
  const cols     = Object.keys(rows[0]).filter(k => isNaN(k));
  const colList  = cols.join(', ');
  const params   = cols.map(() => '?').join(', ');

  // Push in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await remote.batch(chunk.map(row => ({
      sql:  `INSERT OR REPLACE INTO ${tbl} (${colList}) VALUES (${params})`,
      args: cols.map(c => row[c] ?? null),
    })), 'write');
  }

  totalPushed += rows.length;
  console.log(`  ${tbl}: ${rows.length} rows pushed`);
}

console.log(`\nPushed ${totalPushed} rows → ${remoteUrl}`);
console.log('Both machines can now point at this database via TURSO_DATABASE_URL in .env');
