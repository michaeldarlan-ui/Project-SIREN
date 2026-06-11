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

