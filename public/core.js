  let selectedStage = 'Demo / solution presentation';
  let currentPage = 'pulse';

  // Canonical sales roles — values must align with engage.js isSE / isSDR / isAM / isManager detection.
  // Grouped for the dropdown; the value is what gets stored as sales_role.
  window.SIREN_SALES_ROLES = [
    { group: 'SDR / BDR',   value: 'SDR',                           label: 'SDR – Sales Development Rep' },
    { group: 'SDR / BDR',   value: 'BDR',                           label: 'BDR – Business Development Rep' },
    { group: 'Account Executive', value: 'Account Executive',        label: 'Account Executive' },
    { group: 'Account Executive', value: 'Enterprise Account Executive', label: 'Enterprise AE' },
    { group: 'Account Executive', value: 'Mid-Market Account Executive',  label: 'Mid-Market AE' },
    { group: 'Account Executive', value: 'SMB Account Executive',    label: 'SMB / Commercial AE' },
    { group: 'Presales / SE', value: 'Sales Engineer',               label: 'Sales Engineer' },
    { group: 'Presales / SE', value: 'Solutions Engineer',           label: 'Solutions Engineer' },
    { group: 'Presales / SE', value: 'Solutions Architect',          label: 'Solutions Architect' },
    { group: 'Presales / SE', value: 'Solutions Consultant',         label: 'Solutions Consultant' },
    { group: 'Presales / SE', value: 'Presales Consultant',          label: 'Presales Consultant' },
    { group: 'Account Manager / CSM', value: 'Account Manager',      label: 'Account Manager' },
    { group: 'Account Manager / CSM', value: 'Customer Success Manager', label: 'Customer Success Manager (CSM)' },
    { group: 'Account Manager / CSM', value: 'Renewal Manager',      label: 'Renewal Manager' },
    { group: 'Leadership',   value: 'Sales Manager',                 label: 'Sales Manager' },
    { group: 'Leadership',   value: 'Director of Sales',             label: 'Director of Sales' },
    { group: 'Leadership',   value: 'VP of Sales',                   label: 'VP of Sales' },
    { group: 'Leadership',   value: 'CRO',                           label: 'CRO – Chief Revenue Officer' },
  ];

  // Build a <select> element's innerHTML from SIREN_SALES_ROLES (with optional blank first option).
  const _optStyle  = 'background:#18181b;color:#e2e8f0;';
  const _grpStyle  = 'background:#111113;color:rgba(245,158,11,.65);font-size:10px;font-weight:700;letter-spacing:.06em;';
  const _blankStyle = 'background:#18181b;color:rgba(255,255,255,.3);';
  window.buildRoleOptions = function(selected, blankLabel) {
    const blank = blankLabel !== undefined ? `<option value="" style="${_blankStyle}">${blankLabel}</option>` : '';
    const groups = {};
    window.SIREN_SALES_ROLES.forEach(r => { (groups[r.group] = groups[r.group] || []).push(r); });
    return blank + Object.entries(groups).map(([g, roles]) =>
      `<optgroup label="${g}" style="${_grpStyle}">${roles.map(r =>
        `<option value="${r.value}" style="${_optStyle}"${r.value === selected ? ' selected' : ''}>${r.label}</option>`
      ).join('')}</optgroup>`
    ).join('');
  };

  // ── Navigation ─────────────────────────────────────────────
  function navTo(page) {
    if (page === 'team') page = 'users'; // Sales Team merged into Team page
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
    closeMobileNav();
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

  // ── Mobile nav ─────────────────────────────────────────────
  function toggleMobileNav(e) {
    e.stopPropagation();
    document.getElementById('navTabs').classList.toggle('mobile-open');
    document.getElementById('navHamburger').classList.toggle('open');
  }
  function closeMobileNav() {
    document.getElementById('navTabs').classList.remove('mobile-open');
    document.getElementById('navHamburger').classList.remove('open');
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#navTabs') && !e.target.closest('#navHamburger')) closeMobileNav();
  });

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
