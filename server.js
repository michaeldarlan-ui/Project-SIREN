import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import nodemailer from 'nodemailer';

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
  { sql: `CREATE TABLE IF NOT EXISTS orgs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      grading_level INTEGER DEFAULT 3,
      created_at TEXT NOT NULL
    )` },
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
  { sql: `CREATE TABLE IF NOT EXISTS portal_tickets (
      id INTEGER PRIMARY KEY,
      org_id INTEGER NOT NULL DEFAULT 1,
      subject TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      category TEXT NOT NULL DEFAULT 'support',
      reporter_name TEXT,
      reporter_email TEXT,
      assigned_to TEXT,
      resolution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      org_id INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL DEFAULT 'user',
      sales_role TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS portal_feature_requests (
      id INTEGER PRIMARY KEY,
      org_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      priority TEXT NOT NULL DEFAULT 'normal',
      votes INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      submitted_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )` },
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
  { sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      assumed_role TEXT,
      assumed_user_id TEXT
    )` },
  { sql: `CREATE TABLE IF NOT EXISTS user_tab_permissions (
      user_id INTEGER NOT NULL,
      tab TEXT NOT NULL,
      PRIMARY KEY (user_id, tab)
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
    if (!cols.includes('org_id')) {
      await client.execute('ALTER TABLE history_prod ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
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
    // Add org_id to transcripts if missing
    const tCols2 = (await client.execute('PRAGMA table_info(transcripts)')).rows.map(r => String(r.name));
    if (!tCols2.includes('org_id')) {
      await client.execute('ALTER TABLE transcripts ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
    }
  }

  // Add org_id to roadmap if missing
  if (tables.includes('roadmap')) {
    const rCols = (await client.execute('PRAGMA table_info(roadmap)')).rows.map(r => String(r.name));
    if (!rCols.includes('org_id')) {
      await client.execute('ALTER TABLE roadmap ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
    }
  }

  // Add org_id to audit_log if missing
  if (tables.includes('audit_log')) {
    const aCols = (await client.execute('PRAGMA table_info(audit_log)')).rows.map(r => String(r.name));
    if (!aCols.includes('org_id')) {
      await client.execute('ALTER TABLE audit_log ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
    }
  }

  // Add org_id / assumed_role to sessions if missing
  if (tables.includes('sessions')) {
    const sCols = (await client.execute('PRAGMA table_info(sessions)')).rows.map(r => String(r.name));
    if (!sCols.includes('org_id'))       await client.execute('ALTER TABLE sessions ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
    if (!sCols.includes('assumed_role'))    await client.execute('ALTER TABLE sessions ADD COLUMN assumed_role TEXT');
    if (!sCols.includes('assumed_user_id')) await client.execute('ALTER TABLE sessions ADD COLUMN assumed_user_id TEXT');
  }

  // Add org_id / display_name / sales_role / email / last_login_at to users if missing
  if (tables.includes('users')) {
    const uCols = (await client.execute('PRAGMA table_info(users)')).rows.map(r => String(r.name));
    if (!uCols.includes('org_id'))         await client.execute('ALTER TABLE users ADD COLUMN org_id INTEGER NOT NULL DEFAULT 1');
    if (!uCols.includes('display_name'))   await client.execute('ALTER TABLE users ADD COLUMN display_name TEXT');
    if (!uCols.includes('sales_role'))     await client.execute('ALTER TABLE users ADD COLUMN sales_role TEXT');
    if (!uCols.includes('email'))          await client.execute('ALTER TABLE users ADD COLUMN email TEXT');
    if (!uCols.includes('last_login_at'))      await client.execute('ALTER TABLE users ADD COLUMN last_login_at TEXT');
    if (!uCols.includes('user_grading_level')) await client.execute('ALTER TABLE users ADD COLUMN user_grading_level INTEGER NOT NULL DEFAULT 1');
  }

  // Per-user spend tracking
  await client.execute(`CREATE TABLE IF NOT EXISTS user_spend (
    user_id TEXT PRIMARY KEY,
    cost REAL DEFAULT 0,
    calls INTEGER DEFAULT 0
  )`);

  // Migrate prospects to compound PK (org_id, name)
  if (tables.includes('prospects')) {
    const pCols = (await client.execute('PRAGMA table_info(prospects)')).rows.map(r => String(r.name));
    if (!pCols.includes('org_id')) {
      const old = (await client.execute('SELECT * FROM prospects')).rows;
      await client.execute('ALTER TABLE prospects RENAME TO prospects_old');
      await client.execute(`CREATE TABLE prospects (org_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, industry TEXT, PRIMARY KEY (org_id, name))`);
      if (old.length) {
        await client.batch(old.map(r => ({
          sql: `INSERT OR IGNORE INTO prospects (org_id, name, industry) VALUES (1, ?, ?)`,
          args: [String(r.name), r.industry ? String(r.industry) : null],
        })), 'write');
      }
      await client.execute('DROP TABLE prospects_old');
      console.log(`[db] Migrated prospects to compound PK (org_id, name)`);
    }
  }

  // Migrate third_parties to compound PK (org_id, name)
  if (tables.includes('third_parties')) {
    const tpCols = (await client.execute('PRAGMA table_info(third_parties)')).rows.map(r => String(r.name));
    if (!tpCols.includes('org_id')) {
      const old = (await client.execute('SELECT * FROM third_parties')).rows;
      await client.execute('ALTER TABLE third_parties RENAME TO third_parties_old');
      await client.execute(`CREATE TABLE third_parties (org_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, role TEXT, organization TEXT, notes TEXT, PRIMARY KEY (org_id, name))`);
      if (old.length) {
        await client.batch(old.map(r => ({
          sql: `INSERT OR IGNORE INTO third_parties (org_id, name, role, organization, notes) VALUES (1, ?, ?, ?, ?)`,
          args: [String(r.name), r.role ? String(r.role) : null, r.organization ? String(r.organization) : null, r.notes ? String(r.notes) : null],
        })), 'write');
      }
      await client.execute('DROP TABLE third_parties_old');
      console.log(`[db] Migrated third_parties to compound PK (org_id, name)`);
    }
  }

  // Migrate team to compound PK (org_id, name)
  if (tables.includes('team')) {
    const tmCols = (await client.execute('PRAGMA table_info(team)')).rows.map(r => String(r.name));
    if (!tmCols.includes('org_id')) {
      const old = (await client.execute('SELECT * FROM team')).rows;
      await client.execute('ALTER TABLE team RENAME TO team_old');
      await client.execute(`CREATE TABLE team (org_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, role TEXT, idx INTEGER DEFAULT 0, PRIMARY KEY (org_id, name))`);
      if (old.length) {
        await client.batch(old.map(r => ({
          sql: `INSERT OR IGNORE INTO team (org_id, name, role, idx) VALUES (1, ?, ?, ?)`,
          args: [String(r.name), r.role ? String(r.role) : null, Number(r.idx) || 0],
        })), 'write');
      }
      await client.execute('DROP TABLE team_old');
      console.log(`[db] Migrated team to compound PK (org_id, name)`);
    }
  }

  // Migrate account_profiles to compound PK (org_id, company)
  if (tables.includes('account_profiles')) {
    const apCols = (await client.execute('PRAGMA table_info(account_profiles)')).rows.map(r => String(r.name));
    if (!apCols.includes('org_id')) {
      const old = (await client.execute('SELECT * FROM account_profiles')).rows;
      await client.execute('ALTER TABLE account_profiles RENAME TO account_profiles_old');
      await client.execute(`CREATE TABLE account_profiles (org_id INTEGER NOT NULL DEFAULT 1, company TEXT NOT NULL, profile TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (org_id, company))`);
      if (old.length) {
        await client.batch(old.map(r => ({
          sql: `INSERT OR IGNORE INTO account_profiles (org_id, company, profile, updated_at) VALUES (1, ?, ?, ?)`,
          args: [String(r.company), String(r.profile), String(r.updated_at)],
        })), 'write');
      }
      await client.execute('DROP TABLE account_profiles_old');
      console.log(`[db] Migrated account_profiles to compound PK (org_id, company)`);
    }
  }

  // Add grading_level to orgs if missing
  if (tables.includes('orgs')) {
    const orgCols = (await client.execute('PRAGMA table_info(orgs)')).rows.map(r => String(r.name));
    if (!orgCols.includes('grading_level')) await client.execute('ALTER TABLE orgs ADD COLUMN grading_level INTEGER NOT NULL DEFAULT 3');
  }
}

// ── Auth helpers ──────────────────────────────────────────────
function hashPassword(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf.toString('hex')))
  );
}

// ── Email (invitation) ─────────────────────────────────────────
const _emailTransport = (() => {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT  || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
})();

async function sendInviteEmail(to, inviteUrl, orgName) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@siren.app';
  if (_emailTransport) {
    await _emailTransport.sendMail({
      from, to,
      subject: `You've been invited to SIREN — ${orgName}`,
      html: `<p>You have been invited to join <strong>${orgName}</strong> on SIREN.</p>
             <p><a href="${inviteUrl}" style="background:#f59e0b;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;">Accept invitation</a></p>
             <p style="color:#888;font-size:12px;">This link expires in 72 hours. If you didn't expect this email, you can ignore it.</p>`,
    });
    console.log(`[invite] Email sent to ${to}`);
  } else {
    console.log(`\n[invite] ⚠  No SMTP configured — send this link manually:\n  ${inviteUrl}\n`);
  }
}

async function createUser(username, password, role = 'user', mustChange = false, orgId = 1) {
  const id   = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPassword(password, salt);
  await client.execute({
    sql: `INSERT INTO users (id, username, password_hash, salt, role, must_change_password, org_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, username, hash, salt, role, mustChange ? 1 : 0, orgId, new Date().toISOString()],
  });
  return id;
}

async function verifyPassword(username, password) {
  // Allow login by username OR email
  const row = (await client.execute({ sql: 'SELECT * FROM users WHERE username = ? OR email = ?', args: [username, username] })).rows[0];
  if (!row) return null;
  const hash = await hashPassword(password, String(row.salt));
  if (hash !== String(row.password_hash)) return null;
  return { id: String(row.id), username: String(row.username), role: String(row.role), mustChangePassword: !!row.must_change_password, orgId: Number(row.org_id) || 1 };
}

async function createSession(userId, username, role, orgId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await client.execute({
    sql: `INSERT INTO sessions (token, user_id, username, role, org_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [token, userId, username, role, orgId || 1, expires],
  });
  return token;
}

async function getSession(token) {
  if (!token) return null;
  const row = (await client.execute({ sql: 'SELECT * FROM sessions WHERE token = ?', args: [token] })).rows[0];
  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await client.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    return null;
  }
  const realRole = String(row.role);
  const assumedRole = row.assumed_role ? String(row.assumed_role) : null;
  const assumedUserId = row.assumed_user_id ? String(row.assumed_user_id) : null;
  return { userId: String(row.user_id), username: String(row.username), role: assumedRole || realRole, realRole, assumedRole, assumedUserId, orgId: Number(row.org_id) || 1 };
}

function parseCookie(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k.trim(), decodeURIComponent(v.join('='))];
  }));
}

