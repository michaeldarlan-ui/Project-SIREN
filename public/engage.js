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
    const adj = typeof applyGradingOffset === 'function' ? applyGradingOffset(n, window._sirenUserGradingLevel ?? window._sirenGradingLevel) : n;
    if (adj >= 97) return 'A+';
    if (adj >= 93) return 'A';
    if (adj >= 90) return 'A-';
    if (adj >= 87) return 'B+';
    if (adj >= 83) return 'B';
    if (adj >= 80) return 'B-';
    if (adj >= 77) return 'C+';
    if (adj >= 73) return 'C';
    if (adj >= 70) return 'C-';
    if (adj >= 67) return 'D+';
    if (adj >= 63) return 'D';
    if (adj >= 60) return 'D-';
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
    const stage = (selectedStage || '').toLowerCase();

    const isSDR     = role.includes('sdr') || role.includes('bdr') || role.includes('development');
    const isSE      = role.includes('engineer') || role.includes(' se') || role === 'se' || role.includes('presales') || role.includes('pre-sales') || role.includes('architect') || role.includes('solutions consultant') || role.includes('technical advisor');
    const isManager = (role.includes('manager') && !role.includes('account manager')) || role.includes('director') || role.includes('vp') || role.includes('leader') || role.includes('chief') || role.includes('cro') || role.includes('cso');
    const isAM      = role === 'am' || role.includes('account manager') || role.includes('csm') || role.includes('customer success') || role.includes('renewal');

    const isCold      = stage.includes('cold');
    const isDiscovery = stage.includes('discovery');
    const isDemo      = stage.includes('demo') || stage.includes('solution');
    const isProposal  = stage.includes('proposal') || stage.includes('close');
    const isTouchpoint = stage.includes('touchpoint');

    let guidance = `\n\nRep role context — ${rep.name} is a ${rep.role}.`;

    if (isSDR) {
      if (isCold)
        guidance += ` SDR on a cold call: primary motion. Grade rigorously on discovery, value framing (brief hook only), objection handling, and next-step commitment. Demo delivery is N/A — award 0.`;
      else if (isDiscovery)
        guidance += ` SDR on a discovery call: grade on question quality and handoff clarity. Value framing is expected at a light level. Demo delivery is N/A. Do not grade on deep qualification or close mechanics.`;
      else if (isDemo)
        guidance += ` SDR on a demo: rarely expected. Grade only on whether their contributions helped or created noise. Demo delivery grading belongs to the AE/SE — do not assign demo delivery credit to the SDR.`;
      else if (isTouchpoint)
        guidance += ` SDR on a touchpoint: not expected. No grading expectations beyond professional conduct. Demo delivery is N/A.`;
      else
        guidance += ` SDR: lighter expectations on demo delivery (N/A unless explicitly assigned) and deep qualification. Full weight on discovery, value framing (brief), objection handling, and next steps.`;
    } else if (isSE) {
      if (isDemo)
        guidance += ` SE on a demo: primary motion. Grade rigorously on demo delivery accuracy, pain-to-feature linkage, and technical objection handling. Value framing is graded on how well they translate technical capability into business value. Do not grade on commercial negotiation or close mechanics.`;
      else if (isProposal)
        guidance += ` SE on a proposal/close: grade only on last-mile technical contributions. Demo delivery reduced — a brief recap only. Do not grade on commercial terms or closing pressure.`;
      else if (isDiscovery)
        guidance += ` SE on a discovery call: grade on technical listening and value framing of your company's capability. Demo delivery is N/A. Hold lighter expectations on commercial discovery and qualification.`;
      else
        guidance += ` SE: primary focus is demo delivery and technical value framing. Lighter on commercial discovery, qualification, and close mechanics.`;
    } else if (isManager) {
      guidance += ` Managers and executives are graded on a different standard than ICs. Demo delivery is N/A — award 0. Executive Presence & Strategic Positioning replaces it as a scored dimension (max 10 pts): evaluate peer-level credibility with counterpart executives, staying at strategic altitude (business outcomes, not feature details), reinforcing the rep without undermining them, handling escalated objections with authority, and making appropriate forward commitments without over-promising.`;
      if (isProposal)
        guidance += ` On a proposal/close: primary value is handling final commercial escalations and executive-to-executive commitment anchoring. Penalize if they re-demo, re-explain features, or take over the AE's closing motion.`;
      else if (isDiscovery)
        guidance += ` On a discovery call: grade on whether they asked 1-2 high-impact strategic questions and listened — not whether they led discovery. Penalize if they hijack the call flow, answer questions meant for the prospect, or go operational.`;
      else if (isDemo)
        guidance += ` On a demo: their role is silent credibility and handling any executive-level objections. Penalize if they interrupt the SE/AE's demo flow or provide unsolicited technical commentary.`;
      else
        guidance += ` Grade rigorously on executive presence, strategic alignment, and escalation handling. Coaching behaviors toward the AE are a positive signal — note them explicitly.`;
    } else if (isAM) {
      if (isTouchpoint)
        guidance += ` AM on a touchpoint: this is a post-sale or renewal context. Grade on expansion discovery, upsell signals surfaced, relationship depth, and retention mechanics. Do not grade on pipeline generation techniques.`;
      else
        guidance += ` Weight grading toward expansion discovery, upsell signals, relationship depth, and retention mechanics. Lighter expectations on cold prospecting. Rigorous on value confirmation and next-step clarity.`;
    } else {
      // AE or unrecognized
      guidance += ` Demo delivery is N/A for AEs — the AE orchestrates and sets context for the demo but does not deliver it; that is the SE's responsibility. Award 0 for demo delivery regardless of what occurred.`;
      if (isCold)
        guidance += ` AE on a cold call: grade on opening, handling resistance, and booking a concrete next meeting. No extra credit for seniority.`;
      else if (isDemo)
        guidance += ` AE on a demo: grade rigorously on discovery re-confirmation, value framing of each capability shown, and owning next steps. Do not grade the AE on the demo itself — that belongs to the SE. Penalize if the AE talks over the SE or re-explains features without connecting them to pain.`;
      else if (isTouchpoint)
        guidance += ` AE on a touchpoint: grade on confirming deal status, surfacing new stakeholders or blockers, and owning a specific forward action. Penalize re-demoing unprompted.`;
      else
        guidance += ` Grade the full sales cycle with balanced weight across all applicable dimensions.`;
    }

    return guidance;
  }

  // Returns per-stage max points for each dimension.
  // Reduced dimensions get half their normal max so the schema and the
  // prose instruction agree — the LLM cannot score above what max allows.
  // ── Dimension key: d=Discovery, vf=Value Framing, dd=Demo Delivery,
  //                   ep=Executive Presence, t=Tactical Empathy,
  //                   q=Qualification, c=Call Control
  // Base maxes (AE): d=20, vf=15, dd=10, ep=0, t=25, q=15, c=15  →  total 100
  // Manager maxes:   d=12, vf=15, dd=0,  ep=10, t=25, q=8,  c=10  →  total 80 (normalized)

  // Stage ceilings — what's appropriate for this meeting type.
  // ep is always 10 at the stage level; role ceilings gate it to 0 for non-managers.
  function stageDimCeilings() {
    const stage = (selectedStage || '').toLowerCase();
    // Full weight defaults
    let d = 20, vf = 15, dd = 10, ep = 10, t = 25, q = 15, c = 15;
    if (stage.includes('cold')) {
      vf = 10; dd = 0; q = 7;    // brief value hook only; no demo; light qualification
    } else if (stage.includes('discovery')) {
      vf = 15; dd = 0;            // value framing at full weight; no demo expected
    } else if (stage.includes('demo') || stage.includes('solution')) {
      // all at full weight — demo is the primary purpose
    } else if (stage.includes('proposal') || stage.includes('close')) {
      d = 10; dd = 5;             // discovery reduced; demo reduced (recap only if needed)
    } else if (stage.includes('touchpoint')) {
      vf = 10; dd = 0; q = 7;    // light value reinforcement; no demo; no re-qualifying
    }
    return { d, vf, dd, ep, t, q, c };
  }

  // Role ceilings — what's appropriate for this rep's function
  function roleDimCeilings(rep) {
    if (!rep) return { d: 20, vf: 15, dd: 0, ep: 0, t: 25, q: 15, c: 15 };
    const role = (rep.role || '').toLowerCase();
    const isSDR     = role.includes('sdr') || role.includes('bdr') || role.includes('development');
    const isSE      = role.includes('engineer') || role.includes(' se') || role === 'se' || role.includes('presales') || role.includes('pre-sales') || role.includes('architect') || role.includes('solutions consultant') || role.includes('technical advisor');
    const isAM      = role === 'am' || role.includes('account manager') || role.includes('csm') || role.includes('customer success') || role.includes('renewal');
    const isManager = (role.includes('manager') && !role.includes('account manager')) || role.includes('director') || role.includes('vp') || role.includes('chief') || role.includes('leader') || role.includes('executive') || role.includes('president') || role.includes('cro') || role.includes('cso');

    if (isSDR) {
      // Pipeline focus: can frame value briefly, never expected to demo, lighter on qualification
      return { d: 20, vf: 10, dd: 0, ep: 0, t: 25, q: 7, c: 15 };
    }
    if (isSE) {
      // Technical delivery focus: primary demo owner; lighter on commercial discovery, qual, close
      return { d: 12, vf: 10, dd: 10, ep: 0, t: 25, q: 7, c: 10 };
    }
    if (isAM) {
      // Expansion/retention focus: can frame value; rarely demos; lighter on new-logo qualification
      return { d: 20, vf: 12, dd: 0, ep: 0, t: 25, q: 10, c: 15 };
    }
    if (isManager) {
      // Executive/strategic force multiplier: never demos; graded on exec presence instead
      return { d: 12, vf: 15, dd: 0, ep: 10, t: 25, q: 8, c: 10 };
    }
    // AE or unrecognized — AE orchestrates demo but does not deliver it; SE owns demo delivery
    return { d: 20, vf: 15, dd: 0, ep: 0, t: 25, q: 15, c: 15 };
  }

  // Combined maxes: most restrictive of stage ceiling and role ceiling
  function combinedDimMaxes(repObj) {
    const s = stageDimCeilings();
    const r = roleDimCeilings(repObj);
    return {
      d:  Math.min(s.d,  r.d),
      vf: Math.min(s.vf, r.vf),
      dd: Math.min(s.dd, r.dd),
      ep: Math.min(s.ep, r.ep),
      t:  Math.min(s.t,  r.t),
      q:  Math.min(s.q,  r.q),
      c:  Math.min(s.c,  r.c),
    };
  }

  // Alias for total-ceiling injection — overall call uses stage-only ceilings
  function stageDimMaxes() { return stageDimCeilings(); }

  // Lookup a team member's combined ceiling by name (for per-rep normalization)
  function repDimMaxesByName(name) {
    const team = loadTeam();
    const member = team.find(m => m.name && m.name.toLowerCase() === (name || '').toLowerCase());
    return member ? combinedDimMaxes(member) : combinedDimMaxes(null);
  }

  function buildStageDimensions(repObj, feedbackHints) {
    const m = repObj === '__stage_only__' ? stageDimCeilings() : combinedDimMaxes(repObj);
    const fh = feedbackHints || {};
    const epNa   = m.ep === 0;
    const ddNa   = m.dd === 0;
    return [
      `{ "name": "Discovery & needs confirmation",        "max": ${m.d},  "score": 0, "feedback": "${fh.d  || '2-3 sentences of specific actionable coaching tied to what happened in this call'}" }`,
      `{ "name": "Value framing",                        "max": ${m.vf}, "score": 0, "feedback": "${fh.vf || '2-3 sentences — how clearly did the rep connect your company\'s value to the prospect\'s stated pain?'}" }`,
      `{ "name": "Demo delivery",                        "max": ${m.dd}, "score": 0, "feedback": "${fh.dd || (ddNa ? 'No demo expected for this meeting type or role — award 0 and note N/A' : '2-3 sentences — was the demo anchored to stated pain, technically accurate, and free of generic feature touring?')}" }`,
      `{ "name": "Executive presence & strategic positioning", "max": ${m.ep}, "score": 0, "feedback": "${fh.ep || (epNa ? 'Not applicable for this rep role — award 0 and note N/A' : '2-3 sentences — did they build peer-level credibility, stay at strategic altitude, and handle escalated concerns with authority without over-committing?')}" }`,
      `{ "name": "Tactical empathy & objection handling", "max": ${m.t},  "score": 0, "feedback": "${fh.t  || '2-3 sentences — call out specific techniques used or missed'}" }`,
      `{ "name": "Qualification & deal mechanics",        "max": ${m.q},  "score": 0, "feedback": "${fh.q  || '2-3 sentences covering budget, authority, timeline, competitive landscape, winnability'}" }`,
      `{ "name": "Call control & next steps",             "max": ${m.c},  "score": 0, "feedback": "${fh.c  || '2-3 sentences'}" }`
    ].join(',\n    ');
  }

  function buildStageWeighting() {
    const stage = (selectedStage || '').toLowerCase();

    if (stage.includes('cold')) return `Dimension weighting for Cold Outreach:
- Discovery & needs confirmation (20 pts): Full weight. Surface initial pain or curiosity; one sharp question beats five generic ones.
- Value framing (15 pts → 10 pts): REDUCED. Brief value hook only — one sentence on what your company solves. Do not penalize for lack of depth.
- Demo delivery (10 pts → 0 pts): NOT APPLICABLE. No demo expected on a cold call. Award 0 and mark N/A in feedback.
- Tactical empathy & objection handling (25 pts): Full weight. Handling "not interested" gracefully is the core skill tested here.
- Qualification & deal mechanics (15 pts → 7 pts): REDUCED. Light confirmation of fit only — full BANT is not appropriate.
- Call control & next steps (15 pts): Full weight. Must end with a specific booked meeting — date, time, named attendees.`;

    if (stage.includes('discovery')) return `Dimension weighting for Discovery:
- Discovery & needs confirmation (20 pts): Full weight, primary focus. Rep must go deep — current environment, specific pain, impact, what they have tried. Pitching instead of listening is penalized.
- Value framing (15 pts): Full weight. Connecting pain to your company's capability is expected — but pitching the full product is penalized. Framing and pitching are different.
- Demo delivery (10 pts → 0 pts): NOT APPLICABLE. No demo expected unless explicitly pre-agreed. Award 0 and mark N/A in feedback.
- Tactical empathy & objection handling (25 pts): Full weight. Early resistance must be handled with labeling and calibrated questions.
- Qualification & deal mechanics (15 pts): Full weight. Budget, authority, timeline, and competitive context should all be touched.
- Call control & next steps (15 pts): Full weight. Must close with a defined next step — demo date confirmed, attendees named.`;

    if (stage.includes('demo') || stage.includes('solution')) return `Dimension weighting for Demo / Solution Presentation:
- Discovery & needs confirmation (20 pts): Full weight. Rep must re-confirm pain at the start before showing anything. Skipping this is a grading penalty regardless of demo quality.
- Value framing (15 pts): Full weight. Every capability shown must be explicitly connected to a stated prospect problem with a clear "this solves X because Y" statement.
- Demo delivery (10 pts): SE only — full weight. AE demo delivery max is 0; award 0 for AEs regardless of what occurred. Penalize generic feature touring by the SE. If no SE is present, note that the AE-only demo is a delivery gap.
- Executive presence & strategic positioning (10 pts): Manager/Executive roles only. Award 0 for AE, SE, SDR, and AM/CSM.
- Tactical empathy & objection handling (25 pts): Full weight. Technical objections and pricing probes require labeling and calibrated responses.
- Qualification & deal mechanics (15 pts): Full weight. Budget and authority must be confirmed. Any discovery gaps should be closed here.
- Call control & next steps (15 pts): Full weight. Must end with a proposal date or trial scope — not "let us know what you think."`;

    if (stage.includes('proposal') || stage.includes('close')) return `Dimension weighting for Proposal / Close:
- Discovery & needs confirmation (20 pts → 10 pts): REDUCED. Pain is already established. Grade only on whether the rep re-anchors the proposal to stated pain when presenting pricing.
- Value framing (15 pts): Full weight. Framing here is ROI, risk of inaction, and why your company over the alternative. Rep must justify the investment — not just restate it.
- Demo delivery (10 pts → 5 pts): REDUCED. A brief solution recap is acceptable if the prospect requests it. A full re-demo is a red flag. Grade only on any light technical reinforcement present.
- Tactical empathy & objection handling (25 pts): Full weight, highest scrutiny. Caving on price without extracting a concession is a hard grading failure.
- Qualification & deal mechanics (15 pts): Full weight. Contract terms, procurement process, and signatories must be confirmed — not left open.
- Call control & next steps (15 pts): Full weight. Ends with a signed agreement or a signature date with a named decision-maker.`;

    if (stage.includes('touchpoint')) return `Dimension weighting for Touchpoint:
- Discovery & needs confirmation (20 pts): Full weight, shifted goal — confirm pain still holds and surface new developments such as stakeholder changes or budget shifts.
- Value framing (15 pts → 10 pts): REDUCED. Light reinforcement of value is acceptable. Re-pitching unprompted is a red flag.
- Demo delivery (10 pts → 0 pts): NOT APPLICABLE. Re-demoing unprompted is a grading failure. Award 0 and mark N/A in feedback.
- Tactical empathy & objection handling (25 pts): Full weight. Silence or vague answers must be labeled and probed.
- Qualification & deal mechanics (15 pts → 7 pts): REDUCED. Re-qualifying is noise. Grade only if new information surfaces that changes deal mechanics.
- Call control & next steps (15 pts): Full weight. Every touchpoint must end with a specific forward action.`;

    return `Grade all 7 dimensions: Discovery & needs confirmation (20 pts), Value framing (15 pts), Demo delivery (10 pts — SE only, award 0 for AE/SDR/AM/Manager), Executive presence & strategic positioning (10 pts — Manager/Executive only, award 0 for all others), Tactical empathy & objection handling (25 pts), Qualification & deal mechanics (15 pts), Call control & next steps (15 pts). AE ceiling: 90 pts. SE ceiling: 74 pts. Manager ceiling: 80 pts. All normalized to 0–100.`;
  }

  function buildDemoEdgeCaseGuidance() {
    return `
DEMO DELIVERY EDGE CASES — apply these rules before scoring Demo Delivery:

1. UNSCHEDULED DEMO (demo performed during a non-demo call stage):
   If the transcript shows a product demo was actually conducted despite the meeting type being Discovery, Cold Outreach, Touchpoint, or similar — override the stage ceiling for Demo Delivery only. Set max to 10 and grade it at full weight. Note clearly in the Demo Delivery feedback that an unscheduled demo was conducted and that grading reflects actual call content.

2. SCHEDULED DEMO NOT DELIVERED (demo/solution stage but no demo occurred):
   Determine WHY the demo did not happen using all available transcript context, then apply the appropriate rule:

   a. EXTERNAL CIRCUMSTANCE — not the rep's fault (examples: prospect's technical resource or required attendee failed to show up, prospect did not brief the right stakeholders, connectivity/technical failure outside rep control, prospect ran out of time due to their own agenda):
      → Set Demo Delivery max to 0. Write feedback explaining the specific external circumstance that prevented the demo. Do NOT penalize the rep's score for factors outside their control.

   b. REP FAILURE — rep is responsible (examples: rep failed to confirm attendees before the call, lost the prospect's interest through poor discovery or objection handling before demo, was unprepared to present, or prospect explicitly declined due to rep's failure to establish need):
      → Keep Demo Delivery at its normal max. Score 0 and write specific feedback identifying exactly how the rep's actions or inactions caused the demo not to occur. Treat this as a significant coaching opportunity.

   If the transcript is ambiguous and fault cannot be clearly attributed, default to external circumstance (set max to 0 with a note that context was unclear).`;
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
      return `Previous call (${label}): Grade ${h.letter_grade} ${h.normalized_score ?? h.total}/100. ${h.grade_label ? '"' + h.grade_label + '". ' : ''}Strength: ${h.top_strength || 'n/a'}. Priority: ${h.top_priority || 'n/a'}.`;
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
      const knownContacts = (typeof window.getAccountProfileContacts === 'function' && prospect)
        ? window.getAccountProfileContacts(prospect)
        : [];
      const knownCustomerContacts = knownContacts.length
        ? `Known customer contacts for ${prospect}: ` + knownContacts.map(c => c.name + (c.title ? ` (${c.title})` : '')).join(', ')
        : '';

      // Only the head of the transcript is sent to the scan (cost control).
      // Sweep the remainder for speaker labels so participants who first
      // speak late in the call still get classified.
      const PRESCAN_CHAR_LIMIT = 5000;
      const head = notes.slice(0, PRESCAN_CHAR_LIMIT);
      const lateSpeakers = [...new Set(
        [...notes.slice(PRESCAN_CHAR_LIMIT).matchAll(/^\*{0,2}([A-Z][A-Za-z .'-]{1,40}?)\*{0,2}\s*\(\d+:\d+\)/gm)]
          .map(m => m[1].trim())
      )].filter(n => !head.includes(n));
      const lateCtx = lateSpeakers.length
        ? `\n\nAdditional speakers whose labels appear later in the transcript (classify these too): ${lateSpeakers.join(', ')}`
        : '';
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'ENGAGE',
            model: getDevModel('engage_grade', 'claude-haiku-4-5-20251001'),
          max_tokens: 500,
          stream: false,
          system: 'You identify call participants. Return ONLY valid JSON, no markdown.',
          messages: [{ role: 'user', content:
            `${knownSales}\n${knownThirdParties ? knownThirdParties + '\n' : ''}${knownCustomerContacts ? knownCustomerContacts + '\n' : ''}Customer company: ${prospect || 'unknown'}\nCustomer contact title: ${contactTitle || 'unknown'}\n\nReview this transcript and identify every distinct speaker. Return:\n{"participants":[{"name":"string","type":"sales_team"|"customer"|"unknown","clue":"brief reason"}]}\n\nRules:\n- CRITICAL: Only include people who have actual spoken lines in the transcript (e.g. "Name (timestamp): ..."). Do NOT include anyone who is merely mentioned, referenced, or named by another speaker without speaking themselves.\n- "sales_team": name matches a known team member\n- "customer": name matches a known customer contact for this company, or clearly represents the prospect company\n- "unknown": neither — could be a partner, SE, vendor rep, consultant, etc. Known third-party participants above must always be classified as "unknown".\nOnly flag "unknown" if confident they are a real speaker who is not sales team or customer.\n\nTranscript (excerpt):\n${head}${lateCtx}`
          }]
        })
      });
      if (!resp.ok) return { newUnknowns: [], known: [] };
      const data = await resp.json();
      const text = (data.content?.[0]?.text || '').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      const parsed = JSON.parse(text);
      // Drop any "unknown" whose first name is within 2 edits of a known rep's first name.
      // Guards: names must be within 2 chars of each other in length to avoid false positives.
      // This catches transcription mishearings like "Brian" → "Ryan".
      const _lev = (a, b) => {
        const dp = Array.from({length: a.length + 1}, (_, i) =>
          Array.from({length: b.length + 1}, (_, j) => j ? j : i));
        for (let i = 1; i <= a.length; i++)
          for (let j = 1; j <= b.length; j++)
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
              : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        return dp[a.length][b.length];
      };
      const teamFirstNames = teamNames.map(n => n.toLowerCase().split(/\s+/)[0]);
      const unknowns = (parsed.participants || []).filter(p => {
        if (p.type !== 'unknown') return false;
        const uFirst = p.name.toLowerCase().trim().split(/\s+/)[0];
        return !teamFirstNames.some(tf =>
          Math.abs(uFirst.length - tf.length) <= 2 && _lev(uFirst, tf) <= 2
        );
      });

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

    // Warn before replacing an existing report
    if (_loadedTranscriptId) {
      const existing = loadHistory().find(h => String(h.id) === _loadedTranscriptId);
      if (existing) {
        const label = [existing.prospect, existing.stage, existing.callDate || existing.ts.slice(0,10)].filter(Boolean).join(' — ');
        if (!confirm(`Re-grading this transcript will permanently delete the existing report:\n\n"${label}"\n\nA new report will be generated in its place. Continue?`)) return;
      }
    }

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

    const thirdPartyContext = _buildThirdPartyContext(allThirdParties);

    setLoading(true, prospect, selectedStage);

    const systemPrompt = `You are an expert sales coach specializing in MSSP and B2B security sales.

${buildLibraryPrompt()}${buildDocsPrompt()}${buildHistoryContext(prospect, rep)}

You are grading a ${selectedStage} call for your company (an MSSP). Key differentiator: bundling 24x7 SOC + EDR (CrowdStrike/SentinelOne) + vuln scanning (SecPod Saner CVEM) + KnowBe4 security awareness training, replacing 2-3 vendors. CMMC positioning is only relevant if the transcript explicitly mentions DoD contracts, CMMC, or CUI — do NOT grade on CMMC for general prospects.${buildRoleGuidance(rep)}

${buildStageWeighting()}
${buildDemoEdgeCaseGuidance()}

Use this grading scale when assigning letter_grade. Grades are based on percentage of the applicable maximum (stage max for overall call; role+stage max for each rep). Do not use raw score against a 100-point scale — normalize first:
A+: 97–100% | A: 93–96% | A-: 90–92% | B+: 87–89% | B: 83–86% | B-: 80–82% | C+: 77–79% | C: 73–76% | C-: 70–72% | D+: 67–69% | D: 63–66% | D-: 60–62% | F: below 60%
Overall call max (stage ceiling, 7 dimensions): ${Object.values(stageDimCeilings()).reduce((a,b)=>a+b,0)} pts. Primary rep ceiling (role+stage): ${Object.values(combinedDimMaxes(rep)).reduce((a,b)=>a+b,0)} pts.

Speaker resolution: Some transcripts label speakers generically ("Speaker 1", "Speaker 2", etc.) instead of by name. Before grading, resolve each generic label to a real person using all available context — the Participants section at the top of the transcript, self-introductions in the conversation (e.g. "This is Ryan with..."), names used when addressing someone directly, role-specific language, and the known team and contact information provided below. Apply the resolved names consistently throughout your entire analysis, including rep_scores.

Transcription errors — name mismatches: AI transcription software frequently mishears or misrecords spoken names. If the transcript shows a rep introducing themselves with a name that does not match any known team member, assume it is a transcription error — do NOT flag it as a missed opportunity, professionalism issue, or coaching point. Cross-reference the known sales team roster provided. If the spoken name is phonetically similar to a known team member's name, or if context otherwise identifies the speaker as a known rep, treat the introduction as correct and move on. Never penalize a rep for a name the transcript recorded incorrectly.

Grade across these 7 dimensions and return ONLY valid JSON, no markdown, no backticks, no preamble.

IMPORTANT — two separate scoring contexts apply:
1. The top-level "dimensions" and "total" represent the overall call effectiveness scored against STAGE-ONLY ceilings (meeting type context only, no role adjustment). Max values shown reflect the stage ceiling.
2. Each entry in "rep_scores" is scored against that individual rep's role ceiling compounded with the stage ceiling. The "role_max" field in each rep entry tells you the adjusted maximum for that rep — do not exceed it.

{
  "dimensions": [
    ${buildStageDimensions('__stage_only__')}
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
      "role_max": ${Object.values(combinedDimMaxes(rep)).reduce((a,b)=>a+b,0)},
      "dimensions": [
        ${buildStageDimensions(rep, { d: '2-3 sentences specific to this rep\'s contributions only', v: '2-3 sentences', t: '2-3 sentences', q: '2-3 sentences', c: '2-3 sentences' })}
      ],
      "total": 0,
      "letter_grade": "B",
      "grade_label": "short evocative phrase",
      "top_strength": "one specific sentence about this rep",
      "top_priority": "single most important fix for this rep",
      "call_summary": {
        "positives": ["specific thing this rep personally did well"],
        "missed": ["opportunity or technique this rep specifically missed"],
        "improvements": ["concrete thing this rep should do differently next call"]
      }
    }
  ],
  "spiced": {
    "situation":      { "touched": true,  "summary": "1-2 sentences on what situation context was established or what was missing" },
    "pain":           { "touched": true,  "summary": "1-2 sentences on pain points surfaced or what was left unexplored" },
    "impact":         { "touched": false, "summary": "1-2 sentences on business/financial impact discussed or what was not quantified" },
    "critical_event": { "touched": false, "summary": "1-2 sentences on urgency or deadline drivers raised or absent" },
    "evolution":      { "touched": false, "summary": "1-2 sentences on decision process, stakeholders, or how the deal progresses" },
    "decision":       { "touched": true,  "summary": "1-2 sentences on decision criteria, timeline, or authority discussed" }
  },
  "atlas_data": {
    "contacts":     [{ "name": "Prospect name as spoken", "title": "Their title or role" }],
    "champion":     { "name": "", "title": "" },
    "stakeholders": [{ "name": "Name of person mentioned but not on call", "title": "Their role" }],
    "competitors":  ["Vendor or solution name mentioned as competition"],
    "tech_stack":   ["Existing tool or platform the prospect currently uses"],
    "opportunity_summary": "1-2 sentence summary of the deal opportunity and current stage"
  }
}

atlas_data instructions — extract from the transcript:
- contacts: every named prospect-side participant actually on this call, with their title. Exclude your company's reps and third-party partners already captured elsewhere.
- champion: the single prospect-side person who showed the most enthusiasm, advocacy, or internal influence toward your company. Null object if no clear champion is identifiable ({\"name\":\"\",\"title\":\"\"}).
- stakeholders: prospect-side people mentioned in the conversation but NOT on the call (e.g., "I need to loop in our CFO", "our IT director said"). Include name if given, or role if only role was mentioned.
- competitors: any competing vendor, product, or solution mentioned (e.g., existing tools being evaluated against your company, other MSSPs, or incumbent solutions).
- tech_stack: any existing security tools, platforms, or vendors the prospect currently has deployed (not competitors — tools they own today).
- opportunity_summary: a concise 1-2 sentence summary of what this deal is about and where it stands.
If a field has nothing to report, return an empty array [] or empty object as appropriate.

total (overall call): sum of all 7 dimension scores. Max is ${Object.values(stageDimCeilings()).reduce((a,b)=>a+b,0)} for this meeting type. Assign letter_grade based on percentage of this max.
rep_scores[].total: sum of that rep's 7 dimension scores. Do not exceed the role_max shown in each rep entry. Assign that rep's letter_grade based on percentage of their role_max.
IMPORTANT — Demo delivery: if max is 0 for this context, the score MUST be 0. Write "N/A — demo not expected for this meeting type or role" in the feedback field.
IMPORTANT — Executive presence & strategic positioning: if max is 0 for a rep, the score MUST be 0. Write "N/A — executive presence dimension applies to Manager/Executive roles only" in the feedback field. For Managers this dimension replaces demo delivery as their primary differentiating evaluation.
call_summary.positives: 2-4 specific strengths observed in this call.
call_summary.missed: 2-4 specific opportunities, techniques, or questions that were not attempted but should have been.
call_summary.improvements: 2-4 concrete, actionable things to do differently on the next call.
recommended_books: only recommend resources from the approved list above. If no list is configured or no gaps exist, return an empty array.
rep_scores: identify every sales rep who ACTUALLY SPEAKS in the transcript. Do NOT include a rep who is only mentioned by name, listed in a Participants header, or referenced by others but has no spoken lines of their own — they were not on the call in an active capacity and cannot be graded. Resolve generic speaker labels (Speaker 1, etc.) to real names using the Participants section and context clues as instructed above. For each rep who speaks, score them individually across the same 5 dimensions based only on their own contributions — what they said, asked, or did. If only one rep speaks, still populate rep_scores with that one entry. If no reps can be identified even after resolution, return an empty array.
rep_scores[].call_summary: per-rep summary based solely on that rep's individual contributions. positives = specific things this rep personally did well. missed = opportunities or techniques this specific rep failed to attempt. improvements = concrete actions this rep should take differently next call. Do not repeat overall call observations — focus only on this rep's behavior.
spiced: evaluate each of the 6 SPICED components using the SPICED framework (Winning by Design). SPICED is built across the full deal lifecycle — not completed in a single call. Grade each component against what is expected at this stage:
- Situation: expected in full on Meeting 1 / Cold Outreach. A gap here on any later-stage call is a red flag — penalize if still unknown by Demo.
- Pain: expected on Discovery. Must be in the prospect's own words, not assumed. Re-confirmed on every subsequent call. Penalize if still superficial by Demo stage.
- Impact: expected by mid-deal (Demo stage). Quantified business/financial consequence of the pain. Penalize if never quantified by Proposal.
- Critical Event: must be identified by Demo stage. A deal with no Critical Event has no close date — penalize accordingly.
- Evolution: tracked across every call. Grade on whether the rep noticed and responded to changes in the buying committee or process — not just whether they asked once.
- Decision: expected by late-stage (Proposal/Close). Named decision-maker and procurement process must be confirmed before contract. Penalize if unknown at close.
Set touched to true only if the rep meaningfully engaged with that component in this specific transcript, false if absent or superficial. Write a 1-2 sentence summary regardless — if not touched, note what is missing and whether the gap is acceptable at this stage or a grading concern.${thirdPartyContext}`;

    const team = loadTeam();
    const teamContext = team.length
      ? 'Your sales team on this call (include ALL who speak in rep_scores): ' +
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
            source: 'ENGAGE',
            model: getDevModel('engage_grade', 'claude-sonnet-4-6'),
          max_tokens: 8192,
          temperature: 0,
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
      const parsed = JSON.parse(raw);
      normalizeResult(parsed, rep);
      renderResults(parsed, prospect, contactTitle, rep, callDate, notes, allThirdParties);
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

  // Post-processing: compute normalized_score (0–100) for overall call and each rep.
  // Normalized = Math.round(raw_total / applicable_max * 100), clamped to 100.
  // Letter grades are re-derived from normalized score so they are always consistent.
  function scoreToGradePct(pct) {
    const adj = typeof applyGradingOffset === 'function' ? applyGradingOffset(pct, window._sirenCoachGradingLevel) : pct;
    if (adj >= 97) return 'A+';
    if (adj >= 93) return 'A';
    if (adj >= 90) return 'A-';
    if (adj >= 87) return 'B+';
    if (adj >= 83) return 'B';
    if (adj >= 80) return 'B-';
    if (adj >= 77) return 'C+';
    if (adj >= 73) return 'C';
    if (adj >= 70) return 'C-';
    if (adj >= 67) return 'D+';
    if (adj >= 63) return 'D';
    if (adj >= 60) return 'D-';
    return 'F';
  }

  function normalizeResult(r, primaryRep) {
    // Overall call: stage-only ceiling
    const stageMax = Object.values(stageDimCeilings()).reduce((a, b) => a + b, 0);
    const rawTotal = r.total || 0;
    r.normalized_score = Math.min(100, Math.round((rawTotal / stageMax) * 100));
    r.letter_grade = scoreToGradePct(r.normalized_score);

    // Per-rep: role+stage ceiling, resolved from team list by name
    if (Array.isArray(r.rep_scores)) {
      r.rep_scores.forEach(rs => {
        const roleMax = rs.role_max || Object.values(repDimMaxesByName(rs.name)).reduce((a, b) => a + b, 0);
        const repRaw = rs.total || 0;
        rs.normalized_score = Math.min(100, Math.round((repRaw / roleMax) * 100));
        rs.letter_grade = scoreToGradePct(rs.normalized_score);
      });
    }
  }

  function buildDimsHtml(dimensions) {
    return dimensions
      .filter(d => d.max > 0)  // omit N/A dimensions (max=0 means not graded for this role/stage)
      .map(d => {
        const pct = Math.round((d.score / d.max) * 100);
        const col = getBarColor(pct);
        return `<div class="dim-card">
        <div class="dim-head"><span class="dim-name">${escHtml(d.name)}</span><span class="dim-score" style="color:${col}">${d.score}/${d.max}</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${col};"></div></div>
        <div class="dim-feedback">${escHtml(d.feedback)}</div>
      </div>`;
      }).join('');
  }

  function buildSummaryHtml(s, viewId, isActive, sectionLabel) {
    if (!s || (!s.positives?.length && !s.missed?.length && !s.improvements?.length)) return '';
    return `<div class="summary-view${isActive ? ' active' : ''}" id="summary-view-${viewId}">
      <div class="section-head">${escHtml(sectionLabel || 'Call summary')}</div>
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
      </div>
    </div>`;
  }

  function buildScoreView(viewData, metaLine, viewId) {
    const bg = getBannerColor(viewData.letter_grade);
    return `<div class="score-view ${viewId === 'overall' ? 'active' : ''}" id="score-view-${viewId}">
      <div class="banner" style="background:${bg};">
        <div>
          <div class="banner-grade">${escHtml(viewData.letter_grade)} &nbsp; ${viewData.normalized_score ?? viewData.total}</div>
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

  // Builds the results HTML string from a parsed grading result.
  // Pure function — no DOM writes, no history saves. Used by renderResults and regradeFromHistory.
  function buildResultsHtml(r, prospect, contactTitle, rep, callDate, notes, thirdParties, stage) {
    const stageCtx = stage || selectedStage || '';
    const formattedDate = callDate ? new Date(callDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const overallMeta = [rep ? rep.name + (rep.role ? ' · ' + rep.role : '') : '', prospect, contactTitle, stageCtx, formattedDate].filter(Boolean).join(' · ');

    const repScores = (r.rep_scores || []).filter(rs => rs.name && rs.dimensions?.length);
    const _adminView = typeof sirenIsAdmin === 'function' ? sirenIsAdmin() : true;
    const showToggle = _adminView && repScores.length >= 1;
    const overallSummary = buildSummaryHtml(r.call_summary || {}, 'overall', true, 'Call summary');
    const repSummaries = showToggle
      ? repScores.map((rs, i) => buildSummaryHtml(rs.call_summary || {}, `rep-${i}`, false, `${rs.name}'s summary`)).join('')
      : '';
    const summaryHtml = overallSummary + repSummaries;

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

    const toggleHtml = showToggle ? `
      <div class="rep-toggle">
        <button class="rep-toggle-btn active" id="toggle-overall" onclick="switchScoreView('overall',event)">Overall Call</button>
        ${repScores.map((rs, i) => `<button class="rep-toggle-btn" id="toggle-rep-${i}" onclick="switchScoreView('rep-${i}',event)">${escHtml(rs.name)}</button>`).join('')}
      </div>` : '';

    const overallView = buildScoreView(r, overallMeta, 'overall');
    const repViews = showToggle ? repScores.map((rs, i) => buildScoreView(rs, escHtml(rs.name) + (stageCtx ? ' · ' + stageCtx : ''), `rep-${i}`)).join('') : '';

    const isColdCall = stageCtx.toLowerCase().includes('cold');
    const priorCalls = prospect
      ? loadHistory().filter(h => (h.prospect || '').toLowerCase().trim() === prospect.toLowerCase().trim())
      : [];
    const noContextBanner = (!isColdCall && priorCalls.length === 0) ? `
      <div class="no-context-banner">
        <span class="no-context-icon">&#9432;</span>
        <span>No prior call history found for <strong>${escHtml(prospect || 'this prospect')}</strong>. This report was graded without account context — missed questions or gaps may reflect unknown prior discovery rather than rep performance.</span>
      </div>` : '';

    const missingRecWarnings = detectMissingRecordings(priorCalls, callDate, notes || '');
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

    const pdfTitle = [prospect, stageCtx, callDate].filter(Boolean).join(' — ');
    return {
      html: `
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
          <button class="pdf-btn" onclick="exportReportPDF(${escHtml(JSON.stringify(pdfTitle))})">&#8595; Export PDF</button>
        </div>`,
      pdfTitle,
    };
  }

  function renderResults(r, prospect, contactTitle, rep, callDate, notes, thirdParties) {
    if (r.recommended_books?.length) autoSaveRecommendations(r.recommended_books);
    if (r.atlas_data && prospect && typeof atlasAutoPopulate === 'function') {
      atlasAutoPopulate(prospect, r.atlas_data);
    }

    const { html: resultsHtml, pdfTitle } = buildResultsHtml(r, prospect, contactTitle, rep, callDate, notes, thirdParties);

    document.getElementById('results').innerHTML = resultsHtml;
    document.getElementById('results').style.display = 'block';
    document.getElementById('inputCard').style.display = 'none';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Auto-detect rep from transcript if not manually set
    const detectedRep = rep || autoDetectRep(r.rep_scores || []);
    const savedRecord = saveToHistory(r, prospect, contactTitle, detectedRep, callDate, resultsHtml);
    autoGenerateNextSteps(notes, prospect, callDate, savedRecord.id);

    // If re-grading, remove the old record now that the new one is saved
    if (_loadedTranscriptId && _loadedTranscriptId !== String(savedRecord.id)) {
      const oldId = _loadedTranscriptId;
      _loadedTranscriptId = null;
      _histCache = _histCache.filter(h => String(h.id) !== oldId);
      _dbDeleteRecord(oldId);
      fetch('/api/transcripts/' + encodeURIComponent(oldId), { method: 'DELETE' }).catch(() => {});
    } else {
      _loadedTranscriptId = null;
    }

    // Save transcript independently (survives history deletion)
    const tLabel = [prospect, selectedStage, callDate].filter(Boolean).join(' — ') || 'Untitled';
    fetch('/api/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: savedRecord.id,
        label: tLabel,
        prospect: prospect || null,
        stage: selectedStage || null,
        rep: detectedRep ? detectedRep.name : null,
        call_date: callDate || null,
        transcript: notes,
      }),
    }).catch(() => {});

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
    root.querySelectorAll('.summary-view').forEach(el => el.classList.remove('active'));
    root.querySelectorAll('.rep-toggle-btn').forEach(el => el.classList.remove('active'));
    const scoreView   = root.querySelector('#score-view-' + viewId);
    const summaryView = root.querySelector('#summary-view-' + viewId);
    const btn         = root.querySelector('#toggle-' + viewId);
    if (scoreView)   scoreView.classList.add('active');
    if (summaryView) summaryView.classList.add('active');
    if (btn)         btn.classList.add('active');
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
    _loadedTranscriptId = null;
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
    if (!body) return;
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    if (chevron) chevron.classList.toggle('open', open);
    try { localStorage.setItem('oa_usage_open', open); } catch {}
  }

  const _setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  function updateUsageUI(inputTokens, outputTokens) {
    // Per-call and session figures are estimated locally for instant display.
    // All-time / monthly totals are metered server-side on every proxied call.
    const callCost = inputTokens * PRICE_IN + outputTokens * PRICE_OUT;
    sessionCost += callCost;

    _setEl('val-tokens', (inputTokens + outputTokens).toLocaleString());
    _setEl('val-cost-call', '$' + callCost.toFixed(4));
    _setEl('val-cost-session', '$' + sessionCost.toFixed(4));
    _setEl('lastCallLabel', 'Last call: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const usageDotEl = document.getElementById('usageDot');
    if (usageDotEl) usageDotEl.style.background = '#00c8ff';

    // Server metering completes just after the stream ends — refresh shortly after
    setTimeout(_refreshUsageDisplay, 800);

    const body2 = document.getElementById('usageBody');
    if (body2 && body2.style.display === 'none') {
      body2.style.display = 'block';
      const chev2 = document.getElementById('usageChevron');
      if (chev2) chev2.classList.add('open');
    }
  }

  async function _refreshUsageDisplay() {
    await _loadUsageFromDB();
    const u = loadAllTime();
    const allEl = document.getElementById('val-cost-alltime');
    const subEl = document.getElementById('sub-alltime');
    if (allEl) allEl.textContent = '$' + u.cost.toFixed(2);
    if (subEl) subEl.textContent = u.calls + ' API call' + (u.calls !== 1 ? 's' : '');
  }

  function resetAllTime() {
    if (!confirm('Reset all-time totals? This clears the server-side meter and cannot be undone.')) return;
    fetch('/api/usage/reset', { method: 'POST' }).catch(() => {});
    _usageCache = { cost: 0, calls: 0, month: { cost: 0, calls: 0 } };
    try { localStorage.setItem('oa_usage', JSON.stringify(_usageCache)); } catch {}
    _setEl('val-cost-alltime', '$0.00');
    _setEl('sub-alltime', '0 API calls');
  }

  function initUsageBar() {
    const allTime = loadAllTime();
    _setEl('val-cost-alltime', '$' + allTime.cost.toFixed(2));
    _setEl('sub-alltime', allTime.calls + ' API call' + (allTime.calls !== 1 ? 's' : ''));
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
      const data = _histCache.map(h => ({ ...h }));
      data.forEach(h => { if (typeof h.total === 'number' && h.total > 0) h.letter_grade = scoreToGrade(h.total); });
      return data;
    } catch { return []; }
  }

  function saveHistoryData(records) {
    _histCache = [...records];
    _dbBulkSave(records);
  }

  // ── Audit log helper ──────────────────────────────────────
  function logAudit(action, fields = {}) {
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...fields }),
    }).catch(() => {}); // fire-and-forget
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
      normalized_score: r.normalized_score ?? r.total,
      letter_grade: r.letter_grade,
      grade_label: r.grade_label || '',
      top_strength: r.top_strength || '',
      top_priority: r.top_priority || '',
      resultsHtml,
      partner_scores: (r.partner_scores && r.partner_scores.length) ? r.partner_scores : undefined,
      rep_scores: (r.rep_scores && r.rep_scores.length) ? r.rep_scores : undefined,
      spiced: r.spiced || undefined,
      is_demo: false,
    };
    _histCache.unshift(record);
    if (_histCache.length > 200) _histCache.splice(200);
    _dbSaveRecord(record);
    logAudit('grade', {
      entity_id:    record.id,
      entity_label: prospect || '',
      rep:          rep ? rep.name : '',
      stage:        selectedStage,
      score:        String(record.normalized_score),
      letter_grade: record.letter_grade,
      details:      { grade_label: record.grade_label, top_priority: record.top_priority },
    });
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
    clone.querySelectorAll('.summary-view').forEach(el => { el.style.display = 'block'; });

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
        .summary-view { display:block !important; }
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

  // ── Saved Transcripts panel ────────────────────────────────

  let _loadedTranscriptId = null;

  async function _loadTranscriptIntoGrader(t) {
    _loadedTranscriptId = t.id ? String(t.id) : null;
    navTo('grader');
    document.getElementById('callNotes').value = t.transcript || '';
    document.getElementById('prospect').value = t.prospect || '';
    document.getElementById('contactTitle').value = '';
    if (t.call_date) document.getElementById('callDate').value = t.call_date;
    if (t.stage) {
      document.querySelectorAll('.stage-btn').forEach(b => {
        if (b.textContent.trim() === t.stage) b.click();
      });
    }
    if (t.rep) {
      const repSel = document.getElementById('repSelect');
      if (repSel) repSel.value = t.rep;
    }
    document.getElementById('callNotes').focus();
  }

  async function resubmitTranscript(id, e) {
    e && e.stopPropagation();
    const btn = e && e.target.closest('button');
    const origText = btn ? btn.textContent : '';
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
      const res = await fetch('/api/transcripts/' + encodeURIComponent(String(id)));
      if (!res.ok) { alert('No saved transcript found for this entry.'); return; }
      await _loadTranscriptIntoGrader(await res.json());
    } catch (err) {
      alert('Could not load transcript: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
  }

  async function regradeFromHistory(id, e) {
    e && e.stopPropagation();
    const btn = document.getElementById('hist-regrade-' + id);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Grading…'; btn.classList.add('hist-regrade-btn-active'); }

    try {
      // 1. Load transcript
      const tRes = await fetch('/api/transcripts/' + encodeURIComponent(String(id)));
      if (!tRes.ok) throw new Error('No saved transcript for this entry — use Resubmit to re-grade manually.');
      const tData = await tRes.json();

      const tProspect = tData.prospect || '';
      const tStage    = tData.stage    || '';
      const tCallDate = tData.call_date || '';
      const tRepName  = tData.rep      || '';
      const team      = loadTeam();
      const tRepObj   = team.find(m => m.name && m.name.toLowerCase() === tRepName.toLowerCase()) || null;

      // 2. Build prompt under the transcript's stage (detect third parties first)
      const tpContext    = await _detectThirdPartyContext(tData.transcript, tProspect);
      const prevStage = selectedStage;
      selectedStage   = tStage;
      const systemPrompt = buildBulkGradePrompt(tProspect, tRepObj, tCallDate, tStage, tpContext);
      const context = [
        tRepObj  ? 'Primary rep: ' + tRepObj.name + ' (' + tRepObj.role + ')' : (tRepName ? 'Primary rep: ' + tRepName : ''),
        team.length ? 'Your sales team on this call (include ALL who speak in rep_scores): ' + team.map(m => m.name + ' (' + m.role + ')').join(', ') : '',
        tProspect ? 'Prospect: ' + tProspect   : '',
        tCallDate ? 'Call date: ' + tCallDate   : '',
        tStage    ? 'Call stage: ' + tStage     : '',
      ].filter(Boolean).join(' | ');

      if (btn) btn.textContent = '⏳ Calling Claude…';

      // 3. Stream grading
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'ENGAGE',
            model: getDevModel('engage_grade', 'claude-sonnet-4-6'),
          max_tokens: 8192,
          temperature: 0,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: context + '\n\n' + tData.transcript }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API error ' + resp.status);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '', accumulated = '';
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
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') accumulated += ev.delta.text;
          } catch {}
        }
      }

      selectedStage = prevStage;

      // 4. Parse and normalize
      let raw = accumulated.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(raw);
      normalizeResult(parsed, tRepObj);

      // 5. Build results HTML without touching DOM or creating new history records
      const rep = tRepObj || (tRepName ? { name: tRepName, role: '' } : null);
      const { html: newHtml } = buildResultsHtml(parsed, tProspect, '', rep, tCallDate, tData.transcript, [], tStage);

      // 6. Update the history record in-place (same ID — no duplicate created)
      const updatedRecord = {
        id: String(id),
        ts: new Date().toISOString(),
        callDate: tCallDate,
        rep: tRepObj ? tRepObj.name : tRepName,
        repRole: tRepObj ? tRepObj.role : '',
        prospect: tProspect,
        stage: tStage,
        total: parsed.total,
        normalized_score: parsed.normalized_score ?? parsed.total,
        letter_grade: parsed.letter_grade,
        grade_label: parsed.grade_label || '',
        top_strength: parsed.top_strength || '',
        top_priority: parsed.top_priority || '',
        resultsHtml: newHtml,
        rep_scores: (parsed.rep_scores && parsed.rep_scores.length) ? parsed.rep_scores : undefined,
        partner_scores: (parsed.partner_scores && parsed.partner_scores.length) ? parsed.partner_scores : undefined,
        spiced: parsed.spiced || undefined,
      };

      await fetch('/api/history/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedRecord]),
      });

      logAudit('regrade', {
        entity_id:    String(id),
        entity_label: tProspect,
        rep:          updatedRecord.rep,
        stage:        tStage,
        score:        String(updatedRecord.normalized_score),
        letter_grade: updatedRecord.letter_grade,
        details:      { grade_label: updatedRecord.grade_label, top_priority: updatedRecord.top_priority, triggered_from: 'history' },
      });
      if (parsed.atlas_data && tProspect && typeof atlasAutoPopulate === 'function') {
        atlasAutoPopulate(tProspect, parsed.atlas_data);
      }

      // 7. Update cache and re-render the history card
      const cacheIdx = _histCache.findIndex(h => String(h.id) === String(id));
      if (cacheIdx !== -1) Object.assign(_histCache[cacheIdx], updatedRecord);
      else _histCache.unshift(updatedRecord);

      // Refresh just this card in the DOM
      const cardEl = document.getElementById('hist-' + id);
      if (cardEl) {
        const newCardHtml = buildHistCard(_histCache[cacheIdx !== -1 ? cacheIdx : 0], histSort !== 'company');
        const tmp = document.createElement('div');
        tmp.innerHTML = newCardHtml;
        cardEl.replaceWith(tmp.firstElementChild);
        // Re-open the expanded body
        const newCard = document.getElementById('hist-' + id);
        if (newCard) {
          const body = newCard.querySelector('.hist-card-body');
          if (body) body.style.display = 'block';
          const chev = newCard.querySelector('.hist-card-chevron');
          if (chev) chev.style.transform = 'rotate(180deg)';
        }
      }

    } catch (err) {
      alert('Re-grade failed: ' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = '↺ Re-grade'; btn.classList.remove('hist-regrade-btn-active'); }
    }
  }

  window.renderSavedTranscripts = async function() {
    const el = document.getElementById('savedTranscriptsList');
    if (!el) return;

    // If a bulk regrade is in flight, show the in-progress banner instead of resetting
    if (_brgRunning) {
      el.style.display = '';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:8px;border:1px solid rgba(232,160,32,.35);background:rgba(232,160,32,.07);margin-bottom:4px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#e8a020;flex-shrink:0;animation:regradeGlow 1.2s ease-in-out infinite;"></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85);">Bulk re-grade in progress</div>
            <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;">${_brgDone} of ${_brgTotal} complete — running in background</div>
          </div>
          <button class="devtool-run-btn" onclick="brgRestoreProgress()" style="flex-shrink:0;">View Progress</button>
        </div>`;
      const actionBar = document.getElementById('brgActionBar');
      if (actionBar) actionBar.style.display = 'none';
      return;
    }

    el.style.display = '';  // reset in case bulk regrade hid it
    el.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:13px;">Loading…</div>';
    const actionBar = document.getElementById('brgActionBar');
    const progressEl = document.getElementById('brgProgress');
    if (actionBar) actionBar.style.display = 'none';
    if (progressEl) progressEl.style.display = 'none';
    // Reset loading screen if it was left visible from an interrupted bulk regrade
    const loadOverlay = document.getElementById('brgLoadOverlay');
    if (loadOverlay) loadOverlay.style.display = 'none';
    const loadEl = document.getElementById('loading');
    if (loadEl && loadEl.style.display !== 'none') { stopRadar(); loadEl.style.display = 'none'; }
    try {
      const rows = await fetch('/api/transcripts').then(r => r.json());
      if (!rows.length) {
        el.innerHTML = '<div style="color:rgba(255,255,255,.2);font-size:13px;padding:8px 0;">No saved transcripts yet. Transcripts are saved automatically after each grading.</div>';
        return;
      }
      // Sort oldest → newest for bulk regrade ordering
      _brgTranscripts = rows.slice().sort((a, b) => {
        const da = a.call_date || a.saved_at || '';
        const db = b.call_date || b.saved_at || '';
        return da.localeCompare(db);
      });
      el.innerHTML = _brgTranscripts.map((t, i) => {
        const ds = t.call_date
          ? new Date(t.call_date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date(t.saved_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const meta = [t.stage, t.rep, ds].filter(Boolean).join(' · ');
        return `<div class="saved-transcript-row" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.07);margin-bottom:6px;background:rgba(255,255,255,.03);">
          <label style="display:flex;align-items:center;cursor:pointer;padding:2px 0;">
            <input type="checkbox" data-idx="${i}" onchange="brgUpdateCount()" style="margin:0 8px 0 0;accent-color:#00c8ff;">
          </label>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(t.prospect || t.label || 'Untitled')}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:2px;">${escHtml(meta)}</div>
          </div>
          <button class="pdf-btn pdf-btn-sm" onclick="window.open('/transcript/'+encodeURIComponent(${escHtml(JSON.stringify(t.id))}),'_blank')">&#128196; View</button>
          <button class="pdf-btn pdf-btn-sm" onclick="loadSavedTranscript(${escHtml(JSON.stringify(t.id))})">&#8635; Load</button>
          ${typeof sirenIsAdmin === 'function' && sirenIsAdmin() ? `<button class="hist-delete-btn" style="padding:4px 10px;font-size:11px;" onclick="deleteSavedTranscript(${escHtml(JSON.stringify(t.id))},this)">Delete</button>` : ''}
        </div>`;
      }).join('');
      if (actionBar) { actionBar.style.display = 'block'; brgUpdateCount(); }
    } catch (e) {
      el.innerHTML = '<div style="color:#ef4444;font-size:13px;">Failed to load transcripts.</div>';
    }
  };

  window.loadSavedTranscript = async function(id) {
    try {
      const res = await fetch('/api/transcripts/' + encodeURIComponent(String(id)));
      if (!res.ok) { alert('Transcript not found.'); return; }
      await _loadTranscriptIntoGrader(await res.json());
    } catch (e) { alert('Error: ' + e.message); }
  };

  window.deleteSavedTranscript = async function(id, btn) {
    if (!confirm('Delete this saved transcript? This cannot be undone.')) return;
    try {
      if (btn) btn.disabled = true;
      // Grab label before deleting
      const tRow = _brgTranscripts.find(t => String(t.id) === String(id));
      await fetch('/api/transcripts/' + encodeURIComponent(String(id)), { method: 'DELETE' });
      logAudit('transcript_delete', {
        entity_id:    String(id),
        entity_label: tRow?.prospect || tRow?.label || '',
        rep:          tRow?.rep || '',
        stage:        tRow?.stage || '',
      });
      renderSavedTranscripts();
    } catch (e) { alert('Error: ' + e.message); }
  };

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
            source: 'ENGAGE',
            model: getDevModel('engage_grade', 'claude-haiku-4-5-20251001'),
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
  let histRepFilter = '';

  window.setHistRepFilter = function(val) {
    histRepFilter = (val || '').trim().toLowerCase();
    renderHistory();
  };

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
    // Render report preserving the toggle — strip only the grader action buttons
    const bodyHtml = (h.resultsHtml || '')
      // Remove "Grade another call" reset button and "Export PDF" button from results-actions
      .replace(/<div class="results-actions">[\s\S]*?<\/div>/g, '')
      // Ensure switchScoreView calls pass the event for .hist-card-body scoping
      .replace(/onclick="switchScoreView\('([^']+)'\)"/g, "onclick=\"switchScoreView('$1',event)\"");
    const titleLine = showCompany && h.prospect
      ? `${escHtml(h.prospect)} — ${escHtml(h.stage || 'Unknown stage')}`
      : escHtml(h.stage || 'Unknown stage');
    // Build attendee list: OneAxiom reps from rep_scores + third parties from partner_scores
    const team = loadTeam();
    const repChips = Array.isArray(h.rep_scores) && h.rep_scores.length
      ? h.rep_scores.map(rs => {
          const member = team.find(m => m.name && m.name.toLowerCase() === (rs.name || '').toLowerCase());
          const role = member?.role || rs.role || '';
          return { label: role ? `${rs.name} · ${role}` : rs.name, type: 'rep' };
        })
      : [h.rep, h.repRole].filter(Boolean).join(' · ')
        ? [{ label: [h.rep, h.repRole].filter(Boolean).join(' · '), type: 'rep' }]
        : [];
    const partnerChips = Array.isArray(h.partner_scores) && h.partner_scores.length
      ? h.partner_scores.map(ps => {
          const label = [ps.name, ps.role || ps.organization].filter(Boolean).join(' · ');
          return { label: label || ps.name, type: 'partner' };
        })
      : [];
    const metaParts = [...repChips, ...partnerChips];
    return `<div class="hist-card" id="hist-${h.id}">
      <div class="hist-card-header" onclick="toggleHistCard(${h.id})">
        <div class="hist-grade-badge" style="background:${bannerBg};">${escHtml(h.letter_grade)} ${escHtml(String(h.normalized_score ?? h.total))}</div>
        <div class="hist-card-center">
          <div class="hist-card-title">${titleLine}</div>
          ${metaParts.length ? `<div class="hist-card-meta">${metaParts.map(a => `<span class="hist-attendee hist-attendee-${a.type}">${escHtml(a.label)}</span>`).join('')}</div>` : ''}
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
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="hist-regrade-btn" id="hist-regrade-${h.id}" onclick="regradeFromHistory('${h.id}',event)">&#8635; Re-grade</button>
            <button class="pdf-btn pdf-btn-sm" onclick="exportHistoryPDF(${h.id});event.stopPropagation()">&#8595; PDF</button>
            <button class="pdf-btn pdf-btn-sm" onclick="window.open('/transcript/'+encodeURIComponent('${h.id}'),'_blank');event.stopPropagation()" title="Open raw transcript in new tab">&#128196; Transcript</button>
            <button class="hist-delete-btn" onclick="deleteHistEntry(${h.id},event)">Delete this entry</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderHistory() {
    let history = loadHistory();
    const el = document.getElementById('historyList');
    if (!el) return;
    if (histRepFilter) {
      const _matchName = (a, b) => {
        const x = (a||'').toLowerCase().trim(), y = (b||'').toLowerCase().trim();
        if (!x || !y) return false;
        if (x === y) return true;
        const shorter = x.split(' ').length <= y.split(' ').length ? x : y;
        const longer  = shorter === x ? y : x;
        return shorter.split(' ').every(w => w.length > 1 && longer.includes(w));
      };
      const _parseRS = rs => { if (!rs) return []; if (Array.isArray(rs)) return rs; try { return JSON.parse(rs); } catch { return []; } };
      history = history.filter(h => {
        if (_matchName(h.rep, histRepFilter)) return true;
        return _parseRS(h.rep_scores).some(r => _matchName(r.name, histRepFilter));
      });
    }
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
        const avgScore = Math.round(entries.reduce((s, h) => s + (h.normalized_score || h.total || 0), 0) / entries.length);
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
    const hist = loadHistory();
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
    const h = _histCache.find(r => String(r.id) === sid);
    _histCache = _histCache.filter(h => String(h.id) !== sid);
    _dbDeleteRecord(sid);
    logAudit('delete', {
      entity_id:    sid,
      entity_label: h?.prospect || '',
      rep:          h?.rep || '',
      stage:        h?.stage || '',
      score:        h ? String(h.normalized_score) : '',
      letter_grade: h?.letter_grade || '',
    });
    renderHistory();
  }

  function clearHistory() {
    if (!confirm('Clear all call history? This cannot be undone.')) return;
    logAudit('clear_history', { details: { count: _histCache.length } });
    _histCache = [];
    _dbBulkSave([]);
    renderHistory();
  }

  // ── Deal Lifecycle ─────────────────────────────────────────
  // ── Graph state ──
  let _lcT              = { x: 0, y: 0, s: 1 };
  let _lcPan            = null;
  let _lcNodeDrag       = null; // { nodeId, ox, oy, nx, ny } — active node drag
  let _lcNodes          = [];
  let _lcEdges          = [];
  let _lcSelId          = null;
  let _lcCallsCollapsed       = false;
  let _lcPeopleExpanded      = true;
  let _lcCompetitionExpanded = true;
  let _lcTechnologyExpanded  = true;
  let _lcAllEntries     = [];   // full entry list, preserved across collapse
  let _lcCompany        = '';

  const NODE_DEFS = {
    account:           { color: '#061824', ring: '#00c8ff', r: 40, label: 'ACCOUNT' },
    call:              { color: '#061824', ring: '#00c8ff', r: 30, label: 'CALL' },
    'calls-summary':   { color: '#061824', ring: '#00c8ff', r: 38, label: 'ALL CALLS' },
    contact:           { color: '#1f1510', ring: '#e8a020', r: 24, label: 'CONTACT',     ph: true },
    champion:          { color: '#0a1428', ring: '#00c8ff', r: 24, label: 'CHAMPION',    ph: true },
    opportunity:       { color: '#081428', ring: '#4a9eff', r: 26, label: 'OPPORTUNITY', ph: true },
    competitor:        { color: '#200a0a', ring: '#e05050', r: 24, label: 'COMPETITOR',  ph: true },
    techstack:         { color: '#130d20', ring: '#9b59b6', r: 24, label: 'TECH STACK',  ph: true },
    stakeholder:       { color: '#1f1510', ring: '#e8a020', r: 24, label: 'STAKEHOLDER', ph: true },
    'cat-people':      { color: '#1a1008', ring: '#e8a020', r: 30, label: 'PEOPLE' },
    'cat-competition': { color: '#1a0505', ring: '#e05050', r: 30, label: 'COMPETITION' },
    'cat-technology':  { color: '#0d0818', ring: '#9b59b6', r: 30, label: 'TECHNOLOGY' },
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

  // ── Bulk Re-grade (Developer Tools) ──────────────────────────────────────
  // State
  let _brgTranscripts = []; // [{id, label, prospect, stage, rep, call_date}] sorted oldest→newest
  let _brgRunning     = false;  // true while a bulk regrade is in flight
  let _brgDone        = 0;      // transcripts completed so far
  let _brgTotal       = 0;      // total selected for this run

  function bulkRegradeLoad() {
    // Delegated to renderSavedTranscripts — kept for compatibility
    renderSavedTranscripts();
  }

  function brgRestoreProgress() {
    // Re-show the loading screen while the regrade continues in the background
    const el = document.getElementById('savedTranscriptsList');
    if (el) el.style.display = 'none';
    const loadEl = document.getElementById('loading');
    if (loadEl) loadEl.style.display = 'flex';
    startRadar();
    const overlay = document.getElementById('brgLoadOverlay');
    if (overlay) overlay.style.display = 'block';
    const counter = document.getElementById('brgLoadCounter');
    if (counter) counter.textContent = `${_brgDone} of ${_brgTotal}`;
    const bar = document.getElementById('brgLoadBar');
    if (bar) bar.style.width = Math.round((_brgDone / _brgTotal) * 100) + '%';
    const ctx = document.getElementById('loadContext');
    if (ctx) ctx.textContent = 'BULK RE-GRADE IN PROGRESS';
  }

  function brgToggleAll(checked) {
    document.querySelectorAll('#savedTranscriptsList input[type=checkbox]').forEach(cb => cb.checked = checked);
    brgUpdateCount();
  }

  function brgUpdateCount() {
    const checked = document.querySelectorAll('#savedTranscriptsList input[type=checkbox]:checked').length;
    const countEl = document.getElementById('brgSelCount');
    const runBtn  = document.getElementById('brgRunBtn');
    const allCbs  = document.querySelectorAll('#savedTranscriptsList input[type=checkbox]');
    const allChk  = document.getElementById('brgSelectAll');
    if (countEl) countEl.textContent = checked + ' selected';
    if (runBtn)  runBtn.disabled = checked === 0;
    if (allChk)  allChk.indeterminate = checked > 0 && checked < allCbs.length;
    if (allChk && checked === allCbs.length && allCbs.length > 0) allChk.checked = true;
    if (allChk && checked === 0) allChk.checked = false;
  }

  async function bulkRegradeRun() {
    const indices = [...document.querySelectorAll('#savedTranscriptsList input[type=checkbox]:checked')]
      .map(cb => parseInt(cb.dataset.idx));
    if (!indices.length) return;

    // Hide selector + action bar; show loading screen in bulk mode
    document.getElementById('savedTranscriptsList').style.display = 'none';
    const brgActionBarEl = document.getElementById('brgActionBar');
    if (brgActionBarEl) brgActionBarEl.style.display = 'none';

    // Bulk overlay elements (inside #loading)
    const brgLoadOverlay  = document.getElementById('brgLoadOverlay');
    const brgLoadName     = document.getElementById('brgLoadName');
    const brgLoadCounter  = document.getElementById('brgLoadCounter');
    const brgLoadBar      = document.getElementById('brgLoadBar');

    // Devtool log panel (shown after completion for summary)
    const progEl       = document.getElementById('brgProgress');
    const logEl        = document.getElementById('brgLog');
    const doneBtn      = document.getElementById('brgDoneBtn');
    const countdownEl  = document.getElementById('brgCountdown');
    const elapsedEl    = document.getElementById('brgElapsed');
    const labelEl      = document.getElementById('brgProgLabel');
    const fracEl       = document.getElementById('brgProgFrac');
    const barEl        = document.getElementById('brgProgBar');
    logEl.innerHTML = '';
    countdownEl.textContent = '—';
    elapsedEl.textContent   = '0:00';

    const total = indices.length;
    let done = 0, succeeded = 0, failed = 0;
    _brgRunning = true;
    _brgDone    = 0;
    _brgTotal   = total;
    const runStart    = Date.now();
    const itemTimes   = []; // ms each completed item took

    // Tick the elapsed + ETA every second
    function fmtSecs(s) {
      const m = Math.floor(s / 60), ss = Math.floor(s % 60);
      return m + ':' + String(ss).padStart(2, '0');
    }
    const _tickInterval = setInterval(() => {
      const elapsedSec = (Date.now() - runStart) / 1000;
      elapsedEl.textContent = fmtSecs(elapsedSec);
      if (itemTimes.length > 0 && done < total) {
        const avgMs    = itemTimes.reduce((a, b) => a + b, 0) / itemTimes.length;
        const remaining = (total - done) * avgMs / 1000;
        countdownEl.textContent = fmtSecs(remaining);
      }
    }, 1000);

    function brgLog(msg, status) {
      const ts = new Date().toLocaleTimeString();
      const row = document.createElement('div');
      row.className = 'devtool-log-row ' + (status || 'run');
      row.innerHTML = `<span class="devtool-log-ts">${ts}</span><span class="devtool-log-msg">${escHtml(msg)}</span>`;
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    }

    for (const idx of indices) {
      const t = _brgTranscripts[idx];
      const label = t.label || t.prospect || 'Untitled';

      // Show the normal loading screen with bulk overlay
      setLoading(true, label, t.stage || '');
      document.getElementById('loadContext').textContent =
        ('BULK // ' + (label.length > 28 ? label.slice(0, 27) + '…' : label)).toUpperCase();
      if (brgLoadOverlay) {
        brgLoadOverlay.style.display = 'block';
        if (brgLoadName)    brgLoadName.textContent    = label;
        if (brgLoadCounter) brgLoadCounter.textContent = `${done + 1} of ${total}`;
        if (brgLoadBar)     brgLoadBar.style.width     = Math.round((done / total) * 100) + '%';
      }

      brgLog(`→ Fetching: ${label}`, 'run');
      const itemStart = Date.now();

      try {
        // 1. Fetch full transcript text
        const tResp = await fetch('/api/transcripts/' + encodeURIComponent(t.id));
        if (!tResp.ok) throw new Error('Transcript fetch failed (' + tResp.status + ')');
        const tData = await tResp.json();

        // 2. Build grading context — mirror engage() logic but use transcript's saved metadata
        const tProspect     = tData.prospect || '';
        const tStage        = tData.stage || '';
        const tCallDate     = tData.call_date || '';
        const tRepName      = tData.rep || '';
        const team          = loadTeam();
        const tRepObj       = team.find(m => m.name && m.name.toLowerCase() === tRepName.toLowerCase()) || null;

        // Temporarily override selectedStage so ceiling functions use the right stage
        const prevStage = selectedStage;
        selectedStage = tStage;

        const tpContext    = await _detectThirdPartyContext(tData.transcript, tProspect);
        const systemPrompt = buildBulkGradePrompt(tProspect, tRepObj, tCallDate, tStage, tpContext);
        const context = [
          tRepObj   ? 'Primary rep: ' + tRepObj.name + ' (' + tRepObj.role + ')' : (tRepName ? 'Primary rep: ' + tRepName : ''),
          team.length ? 'Your sales team on this call (include ALL who speak in rep_scores): ' + team.map(m => m.name + ' (' + m.role + ')').join(', ') : '',
          tProspect ? 'Prospect: ' + tProspect : '',
          tCallDate ? 'Call date: ' + tCallDate : '',
          tStage    ? 'Call stage: ' + tStage : '',
        ].filter(Boolean).join(' | ');

        brgLog(`  ↳ Transcript loaded (${(tData.transcript || '').length.toLocaleString()} chars) — calling Claude…`, 'run');

        // 3. Call Claude via SSE stream (same as normal grader — avoids timeout on long transcripts)
        const resp = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              source: 'ENGAGE',
              model: getDevModel('engage_grade', 'claude-sonnet-4-6'),
            max_tokens: 8192,
            temperature: 0,
            stream: true,
            system: systemPrompt,
            messages: [{ role: 'user', content: context + '\n\n' + tData.transcript }],
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error?.message || 'API error ' + resp.status);
        }

        // Read SSE stream, accumulate text deltas
        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '', accumulated = '';
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
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
                updateStreamProgress(accumulated); // animate loading steps live
              }
            } catch {}
          }
        }

        let raw = accumulated.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(raw);
        normalizeResult(parsed, tRepObj);

        // Auto-populate Atlas account profile from extracted data
        if (parsed.atlas_data && tProspect && typeof atlasAutoPopulate === 'function') {
          atlasAutoPopulate(tProspect, parsed.atlas_data);
        }

        // 4. Build results HTML (needed so history cards have content to display)
        const tRepForHtml = tRepObj || (tRepName ? { name: tRepName, role: '' } : null);
        const { html: resultsHtml } = buildResultsHtml(parsed, tProspect, '', tRepForHtml, tCallDate, tData.transcript, [], tStage);

        selectedStage = prevStage;

        // 5. Overwrite the existing history record in-place (same id)
        const updatedRecord = {
          id: t.id,
          ts: new Date().toISOString(),
          callDate: tCallDate,
          rep: tRepObj ? tRepObj.name : tRepName,
          repRole: tRepObj ? tRepObj.role : '',
          prospect: tProspect,
          stage: tStage,
          total: parsed.total,
          normalized_score: parsed.normalized_score ?? parsed.total,
          letter_grade: parsed.letter_grade,
          grade_label: parsed.grade_label || '',
          top_strength: parsed.top_strength || '',
          top_priority: parsed.top_priority || '',
          resultsHtml,
          rep_scores: (parsed.rep_scores && parsed.rep_scores.length) ? parsed.rep_scores : undefined,
          partner_scores: (parsed.partner_scores && parsed.partner_scores.length) ? parsed.partner_scores : undefined,
          spiced: parsed.spiced || undefined,
          };

        // Update DB via bulk upsert
        await fetch('/api/history/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([updatedRecord]),
        });

        // Update local cache
        const cacheIdx = _histCache.findIndex(h => String(h.id) === String(t.id));
        if (cacheIdx !== -1) Object.assign(_histCache[cacheIdx], updatedRecord);

        logAudit('bulk_regrade', {
          entity_id:    String(t.id),
          entity_label: tProspect,
          rep:          updatedRecord.rep,
          stage:        tStage,
          score:        String(updatedRecord.normalized_score),
          letter_grade: updatedRecord.letter_grade,
          details:      { grade_label: updatedRecord.grade_label, batch_total: total, batch_index: done + 1 },
        });

        succeeded++;
        brgLog(`✓ ${label} — ${parsed.letter_grade} (${parsed.normalized_score ?? parsed.total})`, 'ok');
      } catch (err) {
        selectedStage = prevStage; // restore on error
        failed++;
        brgLog(`✗ ${label} — ${err.message}`, 'err');
      }

      itemTimes.push(Date.now() - itemStart);
      done++;
      _brgDone = done;

      // Flash all steps to done, update batch bar, brief pause before next
      updateStreamProgress('"spiced"'); // triggers pct=93 → all 4 steps complete
      ['pre', 0, 1, 2, 3].forEach(key => {
        const s  = document.getElementById('lstep-' + key);
        const ic = document.getElementById('lstep-icon-' + key);
        const b  = document.getElementById('lstep-bar-' + key);
        if (s)  { s.classList.add('visible', 'done'); s.classList.remove('active'); }
        if (ic) ic.textContent = '✓';
        if (b)  b.style.width = '100%';
      });
      if (brgLoadBar) brgLoadBar.style.width = Math.round((done / total) * 100) + '%';
      if (brgLoadCounter) brgLoadCounter.textContent = `${done} of ${total}`;

      if (done < total) await new Promise(r => setTimeout(r, 900));
    }

    // All done — hide loading screen, show summary log
    _brgRunning = false;
    stopRadar();
    if (brgLoadOverlay) brgLoadOverlay.style.display = 'none';
    const loadEl2 = document.getElementById('loading');
    if (loadEl2) loadEl2.style.display = 'none';
    document.getElementById('savedTranscriptsList').style.display = '';

    clearInterval(_tickInterval);
    const totalSec = (Date.now() - runStart) / 1000;
    countdownEl.textContent = '0:00';
    elapsedEl.textContent   = fmtSecs(totalSec);
    labelEl.textContent = `Complete — ${succeeded} succeeded${failed ? ', ' + failed + ' failed' : ''}`;
    fracEl.textContent  = `${done} / ${total}`;
    barEl.style.width   = '100%';
    progEl.style.display = 'block';
    doneBtn.style.display = 'block';
    brgLog(`── Bulk re-grade complete: ${succeeded}/${total} updated in ${fmtSecs(totalSec)} ──`, succeeded === total ? 'ok' : 'err');
  }

  function _buildThirdPartyContext(allThirdParties) {
    if (!allThirdParties.length) return '';
    const lines = allThirdParties.map(p =>
      `- ${p.name}: ${p.role}${p.organization ? ' (' + p.organization + ')' : ''}`
    ).join('\n');
    return `\n\nThird-party participants on this call (NOT your company's reps, NOT the customer):\n${lines}\n\nGrading instructions for third-party participants:\n- Do NOT include third-party participants in rep_scores — only score your company's sales reps\n- Do NOT penalize your company's rep for topics or tasks the third party handled\n- In call_summary, acknowledge the third party's presence and note how their role affected call dynamics\n- Populate the partner_scores array (one entry per third-party participant) using this schema:\n\n"partner_scores": [\n  {\n    "name": "participant name",\n    "role": "their role as provided",\n    "organization": "their org if known",\n    "dimensions": [\n      { "name": "Technical relevance", "max": 25, "score": 0, "feedback": "2-3 sentences — did their technical contributions match the prospect needs?" },\n      { "name": "Rep alignment", "max": 25, "score": 0, "feedback": "2-3 sentences — did they reinforce or contradict the rep positioning?" },\n      { "name": "Preparation", "max": 25, "score": 0, "feedback": "2-3 sentences — were they briefed and ready for this specific account?" },\n      { "name": "Deal momentum", "max": 25, "score": 0, "feedback": "2-3 sentences — did their presence move the deal forward or introduce friction?" }\n    ],\n    "total": 0,\n    "letter_grade": "B",\n    "grade_label": "short evocative phrase",\n    "top_strength": "one specific sentence about what this partner did well",\n    "top_priority": "single most important improvement for this partner",\n    "call_impact": "positive|negative|neutral",\n    "call_impact_delta": 0,\n    "call_impact_summary": "2-3 sentences explaining how their presence affected overall call outcome — be specific about what helped or hurt"\n  }\n]\n\ncall_impact_delta: estimate the net point impact this partner had on the call effectiveness as a signed integer (e.g. +8 if they meaningfully helped, -5 if they confused the prospect or undercut the rep). This does NOT change the rep score — it is an independent assessment of partner contribution.`;
  }

  async function _detectThirdPartyContext(transcript, prospect) {
    try {
      const { newUnknowns, known } = await detectUnknownParticipants(transcript, prospect, '', null);
      const allThirdParties = [
        ...known.map(k => ({ name: k.name, role: k.role || '', organization: k.organization || '' })),
        ...newUnknowns.map(u => {
          const stored = _getKnownThirdParty(u.name);
          return stored
            ? { name: stored.name, role: stored.role || '', organization: stored.organization || '' }
            : { name: u.name, role: u.clue || 'Unknown role', organization: '' };
        }),
      ];
      return _buildThirdPartyContext(allThirdParties);
    } catch (e) {
      return '';
    }
  }

  function buildBulkGradePrompt(prospect, rep, callDate, stage, thirdPartyContext = '') {
    const prevStage = selectedStage;
    selectedStage = stage;
    const prompt = `You are an expert sales coach specializing in MSSP and B2B security sales.\n\n` +
      `${buildLibraryPrompt()}${buildDocsPrompt()}` +
      `\n\nYou are grading a ${stage} call for your company (an MSSP). Key differentiator: bundling 24x7 SOC + EDR (CrowdStrike/SentinelOne) + vuln scanning (SecPod Saner CVEM) + KnowBe4 security awareness training, replacing 2-3 vendors. CMMC positioning is only relevant if the transcript explicitly mentions DoD contracts, CMMC, or CUI — do NOT grade on CMMC for general prospects.${buildRoleGuidance(rep)}\n\n` +
      `${buildStageWeighting()}\n` +
      `${buildDemoEdgeCaseGuidance()}\n\n` +
      `Use this grading scale when assigning letter_grade. Grades are based on percentage of the applicable maximum (stage max for overall call; role+stage max for each rep). Do not use raw score against a 100-point scale — normalize first:\n` +
      `A+: 97–100% | A: 93–96% | A-: 90–92% | B+: 87–89% | B: 83–86% | B-: 80–82% | C+: 77–79% | C: 73–76% | C-: 70–72% | D+: 67–69% | D: 63–66% | D-: 60–62% | F: below 60%\n` +
      `Overall call max (stage ceiling, 7 dimensions): ${Object.values(stageDimCeilings()).reduce((a,b)=>a+b,0)} pts. Primary rep ceiling (role+stage): ${Object.values(combinedDimMaxes(rep)).reduce((a,b)=>a+b,0)} pts.\n\n` +
      `Speaker resolution: Resolve generic speaker labels ("Speaker 1", etc.) to real names using all available context. Apply resolved names consistently throughout, including rep_scores.\n\nTranscription errors — name mismatches: AI transcription software frequently mishears or misrecords spoken names. If the transcript shows a rep introducing themselves with a name that does not match any known team member, assume it is a transcription error — do NOT flag it as a missed opportunity, professionalism issue, or coaching point. Cross-reference the known sales team roster. If the spoken name is phonetically similar to a known team member's name, or if context otherwise identifies the speaker as a known rep, treat the introduction as correct. Never penalize a rep for a name the transcript recorded incorrectly.\n\n` +
      `Grade across these 7 dimensions and return ONLY valid JSON, no markdown, no backticks, no preamble.\n\n` +
      `IMPORTANT — two separate scoring contexts apply:\n` +
      `1. The top-level "dimensions" and "total" represent the overall call effectiveness scored against STAGE-ONLY ceilings.\n` +
      `2. Each entry in "rep_scores" is scored against that individual rep's role ceiling compounded with the stage ceiling. The "role_max" field in each rep entry tells you the adjusted maximum for that rep — do not exceed it.\n\n` +
      `{\n  "dimensions": [\n    ${buildStageDimensions('__stage_only__')}\n  ],\n` +
      `  "total": 0,\n  "letter_grade": "B",\n  "grade_label": "short evocative phrase",\n` +
      `  "top_strength": "one specific sentence",\n  "top_priority": "single most important fix for next call",\n` +
      `  "call_summary": { "positives": [], "missed": [], "improvements": [] },\n` +
      `  "recommended_books": [],\n` +
      `  "rep_scores": [\n    {\n      "name": "Rep Name",\n      "role_max": ${Object.values(combinedDimMaxes(rep)).reduce((a,b)=>a+b,0)},\n` +
      `      "dimensions": [\n        ${buildStageDimensions(rep)}\n      ],\n` +
      `      "total": 0, "letter_grade": "B", "grade_label": "", "top_strength": "", "top_priority": "",\n` +
      `      "call_summary": { "positives": [], "missed": [], "improvements": [] }\n    }\n  ],\n` +
      `  "spiced": {\n    "situation": { "touched": true, "summary": "" },\n    "pain": { "touched": true, "summary": "" },\n` +
      `    "impact": { "touched": false, "summary": "" },\n    "critical_event": { "touched": false, "summary": "" },\n` +
      `    "evolution": { "touched": false, "summary": "" },\n    "decision": { "touched": true, "summary": "" }\n  },\n` +
      `  "atlas_data": {\n    "contacts": [{ "name": "", "title": "" }],\n    "champion": { "name": "", "title": "" },\n` +
      `    "stakeholders": [{ "name": "", "title": "" }],\n    "competitors": [],\n    "tech_stack": [],\n    "opportunity_summary": ""\n  }\n}\n\n` +
      `atlas_data: contacts = prospect-side attendees with titles. champion = single most enthusiastic/influential prospect-side person (empty object if unclear). stakeholders = prospect-side people mentioned but not on call. competitors = competing vendors mentioned. tech_stack = existing tools the prospect currently uses. opportunity_summary = 1-2 sentence deal summary. Empty array/object if nothing to report.\n` +
      `total (overall call): sum of all 7 dimension scores. Max is ${Object.values(stageDimCeilings()).reduce((a,b)=>a+b,0)} for this meeting type.\n` +
      `rep_scores[].total: sum of that rep's 7 dimension scores. Do not exceed the role_max shown in each rep entry.\n` +
      `IMPORTANT — Demo delivery: if max is 0 for this context, score MUST be 0. Write "N/A" in the feedback field.\n` +
      `IMPORTANT — Executive presence & strategic positioning: if max is 0 for a rep, score MUST be 0. Write "N/A" in the feedback field.` +
      thirdPartyContext;
    selectedStage = prevStage;
    return prompt;
  }

  function bulkRegradeReset() {
    // Reload history then navigate to history page
    fetch('/api/history')
      .then(r => r.json())
      .then(data => {
        _histCache = Array.isArray(data) ? data : (data.records || []);
        navTo('history');
        // Reset UI state
        document.getElementById('brgProgress').style.display = 'none';
        const _brgAB = document.getElementById('brgActionBar');
        if (_brgAB) _brgAB.style.display = 'none';
        document.getElementById('savedTranscriptsList').style.display = '';
        document.getElementById('brgDoneBtn').style.display = 'none';
        const _brgLO = document.getElementById('brgLoadOverlay');
        if (_brgLO) _brgLO.style.display = 'none';
        const _loadEl = document.getElementById('loading');
        if (_loadEl) _loadEl.style.display = 'none';
        stopRadar();
        document.getElementById('brgProgBar').style.width = '0%';
        document.getElementById('brgLog').innerHTML = '';
        document.getElementById('brgSelectAll').checked = false;
        _brgTranscripts = [];
        _brgRunning = false;
        _brgDone = 0;
        _brgTotal = 0;
      })
      .catch(() => { _brgRunning = false; navTo('history'); });
  }

  function initCoachGradingSelector() {
    const btns = document.getElementById('coachGradingBtns');
    const desc = document.getElementById('coachGradingDesc');
    if (!btns || !window.GRADING_PRESETS) return;
    const saved = Number(localStorage.getItem('siren_coach_grade_level')) || window._sirenGradingLevel || 3;
    window._sirenCoachGradingLevel = saved;
    btns.innerHTML = window.GRADING_PRESETS.map(p => {
      const active = p.level === saved;
      return `<button onclick="setCoachGradingLevel(${p.level})" id="cgbtn-${p.level}" style="background:${active ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.04)'};border:1px solid ${active ? 'rgba(245,158,11,.5)' : 'rgba(255,255,255,.1)'};color:${active ? '#f59e0b' : 'rgba(255,255,255,.4)'};border-radius:5px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">${p.level} — ${p.label}</button>`;
    }).join('');
    if (desc) desc.textContent = window.GRADING_PRESETS.find(p => p.level === saved)?.tagline || '';
  }

  function setCoachGradingLevel(level) {
    window._sirenCoachGradingLevel = level;
    localStorage.setItem('siren_coach_grade_level', level);
    window.GRADING_PRESETS.forEach(p => {
      const btn = document.getElementById('cgbtn-' + p.level);
      if (!btn) return;
      const active = p.level === level;
      btn.style.background = active ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.04)';
      btn.style.borderColor = active ? 'rgba(245,158,11,.5)' : 'rgba(255,255,255,.1)';
      btn.style.color = active ? '#f59e0b' : 'rgba(255,255,255,.4)';
    });
    const desc = document.getElementById('coachGradingDesc');
    if (desc) desc.textContent = window.GRADING_PRESETS.find(p => p.level === level)?.tagline || '';
    // Re-render any displayed grades
    if (typeof coachOnRepChange === 'function') coachOnRepChange();
  }
  window.setCoachGradingLevel = setCoachGradingLevel;

  document.addEventListener('DOMContentLoaded', () => { setTimeout(initCoachGradingSelector, 500); });

