  // ── Pulse tile layout (drag-to-reorder + resize) ─────────────
  const _TILE_DEFAULTS = {
    order: ['pt-score-trend','pt-rep-trends','pt-industry','pt-partners','pt-recent','pt-leaderboard'],
    spans: { 'pt-score-trend':1, 'pt-rep-trends':2, 'pt-industry':2, 'pt-partners':1, 'pt-recent':1, 'pt-leaderboard':1 },
  };

  function _getPulseLayout() {
    try {
      const s = JSON.parse(localStorage.getItem('oa_pulse_layout') || 'null');
      if (!s) return JSON.parse(JSON.stringify(_TILE_DEFAULTS));
      const order = s.order.filter(id => _TILE_DEFAULTS.order.includes(id));
      _TILE_DEFAULTS.order.forEach(id => { if (!order.includes(id)) order.push(id); });
      return { order, spans: { ..._TILE_DEFAULTS.spans, ...s.spans } };
    } catch { return JSON.parse(JSON.stringify(_TILE_DEFAULTS)); }
  }

  function _savePulseLayout(l) { localStorage.setItem('oa_pulse_layout', JSON.stringify(l)); }

  function applyPulseLayout() {
    const grid = document.getElementById('pulseGrid');
    if (!grid) return;
    const layout = _getPulseLayout();
    layout.order.forEach(id => { const el = document.getElementById(id); if (el) grid.appendChild(el); });
    layout.order.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const span = layout.spans[id] || 1;
      el.style.gridColumn = span === 2 ? '1 / -1' : '';
      const btn = el.querySelector('.pulse-tile-sz');
      if (btn) { btn.textContent = span === 2 ? '⊟' : '⊞'; btn.title = span === 2 ? 'Make half width' : 'Make full width'; }
    });
  }

  window.pulseTileResize = function(id) {
    const l = _getPulseLayout();
    l.spans[id] = l.spans[id] === 2 ? 1 : 2;
    _savePulseLayout(l);
    applyPulseLayout();
    setTimeout(_fixRepSparkNodes, 60); // re-correct oval nodes after layout shift
  };

  let _draggingId = null, _pulseLayoutInited = false;

  function _initPulseLayout() {
    if (_pulseLayoutInited) return;
    _pulseLayoutInited = true;
    const grid = document.getElementById('pulseGrid');
    if (!grid) return;

    grid.addEventListener('dragstart', e => {
      const tile = e.target.closest('.pulse-tile');
      if (!tile) return;
      _draggingId = tile.id;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tile.id);
    });

    grid.addEventListener('dragend', () => {
      document.querySelectorAll('.pulse-tile').forEach(t => t.classList.remove('dragging','drag-over'));
      _draggingId = null;
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tile = e.target.closest('.pulse-tile');
      if (!tile || tile.id === _draggingId) return;
      document.querySelectorAll('.pulse-tile').forEach(t => t.classList.remove('drag-over'));
      tile.classList.add('drag-over');
    });

    grid.addEventListener('dragleave', e => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        document.querySelectorAll('.pulse-tile').forEach(t => t.classList.remove('drag-over'));
      }
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('.pulse-tile');
      if (!target || !_draggingId || target.id === _draggingId) return;
      const l = _getPulseLayout();
      const fi = l.order.indexOf(_draggingId), ti = l.order.indexOf(target.id);
      if (fi !== -1 && ti !== -1) { l.order.splice(fi, 1); l.order.splice(ti, 0, _draggingId); }
      _savePulseLayout(l);
      document.querySelectorAll('.pulse-tile').forEach(t => t.classList.remove('drag-over','dragging'));
      applyPulseLayout();
    });
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
    const monthUsage = allTime.month || { cost: 0, calls: 0 };
    // (API Cost tile removed from PULSE)

    // Claude Code dev usage (async — fills in when the scan completes)
    fetch('/api/claude-usage').then(r => r.json()).then(u => {
      const v = document.getElementById('pkv-claude'), s = document.getElementById('pks-claude');
      if (!v || u.error) return;
      v.textContent = '$' + (u.today || 0).toFixed(2);
      if (s) s.textContent = `today · 30d $${(u.last30 || 0).toFixed(2)} · all $${(u.total || 0).toFixed(2)}`;
    }).catch(() => {});

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

    // ── Industry Breakdown ──
    drawIndustryBreakdown(history);

    // ── Partner Performance ──
    drawPartnerTile(history);

    // ── Apply tile layout (order + spans) ──
    applyPulseLayout();
    _initPulseLayout();

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

  // ── Deal Intel builder (shared with VIGIL feed) ───────────────
  const _SPICED_KEYS   = ['situation','pain','impact','critical_event','evolution','decision'];
  const _SPICED_LABELS = { situation:'Situation', pain:'Pain', impact:'Impact', critical_event:'Critical Event', evolution:'Evolution', decision:'Decision' };

  function vigilBuildDealIntel(h, hist) {
    // ── Momentum: delta across last 3 scored calls ──────────────
    const scores = hist.map(c => c.total).filter(s => s > 0);
    let momentumColor = 'rgba(255,255,255,.4)', momentumLabel = '→ Flat', momentumDelta = 0;
    if (scores.length >= 2) {
      momentumDelta = scores[0] - scores[Math.min(2, scores.length - 1)];
      if (momentumDelta >= 5)       { momentumColor = '#22c55e'; momentumLabel = `↑ +${momentumDelta} pts`; }
      else if (momentumDelta <= -5) { momentumColor = '#ef4444'; momentumLabel = `↓ ${momentumDelta} pts`; }
    }

    // ── SPICED: cumulative across ALL calls for this account ────
    // A dimension is "touched" if any call in the account history touched it
    const spicedCumulative = {};
    _SPICED_KEYS.forEach(k => { spicedCumulative[k] = false; });
    hist.forEach(call => {
      if (!call.spiced) return;
      _SPICED_KEYS.forEach(k => { if (call.spiced[k]?.touched) spicedCumulative[k] = true; });
    });
    const spicedTouch = _SPICED_KEYS.filter(k => spicedCumulative[k]).length;
    const spicedTotal = 6;
    const spicedPct   = Math.round(spicedTouch / spicedTotal * 100);
    const spicedColor = spicedPct >= 70 ? '#22c55e' : spicedPct >= 40 ? '#e8a020' : '#ef4444';
    const spicedGaps  = _SPICED_KEYS.filter(k => !spicedCumulative[k]).map(k => _SPICED_LABELS[k]);

    // ── Health: composite score + SPICED + momentum ─────────────
    const score = h.total || 0;
    const scoreOk    = score >= 65;
    const scoreStrong = score >= 80;
    const spicedOk   = spicedPct >= 40;
    const spicedStrong = spicedPct >= 60;
    const momOk      = momentumDelta >= -4; // not clearly declining
    const momStrong  = momentumDelta >= 0;
    let healthLabel, healthColor;
    if (scoreStrong && spicedStrong && momStrong) { healthLabel = 'Strong';   healthColor = '#22c55e'; }
    else if (scoreOk && spicedOk && momOk)        { healthLabel = 'Moderate'; healthColor = '#e8a020'; }
    else                                            { healthLabel = 'At Risk';  healthColor = '#ef4444'; }

    // Health tooltip — shown on hover via CSS, one row per factor
    const factorRow = (pass, label, actual, needed) =>
      `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);">
        <span style="color:${pass?'#22c55e':'#ef4444'};font-size:12px;flex-shrink:0;width:12px;">${pass?'✓':'✗'}</span>
        <span style="color:rgba(255,255,255,.65);font-size:11px;flex:1;">${label}</span>
        <span style="color:${pass?'#22c55e':'#ef4444'};font-size:11px;font-weight:700;white-space:nowrap;">${actual}</span>
        <span style="color:rgba(255,255,255,.28);font-size:10px;white-space:nowrap;">need ${needed}</span>
      </div>`;
    const healthTooltip = `
      <div class="di-health-tooltip">
        <div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.3);text-transform:uppercase;margin-bottom:8px;">Why ${healthLabel}?</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:2px;padding:0 0 4px;border-bottom:1px solid rgba(255,255,255,.08);">
          <span style="font-size:8px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.2);text-transform:uppercase;width:32px;text-align:right;">Score</span>
          <span style="font-size:8px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.2);text-transform:uppercase;width:52px;text-align:right;">Minimum</span>
        </div>
        ${factorRow(scoreOk,  'Call Score',      `${score}`,       healthLabel==='Strong'?'80+':'65+')}
        ${factorRow(spicedOk, 'SPICED Coverage', `${spicedPct}%`, healthLabel==='Strong'?'60%+':'40%+')}
        ${factorRow(momOk,    'Momentum',         momentumLabel,    'not declining')}
      </div>`;

    // ── Cadence ─────────────────────────────────────────────────
    const callDateStr = h.callDate || h.ts.slice(0, 10);
    const callUTC     = new Date(callDateStr + 'T00:00:00Z').getTime();
    const todayUTC    = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
    const daysSince   = Math.round((todayUTC - callUTC) / 86400000);
    const cadenceColor = daysSince > 14 ? '#ef4444' : daysSince > 7 ? '#e8a020' : '#22c55e';
    const cadenceLabel = new Date(callDateStr + 'T00:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    // ── Stage velocity + deal age ────────────────────────────────
    const callsAtStage = hist.filter(c => c.stage === h.stage).length;
    const oldest   = hist[hist.length - 1];
    const firstDateStr = oldest?.callDate || oldest?.ts?.slice(0,10) || callDateStr;
    const firstUTC = new Date(firstDateStr + 'T00:00:00Z').getTime();
    const dealAge  = Math.round((todayUTC - firstUTC) / 86400000);

    // ── Weakest dimension ────────────────────────────────────────
    let weakestDim = null, weakestScore = Infinity;
    if (h.dimensions) Object.entries(h.dimensions).forEach(([n,d]) => {
      if ((d.score??100) < weakestScore) { weakestScore = d.score??0; weakestDim = n; }
    });

    // ── Open VIGIL items ─────────────────────────────────────────
    const openItems = pulseSeedTasks(h.prospect||'', hist).filter(t=>!t.done).length;

    // ── Renderers ────────────────────────────────────────────────
    const kpi = (label, val, color, sub) =>
      `<div class="di-kpi">
        <div class="di-kpi-val" style="color:${color};">${val}</div>
        <div class="di-kpi-label">${label}</div>
        ${sub ? `<div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px;line-height:1.3;">${sub}</div>` : ''}
      </div>`;

    const row = (icon, label, val, color, detail) =>
      `<div class="di-row">
        <span class="di-row-icon" style="color:${color};">${icon}</span>
        <div class="di-row-body">
          <span class="di-row-label">${label}</span>
          <span class="di-row-val" style="color:${color};">${val}</span>
          ${detail ? `<div class="di-row-detail">${detail}</div>` : ''}
        </div>
      </div>`;

    // SPICED dimension grid
    const spicedGrid = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px;">
        ${_SPICED_KEYS.map(k => {
          const touched = spicedCumulative[k];
          return `<div style="font-size:10px;padding:4px 6px;border-radius:4px;background:${touched?'rgba(34,197,94,.1)':'rgba(255,255,255,.04)'};border:1px solid ${touched?'rgba(34,197,94,.3)':'rgba(255,255,255,.08)'};color:${touched?'#22c55e':'rgba(255,255,255,.3)'};">
            ${touched?'✓':'○'} ${_SPICED_LABELS[k]}
          </div>`;
        }).join('')}
      </div>`;

    return `
      <div class="di-kpi-strip" style="grid-template-columns:repeat(4,1fr);">
        <div class="di-kpi di-kpi-health" style="position:relative;">
          <div class="di-kpi-val" style="color:${healthColor};">${healthLabel}</div>
          <div class="di-kpi-label">Deal Health</div>
          <div style="font-size:9px;color:rgba(255,255,255,.25);margin-top:2px;">hover for detail</div>
          ${healthTooltip}
        </div>
        ${kpi('Momentum',    momentumLabel, momentumColor, scores.length >= 2 ? `last ${Math.min(3,scores.length)} calls` : 'only 1 call')}
        ${kpi('SPICED',      `${spicedTouch}/${spicedTotal}`, spicedColor, `${spicedPct}% coverage`)}
        ${kpi('Open Items',  openItems > 0 ? `${openItems}` : 'Clear', openItems > 0 ? '#e8a020' : '#22c55e')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:14px;">
        <div>
          <div class="di-section-label">DEAL METRICS</div>
          ${row('◷','Last Call',  cadenceLabel, cadenceColor, daysSince > 0 ? `${daysSince} day${daysSince!==1?'s':''} ago` : 'Today')}
          ${row('◈','Stage',      h.stage||'—', 'rgba(255,255,255,.7)', `${callsAtStage} call${callsAtStage!==1?'s':''} at this stage`)}
          ${row('⬡','Deal Age',   `${dealAge}d`, 'rgba(255,255,255,.55)', `${hist.length} total call${hist.length!==1?'s':''}`)}
          ${row('★','Call Score', `${h.letter_grade||''} · ${score}`, score>=80?'#22c55e':score>=65?'#e8a020':'#ef4444', `threshold: 65 moderate · 80 strong`)}
        </div>
        <div>
          <div class="di-section-label">RISK &amp; STRENGTH</div>
          ${h.top_priority ? row('▼','Top Gap',     '', '#e8a020', escHtml(h.top_priority)) : ''}
          ${weakestDim     ? row('↘','Weakest Dim', weakestDim, '#ef4444', `${weakestScore}/100`) : ''}
          ${daysSince > 14 ? row('⚑','Cadence Risk',`${daysSince}d`, '#ef4444', `No call in ${daysSince} days`) : ''}
          ${h.top_strength ? row('▲','Strength',    '', '#22c55e', escHtml(h.top_strength)) : ''}
        </div>
      </div>

      <div class="di-section-label" style="margin-top:12px;">SPICED COVERAGE <span style="font-weight:400;color:rgba(255,255,255,.2);font-size:8px;letter-spacing:.04em;">— cumulative across ${hist.length} call${hist.length!==1?'s':''}</span></div>
      ${spicedGrid}`;
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
          <div class="pulse-feed-deal-intel">
            <div class="pulse-feed-sub-title" style="margin-bottom:10px;">Deal Intel</div>
            ${vigilBuildDealIntel(a.latest, a.calls)}
          </div>
          <div class="pulse-feed-cols" style="margin-top:16px;">
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

  function _pulseOpenRows() {
    return [...document.querySelectorAll('.pulse-feed-body.open')].map(b => b.previousElementSibling?.querySelector('.pulse-feed-company')?.textContent?.trim()).filter(Boolean);
  }
  function _pulseRestoreRows(openCompanies) {
    document.querySelectorAll('.pulse-feed-row').forEach(row => {
      const name = row.querySelector('.pulse-feed-company')?.textContent?.trim();
      if (name && openCompanies.includes(name)) {
        const body = row.querySelector('.pulse-feed-body');
        const chev = row.querySelector('.pulse-feed-chevron');
        if (body) body.classList.add('open');
        if (chev) chev.classList.add('open');
      }
    });
  }

  function pulseToggleStep(company, idx) {
    const open = _pulseOpenRows();
    const tasks = loadPulseTasks(company);
    if (tasks[idx]) tasks[idx].done = !tasks[idx].done;
    savePulseTasks(company, tasks);
    pulseRenderFeed();
    _pulseRestoreRows(open);
  }

  function pulseDeleteStep(company, idx) {
    const open = _pulseOpenRows();
    const tasks = loadPulseTasks(company);
    tasks.splice(idx, 1);
    savePulseTasks(company, tasks);
    pulseRenderFeed();
    _pulseRestoreRows(open);
  }

  function pulseAddStepFor(company, inp) {
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    const open = _pulseOpenRows();
    const tasks = loadPulseTasks(company);
    tasks.push({ text: txt, done: false, source: '', ts: Date.now() });
    savePulseTasks(company, tasks);
    if (inp) inp.value = '';
    pulseRenderFeed();
    _pulseRestoreRows(open);
  }

  // ── Industry Breakdown tile ───────────────────────────────────
  let _industryDrill = null;

  function drawIndustryBreakdown(history) {
    const container = document.getElementById('pulseIndustryChart');
    const titleEl   = document.getElementById('pulseIndustryTitle');
    const backBtn   = document.getElementById('pulseIndustryBack');
    if (!container) return;

    const indMap = {};
    history.forEach(h => {
      const prospect = (h.prospect || '').trim();
      if (!prospect) return;
      const industry = _getProspectIndustry(prospect) || 'Unassigned';
      if (!indMap[industry]) indMap[industry] = { accounts: new Set(), calls: [] };
      indMap[industry].accounts.add(prospect);
      indMap[industry].calls.push(h);
    });

    const industries = Object.entries(indMap).map(([name, d]) => {
      const scores = d.calls.map(c => c.total).filter(s => s > 0);
      return { name, accounts: d.accounts, accountCount: d.accounts.size, calls: d.calls,
               avg: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0 };
    }).sort((a,b) => b.avg - a.avg);

    if (_industryDrill) {
      if (titleEl) titleEl.textContent = _industryDrill;
      if (backBtn) backBtn.style.display = '';
      const d = indMap[_industryDrill] || { accounts: new Set(), calls: [] };
      _drawIndustryTrend(container, d.calls, d.accounts);
    } else {
      if (titleEl) titleEl.textContent = 'Industry Breakdown';
      if (backBtn) backBtn.style.display = 'none';
      _drawIndustryOverview(container, industries);
    }
  }

  function _drawIndustryOverview(container, industries) {
    if (!industries.length) {
      container.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.2);padding:1rem 0;text-align:center;">No industry data yet — set industries on the History page.</div>';
      return;
    }
    const scoreColor = s => s >= 80 ? '#22c55e' : s >= 65 ? '#00c8ff' : s >= 50 ? '#f59e0b' : '#ef4444';
    container.innerHTML = industries.map(ind => {
      const color  = scoreColor(ind.avg);
      const qname  = escHtml(JSON.stringify(ind.name));
      const unassigned = ind.name === 'Unassigned';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;border-radius:4px;transition:background .12s;" onclick="industryDrillTo(${qname})" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
        <div style="width:130px;font-size:12px;font-weight:600;color:${unassigned?'rgba(255,255,255,.3)':'rgba(255,255,255,.85)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;">${escHtml(ind.name)}</div>
        <div style="flex:1;background:rgba(255,255,255,.06);border-radius:3px;height:12px;position:relative;overflow:hidden;">
          <div style="position:absolute;left:0;top:0;height:100%;width:${ind.avg}%;background:${color};opacity:.7;border-radius:3px;"></div>
        </div>
        <div style="width:28px;font-size:13px;font-weight:800;color:${color};text-align:right;flex-shrink:0;">${ind.avg || '—'}</div>
        <div style="width:90px;font-size:10px;color:rgba(255,255,255,.28);text-align:right;flex-shrink:0;">${ind.accountCount} acct${ind.accountCount!==1?'s':''} · ${ind.calls.length} call${ind.calls.length!==1?'s':''}</div>
        <div style="width:14px;font-size:11px;color:rgba(255,255,255,.2);flex-shrink:0;">›</div>
      </div>`;
    }).join('');
  }

  function _drawIndustryTrend(container, calls, accounts) {
    if (!calls.length) {
      container.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.2);padding:1rem 0;text-align:center;">No calls in this industry.</div>';
      return;
    }
    const callDateOf = h => h.callDate ? new Date(h.callDate + 'T12:00:00') : new Date(h.ts);
    const sorted = [...calls].filter(h => h.total > 0).sort((a,b) => callDateOf(a) - callDateOf(b));
    if (!sorted.length) {
      container.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.2);padding:1rem 0;text-align:center;">No scored calls in this industry yet.</div>';
      return;
    }

    const W=540, H=180, PAD={top:14,right:16,bottom:24,left:32};
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;
    const toX = i => PAD.left + (i / Math.max(sorted.length-1, 1)) * chartW;
    const toY = v => PAD.top + chartH - (Math.max(0, Math.min(100,v)) / 100) * chartH;

    const COLORS = ['#00c8ff','#f59e0b','#a78bfa','#34d399','#f87171','#fb923c','#38bdf8','#e879f9'];
    const accountList = [...accounts];
    const acctColor = name => COLORS[accountList.indexOf(name) % COLORS.length] || '#00c8ff';

    let svg = '';
    // Grid lines
    [30,60,90].forEach(y => {
      const gy = toY(y);
      svg += `<line x1="${PAD.left}" y1="${gy}" x2="${W-PAD.right}" y2="${gy}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
      svg += `<text x="${PAD.left-6}" y="${gy+4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.2)" font-family="'SF Mono','Fira Code',monospace">${y}</text>`;
    });

    const pts = sorted.map((h,i) => ({
      x: toX(i), y: toY(h.total), score: h.total, prospect: h.prospect || '',
      color: acctColor(h.prospect || ''),
      date: callDateOf(h).toLocaleDateString([],{month:'short',day:'numeric'}),
    }));

    // Area fill behind the line
    const lineD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = lineD + ` L ${pts[pts.length-1].x.toFixed(1)} ${toY(0).toFixed(1)} L ${pts[0].x.toFixed(1)} ${toY(0).toFixed(1)} Z`;
    svg += `<defs><linearGradient id="indFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,200,255,0.18)"/><stop offset="100%" stop-color="rgba(0,200,255,0.02)"/></linearGradient></defs>`;
    svg += `<path d="${areaD}" fill="url(#indFill)"/>`;
    svg += `<path d="${lineD}" fill="none" stroke="rgba(0,200,255,0.35)" stroke-width="1.5" stroke-dasharray="5 3" stroke-linejoin="round"/>`;

    // Dots colored by account
    pts.forEach((p,i) => {
      const isLast = i === pts.length-1;
      const tipSafe = (p.prospect + ' · ' + p.score + ' · ' + p.date).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      if (isLast) {
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="${p.color}" opacity="0.2" stroke="none"/>`;
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${p.color}" stroke="#061824" stroke-width="2" style="cursor:crosshair" onmouseover="_repTip(event,'${tipSafe}')" onmouseout="_repTipHide()"/>`;
      } else {
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${p.color}" opacity="0.8" stroke="#061824" stroke-width="1.5" style="cursor:crosshair" onmouseover="_repTip(event,'${tipSafe}')" onmouseout="_repTipHide()"/>`;
      }
    });

    // X-axis date labels
    const showIdx = [0, Math.floor((sorted.length-1)/2), sorted.length-1].filter((v,i,a) => a.indexOf(v)===i);
    showIdx.forEach(i => {
      svg += `<text x="${toX(i).toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.2)" font-family="system-ui">${pts[i].date}</text>`;
    });

    // Account legend (up to 8)
    const legendItems = accountList.slice(0,8).map(name =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:rgba(255,255,255,.45);">` +
      `<span style="width:8px;height:8px;border-radius:50%;background:${acctColor(name)};flex-shrink:0;display:inline-block;"></span>${escHtml(name)}</span>`
    ).join('');

    container.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${svg}</svg>` +
      (accountList.length > 1 ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;padding:0 2px;">${legendItems}</div>` : '');
  }

  window.industryDrillTo = function(name) { _industryDrill = name; drawIndustryBreakdown(loadHistory()); };
  window.industryDrillBack = function()   { _industryDrill = null; drawIndustryBreakdown(loadHistory()); };

  // ── Partner Performance Tile ──────────────────────────────────
  let _partnerDrill = null;

  function drawPartnerTile(history) {
    const container = document.getElementById('pulsePartnersChart');
    const titleEl   = document.getElementById('pulsePartnersTitle');
    const backBtn   = document.getElementById('pulsePartnersBack');
    if (!container) return;

    // Aggregate partner_scores across all history records
    const partnerMap = {};
    history.forEach(h => {
      const scores = h.partner_scores;
      if (!Array.isArray(scores)) return;
      scores.forEach(p => {
        const key = (p.name || '').toLowerCase();
        if (!key) return;
        if (!partnerMap[key]) {
          partnerMap[key] = {
            name: p.name,
            org:  p.organization || p.org || '',
            role: p.role || '',
            scores: [],
            deltas: [],
            calls: [],
          };
        }
        const entry = partnerMap[key];
        if (typeof p.total === 'number') entry.scores.push(p.total);
        if (typeof p.call_impact_delta === 'number') entry.deltas.push(p.call_impact_delta);
        entry.calls.push({ date: h.callDate || h.ts, prospect: h.prospect, stage: h.stage || '', total: p.total, delta: p.call_impact_delta, strength: p.top_strength || '', priority: p.top_priority || '' });
      });
    });

    const partners = Object.values(partnerMap);

    if (_partnerDrill && partnerMap[_partnerDrill.toLowerCase()]) {
      const p = partnerMap[_partnerDrill.toLowerCase()];
      if (titleEl) titleEl.textContent = p.name + (p.org ? ` — ${p.org}` : '');
      if (backBtn) backBtn.style.display = '';
      _drawPartnerDetail(container, p);
    } else {
      _partnerDrill = null;
      if (titleEl) titleEl.textContent = 'Partner Performance';
      if (backBtn) backBtn.style.display = 'none';
      _drawPartnerOverview(container, partners);
    }
  }

  function _drawPartnerOverview(container, partners) {
    if (!partners.length) {
      container.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.2);padding:1rem 0;text-align:center;">No partner data yet — partner participants are detected during grading.</div>';
      return;
    }

    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : null;
    const sorted = partners.slice().sort((a,b) => {
      const sa = avg(a.scores) ?? 0;
      const sb = avg(b.scores) ?? 0;
      return sb - sa;
    });

    const rows = sorted.map(p => {
      const avgScore = avg(p.scores);
      const avgDelta = avg(p.deltas);
      const scoreStr = avgScore !== null ? avgScore.toFixed(1) : '—';
      const deltaCls = avgDelta === null ? '' : avgDelta > 0 ? 'partner-delta-pos' : avgDelta < 0 ? 'partner-delta-neg' : 'partner-delta-neu';
      const deltaStr = avgDelta === null ? '' : (avgDelta > 0 ? '+' : '') + avgDelta.toFixed(1);
      const callsLbl = `${p.calls.length} call${p.calls.length !== 1 ? 's' : ''}`;
      const orgLbl   = p.org ? escHtml(p.org) : '';
      const roleLbl  = p.role ? escHtml(p.role) : '';
      const meta = [orgLbl, roleLbl].filter(Boolean).join(' · ');
      return `<div class="pulse-call-row" style="cursor:pointer;" onclick="partnerDrillTo(${escHtml(JSON.stringify(p.name))})">
        <div class="pulse-call-badge" style="background:var(--clr-accent);color:#000;font-size:12px;font-weight:700;min-width:36px;text-align:center;">${escHtml(scoreStr)}</div>
        <div class="pulse-call-info">
          <div class="pulse-call-company">${escHtml(p.name)}</div>
          <div class="pulse-call-meta">${meta ? meta + ' · ' : ''}${callsLbl}</div>
        </div>
        ${avgDelta !== null ? `<div class="partner-delta ${deltaCls}" style="font-size:12px;font-weight:700;min-width:40px;text-align:right;">${deltaStr}</div>` : ''}
      </div>`;
    });

    container.innerHTML = rows.join('');
  }

  function _drawPartnerDetail(container, p) {
    if (!p.calls.length) { container.innerHTML = ''; return; }

    // Group calls by prospect
    const byProspect = {};
    p.calls.forEach(c => {
      const key = (c.prospect || 'Unknown').trim() || 'Unknown';
      (byProspect[key] = byProspect[key] || []).push(c);
    });

    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
    const deltaBits = d => d === null || typeof d !== 'number' ? ['',''] : [
      d > 0 ? 'partner-delta-pos' : d < 0 ? 'partner-delta-neg' : 'partner-delta-neu',
      (d > 0 ? '+' : '') + (Number.isInteger(d) ? d : d.toFixed(1)),
    ];

    const groups = Object.entries(byProspect)
      .map(([prospect, calls]) => ({
        prospect, calls,
        avgScore: avg(calls.map(c=>c.total).filter(v=>typeof v==='number')),
        avgDelta: avg(calls.map(c=>c.delta).filter(v=>typeof v==='number')),
        latest: calls.reduce((m,c) => c.date > m ? c.date : m, ''),
      }))
      .sort((a,b) => (a.latest < b.latest ? 1 : -1));

    container.innerHTML = groups.map(g => {
      const [hdrDeltaCls, hdrDeltaStr] = deltaBits(g.avgDelta);
      const scoreStr = g.avgScore !== null ? g.avgScore.toFixed(1) : '—';
      const latestCall = g.calls.slice().sort((a,b) => (a.date < b.date ? 1 : -1))[0];

      const callRows = g.calls.slice().sort((a,b) => (a.date < b.date ? 1 : -1)).map(c => {
        const ds = c.date ? new Date(String(c.date).slice(0,10)+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) : '';
        const [dCls, dStr] = deltaBits(typeof c.delta === 'number' ? c.delta : null);
        return `<div class="pulse-call-row" style="padding-left:14px;">
          <div class="pulse-call-badge" style="background:var(--clr-accent);color:#000;font-size:11px;font-weight:700;min-width:32px;text-align:center;">${typeof c.total==='number'?c.total.toFixed(0):'—'}</div>
          <div class="pulse-call-info">
            <div class="pulse-call-meta" style="color:rgba(255,255,255,.6);">${escHtml([c.stage, ds].filter(Boolean).join(' · '))}</div>
          </div>
          ${dStr ? `<div class="partner-delta ${dCls}" style="font-size:11px;font-weight:700;min-width:36px;text-align:right;">${escHtml(dStr)}</div>` : ''}
        </div>`;
      }).join('');

      const coaching = latestCall && (latestCall.strength || latestCall.priority) ? `
        <div style="padding:4px 14px 8px;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.45);">
          ${latestCall.strength ? `<div><span style="color:#4ade80;font-weight:600;">Strength</span> ${escHtml(latestCall.strength)}</div>` : ''}
          ${latestCall.priority ? `<div><span style="color:#e8a020;font-weight:600;">Priority</span> ${escHtml(latestCall.priority)}</div>` : ''}
        </div>` : '';

      return `<div style="margin-bottom:12px;">
        <div class="pulse-call-row" style="background:rgba(0,200,255,.05);border-radius:6px;">
          <div class="pulse-call-badge" style="background:var(--clr-accent);color:#000;font-size:12px;font-weight:700;min-width:36px;text-align:center;">${escHtml(scoreStr)}</div>
          <div class="pulse-call-info">
            <div class="pulse-call-company">${escHtml(g.prospect)}</div>
            <div class="pulse-call-meta">${g.calls.length} call${g.calls.length!==1?'s':''} · avg impact</div>
          </div>
          ${hdrDeltaStr ? `<div class="partner-delta ${hdrDeltaCls}" style="font-size:12px;font-weight:700;min-width:40px;text-align:right;">${escHtml(hdrDeltaStr)}</div>` : ''}
        </div>
        ${callRows}
        ${coaching}
      </div>`;
    }).join('');
  }

  window.partnerDrillTo   = function(name) { _partnerDrill = name; drawPartnerTile(loadHistory()); };
  window.partnerDrillBack = function()     { _partnerDrill = null; drawPartnerTile(loadHistory()); };

  window.pulseRefresh = async function() {
    const btn  = document.getElementById('pulseRefreshBtn');
    const icon = document.getElementById('pulseRefreshIcon');
    if (btn) btn.disabled = true;
    if (icon) icon.style.transform = 'rotate(360deg)';

    await _loadHistoryFromDB();

    renderPulse();

    if (btn) btn.disabled = false;
    setTimeout(() => { if (icon) icon.style.transform = ''; }, 520);
  };

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

  function _repTip(e, text) {
    let tip = document.getElementById('repNodeTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'repNodeTip';
      tip.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:#1a2535;border:1px solid rgba(255,255,255,.15);border-radius:5px;padding:4px 9px;font-size:11px;font-weight:700;color:rgba(255,255,255,.85);font-family:system-ui;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.5);display:none;';
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 12) + 'px';
    tip.style.top  = (e.clientY - 28) + 'px';
  }
  function _repTipHide() {
    const tip = document.getElementById('repNodeTip');
    if (tip) tip.style.display = 'none';
  }

  function drawRepTrends(history) {
    const container = document.getElementById('pulseRepTrendRows');
    if (!container) return;

    const trendVal = parseInt(document.getElementById('repTrendPeriodSel')?.value ?? '90');
    const isCallCount = trendVal <= 20;
    const cutoff = (!isCallCount && trendVal > 0) ? Date.now() - trendVal * 86400000 : 0;

    const repMap = {};
    history.forEach(h => {
      const ms = h.callDate ? new Date(h.callDate).getTime() : new Date(h.ts).getTime();
      if (!isCallCount && cutoff > 0 && ms < cutoff) return;
      // Use individual rep_scores when available (multi-rep calls); fall back to h.rep + h.total
      const repEntries = h.rep_scores && h.rep_scores.length ? h.rep_scores : null;
      if (repEntries) {
        const team = loadTeam();
        repEntries.forEach(rs => {
          if (!rs.name || !rs.total) return;
          // Resolve role from team roster
          const norm = s => (s || '').toLowerCase().trim();
          const member = team.find(m => norm(m.name) === norm(rs.name) ||
            norm(m.name).split(' ')[0] === norm(rs.name).split(' ')[0] ||
            norm(m.name).split(' ').pop() === norm(rs.name).split(' ').pop());
          const key = rs.name;
          if (!repMap[key]) repMap[key] = { calls: [], role: member ? member.role : '' };
          const isCold = /cold.outreach/i.test(h.stage || '');
          if (isCold && !/\bISR\b|\bBDR\b/i.test(repMap[key].role)) return;
          repMap[key].calls.push({ ms, score: rs.total, stage: h.stage || '' });
        });
      } else if (h.rep && h.total) {
        if (!repMap[h.rep]) repMap[h.rep] = { calls: [], role: h.repRole || '' };
        const isCold = /cold.outreach/i.test(h.stage || '');
        if (isCold && !/\bISR\b|\bBDR\b/i.test(repMap[h.rep].role)) return;
        repMap[h.rep].calls.push({ ms, score: h.total, stage: h.stage || '' });
      }
    });

    const reps = Object.entries(repMap)
      .map(([name, { calls, role }]) => {
        let sorted = calls.sort((a,b) => a.ms - b.ms);
        if (isCallCount) sorted = sorted.slice(-trendVal); // last N per rep
        return { name, role: role || '', calls: sorted };
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
    const ROW_H = 104, PAD = { top: 30, bottom: 22, left: 6, right: 6 };
    const chartH = ROW_H - PAD.top - PAD.bottom;

    // Score colour
    const scoreColor = s => s >= 80 ? '#22c55e' : s >= 65 ? '#00c8ff' : s >= 50 ? '#f59e0b' : '#ef4444';

    const rows = reps.map((rep, ri) => {
      const color = COLORS[ri % COLORS.length];
      const avg = Math.round(rep.calls.reduce((s,c) => s + c.score, 0) / rep.calls.length);
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
        const t0 = `${pts[0].score} · ${fmt(pts[0].ms)}`;
        sparkContent += `<circle data-r="4" cx="${pts[0].x}" cy="${pts[0].y}" r="4" fill="${color}" stroke="#061824" stroke-width="1.5" style="cursor:crosshair" onmouseover="_repTip(event,'${t0}')" onmouseout="_repTipHide()"/>`;
      } else {
        const lineD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        // Area fill
        const areaD = lineD + ` L ${pts[pts.length-1].x.toFixed(1)} ${toY(0).toFixed(1)} L ${pts[0].x.toFixed(1)} ${toY(0).toFixed(1)} Z`;
        sparkContent += `<defs><linearGradient id="rfill${ri}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>`;
        sparkContent += `<path d="${areaD}" fill="url(#rfill${ri})"/>`;
        sparkContent += `<path d="${lineD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        pts.forEach((p, pi) => {
          const isLast = pi === pts.length - 1;
          const tipDate = fmt(p.ms);
          const tipText = `${p.score} · ${tipDate}`;
          if (isLast) {
            sparkContent += `<circle data-r="7" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="${color}" opacity="0.2" stroke="none"/>`;
            sparkContent += `<circle data-r="4" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="#061824" stroke-width="2" style="cursor:crosshair" onmouseover="_repTip(event,'${tipText}')" onmouseout="_repTipHide()"/>`;
          } else {
            sparkContent += `<circle data-r="3" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" opacity="0.6" stroke="#061824" stroke-width="1.5" style="cursor:crosshair" onmouseover="_repTip(event,'${tipText}')" onmouseout="_repTipHide()"/>`;
          }
        });
      }

      // Date labels on first and last point
      if (pts.length > 1) {
        sparkContent += `<text x="${pts[0].x.toFixed(1)}" y="${(ROW_H-5).toFixed(1)}" text-anchor="start" font-size="9" fill="rgba(255,255,255,0.3)" font-family="system-ui">${fmt(pts[0].ms)}</text>`;
        sparkContent += `<text x="${pts[pts.length-1].x.toFixed(1)}" y="${(ROW_H-5).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.3)" font-family="system-ui">${fmt(pts[pts.length-1].ms)}</text>`;
      }

      return `<div style="display:flex;align-items:center;gap:0;border-bottom:1px solid rgba(255,255,255,.05);padding:10px 0;">
        <div style="width:130px;flex-shrink:0;padding-right:12px;">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(rep.name)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:2px;">${rep.role ? escHtml(rep.role) + ' · ' : ''}${rep.calls.length} call${rep.calls.length!==1?'s':''}</div>
        </div>
        <svg class="rep-sparkline" style="flex:1;min-width:0;height:${ROW_H}px;display:block;" viewBox="0 0 ${W} ${ROW_H}" preserveAspectRatio="none">${sparkContent}</svg>
        <div style="width:60px;flex-shrink:0;text-align:right;padding-left:14px;">
          <div style="font-size:22px;font-weight:800;color:${scoreColor(avg)};line-height:1;">${avg}</div>
          <div style="font-size:10px;font-weight:700;color:${trendColor};margin-top:4px;">${trendLabel}</div>
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
      <div style="width:60px;flex-shrink:0;text-align:right;padding-left:14px;font-size:9px;color:rgba(255,255,255,.2);font-family:'SF Mono','Fira Code',monospace;">AVG</div>
    </div>`;

    container.innerHTML = axisHtml + rows.join('');
    setTimeout(_fixRepSparkNodes, 50);
  }

  function _fixRepSparkNodes() {
    document.querySelectorAll('svg.rep-sparkline').forEach(svg => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const vbW = 500; // matches W constant
      const scaleX = rect.width / vbW;
      // scaleY = 1 since height:ROW_H px == viewBox height ROW_H — no vertical distortion
      svg.querySelectorAll('circle[data-r]').forEach(c => {
        const rPx = parseFloat(c.getAttribute('data-r'));
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        el.setAttribute('cx', c.getAttribute('cx'));
        el.setAttribute('cy', c.getAttribute('cy'));
        el.setAttribute('rx', (rPx / scaleX).toFixed(2));
        el.setAttribute('ry', rPx);
        ['fill','stroke','stroke-width','opacity','style','onmouseover','onmouseout'].forEach(a => {
          if (c.hasAttribute(a)) el.setAttribute(a, c.getAttribute(a));
        });
        c.parentNode.replaceChild(el, c);
      });
    });
  }