async function requireAuth(req, res) {
  const token = parseCookie(req.headers.cookie).siren_session;
  const session = await getSession(token);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return null;
  }
  return session;
}

// Seed default admin if no users exist
{
  const userCount = (await client.execute('SELECT COUNT(*) as n FROM users')).rows[0];
  if (Number(userCount.n) === 0) {
    await createUser('admin', 'siren-admin', 'admin', true, 1);
    console.log('  ✓  Default admin created: admin / siren-admin (change on first login)');
  }
}

// Seed default orgs
{
  const orgCount = (await client.execute('SELECT COUNT(*) as n FROM orgs')).rows[0];
  if (Number(orgCount.n) === 0) {
    const now = new Date().toISOString();
    await client.batch([
      { sql: `INSERT INTO orgs (id,name,slug,is_demo,created_at) VALUES (1,'Production','production',0,?)`, args: [now] },
      { sql: `INSERT INTO orgs (id,name,slug,is_demo,created_at) VALUES (2,'Demo','demo',1,?)`, args: [now] },
    ], 'write');
    // Assign existing users to org 1
    await client.execute('UPDATE users SET org_id = 1 WHERE org_id IS NULL OR org_id = 0');
    // Seed demo data
    await seedDemoOrg();
    console.log('  ✓  Orgs seeded: Production (1) and Demo (2)');
  }
}

