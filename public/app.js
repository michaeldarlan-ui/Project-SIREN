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

  function renderMemberList() {
    const team = loadTeam();
    const el = document.getElementById('memberList');
    el.innerHTML = team.length
      ? team.map((m, i) => `
          <div class="member-row">
            <div class="member-info">
              <span class="member-name"><input class="member-edit-input" value="${escHtml(m.name)}" placeholder="Name" onchange="updateMember(${i},'name',this.value)" onkeydown="if(event.key==='Enter')this.blur()"></span>
              <span class="member-role"><input class="member-edit-input" value="${escHtml(m.role)}" placeholder="Role" onchange="updateMember(${i},'role',this.value)" onkeydown="if(event.key==='Enter')this.blur()"></span>
            </div>
            <button class="member-remove" onclick="removeMember(${i})">Remove</button>
          </div>`).join('')
      : '<div class="team-empty">No team members yet. Add someone below.</div>';
    refreshRepSelect();
  }

  function updateMember(idx, field, value) {
    const team = loadTeam();
    if (!team[idx]) return;
    team[idx][field] = value.trim() || team[idx][field];
    saveTeam(team);
    refreshRepSelect();
  }

  function addMember() {
    const name = document.getElementById('newMemberName').value.trim();
    const role = document.getElementById('newMemberRole').value.trim();
    if (!name) { document.getElementById('newMemberName').focus(); return; }
    const team = loadTeam();
    team.push({ name, role: role || 'Sales Rep' });
    saveTeam(team);
    document.getElementById('newMemberName').value = '';
    document.getElementById('newMemberRole').value = '';
    renderMemberList();
  }

  function removeMember(idx) {
    const team = loadTeam();
    team.splice(idx, 1);
    saveTeam(team);
    renderMemberList();
  }

  function refreshRepSelect() {
    const team = loadTeam();
    const sel = document.getElementById('repSelect');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Rep (optional) —</option>' +
      team.map(m => `<option value="${escHtml(m.name)}">${escHtml(m.name)} — ${escHtml(m.role)}</option>`).join('');
    if (current) sel.value = current;
    onRepChange();
  }

  function onRepChange() {
    const sel = document.getElementById('repSelect');
    if (!sel) return;
    const team = loadTeam();
    const name = document.getElementById('repSelect').value;
    const hint = document.getElementById('repRoleHint');
    const member = team.find(m => m.name === name);
    if (member?.role) {
      hint.textContent = 'Grading as: ' + member.role;
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
    updateHistoryHint();
  }

  function getSelectedRep() {
    const sel = document.getElementById('repSelect');
    if (!sel) return null;
    const team = loadTeam();
    return team.find(m => m.name === sel.value) || null;
  }

  ['newMemberName','newMemberRole'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
  });

  // ── Resource library ───────────────────────────────────────
  const DEFAULT_READ = [
    { title: 'Never Split the Difference', author: 'Chris Voss', type: 'Book' }
  ];
  const DEFAULT_RECOMMEND = [
    { title: 'SPIN Selling', author: 'Neil Rackham', type: 'Book', why: 'Strong framework for consultative discovery and surfacing implicit needs in complex B2B sales.' },
    { title: 'The Challenger Sale', author: 'Matthew Dixon & Brent Adamson', type: 'Book', why: "Teaches reps to reframe the prospect's thinking and lead with insight rather than just responding to stated needs." },
    { title: 'Gap Selling', author: 'Keenan', type: 'Book', why: 'Problem-centric selling focused on quantifying the gap between current state and desired state — highly applicable to MSSP conversations.' },
    { title: 'Fanatical Prospecting', author: 'Jeb Blount', type: 'Book', why: 'Pipeline discipline and outreach cadence for reps who need to build consistent top-of-funnel activity.' },
    { title: 'The Qualified Sales Leader', author: 'John McMahon', type: 'Book', why: 'Enterprise qualification rigor — MEDDIC/MEDDPICC methodology for complex deals with multiple stakeholders.' },
    { title: 'The JOLT Effect', author: 'Matthew Dixon & Ted McKenna', type: 'Book', why: 'Addresses indecision as the primary reason deals are lost — practical techniques for moving stuck prospects forward.' }
  ];

  function loadLibrary() {
    try {
      const raw = localStorage.getItem('oa_library');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { read: [...DEFAULT_READ], recommend: [...DEFAULT_RECOMMEND] };
  }
  function saveLibrary(lib) {
    try { localStorage.setItem('oa_library', JSON.stringify(lib)); } catch {}
  }

  let libTab = 'read';

  function setLibTab(tab) {
    libTab = tab;
    document.getElementById('tabRead').classList.toggle('active', tab === 'read');
    document.getElementById('tabRecommend').classList.toggle('active', tab === 'recommend');
    document.getElementById('libWhyRow').style.display = tab === 'recommend' ? 'block' : 'none';
  }

  function typeChip(type) {
    const cls = { Book: 'lib-type-book', Website: 'lib-type-website', Framework: 'lib-type-framework' }[type] || 'lib-type-book';
    return `<span class="lib-type-chip ${cls}">${escHtml(type)}</span>`;
  }

  function renderLibrary() {
    renderDocList();
    renderTemplates();
  }

  function addLibItem() {
    const title = document.getElementById('libTitle').value.trim();
    const author = document.getElementById('libAuthor').value.trim();
    const type = document.getElementById('libType').value;
    const why = document.getElementById('libWhy').value.trim();
    if (!title) { document.getElementById('libTitle').focus(); return; }
    const lib = loadLibrary();
    if (libTab === 'read') {
      lib.read.push({ title, author, type });
    } else {
      lib.recommend.push({ title, author, type, why });
    }
    saveLibrary(lib);
    document.getElementById('libTitle').value = '';
    document.getElementById('libAuthor').value = '';
    document.getElementById('libWhy').value = '';
    renderLibrary();
  }

  function removeLibItem(section, idx) {
    const lib = loadLibrary();
    lib[section].splice(idx, 1);
    saveLibrary(lib);
    renderLibrary();
  }

  function buildLibraryPrompt() {
    const lib = loadLibrary();
    const readList = lib.read.map(r => `"${r.title}"${r.author ? ' by ' + r.author : ''}`).join(', ');
    const recList = lib.recommend.map(r => {
      let s = `- ${r.title}${r.author ? ' (' + r.author + ')' : ''}`;
      if (r.why) s += ': ' + r.why;
      return s;
    }).join('\n');
    const readClause = readList ? `The rep has already read the following — never recommend them: ${readList}.` : '';
    const recClause = lib.recommend.length
      ? `Only recommend resources from this approved list when a genuine gap exists:\n${recList}`
      : 'No recommended resources are configured — omit the recommended_books field entirely.';
    return `${readClause}\n\n${recClause}`;
  }

  document.getElementById('libTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') addLibItem(); });

  // ── Content Templates ───────────────────────────────────────
  function loadTemplates() {
    try { const r = localStorage.getItem('oa_templates'); if (r) return JSON.parse(r); } catch {}
    return [];
  }
  function saveTemplates(t) { try { localStorage.setItem('oa_templates', JSON.stringify(t)); } catch {} }

  const DEFAULT_REPORT_TYPES = ['Follow-Up Email', 'Executive Summary', 'Next Steps Memo', 'Proposal Cover', 'Scorecard Narrative', 'QBR Report'];

  function loadReportTypes() {
    try { const r = localStorage.getItem('oa_report_types'); if (r) return JSON.parse(r); } catch {}
    return [...DEFAULT_REPORT_TYPES];
  }
  function saveReportTypes(types) { try { localStorage.setItem('oa_report_types', JSON.stringify(types)); } catch {} }

  function populateReportTypeSelect() {
    const sel = document.getElementById('tmplReportType');
    if (!sel) return;
    const types = loadReportTypes();
    sel.innerHTML = '<option value="">— Report Type —</option>' +
      types.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('') +
      '<option value="__custom__">+ Add custom type…</option>';
  }

  function onReportTypeChange() {
    const sel = document.getElementById('tmplReportType');
    const row = document.getElementById('tmplCustomTypeRow');
    if (!sel || !row) return;
    row.style.display = sel.value === '__custom__' ? 'block' : 'none';
    if (sel.value === '__custom__') document.getElementById('tmplCustomType').focus();
  }

  let _tmplExpanded = new Set();

  function renderTemplates() {
    const tmpls = loadTemplates();
    const el = document.getElementById('tmplList');
    if (!el) return;
    if (!tmpls.length) { el.innerHTML = '<div class="lib-empty" style="margin-bottom:10px;">No templates yet — create one below.</div>'; return; }
    el.innerHTML = tmpls.map((t, i) => {
      const open = _tmplExpanded.has(i);
      return `<div class="tmpl-item">
        <div class="tmpl-item-head" onclick="toggleTmplExpand(${i})">
          <span class="tmpl-item-name">${escHtml(t.name)}</span>
          ${t.reportType ? `<span class="tmpl-item-stage">${escHtml(t.reportType)}</span>` : ''}
          <div class="tmpl-item-actions" onclick="event.stopPropagation()">
            <button class="tmpl-copy-btn" onclick="copyTemplate(${i})">Copy</button>
            <button class="member-remove" onclick="removeTemplate(${i})">Remove</button>
          </div>
          <span style="font-size:11px;color:var(--siren-text-faint);margin-left:4px;">${open ? '▲' : '▼'}</span>
        </div>
        ${open ? `<div class="tmpl-item-body">
          ${t.body ? `<textarea rows="5" onchange="updateTemplate(${i}, this.value)">${escHtml(t.body)}</textarea>` : ''}
          ${(t.files||[]).length ? `<div style="margin-top:${t.body?'8px':'0'};">
            ${t.files.map((f,fi) => `<span class="tmpl-file-chip"><a href="${f.data}" download="${escHtml(f.name)}" style="color:inherit;text-decoration:none;">📎 ${escHtml(f.name)}</a><button onclick="removeTmplFile(${i},${fi})">✕</button></span>`).join('')}
          </div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function toggleTmplExpand(i) {
    if (_tmplExpanded.has(i)) _tmplExpanded.delete(i); else _tmplExpanded.add(i);
    renderTemplates();
  }

  let _tmplPendingFiles = []; // { name, type, data (base64) }

  function onTmplFileAdd(event) {
    const files = Array.from(event.target.files);
    const readNext = (idx) => {
      if (idx >= files.length) { renderTmplPendingFiles(); return; }
      const file = files[idx];
      const reader = new FileReader();
      reader.onload = e => {
        _tmplPendingFiles.push({ name: file.name, type: file.type, data: e.target.result });
        readNext(idx + 1);
      };
      reader.readAsDataURL(file);
    };
    readNext(0);
    event.target.value = '';
  }

  function renderTmplPendingFiles() {
    const el = document.getElementById('tmplFileList');
    if (!el) return;
    el.innerHTML = _tmplPendingFiles.map((f, i) =>
      `<span class="tmpl-file-chip">📎 ${escHtml(f.name)}<button onclick="_tmplPendingFiles.splice(${i},1);renderTmplPendingFiles()">✕</button></span>`
    ).join('');
  }

  function addTemplate() {
    const name = document.getElementById('tmplName').value.trim();
    const sel = document.getElementById('tmplReportType');
    const body = document.getElementById('tmplBody').value.trim();
    if (!name) { document.getElementById('tmplName').focus(); return; }
    if (!body && !_tmplPendingFiles.length) { document.getElementById('tmplBody').focus(); return; }
    let reportType = sel ? sel.value : '';
    if (reportType === '__custom__') {
      const custom = document.getElementById('tmplCustomType').value.trim();
      if (!custom) { document.getElementById('tmplCustomType').focus(); return; }
      reportType = custom;
      const types = loadReportTypes();
      if (!types.includes(custom)) { types.push(custom); saveReportTypes(types); }
    }
    const tmpls = loadTemplates();
    tmpls.push({ name, reportType, body, files: [..._tmplPendingFiles] });
    saveTemplates(tmpls);
    document.getElementById('tmplName').value = '';
    document.getElementById('tmplCustomType').value = '';
    document.getElementById('tmplCustomTypeRow').style.display = 'none';
    document.getElementById('tmplBody').value = '';
    _tmplPendingFiles = [];
    renderTmplPendingFiles();
    populateReportTypeSelect();
    toggleTmplForm(false);
    renderTemplates();
  }

  function removeTemplate(i) {
    const tmpls = loadTemplates();
    tmpls.splice(i, 1);
    _tmplExpanded.delete(i);
    saveTemplates(tmpls);
    renderTemplates();
  }

  function removeTmplFile(tmplIdx, fileIdx) {
    const tmpls = loadTemplates();
    if (tmpls[tmplIdx]?.files) { tmpls[tmplIdx].files.splice(fileIdx, 1); saveTemplates(tmpls); renderTemplates(); }
  }

  function updateTemplate(i, val) {
    const tmpls = loadTemplates();
    if (tmpls[i]) { tmpls[i].body = val; saveTemplates(tmpls); }
  }

  function copyTemplate(i) {
    const tmpls = loadTemplates();
    if (!tmpls[i]) return;
    navigator.clipboard.writeText(tmpls[i].body).then(() => {
      const btns = document.querySelectorAll('.tmpl-copy-btn');
      const btn = btns[i];
      if (btn) { const orig = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = orig; }, 1500); }
    }).catch(() => {});
  }

  function toggleTmplForm(forceOpen) {
    const form = document.getElementById('tmplAddForm');
    const btn = document.getElementById('tmplNewBtn');
    if (!form || !btn) return;
    const open = forceOpen !== undefined ? forceOpen : form.style.display === 'none' || !form.style.display;
    form.style.display = open ? 'block' : 'none';
    btn.style.display = open ? 'none' : 'block';
    if (open) { populateReportTypeSelect(); document.getElementById('tmplName').focus(); }
  }
  // Default call date to today
  document.getElementById('callDate').value = new Date().toISOString().slice(0, 10);

  // ── Grader ─────────────────────────────────────────────────
  function initKeyUI() {
    const el = document.getElementById('keyStatus');
    if (el) el.innerHTML = `<div class="key-banner"><div class="key-dot"></div>Connected — API key secured on server.</div>`;
  }

  function toggleKey() {
    const input = document.getElementById('apiKey');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.target.textContent = input.type === 'password' ? 'Show' : 'Hide';
  }

  function setStage(btn, stage) {
    document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedStage = stage;
  }

  function getBarColor(pct) {
    if (pct >= 90) return '#00c8ff';
    if (pct >= 80) return '#00c896';
    if (pct >= 70) return '#e8a020';
    if (pct >= 60) return '#e05050';
    return '#BBC1C7';
  }

  function scoreToGrade(n) {
    if (n >= 97) return 'A+';
    if (n >= 93) return 'A';
    if (n >= 90) return 'A-';
    if (n >= 87) return 'B+';
    if (n >= 83) return 'B';
    if (n >= 80) return 'B-';
    if (n >= 77) return 'C+';
    if (n >= 73) return 'C';
    if (n >= 70) return 'C-';
    if (n >= 67) return 'D+';
    if (n >= 63) return 'D';
    if (n >= 60) return 'D-';
    return 'F';
  }

  function getBannerColor(grade) {
    const g = (grade || '').toUpperCase().replace(/\s/g, '');
    if (g.startsWith('A')) return '#00c8ff';
    if (g.startsWith('B')) return '#00c896';
    if (g.startsWith('C')) return '#e8a020';
    if (g.startsWith('D')) return '#e05050';
    return '#c03030';
  }

  function buildRoleGuidance(rep) {
    if (!rep) return '';
    const role = rep.role.toLowerCase();
    if (role.includes('sdr') || role.includes('bdr') || role.includes('development'))
      return `\n\nRep role context — ${rep.name} is a ${rep.role}. Weight grading toward pipeline generation skills: opening, qualifying interest, booking the next meeting. Hold lighter expectations on deep technical demo delivery or close mechanics, but be rigorous on discovery quality and next-step commitment.`;
    if (role.includes('engineer') || role.includes('se') || role.includes('presales') || role.includes('pre-sales'))
      return `\n\nRep role context — ${rep.name} is a ${rep.role}. Weight grading toward technical demo quality, solution fit accuracy, and ability to translate prospect pain into OneAxiom's technical differentiators. Hold lighter expectations on commercial negotiation or close tactics, but be rigorous on demo delivery and technical objection handling.`;
    if (role.includes('manager') || role.includes('director') || role.includes('vp') || role.includes('leader'))
      return `\n\nRep role context — ${rep.name} is a ${rep.role}. Weight grading toward deal strategy, executive-level value framing, and qualification rigor. Note any coaching or leadership behaviors if this appears to be a joint call.`;
    if (role.includes('account manager') || role.includes('csm') || role.includes('success') || role.includes('renewal'))
      return `\n\nRep role context — ${rep.name} is a ${rep.role}. Weight grading toward expansion discovery, upsell signals, relationship depth, and retention mechanics. Hold lighter expectations on cold prospecting technique, but be rigorous on value confirmation and next-step clarity.`;
    return `\n\nRep role context — ${rep.name} is a ${rep.role}. Grade the full sales cycle with balanced weight across all five dimensions.`;
  }

  function buildHistoryContext(prospect, rep) {
    const history = loadHistory();
    if (!history.length) return '';

    // Match by prospect name (case-insensitive) or by rep name
    const prospectNorm = (prospect || '').toLowerCase().trim();
    const repNorm = rep ? rep.name.toLowerCase().trim() : '';

    const matches = history.filter(h => {
      const hProspect = (h.prospect || '').toLowerCase().trim();
      const hRep = (h.rep || '').toLowerCase().trim();
      return (prospectNorm && hProspect && hProspect === prospectNorm) ||
             (repNorm && hRep && hRep === repNorm);
    }).slice(0, 5); // cap at 5 most recent matching calls

    if (!matches.length) return '';

    const sections = matches.map(h => {
      const dateStr = h.callDate ? h.callDate : (h.ts ? h.ts.slice(0, 10) : 'unknown date');
      const label = [h.stage, h.callDate || h.ts?.slice(0,10)].filter(Boolean).join(' — ');
      return `Previous call (${label}): Grade ${h.letter_grade} ${h.total}/100. ${h.grade_label ? '"' + h.grade_label + '". ' : ''}Strength: ${h.top_strength || 'n/a'}. Priority: ${h.top_priority || 'n/a'}.`;
    }).join('\n');

    return `\n\nPrevious call history for this account/rep (use for context and to track progression across calls — note improvement or regression trends):\n${sections}`;
  }

  // ── Company combobox ───────────────────────────────────────
  let comboboxKbIndex = -1;

  function getKnownCompanies() {
    const history = loadHistory();
    const seen = new Set();
    const out = [];
    for (const h of history) {
      const name = (h.prospect || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        out.push(name);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }

  function buildProspectOptions(query) {
    const companies = getKnownCompanies();
    const q = (query || '').toLowerCase().trim();
    const filtered = q ? companies.filter(c => c.toLowerCase().includes(q)) : companies;
    const exactMatch = companies.some(c => c.toLowerCase() === q);
    const dd = document.getElementById('prospectDropdown');
    const items = [];

    if (!filtered.length && !q) {
      items.push(`<div class="combobox-option empty-state">No companies in history yet — type to add one</div>`);
    } else {
      filtered.forEach((c, i) => {
        items.push(`<div class="combobox-option" data-value="${escHtml(c)}" onmousedown="selectProspect('${escHtml(c)}')">${escHtml(c)}</div>`);
      });
    }

    if (q && !exactMatch) {
      items.push(`<div class="combobox-option add-new" data-value="${escHtml(query.trim())}" onmousedown="selectProspect('${escHtml(query.trim())}')">+ Add &ldquo;${escHtml(query.trim())}&rdquo;</div>`);
    }

    dd.innerHTML = items.join('');
    comboboxKbIndex = -1;
  }

  function openProspectDropdown() {
    buildProspectOptions(document.getElementById('prospect').value);
    document.getElementById('prospectDropdown').classList.add('open');
  }

  function closeProspectDropdown() {
    document.getElementById('prospectDropdown').classList.remove('open');
    comboboxKbIndex = -1;
  }

  function onProspectInput() {
    buildProspectOptions(document.getElementById('prospect').value);
    document.getElementById('prospectDropdown').classList.add('open');
    updateHistoryHint();
  }

  function selectProspect(name) {
    document.getElementById('prospect').value = name;
    closeProspectDropdown();
    updateHistoryHint();
  }

  function onProspectKeydown(e) {
    const dd = document.getElementById('prospectDropdown');
    const opts = dd.querySelectorAll('.combobox-option:not(.empty-state)');
    if (!dd.classList.contains('open') || !opts.length) {
      if (e.key === 'Enter') return;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      comboboxKbIndex = Math.min(comboboxKbIndex + 1, opts.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      comboboxKbIndex = Math.max(comboboxKbIndex - 1, 0);
    } else if (e.key === 'Enter' && comboboxKbIndex >= 0) {
      e.preventDefault();
      selectProspect(opts[comboboxKbIndex].dataset.value);
      return;
    } else if (e.key === 'Escape') {
      closeProspectDropdown(); return;
    } else { return; }
    opts.forEach((o, i) => o.classList.toggle('kb-focused', i === comboboxKbIndex));
    opts[comboboxKbIndex]?.scrollIntoView({ block: 'nearest' });
  }

  // Close dropdown when clicking outside
  document.addEventListener('mousedown', e => {
    if (!document.getElementById('prospectCombobox').contains(e.target)) {
      closeProspectDropdown();
    }
  });

  function updateHistoryHint() {
    const prospect = document.getElementById('prospect').value.trim();
    const rep = getSelectedRep();
    const hint = document.getElementById('historyContextHint');
    const history = loadHistory();
    const prospectNorm = prospect.toLowerCase().trim();
    const repNorm = rep ? rep.name.toLowerCase().trim() : '';
    const count = history.filter(h => {
      const hP = (h.prospect || '').toLowerCase().trim();
      const hR = (h.rep || '').toLowerCase().trim();
      return (prospectNorm && hP && hP === prospectNorm) ||
             (repNorm && hR && hR === repNorm);
    }).length;
    if (count > 0) {
      hint.textContent = count + ' previous call' + (count !== 1 ? 's' : '') + ' found — history will be included in grading context.';
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
  }

  async function gradeCall() {
    const notes = document.getElementById('callNotes').value.trim();
    const prospect = document.getElementById('prospect').value.trim();
    const contactTitle = document.getElementById('contactTitle').value.trim();
    const callDate = document.getElementById('callDate').value;
    const rep = getSelectedRep();

    if (!notes) { showError('Please paste your call notes or transcript.'); return; }

    setLoading(true, prospect, selectedStage);
    clearError();
    document.getElementById('results').style.display = 'none';

    const systemPrompt = `You are an expert sales coach specializing in MSSP and B2B security sales.

${buildLibraryPrompt()}${buildDocsPrompt()}${buildHistoryContext(prospect, rep)}

You are grading a ${selectedStage} call for OneAxiom, a Houston-based MSSP. Key differentiator: bundling 24x7 SOC + EDR (CrowdStrike/SentinelOne) + vuln scanning (SecPod Saner CVEM) + KnowBe4 security awareness training, replacing 2-3 vendors. CMMC positioning is only relevant if the transcript explicitly mentions DoD contracts, CMMC, or CUI — do NOT grade on CMMC for general prospects.${buildRoleGuidance(rep)}

Use this grading scale when assigning letter_grade based on total score (0–100):
A+: 97–100 | A: 93–96 | A-: 90–92 | B+: 87–89 | B: 83–86 | B-: 80–82 | C+: 77–79 | C: 73–76 | C-: 70–72 | D+: 67–69 | D: 63–66 | D-: 60–62 | F: 0–59

Grade across these 5 dimensions and return ONLY valid JSON, no markdown, no backticks, no preamble:

{
  "dimensions": [
    { "name": "Discovery & needs confirmation", "max": 20, "score": 0, "feedback": "2-3 sentences of specific actionable coaching tied to what happened in this call" },
    { "name": "Value framing & demo delivery", "max": 25, "score": 0, "feedback": "2-3 sentences" },
    { "name": "Tactical empathy & objection handling", "max": 25, "score": 0, "feedback": "2-3 sentences — call out specific techniques used or missed" },
    { "name": "Qualification & deal mechanics", "max": 15, "score": 0, "feedback": "2-3 sentences covering budget, authority, timeline, competitive landscape, winnability" },
    { "name": "Call control & next steps", "max": 15, "score": 0, "feedback": "2-3 sentences" }
  ],
  "total": 0,
  "letter_grade": "B",
  "grade_label": "short evocative phrase",
  "top_strength": "one specific sentence",
  "top_priority": "single most important fix for next call",
  "call_summary": {
    "positives": ["specific thing done well", "another positive"],
    "missed": ["opportunity or technique not attempted", "another missed moment"],
    "improvements": ["concrete thing to do differently next call", "another improvement"]
  },
  "recommended_books": [{ "title": "Resource title", "author": "Author", "reason": "1-2 sentences why" }],
  "rep_scores": [
    {
      "name": "Rep Name as spoken in transcript",
      "dimensions": [
        { "name": "Discovery & needs confirmation", "max": 20, "score": 0, "feedback": "2-3 sentences specific to this rep's contributions only" },
        { "name": "Value framing & demo delivery", "max": 25, "score": 0, "feedback": "2-3 sentences" },
        { "name": "Tactical empathy & objection handling", "max": 25, "score": 0, "feedback": "2-3 sentences" },
        { "name": "Qualification & deal mechanics", "max": 15, "score": 0, "feedback": "2-3 sentences" },
        { "name": "Call control & next steps", "max": 15, "score": 0, "feedback": "2-3 sentences" }
      ],
      "total": 0,
      "letter_grade": "B",
      "grade_label": "short evocative phrase",
      "top_strength": "one specific sentence about this rep",
      "top_priority": "single most important fix for this rep"
    }
  ],
  "spiced": {
    "situation":      { "touched": true,  "summary": "1-2 sentences on what situation context was established or what was missing" },
    "pain":           { "touched": true,  "summary": "1-2 sentences on pain points surfaced or what was left unexplored" },
    "impact":         { "touched": false, "summary": "1-2 sentences on business/financial impact discussed or what was not quantified" },
    "critical_event": { "touched": false, "summary": "1-2 sentences on urgency or deadline drivers raised or absent" },
    "evolution":      { "touched": false, "summary": "1-2 sentences on decision process, stakeholders, or how the deal progresses" },
    "decision":       { "touched": true,  "summary": "1-2 sentences on decision criteria, timeline, or authority discussed" }
  }
}

call_summary.positives: 2-4 specific strengths observed in this call.
call_summary.missed: 2-4 specific opportunities, techniques, or questions that were not attempted but should have been.
call_summary.improvements: 2-4 concrete, actionable things to do differently on the next call.
recommended_books: only recommend resources from the approved list above. If no list is configured or no gaps exist, return an empty array.
rep_scores: identify every named sales rep who speaks in the transcript. For each, score them individually across the same 5 dimensions based only on their own contributions — what they said, asked, or did. If only one rep is present, still populate rep_scores with that one entry. If no individual reps can be identified, return an empty array.
spiced: evaluate each of the 6 SPICED components (Situation, Pain, Impact, Critical Event, Evolution, Decision) from the SPICED framework (Winning by Design). Set touched to true if the rep meaningfully engaged with that component in the transcript, false if it was absent or superficial. Write a 1-2 sentence summary for each regardless of whether it was touched — if not touched, briefly note what was missing and why it matters.`;

    const context = [
      rep ? 'Rep: ' + rep.name + ' (' + rep.role + ')' : '',
      prospect ? 'Prospect: ' + prospect : '',
      contactTitle ? 'Contact title: ' + contactTitle : '',
      callDate ? 'Call date: ' + callDate : '',
      'Call stage: ' + selectedStage
    ].filter(Boolean).join(' | ');

    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 6000,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: context + '\n\n' + notes }]
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API error ' + resp.status);
      }

      // Read the SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulated = '';
      let inputTokens = 0, outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop(); // hold incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              accumulated += ev.delta.text;
              updateStreamProgress(accumulated);
            } else if (ev.type === 'message_start') {
              inputTokens = ev.message?.usage?.input_tokens || 0;
            } else if (ev.type === 'message_delta') {
              outputTokens = ev.usage?.output_tokens || 0;
            }
          } catch {}
        }
      }

      if (inputTokens || outputTokens) updateUsageUI(inputTokens, outputTokens);
      let raw = accumulated.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      renderResults(JSON.parse(raw), prospect, contactTitle, rep, callDate);
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        showError('Network error — could not reach the Anthropic API. Check your internet connection, verify the API key is valid, and ensure no browser extension is blocking the request.');
      } else {
        showError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function buildDimsHtml(dimensions) {
    return dimensions.map(d => {
      const pct = Math.round((d.score / d.max) * 100);
      const col = getBarColor(pct);
      return `<div class="dim-card">
        <div class="dim-head"><span class="dim-name">${escHtml(d.name)}</span><span class="dim-score" style="color:${col}">${d.score}/${d.max}</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${col};"></div></div>
        <div class="dim-feedback">${escHtml(d.feedback)}</div>
      </div>`;
    }).join('');
  }

  function buildScoreView(viewData, metaLine, viewId) {
    const bg = getBannerColor(viewData.letter_grade);
    return `<div class="score-view ${viewId === 'overall' ? 'active' : ''}" id="score-view-${viewId}">
      <div class="banner" style="background:${bg};">
        <div>
          <div class="banner-grade">${escHtml(viewData.letter_grade)} &nbsp; ${viewData.total}/100</div>
          <div class="banner-label">${escHtml(viewData.grade_label || '')}</div>
          ${metaLine ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:5px;">${metaLine}</div>` : ''}
        </div>
        <div class="banner-right">
          <div style="margin-bottom:6px;"><strong>Strength:</strong> ${escHtml(viewData.top_strength || '')}</div>
          <div><strong>Priority:</strong> ${escHtml(viewData.top_priority || '')}</div>
        </div>
      </div>
      <div class="section-head">Score breakdown</div>
      ${buildDimsHtml(viewData.dimensions)}
    </div>`;
  }

  function renderResults(r, prospect, contactTitle, rep, callDate) {
    const formattedDate = callDate ? new Date(callDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const overallMeta = [rep ? rep.name + (rep.role ? ' · ' + rep.role : '') : '', prospect, contactTitle, selectedStage, formattedDate].filter(Boolean).join(' · ');

    // Auto-save recommendations
    if (r.recommended_books?.length) autoSaveRecommendations(r.recommended_books);

    // Call summary
    const s = r.call_summary || {};
    const summaryHtml = (s.positives?.length || s.missed?.length || s.improvements?.length) ? `
      <div class="section-head">Call summary</div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-card-head positives">Positives</div>
          <ul class="summary-list positives">${(s.positives||[]).map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>
        </div>
        <div class="summary-card">
          <div class="summary-card-head missed">Missed</div>
          <ul class="summary-list missed">${(s.missed||[]).map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>
        </div>
        <div class="summary-card">
          <div class="summary-card-head improvements">Improvements</div>
          <ul class="summary-list improvements">${(s.improvements||[]).map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>
        </div>
      </div>` : '';

    // SPICED
    const spicedKeys = ['situation','pain','impact','critical_event','evolution','decision'];
    const spicedLabels = { situation: 'Situation', pain: 'Pain', impact: 'Impact', critical_event: 'Critical Event', evolution: 'Evolution', decision: 'Decision' };
    const sp = r.spiced || {};
    const spicedHtml = spicedKeys.some(k => sp[k]) ? `
      <div class="section-head">SPICED framework</div>
      <div class="spiced-list">
        ${spicedKeys.map(k => {
          const c = sp[k] || {};
          const cls = c.touched ? 'touched' : 'not-touched';
          return `<div class="spiced-item">
            <div class="spiced-bullet">
              <div class="spiced-dot ${cls}"></div>
              <span class="spiced-label ${cls}">${spicedLabels[k]}</span>
            </div>
            <div class="spiced-summary">${escHtml(c.summary || '')}</div>
          </div>`;
        }).join('')}
      </div>` : '';

    // Toggle + score views
    const repScores = (r.rep_scores || []).filter(rs => rs.name && rs.dimensions?.length);
    // Only show toggle when 2+ reps are on the call — single rep = no meaningful distinction
    const showToggle = repScores.length > 1;

    const toggleHtml = showToggle ? `
      <div class="rep-toggle">
        <button class="rep-toggle-btn active" id="toggle-overall" onclick="switchScoreView('overall')">Overall Call</button>
        ${repScores.map((rs, i) => `<button class="rep-toggle-btn" id="toggle-rep-${i}" onclick="switchScoreView('rep-${i}')">${escHtml(rs.name)}</button>`).join('')}
      </div>` : '';

    const overallView = buildScoreView(r, overallMeta, 'overall');
    const repViews = showToggle ? repScores.map((rs, i) => buildScoreView(rs, escHtml(rs.name) + (selectedStage ? ' · ' + selectedStage : ''), `rep-${i}`)).join('') : '';

    const resultsHtml = `
      ${toggleHtml}
      ${overallView}
      ${repViews}
      ${summaryHtml}
      ${spicedHtml}
      <button class="reset-btn" onclick="resetForm()">&#8592; Grade another call</button>`;

    document.getElementById('results').innerHTML = resultsHtml;
    document.getElementById('results').style.display = 'block';
    document.getElementById('inputCard').style.display = 'none';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    saveToHistory(r, prospect, contactTitle, rep, callDate, resultsHtml);
  }

  function switchScoreView(viewId) {
    document.querySelectorAll('.score-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.rep-toggle-btn').forEach(el => el.classList.remove('active'));
    const view = document.getElementById('score-view-' + viewId);
    const btn = document.getElementById('toggle-' + viewId);
    if (view) view.classList.add('active');
    if (btn) btn.classList.add('active');
  }

  function autoSaveRecommendations(books) {
    if (!books?.length) return;
    const lib = loadLibrary();
    const existingTitles = new Set(lib.recommend.map(r => r.title.toLowerCase()));
    let added = false;
    for (const b of books) {
      if (!b.title || existingTitles.has(b.title.toLowerCase())) continue;
      lib.recommend.push({ title: b.title, author: b.author || '', type: 'Book', why: b.reason || '' });
      existingTitles.add(b.title.toLowerCase());
      added = true;
    }
    if (added) { saveLibrary(lib); renderLibrary(); }
  }

  function resetForm() {
    document.getElementById('results').style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    document.getElementById('callNotes').value = '';
    document.getElementById('prospect').value = '';
    document.getElementById('contactTitle').value = '';
    document.getElementById('callDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('historyContextHint').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Radar canvas ──
  let _radarRaf = null;
  function startRadar() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 70, cy = 70, r = 64;
    // SIREN cyan
    const G  = 'rgba(0,200,255,';
    const OR = 'rgba(232,160,32,';
    let angle = 0;
    // Static blip positions (polar)
    const blips = [
      { a: 0.9, d: 0.42, c: G },
      { a: 2.3, d: 0.67, c: G },
      { a: 4.1, d: 0.31, c: 'rgba(0,230,160,' }, // accent green blip
    ];

    function draw() {
      ctx.clearRect(0, 0, 140, 140);
      // concentric rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * i / 4, 0, Math.PI * 2);
        ctx.strokeStyle = G + (0.07 + i * 0.04) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // crosshair
      ctx.strokeStyle = G + '0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      // diagonal guides
      const d = r * 0.707;
      ctx.strokeStyle = G + '0.07)';
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
      // sweep
      const grad = ctx.createConicalGradient ? null : null;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const sg = ctx.createLinearGradient(0, 0, r, 0);
      sg.addColorStop(0,   'rgba(0,200,255,0)');
      sg.addColorStop(0.5, 'rgba(0,200,255,0.18)');
      sg.addColorStop(1,   'rgba(0,200,255,0.55)');
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.55, 0);
      ctx.closePath();
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.restore();
      // blips — show near sweep arm
      blips.forEach(b => {
        const diff = ((b.a - angle) + Math.PI * 2) % (Math.PI * 2);
        const alpha = diff < 1.2 ? Math.max(0, 1 - diff * 0.85) : 0;
        if (alpha <= 0) return;
        const bx = cx + Math.cos(b.a) * r * b.d;
        const by = cy + Math.sin(b.a) * r * b.d;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = b.c + alpha * 0.85 + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.strokeStyle = b.c + alpha * 0.3 + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      // center dot pulse
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,200,255,' + pulse + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,200,255,' + (pulse * 0.35) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      angle = (angle + 0.025) % (Math.PI * 2);
      _radarRaf = requestAnimationFrame(draw);
    }
    draw();
  }
  function stopRadar() {
    if (_radarRaf) { cancelAnimationFrame(_radarRaf); _radarRaf = null; }
  }

  // Maps stream progress % to which of the 4 steps should be complete
  // Step thresholds: 0→done@25%, 1→done@50%, 2→done@75%, 3→done@95%
  const STEP_THRESHOLDS = [25, 50, 75, 95];

  // Markers matched against accumulated streaming JSON text
  const STREAM_PHASES = [
    { marker: '"dimensions"',          pct: 10 },
    { marker: '"Discovery & needs',    pct: 18 },
    { marker: '"Value framing',        pct: 28 },
    { marker: '"Tactical empathy',     pct: 40 },
    { marker: '"Qualification',        pct: 51 },
    { marker: '"Call control',         pct: 60 },
    { marker: '"total"',               pct: 66 },
    { marker: '"call_summary"',        pct: 73 },
    { marker: '"recommended_books"',   pct: 79 },
    { marker: '"rep_scores"',          pct: 86 },
    { marker: '"spiced"',              pct: 93 },
  ];

  function updateStreamProgress(text) {
    let pct = 4;
    for (const phase of STREAM_PHASES) {
      if (text.includes(phase.marker)) pct = phase.pct;
    }
    for (let i = 0; i < 4; i++) {
      const el   = document.getElementById('lstep-' + i);
      const icon = document.getElementById('lstep-icon-' + i);
      const bar  = document.getElementById('lstep-bar-' + i);
      if (!el) continue;
      const done   = pct >= STEP_THRESHOLDS[i];
      const active = !done && pct >= (i === 0 ? 0 : STEP_THRESHOLDS[i - 1]);
      // 'visible' must always be present for opacity transitions to work
      el.classList.add('visible');
      el.classList.toggle('done',   done);
      el.classList.toggle('active', active);
      if (icon) icon.textContent = done ? '✓' : '○';
      if (bar) {
        if (done) {
          bar.style.width = '100%';
        } else if (active) {
          const prev = i === 0 ? 0 : STEP_THRESHOLDS[i - 1];
          const span = STEP_THRESHOLDS[i] - prev;
          bar.style.width = Math.min(99, ((pct - prev) / span) * 100) + '%';
        }
      }
    }
  }

  function setLoading(on, prospect, stage) {
    const el = document.getElementById('loading');
    document.getElementById('submitBtn').disabled = on;
    if (on) {
      el.style.display = 'flex';
      const parts = [prospect, stage].filter(Boolean);
      const ctx = (parts.length ? parts.join(' // ') : 'ENGAGEMENT').toUpperCase();
      document.getElementById('loadContext').textContent = ctx;
      // Reset all steps to hidden baseline — clear any inline styles from prior run
      for (let i = 0; i < 4; i++) {
        const s  = document.getElementById('lstep-' + i);
        const ic = document.getElementById('lstep-icon-' + i);
        const b  = document.getElementById('lstep-bar-' + i);
        if (s)  {
          s.style.opacity = '';
          s.style.transform = '';
          s.classList.remove('visible', 'active', 'done');
        }
        if (ic) ic.textContent = '○';
        if (b)  b.style.width = '0%';
      }
      // Stagger steps into view — adding only 'visible' so CSS transition fires cleanly
      // Step 0 also gets 'active' immediately so something is lit up before first stream data
      for (let i = 0; i < 4; i++) {
        const s = document.getElementById('lstep-' + i);
        if (!s) continue;
        setTimeout(() => {
          s.classList.add('visible');
          if (i === 0) s.classList.add('active');
        }, i * 300);
      }
      startRadar();
    } else {
      stopRadar();
      // Flash all steps to done then hide
      for (let i = 0; i < 4; i++) {
        const s  = document.getElementById('lstep-' + i);
        const ic = document.getElementById('lstep-icon-' + i);
        if (s)  { s.classList.remove('active'); s.classList.add('visible', 'done'); }
        if (ic) ic.textContent = '✓';
      }
      setTimeout(() => { el.style.display = 'none'; }, 450);
    }
  }

  function showError(msg) {
    const el = document.getElementById('errorBox');
    el.textContent = 'Error: ' + msg;
    el.style.display = 'block';
  }

  function clearError() {
    document.getElementById('errorBox').textContent = '';
    document.getElementById('errorBox').style.display = 'none';
  }

  // ── Usage bar ──────────────────────────────────────────────
  const PRICE_IN = 3 / 1_000_000, PRICE_OUT = 15 / 1_000_000;
  let sessionCost = 0;

  function loadAllTime() { return { ..._usageCache }; }
  function saveAllTime(d) {
    _usageCache = d;
    try { localStorage.setItem('oa_usage', JSON.stringify(d)); } catch {}
    _dbSaveUsage(d);
  }
  function loadToggles() {
    try { return JSON.parse(localStorage.getItem('oa_toggles') || '{"tokens":true,"cost-call":true,"cost-session":true,"cost-alltime":true}'); }
    catch { return { tokens: true, 'cost-call': true, 'cost-session': true, 'cost-alltime': true }; }
  }
  function saveToggles(t) { try { localStorage.setItem('oa_toggles', JSON.stringify(t)); } catch {} }

  let metricToggles = loadToggles();

  function applyToggles() {
    ['tokens','cost-call','cost-session','cost-alltime'].forEach(k => {
      document.getElementById('metric-' + k)?.classList.toggle('disabled', !metricToggles[k]);
      document.getElementById('toggle-' + k)?.classList.toggle('on', metricToggles[k]);
    });
  }

  function toggleMetric(key, e) {
    e.stopPropagation();
    metricToggles[key] = !metricToggles[key];
    saveToggles(metricToggles);
    applyToggles();
  }

  function toggleUsage() {
    const body = document.getElementById('usageBody');
    const chevron = document.getElementById('usageChevron');
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    chevron.classList.toggle('open', open);
    try { localStorage.setItem('oa_usage_open', open); } catch {}
  }

  function updateUsageUI(inputTokens, outputTokens) {
    const callCost = inputTokens * PRICE_IN + outputTokens * PRICE_OUT;
    sessionCost += callCost;
    const allTime = loadAllTime();
    allTime.cost += callCost;
    allTime.calls += 1;
    saveAllTime(allTime);

    document.getElementById('val-tokens').textContent = (inputTokens + outputTokens).toLocaleString();
    document.getElementById('val-cost-call').textContent = '$' + callCost.toFixed(4);
    const _setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _setText('val-cost-session', '$' + sessionCost.toFixed(4));
    _setText('val-cost-alltime', '$' + allTime.cost.toFixed(2));
    _setText('sub-alltime', allTime.calls + ' call' + (allTime.calls !== 1 ? 's' : '') + ' graded');
    document.getElementById('lastCallLabel').textContent = 'Last call: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('usageDot').style.background = '#00c8ff';

    const body = document.getElementById('usageBody');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      document.getElementById('usageChevron').classList.add('open');
    }
  }

  function resetAllTime() {
    if (!confirm('Reset all-time totals? This cannot be undone.')) return;
    saveAllTime({ cost: 0, calls: 0 });
    const _st = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _st('val-cost-alltime', '$0.00');
    _st('sub-alltime', '0 calls graded');
  }

  function initUsageBar() {
    const allTime = loadAllTime();
    const _si = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _si('val-cost-alltime', '$' + allTime.cost.toFixed(2));
    _si('sub-alltime', allTime.calls + ' call' + (allTime.calls !== 1 ? 's' : '') + ' graded');
    applyToggles();
    try {
      if (localStorage.getItem('oa_usage_open') !== 'false') {
        document.getElementById('usageBody').style.display = 'block';
        document.getElementById('usageChevron').classList.add('open');
      }
    } catch {}
  }

  // ── Sample transcript ──────────────────────────────────────
  const SAMPLE_TRANSCRIPT = `Michael Darlan (0:12): Good afternoon Jason, can you hear me alright?
Jason Pruitt (0:15): Yeah, loud and clear. How are you?
Michael Darlan (0:17): Doing great, thanks for making time. I know you mentioned you had a hard stop at 2, so I want to make sure we use your time well today.
Jason Pruitt (0:25): Yeah, appreciate that.
Michael Darlan (0:27): So last time we spoke, you mentioned your team was stretched thin and you were having some frustration with the alert volume coming out of your current setup. Has anything changed since then, or is that still the main pain point?
Jason Pruitt (0:41): No, that's still very much the situation. If anything it's gotten worse. We had an incident two weeks ago where one of our analysts missed an alert because it got buried. Nothing came of it, but it was a wake-up call.
Michael Darlan (0:57): That sounds stressful. What did that incident end up looking like on your end — was it a weekend situation?
Jason Pruitt (1:04): Saturday morning. Our on-call guy saw it about four hours after it fired.
Michael Darlan (1:09): Four hours. So in that window, what was your exposure like — was the endpoint still connected to the network?
Jason Pruitt (1:17): Yeah, it was. We got lucky. The behavior turned out to be a false positive from a software update our vendor pushed without telling us, but we didn't know that for hours.
Michael Darlan (1:29): Got it. And that's exactly the scenario that keeps IT directors up at night — not knowing whether it's real or not, and not having anyone in your corner at 7am on a Saturday to make that call for you.
Jason Pruitt (1:40): Exactly. I've got three people on my security team. None of them want to be on call every weekend.
Michael Darlan (1:47): Totally understandable. So when you think about solving that, is the priority getting someone to own the 24/7 triage, or is it more about reducing the noise so the alerts that do come through actually mean something?
Jason Pruitt (2:01): Both, honestly. But if I had to pick one, it's the triage. I need to know that if something fires at 3am, a human is looking at it — not just an automated playbook.
Michael Darlan (2:13): That makes sense. Let me show you how we approach that, because it speaks directly to what you just described.
Michael Darlan (2:19): So what we do at OneAxiom is operate a 24/7 US-based SOC — these are human analysts, not bots — who are monitoring your environment around the clock. Every alert that comes through gets validated by a person before anything reaches you. So you're not getting woken up at 3am for a false positive from a vendor update.
Jason Pruitt (2:41): Okay. And what's the response time when something does fire?
Michael Darlan (2:46): For a confirmed threat, our analysts are engaging within minutes. And here's the part that I think is relevant to your Saturday situation — we work with you upfront to build out playbooks. So we define together: for this type of threat, at this time of day, here's what action we take. Isolation, containment, account lockout — whatever makes sense for your environment. Your team gets notified, but the action is already being taken.
Jason Pruitt (3:12): So you're not just alerting me, you're actually doing something about it.
Michael Darlan (3:16): Right. We act as an extension of your team. You still have full visibility into everything we do — you can log into the platform anytime and see exactly what actions were taken and why — but you don't have to be the one pulling the trigger at 3am on a Saturday.
Jason Pruitt (3:32): That's appealing. What EDR platform do you use?
Michael Darlan (3:36): We work with both CrowdStrike Falcon and SentinelOne. Do you have a preference, or are you currently on one of those?
Jason Pruitt (3:43): We've got CrowdStrike right now through our current MSSP, but I'm not married to it. Honestly if SentinelOne is better for your platform I'm open to a conversation.
Michael Darlan (3:55): Good to know. Either works well for us — we'd just take over management of whichever you go with. So if you want to stay on CrowdStrike, we assume that contract and manage the tenant. No redeployment of agents, no disruption to your environment.
Jason Pruitt (4:10): That's actually a big deal for me. Last time we switched tools it was a nightmare.
Andie Prandini (4:16): Jason, what does your current MSSP contract situation look like — are you locked in or coming up on renewal?
Jason Pruitt (4:23): We're about 60 days out from renewal. That's honestly why I'm taking these calls now.
Andie Prandini (4:30): Perfect timing then. And just so we can be thorough — how many endpoints are we talking about?
Jason Pruitt (4:36): We're at about 320 endpoints, 280 named users.
Andie Prandini (4:41): Got it. And is it just EDR you're looking to replace, or are there other gaps you're trying to fill at the same time?
Jason Pruitt (4:49): Honestly, I've been meaning to get a security awareness training program in place for two years. We keep pushing it back. And I know our vulnerability scanning is basically nonexistent right now — we run a scan quarterly and that's it.
Michael Darlan (5:04): So that's actually a great segue, because our platform bundles all three — managed EDR, security awareness training through KnowBe4, and continuous vulnerability management through SecPod. So instead of going to three different vendors and managing three different contracts, it's all under one roof.
Jason Pruitt (5:24): How does that affect pricing?
Michael Darlan (5:27): It's typically more cost-effective than buying them separately, and more importantly it eliminates the integration headache. One dashboard, one point of contact, one contract. For a three-person security team that's meaningful.
Jason Pruitt (5:42): Yeah, my team would appreciate that. Vendor sprawl is a real problem for us.
Michael Darlan (5:48): It's one of the most common things we hear. You end up spending more time managing vendors than managing security.
Jason Pruitt (5:55): Exactly. Okay, so what does pricing look like for what you've described?
Michael Darlan (6:00): I want to get you accurate numbers rather than a ballpark that turns out to be wrong, so let me put together a formal quote based on your 320 endpoints and 280 users. I can have that to you by end of day tomorrow. What I can tell you is that for a company your size, the bundle comes out significantly cheaper than running separate contracts for each piece.
Jason Pruitt (6:22): That works. I'll also say — we're looking at two other vendors right now. One of them I'm pretty lukewarm on, but the other one is solid. So you're not the only one in the running.
Michael Darlan (6:35): I appreciate you being straight with us. Can I ask — what's making you lukewarm on the one, and what does the other one do well? That helps me make sure we're addressing the right things in the proposal.
Jason Pruitt (6:47): The one I'm lukewarm on just feels like a big company that won't care about us once the contract is signed. The other one has good technology but their SOC is offshore and I'm not sure how I feel about that.
Michael Darlan (7:02): That's really helpful. On the offshore SOC point — ours is US-based, fully domestic analysts. And on the big company feeling — we're intentionally mid-market focused, which means your account actually matters to us. You'll have named analysts who know your environment, not a different person every time you call.
Jason Pruitt (7:22): Named analysts — is that actually the case or is that a sales thing?
Michael Darlan (7:27): It's actually the case. You get a dedicated analyst team assigned to your account. They learn your environment over time — they know what normal looks like for you, which is how we reduce false positive noise. I can put you in touch with a current customer at a similar size if that would help.
Jason Pruitt (7:44): Yeah, a reference would actually go a long way. Can you do that?
Andie Prandini (7:48): Absolutely, we can set that up. I'll coordinate on our end and get you a name and number by tomorrow along with the quote.
Jason Pruitt (7:56): Perfect. I think I've got what I need for now. Send the quote and the reference and let's reconnect next week.
Andie Prandini (8:02): Sounds great. Same time next week work for you — say Tuesday at 1pm?
Jason Pruitt (8:08): Tuesday at 1 works.
Michael Darlan (8:10): Perfect. Jason, thanks for your time today. We'll get you that quote and reference tomorrow, and we'll talk Tuesday.
Jason Pruitt (8:16): Sounds good. Talk then.`;

  const callNotesEl = document.getElementById('callNotes');
  callNotesEl.value = SAMPLE_TRANSCRIPT;
  callNotesEl.addEventListener('focus', function onFocus() {
    if (callNotesEl.value === SAMPLE_TRANSCRIPT) callNotesEl.value = '';
    callNotesEl.removeEventListener('focus', onFocus);
  });

  // ── Reference documents ────────────────────────────────────
  const DOC_CHAR_LIMIT = 10000;

  function loadDocs() {
    try { return JSON.parse(localStorage.getItem('oa_docs') || '[]'); } catch { return []; }
  }
  function saveDocs(d) { try { localStorage.setItem('oa_docs', JSON.stringify(d)); } catch {} }

  function renderDocList() {
    const docs = loadDocs();
    const el = document.getElementById('docList');
    if (!el) return;
    el.innerHTML = docs.length
      ? docs.map((d, i) => `
          <div class="doc-item">
            <div class="doc-item-info">
              <span class="doc-item-name" title="${escHtml(d.name)}">${escHtml(d.name)}</span>
              <span class="doc-item-meta">${d.pages} page${d.pages !== 1 ? 's' : ''} · ${d.chars.toLocaleString()} chars extracted</span>
              ${d.truncated ? `<span class="doc-item-warn">Truncated to ${DOC_CHAR_LIMIT.toLocaleString()} chars for prompt injection</span>` : ''}
            </div>
            <button class="member-remove" onclick="removeDoc(${i})">Remove</button>
          </div>`).join('')
      : '';
  }

  function removeDoc(idx) {
    const docs = loadDocs();
    docs.splice(idx, 1);
    saveDocs(docs);
    renderDocList();
  }

  async function extractPdfText(file) {
    // Dynamically import PDF.js as an ES module
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map(i => i.str).join(' ') + '\n';
    }
    return { text: text.trim(), pages: pdf.numPages };
  }

  async function processFiles(files) {
    const progress = document.getElementById('uploadProgress');
    progress.style.display = 'block';
    const docs = loadDocs();

    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      progress.textContent = `Extracting: ${file.name}…`;
      try {
        const { text, pages } = await extractPdfText(file);
        const truncated = text.length > DOC_CHAR_LIMIT;
        const excerpt = truncated ? text.slice(0, DOC_CHAR_LIMIT) : text;
        docs.push({ name: file.name, pages, chars: text.length, truncated, excerpt });
      } catch (err) {
        console.error('PDF extraction failed for', file.name, err);
        progress.textContent = `Failed to read ${file.name} — is it a valid PDF?`;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    saveDocs(docs);
    renderDocList();
    progress.style.display = 'none';
    document.getElementById('pdfInput').value = '';
  }

  function onFileSelect(e) { processFiles(Array.from(e.target.files)); }
  function onDragOver(e) { e.preventDefault(); document.getElementById('uploadArea').classList.add('drag-over'); }
  function onDragLeave() { document.getElementById('uploadArea').classList.remove('drag-over'); }
  function onDrop(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('drag-over');
    processFiles(Array.from(e.dataTransfer.files));
  }

  function buildDocsPrompt() {
    const docs = loadDocs();
    if (!docs.length) return '';
    const sections = docs.map(d => `--- ${d.name} ---\n${d.excerpt}`).join('\n\n');
    return `\n\nReference documents (use as additional context where relevant):\n${sections}`;
  }
  // ── End reference documents ────────────────────────────────

  // ── History ────────────────────────────────────────────────
  function loadHistory() {
    try {
      const data = JSON.parse(localStorage.getItem('oa_history') || '[]');
      data.forEach(h => { if (typeof h.total === 'number' && h.total > 0) h.letter_grade = scoreToGrade(h.total); });
      return data;
    } catch { return []; }
  }
  function saveHistoryData(h) { try { localStorage.setItem('oa_history', JSON.stringify(h)); } catch(e) { console.error('[saveHistoryData] failed:', e.message, '— records:', h.length); } }

  function saveToHistory(r, prospect, contactTitle, rep, callDate, resultsHtml) {
    const history = loadHistory();
    history.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      callDate: callDate || '',
      rep: rep ? rep.name : '',
      repRole: rep ? rep.role : '',
      prospect: prospect || '',
      contactTitle: contactTitle || '',
      stage: selectedStage,
      total: r.total,
      letter_grade: r.letter_grade,
      grade_label: r.grade_label || '',
      top_strength: r.top_strength || '',
      top_priority: r.top_priority || '',
      resultsHtml
    });
    if (history.length > 50) history.splice(50);
    saveHistoryData(history);
  }

  // Sort state: 'company' | 'date' | 'score' | 'stage'  +  direction per key
  const histSortDir = { date: -1, score: -1, stage: 1 }; // -1=desc, 1=asc
  let histSort = 'company';

  function setHistSort(key) {
    if (key !== 'company' && key === histSort) {
      histSortDir[key] *= -1; // toggle direction on repeat click
    }
    histSort = key;
    // Update button states
    ['company','date','score','stage'].forEach(k => {
      document.getElementById('hsort-' + k)?.classList.toggle('active', k === key);
    });
    // Update arrows for sortable keys
    ['date','score','stage'].forEach(k => {
      const arrow = document.getElementById('hsort-' + k + '-arrow');
      if (arrow) arrow.textContent = histSortDir[k] === -1 ? '↓' : '↑';
    });
    renderHistory();
  }

  function histEntryDate(h) {
    return h.callDate || h.ts.slice(0, 10);
  }

  function buildHistCard(h, showCompany) {
    const displayDate = h.callDate
      ? new Date(h.callDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : new Date(h.ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const bannerBg = getBannerColor(h.letter_grade);
    // Wrap score-view blocks in a collapsible section; keep everything else visible
    const strippedReset = (h.resultsHtml || '').replace(/<button class="reset-btn"[\s\S]*?<\/button>/, '');
    const scoreMatch = strippedReset.match(/([\s\S]*?)(<div class="(?:rep-toggle|score-view)[\s\S]*?)((?:<div class="section-head[^>]*>(?:Call highlights|Recommended|SPICED)[\s\S]*)?)$/);
    let bodyHtml;
    if (scoreMatch) {
      const before = scoreMatch[1];   // banner
      const scores = scoreMatch[2];   // rep-toggle + score-view blocks
      const after  = scoreMatch[3] || ''; // highlights, books, spiced
      bodyHtml = `${before}
        <div class="hist-scores-toggle" onclick="toggleHistScores(${h.id},event)">
          <span class="hist-scores-toggle-label">Scoring Details</span>
          <span class="hist-scores-toggle-chev" id="hist-sc-chev-${h.id}">&#9660;</span>
        </div>
        <div class="hist-scores-body" id="hist-sc-body-${h.id}">${scores}</div>
        ${after}`;
    } else {
      bodyHtml = strippedReset;
    }
    const titleLine = showCompany && h.prospect
      ? `${escHtml(h.prospect)} — ${escHtml(h.stage || 'Unknown stage')}`
      : escHtml(h.stage || 'Unknown stage');
    const metaParts = [showCompany ? null : null, h.rep, h.repRole, h.contactTitle].filter(Boolean);
    return `<div class="hist-card" id="hist-${h.id}">
      <div class="hist-card-header" onclick="toggleHistCard(${h.id})">
        <div class="hist-grade-badge" style="background:${bannerBg};">${escHtml(h.letter_grade)} ${escHtml(String(h.total))}</div>
        <div class="hist-card-center">
          <div class="hist-card-title">${titleLine}</div>
          ${metaParts.length ? `<div class="hist-card-meta">${escHtml(metaParts.join(' · '))}</div>` : ''}
        </div>
        <div class="hist-card-right">
          <span class="hist-card-date">${escHtml(displayDate)}</span>
          <span class="hist-card-chevron" id="hist-chev-${h.id}">&#9660;</span>
        </div>
      </div>
      <div class="hist-card-body" id="hist-body-${h.id}">
        ${bodyHtml}
        <div style="display:flex;justify-content:flex-end;margin-top:1rem;border-top:1px solid var(--siren-border);padding-top:12px;">
          <button class="hist-delete-btn" onclick="deleteHistEntry(${h.id},event)">Delete this entry</button>
        </div>
      </div>
    </div>`;
  }

  function renderHistory() {
    const history = loadHistory();
    const el = document.getElementById('historyList');
    if (!el) return;
    if (!history.length) {
      el.innerHTML = '<div class="hist-empty">No graded calls yet. Grade a call on the Grader page and it will appear here.</div>';
      return;
    }

    if (histSort === 'company') {
      // Grouped by company
      const groups = {};
      history.forEach(h => {
        const key = (h.prospect || '').trim() || '(No company)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(h);
      });
      el.innerHTML = Object.entries(groups).map(([company, entries]) => {
        const stages   = [...new Set(entries.map(h => h.stage).filter(Boolean))];
        const repNames = [...new Set(entries.map(h => h.rep).filter(Boolean))];
        const avgScore = Math.round(entries.reduce((s, h) => s + (h.total || 0), 0) / entries.length);
        const groupId  = 'grp-' + company.replace(/\W+/g, '_');
        return `<div style="margin-bottom:1.5rem;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;cursor:pointer;" onclick="toggleGroupCards('${groupId}')">
            <div>
              <span style="font-size:16px;font-weight:700;color:var(--siren-cyan-90);">${escHtml(company)}</span>
              <span style="font-size:12px;color:var(--siren-text-faint);margin-left:10px;">${entries.length} transcript${entries.length !== 1 ? 's' : ''} · avg score ${avgScore}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
              ${stages.map(s => `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:2px 7px;border-radius:4px;background:var(--siren-bg-card-raised);color:var(--siren-text-muted);">${escHtml(s)}</span>`).join('')}
              ${repNames.length ? `<span style="font-size:11px;color:var(--siren-text-faint);">${escHtml(repNames.join(', '))}</span>` : ''}
            </div>
          </div>
          <div id="${groupId}">${entries.map(h => buildHistCard(h, false)).join('')}</div>
        </div>`;
      }).join('');
      return;
    }

    // Flat sorted views
    const sorted = [...history].sort((a, b) => {
      if (histSort === 'date') {
        const da = histEntryDate(a), db = histEntryDate(b);
        return (da < db ? -1 : da > db ? 1 : 0) * histSortDir.date;
      }
      if (histSort === 'score') {
        return ((a.total || 0) - (b.total || 0)) * histSortDir.score;
      }
      if (histSort === 'stage') {
        return (a.stage || '').localeCompare(b.stage || '') * histSortDir.stage;
      }
      return 0;
    });

    // For stage sort, add section headers when the stage changes
    if (histSort === 'stage') {
      let lastStage = null;
      el.innerHTML = sorted.map(h => {
        const stage = h.stage || 'Unknown';
        const header = stage !== lastStage
          ? `<div style="font-size:11px;font-weight:700;color:var(--siren-text-faint);text-transform:uppercase;letter-spacing:0.07em;margin:1.25rem 0 8px;">${escHtml(stage)}</div>`
          : '';
        lastStage = stage;
        return header + buildHistCard(h, true);
      }).join('');
    } else {
      el.innerHTML = sorted.map(h => buildHistCard(h, true)).join('');
    }
  }

  function toggleHistCard(id) {
    const body = document.getElementById('hist-body-' + id);
    const chev = document.getElementById('hist-chev-' + id);
    const open = body.style.display !== 'block';
    body.style.display = open ? 'block' : 'none';
    chev.classList.toggle('open', open);
  }

  function toggleHistScores(id, e) {
    e.stopPropagation();
    const body = document.getElementById('hist-sc-body-' + id);
    const chev = document.getElementById('hist-sc-chev-' + id);
    if (!body) return;
    const open = body.classList.toggle('open');
    if (chev) chev.classList.toggle('open', open);
  }

  function toggleGroupCards(groupId) {
    const el = document.getElementById(groupId);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
  }

  function deleteHistEntry(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this history entry?')) return;
    saveHistoryData(loadHistory().filter(h => h.id !== id));
    renderHistory();
  }

  function clearHistory() {
    if (!confirm('Clear all call history? This cannot be undone.')) return;
    saveHistoryData([]);
    renderHistory();
  }

  // ── Deal Lifecycle ─────────────────────────────────────────
  // ── Graph state ──
  let _lcT              = { x: 0, y: 0, s: 1 };
  let _lcPan            = null;
  let _lcNodes          = [];
  let _lcEdges          = [];
  let _lcSelId          = null;
  let _lcCallsCollapsed = false;
  let _lcAllEntries     = [];   // full entry list, preserved across collapse
  let _lcCompany        = '';

  const NODE_DEFS = {
    account:       { color: '#061824', ring: '#00c8ff', r: 40, label: 'ACCOUNT' },
    call:          { color: '#061824', ring: '#00c8ff', r: 30, label: 'CALL' },
    'calls-summary': { color: '#061824', ring: '#00c8ff', r: 38, label: 'ALL CALLS' },
    contact:       { color: '#1f1510', ring: '#e8a020', r: 26, label: 'CONTACT',     ph: true },
    champion:      { color: '#061824', ring: '#00c8ff', r: 26, label: 'CHAMPION',    ph: true },
    opportunity:   { color: '#081428', ring: '#4a9eff', r: 26, label: 'OPPORTUNITY', ph: true },
    competitor:    { color: '#200a0a', ring: '#e05050', r: 26, label: 'COMPETITOR',  ph: true },
    techstack:     { color: '#130d20', ring: '#9b59b6', r: 26, label: 'TECH STACK',  ph: true },
    stakeholder:   { color: '#1f1510', ring: '#e8a020', r: 26, label: 'STAKEHOLDER', ph: true },
  };

  const PH_SYMBOLS = { opportunity:'◆', champion:'★', contact:'◉', competitor:'✕', techstack:'⬡', stakeholder:'◈' };

  function getLcCompanies() {
    const seen = new Set(), out = [];
    for (const h of loadHistory()) {
      const name = (h.prospect || '').trim();
      if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); out.push(name); }
    }
    return out.sort((a,b) => a.localeCompare(b));
  }

  // ── PULSE Dashboard ────────────────────────────────────────
  function renderPulse() {
    const history = loadHistory();
    const allTime = loadAllTime();

    // ── KPIs ──
    const total = history.length;
    const now = new Date();
    // Use callDate when set, fall back to grading timestamp
    const callDateOf = h => h.callDate ? new Date(h.callDate + 'T12:00:00') : new Date(h.ts);
    const weekAgo        = new Date(now - 7 * 86400000);
    const calMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisWeek  = history.filter(h => callDateOf(h) >= weekAgo).length;
    const scores    = history.map(h => h.total).filter(s => s > 0);
    const avgNow    = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const lastMonthScores = history.filter(h => { const d=callDateOf(h); return d >= prevMonthStart && d < calMonthStart; }).map(h=>h.total).filter(s=>s>0);
    const avgLast   = lastMonthScores.length ? Math.round(lastMonthScores.reduce((a,b)=>a+b,0)/lastMonthScores.length) : null;
    const avgDelta  = (avgNow !== null && avgLast !== null) ? avgNow - avgLast : null;

    const thisMonth = history.filter(h => callDateOf(h) >= calMonthStart);
    const gradeCounts = {};
    thisMonth.forEach(h => { gradeCounts[h.letter_grade] = (gradeCounts[h.letter_grade]||0)+1; });
    const topGrade = Object.entries(gradeCounts).sort((a,b)=>b[1]-a[1])[0];

    document.getElementById('pkv-calls').textContent = total || '0';
    document.getElementById('pks-calls').textContent = thisWeek ? `↑ ${thisWeek} this week` : 'no calls this week';
    document.getElementById('pkv-avg').textContent = avgNow !== null ? avgNow : '—';
    const avgSubEl = document.getElementById('pks-avg');
    if (avgDelta !== null) {
      avgSubEl.textContent = (avgDelta >= 0 ? '↑' : '↓') + ' ' + Math.abs(avgDelta) + ' pts vs last month';
      avgSubEl.className = 'pulse-kpi-sub' + (avgDelta < 0 ? ' down' : '');
    } else { avgSubEl.textContent = avgNow !== null ? 'no prior baseline' : 'no data yet'; avgSubEl.className='pulse-kpi-sub neutral'; }
    document.getElementById('pkv-grade').textContent = topGrade ? topGrade[0] : '—';
    document.getElementById('pks-grade').textContent = topGrade ? `${topGrade[1]} call${topGrade[1]!==1?'s':''} this month` : 'no calls this month';
    // (API Cost tile removed from PULSE)

    // ── Score Trend (last 8 calls) ──
    const trendPeriod = parseInt(document.getElementById('trendPeriodSel')?.value ?? '10');
    let trendData;
    if (trendPeriod <= 20) {
      // call-count mode
      trendData = history.slice(0, trendPeriod).reverse();
    } else {
      // day-range mode
      const cutoffMs = trendPeriod > 0 ? Date.now() - trendPeriod * 86400000 : 0;
      trendData = history.filter(h => {
        const ms = h.callDate ? new Date(h.callDate).getTime() : new Date(h.ts).getTime();
        return cutoffMs === 0 || ms >= cutoffMs;
      }).reverse();
    }
    drawPulseTrend(trendData);

    // ── Rep Score Trendlines ──
    drawRepTrends(history);

    // ── Recent Calls ──
    const recentEl = document.getElementById('pulseRecentCalls');
    const recent = history.slice(0, 6);
    if (recent.length) {
      recentEl.innerHTML = recent.map(h => {
        const bg = getBannerColor(h.letter_grade);
        const ds = h.callDate
          ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'})
          : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric'});
        const meta = [h.rep ? h.rep.split(' ')[0]+(h.rep.split(' ')[1]?' '+h.rep.split(' ')[1][0]+'.':'') : null, stageAbbrev(h.stage||''), ds].filter(Boolean).join(' · ');
        return `<div class="pulse-call-row" onclick="navTo('history')">
          <div class="pulse-call-badge" style="background:${bg};">${escHtml(h.letter_grade)}</div>
          <div class="pulse-call-info">
            <div class="pulse-call-company">${escHtml(h.prospect||'Unknown')}</div>
            <div class="pulse-call-meta">${escHtml(meta)}</div>
          </div>
          <div class="pulse-call-score">${h.total}</div>
        </div>`;
      }).join('');
    } else {
      recentEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.2);padding:1rem 0;">No calls graded yet.</div>';
    }

    // ── ISR/BDR Performance Leaderboard ──
    const team = loadTeam();
    const isrBdrNames = new Set(
      team.filter(m => /ISR|BDR/i.test(m.role)).map(m => m.name.toLowerCase())
    );
    const periodDays = parseInt(document.getElementById('lbPeriodSel')?.value || '90');
    const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;

    const repMap = {};
    history.forEach(h => {
      if (!h.rep) return;
      if (isrBdrNames.size > 0 && !isrBdrNames.has(h.rep.toLowerCase())) return;
      const callMs = h.callDate ? new Date(h.callDate).getTime() : new Date(h.ts).getTime();
      if (cutoff > 0 && callMs < cutoff) return;
      if (!repMap[h.rep]) repMap[h.rep] = { calls: [], initials: h.rep.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() };
      if (h.total > 0) repMap[h.rep].calls.push({ score: h.total, ms: callMs });
    });

    const reps = Object.entries(repMap).map(([name, d]) => {
      const sorted = d.calls.sort((a,b) => a.ms - b.ms);
      const scores = sorted.map(c => c.score);
      const avg = Math.round(scores.reduce((a,b)=>a+b,0) / scores.length);
      // trend: compare first half avg vs second half avg
      const mid = Math.ceil(scores.length / 2);
      const firstHalf = scores.slice(0, mid);
      const secondHalf = scores.slice(mid);
      const firstAvg = firstHalf.reduce((a,b)=>a+b,0) / firstHalf.length;
      const secondAvg = secondHalf.length ? secondHalf.reduce((a,b)=>a+b,0) / secondHalf.length : firstAvg;
      const delta = Math.round(secondAvg - firstAvg);
      return { name, initials: d.initials, avg, calls: scores.length, delta };
    }).filter(r => r.calls > 0).sort((a,b) => b.avg - a.avg);

    const topScore = reps.length ? reps[0].avg : 100;
    const lbEl = document.getElementById('pulseLeaderboard');
    let lbHtml = '';
    if (!reps.length) {
      lbHtml = `<div style="font-size:13px;color:rgba(255,255,255,0.2);padding:.75rem 0;">No ISR/BDR calls in this period.</div>`;
    } else {
      reps.forEach((rep, i) => {
        const barW = Math.round((rep.avg / Math.max(topScore, 1)) * 100);
        const trendClass = rep.delta > 2 ? 'up' : rep.delta < -2 ? 'down' : 'flat';
        const trendLabel = rep.delta > 2 ? `▲${rep.delta}` : rep.delta < -2 ? `▼${Math.abs(rep.delta)}` : '—';
        lbHtml += `<div class="pulse-rep-row">
          <span class="pulse-rep-rank">${i+1}</span>
          <div class="pulse-rep-avatar">${escHtml(rep.initials)}</div>
          <span class="pulse-rep-name" title="${escHtml(rep.name)}">${escHtml(rep.name)}</span>
          <div class="pulse-rep-track"><div class="pulse-rep-fill" style="width:${barW}%;"></div></div>
          <span class="pulse-rep-score">${rep.avg}</span>
          <span class="pulse-rep-trend ${trendClass}">${trendLabel}</span>
        </div>`;
      });
    }
    lbEl.innerHTML = lbHtml;

    // Weakest shared dimension
    const weakDimEl = document.getElementById('pulseWeakDim');
    { const dt={}, dc={};
      history.forEach(h => { if(!h.dimensions||typeof h.dimensions!=='object') return; Object.entries(h.dimensions).forEach(([n,d])=>{ dt[n]=(dt[n]||0)+(d.score||0); dc[n]=(dc[n]||0)+1; }); });
      const allDims = Object.keys(dt).map(k=>({name:k,pct:(dt[k]/dc[k])/100}));
      if (allDims.length) {
        const weakest = [...allDims].sort((a,b) => a.pct - b.pct)[0];
        const weakPct = Math.round(weakest.pct * 100);
        weakDimEl.style.display = 'block';
        weakDimEl.innerHTML = `<div class="pulse-weak-label">Weakest Dimension — Team</div>
          <div class="pulse-weak-name">${escHtml(weakest.name)}</div>
          <div class="pulse-weak-sub">Avg ${weakPct}% · Focus coaching effort here</div>`;
      } else {
        weakDimEl.style.display = 'none';
      }
    }

    // ── VIGIL KPIs ──
    {
      const hist = loadHistory();
      const companyMap = {};
      hist.forEach(h => { const n=(h.prospect||'').trim(); if(n){ if(!companyMap[n]) companyMap[n]=[]; companyMap[n].push(h); } });
      let critical=0, warning=0, clear=0, totalOpen=0;
      Object.entries(companyMap).forEach(([company, calls]) => {
        const sortedCalls = calls.sort((a,b)=>{ const da=a.callDate||a.ts.slice(0,10),db=b.callDate||b.ts.slice(0,10); return da>db?-1:da<db?1:0; });
        let tasks = loadPulseTasks(company);
        // seed without saving (read-only for KPI calc)
        const existingTexts = new Set(tasks.map(t=>t.text.toLowerCase()));
        sortedCalls.forEach(h => { if(Array.isArray(h.next_steps)) h.next_steps.forEach(ns=>{ const txt=ns.trim(); if(txt&&!existingTexts.has(txt.toLowerCase())){ tasks.push({text:txt,done:false}); existingTexts.add(txt.toLowerCase()); } }); });
        const open = tasks.filter(t=>!t.done).length;
        totalOpen += open;
        const score = (sortedCalls[0]||{}).total || 0;
        if (open>0 && score<60) critical++;
        else if (open>0) warning++;
        else clear++;
      });
      const total = critical+warning+clear;
      document.getElementById('pkv-vigil-critical').textContent = critical;
      document.getElementById('pks-vigil-critical').textContent = critical===1?'1 account needs attention':`${critical} accounts need attention`;
      document.getElementById('pkv-vigil-open').textContent = warning;
      document.getElementById('pks-vigil-open').textContent = `${warning} account${warning!==1?'s':''} with open items`;
      document.getElementById('pkv-vigil-clear').textContent = clear;
      document.getElementById('pks-vigil-clear').textContent = `${clear} of ${total} account${total!==1?'s':''} clear`;
      document.getElementById('pkv-vigil-tasks').textContent = totalOpen;
      document.getElementById('pks-vigil-tasks').textContent = `across ${total} account${total!==1?'s':''}`;
    }

    // ── API strip ──
    document.getElementById('pulse-session-cost').textContent = '$' + sessionCost.toFixed(4);
    document.getElementById('pulse-alltime-cost').textContent = '$' + allTime.cost.toFixed(2) + ' · ' + allTime.calls + ' calls';
    const lastTokensEl = document.getElementById('pulse-last-tokens');
    const lastTokensVal = document.getElementById('val-tokens')?.textContent;
    const lastCostVal   = document.getElementById('val-cost-call')?.textContent;
    if (lastTokensVal && lastTokensVal !== '—') {
      lastTokensEl.textContent = lastTokensVal + ' · ' + (lastCostVal||'');
    } else { lastTokensEl.textContent = '—'; }
  }

  // ── PULSE: Account Action Feed (SIEM-style) ──────────────────────────────

  function loadPulseTasks(company) {
    try { return JSON.parse(localStorage.getItem('oa_pulse_tasks')||'{}')[company] || []; }
    catch(e) { return []; }
  }
  function savePulseTasks(company, tasks) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem('oa_pulse_tasks')||'{}'); } catch(e) {}
    all[company] = tasks;
    localStorage.setItem('oa_pulse_tasks', JSON.stringify(all));
  }

  function pulseGetDeliverables(hist) {
    if (!hist || !hist.length) return [];
    const latest = hist[0];
    const score = latest.total || 0;
    const stage = (latest.stage || '').toLowerCase();
    const recs = [{ doc: 'Call Brief', reason: 'Internal summary of findings and coaching notes', priority: 'high' }];
    if (stage.includes('discovery') || stage.includes('qualify'))
      recs.push({ doc: 'Scoping Questionnaire', reason: 'Collect environment details before proposal', priority: 'high' });
    if (stage.includes('demo') || stage.includes('eval')) {
      recs.push({ doc: 'Executive Summary', reason: 'Board-ready deal context and risk indicators', priority: 'high' });
      recs.push({ doc: 'Follow-Up Email', reason: 'Recap demo value and confirm next milestone', priority: 'medium' });
    }
    if (stage.includes('proposal') || stage.includes('close') || stage.includes('negot')) {
      recs.push({ doc: 'Proposal Cover', reason: 'Tailored cover tied to drivers and risk context', priority: 'high' });
      recs.push({ doc: 'Executive Summary', reason: 'Reinforce ROI and urgency for economic buyer', priority: 'medium' });
    }
    if (!recs.find(r=>r.doc==='Follow-Up Email'))
      recs.push({ doc: 'Follow-Up Email', reason: 'Keep momentum and confirm agreed actions', priority: 'medium' });
    if (score < 60)
      recs.push({ doc: 'Coaching Notes', reason: `Score ${score} — rep needs structured feedback this week`, priority: 'high' });
    const seen = new Set();
    return recs.filter(r => { if(seen.has(r.doc)) return false; seen.add(r.doc); return true; });
  }

  function pulseSeedTasks(company, hist) {
    let tasks = loadPulseTasks(company);
    const existingTexts = new Set(tasks.map(t => t.text.toLowerCase()));
    hist.forEach(h => {
      if (Array.isArray(h.next_steps)) {
        h.next_steps.forEach(ns => {
          const txt = ns.trim();
          if (txt && !existingTexts.has(txt.toLowerCase())) {
            tasks.push({ text: txt, done: false, source: h.callDate || h.ts.slice(0,10), ts: Date.now() });
            existingTexts.add(txt.toLowerCase());
          }
        });
      }
    });
    savePulseTasks(company, tasks);
    return tasks;
  }

  function pulseRenderFeed() {
    const feed = document.getElementById('pulseActionFeed');
    if (!feed) return;
    const hist = loadHistory();
    const filter = document.getElementById('pulseFilterSel')?.value || 'all';

    // Build per-company summaries
    const companyMap = {};
    hist.forEach(h => {
      const n = (h.prospect||'').trim();
      if (!n) return;
      if (!companyMap[n]) companyMap[n] = [];
      companyMap[n].push(h);
    });

    const companies = Object.keys(companyMap).sort((a,b)=>a.localeCompare(b));
    if (!companies.length) {
      feed.innerHTML = '<div style="color:rgba(255,255,255,.25);font-size:13px;padding:20px 0;text-align:center;">No accounts found. Grade a call to get started.</div>';
      return;
    }

    // Seed tasks for all companies
    const accountData = companies.map(company => {
      const calls = companyMap[company].sort((a,b)=>{
        const da=a.callDate||a.ts.slice(0,10), db=b.callDate||b.ts.slice(0,10);
        return da>db?-1:da<db?1:0;
      });
      const tasks = pulseSeedTasks(company, calls);
      const open = tasks.filter(t=>!t.done).length;
      const done = tasks.filter(t=>t.done).length;
      const deliverables = pulseGetDeliverables(calls);
      const latest = calls[0];
      const score = latest.total || 0;
      // severity: critical = open tasks + low score; warning = open tasks; clear = all done
      let severity = 'clear';
      if (open > 0 && score < 60) severity = 'critical';
      else if (open > 0) severity = 'warning';
      return { company, tasks, open, done, deliverables, calls, latest, score, severity };
    });

    // Filter
    const filtered = accountData.filter(a => {
      if (filter === 'open') return a.open > 0;
      if (filter === 'done') return a.open === 0;
      return true;
    });

    // Sort: critical → warning → clear, then alpha
    const sevOrder = { critical: 0, warning: 1, clear: 2 };
    filtered.sort((a,b) => sevOrder[a.severity] - sevOrder[b.severity] || a.company.localeCompare(b.company));

    if (!filtered.length) {
      feed.innerHTML = '<div style="color:rgba(255,255,255,.25);font-size:13px;padding:20px 0;text-align:center;">No accounts match the current filter.</div>';
      return;
    }

    const sevColor = { critical: '#ef4444', warning: '#f59e0b', clear: '#22c55e' };
    const sevLabel = { critical: 'ACTION REQUIRED', warning: 'OPEN ITEMS', clear: 'ALL CLEAR' };

    feed.innerHTML = filtered.map(a => {
      const cSafe = a.company.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const stepsHtml = a.tasks.length
        ? a.tasks.map((t,i) => `
          <div class="pulse-feed-step">
            <input type="checkbox" ${t.done?'checked':''} onchange="pulseToggleStep('${cSafe}',${i})" style="margin-top:3px;accent-color:#00c8ff;cursor:pointer;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;color:${t.done?'rgba(255,255,255,.3)':'rgba(255,255,255,.85)'};text-decoration:${t.done?'line-through':'none'};word-break:break-word;">${escHtml(t.text)}</div>
              ${t.source?`<div style="font-size:10px;color:rgba(255,255,255,.25);margin-top:1px;">${escHtml(t.source)}</div>`:''}
            </div>
            <button onclick="pulseDeleteStep('${cSafe}',${i})" style="background:none;border:none;color:rgba(255,255,255,.2);cursor:pointer;font-size:13px;padding:0 2px;" title="Remove">×</button>
          </div>`).join('')
        : '<div style="font-size:12px;color:rgba(255,255,255,.25);padding:6px 0;">No next steps — add one below.</div>';

      const delivHtml = a.deliverables.map(r => {
        const dot = r.priority==='high'?'#ef4444':r.priority==='medium'?'#f59e0b':'#6b7280';
        return `<div class="pulse-deliv-item">
          <div style="width:6px;height:6px;border-radius:50%;background:${dot};margin-top:4px;flex-shrink:0;"></div>
          <div><div style="font-size:12px;font-weight:600;color:rgba(255,255,255,.85);">${escHtml(r.doc)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:1px;">${escHtml(r.reason)}</div></div>
        </div>`;
      }).join('');

      const lastDate = a.latest.callDate || a.latest.ts.slice(0,10);
      const gradeLabel = a.latest.letter_grade ? `${a.latest.letter_grade} · ${a.score}` : `${a.score}`;

      return `<div class="pulse-feed-row" id="pfr-${escHtml(a.company.replace(/\s+/g,'-'))}">
        <div class="pulse-feed-header" onclick="pulseFeedToggle(this)">
          <div class="pulse-feed-severity" style="background:${sevColor[a.severity]};box-shadow:0 0 6px ${sevColor[a.severity]}66;"></div>
          <div class="pulse-feed-company">${escHtml(a.company)}</div>
          <div class="pulse-feed-meta">
            <div class="pulse-feed-counters">
              <span class="pulse-feed-count"><span>${a.open}</span> open</span>
              <span class="pulse-feed-count"><span>${a.done}</span> done</span>
            </div>
            <span style="font-size:11px;color:rgba(255,255,255,.25);">${escHtml(lastDate)} · ${escHtml(gradeLabel)}</span>
            <span class="pulse-feed-tag ${a.severity}">${sevLabel[a.severity]}</span>
            <span class="pulse-feed-chevron">▶</span>
          </div>
        </div>
        <div class="pulse-feed-body">
          <div class="pulse-feed-cols">
            <div>
              <div class="pulse-feed-sub-title">Next Steps</div>
              ${stepsHtml}
              <div class="pulse-feed-add">
                <input type="text" placeholder="Add a next step…" id="padd-${escHtml(a.company.replace(/\s+/g,'-'))}" onkeydown="if(event.key==='Enter')pulseAddStepFor('${cSafe}',this)">
                <button onclick="pulseAddStepFor('${cSafe}',document.getElementById('padd-${escHtml(a.company.replace(/\s+/g,'-'))}'))">Add</button>
              </div>
            </div>
            <div>
              <div class="pulse-feed-sub-title">Recommended Deliverables</div>
              ${delivHtml || '<div style="font-size:12px;color:rgba(255,255,255,.25);">None suggested.</div>'}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function pulseFeedToggle(header) {
    const body = header.nextElementSibling;
    const chev = header.querySelector('.pulse-feed-chevron');
    const open = body.classList.toggle('open');
    if (chev) chev.classList.toggle('open', open);
  }

  function pulseToggleStep(company, idx) {
    const tasks = loadPulseTasks(company);
    if (tasks[idx]) tasks[idx].done = !tasks[idx].done;
    savePulseTasks(company, tasks);
    pulseRenderFeed();
  }

  function pulseDeleteStep(company, idx) {
    const tasks = loadPulseTasks(company);
    tasks.splice(idx, 1);
    savePulseTasks(company, tasks);
    pulseRenderFeed();
  }

  function pulseAddStepFor(company, inp) {
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    const tasks = loadPulseTasks(company);
    tasks.push({ text: txt, done: false, source: '', ts: Date.now() });
    savePulseTasks(company, tasks);
    if (inp) inp.value = '';
    pulseRenderFeed();
  }

  function drawPulseTrend(data) {
    const svg = document.getElementById('pulseTrendSvg');
    if (!svg) return;
    const W=540, H=160, PAD={top:14,right:16,bottom:24,left:32};
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;
    const minY=0, maxY=100;

    if (!data.length) {
      svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.15)" font-family="system-ui">No data yet</text>`;
      return;
    }

    const toX = i => PAD.left + (i / Math.max(data.length-1, 1)) * chartW;
    const toY = v => PAD.top + chartH - ((v - minY) / (maxY - minY)) * chartH;

    // Grid lines
    let gridSvg = '';
    [30, 60, 90].forEach(y => {
      const gy = toY(y);
      gridSvg += `<line x1="${PAD.left}" y1="${gy}" x2="${W-PAD.right}" y2="${gy}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
      gridSvg += `<text x="${PAD.left-6}" y="${gy+4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.2)" font-family="'SF Mono','Fira Code',monospace">${y}</text>`;
    });

    // Points
    const pts = data.map((h,i) => ({ x: toX(i), y: toY(h.total||0), score: h.total }));

    // Area fill path
    const lineD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = lineD + ` L ${pts[pts.length-1].x} ${toY(0)} L ${pts[0].x} ${toY(0)} Z`;

    let content = gridSvg;
    content += `<defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,200,255,0.25)"/><stop offset="100%" stop-color="rgba(0,200,255,0.02)"/></linearGradient></defs>`;
    content += `<path d="${areaD}" fill="url(#trendFill)"/>`;
    content += `<path d="${lineD}" fill="none" stroke="rgba(0,200,255,0.7)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

    // Dots
    pts.forEach((p, i) => {
      const isLast = i === pts.length - 1;
      if (isLast) {
        content += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="rgba(0,200,255,0.2)" stroke="none"/>`;
        content += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00c8ff" stroke="#061824" stroke-width="2"/>`;
        content += `<text x="${p.x}" y="${p.y-12}" text-anchor="middle" font-size="10" font-weight="700" fill="rgba(0,200,255,0.9)" font-family="system-ui">${p.score}</text>`;
      } else {
        content += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="rgba(0,200,255,0.5)" stroke="#061824" stroke-width="1.5"/>`;
      }
    });

    // X-axis date labels (show first, middle, last)
    const showIdx = [0, Math.floor((data.length-1)/2), data.length-1].filter((v,i,a)=>a.indexOf(v)===i);
    showIdx.forEach(i => {
      const h = data[i];
      const ds = h.callDate
        ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'})
        : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric'});
      content += `<text x="${toX(i)}" y="${H-4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.2)" font-family="system-ui">${ds}</text>`;
    });

    svg.innerHTML = content;
  }

  function drawRepTrends(history) {
    const container = document.getElementById('pulseRepTrendRows');
    if (!container) return;

    const trendVal = parseInt(document.getElementById('repTrendPeriodSel')?.value ?? '90');
    const isCallCount = trendVal <= 20;
    const cutoff = (!isCallCount && trendVal > 0) ? Date.now() - trendVal * 86400000 : 0;

    const repMap = {};
    const _teamForTrends = loadTeam();
    const _repRole = name => (_teamForTrends.find(m => (m.name||'').toLowerCase() === (name||'').toLowerCase()) || {}).role || '';
    history.forEach(h => {
      const ms = h.callDate ? new Date(h.callDate).getTime() : new Date(h.ts).getTime();
      if (!isCallCount && cutoff > 0 && ms < cutoff) return;
      const isCold = /cold.outreach/i.test(h.stage || '');
      if (h.rep && h.total) {
        if (isCold && !/\bISR\b|\bBDR\b/i.test(_repRole(h.rep))) return;
        if (!repMap[h.rep]) repMap[h.rep] = [];
        repMap[h.rep].push({ ms, score: h.total, stage: h.stage || '' });
      }
      (h.participants || []).forEach(p => {
        if (!p.name || !p.score) return;
        if (isCold && !/\bISR\b|\bBDR\b/i.test(_repRole(p.name))) return;
        if (!repMap[p.name]) repMap[p.name] = [];
        repMap[p.name].push({ ms, score: p.score, stage: h.stage || '' });
      });
    });

    const reps = Object.entries(repMap)
      .map(([name, calls]) => {
        let sorted = calls.sort((a,b) => a.ms - b.ms);
        if (isCallCount) sorted = sorted.slice(-trendVal); // last N per rep
        return { name, calls: sorted };
      })
      .filter(r => r.calls.length > 0)
      .sort((a,b) => a.name.localeCompare(b.name));

    if (!reps.length) {
      container.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.2);padding:1rem 0;text-align:center;">No calls in this period.</div>';
      return;
    }

    // Shared time domain
    const allMs = reps.flatMap(r => r.calls.map(c => c.ms));
    const minMs = Math.min(...allMs), maxMs = Math.max(...allMs);
    const msRange = maxMs - minMs || 1;
    const fmt = ms => new Date(ms).toLocaleDateString([],{month:'short',day:'numeric'});

    const COLORS = ['#00c8ff','#f59e0b','#a78bfa','#34d399','#f87171','#fb923c','#38bdf8','#e879f9'];
    const ROW_H = 72, PAD = { top: 20, bottom: 10, left: 6, right: 6 };
    const chartH = ROW_H - PAD.top - PAD.bottom;

    // Score colour
    const scoreColor = s => s >= 80 ? '#22c55e' : s >= 65 ? '#00c8ff' : s >= 50 ? '#f59e0b' : '#ef4444';

    const rows = reps.map((rep, ri) => {
      const color = COLORS[ri % COLORS.length];
      const latest = rep.calls[rep.calls.length - 1].score;
      const mid = Math.ceil(rep.calls.length / 2);
      const firstAvg = rep.calls.slice(0, mid).reduce((a,c)=>a+c.score,0) / mid;
      const secondHalf = rep.calls.slice(mid);
      const secondAvg = secondHalf.length ? secondHalf.reduce((a,c)=>a+c.score,0)/secondHalf.length : firstAvg;
      const delta = Math.round(secondAvg - firstAvg);
      const trendColor = delta > 2 ? '#22c55e' : delta < -2 ? '#ef4444' : 'rgba(255,255,255,.25)';
      const trendLabel = delta > 2 ? `▲${delta}` : delta < -2 ? `▼${Math.abs(delta)}` : '—';

      // Build inline SVG sparkline — viewBox width=500
      // Use sequential index for X so same-day calls don't collapse onto one point
      const W = 500;
      const n = rep.calls.length;
      const toX = i => PAD.left + (n <= 1 ? (W - PAD.left - PAD.right) / 2 : (i / (n - 1)) * (W - PAD.left - PAD.right));
      const toY = v  => PAD.top + chartH - (Math.max(0, Math.min(100, v)) / 100) * chartH;

      const pts = rep.calls.map((c, i) => ({ x: toX(i), y: toY(c.score), score: c.score, ms: c.ms }));

      let sparkContent = '';
      // Faint score bands
      [40,60,80].forEach(band => {
        const by = toY(band);
        sparkContent += `<line x1="${PAD.left}" y1="${by}" x2="${W-PAD.right}" y2="${by}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
      });

      if (pts.length === 1) {
        sparkContent += `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="5" fill="${color}" stroke="#061824" stroke-width="1.5"/>`;
      } else {
        const lineD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        // Area fill
        const areaD = lineD + ` L ${pts[pts.length-1].x.toFixed(1)} ${toY(0).toFixed(1)} L ${pts[0].x.toFixed(1)} ${toY(0).toFixed(1)} Z`;
        sparkContent += `<defs><linearGradient id="rfill${ri}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>`;
        sparkContent += `<path d="${areaD}" fill="url(#rfill${ri})"/>`;
        sparkContent += `<path d="${lineD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        pts.forEach((p, pi) => {
          const isLast = pi === pts.length - 1;
          sparkContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isLast?5:3}" fill="${color}" stroke="#061824" stroke-width="${isLast?2:1.5}" opacity="${isLast?1:0.65}"/>`;
          if (isLast) sparkContent += `<text x="${p.x.toFixed(1)}" y="${(p.y - 11).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}" font-family="system-ui">${p.score}</text>`;
        });
      }

      // Date labels on first and last point
      if (pts.length > 1) {
        sparkContent += `<text x="${pts[0].x.toFixed(1)}" y="${(ROW_H-1).toFixed(1)}" text-anchor="start" font-size="8" fill="rgba(255,255,255,0.2)" font-family="system-ui">${fmt(pts[0].ms)}</text>`;
        sparkContent += `<text x="${pts[pts.length-1].x.toFixed(1)}" y="${(ROW_H-1).toFixed(1)}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.2)" font-family="system-ui">${fmt(pts[pts.length-1].ms)}</text>`;
      }

      return `<div style="display:flex;align-items:center;gap:0;border-bottom:1px solid rgba(255,255,255,.05);padding:6px 0;">
        <div style="width:130px;flex-shrink:0;padding-right:12px;">
          <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(rep.name)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;">${rep.calls.length} call${rep.calls.length!==1?'s':''}</div>
        </div>
        <svg style="flex:1;min-width:0;height:${ROW_H}px;display:block;" viewBox="0 0 ${W} ${ROW_H}" preserveAspectRatio="none">${sparkContent}</svg>
        <div style="width:56px;flex-shrink:0;text-align:right;padding-left:12px;">
          <div style="font-size:18px;font-weight:800;color:${scoreColor(latest)};line-height:1;">${latest}</div>
          <div style="font-size:10px;font-weight:700;color:${trendColor};margin-top:3px;">${trendLabel}</div>
        </div>
      </div>`;
    });

    // Shared date axis header
    const axisHtml = `<div style="display:flex;padding:0 0 6px 0;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:2px;">
      <div style="width:130px;flex-shrink:0;"></div>
      <div style="flex:1;display:flex;justify-content:space-between;">
        <span style="font-size:9px;color:rgba(255,255,255,.2);font-family:'SF Mono','Fira Code',monospace;">${fmt(minMs)}</span>
        ${minMs !== maxMs ? `<span style="font-size:9px;color:rgba(255,255,255,.2);font-family:'SF Mono','Fira Code',monospace;">${fmt(maxMs)}</span>` : ''}
      </div>
      <div style="width:56px;flex-shrink:0;text-align:right;padding-left:12px;font-size:9px;color:rgba(255,255,255,.2);font-family:'SF Mono','Fira Code',monospace;">LAST</div>
    </div>`;

    container.innerHTML = axisHtml + rows.join('');
  }

  function renderLifecyclePage() {
    const companies = getLcCompanies();
    const sel = document.getElementById('lcCompanySelect');
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Select an account —</option>' +
      companies.map(c => `<option value="${escHtml(c)}"${c===prev?' selected':''}>${escHtml(c)}</option>`).join('');
    if (prev && companies.includes(prev)) onLcCompanyChange();
  }

  function onLcCompanyChange() {
    const company = document.getElementById('lcCompanySelect').value;
    const emptyEl = document.getElementById('lcGraphEmpty');
    if (!company) {
      document.getElementById('lcGraphRoot').innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      lcCloseSidebar();
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    const entries = loadHistory()
      .filter(h => (h.prospect||'').trim().toLowerCase() === company.toLowerCase())
      .sort((a,b) => { const da=a.callDate||a.ts.slice(0,10), db=b.callDate||b.ts.slice(0,10); return da<db?-1:da>db?1:0; });
    buildLcGraph(entries, company);
  }

  function buildLcGraph(entries, company) {
    _lcNodes = []; _lcEdges = [];
    _lcAllEntries = entries;
    _lcCompany    = company;
    _lcT = { x: 0, y: 0, s: 1 }; // reset transform so lcFit always starts clean

    // Account hub (center-left)
    const shortName = company.length > 14 ? company.slice(0,13)+'…' : company;
    _lcNodes.push({ id:'account', type:'account', x:0, y:0, label:shortName, sublabel:company });

    // Placeholder assets around hub
    _lcNodes.push({ id:'ph-opp',   type:'opportunity', x:-20,  y:-200, label:'Opportunity',  sublabel:'Deal pipeline',   ph:true });
    _lcNodes.push({ id:'ph-champ', type:'champion',    x:-210, y:90,   label:'Champion',     sublabel:'Internal ally',   ph:true });
    _lcNodes.push({ id:'ph-con',   type:'contact',     x:-210, y:-90,  label:'Key Contact',  sublabel:'Decision maker',  ph:true });
    _lcNodes.push({ id:'ph-stake', type:'stakeholder', x:-360, y:0,    label:'Stakeholder',  sublabel:'Evaluator / IT',  ph:true });
    _lcEdges.push({ from:'account',  to:'ph-opp',   style:'dashed' });
    _lcEdges.push({ from:'account',  to:'ph-champ', style:'dashed' });
    _lcEdges.push({ from:'account',  to:'ph-con',   style:'dashed' });
    _lcEdges.push({ from:'ph-con',   to:'ph-stake', style:'dashed' });

    if (_lcCallsCollapsed && entries.length > 0) {
      // Single summary node
      const scores   = entries.map(h => h.total||0).filter(s => s > 0);
      const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      const grades   = entries.map(h => h.letter_grade||'?');
      const bestGrade = grades.sort((a,b)=>['A+','A','A-','B+','B','B-','C+','C','C-','D','F'].indexOf(a)-['A+','A','A-','B+','B','B-','C+','C','C-','D','F'].indexOf(b))[0]||'?';
      _lcNodes.push({ id:'calls-summary', type:'calls-summary', x:220, y:0,
        label: bestGrade + ' · ' + avgScore,
        sublabel: entries.length + (entries.length===1?' call':' calls'),
        summaryData: { entries, avgScore, grades },
        ringColor: gradeRingColor(bestGrade) });
      _lcEdges.push({ from:'account', to:'calls-summary', style:'solid', arrow:'teal' });
    } else {
      // Call nodes chained chronologically to the right
      const n = entries.length;
      entries.forEach((h, i) => {
        const t  = n === 1 ? 0.5 : i / (n - 1);
        const x  = 180 + i * 170;
        const y  = (Math.sin(t * Math.PI) * -70) + (i % 2 === 0 ? -20 : 20);
        const ds = h.callDate
          ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'})
          : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'});
        _lcNodes.push({ id:'call-'+h.id, type:'call', x, y, label:h.letter_grade+' · '+h.total,
          sublabel:stageAbbrev(h.stage||''), dateStr:ds, data:h, ringColor:gradeRingColor(h.letter_grade) });
        _lcEdges.push({ from: i===0?'account':'call-'+entries[i-1].id, to:'call-'+h.id, style:'solid', arrow:'teal' });
      });
    }

    // Competitor + Tech Stack rooted on the account node (below/above the left cluster)
    _lcNodes.push({ id:'ph-comp', type:'competitor', x:-20,  y:200,  label:'Competitor', sublabel:'Competing solution', ph:true });
    _lcNodes.push({ id:'ph-tech', type:'techstack',  x:180,  y:200,  label:'Tech Stack', sublabel:'Existing tooling',   ph:true });
    _lcEdges.push({ from:'account', to:'ph-comp', style:'dashed' });
    _lcEdges.push({ from:'account', to:'ph-tech', style:'dashed' });

    // Reflect any saved profile data on initial render (also calls drawLcGraph)
    updateLcGraphNodes(company);
    // Fit after a frame so the SVG has dimensions
    requestAnimationFrame(() => { requestAnimationFrame(lcFit); });
  }

  function toggleLcCalls() {
    _lcCallsCollapsed = !_lcCallsCollapsed;
    _lcSelId = null;
    const btn = document.getElementById('lcCollapseBtn');
    if (btn) btn.style.color = _lcCallsCollapsed ? '#00c8ff' : '';
    buildLcGraph(_lcAllEntries, _lcCompany);
  }

  function drawLcGraph() {
    const root = document.getElementById('lcGraphRoot');
    if (!root) return;
    root.setAttribute('transform', `translate(${_lcT.x},${_lcT.y}) scale(${_lcT.s})`);
    const collapseBtn = document.getElementById('lcCollapseBtn');
    if (collapseBtn) collapseBtn.style.display = _lcAllEntries.length >= 3 ? '' : 'none';

    let edgeSvg = '', nodeSvg = '';

    _lcEdges.forEach(e => {
      const n1 = _lcNodes.find(n=>n.id===e.from), n2 = _lcNodes.find(n=>n.id===e.to);
      if (!n1||!n2) return;
      const dx=n2.x-n1.x, dy=n2.y-n1.y, dist=Math.sqrt(dx*dx+dy*dy);
      const r1=(NODE_DEFS[n1.type]||NODE_DEFS.call).r+2, r2=(NODE_DEFS[n2.type]||NODE_DEFS.call).r+8;
      const ux=dx/dist, uy=dy/dist;
      const x1=n1.x+ux*r1, y1=n1.y+uy*r1, x2=n2.x-ux*r2, y2=n2.y-uy*r2;
      const perp=Math.min(70,dist*0.3), mx=(x1+x2)/2, my=(y1+y2)/2;
      const cpx=mx-uy*perp, cpy=my+ux*perp;
      const d=`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
      const dim=e.style==='dashed';
      const stroke=dim?'rgba(255,255,255,0.14)':'rgba(0,200,255,0.5)';
      const marker=dim?'arrow-dim':'arrow-teal';
      edgeSvg += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${dim?1:1.5}" ${dim?'stroke-dasharray="5,4"':''} marker-end="url(#${marker})"/>`;
      // midpoint dot
      const mpx=cpx*0.5+(x1+x2)*0.25, mpy=cpy*0.5+(y1+y2)*0.25;
      edgeSvg += `<circle cx="${mpx}" cy="${mpy}" r="2.5" fill="${dim?'rgba(255,255,255,0.1)':'rgba(0,200,255,0.3)'}" stroke="${dim?'rgba(255,255,255,0.2)':'rgba(0,200,255,0.55)'}" stroke-width="1"/>`;
    });

    _lcNodes.forEach(nd => {
      const def = NODE_DEFS[nd.type]||NODE_DEFS.call;
      const r=def.r, fill=nd.ringColor?'#0a1a24':def.color, ring=nd.ringColor||def.ring;
      const sel=nd.id===_lcSelId, ph=nd.ph;
      if (sel) {
        nodeSvg += `<circle cx="${nd.x}" cy="${nd.y}" r="${r+11}" fill="none" stroke="${ring}" stroke-width="1" opacity="0.25"/>`;
        nodeSvg += `<circle cx="${nd.x}" cy="${nd.y}" r="${r+6}"  fill="none" stroke="${ring}" stroke-width="1.5" opacity="0.5"/>`;
      }
      const populated = ph && nd.hasData;
      const ringOpacity = populated ? 0.75 : (ph ? 0.35 : 0.8);
      const dashAttr = ph && !populated ? 'stroke-dasharray="4,3"' : '';
      const nodeOpacity = populated ? 0.88 : (ph ? 0.55 : 1);
      nodeSvg += `<circle cx="${nd.x}" cy="${nd.y}" r="${r+3}" fill="none" stroke="${ring}" stroke-width="1.5" opacity="${ringOpacity}" ${dashAttr}/>`;
      nodeSvg += `<circle cx="${nd.x}" cy="${nd.y}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="2" opacity="${nodeOpacity}" class="lc-node-hit" data-id="${nd.id}" style="cursor:pointer;"/>`;

      // Collapse/expand chevron toggle on the left of the first score node
      const isFirstScore = nd.type==='calls-summary' || (nd.type==='call' && nd.id==='call-'+(_lcAllEntries[0]?.id));
      if (isFirstScore && _lcAllEntries.length >= 3) {
        const tx = nd.x - r - 17, ty = nd.y;
        const chevron = _lcCallsCollapsed ? '›' : '‹'; // › collapsed / ‹ expanded
        nodeSvg += `<circle cx="${tx}" cy="${ty}" r="9" fill="#061824" stroke="#00c8ff" stroke-width="1.5" opacity="0.95" class="lc-collapse-toggle" style="cursor:pointer;"/>`;
        nodeSvg += `<text x="${tx}" y="${ty+1}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="700" fill="#00c8ff" font-family="system-ui,sans-serif" style="pointer-events:none;">${chevron}</text>`;
      }

      // Inner text
      let inner='', sub='';
      if (nd.type==='call') { inner=nd.data?.letter_grade||'?'; sub=nd.data?.total??''; }
      else if (nd.type==='calls-summary') {
        const sg=[...(nd.summaryData?.grades||[])].sort((a,b)=>['A+','A','A-','B+','B','B-','C+','C','C-','D','F'].indexOf(a)-['A+','A','A-','B+','B','B-','C+','C','C-','D','F'].indexOf(b));
        inner=sg[0]||'?'; sub=nd.summaryData?.avgScore??'';
      }
      else if (nd.type==='account') { inner=(nd.sublabel||nd.label).split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
      else { inner=PH_SYMBOLS[nd.type]||'?'; }
      const tf=ph?'rgba(255,255,255,0.35)':'#fff';
      const innerColor=(nd.type==='call'||nd.type==='calls-summary')&&nd.ringColor?nd.ringColor:tf;
      const innerSize=nd.type==='account'?15:nd.type==='calls-summary'?17:13;
      const yOff=sub!==''?-5:0;
      nodeSvg += `<text x="${nd.x}" y="${nd.y+yOff}" text-anchor="middle" dominant-baseline="middle" font-size="${innerSize}" font-weight="700" fill="${innerColor}" font-family="system-ui,sans-serif" style="pointer-events:none;">${inner}</text>`;
      if (sub!=='') nodeSvg += `<text x="${nd.x}" y="${nd.y+9}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="rgba(255,255,255,0.5)" font-family="'SF Mono','Fira Code',monospace" style="pointer-events:none;">${sub}</text>`;
      // External labels: stage above + date below for calls; count below for summary
      if (nd.type==='call') {
        if (nd.sublabel) nodeSvg += `<text x="${nd.x}" y="${nd.y-r-18}" text-anchor="middle" font-size="9" font-weight="600" fill="rgba(0,200,255,0.75)" font-family="system-ui,sans-serif" letter-spacing="0.06em" style="pointer-events:none;">${escHtml(nd.sublabel.toUpperCase())}</text>`;
        const ly=nd.y+r+16;
        if (nd.dateStr) nodeSvg += `<text x="${nd.x}" y="${ly}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="'SF Mono','Fira Code',monospace" style="pointer-events:none;">${escHtml(nd.dateStr)}</text>`;
      } else if (nd.type==='calls-summary') {
        const ly=nd.y+r+16;
        nodeSvg += `<text x="${nd.x}" y="${ly}" text-anchor="middle" font-size="10" font-weight="600" fill="rgba(0,200,255,0.6)" font-family="system-ui,sans-serif" letter-spacing="0.06em" style="pointer-events:none;">${escHtml(nd.sublabel)}</text>`;
      } else {
        const ly=nd.y+r+16;
        nodeSvg += `<text x="${nd.x}" y="${ly}" text-anchor="middle" font-size="11" font-weight="${ph?400:600}" fill="${ph?'rgba(255,255,255,0.28)':'rgba(255,255,255,0.8)'}" font-family="system-ui,sans-serif" style="pointer-events:none;">${escHtml(nd.label)}</text>`;
        const sub2=nd.type!=='account'?nd.sublabel:'';
        if (sub2) nodeSvg += `<text x="${nd.x}" y="${ly+14}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.25)" font-family="system-ui,sans-serif" style="pointer-events:none;">${escHtml(sub2)}</text>`;
      }
    });

    root.innerHTML = edgeSvg + nodeSvg;
    root.querySelectorAll('.lc-collapse-toggle').forEach(el => {
      el.setAttribute('title', _lcCallsCollapsed ? 'Expand calls' : 'Collapse calls');
      el.addEventListener('mousedown', ev => { ev.stopPropagation(); });
      el.addEventListener('click', ev => { ev.stopPropagation(); toggleLcCalls(); });
    });
    root.querySelectorAll('.lc-node-hit').forEach(el => {
      el.addEventListener('mousedown', ev => { ev.stopPropagation(); });
      el.addEventListener('click', ev => { ev.stopPropagation(); lcSelectNode(el.getAttribute('data-id')); });
      // Double-click on first call node (or summary node) toggles collapse
      const id = el.getAttribute('data-id');
      if (id === 'call-' + (_lcAllEntries[0]?.id) || id === 'calls-summary') {
        el.addEventListener('dblclick', ev => { ev.stopPropagation(); toggleLcCalls(); });
        el.style.cursor = 'pointer';
        el.setAttribute('title', _lcCallsCollapsed ? 'Double-click to expand' : 'Double-click to collapse');
      }
    });
  }

  function lcSelectNode(id) {
    _lcSelId = id;
    const nd = _lcNodes.find(n=>n.id===id);
    drawLcGraph();
    if (nd) {
      const c = document.getElementById('lcGraphCanvas');
      const sb = document.getElementById('lcSidebar');
      if (c) {
        // Zoom to a readable scale — use 1.1 unless user is already zoomed in more
        const TARGET_SCALE = 1.1;
        const newS = Math.max(_lcT.s, TARGET_SCALE);
        // Account for sidebar: if it's about to open, the canvas loses 310px
        const sidebarOpening = sb && !sb.classList.contains('open');
        const W = c.offsetWidth - (sidebarOpening ? 310 : 0);
        const H = c.offsetHeight;
        _lcT.s = newS;
        _lcT.x = W / 2 - nd.x * newS;
        _lcT.y = H / 2 - nd.y * newS;
        applyLcTransform();
      }
      lcShowSidebar(nd);
    }
  }

  function lcShowSidebar(nd) {
    const def=NODE_DEFS[nd.type]||NODE_DEFS.call;
    const sb=document.getElementById('lcSidebar'), inner=document.getElementById('lcSbInner');
    if (!sb||!inner) return;
    sb.classList.add('open');
    const initials = nd.type==='call'?(nd.data?.letter_grade||'?'):nd.label.slice(0,2).toUpperCase();
    let html = `<div class="lc-sb-topbar">
      <span class="lc-sb-type-badge">${escHtml(def.label)}</span>
      <button class="lc-sb-close" onclick="lcCloseSidebar()">✕</button>
    </div>
    <div class="lc-sb-hero">
      <div class="lc-sb-node-icon" style="background:${def.color};border:2px solid ${nd.ringColor||def.ring};">${escHtml(initials)}</div>
      <div>
        <div class="lc-sb-name">${escHtml(nd.sublabel||nd.label)}</div>
        <div class="lc-sb-sub">${escHtml(def.label)}</div>
      </div>
    </div>`;

    if (nd.type==='call' && nd.data) {
      const h=nd.data;
      const ds=h.callDate
        ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})
        : new Date(h.ts).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
      html += `<div class="lc-sb-section">
        <div class="lc-sb-section-label">Call Details</div>
        <div class="lc-sb-row"><span class="lc-sb-key">Date</span><span class="lc-sb-val">${escHtml(ds)}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Stage</span><span class="lc-sb-val">${escHtml(stageAbbrev(h.stage||''))}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Grade</span><span class="lc-sb-val" style="color:${gradeRingColor(h.letter_grade)};font-weight:800;">${escHtml(h.letter_grade)} &nbsp;·&nbsp; ${h.total}/100</span></div>
        ${h.rep?`<div class="lc-sb-row"><span class="lc-sb-key">Rep</span><span class="lc-sb-val">${escHtml(h.rep)}</span></div>`:''}
        ${h.repRole?`<div class="lc-sb-row"><span class="lc-sb-key">Role</span><span class="lc-sb-val">${escHtml(h.repRole)}</span></div>`:''}
        ${h.contactTitle?`<div class="lc-sb-row"><span class="lc-sb-key">Contact</span><span class="lc-sb-val">${escHtml(h.contactTitle)}</span></div>`:''}
      </div>`;
      if (h.top_strength||h.top_priority) {
        html += `<div class="lc-sb-section" style="padding-bottom:14px;">
          <div class="lc-sb-section-label">Signals</div>
          ${h.top_strength?`<div style="margin-bottom:8px;"><div style="font-size:9px;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Strength</div><span class="lc-sb-tag lc-sb-strength">${escHtml(h.top_strength)}</span></div>`:''}
          ${h.top_priority?`<div><div style="font-size:9px;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Priority</div><span class="lc-sb-tag lc-sb-priority">${escHtml(h.top_priority)}</span></div>`:''}
        </div>`;
      }
      if (h.spiced) {
        const touched=Object.entries(h.spiced).filter(([,v])=>v.touched).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1).replace('_',' '));
        if (touched.length) html += `<div class="lc-sb-section" style="padding-bottom:14px;">
          <div class="lc-sb-section-label">SPICED Coverage</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">${touched.map(t=>`<span class="lc-sb-tag lc-sb-strength">${escHtml(t)}</span>`).join('')}</div>
        </div>`;
      }
      html += `<div class="lc-sb-actions"><button class="lc-sb-btn lc-sb-btn-primary" onclick="openLcModal(${h.id})">View Full Report</button></div>`;

    } else if (nd.type==='calls-summary' && nd.summaryData) {
      const { entries: es, avgScore, grades } = nd.summaryData;
      const gradeCounts = {};
      grades.forEach(g => { gradeCounts[g] = (gradeCounts[g]||0) + 1; });
      const gradeOrder = ['A+','A','A-','B+','B','B-','C+','C','C-','D','F'];
      const gradeRows = gradeOrder.filter(g => gradeCounts[g]).map(g =>
        `<div class="lc-sb-row"><span class="lc-sb-key" style="color:${gradeRingColor(g)};font-weight:700;">${g}</span><span class="lc-sb-val">${gradeCounts[g]} call${gradeCounts[g]>1?'s':''}</span></div>`
      ).join('');
      html += `<div class="lc-sb-section">
        <div class="lc-sb-section-label">Call Summary</div>
        <div class="lc-sb-row"><span class="lc-sb-key">Total Calls</span><span class="lc-sb-val">${es.length}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Avg Score</span><span class="lc-sb-val">${avgScore}/100</span></div>
      </div>
      <div class="lc-sb-section">
        <div class="lc-sb-section-label">Grade Distribution</div>
        ${gradeRows||'<div style="opacity:.4;font-size:11px;padding:4px 0;">No grades yet</div>'}
      </div>
      <div class="lc-sb-actions">
        <button class="lc-sb-btn lc-sb-btn-primary" onclick="toggleLcCalls()">Expand Calls</button>
      </div>`;

    } else if (nd.type==='account') {
      const calls=_lcNodes.filter(n=>n.type==='call'||n.type==='calls-summary');
      const scores=calls.map(n=>n.data?.total||0).filter(s=>s>0);
      const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):'—';
      const stages=[...new Set(calls.map(n=>stageAbbrev(n.data?.stage||'')).filter(Boolean))];
      const company=nd.sublabel||nd.label;
      const prof=loadAccountProfile(company);

      html += `<div class="lc-sb-section">
        <div class="lc-sb-section-label">Account Overview</div>
        <div class="lc-sb-row"><span class="lc-sb-key">Total Calls</span><span class="lc-sb-val">${calls.length}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Avg Score</span><span class="lc-sb-val">${avg}${avg!=='—'?'/100':''}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Stages</span><span class="lc-sb-val" style="text-align:right;">${stages.join(', ')||'—'}</span></div>
      </div>
      <div class="lc-profile-divider"></div>`;

      // ── Key Contacts ──
      html += `<div class="lc-profile-section">
        <div class="lc-profile-section-hdr">
          <div class="lc-sb-section-label" style="margin:0;">Key Contacts</div>
        </div>
        <div class="lc-profile-chips" id="prof-contacts">
          ${(prof.contacts||[]).map((c,i)=>`<span class="lc-profile-chip person">${escHtml(c.name)}${c.title?` · <em style="opacity:.6">${escHtml(c.title)}</em>`:''}<button class="lc-chip-remove" onclick="profRemove('${escHtml(company)}','contacts',${i})">×</button></span>`).join('')}
        </div>
        <div class="lc-profile-add-row">
          <input class="lc-profile-input" id="prof-con-name" placeholder="Name" onkeydown="if(event.key==='Enter')profAddContact('${escHtml(company)}')"/>
          <input class="lc-profile-input lc-profile-input-sm" id="prof-con-title" placeholder="Title" onkeydown="if(event.key==='Enter')profAddContact('${escHtml(company)}')"/>
          <button class="lc-profile-add-btn" onclick="profAddContact('${escHtml(company)}')">+</button>
        </div>
      </div>`;

      // ── Champion ──
      const champ=prof.champion||null;
      html += `<div class="lc-profile-section">
        <div class="lc-profile-section-hdr">
          <div class="lc-sb-section-label" style="margin:0;">Champion</div>
        </div>
        <div class="lc-profile-chips" id="prof-champion">
          ${champ?`<span class="lc-profile-chip champion-chip">★ ${escHtml(champ.name)}${champ.title?` · <em style="opacity:.7">${escHtml(champ.title)}</em>`:''}<button class="lc-chip-remove" onclick="profClearChampion('${escHtml(company)}')">×</button></span>`:''}
        </div>
        ${!champ?`<div class="lc-profile-add-row">
          <input class="lc-profile-input" id="prof-champ-name" placeholder="Name" onkeydown="if(event.key==='Enter')profSetChampion('${escHtml(company)}')"/>
          <input class="lc-profile-input lc-profile-input-sm" id="prof-champ-title" placeholder="Title" onkeydown="if(event.key==='Enter')profSetChampion('${escHtml(company)}')"/>
          <button class="lc-profile-add-btn" onclick="profSetChampion('${escHtml(company)}')">+</button>
        </div>`:''}
      </div>`;

      // ── Stakeholders ──
      html += `<div class="lc-profile-section">
        <div class="lc-profile-section-hdr">
          <div class="lc-sb-section-label" style="margin:0;">Stakeholders</div>
        </div>
        <div class="lc-profile-chips" id="prof-stakeholders">
          ${(prof.stakeholders||[]).map((s,i)=>`<span class="lc-profile-chip person">${escHtml(s.name)}${s.title?` · <em style="opacity:.6">${escHtml(s.title)}</em>`:''}<button class="lc-chip-remove" onclick="profRemove('${escHtml(company)}','stakeholders',${i})">×</button></span>`).join('')}
        </div>
        <div class="lc-profile-add-row">
          <input class="lc-profile-input" id="prof-stake-name" placeholder="Name" onkeydown="if(event.key==='Enter')profAddStakeholder('${escHtml(company)}')"/>
          <input class="lc-profile-input lc-profile-input-sm" id="prof-stake-title" placeholder="Title" onkeydown="if(event.key==='Enter')profAddStakeholder('${escHtml(company)}')"/>
          <button class="lc-profile-add-btn" onclick="profAddStakeholder('${escHtml(company)}')">+</button>
        </div>
      </div>`;

      // ── Competitors ──
      html += `<div class="lc-profile-section">
        <div class="lc-profile-section-hdr">
          <div class="lc-sb-section-label" style="margin:0;">Competitors</div>
        </div>
        <div class="lc-profile-chips" id="prof-competitors">
          ${(prof.competitors||[]).map((c,i)=>`<span class="lc-profile-chip">${escHtml(c)}<button class="lc-chip-remove" onclick="profRemoveStr('${escHtml(company)}','competitors',${i})">×</button></span>`).join('')}
        </div>
        <div class="lc-profile-add-row">
          <input class="lc-profile-input" id="prof-comp-name" placeholder="e.g. Palo Alto Networks" onkeydown="if(event.key==='Enter')profAddStr('${escHtml(company)}','competitors','prof-comp-name')"/>
          <button class="lc-profile-add-btn" onclick="profAddStr('${escHtml(company)}','competitors','prof-comp-name')">+</button>
        </div>
      </div>`;

      // ── Tech Stack ──
      html += `<div class="lc-profile-section">
        <div class="lc-profile-section-hdr">
          <div class="lc-sb-section-label" style="margin:0;">Tech Stack</div>
        </div>
        <div class="lc-profile-chips" id="prof-techstack">
          ${(prof.techstack||[]).map((t,i)=>`<span class="lc-profile-chip">${escHtml(t)}<button class="lc-chip-remove" onclick="profRemoveStr('${escHtml(company)}','techstack',${i})">×</button></span>`).join('')}
        </div>
        <div class="lc-profile-add-row">
          <input class="lc-profile-input" id="prof-tech-name" placeholder="e.g. CrowdStrike, Splunk" onkeydown="if(event.key==='Enter')profAddStr('${escHtml(company)}','techstack','prof-tech-name')"/>
          <button class="lc-profile-add-btn" onclick="profAddStr('${escHtml(company)}','techstack','prof-tech-name')">+</button>
        </div>
      </div>`;

      html += `<div class="lc-sb-actions"><button class="lc-sb-btn lc-sb-btn-ghost" onclick="navTo('history')">View in History</button></div>`;

    } else {
      // Placeholder node — direct user to account profile
      const accountNd = _lcNodes.find(n=>n.type==='account');
      const nodeLabels = { opportunity:'Opportunity', champion:'Champion', contact:'Key Contact', competitor:'Competitor', techstack:'Tech Stack', stakeholder:'Stakeholder' };
      html += `<div class="lc-sb-placeholder-note">
        <div style="font-size:22px;margin-bottom:8px;opacity:0.45;">${PH_SYMBOLS[nd.type]||'?'}</div>
        <strong style="color:rgba(255,255,255,0.5);display:block;margin-bottom:6px;">${nodeLabels[nd.type]||nd.label}</strong>
        Edit this in the Account Profile — select the <strong style="color:rgba(255,255,255,0.6);">Account</strong> node to add ${nodeLabels[nd.type]||''}s.
      </div>
      <div class="lc-sb-actions">
        <button class="lc-sb-btn lc-sb-btn-primary" onclick="lcSelectNode('account')">Open Account Profile</button>
      </div>`;
    }
    inner.innerHTML = html;
  }

  // ── Account Profile storage ──
  function loadAccountProfiles() {
    try { return JSON.parse(localStorage.getItem('siren_account_profiles') || '{}'); } catch { return {}; }
  }
  function saveAccountProfiles(profiles) {
    localStorage.setItem('siren_account_profiles', JSON.stringify(profiles));
  }
  function loadAccountProfile(company) {
    const key = company.trim().toLowerCase();
    return loadAccountProfiles()[key] || { contacts:[], champion:null, stakeholders:[], competitors:[], techstack:[] };
  }
  function saveAccountProfile(company, prof) {
    const profiles = loadAccountProfiles();
    profiles[company.trim().toLowerCase()] = prof;
    saveAccountProfiles(profiles);
    // Refresh graph nodes to reflect populated state
    updateLcGraphNodes(company);
  }

  function profAddContact(company) {
    const nameEl=document.getElementById('prof-con-name'), titleEl=document.getElementById('prof-con-title');
    if (!nameEl) return;
    const name=nameEl.value.trim(); if (!name) return;
    const prof=loadAccountProfile(company);
    prof.contacts=(prof.contacts||[]);
    prof.contacts.push({ name, title:titleEl?.value.trim()||'' });
    saveAccountProfile(company, prof);
    nameEl.value=''; if (titleEl) titleEl.value='';
    reopenAccountSidebar(company);
  }
  function profSetChampion(company) {
    const nameEl=document.getElementById('prof-champ-name'), titleEl=document.getElementById('prof-champ-title');
    if (!nameEl) return;
    const name=nameEl.value.trim(); if (!name) return;
    const prof=loadAccountProfile(company);
    prof.champion={ name, title:titleEl?.value.trim()||'' };
    saveAccountProfile(company, prof);
    reopenAccountSidebar(company);
  }
  function profClearChampion(company) {
    const prof=loadAccountProfile(company);
    prof.champion=null;
    saveAccountProfile(company, prof);
    reopenAccountSidebar(company);
  }
  function profAddStakeholder(company) {
    const nameEl=document.getElementById('prof-stake-name'), titleEl=document.getElementById('prof-stake-title');
    if (!nameEl) return;
    const name=nameEl.value.trim(); if (!name) return;
    const prof=loadAccountProfile(company);
    prof.stakeholders=(prof.stakeholders||[]);
    prof.stakeholders.push({ name, title:titleEl?.value.trim()||'' });
    saveAccountProfile(company, prof);
    nameEl.value=''; if (titleEl) titleEl.value='';
    reopenAccountSidebar(company);
  }
  function profAddStr(company, field, inputId) {
    const el=document.getElementById(inputId); if (!el) return;
    const val=el.value.trim(); if (!val) return;
    const prof=loadAccountProfile(company);
    prof[field]=(prof[field]||[]);
    prof[field].push(val);
    saveAccountProfile(company, prof);
    el.value='';
    reopenAccountSidebar(company);
  }
  function profRemove(company, field, idx) {
    const prof=loadAccountProfile(company);
    if (prof[field]) prof[field].splice(idx,1);
    saveAccountProfile(company, prof);
    reopenAccountSidebar(company);
  }
  function profRemoveStr(company, field, idx) {
    profRemove(company, field, idx);
  }
  function reopenAccountSidebar(company) {
    const nd=_lcNodes.find(n=>n.type==='account');
    if (nd) lcShowSidebar(nd);
  }
  function updateLcGraphNodes(company) {
    const prof        = loadAccountProfile(company);
    const contacts    = prof.contacts     || [];
    const stakeholders= prof.stakeholders || [];
    const competitors = prof.competitors  || [];
    const techstack   = prof.techstack    || [];
    const champion    = prof.champion;

    _lcNodes.forEach(nd => {
      switch (nd.type) {
        case 'contact':
          nd.hasData  = contacts.length > 0;
          nd.label    = contacts.length    ? contacts[0].name    : 'Key Contact';
          nd.sublabel = contacts.length > 1 ? `+${contacts.length-1} more` : (contacts[0]?.title || 'Decision maker');
          break;
        case 'champion':
          nd.hasData  = !!champion;
          nd.label    = champion ? champion.name : 'Champion';
          nd.sublabel = champion ? (champion.title || 'Internal ally') : 'Internal ally';
          break;
        case 'stakeholder':
          nd.hasData  = stakeholders.length > 0;
          nd.label    = stakeholders.length    ? stakeholders[0].name    : 'Stakeholder';
          nd.sublabel = stakeholders.length > 1 ? `+${stakeholders.length-1} more` : (stakeholders[0]?.title || 'Evaluator / IT');
          break;
        case 'competitor':
          nd.hasData  = competitors.length > 0;
          nd.label    = competitors.length    ? competitors[0]    : 'Competitor';
          nd.sublabel = competitors.length > 1 ? `+${competitors.length-1} more` : 'Competing solution';
          break;
        case 'techstack':
          nd.hasData  = techstack.length > 0;
          nd.label    = techstack.length    ? techstack[0]    : 'Tech Stack';
          nd.sublabel = techstack.length > 1 ? `+${techstack.length-1} more` : 'Existing tooling';
          break;
      }
    });
    drawLcGraph();
  }

  function lcCloseSidebar() {
    _lcSelId = null;
    document.getElementById('lcSidebar').classList.remove('open');
    drawLcGraph();
  }

  // ── Pan & Zoom ──
  function lcPanStart(e) {
    if (e.target.classList.contains('lc-node-hit')) return;
    if (e.button !== 0) return;
    // Close sidebar when clicking on the canvas background
    if (_lcSelId) lcCloseSidebar();
    document.getElementById('lcGraphCanvas').classList.add('panning');
    _lcPan = { ox:e.clientX, oy:e.clientY, tx:_lcT.x, ty:_lcT.y };
  }
  function lcPanMove(e) {
    if (!_lcPan) return;
    _lcT.x = _lcPan.tx + (e.clientX - _lcPan.ox);
    _lcT.y = _lcPan.ty + (e.clientY - _lcPan.oy);
    applyLcTransform();
  }
  function lcPanEnd() {
    _lcPan = null;
    const c=document.getElementById('lcGraphCanvas');
    if (c) c.classList.remove('panning');
  }
  function lcWheel(e) {
    e.preventDefault();
    const f=e.deltaY<0?1.1:0.91;
    const c=document.getElementById('lcGraphCanvas');
    const rect=c.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    _lcT.x=mx-(mx-_lcT.x)*f; _lcT.y=my-(my-_lcT.y)*f;
    _lcT.s=Math.min(3,Math.max(0.2,_lcT.s*f));
    applyLcTransform();
  }
  function lcZoom(f) {
    const c=document.getElementById('lcGraphCanvas');
    if (!c) return;
    const cx=c.offsetWidth/2, cy=c.offsetHeight/2;
    _lcT.x=cx-(cx-_lcT.x)*f; _lcT.y=cy-(cy-_lcT.y)*f;
    _lcT.s=Math.min(3,Math.max(0.2,_lcT.s*f));
    applyLcTransform();
  }
  function lcFit() {
    if (!_lcNodes.length) return;
    const c=document.getElementById('lcGraphCanvas');
    if (!c) return;
    const W=c.offsetWidth, H=c.offsetHeight, PAD=80;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    _lcNodes.forEach(n => { const r=(NODE_DEFS[n.type]||NODE_DEFS.call).r+32; minX=Math.min(minX,n.x-r); maxX=Math.max(maxX,n.x+r); minY=Math.min(minY,n.y-r); maxY=Math.max(maxY,n.y+r); });
    const gW=maxX-minX, gH=maxY-minY;
    _lcT.s=Math.min((W-PAD*2)/gW,(H-PAD*2)/gH,1.4);
    _lcT.x=(W-gW*_lcT.s)/2-minX*_lcT.s;
    _lcT.y=(H-gH*_lcT.s)/2-minY*_lcT.s;
    applyLcTransform();
  }
  function applyLcTransform() {
    const root=document.getElementById('lcGraphRoot');
    if (root) root.setAttribute('transform',`translate(${_lcT.x},${_lcT.y}) scale(${_lcT.s})`);
  }

  function stageAbbrev(stage) {
    return { 'Cold outreach':'Cold Outreach','Discovery':'Discovery','Demo / solution presentation':'Demo','Proposal / close':'Proposal / Close','Touchpoint':'Touchpoint','Security Observability Scorecard':'Scorecard' }[stage] || stage;
  }

  function gradeRingColor(grade) {
    const g = (grade||'C').toUpperCase().replace(/\s/g,'');
    if (g.startsWith('A')) return '#00c8ff';
    if (g.startsWith('B')) return '#00c896';
    if (g.startsWith('C')) return '#e8a020';
    if (g.startsWith('D')) return '#e05050';
    return '#c03030';
  }

  function getHistoryEntry(id) { return loadHistory().find(h=>h.id===id)||null; }

  function openLcModal(id) {
    const h=getHistoryEntry(id);
    if (!h) return;
    const bg=getBannerColor(h.letter_grade);
    const ds=h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const subParts=[h.rep,h.repRole,h.contactTitle,ds].filter(Boolean);
    document.getElementById('lcModalBadge').style.background=bg;
    document.getElementById('lcModalBadge').textContent=h.letter_grade+' '+h.total;
    document.getElementById('lcModalTitle').textContent=(h.prospect||'Unknown company')+' — '+stageAbbrev(h.stage||'');
    document.getElementById('lcModalSub').textContent=subParts.join(' · ');
    const body=(h.resultsHtml||'')
      .replace(/<button[^>]*reset-btn[^>]*>[\s\S]*?<\/button>/,'')
      .replace(/<div class="rep-toggle">[\s\S]*?<\/div>/,'')
      .replace(/<div class="score-view(?!.*active)[^"]*"[\s\S]*?(?=<div class="score-view active|$)/,'');
    document.getElementById('lcModalBody').innerHTML=body||'<p style="color:var(--siren-text-faint);font-size:13px;">No detailed report available.</p>';
    document.getElementById('lcModal').classList.add('open');
    document.body.style.overflow='hidden';
  }

  function closeLcModal() {
    document.getElementById('lcModal').classList.remove('open');
    document.body.style.overflow='';
  }

  function onLcModalOverlayClick(e) {
    if (e.target===document.getElementById('lcModal')) closeLcModal();
  }

  // Close modal on Escape key
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLcModal(); });

  // ── FORGE ──────────────────────────────────────────────────
  const STAGE_COLORS = {
    'Cold outreach': '#8899aa', 'Discovery': '#4a9eff',
    'Demo / solution presentation': '#e8a020', 'Proposal / close': '#00c8ff',
    'Touchpoint': '#6b7e8a', 'Security Observability Scorecard': '#9b59b6'
  };

  let _forgeHistory = [];   // all calls for selected account
  let _forgeCustomTemplate = null; // selected user template object
  let _forgeCall    = null; // currently selected call entry
  let _forgeBriefAudience = 'internal'; // 'internal' | 'client'

  // ── SCOPE state (declared early to avoid TDZ if init throws) ──
  let _scopeViewingRevision = null;

  function slugField(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

  function loadScopeAll(company){
    try{
      const all=JSON.parse(localStorage.getItem('oa_scope_v2')||'{}');
      return all[company]||{draft:{},revisions:[]};
    }catch(e){ return {draft:{},revisions:[]}; }
  }
  function saveScopeAll(company, obj){
    let all={};
    try{ all=JSON.parse(localStorage.getItem('oa_scope_v2')||'{}'); }catch(e){}
    all[company]=obj;
    localStorage.setItem('oa_scope_v2', JSON.stringify(all));
  }

  const SCOPE_SECTIONS = [
    { title: 'ENGAGEMENT OVERVIEW', fields: [
      'Company Name',
      'Industry Vertical (Fintech / Healthcare / Manufacturing…)',
      'Primary point of contact (name & title)',
      'Contact email',
      'Contact phone',
      'Target completion window / date needed',
      'Primary business driver (gap assessment / exam prep / board request / insurance / M&A)'
    ]},
    { title: 'ORGANIZATION PROFILE', fields: [
      'Legal entity type (LLC / corporation / partnership / nonprofit / etc.)',
      'Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)',
      'Primary products & services',
      'Total number of employees (full-time + part-time)',
      'Number of in-house IT / security staff',
      'Number of business locations / offices',
      'Operating model (business hours only / 24×7 online operations)',
      'International operations?',
      'Approximate number of customers / clients / users served'
    ]},
    { title: 'ENVIRONMENT SIZE & COMPOSITION', fields: [
      'System architecture (on-prem / cloud-hosted / hybrid)',
      'Number of endpoints (workstations + laptops)',
      'Number of mobile devices accessing organization data',
      'Number of servers (physical + virtual)',
      'Number of live hosts — internal network',
      'Number of internet-facing (external) hosts',
      'Number of hosting environments (physical + cloud)',
      'Number of systems hosted / managed by third parties',
      'Do you use a Managed Service / Security Provider (MSP / MSSP)? Name it.'
    ]},
    { title: 'TECHNOLOGY & KEY SYSTEMS', fields: [
      'Core business / ERP / processing platform (e.g. SAP / Oracle / Salesforce / NetSuite)',
      'Customer-facing / digital platform provider (e.g. web portal / mobile app / e-commerce)',
      'Firewall / network equipment (e.g. Cisco / Meraki / Palo Alto)',
      'Predominant OS / server environment (Windows / Azure / on-prem / etc.)',
      'Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)',
      'Number of cloud tenants / subscriptions',
      'Key SaaS / third-party apps handling regulated data',
      'Endpoint protection / EDR solution in use',
      'Is MFA deployed (email / remote access / admin accounts)?',
      'Email / collaboration platform (M365 / Google Workspace / etc.)'
    ]},
    { title: 'DATA & SENSITIVE INFORMATION', fields: [
      'Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)',
      'Do you store, process, or transmit payment card data (PCI scope)?',
      'Approximate volume of customer PII / records held',
      'Where is sensitive data stored (on-prem / cloud / vendor)?'
    ]},
    { title: 'DRIVERS, CONTEXT & CONSTRAINTS', fields: [
      'Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)',
      'Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?',
      'Applying for / renewing cyber liability insurance? When?',
      'Preparing for a regulatory exam or audit? When?',
      'Recent or pending M&A activity? Describe.',
      'Expected network / application changes during the assessment window?',
      'Timing restrictions (time of day / day of week / blackout periods)?'
    ]},
    { title: 'PRIOR ASSESSMENT HISTORY', fields: [
      'Has the organization had a prior risk / security assessment? When?',
      'Date of last security audit or regulatory exam',
      'Security incident in the past 24 months? Briefly describe.',
      'Number of personnel who will support this engagement'
    ]}
  ];

  function forgeRenderUserTemplates() {
    const el = document.getElementById('forgeUserTemplates');
    if (!el) return;
    const tmpls = loadTemplates();
    if (!tmpls.length) { el.innerHTML = ''; return; }
    const cards = tmpls.map((t, i) => {
      const icon = t.reportType === 'Executive Summary' ? '📊'
        : t.reportType === 'Follow-Up Email' ? '📬'
        : t.reportType === 'Proposal Cover' ? '📄'
        : t.reportType === 'QBR Report' ? '📈'
        : '📋';
      const fileNote = (t.files||[]).length ? `<div style="font-size:10px;color:var(--siren-cyan-50);margin-top:4px;">📎 ${t.files.length} attachment${t.files.length>1?'s':''}</div>` : '';
      return `<div class="forge-template-card" data-user-tmpl="${i}" onclick="forgeSelectUserTemplate(${i})" style="cursor:pointer;">
        <div class="forge-template-icon">${icon}</div>
        <div class="forge-template-name">${escHtml(t.name)}</div>
        ${t.reportType ? `<div class="forge-template-desc" style="color:var(--siren-cyan-50);margin-bottom:4px;">${escHtml(t.reportType)}</div>` : ''}
        ${fileNote}
      </div>`;
    }).join('');
    el.innerHTML = `<div style="font-family:var(--siren-font-hud);font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--siren-text-muted);margin:12px 0 8px;">Your Templates</div>
      <div class="forge-template-row">${cards}</div>`;
  }

  function forgeSelectUserTemplate(idx) {
    const tmpls = loadTemplates();
    _forgeCustomTemplate = tmpls[idx] || null;
    document.querySelectorAll('.forge-template-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.forge-template-card[data-user-tmpl="${idx}"]`);
    if (card) card.classList.add('selected');
    forgeUpdateTemplateTitles();
  }

  function forgeApplyTemplate(h, tmpl) {
    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    const nextSteps = h.next_steps && Array.isArray(h.next_steps)
      ? h.next_steps.map((s,i) => `${i+1}. ${s}`).join('\n')
      : (h.next_steps || '');
    const spicedLines = h.spiced ? Object.entries(h.spiced).map(([k,v]) => {
      const label = k.charAt(0).toUpperCase()+k.slice(1).replace('_',' ');
      return `  ${label}: ${v.touched ? (v.summary||'Covered') : 'Not addressed'}`;
    }).join('\n') : '';
    const dimLines = h.dimensions ? Object.entries(h.dimensions).map(([name,d]) => `  ${name}: ${d.score??0}/100`).join('\n') : '';
    return (tmpl.body || '')
      .replace(/\{\{prospect\}\}/gi, h.prospect||'')
      .replace(/\{\{company\}\}/gi, h.prospect||'')
      .replace(/\{\{rep\}\}/gi, h.rep||'')
      .replace(/\{\{date\}\}/gi, ds)
      .replace(/\{\{stage\}\}/gi, h.stage||'')
      .replace(/\{\{grade\}\}/gi, (h.letter_grade||'')+(h.total?' · '+h.total+'/100':''))
      .replace(/\{\{score\}\}/gi, String(h.total??''))
      .replace(/\{\{grade_label\}\}/gi, h.grade_label||'')
      .replace(/\{\{top_strength\}\}/gi, h.top_strength||'')
      .replace(/\{\{top_priority\}\}/gi, h.top_priority||'')
      .replace(/\{\{next_steps\}\}/gi, nextSteps)
      .replace(/\{\{spiced\}\}/gi, spicedLines)
      .replace(/\{\{dimensions\}\}/gi, dimLines)
      .replace(/\{\{contact\}\}/gi, h.contactTitle||'')
      .replace(/\{\{notes\}\}/gi, h.notes||'');
  }

  function forgeInit() {
    const hist = loadHistory();
    const sel  = document.getElementById('forgeAccountSelect');
    if (!sel) return;
    const seen = new Set();
    const companies = [];
    hist.forEach(h => {
      const n = (h.prospect||'').trim();
      if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); companies.push(n); }
    });
    companies.sort((a,b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">— Select account —</option>' +
      companies.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
    forgeRenderUserTemplates();
  }

  function forgeSelectAccount(company) {
    if (!company) { _forgeHistory = []; _forgeCall = null; forgeRenderEmpty(); return; }
    _forgeHistory = loadHistory()
      .filter(h => (h.prospect||'').trim().toLowerCase() === company.toLowerCase())
      .sort((a,b) => { const da=a.callDate||a.ts.slice(0,10), db=b.callDate||b.ts.slice(0,10); return da>db?-1:da<db?1:0; });
    const picker = document.getElementById('forgeCallPickerWrap');
    const callSel = document.getElementById('forgeCallSelect');
    if (_forgeHistory.length > 0) {
      callSel.innerHTML = _forgeHistory.map((h,i) => {
        const ds = h.callDate || h.ts.slice(0,10);
        return `<option value="${i}">${escHtml(ds)} — ${escHtml(h.stage||'Call')} — ${escHtml(h.letter_grade)} ${h.total}</option>`;
      }).join('');
      picker.style.display = '';
    } else {
      picker.style.display = 'none';
    }
    forgeLoadCall(_forgeHistory[0]);
  }

  function forgeSelectCall(idx) {
    forgeLoadCall(_forgeHistory[parseInt(idx)] || _forgeHistory[0]);
  }

  function forgeLoadCall(h) {
    _forgeCall = h;
    if (!h) { forgeRenderEmpty(); return; }

    // Left rail — context
    document.getElementById('forgeContextPanel').style.display = '';
    const stageColor = STAGE_COLORS[h.stage] || '#8899aa';
    document.getElementById('forgeStageDot').style.background = stageColor;
    document.getElementById('forgeStageLabel').textContent = h.stage || '—';
    document.getElementById('forgeCallCount').textContent =
      _forgeHistory.length + ' call' + (_forgeHistory.length !== 1 ? 's' : '') + ' on record';
    const gradeColor = gradeRingColor(h.letter_grade);
    document.getElementById('forgeScoreDisplay').innerHTML =
      `<span style="color:${gradeColor}">${escHtml(h.letter_grade)}</span>&nbsp;<span style="font-size:13px;color:var(--siren-text-muted);">${h.total}/100</span>`;

    // Left rail — signals panel
    forgeRenderSignals(h);

    // Report fields
    document.getElementById('forgeWipOverlay').style.display = 'none';
    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    forgeSetField('fr-account', h.prospect || '—', false);
    forgeSetField('fr-stage',   h.stage    || '—', false);
    forgeSetField('fr-grade',   `${h.letter_grade} · ${h.total}/100`, false);
    forgeSetField('fr-date',    ds, false);
    forgeSetField('fr-strength', h.top_strength || '—', !h.top_strength);
    forgeSetField('fr-priority', h.top_priority || '—', !h.top_priority);

    // Dimension scores
    if (h.dimensions && Object.keys(h.dimensions).length) {
      const dimsEl = document.getElementById('fr-dims');
      dimsEl.innerHTML = Object.entries(h.dimensions).map(([name, d]) => {
        const score = d.score ?? 0;
        const pct = Math.round(score);
        const color = pct >= 75 ? '#00c8ff' : pct >= 55 ? '#00c896' : '#e8a020';
        return `<div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;color:var(--siren-text-body);">${escHtml(name)}</span>
            <span style="font-family:var(--siren-font-hud);font-size:11px;color:${color};font-weight:700;">${pct}</span>
          </div>
          <div style="height:4px;background:var(--siren-bg-card-raised);border-radius:2px;">
            <div style="height:4px;width:${pct}%;background:${color};border-radius:2px;transition:width .4s;"></div>
          </div>
          ${d.feedback?`<div style="font-size:11px;color:var(--siren-text-muted);margin-top:3px;line-height:1.45;">${escHtml(d.feedback)}</div>`:''}
        </div>`;
      }).join('');
      document.getElementById('fr-dims-section').style.display = '';
    } else {
      document.getElementById('fr-dims-section').style.display = 'none';
    }

    // SPICED
    if (h.spiced) {
      const spicedEl = document.getElementById('fr-spiced');
      spicedEl.innerHTML = Object.entries(h.spiced).map(([key, v]) => {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace('_',' ');
        const color = v.touched ? '#00c8ff' : 'var(--siren-text-muted)';
        return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
          <span style="font-family:var(--siren-font-hud);font-size:9px;font-weight:700;color:${color};min-width:80px;padding-top:2px;letter-spacing:.06em;">${escHtml(label.toUpperCase())}</span>
          <span style="font-size:11px;color:${v.touched?'var(--siren-text-body)':'var(--siren-text-muted)'};line-height:1.45;">${v.summary ? escHtml(v.summary) : (v.touched ? 'Covered' : 'Not addressed')}</span>
        </div>`;
      }).join('');
      document.getElementById('fr-spiced-section').style.display = '';
    } else {
      document.getElementById('fr-spiced-section').style.display = 'none';
    }

    document.getElementById('fr-generated-section').style.display = 'none';
    document.getElementById('fr-email-section').style.display = 'none';
    document.getElementById('fr-email-subject').textContent = '';
    document.getElementById('fr-email-body').textContent = '';
    document.getElementById('forgeCopyBtn').disabled = false;
    document.getElementById('forgeGenBtn').disabled = false;
    forgeUpdateTemplateTitles();
  }

  function forgeRenderSignals(h) {
    const el = document.getElementById('forgeSignalsBody');
    const titleEl = document.getElementById('forgeSignalsTitle');
    if (!el) return;
    const mode = forgeGetMode();
    let html = '', title = 'Highlights';

    if (mode === 'follow-up') {
      title = 'Email Highlights';
      if (h.top_priority) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:#e8a020;">▼</div><div><div class="forge-next-text">${escHtml(h.top_priority)}</div><span class="forge-next-tag">Pain to address</span></div></div>`;
      if (h.top_strength) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-signal-green);">▲</div><div><div class="forge-next-text">${escHtml(h.top_strength)}</div><span class="forge-next-tag">Value to reinforce</span></div></div>`;
      if (Array.isArray(h.next_steps) && h.next_steps.length) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-cyan-50);">→</div><div><div class="forge-next-text">${escHtml(h.next_steps[0])}</div><span class="forge-next-tag">CTA</span></div></div>`;
    } else if (mode === 'call-brief') {
      title = 'Brief Highlights';
      if (h.grade_label) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-cyan-50);">⬡</div><div><div class="forge-next-text">${escHtml(h.grade_label)}</div><span class="forge-next-tag">Overall assessment</span></div></div>`;
      if (h.top_strength) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-signal-green);">▲</div><div><div class="forge-next-text">${escHtml(h.top_strength)}</div><span class="forge-next-tag">Strength</span></div></div>`;
      if (h.top_priority) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:#e8a020;">▼</div><div><div class="forge-next-text">${escHtml(h.top_priority)}</div><span class="forge-next-tag">Coaching focus</span></div></div>`;
    } else if (mode === 'exec-summary') {
      title = 'Exec Highlights';
      if (h.stage) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-cyan-50);">◈</div><div><div class="forge-next-text">${escHtml(h.stage)}</div><span class="forge-next-tag">Deal stage</span></div></div>`;
      if (h.top_strength) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-signal-green);">▲</div><div><div class="forge-next-text">${escHtml(h.top_strength)}</div><span class="forge-next-tag">Key strength</span></div></div>`;
      if (h.top_priority) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:#e8a020;">▼</div><div><div class="forge-next-text">${escHtml(h.top_priority)}</div><span class="forge-next-tag">Risk / gap</span></div></div>`;
    } else {
      title = 'Call Signals';
      if (h.top_strength) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-signal-green);">▲</div><div><div class="forge-next-text">${escHtml(h.top_strength)}</div><span class="forge-next-tag">Strength</span></div></div>`;
      if (h.top_priority) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:#e8a020;">▼</div><div><div class="forge-next-text">${escHtml(h.top_priority)}</div><span class="forge-next-tag">Priority gap</span></div></div>`;
      if (h.grade_label) html += `<div class="forge-next-item"><div class="forge-next-num" style="color:var(--siren-cyan-50);">⬡</div><div><div class="forge-next-text">${escHtml(h.grade_label)}</div><span class="forge-next-tag">Grade label</span></div></div>`;
    }

    if (!html) html = '<div style="font-size:11px;color:var(--siren-text-muted);padding:4px 0;">No signals extracted from this call.</div>';
    if (titleEl) titleEl.textContent = title;
    el.innerHTML = html;
  }

  function forgeRenderEmpty() {
    document.getElementById('forgeContextPanel').style.display = 'none';
    document.getElementById('forgeCallPickerWrap').style.display = 'none';
    document.getElementById('forgeSignalsBody').innerHTML =
      '<div style="padding:4px 0;font-size:11px;color:var(--siren-text-muted);font-style:italic;">Select an account to load call data.</div>';
    document.getElementById('forgeWipOverlay').style.display = '';
    document.getElementById('forgeCopyBtn').disabled = true;
    document.getElementById('forgeGenBtn').disabled = true;
    ['fr-account','fr-stage','fr-grade','fr-date','fr-strength','fr-priority'].forEach(id => forgeSetField(id,'—',true));
    document.getElementById('fr-dims-section').style.display = 'none';
    document.getElementById('fr-spiced-section').style.display = 'none';
    document.getElementById('fr-generated-section').style.display = 'none';
    document.getElementById('fr-email-section').style.display = 'none';
    document.getElementById('fr-email-subject').textContent = '';
    document.getElementById('fr-email-body').textContent = '';
  }

  function forgeSetField(id, text, isPlaceholder) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('placeholder', isPlaceholder);
  }

  function forgeGetMode() {
    if (_forgeCustomTemplate) return 'custom';
    const card = document.querySelector('.forge-template-card.selected[data-builtin]');
    return card ? card.dataset.builtin : 'call-brief';
  }

  function forgeSetMode(mode) {
    const isAI = mode === 'follow-up' || mode === 'call-brief' || mode === 'exec-summary';
    const isEmail = mode === 'follow-up';
    // Always hide static scoring sections and generated section
    ['fr-overview-section','fr-takeaways-section','fr-dims-section','fr-spiced-section','fr-generated-section']
      .forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
    // Show AI output panel for AI modes, hide otherwise
    document.getElementById('fr-email-section').style.display = isAI ? '' : 'none';
    // Email meta rows (To / Subject) only shown for email mode
    document.querySelectorAll('.fr-email-meta-row').forEach(row => {
      row.style.display = isEmail ? '' : 'none';
    });
    if (!isAI && _forgeCall) {
      document.getElementById('fr-overview-section').style.display = '';
      document.getElementById('fr-takeaways-section').style.display = '';
      if (_forgeCall.dimensions && Object.keys(_forgeCall.dimensions).length)
        document.getElementById('fr-dims-section').style.display = '';
      if (_forgeCall.spiced)
        document.getElementById('fr-spiced-section').style.display = '';
    }
    if (isEmail && _forgeCall) {
      const contact = _forgeCall.contact || _forgeCall.prospect || '';
      document.getElementById('fr-email-to').textContent = contact || '—';
    }
    const labels = { 'follow-up': 'Draft Email →', 'call-brief': 'Generate Brief →', 'exec-summary': 'Generate Summary →' };
    document.getElementById('forgeGenBtn').textContent = labels[mode] || 'Generate →';
    const toggle = document.getElementById('forgeAudienceToggle');
    if (toggle) toggle.style.display = mode === 'call-brief' ? '' : 'none';
  }

  function forgeSetAudience(aud) {
    _forgeBriefAudience = aud;
    document.getElementById('forgeAudInternal').classList.toggle('active', aud === 'internal');
    document.getElementById('forgeAudClient').classList.toggle('active', aud === 'client');
    forgeUpdateTemplateTitles();
  }

  function forgeUpdateTemplateTitles() {
    const active = document.querySelector('.forge-template-card.selected .forge-template-name');
    const name = active ? active.textContent : 'CALL BRIEF';
    const mode = forgeGetMode();
    const audienceSuffix = mode === 'call-brief' ? ` · ${_forgeBriefAudience === 'client' ? 'CLIENT' : 'INTERNAL'}` : '';
    document.getElementById('forgeReportTitle').textContent = `⬡  ${name}${audienceSuffix} — ${_forgeCall ? escHtml(_forgeCall.prospect||'') : 'PREVIEW'}`;
    forgeSetMode(forgeGetMode());
    if (_forgeCall) forgeRenderSignals(_forgeCall);
  }

  function forgeCopy() {
    if (!_forgeCall) return;
    let text;
    const mode = forgeGetMode();
    if (mode === 'follow-up') {
      const subj = document.getElementById('fr-email-subject').textContent.trim();
      const body = document.getElementById('fr-email-body').textContent.trim();
      text = (subj ? 'Subject: ' + subj + '\n\n' : '') + body;
    } else if (mode === 'call-brief' || mode === 'exec-summary') {
      text = document.getElementById('fr-email-body').textContent.trim();
    } else {
      const generated = document.getElementById('fr-generated');
      text = generated && generated.textContent.trim()
        ? generated.textContent
        : forgeComposeText(_forgeCall);
    }
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('forgeCopyBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
    });
  }

  function forgeComposeText(h) {
    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    let out = `CALL BRIEF — ${(h.prospect||'').toUpperCase()}\n`;
    out += `${'─'.repeat(40)}\n`;
    out += `Date:    ${ds}\n`;
    out += `Stage:   ${h.stage||'—'}\n`;
    out += `Grade:   ${h.letter_grade} · ${h.total}/100\n`;
    if (h.grade_label) out += `Summary: ${h.grade_label}\n`;
    out += `\nSTRENGTH\n${h.top_strength||'—'}\n`;
    out += `\nPRIORITY GAP\n${h.top_priority||'—'}\n`;
    if (h.spiced) {
      out += `\nSPICED COVERAGE\n`;
      Object.entries(h.spiced).forEach(([k,v]) => {
        const label = k.charAt(0).toUpperCase()+k.slice(1).replace('_',' ');
        out += `  ${label}: ${v.touched ? (v.summary||'Covered') : 'Not addressed'}\n`;
      });
    }
    if (h.dimensions) {
      out += `\nDIMENSION SCORES\n`;
      Object.entries(h.dimensions).forEach(([name, d]) => {
        out += `  ${name}: ${d.score??0}/100\n`;
      });
    }
    return out;
  }

  function forgeGenerate() {
    if (!_forgeCall) return;
    const mode = forgeGetMode();
    if (mode === 'follow-up')   { forgeGenerateEmail(_forgeCall); return; }
    if (mode === 'call-brief')  { forgeGenerateAI(_forgeCall, 'call-brief'); return; }
    if (mode === 'exec-summary'){ forgeGenerateAI(_forgeCall, 'exec-summary'); return; }
    const h = _forgeCall;
    const text = _forgeCustomTemplate
      ? forgeApplyTemplate(h, _forgeCustomTemplate)
      : forgeComposeText(h);
    const genEl = document.getElementById('fr-generated');
    genEl.textContent = text;
    document.getElementById('fr-generated-section').style.display = '';

    // Show template file attachments if any
    const filesEl = document.getElementById('fr-template-files');
    const files = _forgeCustomTemplate?.files || [];
    if (filesEl) {
      if (files.length) {
        filesEl.style.display = '';
        filesEl.innerHTML = `<div style="font-family:var(--siren-font-hud);font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--siren-text-muted);margin-bottom:6px;">Template Attachments</div>` +
          files.map(f => `<span class="tmpl-file-chip"><a href="${f.data}" download="${escHtml(f.name)}" style="color:inherit;text-decoration:none;">📎 ${escHtml(f.name)}</a></span>`).join('');
      } else {
        filesEl.style.display = 'none';
        filesEl.innerHTML = '';
      }
    }

    genEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('forgeGenBtn').textContent = 'Regenerate';
  }

  async function forgeGenerateEmail(h) {
    const subjectEl = document.getElementById('fr-email-subject');
    const bodyEl    = document.getElementById('fr-email-body');
    const spinner   = document.getElementById('fr-email-spinner');
    const btn       = document.getElementById('forgeGenBtn');

    // Clear and show spinner
    subjectEl.textContent = '';
    bodyEl.textContent = '';
    spinner.style.display = '';
    btn.disabled = true;

    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});

    const dimLines = h.dimensions
      ? Object.entries(h.dimensions).map(([n,d]) => `  • ${n}: ${d.score??0}/100${d.feedback?' — '+d.feedback:''}`).join('\n')
      : '';
    const spicedLines = h.spiced
      ? Object.entries(h.spiced).map(([k,v]) => {
          const l = k.charAt(0).toUpperCase()+k.slice(1).replace('_',' ');
          return `  • ${l}: ${v.touched?(v.summary||'Covered'):'Not addressed'}`;
        }).join('\n')
      : '';
    const nextSteps = Array.isArray(h.next_steps) ? h.next_steps.map(s=>'  • '+s).join('\n') : (h.next_steps||'');

    const prompt = `You are a Solutions Engineer at OneAxiom (a cybersecurity consultancy). Write a professional, warm follow-up email to send to a prospect after a discovery/sales call.

CALL DATA:
- Prospect / Company: ${h.prospect || '—'}
- Contact: ${h.contact || '—'}
- Call Date: ${ds}
- Deal Stage: ${h.stage || '—'}
- Call Grade: ${h.letter_grade} (${h.total}/100) — ${h.grade_label || ''}
- Top Strength observed: ${h.top_strength || '—'}
- Top Priority / Gap: ${h.top_priority || '—'}
${dimLines ? 'Dimension scores:\n'+dimLines : ''}
${spicedLines ? 'SPICED coverage:\n'+spicedLines : ''}
${nextSteps ? 'Agreed next steps:\n'+nextSteps : ''}
${h.notes ? 'Call notes: '+h.notes : ''}

INSTRUCTIONS:
- Output ONLY the email. Start with "Subject: " on the first line, then a blank line, then the body.
- Do not wrap in markdown code blocks or add any meta-commentary.
- Tone: professional but personable, concise (under 200 words for the body).
- Reference specific details from the call (pain points, next steps, stage context) — do not be generic.
- Close with a clear call-to-action tied to the next agreed step.
- Sign off as: ${h.rep || 'the OneAxiom team'}.`;

    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          stream: true,
          system: 'You are a Solutions Engineer writing concise, professional sales emails.',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      spinner.style.display = 'none';

      if (!resp.ok) {
        const raw = await resp.text().catch(()=>'');
        let msg = 'API error ' + resp.status;
        try { const err = JSON.parse(raw); msg = err?.error?.message || msg; } catch {}
        throw new Error(msg + (raw && !raw.startsWith('{') ? ': ' + raw.slice(0,120) : ''));
      }

      let sseBuffer = '';
      let accumulated = '';
      let subjectDone = false;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              accumulated += ev.delta.text;
              // Split subject from body on first blank line
              if (!subjectDone) {
                const blankIdx = accumulated.indexOf('\n\n');
                if (blankIdx !== -1) {
                  subjectEl.textContent = accumulated.slice(0, blankIdx).replace(/^Subject:\s*/i, '').trim();
                  bodyEl.textContent = accumulated.slice(blankIdx + 2);
                  subjectDone = true;
                }
              } else {
                bodyEl.textContent = accumulated.slice(accumulated.indexOf('\n\n') + 2);
              }
            }
          } catch {}
        }
      }

      // Final parse if blank line never appeared mid-stream
      if (!subjectDone && accumulated) {
        const nlnl = accumulated.indexOf('\n\n');
        if (nlnl !== -1) {
          subjectEl.textContent = accumulated.slice(0, nlnl).replace(/^Subject:\s*/i, '').trim();
          bodyEl.textContent = accumulated.slice(nlnl + 2);
        } else {
          bodyEl.textContent = accumulated;
        }
      }

      btn.disabled = false;
      btn.textContent = 'Re-draft';
    } catch (err) {
      spinner.style.display = 'none';
      bodyEl.textContent = 'Error: ' + (err.message || String(err));
      btn.disabled = false;
      btn.textContent = 'Retry';
    }
  }

  async function forgeGenerateAI(h, mode) {
    const bodyEl  = document.getElementById('fr-email-body');
    const spinner = document.getElementById('fr-email-spinner');
    const btn     = document.getElementById('forgeGenBtn');

    bodyEl.textContent = '';
    spinner.style.display = '';
    btn.disabled = true;

    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});
    const dimLines = h.dimensions
      ? Object.entries(h.dimensions).map(([n,d]) => `  • ${n}: ${d.score??0}/100${d.feedback?' — '+d.feedback:''}`).join('\n') : '';
    const spicedLines = h.spiced
      ? Object.entries(h.spiced).map(([k,v]) => {
          const l = k.charAt(0).toUpperCase()+k.slice(1).replace('_',' ');
          return `  • ${l}: ${v.touched?(v.summary||'Covered'):'Not addressed'}`;
        }).join('\n') : '';
    const nextSteps = Array.isArray(h.next_steps) ? h.next_steps.map(s=>'  • '+s).join('\n') : (h.next_steps||'');

    const callData = `Account: ${h.prospect||'—'}
Date: ${ds}
Stage: ${h.stage||'—'}
Grade: ${h.letter_grade} (${h.total}/100) — ${h.grade_label||''}
Rep: ${h.rep||'—'}
Contact: ${h.contact||'—'}
Top Strength: ${h.top_strength||'—'}
Top Priority / Gap: ${h.top_priority||'—'}
${dimLines ? 'Dimension Scores:\n'+dimLines : ''}
${spicedLines ? 'SPICED Coverage:\n'+spicedLines : ''}
${nextSteps ? 'Next Steps:\n'+nextSteps : ''}
${h.notes ? 'Call Notes: '+h.notes : ''}`.trim();

    const isClientBrief = mode === 'call-brief' && _forgeBriefAudience === 'client';
    const clientCallData = `Account: ${h.prospect||'—'}
Date: ${ds}
Stage: ${h.stage||'—'}
Contact: ${h.contact||'—'}
${nextSteps ? 'Next Steps:\n'+nextSteps : ''}
${h.notes ? 'Call Notes: '+h.notes : ''}`.trim();

    const prompts = {
      'call-brief': isClientBrief
        ? `You are a professional sales consultant at OneAxiom (a cybersecurity consultancy). Write a polished post-call summary to send to the client contact. It should feel professional and collaborative — not salesy. Format with clear sections: DISCUSSION SUMMARY, KEY TAKEAWAYS, AGREED NEXT STEPS. Use plain text with section headers in ALL CAPS followed by a colon. Keep it under 250 words. Do not include internal scores, grades, coaching notes, or SPICED framework references.\n\nCALL DATA:\n${clientCallData}`
        : `You are a Solutions Engineer at OneAxiom (a cybersecurity consultancy). Write a concise internal call brief based on the following call data. Format it as a clean internal document with clear sections: Overview, Key Strengths, Priority Gaps, SPICED Coverage (brief), Next Steps, and Coaching Notes. Use plain text with section headers in ALL CAPS followed by a colon. Keep it under 350 words. Do not add meta-commentary.\n\nCALL DATA:\n${callData}`,
      'exec-summary': `You are a Solutions Engineer at OneAxiom (a cybersecurity consultancy). Write a board-ready executive deal summary based on the following call data. Format it with sections: Deal Overview, Business Context, Risk Indicators, SPICED Status, Recommended Next Actions. Use plain text with section headers in ALL CAPS followed by a colon. Keep it professional, concise, under 300 words. Do not add meta-commentary.\n\nCALL DATA:\n${callData}`
    };

    const systemPrompts = {
      'call-brief': isClientBrief
        ? 'You are a professional consultant writing client-facing post-call summaries. Keep the tone warm, professional, and action-oriented. Never include internal scoring, grades, or coaching feedback.'
        : 'You are an expert sales coach writing internal call briefs for a cybersecurity consultancy.',
      'exec-summary': 'You are an expert deal strategist writing executive summaries for a cybersecurity consultancy.'
    };

    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          stream: true,
          system: systemPrompts[mode],
          messages: [{ role: 'user', content: prompts[mode] }]
        })
      });

      spinner.style.display = 'none';

      if (!resp.ok) {
        const raw = await resp.text().catch(()=>'');
        let msg = 'API error ' + resp.status;
        try { const err = JSON.parse(raw); msg = err?.error?.message || msg; } catch {}
        throw new Error(msg);
      }

      let sseBuffer = '', accumulated = '';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              accumulated += ev.delta.text;
              bodyEl.textContent = accumulated;
            }
          } catch {}
        }
      }

      btn.disabled = false;
      btn.textContent = 'Regenerate';
    } catch (err) {
      spinner.style.display = 'none';
      bodyEl.textContent = 'Error: ' + (err.message || String(err));
      btn.disabled = false;
      btn.textContent = 'Retry';
    }
  }

  // Built-in template card click (clears custom template selection)
  document.querySelectorAll('.forge-template-card:not(.locked)[data-builtin]').forEach(card => {
    card.addEventListener('click', () => {
      _forgeCustomTemplate = null;
      document.querySelectorAll('.forge-template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      forgeUpdateTemplateTitles();
    });
  });

  // ── Init ───────────────────────────────────────────────────
  initKeyUI();
  renderMemberList();
  renderLibrary();
  renderTemplates();
  populateReportTypeSelect();
  renderDocList();
  renderHistory();
  initUsageBar();
  forgeInit();
  renderScopePage();

  // ── Chip input helpers ─────────────────────────────────────────
  function scopeChipsFromWrap(wrap) {
    return Array.from(wrap.querySelectorAll('.scope-chip')).map(c => c.childNodes[0].textContent.trim()).filter(Boolean);
  }
  function scopeSaveChips(wrap, company, key) {
    const chips = scopeChipsFromWrap(wrap);
    saveScope(company, key, 'value', chips.join('\n'));
    // Update placeholder visibility
    const inp = wrap.querySelector('.scope-chip-text');
    if (inp) inp.placeholder = chips.length ? '' : 'Type and press Enter…';
  }
  function scopeChipKeydown(e, inp, company, key) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inp.value.trim();
      if (!val) return;
      const wrap = inp.closest('.scope-chip-wrap');
      const chip = document.createElement('span');
      chip.className = 'scope-chip';
      chip.innerHTML = `${escHtml(val)}<button class="scope-chip-x" type="button" onclick="scopeRemoveChip(this,'${company.replace(/'/g,"\\'")}','${key}')">×</button>`;
      wrap.insertBefore(chip, inp);
      inp.value = '';
      scopeSaveChips(wrap, company, key);
    } else if (e.key === 'Backspace' && inp.value === '') {
      const wrap = inp.closest('.scope-chip-wrap');
      const chips = wrap.querySelectorAll('.scope-chip');
      if (chips.length) { chips[chips.length-1].remove(); scopeSaveChips(wrap, company, key); }
    }
  }
  function scopeChipCommit(inp, company, key) {
    const val = inp.value.trim();
    if (!val) return;
    const wrap = inp.closest('.scope-chip-wrap');
    const chip = document.createElement('span');
    chip.className = 'scope-chip';
    chip.innerHTML = `${escHtml(val)}<button class="scope-chip-x" type="button" onclick="scopeRemoveChip(this,'${company.replace(/'/g,"\\'")}','${key}')">×</button>`;
    wrap.insertBefore(chip, inp);
    inp.value = '';
    scopeSaveChips(wrap, company, key);
  }
  function scopeRemoveChip(btn, company, key) {
    const chip = btn.closest('.scope-chip');
    const wrap = chip.closest('.scope-chip-wrap');
    chip.remove();
    scopeSaveChips(wrap, company, key);
  }
  // ── Revision delete ───────────────────────────────────────────
  function scopeDeleteRevision(idx) {
    const sel = document.getElementById('scopeAccountSelect');
    const company = sel && sel.value;
    if (!company) return;
    if (!confirm('Delete this revision?')) return;
    const s = loadScopeAll(company);
    s.revisions.splice(idx, 1);
    saveScopeAll(company, s);
    _scopeViewingRevision = null;
    renderScopeRevBar(company);
    renderScopeFormBody(company);
    document.getElementById('scopeRevBanner').style.display = 'none';
  }

  function saveScope(company, fieldKey, type, val){
    const s=loadScopeAll(company);
    if(!s.draft[fieldKey]) s.draft[fieldKey]={value:'',notes:''};
    s.draft[fieldKey][type]=val;
    saveScopeAll(company, s);
    const el=document.getElementById('scopeSaveStatus');
    if(el){ el.textContent='Saved'; setTimeout(()=>{ el.textContent=''; },1200); }
  }

  function scopeSaveRevision(){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    if(!company) return;
    const s=loadScopeAll(company);
    const n=s.revisions.length+1;
    const ts=new Date();
    const label=`Rev ${n} — ${ts.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})} ${ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    s.revisions.push({ id: ts.getTime(), ts: ts.toISOString(), label, data: JSON.parse(JSON.stringify(s.draft)) });
    saveScopeAll(company, s);
    _scopeViewingRevision = null;
    renderScopeRevBar(company);
    const el=document.getElementById('scopeSaveStatus');
    if(el){ el.textContent='Revision saved'; setTimeout(()=>{ el.textContent=''; },2000); }
  }

  function scopeLoadRevision(val){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    if(!company) return;
    _scopeViewingRevision = val==='draft' ? null : parseInt(val);
    renderScopeFormBody(company);
    const banner=document.getElementById('scopeRevBanner');
    if(banner){
      if(_scopeViewingRevision!==null){
        const s=loadScopeAll(company);
        const rev=s.revisions[_scopeViewingRevision];
        banner.style.display='flex';
        banner.innerHTML=`<span>Viewing ${escHtml(rev?.label||'revision')} — read-only.</span>
          <div style="display:flex;gap:6px;">
            <button onclick="scopeRestoreRevision(${_scopeViewingRevision})" style="background:none;border:1px solid rgba(232,160,32,.5);border-radius:4px;color:#e8a020;font-size:11px;padding:3px 10px;cursor:pointer;">Restore to Draft</button>
            <button onclick="scopeDeleteRevision(${_scopeViewingRevision})" style="background:none;border:1px solid rgba(220,60,60,.4);border-radius:4px;color:#e05050;font-size:11px;padding:3px 10px;cursor:pointer;">Delete</button>
          </div>`;
      } else {
        banner.style.display='none';
      }
    }
  }

  function scopeRestoreRevision(idx){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    if(!company) return;
    const s=loadScopeAll(company);
    const rev=s.revisions[idx];
    if(!rev) return;
    s.draft=JSON.parse(JSON.stringify(rev.data));
    saveScopeAll(company,s);
    _scopeViewingRevision=null;
    document.getElementById('scopeRevSelect').value='draft';
    document.getElementById('scopeRevBanner').style.display='none';
    renderScopeFormBody(company);
    const el=document.getElementById('scopeSaveStatus');
    if(el){ el.textContent='Restored to draft'; setTimeout(()=>{ el.textContent=''; },2000); }
  }

  function renderScopeRevBar(company){
    const s=loadScopeAll(company);
    const revSel=document.getElementById('scopeRevSelect');
    if(!revSel) return;
    const opts=[`<option value="draft">Draft (current)</option>`];
    s.revisions.slice().reverse().forEach((r,i)=>{
      const realIdx=s.revisions.length-1-i;
      opts.push(`<option value="${realIdx}">${escHtml(r.label)}</option>`);
    });
    revSel.innerHTML=opts.join('');
    revSel.value=_scopeViewingRevision===null?'draft':String(_scopeViewingRevision);
  }

  // Multi-value chip input only for fields where multiple simultaneous values are common.
  // Everything else (especially "Number of…" fields) uses a plain single text input.
  const SCOPE_MULTI_FIELDS = new Set([
    slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)'),
    slugField('Primary products & services'),
    slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)'),
    slugField('Key SaaS / third-party apps handling regulated data'),
    slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)'),
    slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)'),
    slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?'),
  ]);

  function isSingleScopeField(field) {
    if (/number of/i.test(field)) return true;
    return !SCOPE_MULTI_FIELDS.has(slugField(field));
  }

  function renderScopeFormBody(company){
    const s=loadScopeAll(company);
    const data=_scopeViewingRevision!==null
      ? (s.revisions[_scopeViewingRevision]?.data||{})
      : s.draft;
    const readonly=_scopeViewingRevision!==null;
    const cEsc=company.replace(/"/g,'&quot;');
    const hasAnyData = Object.keys(data).some(k=>data[k]?.value||data[k]?.notes);
    let html='';
    if(!readonly && !hasAnyData){
      html+=`<div style="background:var(--siren-bg-card);border:1px solid var(--siren-border-mid);border-radius:8px;padding:12px 16px;margin-bottom:1.25rem;font-size:12px;color:var(--siren-text-muted);">
        <strong style="color:var(--siren-cyan-70,#00c8ffb3);">New scope for ${escHtml(company)}</strong> — Fill in the fields below. Data saves automatically as you type. Hit <em>Save Revision</em> to snapshot a version.
      </div>`;
    }
    for(const sec of SCOPE_SECTIONS){
      html+=`<div class="scope-section"><div class="scope-section-header">${sec.title}</div>`;
      html+=`<div class="scope-grid"><div class="scope-col-head">Field</div><div class="scope-col-head">Response / Value</div><div class="scope-col-head">Notes / Detail</div>`;
      for(const field of sec.fields){
        const key=slugField(field);
        const saved=data[key]||{value:'',notes:''};
        const vEsc=saved.value.replace(/"/g,'&quot;');
        const nEsc=saved.notes.replace(/"/g,'&quot;');
        html+=`<div class="scope-label">${escHtml(field)}</div>`;
        if(readonly){
          if(isSingleScopeField(field)){
            html+=`<div class="scope-input" style="cursor:default;opacity:.7;padding:7px 10px;">${escHtml(saved.value)||'<span style="color:var(--siren-text-faint);font-size:.8rem;">—</span>'}</div>`;
          } else {
            const chips=saved.value?saved.value.split('\n').filter(Boolean):[];
            const chipHtml=chips.length ? chips.map(c=>`<span class="scope-chip" style="pointer-events:none;">${escHtml(c)}</span>`).join('')
              : '<span style="color:var(--siren-text-faint);font-size:.8rem;">—</span>';
            html+=`<div class="scope-chip-wrap" style="opacity:.7;cursor:default;">${chipHtml}</div>`;
          }
          html+=`<div class="scope-input scope-notes" style="cursor:default;opacity:.7;">${escHtml(saved.notes)||''}</div>`;
        } else if(isSingleScopeField(field)){
          html+=`<input class="scope-input" type="text" value="${vEsc}" data-company="${cEsc}" data-key="${key}" data-type="value" oninput="saveScope(this.dataset.company,this.dataset.key,'value',this.value)" placeholder="—">`;
          html+=`<input class="scope-input scope-notes" type="text" value="${nEsc}" data-company="${cEsc}" data-key="${key}" data-type="notes" oninput="saveScope(this.dataset.company,this.dataset.key,'notes',this.value)" placeholder="notes…">`;
        } else {
          const chips=saved.value?saved.value.split('\n').filter(Boolean):[];
          const chipHtml=chips.map((c,i)=>`<span class="scope-chip">${escHtml(c)}<button class="scope-chip-x" type="button" onclick="scopeRemoveChip(this,'${cEsc}','${key}')">×</button></span>`).join('');
          html+=`<div class="scope-chip-wrap" data-company="${cEsc}" data-key="${key}" onclick="this.querySelector('.scope-chip-text').focus()">
            ${chipHtml}
            <input class="scope-chip-text" type="text" placeholder="${chips.length?'':'Type and press Enter…'}"
              onkeydown="scopeChipKeydown(event,this,'${cEsc}','${key}')"
              onblur="scopeChipCommit(this,'${cEsc}','${key}')">
          </div>`;
          html+=`<input class="scope-input scope-notes" type="text" value="${nEsc}" data-company="${cEsc}" data-key="${key}" data-type="notes" oninput="saveScope(this.dataset.company,this.dataset.key,'notes',this.value)" placeholder="notes…">`;
        }
      }
      html+=`</div></div>`;
    }
    document.getElementById('scopeForm').innerHTML=html;
  }


  function onScopeAccountChange(){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    const empty=document.getElementById('scopeEmpty');
    const formWrap=document.getElementById('scopeFormWrap');
    _scopeViewingRevision=null;
    if(!company){
      empty.style.display=''; formWrap.style.display='none'; return;
    }
    // Ensure a record exists in storage so future visits show the form
    saveScopeAll(company, loadScopeAll(company));
    empty.style.display='none'; formWrap.style.display='';
    renderScopeRevBar(company);
    renderScopeFormBody(company);
    document.getElementById('scopeRevBanner').style.display='none';
  }

  function getScopeCompanies(){
    const fromCalls = getLcCompanies();
    let scopeOnly = [];
    try { scopeOnly = JSON.parse(localStorage.getItem('oa_scope_companies')||'[]'); } catch {}
    return [...new Set([...fromCalls, ...scopeOnly])].sort((a,b)=>a.localeCompare(b));
  }

  function renderScopePage(){
    const sel=document.getElementById('scopeAccountSelect');
    if(!sel) return;
    const prev=sel.value;
    const companies=getScopeCompanies();
    sel.innerHTML='<option value="">— select account —</option>'+companies.map(c=>`<option value="${c}"${c===prev?' selected':''}>${c}</option>`).join('');
    if(prev && companies.includes(prev)){ sel.value=prev; onScopeAccountChange(); }
  }

  function scopeAddAccountPrompt(){
    const row=document.getElementById('scopeNewAccountRow');
    if(!row) return;
    row.style.display='flex';
    document.getElementById('scopeNewAccountInput').focus();
  }

  function scopeHideNewAccount(){
    const row=document.getElementById('scopeNewAccountRow');
    if(row) row.style.display='none';
    const inp=document.getElementById('scopeNewAccountInput');
    if(inp) inp.value='';
  }

  function scopeCreateAccount(){
    const inp=document.getElementById('scopeNewAccountInput');
    const name=(inp?.value||'').trim();
    if(!name) return;
    let existing=[];
    try{ existing=JSON.parse(localStorage.getItem('oa_scope_companies')||'[]'); }catch{}
    if(!existing.map(c=>c.toLowerCase()).includes(name.toLowerCase())){
      existing.push(name); localStorage.setItem('oa_scope_companies',JSON.stringify(existing));
    }
    scopeHideNewAccount();
    renderScopePage();
    const sel=document.getElementById('scopeAccountSelect');
    if(sel){ sel.value=name; onScopeAccountChange(); }
  }

  function scopeExportForProspect(){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    if(!company){ alert('Select an account first.'); return; }
    const s=loadScopeAll(company);
    const draft=s.draft||{};

    const fieldRows = SCOPE_SECTIONS.map(sec => {
      const rows = sec.fields.map(field => {
        const key = slugField(field);
        const saved = draft[key]||{value:'',notes:''};
        const existing = (saved.value||'').split('\n').filter(v=>v.trim());
        const isMulti = existing.length > 1;
        const displayVal = isMulti ? existing.join(', ') : (existing[0]||'');
        const inputHtml = `<textarea name="${key}" rows="2" style="width:100%;box-sizing:border-box;background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:14px;color:#111827;font-family:inherit;resize:vertical;">${displayVal.replace(/</g,'&lt;')}</textarea>`;
        return `<div style="margin-bottom:16px;"><label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">${field.replace(/</g,'&lt;')}</label>${inputHtml}</div>`;
      }).join('');
      return `<div style="margin-bottom:28px;"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#6366f1;text-transform:uppercase;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:16px;">${sec.title}</div>${rows}</div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scoping Questionnaire — ${company.replace(/</g,'&lt;')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;color:#111827;padding:32px 16px;}
  .card{max-width:780px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.08);padding:40px 48px;}
  h1{font-size:24px;font-weight:700;margin-bottom:4px;color:#111827;}
  .sub{font-size:14px;color:#6b7280;margin-bottom:32px;}
  textarea:focus{outline:2px solid #6366f1;border-color:#6366f1;background:#fff;}
  .btn{display:inline-block;background:#6366f1;color:#fff;border:none;border-radius:8px;padding:14px 32px;font-size:15px;font-weight:700;cursor:pointer;margin-top:24px;}
  .btn:hover{background:#4f46e5;}
  .note{font-size:12px;color:#9ca3af;margin-top:12px;}
</style>
</head>
<body>
<div class="card">
  <h1>Scoping Questionnaire</h1>
  <p class="sub">Account: <strong>${company.replace(/</g,'&lt;')}</strong> &mdash; Please fill in as much as you can and click <em>Download My Responses</em> when done. Email the downloaded file back to us.</p>
  <form id="scopeForm">
    ${fieldRows}
  </form>
  <button class="btn" onclick="downloadResponses()">Download My Responses</button>
  <p class="note">Your answers are never sent automatically &mdash; you control the file before sending it.</p>
</div>
<script>
function downloadResponses(){
  const form = document.getElementById('scopeForm');
  const inputs = form.querySelectorAll('textarea');
  const responses = {};
  inputs.forEach(inp => {
    if(inp.value.trim()) responses[inp.name] = { value: inp.value.trim(), notes: '' };
  });
  const payload = JSON.stringify({ company: ${JSON.stringify(company)}, exported: new Date().toISOString(), responses }, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(payload);
  a.download = 'scope-responses-${company.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.json';
  a.click();
}
<\/script>
</body>
</html>`;

    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scope-questionnaire-${company.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function scopeImportResponses(input){
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
      try{
        const data = JSON.parse(e.target.result);
        if(!data.company || !data.responses){ alert('Invalid responses file.'); return; }
        const targetCompany = data.company;
        // ensure company exists in selector
        const sel = document.getElementById('scopeAccountSelect');
        let found = false;
        for(const opt of sel.options){ if(opt.value===targetCompany){ found=true; break; } }
        if(!found){
          const companies = JSON.parse(localStorage.getItem('oa_scope_companies')||'[]');
          companies.push(targetCompany);
          localStorage.setItem('oa_scope_companies', JSON.stringify(companies));
          renderScopeAccountSelect();
        }
        sel.value = targetCompany;
        onScopeAccountChange();
        // merge responses into draft
        const s = loadScopeAll(targetCompany);
        for(const [key, val] of Object.entries(data.responses)){
          if(!s.draft[key]) s.draft[key] = {value:'',notes:''};
          s.draft[key].value = val.value||'';
          if(val.notes) s.draft[key].notes = val.notes;
        }
        saveScopeAll(targetCompany, s);
        _scopeViewingRevision = null;
        renderScopeFormBody(targetCompany);
        const st = document.getElementById('scopeSaveStatus');
        if(st){ st.textContent='Responses imported'; setTimeout(()=>{st.textContent='';},2500); }
      }catch(err){ alert('Could not parse file: '+err.message); }
    };
    reader.readAsText(file);
    input.value='';
  }

  function exportScope(){
    const sel=document.getElementById('scopeAccountSelect');
    const company=sel&&sel.value;
    if(!company){ alert('Select an account first.'); return; }
    const s=loadScopeAll(company);
    const data=_scopeViewingRevision!==null
      ? (s.revisions[_scopeViewingRevision]?.data||{})
      : s.draft;
    const revLabel=_scopeViewingRevision!==null
      ? (s.revisions[_scopeViewingRevision]?.label||'Revision')
      : `Draft — ${new Date().toLocaleString()}`;
    let lines=[`SCOPE — ${company}`,revLabel,''];
    for(const sec of SCOPE_SECTIONS){
      lines.push(`=== ${sec.title} ===`);
      for(const field of sec.fields){
        const key=slugField(field);
        const saved=data[key]||{value:'',notes:''};
        lines.push(`${field}: ${saved.value||'(blank)'}${saved.notes?' ['+saved.notes+']':''}`);
      }
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n')).then(()=>{
      const el=document.getElementById('scopeSaveStatus');
      if(el){ el.textContent='Copied to clipboard'; setTimeout(()=>{ el.textContent=''; },2000); }
    }).catch(()=>{ alert('Copy failed'); });
  }

  // ── Demo data seed ──────────────────────────────────────────────────────
  // Role rules enforced:
  //   ISR (Ruben, Ryan)   — Cold outreach only
  //   AE (Andie)          — All stages; cold outreach limited to 1 account (Perimeter Law)
  //   SE (Michael)        — Discovery, Demo, Quote Review, optional Touchpoint; never on exec calls with President
  //   CRO (Paulo)         — Late Touchpoints + Proposal/close; MAYBE quote review
  //   President (Camilo)  — Late Touchpoints only; never on same call as SE
  function seedDemoData() {
    const now = Date.now();

    // Dimensions helper — object keyed by name (matches Object.entries usage in codebase)
    const dims = (o,d,te,v,s,c) => ({
      'Opening & agenda control':           { score: o,  max: 15 },
      'Discovery & needs assessment':       { score: d,  max: 20 },
      'Value articulation & demo delivery': { score: te, max: 20 },
      'Objection handling & MEDDIC signals':{ score: v,  max: 15 },
      'SPICED qualification':               { score: s,  max: 15 },
      'Call control & next steps':          { score: c,  max: 15 },
    });

    const demoHistory = [

      // ── Meridian Financial Group ─────────────────────────────────────────
      // Ruben (ISR) — cold call only
      // Andie (AE) — Discovery, Demo, Touchpoint, Proposal
      // Michael (SE) — joins Demo
      // Paulo (CRO) — joins Touchpoint and Proposal
      {
        id: 'demo-mfg-1', ts: new Date('2026-03-05T09:15:00').toISOString(),
        prospect: 'Meridian Financial Group', rep: 'Ruben Posada', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-03-05', letter_grade: 'C', total: 52,
        dimensions: dims(9,8,8,10,8,9),
        top_strength: 'Good cold opener — got the prospect talking about their upcoming SOC 2 audit',
        top_priority: 'Did not qualify budget authority or confirm the right economic buyer',
        next_steps: ['Send intro email with OneAxiom overview deck', 'Request 30-min discovery call with IT Director'],
        overview: 'Ruben landed the cold call well — got past the gatekeeper and earned a conversation. He moved too quickly to features before establishing pain. The prospect mentioned a pending SOC 2 audit but Ruben did not probe the timeline or consequences of failure.',
      },
      {
        id: 'demo-mfg-2', ts: new Date('2026-03-28T14:00:00').toISOString(),
        prospect: 'Meridian Financial Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-03-28', letter_grade: 'B-', total: 67,
        dimensions: dims(11,13,11,11,11,10),
        top_strength: 'Surfaced the SOC 2 timeline and board-level pressure — strong pain anchoring',
        top_priority: 'Economic buyer (CFO) was not on the call and was never confirmed as a next step',
        next_steps: ['Send follow-up email recapping SOC 2 scope discussion', 'Schedule CFO intro before technical evaluation', 'Confirm assessment timeline fits Q3 board deadline'],
        overview: 'Andie effectively built on the cold call context Ruben handed off. She probed the SOC 2 gap and tied it to a Q3 board presentation deadline. Discovery was solid on pain and situation. SPICED gaps remain: economic buyer unconfirmed and no quantified impact of non-compliance established.',
      },
      {
        id: 'demo-mfg-3', ts: new Date('2026-04-22T10:30:00').toISOString(),
        prospect: 'Meridian Financial Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-04-22', letter_grade: 'B', total: 74,
        dimensions: dims(13,15,14,12,12,8),
        top_strength: 'Michael mapped OneAxiom\'s methodology to their SOC 2 Type II readiness gaps — very persuasive',
        top_priority: 'Next steps were weak — no clear owner or date for proposal delivery',
        next_steps: ['Deliver scoping questionnaire by April 28', 'Schedule proposal review with CFO and IT Director', 'Confirm Paulo joins for executive-level proposal call'],
        overview: 'Andie led the call; Michael ran the technical walkthrough. The IT Director was engaged and asked detailed questions about evidence collection. Value alignment was clear. The weak point was the close — the call ended without locking in a proposal review date or confirming CFO availability.',
      },
      {
        id: 'demo-mfg-4', ts: new Date('2026-05-06T11:00:00').toISOString(),
        prospect: 'Meridian Financial Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-05-06', letter_grade: 'B-', total: 69,
        dimensions: dims(12,13,13,12,11,8),
        top_strength: 'Paulo\'s CRO presence elevated the conversation and got the CFO fully engaged',
        top_priority: 'Andie lost track of the agenda after Paulo joined — call ran over and next steps were rushed',
        next_steps: ['Send proposal draft by May 12', 'Confirm CFO calendar for proposal review call', 'Paulo to send exec-level follow-up reinforcing OneAxiom\'s leadership commitment'],
        overview: 'A pre-proposal executive touchpoint with Andie and Paulo. The CFO entered guarded but Paulo\'s credibility and peer-to-peer framing shifted the dynamic. Andie struggled briefly to re-take call control after Paulo spoke, leading to an overrun and rushed close. Proposal is ready.',
      },
      {
        id: 'demo-mfg-5', ts: new Date('2026-05-15T13:00:00').toISOString(),
        prospect: 'Meridian Financial Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-05-15', letter_grade: 'B+', total: 81,
        dimensions: dims(13,16,15,14,13,10),
        top_strength: 'Handled the scope-reduction objection cleanly; Paulo re-anchored to board deadline urgency',
        top_priority: 'Payment terms and contract start date were not confirmed before ending the call',
        next_steps: ['Send revised proposal with two scope options by May 19', 'Confirm legal review timeline with their counsel', 'Block kickoff date contingent on signed SOW'],
        overview: 'Strong proposal call with Andie leading and Paulo present. Two pricing options gave the CFO agency without losing deal value. Paulo\'s brief reinforcement of executive commitment helped neutralize a scope objection. Minor gap: contract logistics were left open, creating potential for a stall.',
      },

      // ── Northgate Healthcare Systems ─────────────────────────────────────
      // Ryan (ISR) — cold call only
      // Andie (AE) — Discovery ×2, Demo, Touchpoint, Proposal
      // Michael (SE) — joins 2nd Discovery and Demo (NOT on exec touchpoint with Camilo)
      // Camilo (President) — exec Touchpoint only (no SE)
      // Paulo (CRO) — Proposal
      {
        id: 'demo-nhs-1', ts: new Date('2026-03-12T08:45:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-03-12', letter_grade: 'C-', total: 47,
        dimensions: dims(7,8,7,9,7,9),
        top_strength: 'Identified HIPAA breach history as a strong hook early in the call',
        top_priority: 'Lost control when asked about pricing — pivoted defensively instead of redirecting to discovery',
        next_steps: ['Send healthcare compliance case study', 'Request 45-min discovery with IT and compliance team'],
        overview: 'Ryan identified a prior breach notification incident as a strong opener but could not sustain momentum. When the prospect pushed on pricing too early, Ryan fumbled and spent five minutes on budget before re-establishing discovery. Ended without a firm next step.',
      },
      {
        id: 'demo-nhs-2', ts: new Date('2026-04-02T10:00:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-04-02', letter_grade: 'C+', total: 59,
        dimensions: dims(10,11,9,11,9,9),
        top_strength: 'Connected prior breach to HHS-OCR audit risk — strong pain escalation from Ryan\'s cold call context',
        top_priority: 'CISO was on the call but was not engaged — Andie spoke primarily to the IT Manager',
        next_steps: ['Re-engage CISO directly with a targeted exec summary of HIPAA gap exposure', 'Set up second discovery with CISO and compliance officer', 'Confirm Q3 HHS exam date is a hard deadline'],
        overview: 'Andie picked up where Ryan left off and established the breach-to-audit risk narrative effectively. Discovery stalled at the IT Manager level. The CISO joined quietly and dropped off early without being drawn into the conversation. Pain is confirmed but the economic buyer chain remains unclear.',
      },
      {
        id: 'demo-nhs-3', ts: new Date('2026-04-18T14:30:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-04-18', letter_grade: 'B-', total: 67,
        dimensions: dims(12,14,10,12,11,8),
        top_strength: 'CISO confirmed Q3 HHS audit as a hard deadline — urgency now fully established',
        top_priority: 'Decision process still unclear — no confirmation of who signs the engagement letter',
        next_steps: ['Schedule demo with Michael for technical depth', 'Send HIPAA assessment scope document', 'Confirm CISO availability for full technical session'],
        overview: 'Second discovery call successfully brought the CISO into the conversation. The Q3 HHS exam deadline is now locked as the hard driver. Michael joined briefly in the last 10 minutes to tease the technical assessment approach, which created immediate interest. Handoff to demo stage is ready.',
      },
      {
        id: 'demo-nhs-4', ts: new Date('2026-05-08T11:00:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-05-08', letter_grade: 'B+', total: 82,
        dimensions: dims(13,16,16,13,13,11),
        top_strength: 'Michael\'s technical depth on HIPAA evidence collection gave the CISO immediate confidence',
        top_priority: 'BAA execution timeline was not confirmed — legal dependency could delay the start date',
        next_steps: ['Deliver executive summary to CISO by May 14', 'Initiate BAA review with their legal counsel', 'Confirm CFO intro before proposal submission'],
        overview: 'Andie and Michael ran an excellent demonstration session. The CISO asked detailed questions about evidence collection methodology and Michael answered without hesitation. Credibility is high. The BAA requirement surfaced late in the call and needs immediate attention to protect the deal timeline.',
      },
      {
        id: 'demo-nhs-5', ts: new Date('2026-05-27T09:00:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-05-27', letter_grade: 'B', total: 72,
        dimensions: dims(12,13,13,12,12,10),
        top_strength: 'Camilo\'s executive presence established OneAxiom\'s leadership commitment — prospect CEO visibly reassured',
        top_priority: 'Andie should have led with a tighter agenda brief before handing the floor to Camilo',
        next_steps: ['Prepare proposal framed around Phase 1 HIPAA assessment priority', 'Confirm legal team availability for BAA review week of June 2', 'Paulo to follow up with CFO on investment and phased engagement model'],
        overview: 'A well-timed executive touchpoint with Andie and Camilo (President). Michael was not on this exec-format call. The prospect CEO, who had been hesitant, became noticeably more engaged once Camilo spoke to OneAxiom\'s delivery track record. The conversation set up the proposal strongly.',
      },
      {
        id: 'demo-nhs-6', ts: new Date('2026-06-02T09:00:00').toISOString(),
        prospect: 'Northgate Healthcare Systems', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-06-02', letter_grade: 'A-', total: 87,
        dimensions: dims(14,17,17,14,14,11),
        top_strength: 'Closed with verbal commitment; Paulo\'s presence aligned the CFO on investment and phased structure',
        top_priority: 'Payment terms discussion was deferred — CFO may revisit scope before signing',
        next_steps: ['Send countersigned SOW by June 6', 'Confirm BAA execution with their legal by June 9', 'Schedule kickoff call for week of June 16'],
        overview: 'Textbook proposal call with Andie leading and Paulo present. Andie re-established urgency with the Q3 HHS deadline, walked the CFO through the two-phase engagement structure, and handled a late-stage budget objection by splitting scope into a Phase 1 priority assessment. Verbal commitment received.',
      },

      // ── Cascade Manufacturing Co. ─────────────────────────────────────────
      // Ruben (ISR) — cold call only
      // Andie (AE) — Discovery, Demo, Proposal
      // Michael (SE) — joins Discovery and Demo
      // Paulo (CRO) — joins Proposal
      {
        id: 'demo-cmc-1', ts: new Date('2026-04-08T08:30:00').toISOString(),
        prospect: 'Cascade Manufacturing Co.', rep: 'Ruben Posada', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-04-08', letter_grade: 'D+', total: 43,
        dimensions: dims(7,7,7,8,7,7),
        top_strength: 'Identified CMMC as relevant once DoD subcontract was mentioned — correct instinct',
        top_priority: 'Called without researching the prospect\'s DoD contract — appeared completely unprepared',
        next_steps: ['Research DoD contract details and CMMC Level 2 requirements before re-engaging', 'Send CMMC-specific intro email referencing their contract renewal window'],
        overview: 'Rough cold call. Ruben led with a generic cybersecurity pitch before the prospect mentioned their DoD subcontract. Once CMMC was identified as the real driver, Ruben pivoted, but the early impression of being unprepared was hard to recover from. Prospect agreed to discovery out of necessity, not enthusiasm.',
      },
      {
        id: 'demo-cmc-2', ts: new Date('2026-04-28T13:00:00').toISOString(),
        prospect: 'Cascade Manufacturing Co.', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-04-28', letter_grade: 'B-', total: 65,
        dimensions: dims(11,13,12,11,10,8),
        top_strength: 'Anchored the entire call to CMMC Level 2 certification timeline and DoD contract renewal risk',
        top_priority: 'No internal champion confirmed — Andie spoke primarily to the VP of Operations who may lack budget authority',
        next_steps: ['Request intro to their CMMC POC or compliance lead', 'Michael to review current security controls documentation before demo', 'Confirm contract renewal date — is August deadline firm?'],
        overview: 'Andie recovered the credibility lost in Ruben\'s cold call. The CMMC framing was tight and the prospect acknowledged zero documentation for Level 2 requirements. Gap: no internal champion identified — the VP of Ops may not be the right buyer for a compliance engagement of this size.',
      },
      {
        id: 'demo-cmc-3', ts: new Date('2026-05-20T10:00:00').toISOString(),
        prospect: 'Cascade Manufacturing Co.', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-05-20', letter_grade: 'B', total: 74,
        dimensions: dims(13,15,14,12,12,8),
        top_strength: 'Michael\'s live gap walk-through against 110 CMMC Level 2 practices was highly persuasive',
        top_priority: 'CFO was not present; VP of Ops cannot approve budget — deal at risk of stalling',
        next_steps: ['Get CFO on a 30-min call before proposal submission', 'Send technical assessment scope mapped to CMMC Level 2 practices', 'Confirm Paulo\'s availability if CFO meeting requires executive credibility'],
        overview: 'Strong technical session with Andie leading and Michael driving the CMMC gap walk-through. The VP of Ops was enthusiastic but cannot approve the engagement budget. CFO introduction is the critical next step to protect the deal from stalling at the champion level.',
      },
      {
        id: 'demo-cmc-4', ts: new Date('2026-06-05T15:00:00').toISOString(),
        prospect: 'Cascade Manufacturing Co.', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-06-05', letter_grade: 'A-', total: 88,
        dimensions: dims(14,18,17,14,13,12),
        top_strength: 'Paulo framed non-compliance as a contract termination risk — CFO approved budget on the call',
        top_priority: 'Payment terms and contract start date were not finalized before ending the call',
        next_steps: ['Send final proposal with CMMC Level 2 scope by June 9', 'Confirm CFO signature authority and legal review window', 'Block kickoff date — prospect wants to start before July 1'],
        overview: 'Excellent close call with Andie and Paulo presenting together. Paulo framed the CMMC assessment as a contract protection measure rather than a consulting expense — the CFO responded immediately. Budget objection neutralized by tying cost to the DoD contract value at risk. Minor gap: logistics left open.',
      },

      // ── Vantara Logistics ─────────────────────────────────────────────────
      // Ryan (ISR) — cold call only
      // Andie (AE) — Discovery ×2, Demo
      // Michael (SE) — joins 2nd Discovery and Demo
      {
        id: 'demo-vl-1', ts: new Date('2026-05-01T09:00:00').toISOString(),
        prospect: 'Vantara Logistics', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-05-01', letter_grade: 'D+', total: 41,
        dimensions: dims(7,6,7,8,6,7),
        top_strength: 'Persisted through initial skepticism and earned a discovery conversation',
        top_priority: 'Prospect mentioned a bad prior vendor experience and Ryan did not address it — this will haunt future calls',
        next_steps: ['Brief Andie on prior vendor context before discovery', 'Lead next call by directly acknowledging prior experience before any product discussion'],
        overview: 'Vantara\'s VP of IT mentioned a failed engagement with a prior security consultancy in the first two minutes. Ryan acknowledged it briefly and immediately pivoted to OneAxiom\'s methodology. This was a mistake — the wound is still fresh. Prospect agreed to discovery reluctantly.',
      },
      {
        id: 'demo-vl-2', ts: new Date('2026-05-22T14:00:00').toISOString(),
        prospect: 'Vantara Logistics', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-05-22', letter_grade: 'C-', total: 50,
        dimensions: dims(9,9,8,8,8,8),
        top_strength: 'Directly addressed prior vendor failure in the first five minutes — set the right tone',
        top_priority: 'Prospect remains guarded — real business pain has not been surfaced yet',
        next_steps: ['Bring Michael on next call to add technical credibility', 'Request introduction to CISO — VP IT may not be the right discovery contact', 'Share a logistics-sector reference story before next call'],
        overview: 'Andie acknowledged the prior vendor failure upfront which improved prospect posture, but the session stayed surface-level. The VP IT is engaging but not sharing real context. A second discovery call with Michael adding technical credibility may help break through the defensiveness.',
      },
      {
        id: 'demo-vl-3', ts: new Date('2026-06-08T10:30:00').toISOString(),
        prospect: 'Vantara Logistics', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-06-08', letter_grade: 'C', total: 57,
        dimensions: dims(9,10,10,9,9,10),
        top_strength: 'Michael\'s technical questions surfaced real endpoint visibility gaps the VP IT hadn\'t wanted to admit',
        top_priority: 'Still no CISO access — discovery cannot be completed without an economic buyer in the room',
        next_steps: ['Ask VP IT to facilitate CISO intro before advancing to demo', 'Send logistics sector case study with documented outcomes', 'Target demo only after CISO is confirmed on the invite'],
        overview: 'Measurable improvement with Michael on the call. His technical credibility broke through the skepticism enough to surface real gap context around endpoint visibility. However, without CISO access, discovery remains incomplete and demo scheduling is premature.',
      },
      {
        id: 'demo-vl-4', ts: new Date('2026-06-10T14:00:00').toISOString(),
        prospect: 'Vantara Logistics', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-06-10', letter_grade: 'C+', total: 63,
        dimensions: dims(11,12,12,10,10,8),
        top_strength: 'CISO joined the demo and responded positively to the endpoint assessment framework',
        top_priority: 'Value proposition still not differentiated from prior vendor — this objection must be resolved before proposal',
        next_steps: ['Prepare one-page differentiation brief comparing prior vendor approach vs OneAxiom methodology', 'Confirm CISO as champion and secure a 1:1 before proposal', 'Target proposal submission by June 25 if CISO confirms interest'],
        overview: 'CISO finally attended. Andie and Michael ran the demo with the prior vendor context in mind, emphasizing methodology differences. The CISO was engaged and asked follow-up questions about the gap assessment structure. The prospect is moving but slowly — prior trust damage still present.',
      },

      // ── Pinnacle Credit Union ─────────────────────────────────────────────
      // Ryan (ISR) — cold call only
      // Andie (AE) — Discovery, Demo, Proposal
      // Michael (SE) — joins Demo
      {
        id: 'demo-pcu-1', ts: new Date('2026-05-28T08:00:00').toISOString(),
        prospect: 'Pinnacle Credit Union', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-05-28', letter_grade: 'C', total: 56,
        dimensions: dims(10,9,9,10,9,9),
        top_strength: 'Tied the pitch to NCUA cybersecurity examination expectations — right regulatory hook',
        top_priority: 'Call ran too long — Ryan presented the solution for 8 minutes before completing discovery',
        next_steps: ['Send NCUA cybersecurity regulation summary with OneAxiom positioning', 'Book 45-min discovery with VP of IT and compliance officer'],
        overview: 'Solid cold call. Ryan correctly identified NCUA examination pressure and got the prospect to acknowledge they have not had an external assessment in three years. The call ran long because Ryan started presenting the service before completing discovery. Ended with a booked follow-up.',
      },
      {
        id: 'demo-pcu-2', ts: new Date('2026-06-05T13:30:00').toISOString(),
        prospect: 'Pinnacle Credit Union', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-06-05', letter_grade: 'B-', total: 66,
        dimensions: dims(12,13,11,12,10,8),
        top_strength: 'Uncovered a board-level request for a cybersecurity report tied to their Q3 member meeting',
        top_priority: 'Critical Event timing was confirmed but the next step was not scoped to that hard deadline',
        next_steps: ['Send scoping questionnaire this week to qualify assessment scope', 'Schedule demo with Michael for technical walkthrough', 'Confirm whether board presentation narrative is a deliverable we can support'],
        overview: 'Good first AE-level discovery call. Andie surfaced a board-level reporting requirement that Ryan had not uncovered — this changes the urgency profile significantly. The Q3 member meeting creates a hard deadline for a cybersecurity narrative. Next step should be scoped to that deliverable.',
      },
      {
        id: 'demo-pcu-3', ts: new Date('2026-06-10T10:00:00').toISOString(),
        prospect: 'Pinnacle Credit Union', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-06-10', letter_grade: 'B', total: 73,
        dimensions: dims(13,14,14,12,11,9),
        top_strength: 'Michael\'s demo of the assessment report output directly addressed the board presentation requirement',
        top_priority: 'VP IT raised a resource constraint concern — internal readiness for the assessment is unconfirmed',
        next_steps: ['Send sample board-ready cybersecurity assessment report for review', 'Confirm internal champion can dedicate time to the evidence collection process', 'Target proposal delivery by June 16 to hit Q3 board prep window'],
        overview: 'Andie and Michael ran a tight demo anchored around the board presentation deliverable. Michael\'s ability to show a sample output report immediately resonated with both the VP IT and compliance officer. A resource concern from the VP IT needs to be addressed before proposal to avoid scope-reduction requests.',
      },

      // ── Strata Defense Solutions ──────────────────────────────────────────
      // DoD prime contractor, CMMC Level 3, large enterprise deal — longest cycle
      // Ruben (ISR) — cold call only
      // Andie (AE) — Discovery ×2, Demo, Touchpoint ×2, Proposal
      // Michael (SE) — Discovery ×2 and Demo; NOT on exec touchpoints
      // Camilo (President) — exec Touchpoint only (no SE on this call)
      // Paulo (CRO) — CRO Touchpoint + Proposal
      {
        id: 'demo-sds-1', ts: new Date('2026-01-14T09:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Ruben Posada', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-01-14', letter_grade: 'C+', total: 58,
        dimensions: dims(10,9,10,10,10,9),
        top_strength: 'Led with CMMC Level 3 framing for a DoD prime — correct and well-researched hook',
        top_priority: 'Overpromised on timeline — said we could complete CMMC Level 3 readiness in 60 days, which is not accurate',
        next_steps: ['Correct timeline expectations before discovery call', 'Send CMMC Level 3 overview document and accurate scoping benchmarks', 'Request discovery with CISO and compliance program lead'],
        overview: 'Ruben came into this call prepared — he had researched their DoD prime contract scope and correctly led with CMMC Level 3. The hook landed well. The error was overstating the delivery timeline under pressure from the prospect. This needs to be walked back cleanly in discovery to protect credibility.',
      },
      {
        id: 'demo-sds-2', ts: new Date('2026-02-03T10:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-02-03', letter_grade: 'B-', total: 66,
        dimensions: dims(11,13,12,11,11,8),
        top_strength: 'Cleanly corrected the timeline misstatement from cold call — rebuilt credibility immediately',
        top_priority: 'CISO was guarded about sharing current security posture; discovery depth was limited by this resistance',
        next_steps: ['Send NDA before second discovery to unlock more posture details', 'Michael to research current DoD contractor security requirements for sector context', 'Confirm DFARS 7012 compliance status before second discovery call'],
        overview: 'Andie addressed the timeline correction in the first three minutes, which visibly impressed the CISO. Discovery uncovered the deal driver: a December contract renewal requires CMMC L3 certification evidence. Deal size is significant. CISO reticence about sharing current posture is a trust gap to close.',
      },
      {
        id: 'demo-sds-3', ts: new Date('2026-02-24T14:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-02-24', letter_grade: 'B', total: 72,
        dimensions: dims(12,14,13,13,12,8),
        top_strength: 'NDA in place; CISO shared full current-state posture including known Level 3 gaps',
        top_priority: 'Technical scope is now large — must confirm with Michael whether a 90-day assessment is achievable',
        next_steps: ['Schedule technical deep-dive demo with Michael', 'Validate 90-day assessment feasibility internally before committing', 'Identify whether CTO needs to be brought into the conversation'],
        overview: 'Post-NDA discovery was substantially more open. The CISO shared a detailed gap list across Level 3 practices and the scale of the engagement is now clear. Andie and Michael managed the scope conversation well. Michael needs to confirm delivery feasibility before the demo to ensure proposal credibility.',
      },
      {
        id: 'demo-sds-4', ts: new Date('2026-03-18T10:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-03-18', letter_grade: 'B+', total: 80,
        dimensions: dims(13,16,16,13,13,9),
        top_strength: 'Michael\'s live walk-through of the CMMC Level 3 practice mapping was technically excellent and clearly differentiated',
        top_priority: 'CTO joined unexpectedly and asked questions outside Michael\'s prepared scope — some were not fully answered',
        next_steps: ['Send CTO-specific follow-up addressing build vs buy architecture questions', 'Confirm exec touchpoint with Camilo — deal size warrants President-level presence', 'Target proposal timeline: April 15 pending exec alignment'],
        overview: 'Andie and Michael delivered the strongest demo of this deal cycle. The CISO was visibly impressed. The unexpected CTO presence introduced off-script questions around integration architecture that were handled adequately but not crisply. An executive touchpoint with Camilo is now warranted given the deal size.',
      },
      {
        id: 'demo-sds-5', ts: new Date('2026-04-10T11:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-04-10', letter_grade: 'B', total: 71,
        dimensions: dims(12,13,13,12,12,9),
        top_strength: 'Camilo\'s executive credibility and direct DoD sector experience resonated strongly with their VP of Programs',
        top_priority: 'Andie\'s intro framing before handing to Camilo was too long — exec calls need tighter agendas',
        next_steps: ['Paulo to follow up with their CFO on investment structure before proposal', 'Confirm Phase 1 vs full Level 3 scope for proposal', 'Andie to reconnect with CISO and confirm exec alignment outcome'],
        overview: 'An executive alignment touchpoint with Andie and Camilo (President). Michael was not included in this exec-format call. Camilo\'s DoD sector credibility was the right match for this audience. His presence effectively removed the remaining vendor-risk concern and opened the path to a commercial conversation.',
      },
      {
        id: 'demo-sds-6', ts: new Date('2026-05-02T13:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-05-02', letter_grade: 'B+', total: 77,
        dimensions: dims(13,15,14,13,12,10),
        top_strength: 'Paulo walked CFO through the phased investment model and pre-empted the budget objection before it surfaced',
        top_priority: 'No firm proposal delivery date was locked — Paulo should have driven a harder commitment',
        next_steps: ['Deliver proposal draft to Andie by May 10', 'Paulo to send CFO-level investment summary with ROI framing', 'Set proposal review call for week of May 26'],
        overview: 'A CFO-focused commercial touchpoint with Andie and Paulo (CRO). Paulo\'s pre-emptive handling of the phased investment structure was well-timed and prevented the typical budget stall. The CFO is now aligned in principle. No proposal date was formally committed to — a gap that Andie should close.',
      },
      {
        id: 'demo-sds-7', ts: new Date('2026-05-28T10:00:00').toISOString(),
        prospect: 'Strata Defense Solutions', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-05-28', letter_grade: 'A-', total: 85,
        dimensions: dims(14,17,16,14,14,10),
        top_strength: 'Paulo and Andie co-led a clean two-option proposal close; CFO approved Phase 1 scope on the call',
        top_priority: 'Legal review timeline is uncertain — prospect\'s general counsel is new and process is unclear',
        next_steps: ['Expedite NDA-to-SOW transition via their procurement team', 'Paulo to follow up directly with CFO if legal review stalls past June 10', 'Block kickoff resources for first week of July pending signed SOW'],
        overview: 'Strong close call. Andie presented two scope options; Paulo reinforced the Phase 1 ROI case. The CFO approved Phase 1 budget on the call and indicated full Phase 2 is likely contingent on Phase 1 delivery. The only risk is legal review velocity — procurement is a new relationship and process is unknown.',
      },

      // ── Keystone Energy Services ──────────────────────────────────────────
      // Utility company, NERC CIP compliance, critical infrastructure
      // Ryan (ISR) — cold call only
      // Andie (AE) — Discovery, Demo, Touchpoint ×2, Proposal
      // Michael (SE) — Discovery and Demo; NOT on exec touchpoints
      // Paulo (CRO) — CRO Touchpoint + Proposal
      // Camilo (President) — exec Touchpoint only (no SE on this call)
      {
        id: 'demo-kes-1', ts: new Date('2026-02-12T08:30:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-02-12', letter_grade: 'C', total: 53,
        dimensions: dims(9,9,9,9,9,8),
        top_strength: 'NERC CIP framing was accurate and caught the prospect\'s attention immediately',
        top_priority: 'Went too technical too soon — lost the VP of IT before establishing rapport',
        next_steps: ['Send NERC CIP compliance overview positioned for utility sector', 'Book discovery with VP of IT and their compliance officer'],
        overview: 'Ryan correctly identified NERC CIP as the compliance driver and the prospect was initially engaged. However, Ryan moved into technical specifics about CIP-005 and CIP-007 before establishing any rapport or pain context. The prospect became passive in the second half. Discovery call booked on goodwill.',
      },
      {
        id: 'demo-kes-2', ts: new Date('2026-03-04T10:00:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-03-04', letter_grade: 'B-', total: 64,
        dimensions: dims(11,13,11,11,10,8),
        top_strength: 'Tied NERC CIP non-compliance penalties to their recent grid expansion — strong situational hook',
        top_priority: 'Two compliance officers were on the call and spoke over each other — Andie did not mediate or clarify who the decision-maker was',
        next_steps: ['Identify primary compliance lead and build champion relationship with them', 'Michael to prepare NERC CIP standards gap matrix before demo', 'Confirm FERC enforcement timeline as the urgency driver'],
        overview: 'Andie connected the NERC CIP risk to their grid expansion project effectively. The challenge was two compliance officers with competing views on scope — Andie let them debate without clarifying the decision process. Champion identification is the critical gap before advancing to demo.',
      },
      {
        id: 'demo-kes-3', ts: new Date('2026-03-25T14:00:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-03-25', letter_grade: 'B', total: 72,
        dimensions: dims(12,14,14,12,12,8),
        top_strength: 'Michael\'s CIP-005 / CIP-007 gap mapping to their actual control environment was technically exceptional',
        top_priority: 'Primary compliance officer was not present — key technical buy-in is missing',
        next_steps: ['Re-run demo summary for primary compliance officer who missed the session', 'Confirm FERC enforcement date creates hard Q3 urgency', 'Escalate to Paulo for CRO-level touchpoint before proposal'],
        overview: 'Andie and Michael delivered a strong demo to the VP IT and secondary compliance officer. The NERC CIP control mapping was technically impressive. The problem: the primary compliance officer who controls the budget recommendation was absent. A follow-up briefing is needed before the deal can advance.',
      },
      {
        id: 'demo-kes-4', ts: new Date('2026-04-15T11:00:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-04-15', letter_grade: 'B', total: 70,
        dimensions: dims(12,13,13,12,11,9),
        top_strength: 'Paulo established commercial credibility with the CFO and reframed the investment as a regulatory protection cost',
        top_priority: 'Primary compliance officer still not fully committed — a targeted 1:1 is needed before proposal',
        next_steps: ['Set up 30-min 1:1 between Andie and primary compliance officer to confirm buy-in', 'Paulo to send CFO-facing investment summary tied to FERC penalty exposure', 'Confirm exec touchpoint with Camilo if deal value justifies'],
        overview: 'A commercial alignment call with Andie and Paulo (CRO). The CFO engagement improved significantly — Paulo\'s framing of NERC non-compliance penalties as a quantifiable financial risk resonated. The primary compliance officer remains a question mark. Her formal buy-in is needed before the deal can close.',
      },
      {
        id: 'demo-kes-5', ts: new Date('2026-05-12T09:00:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-05-12', letter_grade: 'B+', total: 76,
        dimensions: dims(13,14,14,13,12,10),
        top_strength: 'Camilo\'s credibility with critical infrastructure reference clients turned the compliance officer into an advocate',
        top_priority: 'Andie should have pre-briefed Camilo on the compliance officer\'s specific concerns — slight misalignment early in call',
        next_steps: ['Submit proposal by May 22 with Phase 1 and full-scope pricing options', 'Paulo to align with CFO on payment timing before proposal call', 'Compliance officer confirmed as internal champion — protect this relationship'],
        overview: 'A well-placed executive touchpoint with Andie and Camilo (President). Note: Michael was not on this call. Camilo\'s reference stories from similar critical infrastructure clients directly addressed the compliance officer\'s concerns. She is now actively championing the deal internally.',
      },
      {
        id: 'demo-kes-6', ts: new Date('2026-06-03T13:00:00').toISOString(),
        prospect: 'Keystone Energy Services', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-06-03', letter_grade: 'B+', total: 82,
        dimensions: dims(14,16,15,14,13,10),
        top_strength: 'Two-phase proposal structure removed the budget barrier — CFO approved Phase 1 scope immediately',
        top_priority: 'Procurement process is 30-day minimum — deal may not close before FERC examination window',
        next_steps: ['Escalate procurement timeline with their legal and procurement team', 'Paulo to contact CFO directly if procurement stalls past June 17', 'Prepare Phase 1 kickoff timeline that begins parallel to procurement review'],
        overview: 'Andie and Paulo delivered a strong close call. The two-phase structure neutralized the budget constraint and the compliance officer\'s advocacy helped close the CFO. The risk is a 30-day procurement cycle that may miss the FERC exam window — Paulo needs to activate his CFO relationship to accelerate.',
      },

      // ── Perimeter Law Group ───────────────────────────────────────────────
      // Mid-size law firm; data security and client confidentiality compliance
      // Andie (AE) — cold call (one of two AE-owned cold calls), Discovery, Proposal
      // Michael (SE) — joins Discovery
      {
        id: 'demo-plg-1', ts: new Date('2026-04-17T09:30:00').toISOString(),
        prospect: 'Perimeter Law Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Cold outreach', callDate: '2026-04-17', letter_grade: 'B-', total: 65,
        dimensions: dims(11,11,11,11,11,10),
        top_strength: 'Led with client data breach liability framing — strong hook for a law firm audience',
        top_priority: 'Did not confirm who manages IT or security internally — champion is unknown',
        next_steps: ['Identify IT or security decision-maker or external MSSP managing their environment', 'Send law firm data security case study before discovery', 'Book discovery with managing partner and IT lead'],
        overview: 'Andie executed a targeted outbound cold call directly to the Managing Partner. The client data breach liability framing was well-chosen for a legal audience. The call surfaced that they have no formal security program despite handling sensitive client financial and litigation data. Champion identification is the first discovery gap to close.',
      },
      {
        id: 'demo-plg-2', ts: new Date('2026-05-06T11:00:00').toISOString(),
        prospect: 'Perimeter Law Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-05-06', letter_grade: 'B', total: 73,
        dimensions: dims(12,14,13,12,12,10),
        top_strength: 'Michael surfaced a state bar cybersecurity rule the firm was unaware of — created urgency immediately',
        top_priority: 'Managing Partner confirmed budget authority but is not technical — IT Director must be the implementation champion',
        next_steps: ['Send state bar cybersecurity compliance brief with OneAxiom positioning', 'Engage IT Director to build a technical champion before demo', 'Michael to prepare discovery summary tied to specific data security obligations'],
        overview: 'Andie and Michael ran a strong discovery call. Michael\'s knowledge of state bar cybersecurity obligations created a genuinely new urgency signal for the Managing Partner. Budget authority is confirmed. The gap is an IT Director who has not yet been engaged — without a technical champion the proposal may stall in implementation planning.',
      },
      {
        id: 'demo-plg-3', ts: new Date('2026-06-02T14:00:00').toISOString(),
        prospect: 'Perimeter Law Group', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-06-02', letter_grade: 'B+', total: 80,
        dimensions: dims(13,16,15,13,13,10),
        top_strength: 'Closing on state bar compliance deadline as the urgency driver was precise and unanswerable',
        top_priority: 'IT Director was on the call but non-committal — implementation readiness risk remains',
        next_steps: ['Send finalized engagement proposal by June 6', 'Andie to do a 1:1 with IT Director to confirm implementation readiness', 'Confirm kickoff date — Managing Partner wants to start before summer recess'],
        overview: 'Clean proposal call. Andie anchored urgency to the state bar compliance deadline — the Managing Partner did not push back. The IT Director remained quiet throughout, which is a mild yellow flag for implementation readiness. Managing Partner indicated willingness to proceed pending proposal review.',
      },

      // ── Apex Biotech Sciences ──────────────────────────────────────────────
      {
        id: 'demo-abs-1', ts: new Date('2026-02-05T10:00:00').toISOString(),
        prospect: 'Apex Biotech Sciences', rep: 'Ruben Posada', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-02-05', letter_grade: 'C+', total: 57,
        dimensions: dims(10,9,10,10,9,9),
        top_strength: 'Connected biotech IP protection narrative to cyber exposure — right framing for a life sciences audience',
        top_priority: 'Call screened before reaching IT or security contact — gatekeeper not navigated',
        next_steps: ['Research IT Director direct-dial before next attempt', 'Send biotech IP security brief to correct contact once identified', 'Rebook with decision-maker — avoid front desk on next call'],
        overview: 'Ruben executed a targeted cold call into Apex Biotech Sciences, a mid-size R&D-driven biotech. The IP protection framing was appropriate for the audience but the call was screened before reaching a technology or security decision-maker. The qualifying hook was effective — the challenge is access, not relevance. Next attempt should bypass the front desk with a direct-dial approach.',
      },
      {
        id: 'demo-abs-2', ts: new Date('2026-02-26T11:00:00').toISOString(),
        prospect: 'Apex Biotech Sciences', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-02-26', letter_grade: 'B-', total: 64,
        dimensions: dims(11,13,12,11,10,7),
        top_strength: 'Michael identified unclassified R&D endpoints with no EDR coverage — created genuine urgency for the IT Director',
        top_priority: 'CISO role is vacant — IT Director is acting security lead with limited bandwidth and no formal security mandate',
        next_steps: ['Send R&D data protection brief tailored to biotech IP lifecycle', 'Engage IT Director directly to build technical champion before demo', 'Michael to map endpoint gaps to FDA 21 CFR Part 11 audit trail obligations'],
        overview: 'Andie led discovery with Michael supporting on technical depth. Michael\'s identification of unprotected R&D endpoints created a genuine urgency signal the IT Director had not previously quantified. The CISO vacancy is a structural risk — the IT Director is technically capable but stretched thin. The engagement needs a clear technical champion before moving to demo.',
      },
      {
        id: 'demo-abs-3', ts: new Date('2026-03-20T13:00:00').toISOString(),
        prospect: 'Apex Biotech Sciences', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-03-20', letter_grade: 'B', total: 73,
        dimensions: dims(12,15,14,12,12,8),
        top_strength: 'Live demo of data classification tagging on R&D file shares resonated strongly — IT Director requested follow-up on scope',
        top_priority: 'IT Director wants a 30-day pilot before committing to full engagement — pilot scope needs to be defined quickly',
        next_steps: ['Draft a 30-day pilot scope for R&D endpoint protection and data classification', 'Andie to confirm pilot budget authority with IT Director', 'Michael to prepare pilot success criteria tied to FDA audit readiness'],
        overview: 'Andie and Michael delivered a strong demo focused on R&D data protection. The live data classification demo on a simulated file share environment was the highlight — the IT Director paused the presentation to ask follow-up questions. Pilot request is a buying signal. Moving fast on pilot scope definition is critical before budget cycle ends.',
      },
      {
        id: 'demo-abs-4', ts: new Date('2026-04-14T10:00:00').toISOString(),
        prospect: 'Apex Biotech Sciences', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-04-14', letter_grade: 'B+', total: 76,
        dimensions: dims(13,14,14,13,12,10),
        top_strength: 'Paulo connected cybersecurity investment to FDA audit trail obligations — COO engaged immediately on liability exposure',
        top_priority: 'Budget cycle closes end of Q2 — proposal must be delivered before June 15 to secure this year\'s allocation',
        next_steps: ['Deliver full proposal before June 15 to align with Q2 budget close', 'Paulo to reinforce IP breach liability narrative in proposal cover letter', 'Andie to confirm legal review process and procurement timeline'],
        overview: 'Andie and Paulo ran a strong executive touchpoint with the COO and IT Director. Paulo\'s framing of FDA audit trail obligations as a cybersecurity driver was the pivotal moment — the COO confirmed it was a board-level concern. The Q2 budget deadline creates a hard proposal deadline. Paulo\'s executive presence accelerated the COO\'s sense of urgency.',
      },
      {
        id: 'demo-abs-5', ts: new Date('2026-05-09T14:00:00').toISOString(),
        prospect: 'Apex Biotech Sciences', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-05-09', letter_grade: 'A-', total: 84,
        dimensions: dims(14,16,16,14,14,10),
        top_strength: 'Paulo anchored proposal value to IP breach liability exposure quantified in discovery — COO accepted the framing without objection',
        top_priority: 'Legal counsel will review SOW — anticipate a 10–14 day legal cycle that could delay signing past Q2 budget close',
        next_steps: ['Provide redlined SOW template in advance to compress legal review cycle', 'Andie to maintain daily touchpoint with IT Director during legal review', 'Paulo to contact COO directly if legal review extends past May 25'],
        overview: 'Andie and Paulo delivered a clean proposal presentation. Paulo\'s IP breach liability narrative — grounded in discovery-phase data — was accepted by the COO without negotiation. The primary close risk is legal review speed, not budget or will. Proactive SOW template delivery can compress the legal cycle. Strong close probability if legal review completes before Q2 budget lock.',
      },

      // ── Coastal Community Bank ─────────────────────────────────────────────
      {
        id: 'demo-ccb-1', ts: new Date('2026-04-03T09:00:00').toISOString(),
        prospect: 'Coastal Community Bank', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-04-03', letter_grade: 'C', total: 54,
        dimensions: dims(9,9,9,10,9,8),
        top_strength: 'Led with FDIC cybersecurity examination framing — well-matched for a community bank audience and created immediate relevance',
        top_priority: 'Call reached branch operations manager rather than IT or security contact — wrong entry point',
        next_steps: ['Research IT Manager and VP of Operations direct contacts before next call', 'Send FDIC cybersecurity exam prep brief to warm the right contact', 'Rebook directly with IT Manager — branch ops is not the right champion path'],
        overview: 'Ryan executed a strong cold call hook using FDIC examination framing, which was well-suited for a community bank. The narrative created genuine interest but the call was fielded by a branch operations manager with no IT or security authority. The message landed well — the access problem needs to be solved before progressing. Direct outreach to the IT Manager is the immediate next step.',
      },
      {
        id: 'demo-ccb-2', ts: new Date('2026-04-24T10:30:00').toISOString(),
        prospect: 'Coastal Community Bank', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-04-24', letter_grade: 'B-', total: 63,
        dimensions: dims(11,13,11,11,10,7),
        top_strength: 'Surfaced that the bank\'s core banking platform has no third-party vendor risk review on file — a clear FDIC examination gap',
        top_priority: 'IT Manager is technical lead but lacks budget authority — VP of Operations controls cybersecurity spend',
        next_steps: ['Map vendor risk gap to specific FDIC examination requirements and send to IT Manager', 'Andie to request a joint meeting with IT Manager and VP of Operations', 'Prepare a community bank FDIC exam readiness brief for VP of Operations review'],
        overview: 'Andie ran a productive solo discovery with the IT Manager. The vendor risk gap surfaced is directly relevant to FDIC examination requirements and created a clear urgency anchor. The budget authority gap is the primary obstacle — the IT Manager is an ideal technical champion but cannot commit spend. A joint meeting with the VP of Operations is the critical next step.',
      },
      {
        id: 'demo-ccb-3', ts: new Date('2026-05-15T11:00:00').toISOString(),
        prospect: 'Coastal Community Bank', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-05-15', letter_grade: 'B', total: 71,
        dimensions: dims(12,14,14,12,11,8),
        top_strength: 'Michael\'s community bank-specific risk assessment preview visibly engaged the VP of Operations — concrete and exam-relevant',
        top_priority: 'VP of Operations confirmed interest but wants a proposal scoped specifically to their FDIC examination window',
        next_steps: ['Andie to draft proposal scoped to FDIC exam timeline — target delivery by May 30', 'Michael to include vendor risk assessment preview section in the proposal', 'Confirm whether VP of Operations is final signer or if board approval is required'],
        overview: 'Andie and Michael delivered a demo that successfully pulled the VP of Operations into the buying conversation. Michael\'s community bank risk assessment preview — framed around FDIC examination evidence requirements — was the session\'s turning point. The VP of Operations is now engaged and budget authority confirmed. A scoped proposal tied to the FDIC exam window is the clear next step.',
      },

      // ── Summit Property Holdings ───────────────────────────────────────────
      {
        id: 'demo-sph-1', ts: new Date('2026-05-14T09:30:00').toISOString(),
        prospect: 'Summit Property Holdings', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Cold outreach', callDate: '2026-05-14', letter_grade: 'B-', total: 66,
        dimensions: dims(12,11,11,12,11,9),
        top_strength: 'Led with a real estate data breach case study — CFO had not previously considered cybersecurity as an operational liability',
        top_priority: 'IT is fully outsourced to an MSP — MSP relationship could complicate a direct assessment engagement',
        next_steps: ['Research MSP name and relationship structure before discovery call', 'Send real estate sector cybersecurity liability brief to CFO', 'Book discovery with CFO and any internal IT point of contact'],
        overview: 'Andie executed a targeted cold call into Summit Property Holdings, a commercial real estate holding firm. The data breach liability framing created a new risk awareness for the CFO, who had not previously considered cybersecurity as a financial exposure. The MSP dependency is the key structural complexity to navigate in discovery — need to understand whether MSP has any contractual exclusivity before engaging on an assessment.',
      },
      {
        id: 'demo-sph-2', ts: new Date('2026-06-04T10:00:00').toISOString(),
        prospect: 'Summit Property Holdings', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-06-04', letter_grade: 'B', total: 71,
        dimensions: dims(12,14,13,12,12,8),
        top_strength: 'Michael surfaced that the MSP has never produced a security assessment or audit report in four years of engagement',
        top_priority: 'MSP may resist a third-party assessment — an internal champion at Summit must be secured before any MSP conversation',
        next_steps: ['Michael to prepare a brief on MSP oversight gaps and client risk exposure', 'Andie to position OneAxiom as a client-side advisor, not an MSP replacement — reduce resistance risk', 'CFO to be briefed on the MSP accountability gap before demo scheduling'],
        overview: 'Andie and Michael ran a strong discovery call. Michael\'s finding that the MSP had never produced an independent security assessment in four years of service was the session\'s pivotal moment — the CFO was visibly surprised. The strategic positioning challenge is to engage without triggering MSP defensiveness. Positioning OneAxiom as a client-side advisor rather than a vendor replacement is the right narrative to develop going into demo.',
      },

      // ── Tri-State Transit Authority ────────────────────────────────────────
      {
        id: 'demo-tta-1', ts: new Date('2026-02-19T09:00:00').toISOString(),
        prospect: 'Tri-State Transit Authority', rep: 'Ryan Osegueda', repRole: 'ISR',
        stage: 'Cold outreach', callDate: '2026-02-19', letter_grade: 'C', total: 52,
        dimensions: dims(9,8,9,9,8,9),
        top_strength: 'Connected recent transit ransomware headlines to TTA\'s exposure — created immediate relevance for a public agency audience',
        top_priority: 'Call routed to procurement before IT leadership was reached — public sector gatekeeping adds a multi-step access challenge',
        next_steps: ['Identify IT Director and Deputy Executive Director direct contacts', 'Send transit agency cybersecurity brief via LinkedIn to IT Director', 'Request warm introduction through transit industry contact if available'],
        overview: 'Ryan executed a well-framed cold call using recent transit system ransomware incidents as a relevance anchor. The message was appropriate for the audience but was intercepted by a procurement contact who could not evaluate the proposal. Public sector access requires a different approach — direct outreach to IT leadership via LinkedIn or a mutual contact is the recommended path forward.',
      },
      {
        id: 'demo-tta-2', ts: new Date('2026-03-12T11:00:00').toISOString(),
        prospect: 'Tri-State Transit Authority', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Discovery', callDate: '2026-03-12', letter_grade: 'B-', total: 65,
        dimensions: dims(11,13,12,11,11,7),
        top_strength: 'Michael identified OT/SCADA exposure in fare collection and station management systems — a tangible urgency signal for a transit operator',
        top_priority: 'IT Director and OT operations team work in separate silos — any security engagement requires sign-off from both groups',
        next_steps: ['Michael to prepare a transit OT/IT convergence brief for both IT Director and OT Lead', 'Andie to request a joint meeting with IT Director and OT team lead', 'Map CISA transit sector guidance to discovery findings before demo'],
        overview: 'Andie and Michael ran a productive discovery with the IT Director. Michael\'s identification of OT/SCADA exposure in fare collection systems surfaced a risk the IT Director acknowledged but had not formally assessed. The IT/OT silo is the structural challenge — both groups must be engaged simultaneously. CISA transit sector guidance is a strong third-party anchor for the next conversation.',
      },
      {
        id: 'demo-tta-3', ts: new Date('2026-04-07T13:00:00').toISOString(),
        prospect: 'Tri-State Transit Authority', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Demo / solution presentation', callDate: '2026-04-07', letter_grade: 'B', total: 72,
        dimensions: dims(12,14,14,12,12,8),
        top_strength: 'OT/IT convergence framework demo engaged both the IT Director and OT Lead simultaneously — rare alignment in a siloed agency',
        top_priority: 'Public agency procurement above the $50K threshold requires board approval — timeline risk is significant',
        next_steps: ['Prepare board-ready cybersecurity risk summary for Executive Director review', 'Andie to research procurement approval threshold and board meeting cadence with IT Director', 'Michael to draft OT/IT assessment scope document to support board submission'],
        overview: 'Andie and Michael delivered a strong demo that achieved what discovery could not — simultaneous engagement of both the IT Director and OT Lead. The OT/IT convergence framework was the session\'s turning point. The procurement timeline risk is the primary obstacle: board approval is required above the $50K threshold and board cycles at public agencies are slow. Board-ready materials need to be prepared proactively.',
      },
      {
        id: 'demo-tta-4', ts: new Date('2026-05-05T10:00:00').toISOString(),
        prospect: 'Tri-State Transit Authority', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Touchpoint', callDate: '2026-05-05', letter_grade: 'B+', total: 76,
        dimensions: dims(13,14,14,13,12,10),
        top_strength: 'Camilo\'s public sector compliance narrative connected directly to the Executive Director\'s board accountability concerns',
        top_priority: 'Board approval required for any engagement above $50K — Executive Director needs board-ready materials before next board cycle',
        next_steps: ['Prepare a one-page board cybersecurity risk summary for Executive Director', 'Andie to confirm next board meeting date and submission deadline', 'Camilo to follow up with Executive Director 1:1 if board submission window is at risk'],
        overview: 'Andie and Camilo ran a strong executive touchpoint with the Transit Authority\'s Executive Director. This call did not include Michael or technical staff — it was a pure executive alignment conversation. Camilo\'s framing of CISA transit sector guidance as a board accountability obligation resonated immediately with the Executive Director. The board approval cycle is now the critical path — materials must be submitted before the next meeting.',
      },
      {
        id: 'demo-tta-5', ts: new Date('2026-06-02T14:00:00').toISOString(),
        prospect: 'Tri-State Transit Authority', rep: 'Andie Prandini', repRole: 'Account Executive',
        stage: 'Proposal / close', callDate: '2026-06-02', letter_grade: 'A-', total: 85,
        dimensions: dims(14,16,16,14,14,11),
        top_strength: 'Paulo framed the proposal around CISA transit system guidance — Executive Director treated it as a compliance obligation, not a vendor pitch',
        top_priority: 'Legal and procurement review will require 3–4 weeks for a public agency — kickoff timing is at risk without an expedited procurement path',
        next_steps: ['Andie to request expedited procurement review citing CISA compliance urgency', 'Paulo to provide a public agency contract reference to accelerate legal review', 'Confirm July board meeting date — target formal engagement vote before summer recess'],
        overview: 'Andie and Paulo delivered a strong proposal presentation to the Executive Director and IT Director. Paulo\'s decision to frame the proposal around CISA transit sector guidance was the session\'s defining move — the Executive Director confirmed it was a compliance requirement rather than a discretionary investment. Public agency procurement will be the primary friction point. An expedited procurement path and a July board meeting vote are the critical milestones to close before summer recess.',
      },

    ];

    // Sort by callDate descending for consistent history rendering (most recent first)
    demoHistory.sort((a,b) => a.callDate < b.callDate ? 1 : -1);

    const demoPulseTasks = {
      'Meridian Financial Group': [
        { text: 'Send revised proposal with two scope options', done: true,  source: '2026-05-15', ts: now },
        { text: 'Confirm legal review timeline with their counsel', done: false, source: '2026-05-15', ts: now },
        { text: 'Block kickoff date contingent on signed SOW', done: false, source: '2026-05-15', ts: now },
      ],
      'Northgate Healthcare Systems': [
        { text: 'Send countersigned SOW by June 6', done: false, source: '2026-06-02', ts: now },
        { text: 'Confirm BAA execution with their legal by June 9', done: false, source: '2026-06-02', ts: now },
        { text: 'Schedule kickoff call for week of June 16', done: false, source: '2026-06-02', ts: now },
      ],
      'Cascade Manufacturing Co.': [
        { text: 'Send final proposal with CMMC Level 2 scope by June 9', done: false, source: '2026-06-05', ts: now },
        { text: 'Confirm CFO signature authority and legal review window', done: false, source: '2026-06-05', ts: now },
        { text: 'Block kickoff date — prospect wants to start before July 1', done: true,  source: '2026-06-05', ts: now },
      ],
      'Vantara Logistics': [
        { text: 'Prepare one-page differentiation brief vs prior vendor', done: false, source: '2026-06-10', ts: now },
        { text: 'Confirm CISO as champion and secure 1:1 before proposal', done: false, source: '2026-06-10', ts: now },
        { text: 'Target proposal submission by June 25 if CISO confirms', done: false, source: '2026-06-10', ts: now },
      ],
      'Pinnacle Credit Union': [
        { text: 'Send sample board-ready cybersecurity assessment report', done: false, source: '2026-06-10', ts: now },
        { text: 'Confirm internal champion can dedicate time to evidence collection', done: false, source: '2026-06-10', ts: now },
        { text: 'Target proposal delivery by June 16 for Q3 board prep window', done: false, source: '2026-06-10', ts: now },
      ],
      'Strata Defense Solutions': [
        { text: 'Expedite NDA-to-SOW transition via procurement team', done: false, source: '2026-05-28', ts: now },
        { text: 'Paulo to follow up with CFO if legal review stalls past June 10', done: false, source: '2026-05-28', ts: now },
        { text: 'Block kickoff resources for first week of July pending SOW', done: false, source: '2026-05-28', ts: now },
      ],
      'Keystone Energy Services': [
        { text: 'Escalate procurement timeline with legal and procurement team', done: false, source: '2026-06-03', ts: now },
        { text: 'Paulo to contact CFO directly if procurement stalls past June 17', done: false, source: '2026-06-03', ts: now },
        { text: 'Prepare Phase 1 kickoff timeline parallel to procurement review', done: true,  source: '2026-06-03', ts: now },
      ],
      'Perimeter Law Group': [
        { text: 'Send finalized engagement proposal by June 6', done: true,  source: '2026-06-02', ts: now },
        { text: 'Andie to do 1:1 with IT Director to confirm implementation readiness', done: false, source: '2026-06-02', ts: now },
        { text: 'Confirm kickoff date before summer recess', done: false, source: '2026-06-02', ts: now },
      ],
      'Apex Biotech Sciences': [
        { text: 'Deliver finalized proposal before June 15 Q2 budget deadline', done: false, source: '2026-05-09', ts: now },
        { text: 'Provide redlined SOW template to compress legal review cycle', done: false, source: '2026-05-09', ts: now },
        { text: 'Paulo to contact COO directly if legal review extends past May 25', done: false, source: '2026-05-09', ts: now },
      ],
      'Coastal Community Bank': [
        { text: 'Deliver proposal scoped to FDIC examination timeline by May 30', done: false, source: '2026-05-15', ts: now },
        { text: 'Confirm whether VP of Operations is final signer or board approval needed', done: false, source: '2026-05-15', ts: now },
        { text: 'Michael to include vendor risk assessment preview in proposal', done: false, source: '2026-05-15', ts: now },
      ],
      'Summit Property Holdings': [
        { text: 'Michael to prepare MSP oversight gap brief for CFO review', done: false, source: '2026-06-04', ts: now },
        { text: 'Andie to position OneAxiom as client-side advisor before demo scheduling', done: false, source: '2026-06-04', ts: now },
        { text: 'Schedule demo for week of June 16 pending CFO confirmation', done: false, source: '2026-06-04', ts: now },
      ],
      'Tri-State Transit Authority': [
        { text: 'Prepare one-page board cybersecurity risk summary for Executive Director', done: false, source: '2026-06-02', ts: now },
        { text: 'Andie to request expedited procurement review citing CISA compliance urgency', done: false, source: '2026-06-02', ts: now },
        { text: 'Confirm July board meeting date for formal engagement vote', done: false, source: '2026-06-02', ts: now },
      ],
    };

    // Participant scores for supporting reps (SE, CRO, CFO) keyed by record id
    const participantMap = {
      'demo-mfg-3': [{ name: 'Michael Darlan', score: 76 }],
      'demo-mfg-4': [{ name: 'Paulo Veloso',   score: 74 }],
      'demo-mfg-5': [{ name: 'Paulo Veloso',   score: 84 }],
      'demo-nhs-3': [{ name: 'Michael Darlan', score: 65 }],
      'demo-nhs-4': [{ name: 'Michael Darlan', score: 84 }],
      'demo-nhs-5': [{ name: 'Camilo Garces',  score: 78 }],
      'demo-nhs-6': [{ name: 'Paulo Veloso',   score: 88 }],
      'demo-cmc-3': [{ name: 'Michael Darlan', score: 77 }],
      'demo-cmc-4': [{ name: 'Paulo Veloso',   score: 90 }],
      'demo-vl-3':  [{ name: 'Michael Darlan', score: 62 }],
      'demo-vl-4':  [{ name: 'Michael Darlan', score: 65 }],
      'demo-pcu-3': [{ name: 'Michael Darlan', score: 76 }],
      'demo-sds-3': [{ name: 'Michael Darlan', score: 74 }],
      'demo-sds-4': [{ name: 'Michael Darlan', score: 83 }],
      'demo-sds-5': [{ name: 'Camilo Garces',  score: 77 }],
      'demo-sds-6': [{ name: 'Paulo Veloso',   score: 80 }],
      'demo-sds-7': [{ name: 'Paulo Veloso',   score: 87 }],
      'demo-kes-3': [{ name: 'Michael Darlan', score: 74 }],
      'demo-kes-4': [{ name: 'Paulo Veloso',   score: 75 }],
      'demo-kes-5': [{ name: 'Camilo Garces',  score: 82 }],
      'demo-kes-6': [{ name: 'Paulo Veloso',   score: 85 }],
      'demo-plg-2': [{ name: 'Michael Darlan', score: 76 }],
      'demo-abs-2': [{ name: 'Michael Darlan', score: 68 }],
      'demo-abs-3': [{ name: 'Michael Darlan', score: 76 }],
      'demo-abs-4': [{ name: 'Paulo Veloso',   score: 80 }],
      'demo-abs-5': [{ name: 'Paulo Veloso',   score: 87 }],
      'demo-ccb-3': [{ name: 'Michael Darlan', score: 74 }],
      'demo-sph-2': [{ name: 'Michael Darlan', score: 75 }],
      'demo-tta-2': [{ name: 'Michael Darlan', score: 68 }],
      'demo-tta-3': [{ name: 'Michael Darlan', score: 75 }],
      'demo-tta-4': [{ name: 'Camilo Garces',  score: 81 }],
      'demo-tta-5': [{ name: 'Paulo Veloso',   score: 88 }],
    };
    demoHistory.forEach(h => {
      if (typeof h.total === 'number') h.letter_grade = scoreToGrade(h.total);
      if (participantMap[h.id]) h.participants = participantMap[h.id];
    });
    // Strip resultsHtml from existing records to minimize localStorage usage before appending 53 demo records
    const existing = loadHistory().filter(h => !h.id?.startsWith('demo-')).map(h => { const c={...h}; delete c.resultsHtml; return c; });
    saveHistoryData([...existing, ...demoHistory]);

    // Merge pulse tasks — don't overwrite existing real tasks for a company
    let existingTasks = {};
    try { existingTasks = JSON.parse(localStorage.getItem('oa_pulse_tasks')||'{}'); } catch(e) {}
    const mergedTasks = Object.assign({}, demoPulseTasks, existingTasks);
    localStorage.setItem('oa_pulse_tasks', JSON.stringify(mergedTasks));

    // ── Scope pre-population for demo accounts ─────────────────────────────
    // field(s) helper — wraps text value for single or multi fields
    const sv = v => ({ value: v, notes: '' });
    const demoScope = {
      'Meridian Financial Group': {
        [slugField('Company Name')]:                            sv('Meridian Financial Group'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Financial Services / Fintech'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Corporation'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('SEC\nFINRA'),
        [slugField('Primary products & services')]:            sv('Investment advisory\nRetirement account management\nWealth planning'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('148'),
        [slugField('Number of in-house IT / security staff')]: sv('4'),
        [slugField('Number of business locations / offices')]: sv('2'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('162'),
        [slugField('Number of servers (physical + virtual)')]: sv('14'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure\nMicrosoft 365'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Microsoft Defender for Endpoint'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('Email and admin accounts — remote access not enforced'),
        [slugField('Email / collaboration platform (M365 / Google Workspace / etc.)')]: sv('Microsoft 365'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('PII\nFinancial records\nInvestment data'),
        [slugField('Approximate volume of customer PII / records held')]: sv('~22,000 client accounts'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('SOC 2 Type II\nSEC Reg S-P\nState breach notification'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NIST CSF (partial)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('SOC 2 Type II audit — targeting Q3 2026'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('Informal internal review ~2 years ago — no external assessment'),
        [slugField('Number of personnel who will support this engagement')]: sv('3'),
      },
      'Northgate Healthcare Systems': {
        [slugField('Company Name')]:                            sv('Northgate Healthcare Systems'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Healthcare / Multi-site Hospital Network'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Nonprofit Corporation'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('HHS-OCR\nCMS'),
        [slugField('Primary products & services')]:            sv('Inpatient and outpatient acute care\nSpecialty clinics\nEmergency services'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('620'),
        [slugField('Number of in-house IT / security staff')]: sv('8'),
        [slugField('Number of business locations / offices')]: sv('5'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('840'),
        [slugField('Number of servers (physical + virtual)')]: sv('42'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure\nMicrosoft 365'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('CrowdStrike Falcon (partial deployment — not all clinical workstations)'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('Admin accounts and remote access only — clinical workstations not enforced'),
        [slugField('Email / collaboration platform (M365 / Google Workspace / etc.)')]: sv('Microsoft 365'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('PHI\nPII\nPayment data'),
        [slugField('Do you store, process, or transmit payment card data (PCI scope)?')]: sv('Yes — patient billing processed internally'),
        [slugField('Approximate volume of customer PII / records held')]: sv('~180,000 patient records'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('HIPAA Security Rule\nHIPAA Breach Notification Rule\nState health data breach laws'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NIST CSF (partial — self-assessed)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('HHS-OCR compliance review — Q3 2026 (hard deadline)'),
        [slugField('Security incident in the past 24 months? Briefly describe.')]: sv('2023: breach notification filed with HHS-OCR — 1,200 records exposed via misconfigured email rule'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('HIPAA risk analysis performed internally in 2022 — not independently validated'),
        [slugField('Number of personnel who will support this engagement')]: sv('5'),
      },
      'Cascade Manufacturing Co.': {
        [slugField('Company Name')]:                            sv('Cascade Manufacturing Co.'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Precision Manufacturing / Defense Supply Chain'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('LLC'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('DoD / CMMC AB'),
        [slugField('Primary products & services')]:            sv('Machined components\nAssemblies for DoD prime contractors\nQuality systems / ITAR-controlled parts'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('245'),
        [slugField('Number of in-house IT / security staff')]: sv('3'),
        [slugField('Number of business locations / offices')]: sv('1'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Primarily on-premises'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('87'),
        [slugField('Number of servers (physical + virtual)')]: sv('9'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Microsoft 365'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Microsoft SharePoint (CUI storage — not yet GCC compliant)'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Windows Defender — no EDR solution deployed'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 email only — no MFA on on-prem admin accounts'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('CUI (Controlled Unclassified Information)\nProduction specifications\nDoD contract data'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('CMMC Level 2\nDFARS 252.204-7012\nITAR (applicable to some part lines)'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('None — first formal assessment'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('CMMC Level 2 certification required by August 2026 for contract renewal'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('No external assessment ever conducted'),
        [slugField('Number of personnel who will support this engagement')]: sv('2'),
      },
      'Vantara Logistics': {
        [slugField('Company Name')]:                            sv('Vantara Logistics'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Logistics / Transportation Technology'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Corporation'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('310'),
        [slugField('Number of in-house IT / security staff')]: sv('5'),
        [slugField('Number of business locations / offices')]: sv('3'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Cloud-hosted'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('215'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('AWS\nMicrosoft 365'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Salesforce\nCustom TMS platform (hosted AWS)\nQuickBooks Online'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('SentinelOne — deployed by prior vendor, coverage gaps remain'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('PII (shipper and recipient data)\nFinancial records\nCustomer contracts'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('State breach notification laws\nCCPA-CPRA (California-based customers)\nCargo/shipper data protection requirements'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('Yes — engaged [prior vendor] approximately 18 months ago; engagement ended poorly. Vendor delivered incomplete report with no remediation guidance.'),
        [slugField('Security incident in the past 24 months? Briefly describe.')]: sv('No confirmed breach — but prior vendor assessment was never completed, leaving gap visibility unknown'),
        [slugField('Number of personnel who will support this engagement')]: sv('4'),
      },
      'Pinnacle Credit Union': {
        [slugField('Company Name')]:                            sv('Pinnacle Credit Union'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Financial Services / Credit Union'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Federally chartered credit union'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('NCUA'),
        [slugField('Primary products & services')]:            sv('Consumer deposit accounts\nMortgage and auto lending\nDigital banking platform'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('78'),
        [slugField('Number of in-house IT / security staff')]: sv('2'),
        [slugField('Number of business locations / offices')]: sv('4'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid — core banking on-prem, digital services cloud-hosted'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('92'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Microsoft 365\nFiserv cloud (core banking SaaS)'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Fiserv (core banking)\nDocuSign\nOnBase (document management)'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Webroot — basic AV only'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 email only — online banking admin portal does not enforce MFA'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('PII\nFinancial records\nPayment card data (member debit)'),
        [slugField('Do you store, process, or transmit payment card data (PCI scope)?')]: sv('Yes — member debit card processing via FIS'),
        [slugField('Approximate volume of customer PII / records held')]: sv('~14,200 member accounts'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('NCUA cybersecurity rules\nGLBA Safeguards Rule\nPCI-DSS'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NIST CSF (partial — self-assessed against examiner guidance)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('NCUA examination expected Q3 2026 — board cybersecurity report required'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('Last external assessment: 2022 — not independently validated since'),
        [slugField('Number of personnel who will support this engagement')]: sv('3'),
      },
      'Strata Defense Solutions': {
        [slugField('Company Name')]:                            sv('Strata Defense Solutions'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Defense / Government Contracting (DoD Prime)'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Corporation'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('DoD / CMMC AB\nState Department (ITAR)'),
        [slugField('Primary products & services')]:            sv('Systems integration for DoD programs\nCybersecurity services\nISR platform development'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('1,200'),
        [slugField('Number of in-house IT / security staff')]: sv('22'),
        [slugField('Number of business locations / offices')]: sv('4'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid — Azure Government Cloud and on-prem classified systems'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('1,340'),
        [slugField('Number of servers (physical + virtual)')]: sv('118'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure Government Cloud\nMicrosoft 365 GCC High'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Microsoft Teams GCC High\nSharePoint GCC High\nSalesforce Government Cloud'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('CrowdStrike Falcon (full deployment)'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('Yes — all users including remote access and admin'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('CUI (Controlled Unclassified Information)\nCTI / program data\nPII'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('CMMC Level 3\nDFARS 252.204-7012\nITAR\nNISP (National Industrial Security Program)'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NIST SP 800-171 (Rev 2)\nCMMC Level 2 certified — pursuing Level 3'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('CMMC Level 3 assessment required by December 2026 — contract renewal at risk'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('CMMC Level 2 C3PAO assessment completed 2024 — Level 3 is first formal attempt'),
        [slugField('Number of personnel who will support this engagement')]: sv('8'),
      },
      'Keystone Energy Services': {
        [slugField('Company Name')]:                            sv('Keystone Energy Services'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Energy / Electric Utilities (Critical Infrastructure)'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('LLC'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('FERC\nNERC\nState PUC'),
        [slugField('Primary products & services')]:            sv('Electric power generation and distribution\nTransmission substation operations\nDemand response programs'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('890'),
        [slugField('Number of in-house IT / security staff')]: sv('12'),
        [slugField('Number of business locations / offices')]: sv('7 (corporate + 6 substations)'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Primarily on-premises — partial Azure migration underway'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('620'),
        [slugField('Number of servers (physical + virtual)')]: sv('84'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure (partial)\nMicrosoft 365'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Microsoft Defender — IT network only. OT/ICS environment has limited endpoint visibility.'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 and corporate VPN — substation remote access does not enforce MFA'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('Critical infrastructure operational data\nEmployee PII\nGrid topology / BES Cyber System data'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('NERC CIP (CIP-002 through CIP-013)\nFERC Order 887\nState PUC cybersecurity reporting'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NERC CIP standards (partial — gap in CIP-013 supply chain)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('FERC compliance audit expected Q3 2026 — recent grid expansion triggered re-assessment requirement'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('NERC CIP self-audit 2023 — no third-party validation of OT/ICS environment'),
        [slugField('Number of personnel who will support this engagement')]: sv('5'),
      },
      'Perimeter Law Group': {
        [slugField('Company Name')]:                            sv('Perimeter Law Group'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Legal Services'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Professional Corporation (PC)'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('State Bar\nABA Model Rules'),
        [slugField('Primary products & services')]:            sv('Corporate litigation\nIntellectual property\nMergers and acquisitions advisory'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('52 (22 attorneys, 30 staff)'),
        [slugField('Number of in-house IT / security staff')]: sv('1 (part-time IT contractor)'),
        [slugField('Number of business locations / offices')]: sv('1'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Cloud-hosted'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('58'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Microsoft 365\nNetDocuments (DMS)'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('NetDocuments (client documents)\nClio (matter management)\nDocuSign'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('None — Windows Defender only'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 only — Clio and NetDocuments do not enforce MFA'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('Client PII\nPrivileged litigation documents\nConfidential financial records\nTrade secrets (IP cases)'),
        [slugField('Approximate volume of customer PII / records held')]: sv('~3,800 active and former client records'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('State Bar cybersecurity rule (effective 2026)\nABA Model Rule 1.6 (confidentiality)\nState breach notification'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('None'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('State Bar compliance deadline — new cybersecurity rule takes effect Q4 2026'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('No formal assessment ever conducted'),
        [slugField('Number of personnel who will support this engagement')]: sv('2'),
      },
      'Apex Biotech Sciences': {
        [slugField('Company Name')]:                            sv('Apex Biotech Sciences'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Life Sciences / Biotechnology'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Corporation'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('FDA\nNIH (grant compliance)\nState biotech data privacy rules'),
        [slugField('Primary products & services')]:            sv('R&D for oncology therapeutics\nPreclinical and clinical trial data management\nLicensing of proprietary compound libraries'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('210'),
        [slugField('Number of in-house IT / security staff')]: sv('3 (IT only — no dedicated security staff; CISO role vacant)'),
        [slugField('Number of business locations / offices')]: sv('2'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid — lab systems on-prem, corporate on Microsoft 365 / Azure'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('187'),
        [slugField('Number of servers (physical + virtual)')]: sv('18'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure\nMicrosoft 365\nAWS (R&D compute workloads)'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Veeva Vault (clinical trial documents)\nBenchling (R&D data)\nDocuSign'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Windows Defender — no EDR on lab workstations or research endpoints'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 corporate accounts only — lab systems and R&D endpoints not covered'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('Proprietary R&D data / compound libraries\nClinical trial participant data (limited PHI)\nIP / trade secrets'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('FDA 21 CFR Part 11 (electronic records)\nHIPAA (limited — clinical trial data)\nState breach notification\nNIH data security requirements'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('None formally adopted'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('FDA pre-IND meeting expected Q4 2026 — electronic records audit trail review anticipated'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('No external assessment ever conducted'),
        [slugField('Number of personnel who will support this engagement')]: sv('3'),
      },
      'Coastal Community Bank': {
        [slugField('Company Name')]:                            sv('Coastal Community Bank'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Financial Services / Community Banking'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('State-chartered bank (S-Corp)'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('FDIC\nState Banking Department'),
        [slugField('Primary products & services')]:            sv('Consumer deposit accounts\nSmall business lending\nMortgage origination\nOnline and mobile banking'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('142'),
        [slugField('Number of in-house IT / security staff')]: sv('2'),
        [slugField('Number of business locations / offices')]: sv('6 branches'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid — core banking on-prem via Fiserv, digital services cloud-hosted'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('168'),
        [slugField('Number of servers (physical + virtual)')]: sv('12'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Microsoft 365\nFiserv cloud (core banking SaaS)'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('Fiserv (core banking)\nJack Henry (item processing)\nDocuSign'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Symantec Endpoint Protection — basic AV, no EDR'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('M365 email only — online banking admin portal and VPN do not enforce MFA'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('PII\nFinancial records\nPayment card data\nAccount credentials'),
        [slugField('Do you store, process, or transmit payment card data (PCI scope)?')]: sv('Yes — debit card issuing and ATM processing'),
        [slugField('Approximate volume of customer PII / records held')]: sv('~18,500 account holders'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('FDIC cybersecurity guidelines\nGLBA Safeguards Rule\nPCI-DSS\nState breach notification'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('FFIEC CAT (partial — self-assessed)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('FDIC safety and soundness examination expected Q4 2026 — cybersecurity component included'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('No third-party vendor risk review on file — last internal review 3+ years ago'),
        [slugField('Number of personnel who will support this engagement')]: sv('3'),
      },
      'Summit Property Holdings': {
        [slugField('Company Name')]:                            sv('Summit Property Holdings'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Commercial Real Estate / Property Management'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('LLC'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('None (sector-specific) — state breach notification applicable'),
        [slugField('Primary products & services')]:            sv('Commercial property acquisition and management\nTenant leasing and facilities services\nReal estate investment portfolio management'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('78'),
        [slugField('Number of in-house IT / security staff')]: sv('0 — IT fully managed by external MSP'),
        [slugField('Number of business locations / offices')]: sv('1 corporate office + 14 managed properties'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Cloud-hosted — MSP manages all infrastructure'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('84'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Microsoft 365\nAzure (MSP-managed)'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('AppFolio (property management)\nQuickBooks Online (accounting)\nDocuSign'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Unknown — managed entirely by MSP; no independent endpoint visibility'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('Unknown — MSP manages all accounts; no direct confirmation received'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('Tenant PII (SSN for background checks, financial statements)\nLease agreements\nBank account data (rental payments)'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('State breach notification laws\nCCPA-CPRA (California tenant data)\nFair Credit Reporting Act (tenant screening)'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('MSP has never produced an independent security assessment or audit report in 4 years of engagement'),
        [slugField('Number of personnel who will support this engagement')]: sv('2'),
      },
      'Tri-State Transit Authority': {
        [slugField('Company Name')]:                            sv('Tri-State Transit Authority'),
        [slugField('Industry Vertical (Fintech / Healthcare / Manufacturing…)')]:  sv('Public Sector / Transportation (Critical Infrastructure)'),
        [slugField('Legal entity type (LLC / corporation / partnership / nonprofit / etc.)')]: sv('Public authority / government entity'),
        [slugField('Primary regulator(s) / oversight body (FTC / HHS-OCR / FDA / SEC / state DPA / sector-specific / none)')]: sv('FTA (Federal Transit Administration)\nDHS / CISA (critical infrastructure)\nState transit oversight board'),
        [slugField('Primary products & services')]:            sv('Regional bus and rail transit operations\nFare collection systems (IT + OT)\nStation management and dispatch systems'),
        [slugField('Total number of employees (full-time + part-time)')]: sv('1,480'),
        [slugField('Number of in-house IT / security staff')]: sv('9 (IT only — IT and OT teams operate separately)'),
        [slugField('Number of business locations / offices')]: sv('1 HQ + 12 stations / depot facilities'),
        [slugField('System architecture (on-prem / cloud-hosted / hybrid)')]: sv('Hybrid — IT environment cloud-hosted (M365/Azure), OT/SCADA systems on-prem'),
        [slugField('Number of endpoints (workstations + laptops)')]: sv('840'),
        [slugField('Number of servers (physical + virtual)')]: sv('62'),
        [slugField('Cloud environment(s) in use (Azure / AWS / GCP / M365 / none)')]: sv('Azure\nMicrosoft 365'),
        [slugField('Key SaaS / third-party apps handling regulated data')]: sv('SAP (HR/payroll)\nFare collection vendor platform (OT-integrated)\nSalesforce (public communications)'),
        [slugField('Endpoint protection / EDR solution in use')]: sv('Microsoft Defender (IT environment only) — OT/SCADA environment has no endpoint protection'),
        [slugField('Is MFA deployed (email / remote access / admin accounts)?')]: sv('IT environment: M365 and admin accounts only. OT environment: no MFA on any system.'),
        [slugField('Types of sensitive data handled (PII / PHI / financial records / IP / card data / trade secrets)')]: sv('Employee PII\nPassenger payment card data (fare systems)\nOperational / grid topology data (BES equivalent for transit)'),
        [slugField('Do you store, process, or transmit payment card data (PCI scope)?')]: sv('Yes — fare payment card processing via third-party gateway'),
        [slugField('Regulatory / compliance drivers (HIPAA / PCI-DSS / SOX / CCPA-CPRA / GDPR / CMMC / state breach laws / sector-specific)')]: sv('CISA transit sector guidelines\nFTA cybersecurity requirements\nPCI-DSS (fare card processing)\nState public agency data breach notification'),
        [slugField('Existing framework followed (NIST CSF / ISO 27001 / SOC 2 / CIS Controls)?')]: sv('NIST CSF (partial — IT environment only; OT not assessed)'),
        [slugField('Preparing for a regulatory exam or audit? When?')]: sv('FTA safety and security review expected Q3 2026 — triggered by recent fleet expansion grant'),
        [slugField('Has the organization had a prior risk / security assessment? When?')]: sv('IT environment assessed internally 2022 — OT/ICS environment has never been independently assessed'),
        [slugField('Number of personnel who will support this engagement')]: sv('6'),
      },
    };

    // Seed scope data — don't overwrite companies that already have real user data
    let existingScope = {};
    try { existingScope = JSON.parse(localStorage.getItem('oa_scope_v2')||'{}'); } catch(e) {}
    // Start with existing data, then fill in demo entries for companies that have no data yet
    const mergedScope = Object.assign({}, existingScope);
    Object.entries(demoScope).forEach(([company, draft]) => {
      if (!mergedScope[company]) {
        mergedScope[company] = { draft, revisions: [] };
      }
    });
    localStorage.setItem('oa_scope_v2', JSON.stringify(mergedScope));
  }

  // Version-gated demo seed — reseed when version changes OR demo data is absent
  const DEMO_VERSION = 'v11-all-rep-trends';
  const _demoAccounts = new Set(loadHistory().filter(h => String(h.id).startsWith('demo-')).map(h => h.prospect));
  if (localStorage.getItem('oa_demo_version') !== DEMO_VERSION || _demoAccounts.size < 12) {
    saveHistoryData(loadHistory().filter(h => !String(h.id).startsWith('demo-')));
    localStorage.removeItem('oa_demo_seeded');
    seedDemoData();
    localStorage.setItem('oa_demo_version', DEMO_VERSION);
  }
  navTo('pulse');