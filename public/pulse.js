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
    document.getElementById('pkv-cost').textContent = allTime.cost > 0 ? '$' + allTime.cost.toFixed(2) : '$0.00';
    document.getElementById('pks-cost').textContent = `all-time · ${allTime.calls} call${allTime.calls!==1?'s':''}`;

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
      if (h.rep && h.total) {
        if (!repMap[h.rep]) repMap[h.rep] = [];
        repMap[h.rep].push({ ms, score: h.total, stage: h.stage || '' });
      }
      (h.participants || []).forEach(p => {
        if (!p.name || !p.score) return;
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
        sparkContent += `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="6" fill="${color}" stroke="#061824" stroke-width="1.5" style="cursor:crosshair" onmouseover="_repTip(event,'${t0}')" onmouseout="_repTipHide()"/>`;
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
            sparkContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="${color}" opacity="0.12" stroke="none"/>`;
            sparkContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${color}" stroke="#061824" stroke-width="2" style="cursor:crosshair" onmouseover="_repTip(event,'${tipText}')" onmouseout="_repTipHide()"/>`;
          } else {
            sparkContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="#061824" stroke-width="1.5" opacity="0.7" style="cursor:crosshair" onmouseover="_repTip(event,'${tipText}')" onmouseout="_repTipHide()"/>`;
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
          <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:3px;">${rep.calls.length} call${rep.calls.length!==1?'s':''}</div>
        </div>
        <svg style="flex:1;min-width:0;height:${ROW_H}px;display:block;" viewBox="0 0 ${W} ${ROW_H}" preserveAspectRatio="none">${sparkContent}</svg>
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
  }

