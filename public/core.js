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
          (page === 'vigil'       && t.textContent === 'VIGIL')) {
        t.classList.add('active');
      }
    });
    currentPage = page;
    window.scrollTo(0, 0);
    if (page === 'pulse')     renderPulse();
    if (page === 'history')   renderHistory();
    if (page === 'lifecycle') renderLifecyclePage();
    if (page === 'scope')     renderScopePage();
    if (page === 'forge')     forgeInit();
    if (page === 'vigil')       pulseRenderFeed();
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

  // ── Team manager ───────────────────────────────────────────
  function loadTeam() {
    try { return JSON.parse(localStorage.getItem('oa_team') || '[]'); } catch { return []; }
  }
  function saveTeam(t) {
    try { localStorage.setItem('oa_team', JSON.stringify(t)); } catch {}
  }

