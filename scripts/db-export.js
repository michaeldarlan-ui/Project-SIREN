// db-export.js — dump all SIREN tables to data/export.json
// Usage: npm run db:export

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath   = path.join(__dirname, '..', 'siren.db');
const outPath  = path.join(__dirname, '..', 'data', 'export.json');

if (!fs.existsSync(dbPath)) {
  console.error('siren.db not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const TABLES = ['history_prod', 'history_demo', 'prospects', 'third_parties', 'transcripts'];

const exported = {};
let totalRows = 0;

for (const tbl of TABLES) {
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
  ).get(tbl);
  if (!exists) { exported[tbl] = []; continue; }

  const rows = db.prepare(`SELECT * FROM ${tbl}`).all();
  exported[tbl] = rows;
  totalRows += rows.length;
  console.log(`  ${tbl}: ${rows.length} rows`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf8');

const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`\nExported ${totalRows} rows → data/export.json (${kb} KB)`);
console.log('Transfer this file to your other machine, then run: npm run db:import');
