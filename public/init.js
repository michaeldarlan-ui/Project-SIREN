(async function initSiren() {
  // ── 0. Auth init ─────────────────────────────────────────────
  await authInit();

  // ── 1. Migrate localStorage history to DB (one-time) ────────
  if (!localStorage.getItem('oa_migrated_to_db')) {
    const local = [];
    try {
      const raw = JSON.parse(localStorage.getItem('oa_history') || '[]');
      raw.forEach(h => {
        if (!h.id) return;
        const sid = String(h.id);
        h.is_demo = sid.startsWith('demo-') || !!h.is_demo;
        local.push(h);
      });
    } catch {}
    if (local.length) {
      try {
        await fetch('/api/history/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(local),
        });
      } catch (e) { console.warn('[init] migration failed:', e.message); }
    }
    localStorage.setItem('oa_migrated_to_db', 'v1');
  }

  // ── 1b. Migrate localStorage usage to DB (one-time) ─────────
  if (!localStorage.getItem('oa_usage_migrated_to_db')) {
    const localUsage = (() => {
      try { return JSON.parse(localStorage.getItem('oa_usage') || '{"cost":0,"calls":0}'); } catch { return { cost: 0, calls: 0 }; }
    })();
    if (localUsage.cost > 0 || localUsage.calls > 0) {
      try {
        await fetch('/api/usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localUsage),
        });
      } catch (e) { console.warn('[init] usage migration failed:', e.message); }
    }
    localStorage.setItem('oa_usage_migrated_to_db', 'v1');
  }

  // ── 1c. Migrate localStorage team to DB (one-time) ─────────
  if (!localStorage.getItem('oa_team_migrated_to_db')) {
    const localTeam = (() => {
      try { return JSON.parse(localStorage.getItem('oa_team') || '[]'); } catch { return []; }
    })();
    if (localTeam.length) {
      try {
        await fetch('/api/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localTeam),
        });
      } catch (e) { console.warn('[init] team migration failed:', e.message); }
    }
    localStorage.setItem('oa_team_migrated_to_db', 'v1');
  }

  // ── 2. Load history + prospects + profiles from DB into cache ─
  await _loadHistFromDB();
  await _loadProspectsFromDB();
  await _loadThirdPartiesFromDB();
  await _loadTeamFromDB();
  await _loadUsageFromDB();
  await initAccountProfiles();
  try {
    const kr = await fetch('/api/org-knowledge');
    const kj = kr.ok ? await kr.json() : {};
    window._sirenOrgKnowledge = kj.content || '';
  } catch { window._sirenOrgKnowledge = ''; }

  // ── 3. Boot UI (each call wrapped so one failure doesn't block navTo) ──
  try { initKeyUI(); } catch(e) { console.error('[init] initKeyUI:', e); }
  try { renderMemberList(); } catch(e) { console.error('[init] renderMemberList:', e); }
  try { renderLibrary(); } catch(e) { console.error('[init] renderLibrary:', e); }
  try { renderTemplates(); } catch(e) { console.error('[init] renderTemplates:', e); }
  try { populateReportTypeSelect(); } catch(e) { console.error('[init] populateReportTypeSelect:', e); }
  try { renderDocList(); } catch(e) { console.error('[init] renderDocList:', e); }
  try { initUsageBar(); } catch(e) { console.error('[init] initUsageBar:', e); }
  try { forgeInit(); } catch(e) { console.error('[init] forgeInit:', e); }
  try { renderScopePage(); } catch(e) { console.error('[init] renderScopePage:', e); }

  // ── 4. Navigate to pulse ──────────────────────────────────────
  navTo('pulse');
})();
