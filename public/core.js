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
          (page === 'coach'       && t.textContent === 'COACH') ||
          (page === 'usage'       && t.textContent === 'USAGE') ||
          (page === 'dash'        && t.textContent === 'DASH')) {
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
    if (page === 'usage')       renderUsagePage();
    if (page === 'dash')        typeof dashInit === 'function' && dashInit();
    if (page === 'settings')    rdmRender();
    if (page === 'audit')       typeof auditLoad === 'function' && auditLoad();
    if (page === 'users')       typeof usersLoad === 'function' && usersLoad();
  }

  // ── Settings menu ──────────────────────────────────────────
  function toggleSettingsMenu(e) {
    e.stopPropagation();
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
  window.escHtml = escHtml;

  // ── Dev model selector ─────────────────────────────────────
  const DEV_MODELS = [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6' },
    { id: 'claude-opus-4-8',           label: 'Opus 4.8' },
  ];
  const _MODEL_PFX = 'siren_model_';
  window.getDevModel = function(key, fallback) {
    return localStorage.getItem(_MODEL_PFX + key) || fallback;
  };
  window.setDevModel = function(key, model) {
    if (model) localStorage.setItem(_MODEL_PFX + key, model);
    else localStorage.removeItem(_MODEL_PFX + key);
  };
  // Render all .dev-model-wrap placeholders on the page
  window.renderDevPickers = function() {
    document.querySelectorAll('.dev-model-wrap').forEach(el => {
      const key = el.dataset.key;
      const def = el.dataset.default || 'claude-sonnet-4-6';
      const cur = localStorage.getItem(_MODEL_PFX + key) || def;
      el.innerHTML = `<select class="dev-model-sel"
          onchange="setDevModel('${key}',this.value)"
          onclick="event.stopPropagation()">
        ${DEV_MODELS.map(m =>
          `<option value="${m.id}"${cur===m.id?' selected':''}>${m.label}${m.id===def?' (default)':''}</option>`
        ).join('')}
      </select>`;
    });
  };
  document.addEventListener('DOMContentLoaded', window.renderDevPickers);

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
    // Pre-fill the console-sync inputs with the current mirrored values
    fetch('/api/usage').then(r => r.json()).then(u => {
      const status = document.getElementById('cuBaselineStatus');
      if (u.console) {
        const balEl = document.getElementById('cuBaselineBalance');
        const monEl = document.getElementById('cuBaselineMonth');
        if (balEl) balEl.value = u.console.balance.toFixed(2);
        if (monEl) monEl.value = u.console.monthSpend.toFixed(2);
        if (status) status.textContent = u.console.savedAt
          ? 'Baseline last synced ' + new Date(u.console.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' — values shown include metered spend since then.'
          : '';
      } else if (status) {
        status.textContent = 'No baseline set yet — the PULSE tile shows metered spend only until you sync.';
      }
    }).catch(() => {});
  };
  window.closeCostUsageModal = function() {
    const m = document.getElementById('costUsageModal');
    if (m) m.style.display = 'none';
  };
  window.saveUsageBaseline = async function(btn) {
    const balance    = parseFloat(document.getElementById('cuBaselineBalance')?.value);
    const monthSpend = parseFloat(document.getElementById('cuBaselineMonth')?.value);
    const status = document.getElementById('cuBaselineStatus');
    if (isNaN(balance) && isNaN(monthSpend)) {
      if (status) status.textContent = 'Enter at least one value before saving.';
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const resp = await fetch('/api/usage/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: isNaN(balance) ? 0 : balance, monthSpend: isNaN(monthSpend) ? 0 : monthSpend }),
      });
      if (!resp.ok) throw new Error('status ' + resp.status);
      await _loadUsageFromDB();
      if (typeof renderPulse === 'function' && currentPage === 'pulse') renderPulse();
      if (status) status.textContent = 'Baseline saved — the PULSE tile now mirrors the console from these values.';
    } catch (e) {
      if (status) status.textContent = 'Save failed: ' + e.message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save baseline'; }
    }
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


// ── Settings: Grading Reference accordion ──
function srefToggle(hdrEl) {
  const card = hdrEl.closest('.sref-card');
  card.classList.toggle('open');
}