// ── Demo org seeder ───────────────────────────────────────────
async function seedDemoOrg() {
  const ORG = 2;
  const now = new Date().toISOString();

  // Team
  await client.batch([
    { sql: `INSERT OR IGNORE INTO team (org_id,name,role,idx) VALUES (?,?,?,?)`, args: [ORG,'Alex Rivera','Account Executive',0] },
    { sql: `INSERT OR IGNORE INTO team (org_id,name,role,idx) VALUES (?,?,?,?)`, args: [ORG,'Jordan Lee','Sales Manager',1] },
    { sql: `INSERT OR IGNORE INTO team (org_id,name,role,idx) VALUES (?,?,?,?)`, args: [ORG,'Sam Patel','Account Executive',2] },
    { sql: `INSERT OR IGNORE INTO team (org_id,name,role,idx) VALUES (?,?,?,?)`, args: [ORG,'Taylor Kim','SDR',3] },
  ], 'write');

  // Prospects
  await client.batch([
    { sql: `INSERT OR IGNORE INTO prospects (org_id,name,industry) VALUES (?,?,?)`, args: [ORG,'Vertex Systems','Technology'] },
    { sql: `INSERT OR IGNORE INTO prospects (org_id,name,industry) VALUES (?,?,?)`, args: [ORG,'Meridian Health','Healthcare'] },
    { sql: `INSERT OR IGNORE INTO prospects (org_id,name,industry) VALUES (?,?,?)`, args: [ORG,'Crestview Capital','Finance'] },
    { sql: `INSERT OR IGNORE INTO prospects (org_id,name,industry) VALUES (?,?,?)`, args: [ORG,'Northgate Retail','Retail'] },
    { sql: `INSERT OR IGNORE INTO prospects (org_id,name,industry) VALUES (?,?,?)`, args: [ORG,'Apex Manufacturing','Manufacturing'] },
  ], 'write');

  // Sample calls — 10 realistic demo records
  const demoCalls = [
    { id:'demo-001', prospect:'Vertex Systems', rep:'Alex Rivera', stage:'Demo / solution presentation', score:88, grade:'A-', ts:'2026-06-10T14:30:00Z' },
    { id:'demo-002', prospect:'Meridian Health', rep:'Sam Patel', stage:'Discovery', score:72, grade:'B', ts:'2026-06-12T10:00:00Z' },
    { id:'demo-003', prospect:'Crestview Capital', rep:'Alex Rivera', stage:'Negotiation', score:91, grade:'A', ts:'2026-06-14T15:00:00Z' },
    { id:'demo-004', prospect:'Northgate Retail', rep:'Taylor Kim', stage:'Discovery', score:61, grade:'C+', ts:'2026-06-15T11:00:00Z' },
    { id:'demo-005', prospect:'Apex Manufacturing', rep:'Sam Patel', stage:'Demo / solution presentation', score:79, grade:'B+', ts:'2026-06-17T09:00:00Z' },
    { id:'demo-006', prospect:'Vertex Systems', rep:'Alex Rivera', stage:'Negotiation', score:94, grade:'A', ts:'2026-06-18T14:00:00Z' },
    { id:'demo-007', prospect:'Meridian Health', rep:'Sam Patel', stage:'Demo / solution presentation', score:83, grade:'B+', ts:'2026-06-20T10:30:00Z' },
    { id:'demo-008', prospect:'Crestview Capital', rep:'Taylor Kim', stage:'Proof of concept', score:77, grade:'B', ts:'2026-06-22T16:00:00Z' },
    { id:'demo-009', prospect:'Northgate Retail', rep:'Alex Rivera', stage:'Discovery', score:66, grade:'C+', ts:'2026-06-24T13:00:00Z' },
    { id:'demo-010', prospect:'Apex Manufacturing', rep:'Sam Patel', stage:'Negotiation', score:85, grade:'A-', ts:'2026-06-26T11:00:00Z' },
  ];

  const callStmts = demoCalls.map(c => ({
    sql: `INSERT OR IGNORE INTO history_prod (id,ts,call_date,prospect,rep,stage,total,normalized_score,letter_grade,grade_label,top_strength,top_priority,results_html,org_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [c.id, c.ts, c.ts.slice(0,10), c.prospect, c.rep, c.stage,
           c.score, c.score, c.grade,
           c.score >= 90 ? 'Excellent' : c.score >= 80 ? 'Strong' : c.score >= 70 ? 'Good' : 'Developing',
           'Active listening', 'Discovery depth',
           `<p>Demo call scoring for ${c.prospect}</p>`, ORG],
  }));
  if (callStmts.length) await client.batch(callStmts, 'write');
}

// ── Row helpers ───────────────────────────────────────────────
const DB_COLS = `id, ts, call_date, prospect, rep, rep_role, contact_title, stage,
  total, normalized_score, letter_grade, grade_label, top_strength, top_priority,
  results_html, participants, dimensions, next_steps, overview, partner_scores, rep_scores, spiced, org_id`;

const DB_PARAMS = `?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`;

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
    org_id:         Number(row.org_id) || 1,
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
    r.orgId || r.org_id || 1,
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

// ── Grading auto-promotion ────────────────────────────────────────────────────
// Levels 1→2→3 auto-promote; Level 4 is admin-manual only. No regression.
async function _checkGradingPromotion(userId, orgId) {
  try {
    const uRow = (await client.execute({ sql: 'SELECT user_grading_level, created_at, display_name FROM users WHERE id = ?', args: [userId] })).rows[0];
    if (!uRow) return 1;
    const currentLevel = Number(uRow.user_grading_level) || 1;
    if (currentLevel >= 3) return currentLevel; // Level 4 requires admin; cap auto at 3

    // Condition 1: 90 days since account creation
    const daysSinceJoined = (Date.now() - new Date(String(uRow.created_at)).getTime()) / 86400000;
    const tenureMet = daysSinceJoined >= 90;

    // Condition 2: last 10 calls all have normalized_score >= 90
    let streakMet = false;
    const repName = uRow.display_name ? String(uRow.display_name).trim() : null;
    if (repName) {
      const recent = (await client.execute({
        sql: 'SELECT normalized_score FROM history_prod WHERE org_id = ? AND rep = ? AND is_demo = 0 ORDER BY ts DESC LIMIT 10',
        args: [orgId, repName],
      })).rows;
      if (recent.length >= 10 && recent.every(r => Number(r.normalized_score) >= 90)) streakMet = true;
    }

    if (!tenureMet && !streakMet) return currentLevel;
    const newLevel = currentLevel + 1;
    await client.execute({ sql: 'UPDATE users SET user_grading_level = ? WHERE id = ?', args: [newLevel, userId] });
    return newLevel;
  } catch { return 1; }
}

async function meterApiCall(model, usage, feature, userId) {
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
    const batch = [
      { sql, args: ['global', cost] },
      { sql, args: [_usageMonthKey(), cost] },
      { sql: sqlDaily, args: [day, model || 'unknown', cost, inTok, outTok, cacheW, cacheR] },
      { sql: sqlFeature, args: [day, feat, cost, inTok, outTok] },
    ];
    if (userId) {
      batch.push({ sql: `INSERT INTO user_spend (user_id, cost, calls) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET cost = user_spend.cost + excluded.cost, calls = user_spend.calls + 1`, args: [userId, cost] });
    }
    await client.batch(batch, 'write');
  } catch (e) { console.error('[meter] write failed:', e.message); }
}

// Extract usage from a buffered Anthropic response (JSON or SSE stream)
function meterFromResponse(reqModel, raw, feature, userId) {
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
    if (usage) meterApiCall(model, usage, feature, userId);
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

  const urlPath0 = req.url.split('?')[0];

  // ── Auth endpoints (public — no session required) ──────────
  if (req.method === 'POST' && urlPath0 === '/api/auth/login') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { username, password } = JSON.parse(body);
        const user = await verifyPassword(username, password);
        if (!user) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid username or password' }));
          return;
        }
        const token = await createSession(user.id, user.username, user.role, user.orgId);
        await client.execute({ sql: 'UPDATE users SET last_login_at = ? WHERE id = ?', args: [new Date().toISOString(), user.id] });
        const cookie = `siren_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': cookie });
        res.end(JSON.stringify({ ok: true, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword, orgId: user.orgId }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  if (urlPath0 === '/login' || urlPath0 === '/login.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'login.html')));
    return;
  }

  // ── Registration (public — invite token required) ─────────────
  if (urlPath0 === '/register') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'register.html')));
    return;
  }

  // POST /api/register — complete registration from invite token
  if (req.method === 'POST' && urlPath0 === '/api/register') {
    try {
      const { token, displayName, password, salesRole } = await readBody(req);
      if (!token || !displayName || !password) { res.writeHead(400); res.end(JSON.stringify({ error: 'token, displayName, and password are required' })); return; }
      const inv = (await client.execute({ sql: 'SELECT * FROM invite_tokens WHERE token=? AND used=0', args: [token] })).rows[0];
      if (!inv) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid or expired invitation link.' })); return; }
      if (new Date(String(inv.expires_at)) < new Date()) { res.writeHead(400); res.end(JSON.stringify({ error: 'This invitation link has expired. Ask your admin to send a new one.' })); return; }
      // Use email as username (guarantees uniqueness)
      const email = String(inv.email);
      const existing = (await client.execute({ sql: 'SELECT id FROM users WHERE username=? OR email=?', args: [email, email] })).rows[0];
      if (existing) { res.writeHead(400); res.end(JSON.stringify({ error: 'An account with this email already exists.' })); return; }
      const id   = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await hashPassword(password, salt);
      const orgId = Number(inv.org_id) || 1;
      const role  = String(inv.role || 'user');
      const dn    = String(displayName).trim();
      const sr    = (salesRole || inv.sales_role || '').trim();
      await client.execute({ sql: 'INSERT INTO users (id,username,email,password_hash,salt,role,must_change_password,org_id,display_name,sales_role,created_at) VALUES (?,?,?,?,?,?,0,?,?,?,?)', args: [id, email, email, hash, salt, role, orgId, dn, sr||null, new Date().toISOString()] });
      // Sync team table
      const teamIdx = (await client.execute({ sql: 'SELECT COUNT(*) as n FROM team WHERE org_id=?', args: [orgId] })).rows[0].n;
      if (dn) await client.execute({ sql: 'INSERT OR REPLACE INTO team (org_id,name,role,idx) VALUES (?,?,?,?)', args: [orgId, dn, sr||'', Number(teamIdx)] });
      // Mark token used
      await client.execute({ sql: 'UPDATE invite_tokens SET used=1 WHERE token=?', args: [token] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      const msg = String(e.message||'').includes('UNIQUE') ? 'An account with this email already exists.' : e.message;
      res.writeHead(400); res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  // GET /api/invites — list pending invites for this org (admin only)
  if (req.method === 'GET' && urlPath0 === '/api/invites') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const rows = (await client.execute({ sql: 'SELECT token,email,role,sales_role,created_at,expires_at,used FROM invite_tokens WHERE org_id=? AND used=0 AND expires_at > ? ORDER BY created_at DESC', args: [_session.orgId, new Date().toISOString()] })).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({ token: String(r.token), email: String(r.email), role: String(r.role), salesRole: r.sales_role ? String(r.sales_role) : '', createdAt: String(r.created_at), expiresAt: String(r.expires_at) }))));
    return;
  }

  // GET /api/invite/check?token=xxx — validate invite token (public)
  if (req.method === 'GET' && urlPath0 === '/api/invite/check') {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    const inv = token ? (await client.execute({ sql: 'SELECT email,org_id,role,sales_role,expires_at,used FROM invite_tokens WHERE token=?', args: [token] })).rows[0] : null;
    if (!inv || inv.used) { res.writeHead(404); res.end(JSON.stringify({ error: 'Invalid or already used invitation link.' })); return; }
    if (new Date(String(inv.expires_at)) < new Date()) { res.writeHead(410); res.end(JSON.stringify({ error: 'Invitation expired.' })); return; }
    const orgRow = (await client.execute({ sql: 'SELECT name FROM orgs WHERE id=?', args: [inv.org_id] })).rows[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ email: String(inv.email), orgName: orgRow ? String(orgRow.name) : 'SIREN', role: String(inv.role), salesRole: inv.sales_role ? String(inv.sales_role) : '' }));
    return;
  }

  // GET /api/invite/:token/pdf — generate downloadable invitation PDF (admin only)
  if (req.method === 'GET' && /^\/api\/invite\/[^/]+\/pdf$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const token = urlPath0.split('/')[3];
    const inv   = token ? (await client.execute({ sql: 'SELECT * FROM invite_tokens WHERE token=?', args: [token] })).rows[0] : null;
    if (!inv) { res.writeHead(404); res.end('Invitation not found'); return; }
    const orgRow    = (await client.execute({ sql: 'SELECT name FROM orgs WHERE id=?', args: [inv.org_id] })).rows[0];
    const orgName   = orgRow ? String(orgRow.name) : 'SIREN';
    const proto     = process.env.APP_URL || `http://localhost:${PORT}`;
    const inviteUrl = `${proto}/register?token=${token}`;
    const expires   = new Date(String(inv.expires_at)).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #18181b; padding: 40px 20px; }
  .wrapper { max-width: 560px; margin: 0 auto; }
  .header { background: #09090b; border-radius: 10px 10px 0 0; padding: 32px 36px; text-align: center; }
  .logo { font-size: 28px; font-weight: 900; letter-spacing: .14em; color: #f59e0b; }
  .logo-sub { font-size: 11px; letter-spacing: .12em; color: rgba(255,255,255,.3); margin-top: 4px; text-transform: uppercase; }
  .body { background: #ffffff; padding: 36px 36px 28px; }
  .greeting { font-size: 22px; font-weight: 700; color: #18181b; margin-bottom: 14px; }
  p { font-size: 15px; line-height: 1.65; color: #3f3f46; margin-bottom: 16px; }
  .btn-wrap { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #f59e0b; color: #09090b; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; letter-spacing: .02em; }
  .url-box { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 7px; padding: 12px 14px; word-break: break-all; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; color: #52525b; margin-bottom: 20px; }
  .url-label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 6px; }
  .meta { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
  .meta-item { flex: 1; min-width: 120px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 7px; padding: 12px 14px; }
  .meta-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 4px; }
  .meta-value { font-size: 14px; font-weight: 600; color: #18181b; }
  .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
  .note { font-size: 12px; color: #a1a1aa; line-height: 1.6; }
  .footer { background: #f4f4f5; border-radius: 0 0 10px 10px; padding: 18px 36px; text-align: center; border-top: 1px solid #e4e4e7; }
  .footer-text { font-size: 11px; color: #a1a1aa; }
  @media print {
    body { background: #fff; padding: 0; }
    .wrapper { max-width: 100%; }
  }
</style></head><body>
<div class="wrapper">
  <div class="header">
    <div class="logo">SIREN</div>
    <div class="logo-sub">Sales Intelligence, Review &amp; Enablement Network</div>
  </div>
  <div class="body">
    <div class="greeting">You're invited to join SIREN</div>
    <p>You've been invited to join <strong>${orgName}</strong> on SIREN — the sales intelligence and call coaching platform used by your team.</p>
    <p>Click the button below to accept your invitation and create your account. You'll set your display name, sales role, and password to complete setup.</p>
    <div class="btn-wrap">
      <a class="btn" href="${inviteUrl}">Accept Invitation &rarr;</a>
    </div>
    <div class="url-label">Or copy this link into your browser</div>
    <div class="url-box">${inviteUrl}</div>
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Organization</div>
        <div class="meta-value">${orgName}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Sent to</div>
        <div class="meta-value" style="font-size:13px;">${String(inv.email)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Link expires</div>
        <div class="meta-value" style="font-size:12px;color:#f59e0b;">${expires}</div>
      </div>
    </div>
    <hr class="divider">
    <p class="note">If you were not expecting this invitation, you can safely ignore this message — no account will be created until you click the link above.<br><br>Need help? Reply to this email or contact your organization administrator.</p>
  </div>
  <div class="footer">
    <div class="footer-text">SIREN &middot; Sales Intelligence &amp; Coaching Platform &middot; This invitation was sent by an administrator of ${orgName}.</div>
  </div>
</div>
</body></html>`;

    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
      const page    = await browser.newPage({ viewport: { width: 640, height: 900 } });
      await page.setContent(emailHtml, { waitUntil: 'domcontentloaded' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
      await browser.close();
      res.writeHead(200, {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="siren-invite-${String(inv.email).replace(/[^a-z0-9]/gi,'-')}.pdf"`,
        'Content-Length':      pdf.length,
      });
      res.end(pdf);
    } catch (e) {
      console.error('[invite-pdf]', e.message);
      // Fallback: serve the HTML directly so it can be printed to PDF from the browser
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="siren-invite-${String(inv.email).replace(/[^a-z0-9]/gi,'-')}.html"` });
      res.end(emailHtml);
    }
    return;
  }

  // ── SIREN Portal (superadmin only) ────────────────────────────
  if (urlPath0 === '/portal' || urlPath0 === '/portal.html') {
    const tok = parseCookie(req.headers.cookie).siren_session;
    const sess = await getSession(tok);
    if (!sess || sess.role !== 'superadmin') {
      res.writeHead(302, { Location: '/login' }); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'portal.html')));
    return;
  }

  // Public pages — accessible without a session
  const PUBLIC_PATHS = ['/landing.html', '/landing'];
  if (PUBLIC_PATHS.includes(urlPath0)) {
    const filePath = path.join(__dirname, 'public', 'landing.html');
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(filePath));
    return;
  }

  // ── Auth middleware (all other routes require session) ─────
  const _sessionToken = parseCookie(req.headers.cookie).siren_session;
  const _session = await getSession(_sessionToken);

  // Redirect unauthenticated browser requests to login
  if (!_session) {
    const isApi = urlPath0.startsWith('/api/');
    if (isApi) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    } else {
      res.writeHead(302, { Location: '/login' });
      res.end();
    }
    return;
  }

  // ── Auth endpoints (session required) ─────────────────────
  if (req.method === 'POST' && urlPath0 === '/api/auth/logout') {
    await client.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [_sessionToken] });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'siren_session=; Path=/; HttpOnly; Max-Age=0' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && urlPath0 === '/api/auth/me') {
    const orgRow = (await client.execute({ sql: 'SELECT name, is_demo, grading_level FROM orgs WHERE id = ?', args: [_session.orgId] })).rows[0];
    const selfRow = (await client.execute({ sql: 'SELECT display_name FROM users WHERE id = ?', args: [_session.userId] })).rows[0];
    const selfDisplayName = selfRow ? (String(selfRow.display_name || '')).trim() : '';
    let assumedUserDisplay = null;
    if (_session.assumedUserId) {
      const auRow = (await client.execute({ sql: 'SELECT display_name, username FROM users WHERE id = ?', args: [_session.assumedUserId] })).rows[0];
      assumedUserDisplay = auRow ? (String(auRow.display_name || auRow.username || '')) : null;
    }
    // Tab permissions: for non-admins (or assumed user), load allowed tabs
    let allowedTabs = null;
    const tabUserId = _session.assumedUserId || (_session.realRole === 'user' ? _session.userId : null);
    if (tabUserId) {
      const tabRows = (await client.execute({ sql: 'SELECT tab FROM user_tab_permissions WHERE user_id = ?', args: [tabUserId] })).rows;
      if (tabRows.length > 0) allowedTabs = tabRows.map(r => String(r.tab));
    }
    // Personal grading level: auto-promote non-admins; admins use org level
    let userGradingLevel = orgRow ? Number(orgRow.grading_level) || 3 : 3;
    if (_session.assumedUserId) {
      // Admin viewing as a user — show that user's personal level
      const auLvlRow = (await client.execute({ sql: 'SELECT user_grading_level FROM users WHERE id = ?', args: [_session.assumedUserId] })).rows[0];
      userGradingLevel = auLvlRow ? Number(auLvlRow.user_grading_level) || 1 : 1;
    } else if (_session.realRole === 'user') {
      userGradingLevel = await _checkGradingPromotion(_session.userId, _session.orgId);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      username: _session.username,
      displayName: selfDisplayName || _session.username,
      role: _session.role,
      realRole: _session.realRole,
      assumedRole: _session.assumedRole || null,
      assumedUserId: _session.assumedUserId || null,
      assumedUserDisplay,
      allowedTabs,
      orgId: _session.orgId,
      orgName: orgRow ? String(orgRow.name) : 'Production',
      isDemo: orgRow ? !!orgRow.is_demo : false,
      gradingLevel: orgRow ? Number(orgRow.grading_level) || 3 : 3,
      userGradingLevel,
    }));
    return;
  }

  // GET /api/settings/grading — returns { level }
  if (req.method === 'GET' && urlPath0 === '/api/settings/grading') {
    const orgRow = (await client.execute({ sql: 'SELECT grading_level FROM orgs WHERE id = ?', args: [_session.orgId] })).rows[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ level: Number(orgRow?.grading_level) || 3 }));
    return;
  }

  // PUT /api/settings/grading — admin sets { level: 1|2|3|4 }
  if (req.method === 'PUT' && urlPath0 === '/api/settings/grading') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const { level } = await readBody(req);
    const lvl = Math.max(1, Math.min(4, Number(level) || 3));
    await client.execute({ sql: 'UPDATE orgs SET grading_level = ? WHERE id = ?', args: [lvl, _session.orgId] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, level: lvl }));
    return;
  }

  // POST /api/auth/assume-role — admin temporarily views app as a specific user
  if (req.method === 'POST' && urlPath0 === '/api/auth/assume-role') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const { userId } = await readBody(req);
    if (!userId) { res.writeHead(400); res.end(JSON.stringify({ error: 'userId required' })); return; }
    const uRow = (await client.execute({ sql: 'SELECT id, role, display_name, username, org_id FROM users WHERE id = ? AND org_id = ?', args: [userId, _session.orgId] })).rows[0];
    if (!uRow) { res.writeHead(404); res.end(JSON.stringify({ error: 'User not found' })); return; }
    if (String(uRow.role) === 'admin' || String(uRow.role) === 'superadmin') { res.writeHead(400); res.end(JSON.stringify({ error: 'Cannot assume admin role' })); return; }
    await client.execute({ sql: 'UPDATE sessions SET assumed_role=?, assumed_user_id=? WHERE token=?', args: [String(uRow.role), String(uRow.id), _sessionToken] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, assumedRole: String(uRow.role), assumedUserId: String(uRow.id) }));
    return;
  }

  // POST /api/auth/exit-assume-role — return to real admin role
  if (req.method === 'POST' && urlPath0 === '/api/auth/exit-assume-role') {
    await client.execute({ sql: 'UPDATE sessions SET assumed_role=NULL, assumed_user_id=NULL WHERE token=?', args: [_sessionToken] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && urlPath0 === '/api/auth/change-password') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { currentPassword, newPassword } = JSON.parse(body);
        const user = await verifyPassword(_session.username, currentPassword);
        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Current password is incorrect' }));
          return;
        }
        if (!newPassword || newPassword.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'New password must be at least 8 characters' }));
          return;
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPassword(newPassword, salt);
        await client.execute({ sql: 'UPDATE users SET password_hash=?, salt=?, must_change_password=0 WHERE username=?', args: [hash, salt, _session.username] });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // ── Org management (admin only) ────────────────────────────
  if (req.method === 'GET' && urlPath0 === '/api/orgs') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end(); return; }
    const rows = (await client.execute('SELECT id, name, slug, is_demo, created_at FROM orgs ORDER BY id')).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), isDemo: !!r.is_demo, createdAt: String(r.created_at) }))));
    return;
  }

  if (req.method === 'POST' && urlPath0 === '/api/orgs') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end(); return; }
    try {
      const { name, isDemo } = await readBody(req);
      if (!name) { res.writeHead(400); res.end(JSON.stringify({ error: 'name required' })); return; }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const result = await client.execute({
        sql: `INSERT INTO orgs (name, slug, is_demo, created_at) VALUES (?, ?, ?, ?)`,
        args: [String(name), slug, isDemo ? 1 : 0, new Date().toISOString()],
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id: Number(result.lastInsertRowid) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && /^\/api\/orgs\/\d+\/reset-demo$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end(); return; }
    const orgId = parseInt(urlPath0.split('/')[3]);
    const orgRow = (await client.execute({ sql: 'SELECT is_demo FROM orgs WHERE id = ?', args: [orgId] })).rows[0];
    if (!orgRow || !orgRow.is_demo) { res.writeHead(400); res.end(JSON.stringify({ error: 'Not a demo org' })); return; }
    try {
      await client.batch([
        { sql: 'DELETE FROM history_prod WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM prospects WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM team WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM transcripts WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM roadmap WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM audit_log WHERE org_id = ?', args: [orgId] },
        { sql: 'DELETE FROM account_profiles WHERE org_id = ?', args: [orgId] },
      ], 'write');
      await seedDemoOrg();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── Admin: orphan cleanup ───────────────────────────────────
  if (req.method === 'POST' && urlPath0 === '/api/admin/cleanup-orphans') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end(); return; }
    try {
      const tables = ['call_spiced', 'call_reps', 'call_partners', 'call_dimensions',
                      'call_rep_summary', 'call_next_steps'];
      let total = 0;
      for (const t of tables) {
        const r = await client.execute(`DELETE FROM ${t} WHERE call_id NOT IN (SELECT id FROM history_prod)`);
        total += Number(r.rowsAffected) || 0;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, deleted: total }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // GET /api/admin/migrate-prospect-org?prospect=AVN+HLTH — preview matching records
  if (req.method === 'GET' && urlPath0 === '/api/admin/migrate-prospect-org') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const q = (new URL(req.url, 'http://x').searchParams.get('prospect') || '').trim().toLowerCase();
    if (!q) { res.writeHead(400); res.end(JSON.stringify({ error: 'prospect query required' })); return; }
    const like = `%${q}%`;
    const hRows = (await client.execute({ sql: 'SELECT DISTINCT prospect, org_id FROM history_prod WHERE LOWER(prospect) LIKE ? LIMIT 20', args: [like] })).rows;
    const tRows = (await client.execute({ sql: 'SELECT DISTINCT prospect, org_id FROM transcripts WHERE LOWER(prospect) LIKE ? LIMIT 20', args: [like] })).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history: hRows.map(r=>({prospect:String(r.prospect||''),orgId:Number(r.org_id)})), transcripts: tRows.map(r=>({prospect:String(r.prospect||''),orgId:Number(r.org_id)})) }));
    return;
  }

  // POST /api/admin/migrate-prospect-org — move all records matching a prospect pattern to a target org
  if (req.method === 'POST' && urlPath0 === '/api/admin/migrate-prospect-org') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const { prospect, targetOrgName, targetOrgId } = await readBody(req);
      if (!prospect) { res.writeHead(400); res.end(JSON.stringify({ error: 'prospect pattern required' })); return; }
      // Resolve target org
      let orgId = targetOrgId ? Number(targetOrgId) : null;
      if (!orgId && targetOrgName) {
        const orgRow = (await client.execute({ sql: 'SELECT id FROM orgs WHERE LOWER(name)=?', args: [String(targetOrgName).toLowerCase()] })).rows[0];
        if (!orgRow) {
          const slug = String(targetOrgName).toLowerCase().replace(/[^a-z0-9]/g, '-');
          const r = await client.execute({ sql: 'INSERT INTO orgs (name, slug, is_demo, created_at) VALUES (?, ?, 0, ?) RETURNING id', args: [targetOrgName, slug, new Date().toISOString()] });
          orgId = Number(r.rows[0].id);
        } else {
          orgId = Number(orgRow.id);
        }
      }
      if (!orgId) { res.writeHead(400); res.end(JSON.stringify({ error: 'targetOrgName or targetOrgId required' })); return; }
      const like = `%${prospect.toLowerCase()}%`;
      // Move history_prod
      const h = await client.execute({ sql: `UPDATE history_prod SET org_id=? WHERE LOWER(prospect) LIKE ?`, args: [orgId, like] });
      // Move transcripts
      const t = await client.execute({ sql: `UPDATE transcripts SET org_id=? WHERE LOWER(prospect) LIKE ?`, args: [orgId, like] });
      // Move account_profiles (compound PK — delete+insert)
      const profiles = (await client.execute({ sql: `SELECT company, profile, updated_at FROM account_profiles WHERE LOWER(company) LIKE ?`, args: [like] })).rows;
      for (const p of profiles) {
        await client.execute({ sql: 'INSERT OR REPLACE INTO account_profiles (org_id, company, profile, updated_at) VALUES (?,?,?,?)', args: [orgId, p.company, p.profile, p.updated_at] });
        await client.execute({ sql: 'DELETE FROM account_profiles WHERE org_id != ? AND company = ?', args: [orgId, p.company] });
      }
      // Move prospects (compound PK)
      const prospects = (await client.execute({ sql: `SELECT org_id, name, industry FROM prospects WHERE LOWER(name) LIKE ?`, args: [like] })).rows;
      for (const p of prospects) {
        if (Number(p.org_id) === orgId) continue;
        await client.execute({ sql: 'INSERT OR REPLACE INTO prospects (org_id, name, industry) VALUES (?,?,?)', args: [orgId, p.name, p.industry] });
        await client.execute({ sql: 'DELETE FROM prospects WHERE org_id=? AND name=?', args: [p.org_id, p.name] });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, orgId, historyCalls: Number(h.rowsAffected)||0, transcripts: Number(t.rowsAffected)||0, profiles: profiles.length, prospects: prospects.length }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── User management (admin only) ───────────────────────────
  if (req.method === 'GET' && urlPath0 === '/api/users') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const rows = (await client.execute('SELECT u.id, u.username, u.role, u.org_id, u.must_change_password, u.created_at, u.display_name, u.sales_role, u.last_login_at, u.user_grading_level, o.name as org_name, s.cost as spend_cost, s.calls as spend_calls FROM users u LEFT JOIN orgs o ON o.id = u.org_id LEFT JOIN user_spend s ON s.user_id = u.id WHERE u.org_id = ? ORDER BY u.display_name ASC, u.username ASC', [_session.orgId])).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({ id: String(r.id), username: String(r.username), role: String(r.role), orgId: Number(r.org_id)||1, orgName: r.org_name ? String(r.org_name) : 'Production', mustChangePassword: !!r.must_change_password, createdAt: String(r.created_at), displayName: r.display_name ? String(r.display_name) : '', salesRole: r.sales_role ? String(r.sales_role) : '', lastLoginAt: r.last_login_at ? String(r.last_login_at) : null, totalSpend: r.spend_cost != null ? Number(r.spend_cost) : 0, totalCalls: r.spend_calls != null ? Number(r.spend_calls) : 0, userGradingLevel: r.user_grading_level != null ? Number(r.user_grading_level) : 1 }))));
    return;
  }

  // GET /api/users/:id/tabs — admin fetches tab permissions for a user
  if (req.method === 'GET' && /^\/api\/users\/[^/]+\/tabs$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const uid = urlPath0.split('/')[3];
    const rows = (await client.execute({ sql: 'SELECT tab FROM user_tab_permissions WHERE user_id = ?', args: [uid] })).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tabs: rows.length > 0 ? rows.map(r => String(r.tab)) : null }));
    return;
  }

  // PUT /api/users/:id/tabs — admin sets tab permissions for a user
  if (req.method === 'PUT' && /^\/api\/users\/[^/]+\/tabs$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const uid = urlPath0.split('/')[3];
    const { tabs } = await readBody(req);
    await client.execute({ sql: 'DELETE FROM user_tab_permissions WHERE user_id = ?', args: [uid] });
    if (Array.isArray(tabs) && tabs.length > 0) {
      for (const tab of tabs) {
        await client.execute({ sql: 'INSERT OR IGNORE INTO user_tab_permissions (user_id, tab) VALUES (?,?)', args: [uid, String(tab)] });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // PUT /api/users/:id/grading-level — admin manually sets user grading level (1-4)
  if (req.method === 'PUT' && /^\/api\/users\/[^/]+\/grading-level$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const uid = urlPath0.split('/')[3];
    const { level } = await readBody(req);
    const lvl = Math.max(1, Math.min(4, Number(level) || 1));
    await client.execute({ sql: 'UPDATE users SET user_grading_level = ? WHERE id = ? AND org_id = ?', args: [lvl, uid, _session.orgId] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, level: lvl }));
    return;
  }

  // POST /api/invite — admin sends invitation email to a new user
  if (req.method === 'POST' && urlPath0 === '/api/invite') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const { email, role, salesRole, orgId } = await readBody(req);
      if (!email || !String(email).includes('@')) { res.writeHead(400); res.end(JSON.stringify({ error: 'Valid email required' })); return; }
      const targetOrg = Number(orgId) || _session.orgId;
      const token     = crypto.randomBytes(32).toString('hex');
      const expires   = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      // Delete any prior unused invite for same email+org
      await client.execute({ sql: 'DELETE FROM invite_tokens WHERE email=? AND org_id=? AND used=0', args: [email, targetOrg] });
      await client.execute({ sql: 'INSERT INTO invite_tokens (token,email,org_id,role,sales_role,created_at,expires_at,used) VALUES (?,?,?,?,?,?,?,0)', args: [token, email, targetOrg, role||'user', salesRole||null, new Date().toISOString(), expires] });
      const proto     = process.env.APP_URL || `http://localhost:${PORT}`;
      const inviteUrl = `${proto}/register?token=${token}`;
      const orgRow    = (await client.execute({ sql: 'SELECT name FROM orgs WHERE id=?', args: [targetOrg] })).rows[0];
      await sendInviteEmail(email, inviteUrl, orgRow ? String(orgRow.name) : 'SIREN');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, invited: true, inviteUrl }));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'POST' && urlPath0 === '/api/users') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { username, password, role, orgId, displayName, salesRole } = JSON.parse(body);
        if (!username || !password) { res.writeHead(400); res.end(JSON.stringify({ error: 'username and password required' })); return; }
        const targetOrg = orgId || _session.orgId;
        const id = await createUser(username, password, role || 'user', false, targetOrg);
        const dn = (displayName || '').trim();
        const sr = (salesRole || '').trim();
        if (dn) {
          await client.execute({ sql: 'UPDATE users SET display_name=?, sales_role=? WHERE id=?', args: [dn, sr || null, id] });
          // Sync to team table so grading picks up the new member immediately
          const teamIdx = (await client.execute({ sql: 'SELECT COUNT(*) as n FROM team WHERE org_id=?', args: [targetOrg] })).rows[0].n;
          await client.execute({ sql: 'INSERT OR REPLACE INTO team (org_id, name, role, idx) VALUES (?,?,?,?)', args: [targetOrg, dn, sr || '', Number(teamIdx)] });
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id }));
      } catch (e) {
        const msg = String(e.message || '').includes('UNIQUE') ? 'Username already exists' : 'Error creating user';
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
    });
    return;
  }

  if (req.method === 'POST' && /^\/api\/users\/[^/]+\/reset-password$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const userId = urlPath0.split('/')[3];
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { password } = JSON.parse(body);
        if (!password) { res.writeHead(400); res.end(JSON.stringify({ error: 'password required' })); return; }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPassword(password, salt);
        await client.execute({ sql: 'UPDATE users SET password_hash=?, salt=?, must_change_password=1 WHERE id=?', args: [hash, salt, userId] });
        await client.execute({ sql: 'DELETE FROM sessions WHERE user_id=?', args: [userId] });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Bad request' })); }
    });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/users\/[^/]+\/org$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const userId = urlPath0.split('/')[3];
    try {
      const { orgId } = await readBody(req);
      if (!orgId) { res.writeHead(400); res.end(JSON.stringify({ error: 'orgId required' })); return; }
      const orgRow = (await client.execute({ sql: 'SELECT id FROM orgs WHERE id=?', args: [Number(orgId)] })).rows[0];
      if (!orgRow) { res.writeHead(400); res.end(JSON.stringify({ error: 'Org not found' })); return; }
      await client.execute({ sql: 'UPDATE users SET org_id=? WHERE id=?', args: [Number(orgId), userId] });
      // Invalidate existing sessions so they pick up the new org on next login
      await client.execute({ sql: 'DELETE FROM sessions WHERE user_id=?', args: [userId] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/users\/[^/]+\/profile$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const userId = urlPath0.split('/')[3];
    try {
      const { displayName, salesRole } = await readBody(req);
      const dn = (displayName || '').trim();
      const sr = (salesRole || '').trim();
      const userRow = (await client.execute({ sql: 'SELECT display_name, org_id FROM users WHERE id=?', args: [userId] })).rows[0];
      if (!userRow) { res.writeHead(404); res.end(); return; }
      const oldDn = userRow.display_name ? String(userRow.display_name) : '';
      const orgId = Number(userRow.org_id) || 1;
      await client.execute({ sql: 'UPDATE users SET display_name=?, sales_role=? WHERE id=?', args: [dn || null, sr || null, userId] });
      // Remove old team entry if display_name changed
      if (oldDn && oldDn !== dn) {
        await client.execute({ sql: 'DELETE FROM team WHERE org_id=? AND name=?', args: [orgId, oldDn] });
      }
      if (dn) {
        await client.execute({ sql: 'INSERT OR REPLACE INTO team (org_id, name, role, idx) VALUES (?,?,?,(SELECT COALESCE(MAX(idx)+1,0) FROM team WHERE org_id=?))', args: [orgId, dn, sr || '', orgId] });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'DELETE' && /^\/api\/users\/[^/]+$/.test(urlPath0)) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const userId = urlPath0.split('/')[3];
    const targetRow = (await client.execute({ sql: 'SELECT id, display_name, org_id FROM users WHERE id=?', args: [userId] })).rows[0];
    if (!targetRow) { res.writeHead(404); res.end(); return; }
    if (String(targetRow.id) === _session.userId) { res.writeHead(400); res.end(JSON.stringify({ error: 'Cannot delete yourself' })); return; }
    const dn = targetRow.display_name ? String(targetRow.display_name) : '';
    const orgId = Number(targetRow.org_id) || 1;
    await client.execute({ sql: 'DELETE FROM sessions WHERE user_id=?', args: [userId] });
    await client.execute({ sql: 'DELETE FROM users WHERE id=?', args: [userId] });
    if (dn) await client.execute({ sql: 'DELETE FROM team WHERE org_id=? AND name=?', args: [orgId, dn] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

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
            meterFromResponse(reqModel, respBuf, reqFeature, _session?.userId);
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
    // Non-admins (and admins assuming a user) only see that user's calls
    let histSql = 'SELECT * FROM history_prod WHERE org_id = ? ORDER BY ts DESC';
    let histArgs = [_session.orgId];
    const filterUserId = _session.assumedUserId || (_session.role === 'user' ? _session.userId : null);
    if (filterUserId) {
      const userRow = (await client.execute({ sql: 'SELECT display_name FROM users WHERE id = ?', args: [filterUserId] })).rows[0];
      const displayName = userRow?.display_name ? String(userRow.display_name) : null;
      if (displayName) {
        histSql = 'SELECT * FROM history_prod WHERE org_id = ? AND rep = ? ORDER BY ts DESC';
        histArgs = [_session.orgId, displayName];
      } else {
        histSql = 'SELECT * FROM history_prod WHERE org_id = ? AND 0=1 ORDER BY ts DESC';
        histArgs = [_session.orgId];
      }
    }
    const [histRows, repRows, dimRows, summaryRows, stepRows, spicedRows, partnerRows] = await Promise.all([
      client.execute({ sql: histSql, args: histArgs }),
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
      const arr = Array.isArray(records) ? records : [];
      arr.forEach(r => { r.org_id = _session.orgId; });
      await bulkUpsert(arr);
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history/migrate
  if (req.method === 'POST' && req.url === '/api/history/migrate') {
    try {
      const records = await readBody(req);
      const arr = Array.isArray(records) ? records : [];
      arr.forEach(r => { r.org_id = _session.orgId; });
      await bulkUpsert(arr);
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history/rename
  if (req.method === 'POST' && req.url === '/api/history/rename') {
    try {
      const { oldName, newName } = await readBody(req);
      await client.batch([
        { sql: 'UPDATE history_prod SET prospect = ? WHERE prospect = ? AND org_id = ?', args: [newName, oldName, _session.orgId] },
        { sql: 'UPDATE prospects SET name = ? WHERE name = ? AND org_id = ?',            args: [newName, oldName, _session.orgId] },
      ], 'write');
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // POST /api/history (single upsert)
  if (req.method === 'POST' && req.url === '/api/history') {
    try {
      const record = await readBody(req);
      record.org_id = _session.orgId;
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
        const setClause = `SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`;
        const args = [...vals, id, _session.orgId];
        const r1 = await client.execute({ sql: `UPDATE history_prod ${setClause}`, args });
        if (!r1.rowsAffected) console.warn(`[PUT] id not found: ${id}`);
      }
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // DELETE /api/history/real
  if (req.method === 'DELETE' && req.url === '/api/history/real') {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    await client.execute({ sql: 'DELETE FROM history_prod WHERE org_id = ?', args: [_session.orgId] });
    res.writeHead(200); res.end();
    return;
  }

  // DELETE /api/history/:id
  if (req.method === 'DELETE' && req.url.startsWith('/api/history/')) {
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const id = decodeURIComponent(req.url.slice('/api/history/'.length));
    await client.execute({ sql: 'DELETE FROM history_prod WHERE id = ? AND org_id = ?', args: [id, _session.orgId] });
    res.writeHead(200); res.end();
    return;
  }

  // ── Prospects API ──────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/prospects') {
    const rows = (await client.execute({ sql: 'SELECT * FROM prospects WHERE org_id = ? ORDER BY name ASC', args: [_session.orgId] })).rows;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows.map(r => ({ name: String(r.name), industry: r.industry ? String(r.industry) : null }))));
    return;
  }

  if (req.method === 'PUT' && req.url.startsWith('/api/prospects/')) {
    try {
      const name   = decodeURIComponent(req.url.slice('/api/prospects/'.length));
      const fields = await readBody(req);
      await client.execute({
        sql:  'INSERT INTO prospects (org_id, name, industry) VALUES (?, ?, ?) ON CONFLICT(org_id, name) DO UPDATE SET industry = excluded.industry',
        args: [_session.orgId, name, fields.industry || null],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Third-parties API ──────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/third-parties') {
    const rows = (await client.execute({ sql: 'SELECT * FROM third_parties WHERE org_id = ? ORDER BY name ASC', args: [_session.orgId] })).rows;
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
        sql:  `INSERT INTO third_parties (org_id, name, role, organization, notes) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(org_id, name) DO UPDATE SET role=excluded.role, organization=excluded.organization, notes=excluded.notes`,
        args: [_session.orgId, name, fields.role || null, fields.organization || null, fields.notes || null],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/third-parties/')) {
    const name = decodeURIComponent(req.url.slice('/api/third-parties/'.length));
    await client.execute({ sql: 'DELETE FROM third_parties WHERE name = ? AND org_id = ?', args: [name, _session.orgId] });
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
    // Users with a display_name are the canonical team members
    const userRows = (await client.execute({ sql: 'SELECT display_name as name, sales_role as role FROM users WHERE org_id=? AND display_name IS NOT NULL AND display_name != \'\' ORDER BY display_name ASC', args: [_session.orgId] })).rows;
    const userNames = new Set(userRows.map(r => String(r.name).toLowerCase()));
    // Also include legacy team table entries not already covered by a user
    const teamRows = (await client.execute({ sql: 'SELECT name, role FROM team WHERE org_id=? ORDER BY idx ASC, name ASC', args: [_session.orgId] })).rows;
    const legacyRows = teamRows.filter(r => !userNames.has(String(r.name).toLowerCase()));
    const all = [...userRows, ...legacyRows].map(r => ({ name: String(r.name), role: r.role ? String(r.role) : '' }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(all));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/team') {
    try {
      const members = await readBody(req);
      if (!Array.isArray(members)) { res.writeHead(400); res.end('Expected array'); return; }
      const ops = [{ sql: 'DELETE FROM team WHERE org_id = ?', args: [_session.orgId] }];
      members.forEach((m, i) => {
        if (!m.name) return;
        ops.push({
          sql:  'INSERT OR REPLACE INTO team (org_id, name, role, idx) VALUES (?, ?, ?, ?)',
          args: [_session.orgId, String(m.name), m.role ? String(m.role) : '', i],
        });
      });
      await client.batch(ops, 'write');
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Roadmap API ────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/roadmap') {
    const rows = (await client.execute({ sql: 'SELECT id, title, description, status, created_at FROM roadmap WHERE org_id = ? ORDER BY id DESC', args: [_session.orgId] })).rows;
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
        sql: 'INSERT INTO roadmap (org_id, title, description, status, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [_session.orgId, String(title), desc ? String(desc) : '', status || 'planned', now],
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
      if (status)  await client.execute({ sql: 'UPDATE roadmap SET status = ? WHERE id = ? AND org_id = ?',      args: [String(status), id, _session.orgId] });
      if (title)   await client.execute({ sql: 'UPDATE roadmap SET title = ? WHERE id = ? AND org_id = ?',       args: [String(title), id, _session.orgId] });
      if (desc !== undefined) await client.execute({ sql: 'UPDATE roadmap SET description = ? WHERE id = ? AND org_id = ?', args: [String(desc), id, _session.orgId] });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/roadmap/')) {
    try {
      const id = parseInt(req.url.slice('/api/roadmap/'.length));
      await client.execute({ sql: 'DELETE FROM roadmap WHERE id = ? AND org_id = ?', args: [id, _session.orgId] });
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
      ? 'SELECT * FROM audit_log WHERE org_id = ? AND action = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM audit_log WHERE org_id = ? ORDER BY created_at DESC LIMIT ?';
    const args   = action ? [_session.orgId, action, limit] : [_session.orgId, limit];
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
        sql: 'INSERT INTO audit_log (org_id, action, entity_id, entity_label, rep, stage, score, letter_grade, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          _session.orgId,
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
      const prodRows = await client.execute({ sql: 'SELECT id, ts, call_date, prospect, rep, rep_role, stage, normalized_score, letter_grade, grade_label, top_priority FROM history_prod WHERE org_id = ? ORDER BY ts ASC', args: [_session.orgId] });
      const allRows = prodRows.rows.slice();

      // Get entity_ids already in audit_log (action='grade') to avoid duplicates
      const existingRes = await client.execute({ sql: "SELECT entity_id FROM audit_log WHERE action = 'grade' AND org_id = ?", args: [_session.orgId] });
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
          sql: 'INSERT INTO audit_log (org_id, action, entity_id, entity_label, rep, stage, score, letter_grade, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            _session.orgId,
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
    const rows = (await client.execute({ sql: 'SELECT company, profile FROM account_profiles WHERE org_id = ?', args: [_session.orgId] })).rows;
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
        sql: 'INSERT OR REPLACE INTO account_profiles (org_id, company, profile, updated_at) VALUES (?, ?, ?, ?)',
        args: [_session.orgId, company, JSON.stringify(body), new Date().toISOString()],
      });
      res.writeHead(200); res.end();
    } catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  // ── Transcripts API ────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/transcripts') {
    let tSql = 'SELECT id,label,prospect,stage,rep,call_date,saved_at FROM transcripts WHERE org_id = ? ORDER BY saved_at DESC';
    let tArgs = [_session.orgId];
    const tFilterUserId = _session.assumedUserId || (_session.role === 'user' ? _session.userId : null);
    if (tFilterUserId) {
      const uRow = (await client.execute({ sql: 'SELECT display_name FROM users WHERE id = ?', args: [tFilterUserId] })).rows[0];
      const dn = uRow?.display_name ? String(uRow.display_name) : null;
      if (dn) { tSql = 'SELECT id,label,prospect,stage,rep,call_date,saved_at FROM transcripts WHERE org_id = ? AND rep = ? ORDER BY saved_at DESC'; tArgs = [_session.orgId, dn]; }
      else     { tSql = 'SELECT id,label,prospect,stage,rep,call_date,saved_at FROM transcripts WHERE org_id = ? AND 0=1 ORDER BY saved_at DESC'; }
    }
    const rows = (await client.execute({ sql: tSql, args: tArgs })).rows;
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
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const { id, label, prospect, stage, rep, call_date, transcript } = await readBody(req);
      await client.execute({
        sql:  `INSERT OR REPLACE INTO transcripts (id,label,prospect,stage,rep,call_date,transcript,saved_at,org_id) VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [String(id), label || prospect || 'Untitled', prospect||null, stage||null,
               rep||null, call_date||null, transcript, new Date().toISOString(), _session.orgId],
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
    const row = (await client.execute({ sql: 'SELECT * FROM transcripts WHERE id = ? AND org_id = ?', args: [id, _session.orgId] })).rows[0];
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
    if (_session.realRole !== 'admin' && _session.realRole !== 'superadmin') { res.writeHead(403); res.end('Forbidden'); return; }
    const id = decodeURIComponent(req.url.slice('/api/transcripts/'.length));
    await client.execute({ sql: 'DELETE FROM transcripts WHERE id = ? AND org_id = ?', args: [id, _session.orgId] });
    res.writeHead(200); res.end();
    return;
  }

  // ── SIREN Portal API (superadmin only) ────────────────────────
  if (urlPath0.startsWith('/api/portal')) {
    if (_session.realRole !== 'superadmin') { res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return; }

    // GET /api/portal/stats — dashboard summary
    if (req.method === 'GET' && urlPath0 === '/api/portal/stats') {
      const [orgsR, usersR, callsR, ticketsR, featsR] = await Promise.all([
        client.execute('SELECT COUNT(*) as n FROM orgs'),
        client.execute('SELECT COUNT(*) as n FROM users'),
        client.execute('SELECT COUNT(*) as n FROM history_prod'),
        client.execute('SELECT COUNT(*) as n FROM portal_tickets'),
        client.execute('SELECT COUNT(*) as n FROM portal_feature_requests'),
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        orgs:     Number(orgsR.rows[0].n),
        users:    Number(usersR.rows[0].n),
        calls:    Number(callsR.rows[0].n),
        tickets:  Number(ticketsR.rows[0].n),
        features: Number(featsR.rows[0].n),
      }));
      return;
    }

    // GET /api/portal/orgs — all orgs with user counts
    if (req.method === 'GET' && urlPath0 === '/api/portal/orgs') {
      const rows = (await client.execute(`
        SELECT o.id, o.name, o.slug, o.is_demo, o.created_at,
               COUNT(u.id) as user_count,
               COUNT(DISTINCT h.id) as call_count
        FROM orgs o
        LEFT JOIN users u ON u.org_id = o.id
        LEFT JOIN history_prod h ON h.org_id = o.id
        GROUP BY o.id ORDER BY o.created_at DESC`)).rows;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map(r => ({
        id: Number(r.id), name: String(r.name), slug: String(r.slug),
        isDemo: !!r.is_demo, createdAt: String(r.created_at),
        userCount: Number(r.user_count), callCount: Number(r.call_count),
      }))));
      return;
    }

    // GET /api/portal/users — all users across all orgs
    if (req.method === 'GET' && urlPath0 === '/api/portal/users') {
      const rows = (await client.execute(`
        SELECT u.id, u.username, u.email, u.display_name, u.role, u.org_id, u.created_at,
               o.name as org_name
        FROM users u LEFT JOIN orgs o ON o.id = u.org_id
        ORDER BY u.created_at DESC LIMIT 500`)).rows;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map(r => ({
        id: String(r.id), username: String(r.username),
        email: r.email ? String(r.email) : '',
        displayName: r.display_name ? String(r.display_name) : '',
        role: String(r.role), orgId: Number(r.org_id),
        orgName: r.org_name ? String(r.org_name) : '', createdAt: String(r.created_at),
      }))));
      return;
    }

    // GET /api/portal/tickets
    if (req.method === 'GET' && urlPath0 === '/api/portal/tickets') {
      const rows = (await client.execute(`
        SELECT t.*, o.name as org_name FROM portal_tickets t
        LEFT JOIN orgs o ON o.id = t.org_id
        ORDER BY t.created_at DESC LIMIT 200`)).rows;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map(r => ({
        id: Number(r.id), orgId: Number(r.org_id), orgName: r.org_name ? String(r.org_name) : '',
        subject: String(r.subject), description: r.description ? String(r.description) : '',
        status: String(r.status), priority: String(r.priority), category: String(r.category),
        reporterName: r.reporter_name ? String(r.reporter_name) : '',
        assignedTo: r.assigned_to ? String(r.assigned_to) : '',
        createdAt: String(r.created_at), updatedAt: String(r.updated_at),
      }))));
      return;
    }

    // GET /api/portal/features
    if (req.method === 'GET' && urlPath0 === '/api/portal/features') {
      const rows = (await client.execute(`
        SELECT f.*, o.name as org_name FROM portal_feature_requests f
        LEFT JOIN orgs o ON o.id = f.org_id
        ORDER BY f.votes DESC, f.created_at DESC LIMIT 200`)).rows;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map(r => ({
        id: Number(r.id), orgId: Number(r.org_id), orgName: r.org_name ? String(r.org_name) : '',
        title: String(r.title), description: r.description ? String(r.description) : '',
        status: String(r.status), priority: String(r.priority), votes: Number(r.votes),
        tags: r.tags ? String(r.tags) : '', submittedBy: r.submitted_by ? String(r.submitted_by) : '',
        createdAt: String(r.created_at),
      }))));
      return;
    }

    // POST /api/portal/orgs — create a new org
    if (req.method === 'POST' && urlPath0 === '/api/portal/orgs') {
      const { name, isDemo } = await readBody(req);
      if (!name) { res.writeHead(400); res.end(JSON.stringify({ error: 'name required' })); return; }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      try {
        await client.execute({ sql: 'INSERT INTO orgs (name, slug, is_demo, created_at) VALUES (?,?,?,?)', args: [name, slug, isDemo ? 1 : 0, new Date().toISOString()] });
        res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
      return;
    }

    // PATCH /api/portal/tickets/:id — update ticket status/assignment
    if (req.method === 'PATCH' && /^\/api\/portal\/tickets\/\d+$/.test(urlPath0)) {
      const id = urlPath0.split('/').pop();
      const fields = await readBody(req);
      const allowed = ['status','priority','assigned_to','resolution'];
      const sets = Object.keys(fields).filter(k => allowed.includes(k)).map(k => `${k}=?`);
      if (!sets.length) { res.writeHead(400); res.end(JSON.stringify({ error: 'No valid fields' })); return; }
      const vals = Object.keys(fields).filter(k => allowed.includes(k)).map(k => fields[k]);
      await client.execute({ sql: `UPDATE portal_tickets SET ${sets.join(',')}, updated_at=? WHERE id=?`, args: [...vals, new Date().toISOString(), Number(id)] });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
      return;
    }

    // PATCH /api/portal/features/:id — update feature status/notes
    if (req.method === 'PATCH' && /^\/api\/portal\/features\/\d+$/.test(urlPath0)) {
      const id = urlPath0.split('/').pop();
      const fields = await readBody(req);
      const allowed = ['status','priority','notes','votes'];
      const sets = Object.keys(fields).filter(k => allowed.includes(k)).map(k => `${k}=?`);
      if (!sets.length) { res.writeHead(400); res.end(JSON.stringify({ error: 'No valid fields' })); return; }
      const vals = Object.keys(fields).filter(k => allowed.includes(k)).map(k => fields[k]);
      await client.execute({ sql: `UPDATE portal_feature_requests SET ${sets.join(',')}, updated_at=? WHERE id=?`, args: [...vals, new Date().toISOString(), Number(id)] });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404); res.end();
    return;
  }

  // ── Static files ───────────────────────────────────────────
  if (urlPath0 === '/' || urlPath0 === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    return;
  }

  const filePath = path.join(__dirname, 'public', urlPath0);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  OneAxiom SIREN running at http://localhost:${PORT}\n`);
  if (!API_KEY) console.warn('  ⚠  ANTHROPIC_API_KEY not set — API calls will fail.\n');
});
