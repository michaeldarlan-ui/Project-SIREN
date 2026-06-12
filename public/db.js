// ── History DB cache ───────────────────────────────────────────
// All history reads are synchronous (from _histCache).
// All writes are async (fire-and-forget to /api/history).
// On page load, init.js awaits _loadHistFromDB() before rendering.

let _histCache = [];

async function _loadHistFromDB() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('status ' + res.status);
    _histCache = await res.json();
  } catch (e) {
    console.warn('[db] Failed to load from DB, falling back to localStorage:', e.message);
    try { _histCache = JSON.parse(localStorage.getItem('oa_history') || '[]'); } catch {}
  }
}

async function _dbSaveRecord(record) {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch (e) { console.error('[db] save failed:', e.message); }
}

async function _dbBulkSave(records) {
  try {
    await fetch('/api/history/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records),
    });
  } catch (e) { console.error('[db] bulk save failed:', e.message); }
}

async function _dbPatchRecord(id, patch) {
  try {
    await fetch('/api/history/' + encodeURIComponent(String(id)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch (e) { console.error('[db] patch failed:', e.message); }
}

async function _dbDeleteRecord(id) {
  try {
    await fetch('/api/history/' + encodeURIComponent(String(id)), { method: 'DELETE' });
  } catch (e) { console.error('[db] delete failed:', e.message); }
}

async function _dbClearDemo() {
  try {
    await fetch('/api/history/demo', { method: 'DELETE' });
  } catch (e) { console.error('[db] clear demo failed:', e.message); }
}

async function _dbClearReal() {
  try {
    await fetch('/api/history/real', { method: 'DELETE' });
  } catch (e) { console.error('[db] clear real failed:', e.message); }
}

async function _dbRenameProspect(oldName, newName) {
  try {
    await fetch('/api/history/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
  } catch (e) { console.error('[db] rename failed:', e.message); }
}

// ── Prospects DB cache ──────────────────────────────────────────
// Keyed by prospect name: { name, industry }

let _prospectsCache = {};

async function _loadProspectsFromDB() {
  try {
    const res = await fetch('/api/prospects');
    if (!res.ok) throw new Error('status ' + res.status);
    const rows = await res.json();
    _prospectsCache = {};
    rows.forEach(r => { _prospectsCache[r.name] = r; });
  } catch (e) { console.warn('[db] Failed to load prospects:', e.message); }
}

async function _dbSaveProspect(name, fields) {
  _prospectsCache[name] = { ...(_prospectsCache[name] || {}), name, ...fields };
  try {
    await fetch('/api/prospects/' + encodeURIComponent(name), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  } catch (e) { console.error('[db] save prospect failed:', e.message); }
}

function _getProspectIndustry(name) {
  return (_prospectsCache[name] || {}).industry || '';
}

// ── Third-parties DB cache ──────────────────────────────────────
// Keyed by lowercase name: { name, role, organization, notes }

let _thirdPartiesCache = {};

async function _loadThirdPartiesFromDB() {
  try {
    const res = await fetch('/api/third-parties');
    if (!res.ok) throw new Error('status ' + res.status);
    const rows = await res.json();
    _thirdPartiesCache = {};
    rows.forEach(r => { _thirdPartiesCache[r.name.toLowerCase()] = r; });
  } catch (e) { console.warn('[db] Failed to load third-parties:', e.message); }
}

async function _dbSaveThirdParty(name, fields) {
  _thirdPartiesCache[name.toLowerCase()] = { ...(_thirdPartiesCache[name.toLowerCase()] || {}), name, ...fields };
  try {
    await fetch('/api/third-parties/' + encodeURIComponent(name), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  } catch (e) { console.error('[db] save third-party failed:', e.message); }
}

function _getKnownThirdParty(name) {
  const key = (name || '').toLowerCase().trim();
  if (!key) return null;
  if (_thirdPartiesCache[key]) return _thirdPartiesCache[key];
  // Fuzzy: handle partial names ("Leslie" matching "Leslie Hicks")
  for (const stored of Object.values(_thirdPartiesCache)) {
    const sk = stored.name.toLowerCase().trim();
    if (sk && (key.includes(sk) || sk.includes(key))) return stored;
  }
  return null;
}

// ── Team DB cache ─────────────────────────────────────────────
// Ordered array of { name, role } objects.
// loadTeam() / saveTeam() are sync (read/write _teamCache);
// writes also fire-and-forget to /api/team.

let _teamCache = [];

async function _loadTeamFromDB() {
  try {
    const res = await fetch('/api/team');
    if (!res.ok) throw new Error('status ' + res.status);
    _teamCache = await res.json();
    // Keep localStorage in sync for fallback
    try { localStorage.setItem('oa_team', JSON.stringify(_teamCache)); } catch {}
  } catch (e) {
    console.warn('[db] Failed to load team, falling back to localStorage:', e.message);
    try { _teamCache = JSON.parse(localStorage.getItem('oa_team') || '[]'); } catch {}
  }
}

async function _dbSaveTeam(members) {
  try {
    await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(members),
    });
  } catch (e) { console.error('[db] save team failed:', e.message); }
}
