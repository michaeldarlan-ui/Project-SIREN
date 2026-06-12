// db-export.js — dump all SIREN tables to data/export.json
// Usage: npm run db:export

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath  = path.join(__dirname, '..', 'siren.db');
const outPath = path.join(__dirname, '..', 'data', 'export.json');

if (!fs.existsSync(dbPath)) {
  console.error('siren.db not found at', dbPath);
  process.exit(1);
}

const client = createClient({ url: 'file:' + dbPath });
const TABLES = ['history_prod', 'history_demo', 'prospects', 'third_parties', 'transcripts', 'team', 'usage'];

const exported = {};
let totalRows = 0;

for (const tbl of TABLES) {
  const exists = (await client.execute(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${tbl}'`
  )).rows.length > 0;
  if (!exists) { exported[tbl] = []; continue; }

  const rows = (await client.execute(`SELECT * FROM ${tbl}`)).rows;
  // Convert Row objects to plain objects
  exported[tbl] = rows.map(r => Object.fromEntries(
    Object.entries(r).filter(([k]) => isNaN(k))
  ));
  totalRows += rows.length;
  console.log(`  ${tbl}: ${rows.length} rows`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf8');

const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`\nExported ${totalRows} rows → data/export.json (${kb} KB)`);
console.log('Transfer this file to your other machine, then run: npm run db:import');
