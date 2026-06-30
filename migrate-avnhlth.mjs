/**
 * Migration: Move all AVN HLTH related records to the OneAxiom org.
 * Run: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node migrate-avnhlth.mjs
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL || 'file:siren.db',
  authToken: process.env.TURSO_AUTH_TOKEN   || undefined,
});

const PROSPECT_PATTERN = '%AVN%HLTH%';
const ORG_NAME         = 'OneAxiom';

async function run() {
  // 1. Find or create the OneAxiom org
  let orgRow = (await client.execute({ sql: `SELECT id FROM orgs WHERE name = ?`, args: [ORG_NAME] })).rows[0];
  let orgId;
  if (orgRow) {
    orgId = Number(orgRow.id);
    console.log(`✓ Found org "${ORG_NAME}" (id=${orgId})`);
  } else {
    const slug = ORG_NAME.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const now  = new Date().toISOString();
    const r = await client.execute({ sql: `INSERT INTO orgs (name, slug, is_demo, created_at) VALUES (?, ?, 0, ?) RETURNING id`, args: [ORG_NAME, slug, now] });
    orgId = Number(r.rows[0].id);
    console.log(`✓ Created org "${ORG_NAME}" (id=${orgId})`);
  }

  // 2. Find AVN HLTH call IDs in history_prod (org 1 / any org)
  const calls = (await client.execute({ sql: `SELECT id, org_id, prospect FROM history_prod WHERE prospect LIKE ? ORDER BY call_date DESC`, args: [PROSPECT_PATTERN] })).rows;
  console.log(`Found ${calls.length} history_prod row(s) matching AVN HLTH:`);
  calls.forEach(c => console.log(`  call_id=${c.id}  org_id=${c.org_id}  prospect=${c.prospect}`));

  if (calls.length === 0) {
    // Also try without wildcards
    const calls2 = (await client.execute({ sql: `SELECT id, org_id, prospect FROM history_prod WHERE LOWER(prospect) LIKE ? ORDER BY call_date DESC`, args: ['%avn%'] })).rows;
    console.log(`Broader search ('*avn*') found ${calls2.length} rows:`);
    calls2.forEach(c => console.log(`  call_id=${c.id}  org_id=${c.org_id}  prospect=${c.prospect}`));
  }

  // 3. Move history_prod rows
  const res = await client.execute({ sql: `UPDATE history_prod SET org_id = ? WHERE LOWER(prospect) LIKE '%avn%hlth%' OR LOWER(prospect) LIKE '%avnhlth%' OR LOWER(prospect) LIKE '%avn hlth%'`, args: [orgId] });
  console.log(`✓ Updated history_prod: ${res.rowsAffected} row(s) → org ${orgId}`);

  // 4. Move transcripts
  const res2 = await client.execute({ sql: `UPDATE transcripts SET org_id = ? WHERE LOWER(prospect) LIKE '%avn%hlth%' OR LOWER(prospect) LIKE '%avnhlth%' OR LOWER(prospect) LIKE '%avn hlth%'`, args: [orgId] });
  console.log(`✓ Updated transcripts: ${res2.rowsAffected} row(s) → org ${orgId}`);

  // 5. Move account_profiles (compound PK requires delete+insert)
  const profiles = (await client.execute({ sql: `SELECT company, profile, updated_at FROM account_profiles WHERE LOWER(company) LIKE '%avn%hlth%' OR LOWER(company) LIKE '%avnhlth%' OR LOWER(company) LIKE '%avn hlth%'` })).rows;
  for (const p of profiles) {
    await client.execute({ sql: `INSERT OR REPLACE INTO account_profiles (org_id, company, profile, updated_at) VALUES (?, ?, ?, ?)`, args: [orgId, p.company, p.profile, p.updated_at] });
    // Remove old entry from org 1 if it exists there
    await client.execute({ sql: `DELETE FROM account_profiles WHERE org_id != ? AND company = ?`, args: [orgId, p.company] });
    console.log(`✓ Moved account_profile: ${p.company} → org ${orgId}`);
  }

  // 6. Move prospects (compound PK)
  const prospects = (await client.execute({ sql: `SELECT org_id, name, industry FROM prospects WHERE LOWER(name) LIKE '%avn%hlth%' OR LOWER(name) LIKE '%avnhlth%' OR LOWER(name) LIKE '%avn hlth%'` })).rows;
  for (const p of prospects) {
    if (Number(p.org_id) === orgId) { console.log(`  (prospect ${p.name} already in org ${orgId})`); continue; }
    await client.execute({ sql: `INSERT OR REPLACE INTO prospects (org_id, name, industry) VALUES (?, ?, ?)`, args: [orgId, p.name, p.industry] });
    await client.execute({ sql: `DELETE FROM prospects WHERE org_id = ? AND name = ?`, args: [p.org_id, p.name] });
    console.log(`✓ Moved prospect: ${p.name} → org ${orgId}`);
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
