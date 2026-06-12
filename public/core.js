  let selectedStage = 'Demo / solution presentation';
  let currentPage = 'pulse';

  // ── Navigation ─────────────────────────────────────────────
  function navTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => {
      if ((page === 'grader'    && t.textContent === 'ENGAGE') ||
          (page === 'pulse'     && t.textContent === 'PULSE') ||
          (page === 'lifecycle' && t.textContent === 'ATLAS') ||
          (page === 'scope'     && t.textContent === 'SCOPE') ||
          (page === 'forge'     && t.textContent === 'FORGE') ||
          (page === 'vigil'       && t.textContent === 'VIGIL') ||
          (page === 'coach'       && t.textContent === 'COACH')) {
        t.classList.add('active');
      }
    });
    currentPage = page;
    window.scrollTo(0, 0);
    if (page === 'grader')    typeof renderSavedTranscripts === 'function' && renderSavedTranscripts();
    if (page === 'pulse')     renderPulse();
    if (page === 'history')   renderHistory();
    if (page === 'lifecycle') renderLifecyclePage();
    if (page === 'scope')     renderScopePage();
    if (page === 'forge')     forgeInit();
    if (page === 'vigil')       pulseRenderFeed();
    if (page === 'coach')       coachInit();
  }

  // ── Demo mode ──────────────────────────────────────────────
  function isDemoEnabled() {
    return localStorage.getItem('oa_demo_enabled') === 'true';
  }
  function setDemoEnabled(val) {
    localStorage.setItem('oa_demo_enabled', val ? 'true' : 'false');
    _updateDemoIndicator();
    navTo(currentPage);
  }
  function _updateDemoIndicator() {
    const ind = document.getElementById('demoToggleIndicator');
    if (!ind) return;
    const on = isDemoEnabled();
    ind.textContent = on ? 'ON' : 'OFF';
    ind.style.background = on ? '#1a3a1a' : '#3a1a1a';
    ind.style.color = on ? '#4caf50' : '#e05050';
  }

  // ── Settings menu ──────────────────────────────────────────
  function toggleSettingsMenu(e) {
    e.stopPropagation();
    _updateDemoIndicator();
    document.getElementById('settingsDropdown').classList.toggle('open');
  }
  function closeSettingsMenu() {
    document.getElementById('settingsDropdown').classList.remove('open');
  }
  document.addEventListener('click', () => closeSettingsMenu());

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Dev Sync modal ────────────────────────────────────────────
  function openDevSyncModal() {
    const m = document.getElementById('devSyncModal');
    if (m) { m.style.display = 'flex'; }
  }
  function closeDevSyncModal() {
    const m = document.getElementById('devSyncModal');
    if (m) { m.style.display = 'none'; }
  }
  window.openDevSyncModal  = openDevSyncModal;
  window.closeDevSyncModal = closeDevSyncModal;

  // ── Cost & Usage modal ────────────────────────────────────────
  window.openCostUsageModal = function() {
    const m = document.getElementById('costUsageModal');
    if (m) m.style.display = 'flex';
  };
  window.closeCostUsageModal = function() {
    const m = document.getElementById('costUsageModal');
    if (m) m.style.display = 'none';
  };

  // ── Team manager ───────────────────────────────────────────
  function loadTeam() {
    return _teamCache.slice();
  }
  function saveTeam(t) {
    _teamCache = Array.isArray(t) ? t : [];
    try { localStorage.setItem('oa_team', JSON.stringify(_teamCache)); } catch {}
    _dbSaveTeam(_teamCache);
  }

