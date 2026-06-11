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
