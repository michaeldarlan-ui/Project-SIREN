(async function initSiren() {
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

  // ── 1b. Migrate localStorage team to DB (one-time) ──────────
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

  // ── 2. Load history + prospects from DB into cache ───────────
  await _loadHistFromDB();
  await _loadProspectsFromDB();
  await _loadThirdPartiesFromDB();
  await _loadTeamFromDB();

  // ── 3. Demo version check — reseed if stale or incomplete ────
  const demoCount = _histCache.filter(h => h.is_demo).length;
  if (localStorage.getItem('oa_demo_version') !== DEMO_VERSION || demoCount < 12) {
    localStorage.removeItem('oa_demo_seeded');
    await seedDemoData();
    localStorage.setItem('oa_demo_version', DEMO_VERSION);
  }

  // ── 4. Boot UI ────────────────────────────────────────────────
  initKeyUI();
  renderMemberList();
  renderLibrary();
  renderTemplates();
  populateReportTypeSelect();
  renderDocList();
  initUsageBar();
  forgeInit();
  renderScopePage();

  // ── 5. Navigate to pulse ──────────────────────────────────────
  navTo('pulse');
})();
