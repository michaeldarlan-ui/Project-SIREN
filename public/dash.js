// ── CUSTOM DASHBOARD ──────────────────────────────────────────────────────────

  const _DASH_KEY = 'siren_dashboard_v1';
  const _DASH_DEFAULTS = [
    { id: 'kpi_strip',       span: 3 },
    { id: 'score_trend',     span: 2 },
    { id: 'recent_calls',    span: 1 },
    { id: 'rep_leaderboard', span: 3 },
  ];

  // ── Tile registry ──────────────────────────────────────────────────────────
  // Each tile: { id, label, module, defaultSpan, render(container) }
  // span: 1=narrow(4col), 2=medium(8col), 3=full(12col)

  const _DASH_TILES = [

    // ── PULSE tiles ──────────────────────────────────────────
    {
      id: 'kpi_strip',
      label: 'Call KPIs',
      module: 'PULSE',
      defaultSpan: 3,
      render(el) {
        const history = loadHistory();
        const now = new Date();
        const weekAgo = new Date(now - 7 * 86400000);
        const calMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const dateOf = h => h.callDate ? new Date(h.callDate + 'T12:00:00') : new Date(h.ts);
        const thisWeek = history.filter(h => dateOf(h) >= weekAgo).length;
        const scores = history.map(h => h.normalized_score || h.total).filter(s => s > 0);
        const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
        const lastMonth = history.filter(h => { const d=dateOf(h); return d>=prevMonthStart&&d<calMonthStart; });
        const lastScores = lastMonth.map(h=>h.normalized_score||h.total).filter(s=>s>0);
        const avgLast = lastScores.length ? Math.round(lastScores.reduce((a,b)=>a+b,0)/lastScores.length) : null;
        const delta = avg!==null&&avgLast!==null ? avg-avgLast : null;
        const thisMonth = history.filter(h => dateOf(h) >= calMonthStart);
        const gradeCounts = {};
        thisMonth.forEach(h => { gradeCounts[h.letter_grade]=(gradeCounts[h.letter_grade]||0)+1; });
        const topGrade = Object.entries(gradeCounts).sort((a,b)=>b[1]-a[1])[0];
        const kpi = (label, value, sub, subClass) =>
          `<div class="dash-kpi"><div class="dash-kpi-label">${label}</div><div class="dash-kpi-value">${value}</div><div class="dash-kpi-sub ${subClass||''}">${sub}</div></div>`;
        el.innerHTML = `<div class="dash-kpi-row">
          ${kpi('Calls Graded', history.length||'0', thisWeek?`↑ ${thisWeek} this week`:'no calls this week')}
          ${kpi('Avg Score', avg!==null?avg:'—', delta!==null?(delta>=0?`↑${delta} vs last mo`:`↓${Math.abs(delta)} vs last mo`):'no prior baseline', delta!==null&&delta<0?'down':'')}
          ${kpi('Top Grade', topGrade?topGrade[0]:'—', topGrade?`${topGrade[1]} call${topGrade[1]!==1?'s':''} this month`:'no calls this month')}
        </div>`;
      },
    },

    {
      id: 'score_trend',
      label: 'Score Trend',
      module: 'PULSE',
      defaultSpan: 2,
      render(el) {
        const history = loadHistory();
        const data = history.slice(0, 10).reverse();
        const uid = 'dt_' + Math.random().toString(36).slice(2,7);
        el.innerHTML = `<svg id="${uid}" viewBox="0 0 540 160" width="100%" style="display:block;"></svg>`;
        const svg = el.querySelector('svg');
        const W=540, H=160, PAD={top:14,right:16,bottom:24,left:32};
        const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
        if (!data.length) { svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.15)" font-family="system-ui">No data yet</text>`; return; }
        const toX=i=>PAD.left+(i/Math.max(data.length-1,1))*cW;
        const toY=v=>PAD.top+cH-((v-0)/(100-0))*cH;
        let g='';
        [30,60,90].forEach(y => {
          const gy=toY(y);
          g+=`<line x1="${PAD.left}" y1="${gy}" x2="${W-PAD.right}" y2="${gy}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
          g+=`<text x="${PAD.left-6}" y="${gy+4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.2)" font-family="monospace">${y}</text>`;
        });
        const pts=data.map((h,i)=>({x:toX(i),y:toY(h.normalized_score||h.total||0),s:h.normalized_score||h.total||0}));
        const lineD=pts.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
        const areaD=lineD+` L ${pts[pts.length-1].x} ${toY(0)} L ${pts[0].x} ${toY(0)} Z`;
        g+=`<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(0,200,255,0.25)"/><stop offset="100%" stop-color="rgba(0,200,255,0.02)"/></linearGradient></defs>`;
        g+=`<path d="${areaD}" fill="url(#${uid}g)"/>`;
        g+=`<path d="${lineD}" fill="none" stroke="rgba(0,200,255,0.7)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        pts.forEach((p,i)=>{
          const last=i===pts.length-1;
          if(last){g+=`<circle cx="${p.x}" cy="${p.y}" r="7" fill="rgba(0,200,255,0.2)"/>`;g+=`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00c8ff" stroke="#061824" stroke-width="2"/>`;g+=`<text x="${p.x}" y="${p.y-12}" text-anchor="middle" font-size="10" font-weight="700" fill="rgba(0,200,255,0.9)" font-family="system-ui">${p.s}</text>`;}
          else{g+=`<circle cx="${p.x}" cy="${p.y}" r="3" fill="rgba(0,200,255,0.5)" stroke="#061824" stroke-width="1.5"/>`;}
        });
        [0,Math.floor((data.length-1)/2),data.length-1].filter((v,i,a)=>a.indexOf(v)===i).forEach(i=>{
          const h=data[i];
          const ds=h.callDate?new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'}):new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric'});
          g+=`<text x="${toX(i)}" y="${H-4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.2)" font-family="system-ui">${ds}</text>`;
        });
        svg.innerHTML=g;
      },
    },

    {
      id: 'recent_calls',
      label: 'Recent Calls',
      module: 'PULSE',
      defaultSpan: 1,
      render(el) {
        const history = loadHistory();
        const recent = history.slice(0, 6);
        const abbrev = s => (s||'').replace('Demo / solution presentation','Demo').replace('Discovery call','Discovery').replace('Cold Outreach','Cold').replace('Proposal / close','Proposal').replace('Touchpoint / check-in','Touchpoint');
        if (!recent.length) { el.innerHTML='<div style="font-size:13px;color:rgba(255,255,255,0.2);padding:.75rem 0;">No calls graded yet.</div>'; return; }
        el.innerHTML = recent.map(h => {
          const bg = getBannerColor(h.letter_grade);
          const ds = h.callDate ? new Date(h.callDate+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'}) : new Date(h.ts).toLocaleDateString([],{month:'short',day:'numeric'});
          const rep = h.rep ? h.rep.split(' ').slice(0,2).map((w,i)=>i===1?w[0]+'.':w).join(' ') : '';
          const meta = [rep, abbrev(h.stage), ds].filter(Boolean).join(' · ');
          return `<div class="dash-call-row" onclick="navTo('history')">
            <div class="dash-call-badge" style="background:${bg};">${escHtml(h.letter_grade)}</div>
            <div class="dash-call-info"><div class="dash-call-co">${escHtml(h.prospect||'Unknown')}</div><div class="dash-call-meta">${escHtml(meta)}</div></div>
            <div class="dash-call-score">${h.normalized_score??h.total}</div>
          </div>`;
        }).join('');
      },
    },

    {
      id: 'rep_leaderboard',
      label: 'Rep Leaderboard',
      adminOnly: true,
      module: 'PULSE',
      defaultSpan: 3,
      render(el) {
        const history = loadHistory();
        const repMap = {};
        history.forEach(h => {
          if (!h.rep) return;
          const ms = h.callDate ? new Date(h.callDate).getTime() : new Date(h.ts).getTime();
          if (!repMap[h.rep]) repMap[h.rep] = { calls:[], initials: h.rep.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() };
          const s = h.normalized_score||h.total;
          if (s>0) repMap[h.rep].calls.push({score:s,ms});
        });
        const reps = Object.entries(repMap).map(([name,d]) => {
          const sorted=d.calls.sort((a,b)=>a.ms-b.ms);
          const scores=sorted.map(c=>c.score);
          const avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
          const mid=Math.ceil(scores.length/2);
          const f=scores.slice(0,mid),s=scores.slice(mid);
          const delta=Math.round((s.length?s.reduce((a,b)=>a+b,0)/s.length:avg)-(f.reduce((a,b)=>a+b,0)/f.length));
          return {name,initials:d.initials,avg,calls:scores.length,delta};
        }).filter(r=>r.calls>0).sort((a,b)=>b.avg-a.avg);
        if (!reps.length) { el.innerHTML='<div style="font-size:13px;color:rgba(255,255,255,0.2);padding:.75rem 0;">No data yet.</div>'; return; }
        const top=reps[0].avg;
        el.innerHTML=reps.map((r,i)=>{
          const barW=Math.round((r.avg/Math.max(top,1))*100);
          const tc=r.delta>2?'up':r.delta<-2?'down':'flat';
          const tl=r.delta>2?`▲${r.delta}`:r.delta<-2?`▼${Math.abs(r.delta)}`:'—';
          return `<div class="dash-rep-row">
            <span class="dash-rep-rank">${i+1}</span>
            <div class="dash-rep-avatar">${escHtml(r.initials)}</div>
            <span class="dash-rep-name" title="${escHtml(r.name)}">${escHtml(r.name)}</span>
            <div class="dash-rep-track"><div class="dash-rep-fill" style="width:${barW}%;"></div></div>
            <span class="dash-rep-score">${r.avg}</span>
            <span class="dash-rep-trend ${tc}">${tl}</span>
          </div>`;
        }).join('');
      },
    },

    // ── COACH tiles ───────────────────────────────────────────
    {
      id: 'coach_strengths',
      label: 'Reoccurring Strengths',
      module: 'COACH',
      defaultSpan: 2,
      render(el) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('siren_coach_insights_') && k.endsWith('_90'));
        if (!keys.length) { el.innerHTML='<div style="font-size:13px;color:rgba(255,255,255,0.2);">Open COACH to generate strengths for a rep.</div>'; return; }
        let html = '';
        keys.forEach(k => {
          try {
            const d=JSON.parse(localStorage.getItem(k));
            if (!d||!d.strengthsHtml) return;
            const rep=k.replace('siren_coach_insights_','').replace('_90','').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
            html+=`<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:6px;">${escHtml(rep)}</div>${d.strengthsHtml}</div>`;
          } catch {}
        });
        el.innerHTML=html||'<div style="font-size:13px;color:rgba(255,255,255,0.2);">No cached strengths yet.</div>';
      },
    },

    {
      id: 'coach_focus',
      label: 'Priority Focus Areas',
      module: 'COACH',
      defaultSpan: 2,
      render(el) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('siren_coach_insights_') && k.endsWith('_90'));
        if (!keys.length) { el.innerHTML='<div style="font-size:13px;color:rgba(255,255,255,0.2);">Open COACH to generate focus areas for a rep.</div>'; return; }
        let html = '';
        keys.forEach(k => {
          try {
            const d=JSON.parse(localStorage.getItem(k));
            if (!d||!d.focusHtml) return;
            const rep=k.replace('siren_coach_insights_','').replace('_90','').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
            html+=`<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:6px;">${escHtml(rep)}</div>${d.focusHtml}</div>`;
          } catch {}
        });
        el.innerHTML=html||'<div style="font-size:13px;color:rgba(255,255,255,0.2);">No cached focus areas yet.</div>';
      },
    },

    // ── USAGE tiles ───────────────────────────────────────────
    {
      id: 'usage_by_feature',
      label: 'Spend by Feature',
      adminOnly: true,
      module: 'USAGE',
      defaultSpan: 2,
      async render(el) {
        el.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.2);">Loading…</div>';
        try {
          const rows = await fetch('/api/usage/by-feature?days=30').then(r=>r.json());
          if (!rows.length) { el.innerHTML='<div style="font-size:13px;color:rgba(255,255,255,0.2);">No feature spend in the last 30 days.</div>'; return; }
          const total=rows.reduce((s,r)=>s+r.cost,0);
          const fmtCost=c=>c>=1?'$'+c.toFixed(2):'$'+c.toFixed(4).replace(/0+$/,'').replace(/\.$/,'.00');
          const COLORS={COACH:'#a78bfa',ENGAGE:'#00c8ff',FORGE:'#f59e0b',ATLAS:'#34d399',USAGE:'#64748b'};
          el.innerHTML=rows.map(r=>{
            const pct=total>0?Math.round(r.cost/total*100):0;
            const col=COLORS[r.feature]||'rgba(255,255,255,.3)';
            return `<div class="dash-feature-row">
              <div class="dash-feature-name">${escHtml(r.feature)}</div>
              <div class="dash-feature-bar-wrap"><div class="dash-feature-bar" style="width:${Math.max(pct,1)}%;background:${col};"></div></div>
              <div class="dash-feature-pct">${pct}%</div>
              <div class="dash-feature-cost">${fmtCost(r.cost)}</div>
            </div>`;
          }).join('');
        } catch(e) {
          el.innerHTML=`<div style="font-size:12px;color:#ef4444;">Failed: ${escHtml(e.message)}</div>`;
        }
      },
    },

    {
      id: 'usage_spend',
      label: 'API Spend (30d)',
      adminOnly: true,
      module: 'USAGE',
      defaultSpan: 2,
      async render(el) {
        el.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.2);">Loading…</div>';
        try {
          const metrics = await fetch('/api/usage-metrics?days=30').then(r=>r.json());
          const rows = metrics.rows||[];
          const byDay={};
          rows.forEach(r=>{ const d=byDay[r.day]=byDay[r.day]||{cost:0}; d.cost+=r.cost; });
          const dayList=[];
          for(let i=29;i>=0;i--) {
            const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10);
            dayList.push({day,...(byDay[day]||{cost:0})});
          }
          const maxCost=Math.max(...dayList.map(d=>d.cost),0.0001);
          const fmtDay=d=>new Date(d+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'});
          const fmtCost=c=>c>=1?'$'+c.toFixed(2):'$'+c.toFixed(4).replace(/0+$/,'').replace(/\.$/,'.00');
          el.innerHTML=`<div style="display:flex;align-items:flex-end;gap:2px;height:100px;">
            ${dayList.map(d=>`<div title="${fmtDay(d.day)} — ${fmtCost(d.cost)}" style="flex:1;min-width:2px;height:${d.cost>0?Math.max(3,Math.round(d.cost/maxCost*100)):0}%;background:rgba(0,200,255,${d.cost>0?'.75':'0'});border-radius:2px 2px 0 0;${d.cost===0?'border-bottom:2px solid rgba(255,255,255,.06);':''}"></div>`).join('')}
          </div>`;
        } catch(e) {
          el.innerHTML=`<div style="font-size:12px;color:#ef4444;">Failed: ${escHtml(e.message)}</div>`;
        }
      },
    },
  ];

  // ── Config persistence ─────────────────────────────────────────────────────
  function _dashLoadConfig() {
    try { return JSON.parse(localStorage.getItem(_DASH_KEY)); } catch { return null; }
  }
  function _dashSaveConfig(cfg) {
    localStorage.setItem(_DASH_KEY, JSON.stringify(cfg));
  }
  function _dashGetTiles() {
    const cfg = _dashLoadConfig();
    return cfg && Array.isArray(cfg.tiles) ? cfg.tiles : _DASH_DEFAULTS;
  }

  // ── Render dashboard ───────────────────────────────────────────────────────
  let _dashEditMode = false;

  function dashInit() {
    _dashRender();
  }
  window.dashInit = dashInit;

  function _dashRender() {
    const grid = document.getElementById('dashGrid');
    if (!grid) return;
    const isAdmin = window.sirenIsAdmin ? window.sirenIsAdmin() : true;
    const allTiles = _dashGetTiles();
    // Non-admins never see adminOnly tiles regardless of saved config
    const tiles = isAdmin ? allTiles : allTiles.filter(slot => {
      const def = _DASH_TILES.find(t => t.id === slot.id);
      return def && !def.adminOnly;
    });
    grid.innerHTML = '';
    tiles.forEach((slot, idx) => {
      const def = _DASH_TILES.find(t => t.id === slot.id);
      if (!def) return;
      const span = slot.span || def.defaultSpan || 1;
      const card = document.createElement('div');
      card.className = 'dash-tile';
      card.style.gridColumn = `span ${span * 4}`;
      card.dataset.idx = idx;
      card.innerHTML = `
        <div class="dash-tile-hdr">
          <span class="dash-tile-badge">${escHtml(def.module)}</span>
          <span class="dash-tile-title">${escHtml(def.label)}</span>
          <div class="dash-tile-edit-ctrls" style="display:${_dashEditMode?'flex':'none'};">
            <button class="dash-ctrl-btn" title="Narrower" onclick="dashResizeTile(${idx},-1)">◀</button>
            <button class="dash-ctrl-btn" title="Wider" onclick="dashResizeTile(${idx},1)">▶</button>
            <button class="dash-ctrl-btn dash-ctrl-remove" title="Remove" onclick="dashRemoveTile(${idx})">✕</button>
          </div>
        </div>
        <div class="dash-tile-body" id="dash-body-${idx}"></div>`;
      grid.appendChild(card);
      const body = document.getElementById('dash-body-' + idx);
      try { Promise.resolve(def.render(body)).catch(()=>{}); } catch {}
    });
  }

  window.dashToggleEdit = function() {
    _dashEditMode = !_dashEditMode;
    const btn = document.getElementById('dashEditBtn');
    if (btn) btn.textContent = _dashEditMode ? 'Done' : 'Edit Dashboard';
    const addBar = document.getElementById('dashAddBar');
    if (addBar) addBar.style.display = _dashEditMode ? '' : 'none';
    _dashRender();
  };

  window.dashRemoveTile = function(idx) {
    const tiles = _dashGetTiles();
    tiles.splice(idx, 1);
    _dashSaveConfig({ tiles });
    _dashRender();
  };

  window.dashResizeTile = function(idx, delta) {
    const tiles = _dashGetTiles();
    const slot = tiles[idx];
    const def = _DASH_TILES.find(t => t.id === slot.id);
    const cur = slot.span || (def && def.defaultSpan) || 1;
    slot.span = Math.max(1, Math.min(3, cur + delta));
    _dashSaveConfig({ tiles });
    _dashRender();
  };

  // ── Tile picker ────────────────────────────────────────────────────────────
  window.dashOpenPicker = function() {
    document.getElementById('dashPickerModal').style.display = 'flex';
    _dashRenderPicker();
  };
  window.dashClosePicker = function() {
    document.getElementById('dashPickerModal').style.display = 'none';
  };
  window.dashAddTile = function(id) {
    const def = _DASH_TILES.find(t => t.id === id);
    if (!def) return;
    const tiles = _dashGetTiles();
    tiles.push({ id, span: def.defaultSpan || 1 });
    _dashSaveConfig({ tiles });
    dashClosePicker();
    _dashRender();
  };

  function _dashRenderPicker() {
    const list = document.getElementById('dashPickerList');
    if (!list) return;
    const isAdmin = window.sirenIsAdmin ? window.sirenIsAdmin() : true;
    const availableTiles = isAdmin ? _DASH_TILES : _DASH_TILES.filter(t => !t.adminOnly);
    const current = new Set(_dashGetTiles().map(t => t.id));
    const byModule = {};
    availableTiles.forEach(t => { (byModule[t.module] = byModule[t.module]||[]).push(t); });
    list.innerHTML = Object.entries(byModule).map(([mod, tiles]) =>
      `<div class="dpick-module-hdr">${escHtml(mod)}</div>` +
      tiles.map(t => `
        <div class="dpick-tile-row">
          <div class="dpick-tile-info">
            <div class="dpick-tile-name">${escHtml(t.label)}</div>
          </div>
          <button class="dpick-add-btn" ${current.has(t.id)?'disabled title="Already on dashboard"':''} onclick="dashAddTile('${t.id}')">
            ${current.has(t.id) ? '✓ Added' : '+ Add'}
          </button>
        </div>`).join('')
    ).join('');
  }
