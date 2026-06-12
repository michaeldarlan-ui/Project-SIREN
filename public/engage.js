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
    { title: 'The JOLT Effect', author: 'Matthew Dixon & Ted McKenna', type: 'Book', why: 'Addresses indecision as the primary reason deals are lost — practical techniques for moving stuck prospects forward.' },
    { title: 'Never Split the Difference', author: 'Chris Voss', type: 'Book', why: 'FBI negotiation tactics applied to sales — tactical empathy, calibrated questions, and mirroring for handling objections and closing without pressure.' }
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
    if (pct >= 70) return '#c47f1a';
    if (pct >= 60) return '#a83535';
    return '#888e96';
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
    if (g.startsWith('A')) return '#006a8a';
    if (g.startsWith('B')) return '#0a6b52';
    if (g.startsWith('C')) return '#7c5514';
    if (g.startsWith('D')) return '#7a2828';
    return '#5c1c1c';
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

  function detectMissingRecordings(priorCalls, callDate, notes) {
    const warnings = [];
    const dated = priorCalls
      .filter(h => h.callDate)
      .sort((a, b) => a.callDate.localeCompare(b.callDate));

    // ── Gap analysis across recorded calls ──────────────────
    if (dated.length >= 2) {
      const gaps = [];
      for (let i = 1; i < dated.length; i++) {
        const d = (new Date(dated[i].callDate + 'T12:00:00') - new Date(dated[i-1].callDate + 'T12:00:00')) / 86400000;
        gaps.push(d);
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const threshold = Math.max(avgGap * 2.5, avgGap + 10);

      for (let i = 0; i < gaps.length; i++) {
        if (gaps[i] > threshold && gaps[i] > 7) {
          const from = dated[i].callDate;
          const to   = dated[i + 1].callDate;
          warnings.push(`${Math.round(gaps[i])}-day gap between ${from} and ${to} (avg cadence ~${Math.round(avgGap)} days) — a meeting in this window may not have been recorded.`);
        }
      }

      // ── Gap from last recorded call to current call ──────
      if (callDate && dated.length) {
        const last = dated[dated.length - 1].callDate;
        const gapToCurrent = (new Date(callDate + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000;
        if (gapToCurrent > threshold && gapToCurrent > 7) {
          warnings.push(`${Math.round(gapToCurrent)}-day gap between last recorded call (${last}) and this call (avg cadence ~${Math.round(avgGap)} days) — one or more meetings in this window may not have been recorded.`);
        }
      }
    }

    // ── Transcript references to prior conversations ────────
    if (notes) {
      const priorRefRe = /\b(as (we|I|you) discussed|from (our |the )?last (call|meeting|conversation)|you mentioned (before|previously|last|earlier)|last (week|time) (we|you|I)|per our (last|previous|prior)|since (our|the) last (call|meeting)|following up (on|from) (our|last)|as (mentioned|discussed) (previously|before|earlier))\b/i;
      if (priorRefRe.test(notes) && dated.length > 0) {
        const last = dated[dated.length - 1].callDate;
        const daysSince = callDate
          ? (new Date(callDate + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000
          : null;
        if (daysSince === null || daysSince > 10) {
          warnings.push(`Transcript references prior conversations not fully accounted for in recorded history — context from an unrecorded meeting may be influencing this call.`);
        }
      }
    }

    return warnings;
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

  async function detectUnknownParticipants(notes, prospect, contactTitle, rep) {
    try {
      const teamNames = loadTeam().map(t => t.name).filter(Boolean);
      const knownSales = teamNames.length
        ? 'Known sales team members: ' + teamNames.join(', ')
        : 'No sales team members configured.';
      const storedTPs = Object.values(_thirdPartiesCache);
      const knownThirdParties = storedTPs.length
        ? 'Known third-party participants (NOT sales team, NOT customer — always classify these as "unknown"): ' +
          storedTPs.map(p => `${p.name}${p.organization ? ' (' + p.organization + ')' : ''}`).join(', ')
        : '';
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          stream: false,
          system: 'You identify call participants. Return ONLY valid JSON, no markdown.',
          messages: [{ role: 'user', content:
            `${knownSales}\n${knownThirdParties ? knownThirdParties + '\n' : ''}Customer company: ${prospect || 'unknown'}\nCustomer contact title: ${contactTitle || 'unknown'}\n\nReview this transcript and identify every distinct speaker. Return:\n{"participants":[{"name":"string","type":"sales_team"|"customer"|"unknown","clue":"brief reason"}]}\n\nRules:\n- "sales_team": name matches a known team member\n- "customer": clearly represents the prospect company\n- "unknown": neither — could be a partner, SE, vendor rep, consultant, etc. Known third-party participants above must always be classified as "unknown".\nOnly flag "unknown" if confident they are a real speaker who is not sales team or customer.\n\nTranscript:\n${notes.slice(0, 5000)}`
          }]
        })
      });
      if (!resp.ok) return { newUnknowns: [], known: [] };
      const data = await resp.json();
      const text = (data.content?.[0]?.text || '').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      const parsed = JSON.parse(text);
      const unknowns = (parsed.participants || []).filter(p => p.type === 'unknown');

      const newUnknowns = [], known = [];
      unknowns.forEach(u => {
        const stored = _getKnownThirdParty(u.name);
        if (stored) known.push(stored);
        else newUnknowns.push(u);
      });
      return { newUnknowns, known };
    } catch (e) {
      console.warn('[third-party check] failed:', e.message);
      return { newUnknowns: [], known: [] };
    }
  }

  let _thirdPartyResolve = null;

  function showThirdPartyPrompt(newUnknowns, known) {
    return new Promise(resolve => {
      _thirdPartyResolve = resolve;
      const list = document.getElementById('tpParticipantList');
      const knownHtml = (known && known.length) ? `
        <div class="tp-known-notice">
          <span class="tp-known-icon">&#10003;</span>
          Auto-recognized: ${known.map(k => `<strong>${escHtml(k.name)}</strong> (${escHtml(k.role || '')}${k.organization ? ', ' + escHtml(k.organization) : ''})`).join(', ')}
        </div>` : '';
      const storedParties = Object.values(_thirdPartiesCache);
      list.innerHTML = knownHtml + newUnknowns.map(u => {
        const sid = CSS.escape(u.name);
        const matchOpts = storedParties.length
          ? `<option value="">— new participant —</option>` +
            storedParties.map(p => `<option value="${escHtml(p.name)}">${escHtml(p.name)}${p.organization ? ' ('+escHtml(p.organization)+')' : ''}</option>`).join('')
          : null;
        const matchRow = matchOpts
          ? `<div class="tp-match-row">
               <label class="tp-match-label">Match to existing:</label>
               <select class="tp-match-select" id="tp-match-${sid}" onchange="tpMatchChanged(${JSON.stringify(u.name)})">
                 ${matchOpts}
               </select>
             </div>`
          : '';
        return `
        <div class="tp-person" id="tp-person-wrap-${sid}">
          <div class="tp-person-meta">
            <span class="tp-person-name">${escHtml(u.name)}</span>
            <span class="tp-person-clue">${escHtml(u.clue || '')}</span>
          </div>
          <div class="tp-person-right">
            ${matchRow}
            <div class="tp-person-inputs" id="tp-inputs-${sid}">
              <input class="tp-person-input" id="tp-role-${sid}"
                placeholder="Role — e.g. Channel partner SE, Security consultant…"
                autocomplete="off">
              <input class="tp-person-org" id="tp-org-${sid}"
                placeholder="Organization (optional)"
                autocomplete="off">
            </div>
            <div class="tp-match-preview" id="tp-preview-${sid}" style="display:none;"></div>
          </div>
        </div>`;
      }).join('');
      document.getElementById('thirdPartyPanel').style.display = 'block';
      document.getElementById('inputCard').style.display = 'none';
      const first = list.querySelector('.tp-person-input');
      if (first) first.focus();
    });
  }

  function confirmThirdParty() {
    const panel = document.getElementById('thirdPartyPanel');
    const entries = {};
    let allFilled = true;

    panel.querySelectorAll('.tp-person').forEach(personEl => {
      const sid = personEl.id.replace('tp-person-wrap-', '');
      const sel = personEl.querySelector('.tp-match-select');
      const matched = sel ? _thirdPartiesCache[(sel.value || '').toLowerCase()] : null;

      if (matched) {
        // User correlated this participant to an existing record — use stored data
        entries[matched.name] = { role: matched.role || '', organization: matched.organization || '', _matched: true };
      } else {
        const inp = personEl.querySelector('.tp-person-input');
        const orgInp = personEl.querySelector('.tp-person-org');
        if (!inp) return;
        const role = inp.value.trim();
        const org  = orgInp ? orgInp.value.trim() : '';
        // Recover original name from the role input id
        const name = inp.id.replace(/^tp-role-/, '');
        if (!role) { inp.classList.add('tp-input-error'); allFilled = false; }
        else { inp.classList.remove('tp-input-error'); entries[name] = { role, organization: org }; }
      }
    });

    if (!allFilled) return;

    // Persist only new (non-matched) third parties to DB
    Object.entries(entries).forEach(([name, fields]) => {
      if (!fields._matched) _dbSaveThirdParty(name, fields);
    });

    panel.style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    if (_thirdPartyResolve) { _thirdPartyResolve(entries); _thirdPartyResolve = null; }
  }

  function cancelThirdParty() {
    document.getElementById('thirdPartyPanel').style.display = 'none';
    document.getElementById('inputCard').style.display = 'block';
    if (_thirdPartyResolve) { _thirdPartyResolve(null); _thirdPartyResolve = null; }
  }

  window.tpMatchChanged = function(rawName) {
    const sid = CSS.escape(rawName);
    const sel = document.getElementById('tp-match-' + sid);
    const inputsEl = document.getElementById('tp-inputs-' + sid);
    const previewEl = document.getElementById('tp-preview-' + sid);
    if (!sel) return;
    const matched = _thirdPartiesCache[(sel.value || '').toLowerCase()];
    if (matched) {
      if (inputsEl) inputsEl.style.display = 'none';
      if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `<span class="tp-match-chip">
          <span class="tp-match-chip-name">${escHtml(matched.name)}</span>
          ${matched.role ? `<span class="tp-match-chip-meta">${escHtml(matched.role)}</span>` : ''}
          ${matched.organization ? `<span class="tp-match-chip-meta">${escHtml(matched.organization)}</span>` : ''}
        </span>`;
      }
    } else {
      if (inputsEl) inputsEl.style.display = '';
      if (previewEl) { previewEl.style.display = 'none'; previewEl.innerHTML = ''; }
    }
  };

  async function gradeCall() {
    const notes = document.getElementById('callNotes').value.trim();
    const prospect = document.getElementById('prospect').value.trim();
    const contactTitle = document.getElementById('contactTitle').value.trim();
    const callDate = document.getElementById('callDate').value;
    const rep = getSelectedRep();

    if (!notes) { showError('Please paste your call notes or transcript.'); return; }

    clearError();
    document.getElementById('results').style.display = 'none';
    document.getElementById('submitBtn').disabled = true;

    // ── Pre-scan step — show loading screen early ─────────────
    const loadEl = document.getElementById('loading');
    const parts = [prospect, selectedStage].filter(Boolean);
    document.getElementById('loadContext').textContent = (parts.length ? parts.join(' // ') : 'ENGAGEMENT').toUpperCase();
    loadEl.style.display = 'flex';
    startRadar();
    const preStep = document.getElementById('lstep-pre');
    const preIcon = document.getElementById('lstep-icon-pre');
    const preBar  = document.getElementById('lstep-bar-pre');
    if (preStep) { preStep.classList.remove('done'); preStep.classList.add('visible', 'active'); }

    // ── Third-party participant check ─────────────────────────
    const { newUnknowns, known } = await detectUnknownParticipants(notes, prospect, contactTitle, rep);
    // Mark pre-scan step done
    if (preStep) { preStep.classList.remove('active'); preStep.classList.add('done'); }
    if (preIcon) preIcon.textContent = '✓';
    if (preBar)  preBar.style.width = '100%';

    let userEntries = {};
    if (newUnknowns.length) {
      // Hide loading while user fills in the prompt
      loadEl.style.display = 'none';
      stopRadar();
      document.getElementById('submitBtn').disabled = false;
      userEntries = await showThirdPartyPrompt(newUnknowns, known);
      if (!userEntries) {
        // User cancelled — reset pre-scan step for next attempt
        if (preStep) preStep.classList.remove('visible', 'active', 'done');
        if (preIcon) preIcon.textContent = '○';
        if (preBar)  preBar.style.width = '0%';
        return;
      }
      document.getElementById('submitBtn').disabled = true;
    }

    // Build complete third-party list (known + newly identified)
    const allThirdParties = [
      ...known.map(k => ({ name: k.name, role: k.role || '', organization: k.organization || '' })),
      ...Object.entries(userEntries).map(([name, f]) => ({ name, role: f.role, organization: f.organization || '' })),
    ];

    let thirdPartyContext = '';
    if (allThirdParties.length) {
      const lines = allThirdParties.map(p =>
        `- ${p.name}: ${p.role}${p.organization ? ' (' + p.organization + ')' : ''}`
      ).join('\n');
      thirdPartyContext = `\n\nThird-party participants on this call (NOT OneAxiom sales reps, NOT the customer):\n${lines}\n\nGrading instructions for third-party participants:\n- Do NOT include third-party participants in rep_scores — only score OneAxiom sales reps\n- Do NOT penalize the OneAxiom rep for topics or tasks the third party handled\n- In call_summary, acknowledge the third party's presence and note how their role affected call dynamics\n- Populate the partner_scores array (one entry per third-party participant) using this schema:\n\n"partner_scores": [\n  {\n    "name": "participant name",\n    "role": "their role as provided",\n    "organization": "their org if known",\n    "dimensions": [\n      { "name": "Technical relevance", "max": 25, "score": 0, "feedback": "2-3 sentences — did their technical contributions match the prospect needs?" },\n      { "name": "Rep alignment", "max": 25, "score": 0, "feedback": "2-3 sentences — did they reinforce or contradict the rep positioning?" },\n      { "name": "Preparation", "max": 25, "score": 0, "feedback": "2-3 sentences — were they briefed and ready for this specific account?" },\n      { "name": "Deal momentum", "max": 25, "score": 0, "feedback": "2-3 sentences — did their presence move the deal forward or introduce friction?" }\n    ],\n    "total": 0,\n    "letter_grade": "B",\n    "grade_label": "short evocative phrase",\n    "top_strength": "one specific sentence about what this partner did well",\n    "top_priority": "single most important improvement for this partner",\n    "call_impact": "positive|negative|neutral",\n    "call_impact_delta": 0,\n    "call_impact_summary": "2-3 sentences explaining how their presence affected overall call outcome — be specific about what helped or hurt"\n  }\n]\n\ncall_impact_delta: estimate the net point impact this partner had on the call effectiveness as a signed integer (e.g. +8 if they meaningfully helped, -5 if they confused the prospect or undercut the rep). This does NOT change the rep score — it is an independent assessment of partner contribution.`;
    }

    setLoading(true, prospect, selectedStage);

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
spiced: evaluate each of the 6 SPICED components (Situation, Pain, Impact, Critical Event, Evolution, Decision) from the SPICED framework (Winning by Design). Set touched to true if the rep meaningfully engaged with that component in the transcript, false if it was absent or superficial. Write a 1-2 sentence summary for each regardless of whether it was touched — if not touched, briefly note what was missing and why it matters.${thirdPartyContext}`;

    const team = loadTeam();
    const teamContext = team.length
      ? 'OneAxiom sales team on this call (include ALL who speak in rep_scores): ' +
        team.map(m => `${m.name} (${m.role})`).join(', ')
      : '';
    const context = [
      rep ? 'Primary rep: ' + rep.name + ' (' + rep.role + ')' : '',
      teamContext,
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
          max_tokens: 8192,
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
      renderResults(JSON.parse(raw), prospect, contactTitle, rep, callDate, notes, allThirdParties);
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

  function renderResults(r, prospect, contactTitle, rep, callDate, notes, thirdParties) {
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

    // Partner scores
    const partnerScores = (r.partner_scores || []).filter(ps => ps.name && ps.dimensions?.length);
    const partnerHtml = partnerScores.length ? `
      <div class="section-head">Partner contributions</div>
      ${partnerScores.map(ps => {
        const delta = ps.call_impact_delta || 0;
        const deltaSign = delta > 0 ? '+' : '';
        const deltaCls = delta > 0 ? 'partner-delta-pos' : delta < 0 ? 'partner-delta-neg' : 'partner-delta-neu';
        const deltaTxt = delta !== 0 ? `${deltaSign}${delta} pts` : 'Neutral';
        const bg = getBannerColor(ps.letter_grade);
        return `<div class="partner-card">
          <div class="partner-card-hdr">
            <div class="partner-card-badge" style="background:${bg};">${escHtml(ps.letter_grade)} ${ps.total}</div>
            <div class="partner-card-meta">
              <span class="partner-card-name">${escHtml(ps.name)}</span>
              <span class="partner-card-role">${escHtml([ps.role, ps.organization].filter(Boolean).join(' · '))}</span>
            </div>
            <div class="partner-delta ${deltaCls}">
              <span class="partner-delta-arrow">${delta > 0 ? '▲' : delta < 0 ? '▼' : '●'}</span>
              <span class="partner-delta-val">${deltaTxt}</span>
              <span class="partner-delta-lbl">to call effectiveness</span>
            </div>
          </div>
          <div class="partner-impact-summary">${escHtml(ps.call_impact_summary || '')}</div>
          ${buildDimsHtml(ps.dimensions)}
          <div class="partner-bottom">
            <div class="partner-bottom-item"><span class="partner-bottom-label">Strength</span> ${escHtml(ps.top_strength || '')}</div>
            <div class="partner-bottom-item"><span class="partner-bottom-label">Priority</span> ${escHtml(ps.top_priority || '')}</div>
          </div>
        </div>`;
      }).join('')}` : '';

    // Toggle + score views
    const repScores = (r.rep_scores || []).filter(rs => rs.name && rs.dimensions?.length);
    // Only show toggle when 2+ reps are on the call — single rep = no meaningful distinction
    const showToggle = repScores.length > 1;

    const toggleHtml = showToggle ? `
      <div class="rep-toggle">
        <button class="rep-toggle-btn active" id="toggle-overall" onclick="switchScoreView('overall',event)">Overall Call</button>
        ${repScores.map((rs, i) => `<button class="rep-toggle-btn" id="toggle-rep-${i}" onclick="switchScoreView('rep-${i}',event)">${escHtml(rs.name)}</button>`).join('')}
      </div>` : '';

    const overallView = buildScoreView(r, overallMeta, 'overall');
    const repViews = showToggle ? repScores.map((rs, i) => buildScoreView(rs, escHtml(rs.name) + (selectedStage ? ' · ' + selectedStage : ''), `rep-${i}`)).join('') : '';

    const isColdCall = selectedStage.toLowerCase().includes('cold');
    const priorCalls = prospect
      ? loadHistory().filter(h => (h.prospect || '').toLowerCase().trim() === prospect.toLowerCase().trim())
      : [];
    const noContextBanner = (!isColdCall && priorCalls.length === 0) ? `
      <div class="no-context-banner">
        <span class="no-context-icon">&#9432;</span>
        <span>No prior call history found for <strong>${escHtml(prospect || 'this prospect')}</strong>. This report was graded without account context — missed questions or gaps may reflect unknown prior discovery rather than rep performance.</span>
      </div>` : '';

    const missingRecWarnings = detectMissingRecordings(priorCalls, callDate, notes);
    const missingRecBanner = missingRecWarnings.length ? `
      <div class="no-context-banner missing-rec-banner">
        <span class="no-context-icon">&#9888;</span>
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Possible unrecorded meeting(s) detected</div>
          <ul style="margin:0;padding-left:16px;">${missingRecWarnings.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>
        </div>
      </div>` : '';

    const tpList = thirdParties && thirdParties.length ? thirdParties : [];
    const thirdPartyBanner = tpList.length ? `
      <div class="no-context-banner tp-report-banner">
        <span class="no-context-icon">&#128101;</span>
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Third-party participant(s) on this call</div>
          <ul style="margin:0;padding-left:16px;">${tpList.map(p =>
            `<li><strong>${escHtml(p.name)}</strong> — ${escHtml(p.role)}${p.organization ? ', ' + escHtml(p.organization) : ''}</li>`
          ).join('')}</ul>
          <div style="margin-top:6px;font-size:11.5px;opacity:.75;">Scoring excludes this participant. Rep not penalised for tasks they covered.</div>
        </div>
      </div>` : '';

    const pdfTitle = [prospect, selectedStage, callDate].filter(Boolean).join(' — ');
    const resultsHtml = `
      ${noContextBanner}
      ${missingRecBanner}
      ${thirdPartyBanner}
      ${toggleHtml}
      ${overallView}
      ${repViews}
      ${summaryHtml}
      ${spicedHtml}
      ${partnerHtml}
      <div class="results-actions">
        <button class="reset-btn" onclick="resetForm()">&#8592; Grade another call</button>
        <button class="pdf-btn" onclick="exportReportPDF(${JSON.stringify(pdfTitle)})">&#8595; Export PDF</button>
      </div>`;

    document.getElementById('results').innerHTML = resultsHtml;
    document.getElementById('results').style.display = 'block';
    document.getElementById('inputCard').style.display = 'none';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Auto-detect rep from transcript if not manually set
    const detectedRep = rep || autoDetectRep(r.rep_scores || []);
    const savedRecord = saveToHistory(r, prospect, contactTitle, detectedRep, callDate, resultsHtml);
    autoGenerateNextSteps(notes, prospect, callDate, savedRecord.id);

    // Update the rep selector UI to reflect the auto-detected rep
    if (!rep && detectedRep) {
      const repSel = document.getElementById('repSelect');
      if (repSel) repSel.value = String(detectedRep._idx ?? '');
    }
  }

  function autoDetectRep(repScores) {
    if (!repScores.length) return null;
    const normalize = s => (s || '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const team = loadTeam();

    // Try to match against the team roster first
    if (team.length) {
      for (const rs of repScores) {
        const rsName = normalize(rs.name);
        const rsParts = rsName.split(/\s+/);
        for (let i = 0; i < team.length; i++) {
          const m = team[i];
          const mName = normalize(m.name);
          const mParts = mName.split(/\s+/);
          if (mName === rsName ||
              (rsParts[0] && mParts[0] === rsParts[0]) ||
              (rsParts[rsParts.length-1] && mParts[mParts.length-1] === rsParts[rsParts.length-1])) {
            return { ...m, _idx: i };
          }
        }
      }
    }

    // No team roster or no match — still capture the name from the transcript
    const first = repScores[0];
    if (first?.name) return { name: first.name, role: '', _idx: null };
    return null;
  }

  function switchScoreView(viewId, e) {
    // Scope to the nearest card container so duplicate IDs across history cards don't conflict
    const root = (e && e.target.closest('.hist-card-body, #results')) || document;
    root.querySelectorAll('.score-view').forEach(el => el.classList.remove('active'));
    root.querySelectorAll('.rep-toggle-btn').forEach(el => el.classList.remove('active'));
    const view = root.querySelector('#score-view-' + viewId);
    const btn  = root.querySelector('#toggle-' + viewId);
    if (view) view.classList.add('active');
    if (btn)  btn.classList.add('active');
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
      ['pre', 0, 1, 2, 3].forEach(key => {
        const s  = document.getElementById('lstep-' + key);
        const ic = document.getElementById('lstep-icon-' + key);
        const b  = document.getElementById('lstep-bar-' + key);
        if (s)  { s.style.opacity = ''; s.style.transform = ''; s.classList.remove('visible', 'active', 'done'); }
        if (ic) ic.textContent = '○';
        if (b)  b.style.width = '0%';
      });
      // Pre-scan already completed before setLoading was called — show it as done immediately
      const preS = document.getElementById('lstep-pre');
      const preI = document.getElementById('lstep-icon-pre');
      const preB = document.getElementById('lstep-bar-pre');
      if (preS) { preS.classList.add('visible', 'done'); }
      if (preI) preI.textContent = '✓';
      if (preB) preB.style.width = '100%';
      // Stagger the 4 grading steps into view
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
      ['pre', 0, 1, 2, 3].forEach(key => {
        const s  = document.getElementById('lstep-' + key);
        const ic = document.getElementById('lstep-icon-' + key);
        if (s)  { s.classList.remove('active'); s.classList.add('visible', 'done'); }
        if (ic) ic.textContent = '✓';
      });
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

  function loadAllTime() {
    try { return JSON.parse(localStorage.getItem('oa_usage') || '{"cost":0,"calls":0}'); } catch { return { cost: 0, calls: 0 }; }
  }
  function saveAllTime(d) { try { localStorage.setItem('oa_usage', JSON.stringify(d)); } catch {} }
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
    document.getElementById('val-cost-session').textContent = '$' + sessionCost.toFixed(4);
    document.getElementById('val-cost-alltime').textContent = '$' + allTime.cost.toFixed(2);
    document.getElementById('sub-alltime').textContent = allTime.calls + ' call' + (allTime.calls !== 1 ? 's' : '') + ' graded';
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
    document.getElementById('val-cost-alltime').textContent = '$0.00';
    document.getElementById('sub-alltime').textContent = '0 calls graded';
  }

  function initUsageBar() {
    const allTime = loadAllTime();
    document.getElementById('val-cost-alltime').textContent = '$' + allTime.cost.toFixed(2);
    document.getElementById('sub-alltime').textContent = allTime.calls + ' call' + (allTime.calls !== 1 ? 's' : '') + ' graded';
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
  if (isDemoEnabled()) {
    callNotesEl.value = SAMPLE_TRANSCRIPT;
    callNotesEl.addEventListener('focus', function onFocus() {
      if (callNotesEl.value === SAMPLE_TRANSCRIPT) callNotesEl.value = '';
      callNotesEl.removeEventListener('focus', onFocus);
    });
  }

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
  function loadHistory(raw) {
    try {
      const data = _histCache.map(h => ({ ...h }));
      data.forEach(h => { if (typeof h.total === 'number' && h.total > 0) h.letter_grade = scoreToGrade(h.total); });
      if (!raw && !isDemoEnabled()) return data.filter(h => !h.is_demo);
      return data;
    } catch { return []; }
  }

  function saveHistoryData(records) {
    _histCache = [...records];
    _dbBulkSave(records);
  }

  function saveToHistory(r, prospect, contactTitle, rep, callDate, resultsHtml) {
    const record = {
      id: String(Date.now()),
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
      resultsHtml,
      partner_scores: (r.partner_scores && r.partner_scores.length) ? r.partner_scores : undefined,
      is_demo: false,
    };
    _histCache.unshift(record);
    if (_histCache.length > 200) _histCache.splice(200);
    _dbSaveRecord(record);
    return record;
  }

  function exportReportPDF(title, rawHtml) {
    let html = rawHtml;
    if (!html) {
      const resultsEl = document.getElementById('results');
      if (!resultsEl || resultsEl.style.display === 'none') return;
      html = resultsEl.innerHTML;
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const clone = tmp;
    clone.querySelectorAll('.results-actions').forEach(el => el.remove());
    clone.querySelectorAll('.rep-toggle').forEach(el => el.remove());
    clone.querySelectorAll('.score-view').forEach(el => { el.style.display = 'block'; });

    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${title || 'Call Report'}</title>
      <link rel="stylesheet" href="${window.location.origin}/styles.css">
      <style>
        :root {
          --siren-bg-page:#fff; --siren-bg-card:#f4f6f9; --siren-bg-card-raised:#eaecf0;
          --siren-bg-overlay:#e0e4ea;
          --siren-border:rgba(0,0,0,.10); --siren-border-mid:rgba(0,0,0,.22);
          --siren-text-primary:#0d1f2d; --siren-text-body:#1a2d3d;
          --siren-text-muted:#3a5060; --siren-text-faint:#6a8090;
          --siren-cyan:#006fa6; --siren-cyan-90:rgba(0,111,166,.90);
          --siren-cyan-70:rgba(0,111,166,.70); --siren-cyan-50:rgba(0,111,166,.50);
          --siren-cyan-40:rgba(0,111,166,.40); --siren-cyan-20:rgba(0,111,166,.20);
          --siren-cyan-12:rgba(0,111,166,.12); --siren-cyan-08:rgba(0,111,166,.08);
          --siren-grade-a:#006fa6; --siren-grade-b:#007a5a;
          --siren-grade-c:#b07000; --siren-grade-d:#b03030; --siren-grade-f:#8c2020;
          --siren-signal-green:#007a5a; --siren-alert-amber:#b07000;
          --siren-danger-red:#b03030; --siren-neutral:#6a8090;
        }
        body { background:#fff; margin:0; padding:28px 36px; font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif; }
        .score-view { display:block !important; }
        .rep-toggle { display:none !important; }
        .dim-feedback, .spiced-summary { color:#3a5060 !important; }
        .no-context-banner { background:rgba(0,111,166,.07) !important; border-color:rgba(0,111,166,.25) !important; color:#005580 !important; }
        .missing-rec-banner { background:rgba(180,100,0,.07) !important; border-color:rgba(180,100,0,.3) !important; color:#7a4400 !important; }
        h1.pdf-title { font-size:15px; font-weight:600; color:#0d1f2d; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid rgba(0,0,0,.12); }
        @media print { body { padding:0; } @page { margin:16mm 14mm; } }
      </style>
    </head><body>
      <h1 class="pdf-title">${title || 'Call Report'}</h1>
      ${clone.innerHTML}
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() { window.print(); }, 400);
        });
        window.addEventListener('afterprint', function() { window.close(); });
      <\/script>
    </body></html>`);
    win.document.close();
  }

  function exportHistoryPDF(id) {
    const h = _histCache.find(r => String(r.id) === String(id));
    if (!h) return;
    const title = [h.prospect, h.stage, h.callDate].filter(Boolean).join(' — ');
    exportReportPDF(title, h.resultsHtml || '');
  }

  async function autoGenerateNextSteps(notes, prospect, callDate, recordId) {
    if (!notes || !prospect) return;
    const callMs = callDate ? new Date(callDate + 'T12:00:00').getTime() : Date.now();
    if (callMs < Date.now() - 5 * 86400000) return;

    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          stream: false,
          system: 'You are a sales follow-up assistant. Return ONLY a valid JSON array of strings — no markdown, no explanation.',
          messages: [{
            role: 'user',
            content: `Based on this sales call transcript for ${prospect}, list 3–5 specific, actionable next steps for the rep. Each item must be a concrete action (e.g. "Send pricing comparison by EOW", "Schedule technical deep-dive with IT lead"). Return ONLY a JSON array of strings.\n\n${notes.slice(0, 4000)}`
          }]
        })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const text = (data.content?.[0]?.text || '').trim();
      const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const steps = JSON.parse(clean);
      if (!Array.isArray(steps) || !steps.length) return;

      // Update the in-memory record
      const rec = _histCache.find(h => h.id === String(recordId));
      if (rec) rec.next_steps = steps;

      // Seed VIGIL tasks for this prospect
      pulseSeedTasks(prospect, [{ next_steps: steps, callDate, ts: new Date().toISOString() }]);

      // Persist to DB
      _dbPatchRecord(recordId, { next_steps: JSON.stringify(steps) });
    } catch (e) {
      console.warn('[next-steps] failed:', e.message);
    }
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
    // Show full report: remove reset button and rep-toggle switcher, make all score-views visible
    const bodyHtml = (h.resultsHtml || '')
      .replace(/<button[^>]*class="[^"]*reset-btn[^"]*"[\s\S]*?<\/button>/g, '')
      .replace(/<div class="rep-toggle">[\s\S]*?<\/div>\s*/, '')
      .replace(/class="score-view[^"]*"/g, 'class="score-view active"')
      .replace(/onclick="switchScoreView\('([^']+)'\)"/g, "onclick=\"switchScoreView('$1',event)\"")
      .replace(/background:#00c8ff/g, 'background:#006a8a')
      .replace(/background:#00c896/g, 'background:#0a6b52')
      .replace(/background:#e8a020/g, 'background:#7c5514')
      .replace(/background:#e05050/g, 'background:#7a2828')
      .replace(/background:#c03030/g, 'background:#5c1c1c')
      .replace(/color:#e8a020/g, 'color:#c47f1a')
      .replace(/color:#e05050/g, 'color:#a83535');
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:1rem;border-top:1px solid var(--siren-border);padding-top:12px;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:11px;color:var(--siren-text-faint);">Rep:</span>
            <span id="hist-rep-display-${h.id}" style="font-size:12px;color:${h.rep ? 'var(--siren-cyan-90)' : 'rgba(255,255,255,.2)'};cursor:pointer;" onclick="startEditHistRep(${h.id})" title="Click to edit rep">${escHtml(h.rep || '— unassigned')}</span>
            ${h.repRole ? `<span style="font-size:11px;color:var(--siren-text-faint);">${escHtml(h.repRole)}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="pdf-btn pdf-btn-sm" onclick="exportHistoryPDF(${h.id});event.stopPropagation()">&#8595; PDF</button>
            <button class="hist-delete-btn" onclick="deleteHistEntry(${h.id},event)">Delete this entry</button>
          </div>
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
        const cSafeQ = company.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const industry = _getProspectIndustry(company);
        return `<div style="margin-bottom:1.5rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;padding:6px 4px;border-radius:5px;transition:background .15s;" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer;" onclick="toggleGroupCards('${groupId}')">
              <span style="font-size:16px;font-weight:700;color:var(--siren-cyan-90);">${escHtml(company)}</span>
              ${industry ? `<span style="font-size:11px;color:var(--siren-text-faint);background:var(--siren-bg-card-raised);padding:2px 8px;border-radius:10px;">${escHtml(industry)}</span>` : ''}
              <span style="font-size:12px;color:var(--siren-text-faint);">${entries.length} transcript${entries.length !== 1 ? 's' : ''} · avg score ${avgScore}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
              ${stages.map(s => `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:2px 7px;border-radius:4px;background:var(--siren-bg-card-raised);color:var(--siren-text-muted);">${escHtml(s)}</span>`).join('')}
              ${repNames.length ? `<span style="font-size:11px;color:var(--siren-text-faint);">${escHtml(repNames.join(', '))}</span>` : ''}
              <span class="hist-card-chevron open" id="grp-chev-${groupId}" style="margin-left:2px;cursor:pointer;" onclick="toggleGroupCards('${groupId}')">&#9660;</span>
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

  function collapseAllHistCards() {
    document.querySelectorAll('.hist-card-body').forEach(body => { body.style.display = 'none'; });
    document.querySelectorAll('.hist-card-chevron:not([id^="grp-chev-"])').forEach(chev => { chev.classList.remove('open'); });
  }

  function collapseAllGroups() {
    document.querySelectorAll('[id^="grp-"]').forEach(el => {
      if (el.id.startsWith('grp-chev-')) return;
      el.style.display = 'none';
      const chev = document.getElementById('grp-chev-' + el.id);
      if (chev) chev.classList.remove('open');
    });
  }

  function toggleGroupCards(groupId) {
    const el = document.getElementById(groupId);
    if (!el) return;
    const collapsed = el.style.display === 'none';
    el.style.display = collapsed ? '' : 'none';
    const chev = document.getElementById('grp-chev-' + groupId);
    if (chev) chev.classList.toggle('open', collapsed);
  }

  function startEditIndustry(e, name) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const current = _getProspectIndustry(name);
    const inp = document.createElement('input');
    inp.value = current;
    inp.placeholder = 'e.g. Healthcare';
    inp.style.cssText = 'font-size:12px;color:var(--siren-text);background:rgba(255,255,255,.06);border:1px solid rgba(0,200,255,.4);border-radius:4px;padding:2px 7px;outline:none;width:160px;';
    btn.replaceWith(inp);
    inp.focus();
    inp.select();
    const commit = () => {
      const val = inp.value.trim();
      _dbSaveProspect(name, { industry: val });
      renderHistory();
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e2 => {
      if (e2.key === 'Enter')  { e2.preventDefault(); inp.blur(); }
      if (e2.key === 'Escape') { inp.value = current; inp.blur(); }
    });
  }

  function startRenameAccount(btn, oldName) {
    btn.stopPropagation?.();
    const nameSpan = btn.closest('[style*="margin-bottom:1.5rem"]')?.querySelector('span[style*="font-size:16px"]');
    if (!nameSpan) return;
    const inp = document.createElement('input');
    inp.value = oldName;
    inp.style.cssText = 'font-size:16px;font-weight:700;color:var(--siren-cyan-90);background:rgba(255,255,255,.06);border:1px solid rgba(0,200,255,.4);border-radius:4px;padding:1px 6px;outline:none;width:220px;';
    nameSpan.replaceWith(inp);
    inp.focus();
    inp.select();
    const commit = () => {
      const newName = inp.value.trim();
      if (newName && newName !== oldName) renameAccount(oldName, newName);
      else renderHistory();
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp.value = oldName; inp.blur(); }
    });
  }

  function renameAccount(oldName, newName) {
    // 1. History cache + DB (also renames in prospects table via server)
    _histCache.forEach(h => { if ((h.prospect || '').trim() === oldName) h.prospect = newName; });
    if (_prospectsCache[oldName]) {
      _prospectsCache[newName] = { ..._prospectsCache[oldName], name: newName };
      delete _prospectsCache[oldName];
    }
    _dbRenameProspect(oldName, newName);

    // 2. VIGIL tasks (localStorage)
    try {
      const tasks = JSON.parse(localStorage.getItem('oa_pulse_tasks') || '{}');
      if (tasks[oldName] !== undefined) {
        tasks[newName] = tasks[oldName];
        delete tasks[oldName];
        localStorage.setItem('oa_pulse_tasks', JSON.stringify(tasks));
      }
    } catch {}

    // 3. SCOPE data (localStorage)
    try {
      const scope = JSON.parse(localStorage.getItem('oa_scope_v2') || '{}');
      if (scope[oldName] !== undefined) {
        scope[newName] = scope[oldName];
        delete scope[oldName];
        localStorage.setItem('oa_scope_v2', JSON.stringify(scope));
      }
    } catch {}

    // 4. SCOPE companies list (localStorage)
    try {
      const companies = JSON.parse(localStorage.getItem('oa_scope_companies') || '[]');
      const idx = companies.indexOf(oldName);
      if (idx !== -1) { companies[idx] = newName; localStorage.setItem('oa_scope_companies', JSON.stringify(companies)); }
    } catch {}

    renderHistory();
  }

  function startEditHistRep(id) {
    const display = document.getElementById('hist-rep-display-' + id);
    if (!display) return;
    const team = loadTeam();
    const hist = loadHistory(true);
    const rec = hist.find(h => String(h.id) === String(id));
    const current = rec ? rec.rep || '' : '';

    // Build datalist for team autocomplete
    const listId = 'hist-rep-list-' + id;
    let datalist = document.getElementById(listId);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = listId;
      document.body.appendChild(datalist);
    }
    datalist.innerHTML = team.map(m => `<option value="${escHtml(m.name)}">`).join('');

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = current;
    inp.setAttribute('list', listId);
    inp.style.cssText = 'font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(0,200,255,.4);border-radius:4px;padding:2px 7px;color:var(--siren-cyan-90);outline:none;width:180px;';
    display.replaceWith(inp);
    inp.focus();
    inp.select();

    const commit = () => saveHistRep(id, inp.value.trim(), team);
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp.value = current; inp.blur(); }
    });
  }

  function saveHistRep(id, name, team) {
    if (team === undefined) team = loadTeam();
    const sid = String(id);
    const idx = _histCache.findIndex(h => String(h.id) === sid);
    if (idx === -1) { renderHistory(); return; }
    const normalize = s => (s || '').toLowerCase().trim();
    const match = team.find(m => normalize(m.name) === normalize(name));
    const patch = { rep: name, repRole: match ? match.role : _histCache[idx].repRole || '' };
    Object.assign(_histCache[idx], patch);
    _dbPatchRecord(sid, patch);
    renderHistory();
  }

  function deleteHistEntry(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this history entry?')) return;
    const sid = String(id);
    _histCache = _histCache.filter(h => String(h.id) !== sid);
    _dbDeleteRecord(sid);
    renderHistory();
  }

  function clearHistory() {
    if (!confirm('Clear all call history? This cannot be undone.')) return;
    _histCache = [];
    _dbBulkSave([]);
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

