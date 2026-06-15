// ── COACH MODULE ──────────────────────────────────────────────────────────────

  let _coachRaf = null;
  let _coachCurrentRep = null;
  let _coachKpiCalls = [];

  // ── Insight persistence (localStorage) ───────────────────────────────────────
  const _INSIGHT_PFX = 'siren_coach_insights_';
  function _insightKey(rep, days) {
    return _INSIGHT_PFX + (rep || '').toLowerCase().replace(/\s+/g, '_') + '_' + (days ?? 'all');
  }
  function _insightFingerprint(calls) {
    return calls.map(h => h.id).sort().join(',');
  }
  function _insightLoad(rep, days) {
    try { return JSON.parse(localStorage.getItem(_insightKey(rep, days))); } catch { return null; }
  }
  function _insightSave(rep, days, data) {
    try { localStorage.setItem(_insightKey(rep, days), JSON.stringify(data)); } catch {}
  }
  function _insightClear(rep, days) {
    localStorage.removeItem(_insightKey(rep, days));
  }
  let _coachFeedbackRecord = null;
  let _coachFeedbackMd = '';
  let _coachRecogMd = '';
  let _coachPeriodDays = 90;
  let _arenaScenario = 'objection';
  let _arenaDiff = 'medium';
  let _arenaMessages = []; // {role, content}
  let _arenaFeedbackMd = '';
  let _arenaRunning = false;
  let _arenaMode = 'free'; // 'free' | 'mc'
  let _arenaChoices = []; // MC mode: [{prospectMsg, options, chosenIdx, prospectReply, branches}]
  let _arenaMcBusy = false;

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

  const _COACH_RADAR_IDS = { cfb: 'coachFeedbackRadar', crc: 'coachRecogRadar', afb: 'arenaFeedbackRadar' };

  async function _coachRunSteps(prefix, count, apiCall) {
    if (_COACH_RADAR_IDS[prefix]) _coachStartRadar(_COACH_RADAR_IDS[prefix]);
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
  async function _coachAsk(prompt, modelKey) {
    const source = (modelKey || '').includes('arena') ? 'Coach/Range' : 'Coach/Dashboard';
    const resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        model: getDevModel(modelKey || 'coach', 'claude-sonnet-4-6'),
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

  let _cdTrendRaf = null;

  // ── Tab switching ─────────────────────────────────────────────────────────────
  function coachSwitchTab(tab) {
    document.querySelectorAll('.coach-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.coach-module').forEach(m => m.classList.remove('active'));
    document.getElementById('ctab-' + tab).classList.add('active');
    document.getElementById('cmod-' + tab).classList.add('active');
    if (tab === 'arena') _arenaApplyRoleFilter();
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

  // rep_scores arrives as a parsed array from the server; guard against raw string too
  function _parseRepScores(rs) {
    if (!rs) return [];
    if (Array.isArray(rs)) return rs;
    try { return JSON.parse(rs); } catch { return []; }
  }

  // Match a rep_scores entry to a roster name — handles cases where the graded name
  // is longer than the roster name (e.g. "Paulo Roberto Naves Veloso" vs "Paulo Veloso").
  // Exact match first, then check if every word in the shorter name appears in the longer.
  function _repNameMatch(entryName, rosterName) {
    const a = (entryName || '').toLowerCase().trim();
    const b = (rosterName || '').toLowerCase().trim();
    if (a === b) return true;
    const shorter = a.split(' ').length <= b.split(' ').length ? a : b;
    const longer  = shorter === a ? b : a;
    return shorter.split(' ').every(w => w.length > 1 && longer.includes(w));
  }

  function _coachGetRepCalls(name) {
    if (!name) return [];
    const lc = name.toLowerCase();
    const role = (loadTeam().find(m => (m.name||'').toLowerCase() === lc) || {}).role || '';
    const isIsrBdr = /\bISR\b|\bBDR\b/i.test(role);
    return loadHistory()
      .filter(h => {
        if (!isIsrBdr && /cold.outreach/i.test(h.stage || '')) return false;
        const rs = _parseRepScores(h.rep_scores);
        if (rs.length) {
          // rep_scores present — only count if this rep actually spoke and has a score
          const rsEntry = rs.find(r => _repNameMatch(r.name, name));
          return !!(rsEntry && rsEntry.total > 0);
        }
        // No rep_scores (older call) — fall back to primary rep field
        return (h.rep||'').toLowerCase().trim() === lc.trim();
      })
      .sort((a,b) => { const da = a.callDate||a.ts.slice(0,10), db = b.callDate||b.ts.slice(0,10); return da > db ? 1 : da < db ? -1 : 0; });
  }

  function _coachGetPeriodCalls(name, days) {
    const all = _coachGetRepCalls(name);
    if (!days) return all;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return all.filter(h => (h.callDate || h.ts.slice(0, 10)) >= cutoffStr);
  }

  window.coachSetPeriod = function(days) {
    _coachPeriodDays = days;
    document.querySelectorAll('.cd-period-btn').forEach(b => {
      const match = days === null ? b.textContent === 'All' : b.textContent === days + 'd';
      b.classList.toggle('cd-period-btn-active', match);
    });
    _coachRenderChips(_coachGetPeriodCalls(_coachCurrentRep, days));
    _coachRecogMd = '';
    _coachRenderOverviewPanel();
  };

  function _coachRepScore(h, repName) {
    const rs = _parseRepScores(h.rep_scores);
    const r = rs.find(r => _repNameMatch(r.name, repName));
    if (r) return r.total;
    return h.total;
  }

  function coachOnRepChange() {
    const name = document.getElementById('coachRepSel').value;
    _coachCurrentRep = name || null;
    _coachRecogMd = '';
    _coachFeedbackRecord = null;
    _coachFeedbackMd = '';

    // Meta pill
    const meta = document.getElementById('coachRepMeta');
    if (meta) {
      const calls = name ? _coachGetRepCalls(name) : [];
      meta.textContent = name ? calls.length + ' graded call' + (calls.length !== 1 ? 's' : '') : '';
    }

    coachClearCallSelection();
    coachIntelClear();
    _coachRenderDashboard();
    _coachIntelUpdateState();
    _arenaApplyRoleFilter();
  }
  window.coachOnRepChange = coachOnRepChange;

  // ── Clear call selection → show overview panel ────────────────────────────────
  window.coachClearCallSelection = function() {
    _coachStopRadar();
    _coachFeedbackRecord = null;
    _coachFeedbackMd = '';
    document.getElementById('coachFeedbackPanel').style.display = 'none';
    document.getElementById('cdOverviewPanel').style.display = '';
    document.querySelectorAll('.coach-call-card').forEach(c => c.classList.remove('selected'));
  };

  // ── Full dashboard render ─────────────────────────────────────────────────────
  function _coachRenderDashboard() {
    const calls = _coachGetRepCalls(_coachCurrentRep);
    _coachRenderKpis(calls);
    _coachRenderTrendChart(calls);
    _coachRenderStageBars(calls);
    _coachRenderChips(_coachGetPeriodCalls(_coachCurrentRep, _coachPeriodDays));
    coachRenderCallList();
    _coachRenderOverviewPanel();
  }

  // ── KPI strip ─────────────────────────────────────────────────────────────────
  function _coachRenderKpis(calls) {
    const strip = document.getElementById('cdKpiStrip');
    if (!strip) return;

    if (!calls.length || !_coachCurrentRep) {
      strip.innerHTML = ['Total Calls','Avg Score','Best Grade','Score Trend','Consistency']
        .map(lbl => `<div class="cd-kpi cd-kpi-placeholder"><div class="cd-kpi-val">—</div><div class="cd-kpi-lbl">${lbl}</div></div>`).join('');
      return;
    }

    const repName = _coachCurrentRep;
    const scores = calls.map(h => _coachRepScore(h, repName)).filter(s => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const best = scores.length ? Math.max(...scores) : null;

    // Trend: compare avg of last 3 vs prior 3
    const recent = scores.slice(-3), prior = scores.slice(-6,-3);
    const recentAvg = recent.length ? recent.reduce((a,b)=>a+b,0)/recent.length : null;
    const priorAvg  = prior.length  ? prior.reduce((a,b)=>a+b,0)/prior.length   : null;
    let trendLabel = '—', trendColor = 'var(--siren-text-muted)';
    if (recentAvg != null && priorAvg != null) {
      const delta = recentAvg - priorAvg;
      if (delta > 2)       { trendLabel = '↑ Improving';  trendColor = 'var(--siren-signal-green)'; }
      else if (delta < -2) { trendLabel = '↓ Declining';  trendColor = 'var(--siren-danger-red)'; }
      else                  { trendLabel = '→ Stable';     trendColor = 'var(--siren-text-muted)'; }
    } else if (scores.length >= 2) {
      const delta = scores[scores.length-1] - scores[0];
      if (delta > 3)       { trendLabel = '↑ Improving';  trendColor = 'var(--siren-signal-green)'; }
      else if (delta < -3) { trendLabel = '↓ Declining';  trendColor = 'var(--siren-danger-red)'; }
      else                  { trendLabel = '→ Stable';     trendColor = 'var(--siren-text-muted)'; }
    }

    // Consistency: coefficient of variation (lower = more consistent)
    let consistency = '—', consistencyColor = 'var(--siren-text-muted)';
    if (scores.length >= 3) {
      const mean = scores.reduce((a,b)=>a+b,0)/scores.length;
      const variance = scores.reduce((s,v)=>s+Math.pow(v-mean,2),0)/scores.length;
      const cv = Math.sqrt(variance) / mean;
      if (cv < 0.08)      { consistency = 'High';   consistencyColor = 'var(--siren-signal-green)'; }
      else if (cv < 0.15) { consistency = 'Medium'; consistencyColor = 'var(--siren-alert-amber)'; }
      else                { consistency = 'Low';    consistencyColor = 'var(--siren-danger-red)'; }
    }

    const avgColor = avg == null ? '' : avg >= 80 ? 'var(--siren-grade-a)' : avg >= 65 ? 'var(--siren-grade-b)' : avg >= 50 ? 'var(--siren-grade-c)' : 'var(--siren-grade-d)';
    const bestGrade = calls.reduce((best, h) => {
      const g = h.letter_grade || 'F';
      const rank = ['A+','A','A-','B+','B','B-','C+','C','C-','D','F'];
      return rank.indexOf(g) < rank.indexOf(best) ? g : best;
    }, 'F');

    strip.innerHTML = `
      <div class="cd-kpi cd-kpi-clickable" onclick="coachToggleCallList()" title="Click to view calls">
        <div class="cd-kpi-val">${calls.length}</div>
        <div class="cd-kpi-lbl">Total Calls <span style="font-size:9px;opacity:.5;">▼</span></div>
      </div>
      <div class="cd-kpi"><div class="cd-kpi-val" style="color:${avgColor};">${avg != null ? avg : '—'}</div><div class="cd-kpi-lbl">Avg Score</div></div>
      <div class="cd-kpi"><div class="cd-kpi-val">${bestGrade}</div><div class="cd-kpi-lbl">Best Grade</div></div>
      <div class="cd-kpi"><div class="cd-kpi-val" style="color:${trendColor};font-size:13px;">${trendLabel}</div><div class="cd-kpi-lbl">Score Trend</div></div>
      <div class="cd-kpi"><div class="cd-kpi-val" style="color:${consistencyColor};font-size:15px;">${consistency}</div><div class="cd-kpi-lbl">Consistency</div></div>`;

    // Store calls for the drill-down panel
    _coachKpiCalls = calls;
    const listEl = document.getElementById('cdCallList');
    if (listEl) listEl.style.display = 'none';
  }

  window.coachToggleCallList = function() {
    const listEl = document.getElementById('cdCallList');
    if (!listEl) return;
    const visible = listEl.style.display !== 'none';
    if (visible) { listEl.style.display = 'none'; return; }
    const calls = _coachKpiCalls;
    if (!calls.length) { listEl.style.display = 'none'; return; }
    const sorted = [...calls].sort((a, b) => {
      const da = a.callDate || a.ts || '';
      const db = b.callDate || b.ts || '';
      return db.localeCompare(da);
    });
    const getBg = g => g==='A+'||g==='A'||g==='A-' ? 'var(--siren-grade-a)' : g==='B+'||g==='B'||g==='B-' ? 'var(--siren-grade-b)' : g==='C+'||g==='C'||g==='C-' ? 'var(--siren-grade-c)' : 'var(--siren-grade-d)';
    listEl.innerHTML = sorted.map(h => {
      const dt = h.callDate
        ? new Date(h.callDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date(h.ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const bg = getBg(h.letter_grade);
      return `<div class="cd-call-row">
        <div class="cd-call-grade" style="background:${bg};">${escHtml(h.letter_grade)} ${escHtml(String(h.normalized_score ?? h.total))}</div>
        <div class="cd-call-info">
          <div class="cd-call-prospect">${escHtml(h.prospect || '—')}</div>
          <div class="cd-call-meta">${escHtml(h.stage || '')}${h.stage && dt ? ' · ' : ''}${escHtml(dt)}</div>
        </div>
      </div>`;
    }).join('');
    listEl.style.display = 'block';
  };

  // ── Score trend chart ─────────────────────────────────────────────────────────
  function _coachRenderTrendChart(calls) {
    const canvas = document.getElementById('cdTrendChart');
    const empty  = document.getElementById('cdChartEmpty');
    const hint   = document.getElementById('cdTrendHint');
    if (!canvas) return;

    if (!calls.length || !_coachCurrentRep) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = '';
      if (hint) hint.textContent = '';
      return;
    }

    const repName = _coachCurrentRep;
    const points = calls.map(h => ({ score: _coachRepScore(h, repName), date: h.callDate||h.ts.slice(0,10) }))
      .filter(p => p.score != null);

    if (points.length < 2) {
      canvas.style.display = 'none';
      if (empty) { empty.style.display = ''; empty.textContent = 'Not enough data for trend (need 2+ calls).'; }
      if (hint) hint.textContent = '';
      return;
    }

    if (empty) empty.style.display = 'none';
    canvas.style.display = 'block';
    // Size canvas to container
    const W = canvas.parentElement.clientWidth || 300;
    canvas.width = W;
    const H = 90;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const PAD = { l: 28, r: 12, t: 10, b: 18 };
    const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
    const minS = Math.max(0, Math.min(...points.map(p=>p.score)) - 10);
    const maxS = Math.min(100, Math.max(...points.map(p=>p.score)) + 10);
    const xOf = i => PAD.l + (i / (points.length - 1)) * iW;
    const yOf = s => PAD.t + iH - ((s - minS) / (maxS - minS)) * iH;

    // Y gridlines
    [0,50,100].forEach(v => {
      if (v < minS || v > maxS) return;
      const y = yOf(v);
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y);
      ctx.strokeStyle = 'rgba(0,200,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(0,200,255,0.3)'; ctx.font = '9px sans-serif';
      ctx.fillText(v, 2, y + 3);
    });

    // Area fill
    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + iH);
    grad.addColorStop(0, 'rgba(0,200,255,0.18)');
    grad.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(points[0].score));
    points.forEach((p,i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(p.score)); });
    ctx.lineTo(xOf(points.length-1), PAD.t + iH);
    ctx.lineTo(xOf(0), PAD.t + iH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p,i) => { i === 0 ? ctx.moveTo(xOf(0), yOf(p.score)) : ctx.lineTo(xOf(i), yOf(p.score)); });
    ctx.strokeStyle = 'rgba(0,200,255,0.8)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // Dots
    const dotPositions = points.map((p, i) => {
      const cx = xOf(i), cy = yOf(p.score);
      const color = p.score >= 80 ? '#4ade80' : p.score >= 65 ? '#00c8ff' : p.score >= 50 ? '#e8a020' : '#ef4444';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      return { cx, cy, score: p.score, date: p.date };
    });

    if (hint) hint.textContent = points.length + ' call' + (points.length !== 1 ? 's' : '');

    // Hover tooltip — reuse the same _repTip/_repTipHide from pulse.js
    const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString([], {month:'short', day:'numeric'});
    canvas.style.cursor = 'default';
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      const hit = dotPositions.find(p => Math.hypot(mx - p.cx, my - p.cy) <= 8);
      if (hit) {
        canvas.style.cursor = 'crosshair';
        _repTip(e, hit.score + ' · ' + fmtD(hit.date));
      } else {
        canvas.style.cursor = 'default';
        _repTipHide();
      }
    };
    canvas.onmouseleave = _repTipHide;
  }

  // ── Stage distribution bars ───────────────────────────────────────────────────
  function _coachRenderStageBars(calls) {
    const el = document.getElementById('cdStageBars');
    if (!el) return;
    if (!calls.length) { el.innerHTML = '<div class="cd-inner-empty">—</div>'; return; }

    const counts = {};
    const ABBREV = { 'Cold outreach':'Cold Outreach','Discovery':'Discovery','Demo / solution presentation':'Demo','Proposal / close':'Proposal','Touchpoint':'Touchpoint','Security Observability Scorecard':'Scorecard' };
    calls.forEach(h => {
      const s = ABBREV[h.stage] || h.stage || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const max = Math.max(...Object.values(counts));
    el.innerHTML = Object.entries(counts)
      .sort((a,b) => b[1] - a[1])
      .map(([stage, count]) => `
        <div class="cd-stage-row">
          <div class="cd-stage-label">${escHtml(stage)}</div>
          <div class="cd-stage-bar-wrap">
            <div class="cd-stage-bar" style="width:${Math.round(count/max*100)}%"></div>
          </div>
          <div class="cd-stage-count">${count}</div>
        </div>`).join('');
  }

  // ── Strength & focus panels ───────────────────────────────────────────────────
  function _coachRenderChips(calls, forceRegen) {
    const sEl = document.getElementById('cdStrengthChips');
    const fEl = document.getElementById('cdFocusChips');
    const repNameLc = (_coachCurrentRep || '').toLowerCase();
    const fingerprint = _insightFingerprint(calls);

    // Restore from localStorage if fingerprint matches and not forcing regen
    if (!forceRegen) {
      const saved = _insightLoad(_coachCurrentRep, _coachPeriodDays);
      if (saved && saved.fingerprint === fingerprint) {
        if (sEl) sEl.innerHTML = saved.strengthsHtml;
        if (fEl) fEl.innerHTML = saved.focusHtml;
        return;
      }
    }

    const positives = [], improvements = [];
    calls.forEach(h => {
      const rs = _parseRepScores(h.rep_scores);
      const repEntry = rs.find(r => _repNameMatch(r.name, _coachCurrentRep));
      const cs = repEntry && repEntry.call_summary;
      if (cs) {
        (cs.positives || []).forEach(s => { if (s) positives.push(s.trim()); });
        (cs.improvements || []).forEach(s => { if (s) improvements.push(s.trim()); });
      }
    });

    // Rep name and role for personalised prompts
    const repName = _coachCurrentRep || 'this rep';
    const repFirstName = repName.split(' ')[0];
    const lc = repName.toLowerCase();
    const repRole = (loadTeam().find(m => (m.name||'').toLowerCase() === lc) || {}).role || '';
    const roleCtx = repRole ? ` ${repName} is a ${repRole}.` : '';

    // Deduplicate by normalised prefix (first 40 chars lowercased)
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(s => {
        const key = s.toLowerCase().slice(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);
    };

    // Accumulator — saved once both sections finish
    const pending = { fingerprint, strengthsHtml: '', focusHtml: '', done: 0 };
    const maybeSave = () => {
      pending.done++;
      if (pending.done === 2) _insightSave(_coachCurrentRep, _coachPeriodDays, pending);
    };

    const renderList = (el, items, colorVar) => {
      if (!el) return;
      if (!items.length) { el.innerHTML = '<div class="cd-inner-empty">—</div>'; return; }
      el.innerHTML = `<ul class="cd-insight-list" style="--insight-color:${colorVar};">${
        items.map(s => `<li>${escHtml(s)}</li>`).join('')
      }</ul>`;
    };

    // Focus areas: rephrase raw improvement notes as genuine development areas via AI
    const dedupedImprovements = dedup(improvements);
    if (!dedupedImprovements.length) {
      const html = '<div class="cd-inner-empty">—</div>';
      if (fEl) fEl.innerHTML = html;
      pending.focusHtml = html;
      maybeSave();
    } else {
      if (fEl) fEl.innerHTML = '<div class="cd-insight-loading" style="--insight-color:#e8a020;"><div class="cd-insight-bar"></div><span>Analyzing focus areas…</span></div>';
      _coachAsk(
        `You are a sales coach summarizing ${repName}'s reoccurring development areas.${roleCtx} Convert each observation into one concise sentence describing a skill or behavior ${repFirstName} consistently needs to improve — framed as a genuine area for growth, not a directive. Write as if describing what ${repFirstName} tends to struggle with or overlook, keeping their role as a ${repRole||'sales rep'} in mind. Do not use imperative verbs like "do" or "make sure". No references to specific deals, prospects, or names.\n\nObservations:\n${dedupedImprovements.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nReturn ONLY a numbered list in the same order. Nothing else.`,
        'coach_focus'
      ).then(raw => {
        const lines = raw.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean).slice(0, 6);
        renderList(fEl, lines, '#e8a020');
      }).catch(() => {
        renderList(fEl, dedupedImprovements, '#e8a020');
      }).finally(() => {
        pending.focusHtml = fEl ? fEl.innerHTML : '';
        maybeSave();
      });
    }

    // Strengths: rephrase raw observations as genuine capabilities via AI
    const dedupedPositives = dedup(positives);
    if (!dedupedPositives.length) {
      const html = '<div class="cd-inner-empty">—</div>';
      if (sEl) sEl.innerHTML = html;
      pending.strengthsHtml = html;
      maybeSave();
      return;
    }
    if (sEl) sEl.innerHTML = '<div class="cd-insight-loading" style="--insight-color:#4ade80;"><div class="cd-insight-bar"></div><span>Analyzing strengths…</span></div>';
    _coachAsk(
      `You are a sales coach summarizing ${repName}'s reoccurring strengths.${roleCtx} Convert each observation into one concise sentence describing a skill or behavior ${repFirstName} consistently demonstrates well — framed as a genuine strength, not a recommendation. Write as if describing what ${repFirstName} is naturally good at in their role as a ${repRole||'sales rep'}. Do not use future tense or action verbs like "continue" or "keep". No references to specific deals, prospects, or names.\n\nObservations:\n${dedupedPositives.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nReturn ONLY a numbered list in the same order. Nothing else.`,
      'coach_strengths'
    ).then(raw => {
      const lines = raw.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean).slice(0, 6);
      renderList(sEl, lines, '#4ade80');
    }).catch(() => {
      renderList(sEl, dedupedPositives, '#4ade80');
    }).finally(() => {
      pending.strengthsHtml = sEl ? sEl.innerHTML : '';
      maybeSave();
    });
  }

  // Manual regeneration — clears saved cache for current rep/period and re-runs
  window.coachRefreshInsights = function() {
    _insightClear(_coachCurrentRep, _coachPeriodDays);
    _coachRenderChips(_coachGetPeriodCalls(_coachCurrentRep, _coachPeriodDays), true);
  };

  // ── Overview panel (right side, no call selected) ────────────────────────────
  function _coachRenderOverviewPanel() {
    const periodRow = document.getElementById('cdPeriodRow');
    const emptyEl = document.getElementById('coachRecogEmpty');
    const bodyEl  = document.getElementById('coachRecogBody');

    if (!_coachCurrentRep) {
      if (periodRow) periodRow.style.display = 'none';
      if (emptyEl) { emptyEl.style.display = ''; emptyEl.querySelector('.cd-overview-placeholder-sub').textContent = 'Select a rep to view their coaching dashboard.'; }
      if (bodyEl) { bodyEl.style.display = 'none'; bodyEl.innerHTML = ''; }
      _coachRecogMd = '';
      return;
    }

    if (periodRow) periodRow.style.display = '';
    if (_coachRecogMd) {
      if (emptyEl) emptyEl.style.display = 'none';
      if (bodyEl) { bodyEl.style.display = ''; bodyEl.innerHTML = _coachMd(_coachRecogMd); }
    } else {
      if (emptyEl) {
        emptyEl.style.display = '';
        const sub = emptyEl.querySelector('.cd-overview-placeholder-sub');
        if (sub) sub.textContent = 'Choose a time period above, then click Generate to create a coaching report synthesized from all calls in that window.';
      }
      if (bodyEl) { bodyEl.style.display = 'none'; }
    }
  }

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
        const rs = _parseRepScores(h.rep_scores);
        const rsEntry = rs.find(r => _repNameMatch(r.name, name));
        if (rsEntry) return rsEntry.total > 0;
        return (h.rep||'').toLowerCase().trim() === lc.trim();
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
            const r = rs.find(r => _repNameMatch(r.name, repName));
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
    document.querySelectorAll('.coach-call-card').forEach(c => {
      if (c.getAttribute('onclick') === `coachSelectCall(${id})`) c.classList.add('selected');
    });

    const panel  = document.getElementById('coachFeedbackPanel');
    const labelEl = document.getElementById('coachFeedbackCallLabel');
    const loadEl  = document.getElementById('coachFeedbackLoading');
    const bodyEl  = document.getElementById('coachFeedbackBody');

    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    labelEl.textContent = `Coaching Report — ${h.prospect||'Unknown'} (${h.stage||''}) · ${ds}`;

    // Swap panels: hide overview, show coaching
    document.getElementById('cdOverviewPanel').style.display = 'none';
    panel.style.display = '';
    loadEl.style.display = 'none';
    bodyEl.style.display = '';
    bodyEl.innerHTML = '<div class="coach-transcript-loading">Checking for transcript…</div>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Try to auto-match transcript by history ID
    let transcriptText = '';
    let transcriptLabel = '';
    try {
      const tResp = await fetch('/api/transcripts/' + h.id);
      if (tResp.ok) {
        const tData = await tResp.json();
        transcriptText = (tData.transcript || '').trim();
        transcriptLabel = tData.label || '';
      }
    } catch {}

    if (transcriptText) {
      // Auto-matched — show confirmation badge and generate immediately
      bodyEl.innerHTML = `<div class="coach-transcript-badge">
        <span class="coach-transcript-badge-icon">&#10003;</span>
        Transcript found: <strong>${escHtml(transcriptLabel||'Saved transcript')}</strong>
        <button class="coach-transcript-swap-btn" onclick="coachSwapTranscript()">Use a different transcript</button>
      </div>`;
      await _coachGenerateFeedback(h, transcriptText, ds);
    } else {
      // No auto-match — show transcript picker
      await _coachShowTranscriptPicker(h, ds);
    }
  };

  async function _coachShowTranscriptPicker(h, ds) {
    const bodyEl = document.getElementById('coachFeedbackBody');

    // Fetch all saved transcripts for the picker
    let allTranscripts = [];
    try {
      const resp = await fetch('/api/transcripts');
      if (resp.ok) allTranscripts = await resp.json();
    } catch {}

    const optionsHtml = allTranscripts.length
      ? allTranscripts.map(t => {
          const date = t.call_date || t.saved_at?.slice(0,10) || '';
          const label = [t.label, t.prospect, date].filter(Boolean).join(' · ');
          return `<option value="${escHtml(String(t.id))}">${escHtml(label)}</option>`;
        }).join('')
      : '<option value="" disabled>No saved transcripts found</option>';

    bodyEl.innerHTML = `
      <div class="coach-transcript-picker">
        <div class="coach-transcript-picker-icon">&#9741;</div>
        <div class="coach-transcript-picker-title">No transcript on file for this call</div>
        <div class="coach-transcript-picker-sub">Select a saved transcript to enable quote-level coaching, or generate using scores only.</div>
        <div class="coach-transcript-picker-row">
          <select id="coachTranscriptPickerSel" class="coach-transcript-picker-sel">
            <option value="">— Select a transcript —</option>
            ${optionsHtml}
          </select>
          <button class="coach-transcript-picker-btn" onclick="coachUseSelectedTranscript()">Use This Transcript</button>
        </div>
        <button class="coach-transcript-skip-btn" onclick="coachSkipTranscript()">Generate without transcript (scores only)</button>
      </div>`;
  }

  window.coachUseSelectedTranscript = async function() {
    const sel = document.getElementById('coachTranscriptPickerSel');
    if (!sel || !sel.value) return;
    const h = _coachFeedbackRecord;
    if (!h) return;

    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});

    const bodyEl = document.getElementById('coachFeedbackBody');
    bodyEl.innerHTML = '<div class="coach-transcript-loading">Loading transcript…</div>';

    let transcriptText = '';
    let transcriptLabel = '';
    try {
      const resp = await fetch('/api/transcripts/' + encodeURIComponent(sel.value));
      if (resp.ok) {
        const data = await resp.json();
        transcriptText = (data.transcript || '').trim();
        transcriptLabel = data.label || '';
      }
    } catch {}

    if (!transcriptText) {
      bodyEl.innerHTML = '<div style="color:#ef4444;font-size:13px;">Could not load transcript. Try another.</div>';
      return;
    }

    bodyEl.innerHTML = `<div class="coach-transcript-badge">
      <span class="coach-transcript-badge-icon">&#10003;</span>
      Using: <strong>${escHtml(transcriptLabel||'Selected transcript')}</strong>
      <button class="coach-transcript-swap-btn" onclick="coachSwapTranscript()">Change</button>
    </div>`;
    await _coachGenerateFeedback(h, transcriptText, ds);
  };

  window.coachSkipTranscript = async function() {
    const h = _coachFeedbackRecord;
    if (!h) return;
    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    document.getElementById('coachFeedbackBody').innerHTML = '';
    await _coachGenerateFeedback(h, '', ds);
  };

  window.coachSwapTranscript = async function() {
    const h = _coachFeedbackRecord;
    if (!h) return;
    const ds = h.callDate
      ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    _coachStopRadar();
    document.getElementById('coachFeedbackLoading').style.display = 'none';
    document.getElementById('coachFeedbackBody').style.display = '';
    await _coachShowTranscriptPicker(h, ds);
  };

  async function _coachGenerateFeedback(h, transcriptText, ds) {
    const loadEl = document.getElementById('coachFeedbackLoading');
    const bodyEl = document.getElementById('coachFeedbackBody');

    // Keep any badge already rendered, then show loading below it
    const existingBadge = bodyEl.innerHTML;
    loadEl.style.display = '';
    bodyEl.style.display = 'none';

    // Build rep-specific score data
    let repScoreData = '';
    {
      const rs = _parseRepScores(h.rep_scores);
      const r = rs.find(r => _repNameMatch(r.name, _coachCurrentRep));
      if (r) repScoreData = `Rep score: ${r.total}/100. Breakdown: ${Object.entries(r).filter(([k,v])=>k!=='name'&&k!=='total'&&typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(', ')}.`;
    }
    if (!repScoreData && h.total) repScoreData = `Call score: ${h.total}/100 (${h.letter_grade}).`;

    // Build prior call context (last 3 calls)
    const priorCalls = loadHistory()
      .filter(e => {
        const lc = (_coachCurrentRep||'').toLowerCase();
        const rs = _parseRepScores(e.rep_scores);
        const rsEntry = rs.find(r=>(r.name||'').toLowerCase()===lc);
        if (rsEntry) return rsEntry.total > 0;
        return (e.rep||'').toLowerCase().trim() === lc.trim();
      })
      .filter(e => String(e.id) !== String(h.id))
      .sort((a,b) => (b.callDate||b.ts) > (a.callDate||a.ts) ? 1 : -1)
      .slice(0, 3);
    const priorCtx = priorCalls.length
      ? 'Prior calls: ' + priorCalls.map(e => `${e.stage||''} (${e.letter_grade} ${e.total})`).join(', ') + '.'
      : '';

    const hasTranscript = transcriptText.length > 0;
    const prompt = `You are a sales coach. Write a personalized coaching report for ${_coachCurrentRep||'the rep'} based on this graded sales call.

Call details:
- Company: ${h.prospect||'Unknown'}
- Stage: ${h.stage||'Unknown'}
- Date: ${ds}
- ${repScoreData}
- Top strength: ${h.top_strength||'n/a'}
- Top priority area: ${h.top_priority||'n/a'}
- Overview: ${h.overview||'n/a'}
${priorCtx ? '- ' + priorCtx : ''}
${hasTranscript ? `
Full call transcript:
"""
${transcriptText}
"""

IMPORTANT: You have the full transcript above. Quote specific lines from ${_coachCurrentRep||'the rep'} verbatim when giving feedback. Point to exact moments — the actual words they used — rather than speaking in generalities. When identifying what worked or what to improve, always cite the specific exchange.` : ''}

Write a coaching report with these sections:
1. **Performance Summary** — 2–3 sentence summary of how this call went for ${_coachCurrentRep||'the rep'} specifically
2. **What You Did Well** — 3–4 specific behaviors to reinforce${hasTranscript ? ', each anchored to a direct quote from the transcript' : ' (cite the actual call data)'}
3. **Where to Focus** — the 2–3 highest-priority improvement areas with specific, actionable guidance${hasTranscript ? '; for each, quote what was said and show what a better response would have looked like' : ''}
4. **Drills & Exercises** — 2–3 concrete practice exercises or role-play scenarios to address the gaps
5. **Next Call Objectives** — 3 specific things to execute on the very next call with this account

Be direct, specific, and practical. Avoid generic sales advice. Address ${_coachCurrentRep||'the rep'} directly using "you".`;

    try {
      const md = await _coachRunSteps('cfb', 4, () => _coachAsk(prompt, 'coach_feedback'));
      _coachStopRadar();
      _coachFeedbackMd = md;
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = existingBadge + _coachMd(md);
    } catch(e) {
      _coachStopRadar();
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Error: ${escHtml(e.message)}</div>`;
    }
  }

  window.coachDownloadFeedback = function() {
    if (!_coachFeedbackMd || !_coachFeedbackRecord) return;
    const h = _coachFeedbackRecord;
    const ds = h.callDate || h.ts.slice(0,10);
    _coachPrint(`Coaching Report — ${_coachCurrentRep||'Rep'} · ${h.prospect||''} · ${ds}`,
      document.getElementById('coachFeedbackBody').innerHTML);
  };

  // ── Coaching Report generation (multi-call synthesis) ────────────────────────
  async function coachGenerateRecognition() {
    if (!_coachCurrentRep) return;
    const repName = _coachCurrentRep;
    const days = _coachPeriodDays;

    const calls = _coachGetPeriodCalls(repName, days);
    if (!calls.length) {
      const emptyEl = document.getElementById('coachRecogEmpty');
      if (emptyEl) {
        emptyEl.style.display = '';
        const sub = emptyEl.querySelector('.cd-overview-placeholder-sub');
        if (sub) sub.textContent = days ? `No graded calls found in the last ${days} days.` : 'No graded calls found for this rep.';
      }
      return;
    }

    // Loading
    const loadEl = document.getElementById('coachRecogLoading');
    const bodyEl = document.getElementById('coachRecogBody');
    document.getElementById('coachRecogEmpty').style.display = 'none';
    loadEl.style.display = '';
    bodyEl.style.display = 'none';
    bodyEl.innerHTML = '';

    // --- Build aggregate context ---
    const lc = repName.toLowerCase();

    // Calls sorted oldest → newest (already sorted that way by _coachGetRepCalls)
    const scores = calls.map(h => _coachRepScore(h, repName));
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);

    // Dimension averages across all calls
    const dimTotals = {}, dimCounts = {};
    calls.forEach(h => {
      const r = _parseRepScores(h.rep_scores).find(r=>(r.name||'').toLowerCase()===lc);
      if (!r) return;
      Object.entries(r).forEach(([k,v]) => {
        if (k === 'name' || k === 'total' || typeof v !== 'number') return;
        dimTotals[k] = (dimTotals[k]||0) + v;
        dimCounts[k] = (dimCounts[k]||0) + 1;
      });
    });
    const dimAvgs = Object.keys(dimTotals).map(k => `${k}: ${Math.round(dimTotals[k]/dimCounts[k])}`).join(', ');

    // Strength / focus frequency
    const tallyField = field => {
      const map = {};
      calls.forEach(h => { const v=(h[field]||'').trim(); if(v) map[v]=(map[v]||0)+1; });
      return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([l,c])=>`${l} (${c}x)`).join(', ');
    };
    const strengthFreq = tallyField('top_strength');
    const priorityFreq = tallyField('top_priority');

    // Per-call summary lines
    const callLines = calls.map((h,i) => {
      const ds = h.callDate || h.ts.slice(0,10);
      const sc = _coachRepScore(h, repName);
      return `  Call ${i+1} | ${ds} | ${h.stage||'?'} | ${sc}/100 (${h.letter_grade||'?'}) | Strength: ${h.top_strength||'n/a'} | Priority: ${h.top_priority||'n/a'}`;
    }).join('\n');

    // Progress split: older half vs newer half (need ≥4 calls)
    let progressCtx = '';
    if (calls.length >= 4) {
      const mid = Math.ceil(calls.length / 2);
      const older = calls.slice(0, mid);
      const newer = calls.slice(mid);
      const oldAvg = Math.round(older.map(h=>_coachRepScore(h,repName)).reduce((a,b)=>a+b,0)/older.length);
      const newAvg = Math.round(newer.map(h=>_coachRepScore(h,repName)).reduce((a,b)=>a+b,0)/newer.length);
      const oldPri = tallyFieldOn(older, 'top_priority');
      const newStr = tallyFieldOn(newer, 'top_strength');
      progressCtx = `
PROGRESS SPLIT (older ${older.length} calls avg ${oldAvg} → newer ${newer.length} calls avg ${newAvg}):
- Top priorities flagged in older calls: ${oldPri}
- Top strengths showing in newer calls: ${newStr}
Use this to determine whether the rep has started addressing previously flagged areas.`;
    }

    const periodLabel = days ? `last ${days} days` : 'all time';
    const prompt = `You are a sales coach. Write a coaching report for ${repName} synthesized from ${calls.length} graded calls over the ${periodLabel}.

CALL DATA (oldest to newest):
${callLines}

AGGREGATE METRICS:
- Average score: ${avg}/100
- Dimension averages: ${dimAvgs || 'n/a'}
- Most frequent strengths: ${strengthFreq || 'n/a'}
- Most frequent focus areas: ${priorityFreq || 'n/a'}
${progressCtx}

Write a coaching report with these sections:
1. **Performance Summary** — 2–3 sentences on ${repName}'s overall trajectory in this period. Reference the score range and trend.
2. **Consistent Strengths** — 3–4 behaviors that appear repeatedly across calls. Reference call stages, dates, or scores to anchor each point — do NOT quote transcripts verbatim.
3. **Recurring Focus Areas** — the 2–3 issues that keep appearing across multiple calls, with specific and actionable guidance for each.
${calls.length >= 4 ? `4. **Progress Check** — Based on the older vs newer call split, has ${repName} started implementing feedback on previously flagged areas? Be specific about what has improved and what still needs work.
5. **Priority Actions** — 3 concrete things to focus on in the next calls.` : `4. **Priority Actions** — 3 concrete things to focus on in the next calls.`}

Write in second person ("you"), be direct and specific, and base all feedback on patterns across multiple calls — not isolated incidents or direct quotes.`;

    try {
      const md = await _coachRunSteps('crc', 4, () => _coachAsk(prompt, 'coach_report'));
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

  function tallyFieldOn(calls, field) {
    const map = {};
    calls.forEach(h => { const v=(h[field]||'').trim(); if(v) map[v]=(map[v]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([l,c])=>`${l} (${c}x)`).join(', ') || 'n/a';
  }

  // ── Arena role-based scenario filter ─────────────────────────────────────────

  function _arenaRoleScenarios(roleStr) {
    const r = (roleStr || '').toLowerCase();
    // Executive / leadership — strategic, no cold calling
    if (/\b(cro|cso|ceo|coo|cmo|cto|chief|president|svp|evp|vp\b|vice\s*pres|director|head\s+of|sales\s*manager|revenue\s*officer)\b/.test(r)) {
      return { allowed: ['objection','closing','proposal','followup'], note: 'Cold Outreach and Discovery filtered — not typical for this role.' };
    }
    // Solutions / Sales Engineer — technical support role, no cold outreach
    if (/\b(se\b|solutions\s*(engineer|architect|consult)|sales\s*engineer|technical\s*(advisor|sales)|pre[\s-]?sales|presales)\b/.test(r)) {
      return { allowed: ['objection','discovery','proposal','followup'], note: 'Cold Outreach and Closing filtered — SEs support, not initiate or close.' };
    }
    // Customer Success — post-sale, no cold outreach
    if (/\b(csm|customer\s*success|cs\b|success\s*manager|renewal|retention)\b/.test(r)) {
      return { allowed: ['objection','discovery','followup'], note: 'Cold Outreach, Closing, and Proposal Defense filtered for this role.' };
    }
    // Account Manager — existing accounts, no cold outreach
    if (/\b(account\s*manager|am\b)\b/.test(r)) {
      return { allowed: ['objection','closing','discovery','proposal','followup'], note: 'Cold Outreach filtered — Account Managers work existing accounts.' };
    }
    // SDR / BDR — top of funnel, no closing or proposal
    if (/\b(sdr|bdr|sales\s*dev|business\s*dev|outbound|inbound|lead\s*gen|prospecting)\b/.test(r)) {
      return { allowed: ['cold','objection','discovery','followup'], note: 'Closing and Proposal Defense filtered — typically handled by AEs.' };
    }
    // AE and default — all scenarios
    return { allowed: ['objection','closing','discovery','cold','proposal','followup'], note: '' };
  }

  window.arenaSetMode = function(mode, btn) {
    _arenaMode = mode;
    document.querySelectorAll('.arena-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const desc = document.getElementById('arenaModeDesc');
    if (desc) desc.textContent = mode === 'mc'
      ? 'Pick from three response options — see how each choice branches the conversation.'
      : 'Type your own responses freely — most realistic practice.';
  };

  function _arenaApplyRoleFilter() {
    const team = loadTeam();
    const member = _coachCurrentRep ? team.find(m => m.name === _coachCurrentRep) : null;
    const { allowed, note } = _arenaRoleScenarios(member ? member.role : '');

    document.querySelectorAll('.arena-scenario-btn').forEach(btn => {
      const scenario = btn.dataset.scenario;
      const visible = allowed.includes(scenario);
      btn.style.display = visible ? '' : 'none';
      if (!visible && btn.classList.contains('active')) {
        btn.classList.remove('active');
      }
    });

    // Ensure something is active
    const activeBtn = document.querySelector('.arena-scenario-btn.active');
    if (!activeBtn || activeBtn.style.display === 'none') {
      const first = document.querySelector('.arena-scenario-btn:not([style*="display: none"]):not([style*="display:none"])');
      if (first) { first.classList.add('active'); _arenaScenario = first.dataset.scenario; }
    }

    const noteEl = document.getElementById('arenaRoleNote');
    if (noteEl) {
      noteEl.textContent = note;
      noteEl.style.display = note ? '' : 'none';
    }
  }

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
    objection: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. You are ${diff} about cybersecurity solutions. The sales rep is calling to discuss managed security services. Raise realistic objections a ${persona} would have — budget, timing, incumbent vendors, internal IT capability, ROI skepticism. Stay fully in character. Keep responses to 2–4 sentences. Never break character or give coaching. After the rep responds to an objection, either push back or raise a new concern depending on how convincing they were.`,
    closing: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company who has been through a full sales cycle with your company. You are at the proposal stage. You are ${diff} — you have concerns but are somewhat interested. The rep is trying to close the deal. Raise realistic stalls: need to think about it, need to talk to the team, pricing concerns, timing. Stay in character. Keep responses 2–4 sentences.`,
    discovery: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. A your company sales rep has reached you for a discovery call. You are ${diff} and busy. Answer their questions somewhat vaguely at first — let them earn the real answers through good discovery technique. You have real pain around compliance, an aging firewall, and a recent phishing incident you haven't disclosed yet. Reveal depth only if the rep asks good questions. Stay in character. 2–4 sentences per response.`,
    cold: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company who just picked up a cold call from your company. You are ${diff} and not expecting this call. React as a real executive would — guarded, slightly dismissive initially, but potentially open if the rep delivers value quickly. Stay in character. 2–4 sentences per response.`,
    proposal: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company reviewing a proposal from your company. You are ${diff}. You have a competing bid from a cheaper vendor. Push back on pricing, scope, and ROI. Stay in character. 2–4 sentences per response.`,
    followup: (persona, industry, diff) => `You are playing ${persona} at a ${industry} company. your company pitched you 2 weeks ago and is following up. You've been non-responsive because you've been busy and aren't fully convinced of urgency. You are ${diff}. Respond as someone being followed up with — a bit guarded, somewhat forgetful of the details. Stay in character. 2–4 sentences per response.`,
  };

  const DIFF_DESC = { easy: 'receptive and open', medium: 'skeptical but professional', hard: 'resistant and cost-focused' };

  // Collect real objection context from the current rep's graded calls
  function _arenaRealObjectionContext() {
    if (!_coachCurrentRep) return '';
    const lc = _coachCurrentRep.toLowerCase();
    const calls = _coachGetRepCalls(_coachCurrentRep).slice(0, 10); // most recent 10
    const objFeedback = [], improvements = [], missed = [];

    calls.forEach(h => {
      const rs = _parseRepScores(h.rep_scores);
      const repEntry = rs.find(r => _repNameMatch(r.name, name));
      // Per-rep dimension feedback for objection handling
      if (repEntry && Array.isArray(repEntry.dimensions)) {
        repEntry.dimensions.forEach(d => {
          if (/objection|empathy/i.test(d.name) && d.feedback) objFeedback.push(d.feedback.trim());
        });
        const cs = repEntry.call_summary;
        if (cs) {
          (cs.improvements || []).forEach(s => { if (s) improvements.push(s.trim()); });
          (cs.missed     || []).forEach(s => { if (s) missed.push(s.trim()); });
        }
      }
      // Fall back to top-level call dimensions if no rep_scores match
      if (!repEntry && Array.isArray(h.dimensions)) {
        h.dimensions.forEach(d => {
          if (/objection|empathy/i.test(d.name) && d.feedback) objFeedback.push(d.feedback.trim());
        });
      }
    });

    // Deduplicate by first 60 chars
    const dedup = arr => {
      const seen = new Set();
      return arr.filter(s => { const k=s.slice(0,60).toLowerCase(); if(seen.has(k))return false; seen.add(k); return true; });
    };

    const objLines   = dedup(objFeedback).slice(0, 4);
    const imprvLines = dedup(improvements).slice(0, 3);
    const missLines  = dedup(missed).slice(0, 3);

    if (!objLines.length && !imprvLines.length && !missLines.length) return '';

    const parts = [];
    if (objLines.length)  parts.push(`Objection handling observations from past calls:\n${objLines.map((s,i)=>`${i+1}. ${s}`).join('\n')}`);
    if (imprvLines.length) parts.push(`Areas this rep has been coached to improve:\n${imprvLines.map((s,i)=>`- ${s}`).join('\n')}`);
    if (missLines.length)  parts.push(`Missed opportunities noted in past calls:\n${missLines.map((s,i)=>`- ${s}`).join('\n')}`);

    return `\n\nREAL CALL CONTEXT — base the objections and pushback in this session on themes from ${_coachCurrentRep}'s actual call history. Adapt these themes naturally into your persona — do not quote them verbatim:\n${parts.join('\n\n')}`;
  }

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
    _arenaChoices = [];
    _arenaMcBusy = false;
    _arenaRunning = true;

    // Switch views
    document.getElementById('arenaConfig').style.display = 'none';
    const sessionEl = document.getElementById('arenaSession');
    sessionEl.style.display = '';
    sessionEl.classList.toggle('arena-session--mc', _arenaMode === 'mc');
    document.getElementById('arenaFeedback').style.display = 'none';
    document.getElementById('arenaMcOptions').style.display = 'none';
    document.getElementById('arenaMcOptions').innerHTML = '';

    document.getElementById('arenaSessionLabel').textContent = `${scenarioLabel} · ${personaLabel}`;
    document.getElementById('arenaSessionSub').textContent = `${industryLabel} · ${diffLabel} prospect · ${_arenaMode === 'mc' ? 'Pick Best Option' : 'Free Response'}`;

    const chat = document.getElementById('arenaChat');
    chat.innerHTML = '';

    // Opening message from prospect
    const realCtx = _arenaRealObjectionContext();
    const systemPrompt = (SYSTEM_PROMPTS[_arenaScenario] || SYSTEM_PROMPTS.objection)(personaLabel, industryLabel, diffDesc) + realCtx;
    const openingPrompt = `${systemPrompt}\n\nOpen the conversation with a brief, realistic first line as the prospect — the way you'd actually answer or respond at the start of this interaction. Don't introduce yourself with your full title unless it's natural.`;

    _arenaAddBubble('prospect', '…', 'opening');

    try {
      const opening = await _coachAsk(openingPrompt, 'coach_arena');
      _arenaMessages.push({ role: 'user', content: '[SYSTEM: ' + systemPrompt + ']' });
      _arenaMessages.push({ role: 'assistant', content: opening });
      document.getElementById('opening').querySelector('.arena-bubble-text').textContent = opening;
      document.getElementById('opening').removeAttribute('id');
      if (_arenaMode === 'mc') {
        await _arenaMcGenerateOptions(opening);
      } else {
        document.getElementById('arenaInput').focus();
      }
    } catch(e) {
      document.getElementById('opening').querySelector('.arena-bubble-text').textContent = 'Unable to start session. Check your API key.';
    }
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
          source: 'Coach/Range',
          model: getDevModel('coach_arena', 'claude-sonnet-4-6'),
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

  // ── MC mode helpers ───────────────────────────────────────────────────────────

  async function _arenaMcGenerateOptions(prospectMsg) {
    if (_arenaMcBusy) return;
    _arenaMcBusy = true;
    const wrap = document.getElementById('arenaMcOptions');
    wrap.innerHTML = '<div class="arena-mc-loading"><span class="load-blink">●</span> Generating options…</div>';
    wrap.style.display = '';

    const history = _arenaMessages.filter(m => !m.content.startsWith('[SYSTEM:')).map(m =>
      `${m.role === 'user' ? (_coachCurrentRep || 'Rep') : 'Prospect'}: ${m.content}`
    ).join('\n');

    const prompt = `You are helping train a sales rep in a role-play. Based on the conversation so far, generate exactly 3 response options the rep could say next.
- Option A: strong, effective response using good technique
- Option B: decent but imperfect — misses something or is too vague
- Option C: weak or counterproductive — a common mistake reps make

Conversation so far:
${history}

Return ONLY a JSON array, no other text:
[{"quality":"strong","label":"A","text":"..."},{"quality":"decent","label":"B","text":"..."},{"quality":"weak","label":"C","text":"..."}]

Each option must be under 50 words. Make them meaningfully different in approach. No meta-commentary.`;

    try {
      const raw = await _coachAsk(prompt, 'coach_arena');
      const match = raw.match(/\[[\s\S]*?\]/);
      const options = match ? JSON.parse(match[0]) : null;
      if (!options || !options.length) throw new Error('parse failed');
      _arenaChoices.push({ prospectMsg, options, chosenIdx: null, prospectReply: null, branches: null });
      _arenaMcRenderOptions(options);
    } catch(e) {
      wrap.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:12px;">Could not generate options — try ending and starting a new session.</div>';
    }
    _arenaMcBusy = false;
  }

  function _arenaMcRenderOptions(options) {
    const qualClass  = { strong: 'arena-mc-opt--strong', decent: 'arena-mc-opt--decent', weak: 'arena-mc-opt--weak' };
    const qualLabel  = { strong: 'Strong',               decent: 'Decent',               weak: 'Risky'              };
    const wrap = document.getElementById('arenaMcOptions');
    wrap.innerHTML = `
      <div class="arena-mc-label">Choose your response:</div>
      <div class="arena-mc-opts">
        ${options.map((o, i) => `
          <button class="arena-mc-opt ${qualClass[o.quality] || ''}" onclick="arenaMcChoose(${i})">
            <span class="arena-mc-opt-letter">${o.label || String.fromCharCode(65 + i)}</span>
            <span class="arena-mc-opt-text">${escHtml(o.text)}</span>
          </button>`).join('')}
      </div>`;
    wrap.style.display = '';
    document.getElementById('arenaChat').scrollTop = document.getElementById('arenaChat').scrollHeight;
  }

  window.arenaMcChoose = async function(idx) {
    if (!_arenaRunning || _arenaMcBusy) return;
    const turn = _arenaChoices[_arenaChoices.length - 1];
    if (!turn || turn.chosenIdx !== null) return;
    turn.chosenIdx = idx;
    const chosenText = turn.options[idx].text;

    // Mark chosen option visually then hide
    const wrap = document.getElementById('arenaMcOptions');
    wrap.querySelectorAll('.arena-mc-opt').forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('arena-mc-opt--chosen', i === idx);
      b.classList.toggle('arena-mc-opt--unchosen', i !== idx);
    });
    setTimeout(() => { wrap.style.display = 'none'; wrap.innerHTML = ''; }, 600);

    _arenaAddBubble('rep', chosenText);
    _arenaMessages.push({ role: 'user', content: chosenText });

    const thinkingBubble = _arenaAddBubble('prospect', '…');

    try {
      const msgs = _arenaMessages.filter((m, i) => i !== 0);
      const systemPrompt = (_arenaMessages[0]?.content || '').replace('[SYSTEM: ', '').replace(']', '');
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Coach/Range',
          model: getDevModel('coach_arena', 'claude-sonnet-4-6'),
          max_tokens: 300,
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
      turn.prospectReply = reply;

      await _arenaMcGenerateOptions(reply);
    } catch(e) {
      thinkingBubble.querySelector('.arena-bubble-text').textContent = '[Error: ' + e.message + ']';
    }
    document.getElementById('arenaChat').scrollTop = document.getElementById('arenaChat').scrollHeight;
  };

  async function _arenaGenerateBranchGraph() {
    const graphEl = document.getElementById('arenaBranchGraph');
    if (!_arenaChoices.length || !graphEl) return;

    graphEl.innerHTML = '<div class="arena-branch-loading"><span class="load-blink">●</span> Building decision tree…</div>';
    graphEl.style.display = '';

    const turnsText = _arenaChoices.map((t, i) => {
      const opts = t.options.map((o, oi) => `  Option ${o.label || String.fromCharCode(65 + oi)} (${o.quality}): "${o.text}"`).join('\n');
      const chosenLetter = t.options[t.chosenIdx]?.label || String.fromCharCode(65 + (t.chosenIdx || 0));
      return `Turn ${i + 1}:\nProspect said: "${t.prospectMsg}"\n${opts}\nChosen: Option ${chosenLetter}\nActual prospect reply: "${t.prospectReply || 'session ended'}"`;
    }).join('\n\n');

    const prompt = `You analyzed a sales role-play with multiple-choice options. For each turn, describe in one short sentence (max 15 words) how the prospect would have reacted to EACH option.

${turnsText}

Return ONLY a JSON array:
[{"turn":1,"branches":["reaction to A","reaction to B","reaction to C"]},...]

For the chosen option, use the actual outcome from the transcript. For unchosen options, predict realistically. Be specific and blunt about whether it helped or hurt.`;

    try {
      const raw = await _coachAsk(prompt, 'coach_arena');
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const data = JSON.parse(match[0]);
        data.forEach(b => {
          const t = _arenaChoices[b.turn - 1];
          if (t) t.branches = b.branches;
        });
      }
    } catch(e) { /* render without branches */ }

    _arenaRenderBranchGraph(graphEl);
  }

  function _arenaRenderBranchGraph(container) {
    const qColor = { strong: '#4caf50', decent: '#f59e0b', weak: '#ef4444' };
    const qLabel = { strong: 'Strong', decent: 'Decent', weak: 'Risky' };

    let html = '<div class="bgraph-wrap">';
    html += '<div class="bgraph-title">Decision Tree — How Each Choice Shaped the Conversation</div>';

    _arenaChoices.forEach((turn, ti) => {
      html += `<div class="bgraph-turn">`;

      // Prospect node
      const msg = (turn.prospectMsg || '').slice(0, 140) + ((turn.prospectMsg || '').length > 140 ? '…' : '');
      html += `<div class="bgraph-prospect"><span class="bgraph-node-lbl">Prospect</span><span class="bgraph-node-txt">${escHtml(msg)}</span></div>`;

      // Connector down
      html += `<div class="bgraph-connector"></div>`;

      // Options row
      html += `<div class="bgraph-opts">`;
      turn.options.forEach((opt, oi) => {
        const isChosen = oi === turn.chosenIdx;
        const branch = turn.branches ? turn.branches[oi] : null;
        const color = qColor[opt.quality] || '#888';
        const letter = opt.label || String.fromCharCode(65 + oi);
        html += `<div class="bgraph-opt ${isChosen ? 'bgraph-opt--chosen' : 'bgraph-opt--alt'}" style="--q:${color}">`;
        html += `<div class="bgraph-opt-hdr"><span class="bgraph-opt-letter">${letter}</span><span class="bgraph-opt-qlabel" style="color:${color}">${qLabel[opt.quality] || opt.quality}</span>${isChosen ? '<span class="bgraph-opt-chosen-tag">chosen</span>' : ''}</div>`;
        html += `<div class="bgraph-opt-text">${escHtml(opt.text)}</div>`;
        if (branch) {
          html += `<div class="bgraph-opt-outcome ${isChosen ? 'bgraph-opt-outcome--chosen' : ''}">${isChosen ? '→' : '⤷'} ${escHtml(branch)}</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;

      // Connector to next turn (only if not last)
      if (ti < _arenaChoices.length - 1) {
        html += `<div class="bgraph-chosen-path"></div>`;
      }

      html += `</div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  }

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

    const prompt = `You are a sales coach. Review this training session and provide a detailed debrief.

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

    const branchGraphEl = document.getElementById('arenaBranchGraph');
    if (branchGraphEl) branchGraphEl.style.display = 'none';

    try {
      const md = await _coachRunSteps('afb', 4, () => _coachAsk(prompt, 'coach_feedback'));
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

    // MC mode: generate the branch graph after debrief
    if (_arenaMode === 'mc' && _arenaChoices.length) {
      await _arenaGenerateBranchGraph();
    }
  };

  window.arenaReset = function() {
    _arenaMessages = [];
    _arenaFeedbackMd = '';
    _arenaChoices = [];
    _arenaMcBusy = false;
    _arenaRunning = false;
    document.getElementById('arenaConfig').style.display = '';
    document.getElementById('arenaSession').style.display = 'none';
    document.getElementById('arenaSession').classList.remove('arena-session--mc');
    document.getElementById('arenaFeedback').style.display = 'none';
    const bgraph = document.getElementById('arenaBranchGraph');
    if (bgraph) { bgraph.style.display = 'none'; bgraph.innerHTML = ''; }
    const mcOpts = document.getElementById('arenaMcOptions');
    if (mcOpts) { mcOpts.style.display = 'none'; mcOpts.innerHTML = ''; }
  };

  window.arenaDownloadFeedback = function() {
    if (!_arenaFeedbackMd) return;
    const scenario = SCENARIO_LABELS[_arenaScenario];
    _coachPrint(`Training Debrief — ${_coachCurrentRep||'Rep'} · ${scenario}`,
      document.getElementById('arenaFeedbackBody').innerHTML);
  };

  // ── Intel Query ───────────────────────────────────────────────────────────────
  let _intelThread = []; // [{q, a}]

  function _coachIntelUpdateState() {
    const hasRep = !!_coachCurrentRep;
    const input   = document.getElementById('cdIntelInput');
    const sendBtn = document.getElementById('cdIntelSendBtn');
    const noRep   = document.getElementById('cdIntelNoRep');
    const chips   = document.getElementById('cdIntelChips');
    if (!input) return;
    input.disabled   = !hasRep;
    sendBtn.disabled = !hasRep;
    noRep.style.display  = hasRep ? 'none' : '';
    chips.style.opacity  = hasRep ? '1' : '0.35';
    chips.style.pointerEvents = hasRep ? '' : 'none';
  }

  function _coachBuildIntelContext() {
    const calls = _coachGetRepCalls(_coachCurrentRep);
    if (!calls.length) return `No call history found for ${_coachCurrentRep}.`;
    const avg = calls.length ? Math.round(calls.reduce((s,h) => s + _coachRepScore(h,_coachCurrentRep), 0) / calls.length) : null;
    const summary = calls.slice(-15).map(h => {
      const sc = _coachRepScore(h, _coachCurrentRep);
      const ds = h.callDate || h.ts.slice(0,10);
      return `- ${ds} | ${h.stage||'Unknown stage'} | ${h.prospect||'Unknown'} | Grade: ${h.letter_grade||'?'} ${sc}/100 | Strength: ${h.top_strength||'n/a'} | Focus: ${h.top_priority||'n/a'}`;
    }).join('\n');
    return `Rep: ${_coachCurrentRep}\nTotal graded calls: ${calls.length}\nAverage score: ${avg}/100\n\nCall history (most recent ${Math.min(calls.length,15)}):\n${summary}`;
  }

  window.coachIntelAsk = async function(question) {
    if (!_coachCurrentRep) return;
    const input = document.getElementById('cdIntelInput');
    if (input) input.value = '';
    await _coachIntelSubmit(question);
  };

  window.coachIntelSend = async function() {
    const input = document.getElementById('cdIntelInput');
    if (!input) return;
    const q = input.value.trim();
    if (!q || !_coachCurrentRep) return;
    input.value = '';
    await _coachIntelSubmit(q);
  };

  window.coachIntelKeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); coachIntelSend(); }
  };

  async function _coachIntelSubmit(question) {
    const thread = document.getElementById('cdIntelThread');
    const sendBtn = document.getElementById('cdIntelSendBtn');
    const clearBtn = document.getElementById('cdIntelClearBtn');
    if (!thread) return;

    thread.style.display = '';
    if (clearBtn) clearBtn.style.display = '';
    if (sendBtn) sendBtn.disabled = true;

    // Append question bubble
    const msgEl = document.createElement('div');
    msgEl.className = 'cd-intel-msg';
    msgEl.innerHTML = `<div class="cd-intel-msg-q">${escHtml(question)}</div><div class="cd-intel-thinking">Analyzing…</div>`;
    thread.appendChild(msgEl);
    thread.scrollTop = thread.scrollHeight;

    const context = _coachBuildIntelContext();
    const history = _intelThread.slice(-4).flatMap(t => [
      { role: 'user',      content: t.q },
      { role: 'assistant', content: t.a },
    ]);

    const systemMsg = `You are SIREN INTEL, an embedded AI analyst for a sales coaching platform. You have access to a rep's graded call history. Answer the user's question concisely and specifically — cite call data (dates, stages, scores) where relevant. Use markdown (bold, bullets) for clarity. Keep answers under 200 words unless a detailed breakdown is requested.`;

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Coach/Dashboard',
          model: getDevModel('coach_intel', 'claude-sonnet-4-6'), max_tokens: 1024, temperature: 0,
          system: systemMsg,
          messages: [
            ...history,
            { role: 'user', content: `Rep data:\n${context}\n\nQuestion: ${question}` },
          ],
        }),
      });
      const data = await res.json();
      const answer = data.content?.[0]?.text || 'No response.';
      _intelThread.push({ q: question, a: answer });
      msgEl.querySelector('.cd-intel-thinking').outerHTML = `<div class="cd-intel-msg-a">${_coachMd(answer)}</div>`;
    } catch (e) {
      msgEl.querySelector('.cd-intel-thinking').outerHTML = `<div class="cd-intel-msg-a" style="color:#ef4444;">Error: ${escHtml(e.message)}</div>`;
    }

    if (sendBtn) sendBtn.disabled = false;
    thread.scrollTop = thread.scrollHeight;
  }

  window.coachIntelClear = function() {
    _intelThread = [];
    const thread = document.getElementById('cdIntelThread');
    const clearBtn = document.getElementById('cdIntelClearBtn');
    if (thread) { thread.innerHTML = ''; thread.style.display = 'none'; }
    if (clearBtn) clearBtn.style.display = 'none';
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  function coachInit() {
    coachRenderRepSel();
    if (!_coachCurrentRep) _coachRenderDashboard();
    _coachIntelUpdateState();
    _arenaApplyRoleFilter();
  }
  window.coachInit = coachInit;
