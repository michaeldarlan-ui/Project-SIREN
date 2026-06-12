// ── COACH MODULE ──────────────────────────────────────────────────────────────

  let _coachRaf = null;
  let _coachCurrentRep = null;
  let _coachFeedbackRecord = null;
  let _coachFeedbackMd = '';
  let _coachRecogMd = '';
  let _arenaScenario = 'objection';
  let _arenaDiff = 'medium';
  let _arenaMessages = []; // {role, content}
  let _arenaFeedbackMd = '';
  let _arenaRunning = false;

  // ── Radar helper (reusable) ──────────────────────────────────────────────────
  function _coachStartRadar(canvasId) {
    _coachStopRadar();
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 70, cy = 70, r = 64;
    const G = 'rgba(0,200,255,';
    let angle = 0;
    const blips = [
      { a: 0.9, d: 0.42, c: G },
      { a: 2.3, d: 0.67, c: G },
      { a: 4.1, d: 0.31, c: 'rgba(0,230,160,' },
    ];
    function draw() {
      ctx.clearRect(0, 0, 140, 140);
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, r * i / 4, 0, Math.PI * 2);
        ctx.strokeStyle = G + (0.07 + i * 0.04) + ')'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.strokeStyle = G + '0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      const d = r * 0.707;
      ctx.strokeStyle = G + '0.07)';
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
      const sg = ctx.createLinearGradient(0, 0, r, 0);
      sg.addColorStop(0, 'rgba(0,200,255,0)');
      sg.addColorStop(0.5, 'rgba(0,200,255,0.18)');
      sg.addColorStop(1, 'rgba(0,200,255,0.55)');
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -0.55, 0); ctx.closePath();
      ctx.fillStyle = sg; ctx.fill(); ctx.restore();
      blips.forEach(b => {
        const diff = ((b.a - angle) + Math.PI * 2) % (Math.PI * 2);
        const alpha = diff < 1.2 ? Math.max(0, 1 - diff * 0.85) : 0;
        if (alpha <= 0) return;
        const bx = cx + Math.cos(b.a) * r * b.d, by = cy + Math.sin(b.a) * r * b.d;
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fillStyle = b.c + alpha * 0.85 + ')'; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.strokeStyle = b.c + alpha * 0.3 + ')'; ctx.lineWidth = 1; ctx.stroke();
      });
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,200,255,' + pulse + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,200,255,' + (pulse * 0.35) + ')'; ctx.lineWidth = 1; ctx.stroke();
      angle = (angle + 0.025) % (Math.PI * 2);
      _coachRaf = requestAnimationFrame(draw);
    }
    draw();
  }
  function _coachStopRadar() {
    if (_coachRaf) { cancelAnimationFrame(_coachRaf); _coachRaf = null; }
  }

  // ── Step animation helper ─────────────────────────────────────────────────────
  function _coachStep(prefix, idx, state) {
    const step = document.getElementById(prefix + '-step-' + idx);
    const icon = document.getElementById(prefix + '-icon-' + idx);
    const bar  = document.getElementById(prefix + '-bar-'  + idx);
    if (!step) return;
    step.classList.remove('visible', 'active', 'done');
    step.classList.add(state);
    if (state === 'active') {
      icon.textContent = '◉';
      let pct = 0;
      const tick = setInterval(() => {
        pct = Math.min(pct + Math.random() * 6 + 2, 88);
        if (bar) bar.style.width = pct + '%';
        if (!step.classList.contains('active')) clearInterval(tick);
      }, 120);
    } else if (state === 'done') {
      icon.textContent = '●';
      if (bar) bar.style.width = '100%';
    }
  }

  function _coachResetSteps(prefix, count) {
    for (let i = 0; i < count; i++) {
      const s = document.getElementById(prefix + '-step-' + i);
      if (s) { s.classList.remove('active', 'done'); s.classList.add('visible'); }
      const b = document.getElementById(prefix + '-bar-' + i);
      if (b) b.style.width = '0%';
      const ic = document.getElementById(prefix + '-icon-' + i);
      if (ic) ic.textContent = '○';
    }
  }

  async function _coachRunSteps(prefix, count, apiCall) {
    _coachResetSteps(prefix, count);
    _coachStep(prefix, 0, 'active');
    await new Promise(r => setTimeout(r, 600));
    _coachStep(prefix, 0, 'done'); _coachStep(prefix, 1, 'active');
    await new Promise(r => setTimeout(r, 700));
    _coachStep(prefix, 1, 'done'); _coachStep(prefix, 2, 'active');

    const resultPromise = apiCall();

    await new Promise(r => setTimeout(r, 800));
    _coachStep(prefix, 2, 'done'); _coachStep(prefix, 3, 'active');

    const result = await resultPromise;

    _coachStep(prefix, 3, 'done');
    await new Promise(r => setTimeout(r, 350));
    return result;
  }

  // ── Markdown renderer ─────────────────────────────────────────────────────────
  function _coachMd(md) {
    return md
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/^### (.+)$/gm,'<h3 class="coach-report-h3">$1</h3>')
      .replace(/^## (.+)$/gm,'<h2 class="coach-report-h2">$1</h2>')
      .replace(/^# (.+)$/gm,'<h1 class="coach-report-h1">$1</h1>')
      .replace(/^[-*] (.+)$/gm,'<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, m => '<ul class="coach-report-ul">' + m + '</ul>')
      .replace(/\n{2,}/g,'</p><p class="coach-report-p">')
      .replace(/^/,'<p class="coach-report-p">')
      .replace(/$/, '</p>');
  }

  // ── PDF print helper ──────────────────────────────────────────────────────────
  function _coachPrint(title, html) {
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${escHtml(title)}</title>
      <style>
        body{background:#fff;margin:0;padding:28px 36px;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;color:#0d1f2d;font-size:13px;line-height:1.65;}
        h1.pdf-title{font-size:15px;font-weight:700;color:#0d1f2d;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid rgba(0,0,0,.15);}
        h1,h2,h3{color:#005580;} h1{font-size:17px;margin:20px 0 8px;} h2{font-size:15px;margin:18px 0 7px;} h3{font-size:14px;margin:16px 0 6px;}
        p{margin:8px 0;} ul{padding-left:18px;margin:6px 0;} li{margin-bottom:4px;} strong{color:#003d55;}
        @media print{body{padding:0;}@page{margin:16mm 14mm;}}
      </style>
    </head><body>
      <h1 class="pdf-title">${escHtml(title)}</h1>${html}
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));window.addEventListener('afterprint',()=>window.close());<\/script>
    </body></html>`);
    win.document.close();
  }

  // ── Claude API call helper ────────────────────────────────────────────────────
  async function _coachAsk(prompt) {
    const resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error('API error ' + resp.status);
    const data = await resp.json();
    return (data.content?.[0]?.text || '').trim();
  }

  // ── Tab switching ──────────────────────────────────────────────────────────────
  function coachSwitchTab(tab) {
    document.querySelectorAll('.coach-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.coach-module').forEach(m => m.classList.remove('active'));
    document.getElementById('ctab-' + tab).classList.add('active');
    document.getElementById('cmod-' + tab).classList.add('active');
    if (tab === 'recognition' && _coachCurrentRep && !_coachRecogMd) {
      coachGenerateRecognition();
    }
  }
  window.coachSwitchTab = coachSwitchTab;

  // ── Rep selector ──────────────────────────────────────────────────────────────
  function coachRenderRepSel() {
    const sel = document.getElementById('coachRepSel');
    if (!sel) return;
    const team = loadTeam();
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Select a rep —</option>' +
      team.map(m => `<option value="${escHtml(m.name)}"${m.name===prev?' selected':''}>${escHtml(m.name)}${m.role?' — '+escHtml(m.role):''}</option>`).join('');
    if (prev && team.find(m => m.name === prev)) coachOnRepChange();
  }

  function coachOnRepChange() {
    const name = document.getElementById('coachRepSel').value;
    _coachCurrentRep = name || null;
    _coachRecogMd = '';

    // Update meta
    const meta = document.getElementById('coachRepMeta');
    if (meta) {
      if (name) {
        const calls = loadHistory().filter(h => {
          if (!h.rep_scores) return (h.rep||'').toLowerCase() === name.toLowerCase();
          try { return JSON.parse(h.rep_scores).some(r => r.name === name); } catch { return false; }
        });
        meta.textContent = calls.length + ' graded call' + (calls.length !== 1 ? 's' : '') + ' on record';
      } else {
        meta.textContent = '';
      }
    }

    // Reset recognition
    document.getElementById('coachRecogBody').style.display = 'none';
    document.getElementById('coachRecogBody').innerHTML = '';
    document.getElementById('coachRecogEmpty').style.display = '';
    document.getElementById('coachRecogStats').style.display = 'none';
    const btn = document.getElementById('coachRecogRefreshBtn');
    if (btn) btn.style.display = name ? '' : 'none';

    // Reset feedback panel
    document.getElementById('coachFeedbackPanel').style.display = 'none';
    _coachFeedbackRecord = null;
    _coachFeedbackMd = '';

    coachRenderCallList();
  }
  window.coachOnRepChange = coachOnRepChange;

  // ── Call list (Feedback tab) ──────────────────────────────────────────────────
  function coachRenderCallList() {
    const listEl = document.getElementById('coachCallList');
    if (!listEl) return;

    if (!_coachCurrentRep) {
      listEl.innerHTML = '<div class="coach-empty-state">Select a rep to view their call history.</div>';
      return;
    }

    const repName = _coachCurrentRep;
    const calls = loadHistory()
      .filter(h => {
        const lc = repName.toLowerCase();
        if (h.rep_scores) {
          try { if (JSON.parse(h.rep_scores).some(r => (r.name||'').toLowerCase() === lc)) return true; } catch {}
        }
        return (h.rep||'').toLowerCase() === lc;
      })
      .sort((a,b) => {
        const da = a.callDate || a.ts.slice(0,10), db = b.callDate || b.ts.slice(0,10);
        return da > db ? -1 : da < db ? 1 : 0;
      });

    if (!calls.length) {
      listEl.innerHTML = '<div class="coach-empty-state">No graded calls found for this rep.</div>';
      return;
    }

    listEl.innerHTML = calls.map(h => {
      const ds = h.callDate
        ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
        : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
      const repScore = (() => {
        if (h.rep_scores) {
          try {
            const rs = JSON.parse(h.rep_scores);
            const r = rs.find(r => (r.name||'').toLowerCase() === repName.toLowerCase());
            return r ? r.total : h.total;
          } catch {}
        }
        return h.total;
      })();
      const grade = h.letter_grade || '—';
      const gradeColor = grade.startsWith('A') ? 'var(--siren-grade-a)' : grade.startsWith('B') ? 'var(--siren-grade-b)' : grade.startsWith('C') ? 'var(--siren-grade-c)' : 'var(--siren-grade-d)';
      return `<div class="coach-call-card" onclick="coachSelectCall(${h.id})">
        <div class="coach-call-grade" style="color:${gradeColor};">${grade}</div>
        <div class="coach-call-info">
          <div class="coach-call-title">${escHtml(h.prospect||'Unknown')} — ${escHtml(h.stage||'')}</div>
          <div class="coach-call-sub">${ds}${repScore != null ? ' · Score: '+repScore : ''}</div>
        </div>
        <div class="coach-call-arrow">›</div>
      </div>`;
    }).join('');
  }

  window.coachSelectCall = async function(id) {
    const h = loadHistory().find(e => String(e.id) === String(id));
    if (!h) return;
    _coachFeedbackRecord = h;
    _coachFeedbackMd = '';

    // Highlight selected card
    document.querySelectorAll('.coach-call-card').forEach(c => c.classList.remove('selected'));
    const cards = document.querySelectorAll('.coach-call-card');
    cards.forEach(c => { if (c.getAttribute('onclick') === `coachSelectCall(${id})`) c.classList.add('selected'); });

    const panel = document.getElementById('coachFeedbackPanel');
    const labelEl = document.getElementById('coachFeedbackCallLabel');
    const loadEl = document.getElementById('coachFeedbackLoading');
    const bodyEl = document.getElementById('coachFeedbackBody');

    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    labelEl.textContent = `Coaching Report — ${h.prospect||'Unknown'} (${h.stage||''}) · ${ds}`;

    panel.style.display = '';
    loadEl.style.display = '';
    bodyEl.style.display = 'none';
    bodyEl.innerHTML = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Build rep-specific score data
    let repScoreData = '';
    if (h.rep_scores) {
      try {
        const rs = JSON.parse(h.rep_scores);
        const r = rs.find(r => (r.name||'').toLowerCase() === (_coachCurrentRep||'').toLowerCase());
        if (r) repScoreData = `Rep score: ${r.total}/100. Breakdown: ${Object.entries(r).filter(([k,v])=>k!=='name'&&k!=='total'&&typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(', ')}.`;
      } catch {}
    }
    if (!repScoreData && h.total) repScoreData = `Call score: ${h.total}/100 (${h.letter_grade}).`;

    // Build prior call context (last 3 calls)
    const priorCalls = loadHistory()
      .filter(e => {
        const lc = (_coachCurrentRep||'').toLowerCase();
        if (e.rep_scores) { try { if (JSON.parse(e.rep_scores).some(r=>(r.name||'').toLowerCase()===lc)) return true; } catch {} }
        return (e.rep||'').toLowerCase() === lc;
      })
      .filter(e => String(e.id) !== String(h.id))
      .sort((a,b) => (b.callDate||b.ts) > (a.callDate||a.ts) ? 1 : -1)
      .slice(0, 3);
    const priorCtx = priorCalls.length
      ? 'Prior calls: ' + priorCalls.map(e => `${e.stage||''} (${e.letter_grade} ${e.total})`).join(', ') + '.'
      : '';

    const prompt = `You are a sales coach at OneAxiom, a Houston-based MSSP. Write a personalized coaching report for ${_coachCurrentRep||'the rep'} based on this graded sales call.

Call details:
- Company: ${h.prospect||'Unknown'}
- Stage: ${h.stage||'Unknown'}
- Date: ${ds}
- ${repScoreData}
- Top strength: ${h.top_strength||'n/a'}
- Top priority area: ${h.top_priority||'n/a'}
- Overview: ${h.overview||'n/a'}
${priorCtx ? '- ' + priorCtx : ''}

Write a coaching report with these sections:
1. **Performance Summary** — 2–3 sentence summary of how this call went for ${_coachCurrentRep||'the rep'} specifically
2. **What You Did Well** — 3–4 specific behaviors to reinforce (cite the actual call data)
3. **Where to Focus** — the 2–3 highest-priority improvement areas with specific, actionable guidance
4. **Drills & Exercises** — 2–3 concrete practice exercises or role-play scenarios to address the gaps
5. **Next Call Objectives** — 3 specific things to execute on the very next call with this account

Be direct, specific, and practical. Avoid generic sales advice. Address ${_coachCurrentRep||'the rep'} directly using "you".`;

    try {
      const md = await _coachRunSteps('cfb', 4, () => _coachAsk(prompt));
      _coachStopRadar();
      _coachFeedbackMd = md;
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = _coachMd(md);
    } catch(e) {
      _coachStopRadar();
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Error: ${escHtml(e.message)}</div>`;
    }
  };

  // Start radar when loading shows
  const _origRunSteps = _coachRunSteps;

  window.coachDownloadFeedback = function() {
    if (!_coachFeedbackMd || !_coachFeedbackRecord) return;
    const h = _coachFeedbackRecord;
    const ds = h.callDate || h.ts.slice(0,10);
    _coachPrint(`Coaching Report — ${_coachCurrentRep||'Rep'} · ${h.prospect||''} · ${ds}`,
      document.getElementById('coachFeedbackBody').innerHTML);
  };

  // ── Recognition tab ───────────────────────────────────────────────────────────
  async function coachGenerateRecognition() {
    if (!_coachCurrentRep) return;
    const repName = _coachCurrentRep;

    const calls = loadHistory()
      .filter(h => {
        const lc = repName.toLowerCase();
        if (h.rep_scores) { try { if (JSON.parse(h.rep_scores).some(r=>(r.name||'').toLowerCase()===lc)) return true; } catch {} }
        return (h.rep||'').toLowerCase() === lc;
      })
      .sort((a,b) => (a.callDate||a.ts) > (b.callDate||b.ts) ? 1 : -1);

    if (!calls.length) {
      document.getElementById('coachRecogEmpty').textContent = 'No graded calls found for this rep.';
      return;
    }

    // Stats strip
    const scores = calls.map(h => {
      if (h.rep_scores) {
        try { const r = JSON.parse(h.rep_scores).find(r=>(r.name||'').toLowerCase()===repName.toLowerCase()); if (r) return r.total; } catch {}
      }
      return h.total;
    }).filter(s => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const best = scores.length ? Math.max(...scores) : null;
    const trend = scores.length >= 2
      ? (scores[scores.length-1] > scores[scores.length-2] ? '↑' : scores[scores.length-1] < scores[scores.length-2] ? '↓' : '→')
      : '—';
    const trendColor = trend === '↑' ? 'var(--siren-signal-green)' : trend === '↓' ? 'var(--siren-danger-red)' : 'var(--siren-text-muted)';

    document.getElementById('crs-calls').textContent = calls.length;
    document.getElementById('crs-avg').textContent = avg != null ? avg : '—';
    document.getElementById('crs-best').textContent = best != null ? best : '—';
    const trendEl = document.getElementById('crs-trend');
    trendEl.textContent = trend;
    trendEl.style.color = trendColor;
    document.getElementById('coachRecogStats').style.display = '';
    document.getElementById('coachRecogEmpty').style.display = 'none';

    // Loading
    const loadEl = document.getElementById('coachRecogLoading');
    const bodyEl = document.getElementById('coachRecogBody');
    loadEl.style.display = '';
    bodyEl.style.display = 'none';
    bodyEl.innerHTML = '';

    const callSummary = calls.slice(-10).map((h,i) => {
      const ds = h.callDate || h.ts.slice(0,10);
      let sc = h.total;
      if (h.rep_scores) { try { const r = JSON.parse(h.rep_scores).find(r=>(r.name||'').toLowerCase()===repName.toLowerCase()); if (r) sc = r.total; } catch {} }
      return `Call ${i+1} (${ds}, ${h.stage||'?'}): Grade ${h.letter_grade} ${sc}/100. Strength: ${h.top_strength||'n/a'}.`;
    }).join('\n');

    const prompt = `You are a sales coach at OneAxiom, a Houston-based MSSP. Write a recognition report that genuinely celebrates the strengths and growth of ${repName}.

Call history (most recent ${calls.slice(-10).length} of ${calls.length} calls):
${callSummary}
Average score: ${avg || 'n/a'}. Score trend: ${trend}.

Write a recognition report with these sections:
1. **Overall Performance** — an honest, encouraging 2–3 sentence summary of their trajectory
2. **Standout Strengths** — 3–5 specific, observable behaviors they do consistently well (cite actual data)
3. **Best Moment** — call out their highest-scoring call or a notable improvement, with specifics
4. **Growth You've Shown** — any measurable improvement in scores or patterns over time
5. **What Sets You Apart** — 2–3 qualities that make this rep valuable to the team

Be genuine and specific — not generic cheerleading. Reference actual call stages, scores, and strengths. Address ${repName} directly.`;

    try {
      const md = await _coachRunSteps('crc', 4, () => _coachAsk(prompt));
      _coachStopRadar();
      _coachRecogMd = md;
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = _coachMd(md);
    } catch(e) {
      _coachStopRadar();
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Error: ${escHtml(e.message)}</div>`;
    }
  }
  window.coachGenerateRecognition = coachGenerateRecognition;

  // ── Arena ─────────────────────────────────────────────────────────────────────

  // Wire up scenario and difficulty buttons
  document.querySelectorAll('.arena-scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.arena-scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _arenaScenario = btn.dataset.scenario;
    });
  });
  document.querySelectorAll('.arena-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.arena-diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _arenaDiff = btn.dataset.diff;
    });
  });

  const SCENARIO_LABELS = {
    objection: 'Objection Handling', closing: 'Closing', discovery: 'Discovery',
    cold: 'Cold Outreach', proposal: 'Proposal Defense', followup: 'Follow-up',
  };
  const PERSONA_LABELS = {
    ciso: 'CISO', it_director: 'IT Director', vp_ops: 'VP of Operations',
    cfo: 'CFO', sme_owner: 'SMB Owner', it_manager: 'IT Manager',
  };
  const DIFF_LABELS = { easy: 'Receptive', medium: 'Skeptical', hard: 'Resistant' };

  const SYSTEM_PROMPTS = {
    objection: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. You are ${diff} about cybersecurity solutions. The sales rep from OneAxiom (a Houston-based MSSP) is calling to discuss managed security services. Raise realistic objections a ${persona} would have — budget, timing, incumbent vendors, internal IT capability, ROI skepticism. Stay fully in character. Keep responses to 2–4 sentences. Never break character or give coaching. After the rep responds to an objection, either push back or raise a new concern depending on how convincing they were.`,
    closing: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company who has been through a full sales cycle with OneAxiom (a Houston-based MSSP). You are at the proposal stage. You are ${diff} — you have concerns but are somewhat interested. The rep is trying to close the deal. Raise realistic stalls: need to think about it, need to talk to the team, pricing concerns, timing. Stay in character. Keep responses 2–4 sentences.`,
    discovery: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. A OneAxiom (MSSP) sales rep has reached you for a discovery call. You are ${diff} and busy. Answer their questions somewhat vaguely at first — let them earn the real answers through good discovery technique. You have real pain around compliance, an aging firewall, and a recent phishing incident you haven't disclosed yet. Reveal depth only if the rep asks good questions. Stay in character. 2–4 sentences per response.`,
    cold: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company who just picked up a cold call from OneAxiom (a Houston-based MSSP). You are ${diff} and not expecting this call. React as a real executive would — guarded, slightly dismissive initially, but potentially open if the rep delivers value quickly. Stay in character. 2–4 sentences per response.`,
    proposal: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company reviewing a proposal from OneAxiom (a Houston-based MSSP). You are ${diff}. You have a competing bid from a cheaper vendor. Push back on pricing, scope, and ROI. Stay in character. 2–4 sentences per response.`,
    followup: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. OneAxiom (a Houston-based MSSP) pitched you 2 weeks ago and is following up. You've been non-responsive because you've been busy and aren't fully convinced of urgency. You are ${diff}. Respond as someone being followed up with — a bit guarded, somewhat forgetful of the details. Stay in character. 2–4 sentences per response.`,
  };

  const DIFF_DESC = { easy: 'receptive and open', medium: 'skeptical but professional', hard: 'resistant and cost-focused' };

  window.arenaStart = async function() {
    const persona = document.getElementById('arenaPersonaSel').value;
    const industry = document.getElementById('arenaIndustrySel').value;
    const personaLabel = PERSONA_LABELS[persona] || persona;
    const industryLabel = document.getElementById('arenaIndustrySel').selectedOptions[0]?.text || industry;
    const scenarioLabel = SCENARIO_LABELS[_arenaScenario];
    const diffLabel = DIFF_LABELS[_arenaDiff];
    const diffDesc = DIFF_DESC[_arenaDiff];

    _arenaMessages = [];
    _arenaFeedbackMd = '';
    _arenaRunning = true;

    // Switch views
    document.getElementById('arenaConfig').style.display = 'none';
    document.getElementById('arenaSession').style.display = '';
    document.getElementById('arenaFeedback').style.display = 'none';

    document.getElementById('arenaSessionLabel').textContent = `${scenarioLabel} · ${personaLabel}`;
    document.getElementById('arenaSessionSub').textContent = `${industryLabel} · ${diffLabel} prospect`;

    const chat = document.getElementById('arenaChat');
    chat.innerHTML = '';

    // Opening message from prospect
    const systemPrompt = (SYSTEM_PROMPTS[_arenaScenario] || SYSTEM_PROMPTS.objection)(personaLabel, industryLabel, diffDesc);
    const openingPrompt = `${systemPrompt}\n\nOpen the conversation with a brief, realistic first line as the prospect — the way you'd actually answer or respond at the start of this interaction. Don't introduce yourself with your full title unless it's natural.`;

    _arenaAddBubble('prospect', '…', 'opening');

    try {
      const opening = await _coachAsk(openingPrompt);
      _arenaMessages.push({ role: 'user', content: '[SYSTEM: ' + systemPrompt + ']' });
      _arenaMessages.push({ role: 'assistant', content: opening });
      document.getElementById('opening').querySelector('.arena-bubble-text').textContent = opening;
      document.getElementById('opening').removeAttribute('id');
    } catch(e) {
      document.getElementById('opening').querySelector('.arena-bubble-text').textContent = 'Unable to start session. Check your API key.';
    }

    document.getElementById('arenaInput').focus();
  };

  function _arenaAddBubble(role, text, id) {
    const chat = document.getElementById('arenaChat');
    const div = document.createElement('div');
    div.className = 'arena-bubble ' + (role === 'rep' ? 'arena-bubble-rep' : 'arena-bubble-prospect');
    if (id) div.id = id;
    div.innerHTML = `<div class="arena-bubble-label">${role === 'rep' ? (_coachCurrentRep || 'You') : 'Prospect'}</div><div class="arena-bubble-text">${escHtml(text)}</div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  window.arenaInputKeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); arenaSend(); }
  };

  window.arenaSend = async function() {
    if (!_arenaRunning) return;
    const input = document.getElementById('arenaInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    _arenaAddBubble('rep', text);
    _arenaMessages.push({ role: 'user', content: text });

    const btn = document.getElementById('arenaSendBtn');
    btn.disabled = true;
    const thinkingBubble = _arenaAddBubble('prospect', '…');

    try {
      // Build full conversation for Claude
      const msgs = _arenaMessages.map((m, i) => {
        if (i === 0) return null; // skip system injection
        return m;
      }).filter(Boolean);

      const systemPrompt = (_arenaMessages[0]?.content || '').replace('[SYSTEM: ','').replace(']','');
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          temperature: 0.7,
          stream: false,
          system: systemPrompt,
          messages: msgs,
        }),
      });
      if (!resp.ok) throw new Error('API error ' + resp.status);
      const data = await resp.json();
      const reply = (data.content?.[0]?.text || '').trim();
      _arenaMessages.push({ role: 'assistant', content: reply });
      thinkingBubble.querySelector('.arena-bubble-text').textContent = reply;
    } catch(e) {
      thinkingBubble.querySelector('.arena-bubble-text').textContent = '[Error: ' + e.message + ']';
    }

    btn.disabled = false;
    input.focus();
    document.getElementById('arenaChat').scrollTop = document.getElementById('arenaChat').scrollHeight;
  };

  window.arenaEnd = async function() {
    _arenaRunning = false;
    document.getElementById('arenaSession').style.display = 'none';
    document.getElementById('arenaFeedback').style.display = '';
    document.getElementById('arenaFeedbackLoading').style.display = '';
    document.getElementById('arenaFeedbackBody').style.display = 'none';

    // Build transcript
    const msgs = _arenaMessages.filter(m => !m.content.startsWith('[SYSTEM:'));
    const transcript = msgs.map((m,i) => `${m.role === 'user' ? (_coachCurrentRep||'Rep') : 'Prospect'}: ${m.content}`).join('\n\n');
    const scenarioLabel = SCENARIO_LABELS[_arenaScenario];
    const persona = document.getElementById('arenaPersonaSel').selectedOptions[0]?.text || '';
    const industry = document.getElementById('arenaIndustrySel').selectedOptions[0]?.text || '';

    const prompt = `You are a sales coach at OneAxiom, a Houston-based MSSP. Review this training session and provide a detailed debrief.

Scenario: ${scenarioLabel}
Prospect: ${persona} · ${industry} · ${DIFF_LABELS[_arenaDiff]}
Rep: ${_coachCurrentRep || 'Unknown'}

Transcript:
${transcript || 'No conversation recorded.'}

Write a debrief with these sections:
1. **Overall Performance** — score 1–10 and a 2-sentence summary of the session
2. **What You Did Well** — 2–3 specific moments or techniques that worked (cite the actual transcript)
3. **Missed Opportunities** — 2–3 specific moments where a different approach would have worked better — quote the rep's line and explain what they should have said instead
4. **Technique Analysis** — evaluate their use of: questioning, handling resistance, value articulation, and advancing the sale
5. **One Thing to Practice** — a single focused drill for this rep to work on before their next real call

Be specific — quote directly from the transcript. Address ${_coachCurrentRep||'the rep'} directly.`;

    try {
      const md = await _coachRunSteps('afb', 4, () => _coachAsk(prompt));
      _coachStopRadar();
      _arenaFeedbackMd = md;
      document.getElementById('arenaFeedbackLoading').style.display = 'none';
      document.getElementById('arenaFeedbackBody').style.display = '';
      document.getElementById('arenaFeedbackBody').innerHTML = _coachMd(md);
    } catch(e) {
      _coachStopRadar();
      document.getElementById('arenaFeedbackLoading').style.display = 'none';
      document.getElementById('arenaFeedbackBody').style.display = '';
      document.getElementById('arenaFeedbackBody').innerHTML = `<div style="color:#ef4444;font-size:13px;">Error: ${escHtml(e.message)}</div>`;
    }
  };

  window.arenaReset = function() {
    _arenaMessages = [];
    _arenaFeedbackMd = '';
    _arenaRunning = false;
    document.getElementById('arenaConfig').style.display = '';
    document.getElementById('arenaSession').style.display = 'none';
    document.getElementById('arenaFeedback').style.display = 'none';
  };

  window.arenaDownloadFeedback = function() {
    if (!_arenaFeedbackMd) return;
    const scenario = SCENARIO_LABELS[_arenaScenario];
    _coachPrint(`Training Debrief — ${_coachCurrentRep||'Rep'} · ${scenario}`,
      document.getElementById('arenaFeedbackBody').innerHTML);
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  function coachInit() {
    coachRenderRepSel();
  }
  window.coachInit = coachInit;
