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

      const industry = _getProspectIndustry(company);
      const cSafe = company.replace(/\\/g,'\\\\').replace(/'/g,"\\'");

      html += `<div class="lc-sb-section">
        <div class="lc-sb-section-label">Account Overview</div>
        <div class="lc-sb-row"><span class="lc-sb-key">Total Calls</span><span class="lc-sb-val">${calls.length}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Avg Score</span><span class="lc-sb-val">${avg}${avg!=='—'?'/100':''}</span></div>
        <div class="lc-sb-row"><span class="lc-sb-key">Stages</span><span class="lc-sb-val" style="text-align:right;">${stages.join(', ')||'—'}</span></div>
      </div>
      <div class="lc-profile-divider"></div>
      <div class="lc-sb-section">
        <div class="lc-sb-section-label">Account Settings</div>
        <div style="margin-bottom:10px;">
          <div class="lc-sb-key" style="margin-bottom:5px;">Account Name</div>
          <div style="display:flex;gap:6px;">
            <input id="atlas-acct-name" class="lc-profile-input" style="flex:1;" value="${escHtml(company)}" onkeydown="if(event.key==='Enter')atlasRenameAccount('${cSafe}')"/>
            <button class="lc-profile-add-btn" onclick="atlasRenameAccount('${cSafe}')" title="Save name">✓</button>
          </div>
        </div>
        <div>
          <div class="lc-sb-key" style="margin-bottom:5px;">Industry</div>
          <div style="display:flex;gap:6px;">
            <input id="atlas-acct-industry" class="lc-profile-input" style="flex:1;" value="${escHtml(industry)}" placeholder="e.g. Healthcare" onkeydown="if(event.key==='Enter')atlasSetIndustry('${cSafe}')"/>
            <button class="lc-profile-add-btn" onclick="atlasSetIndustry('${cSafe}')" title="Save industry">✓</button>
          </div>
        </div>
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

      // ── Deal Status ──
      const dealStatus = prof.deal_status || 'active';
      html += `<div class="lc-profile-divider"></div>
      <div class="lc-sb-section">
        <div class="lc-sb-section-label">Deal Status</div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="lc-deal-status-btn${dealStatus==='active'?' active':''}" onclick="atlasSetDealStatus('${cSafe}','active')">Active</button>
          <button class="lc-deal-status-btn won${dealStatus==='won'?' active':''}" onclick="atlasSetDealStatus('${cSafe}','won')">Closed Won</button>
          <button class="lc-deal-status-btn lost${dealStatus==='lost'?' active':''}" onclick="atlasSetDealStatus('${cSafe}','lost')">Closed Lost</button>
        </div>
        ${dealStatus==='won'||dealStatus==='lost' ? `
        <div style="margin-top:10px;">
          <button class="lc-sb-btn lc-sb-btn-primary" style="width:100%;" onclick="atlasGenerateDealReport('${cSafe}')">
            ${dealStatus==='won'?'&#9733; Generate Success Report':'&#9888; Generate Post Mortem'}
          </button>
        </div>` : ''}
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

  // ── Deal Status ──────────────────────────────────────────────
  function atlasSetDealStatus(company, status) {
    const prof = loadAccountProfile(company);
    prof.deal_status = status;
    saveAccountProfile(company, prof);
    lcSelectNode('account'); // re-render sidebar
  }

  let _atlasRadarRaf = null;

  function _atlasStartRadar() {
    const canvas = document.getElementById('atlasRadarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 70, cy = 70, r = 64;
    const G = 'rgba(0,200,255,';
    let angle = 0;
    const blips = [
      { a: 1.1, d: 0.55, c: G },
      { a: 3.4, d: 0.38, c: G },
      { a: 5.2, d: 0.72, c: 'rgba(232,160,32,' },
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
      _atlasRadarRaf = requestAnimationFrame(draw);
    }
    draw();
  }

  function _atlasStopRadar() {
    if (_atlasRadarRaf) { cancelAnimationFrame(_atlasRadarRaf); _atlasRadarRaf = null; }
  }

  function _atlasSetStep(idx, state) {
    const step = document.getElementById('ar-step-' + idx);
    const icon = document.getElementById('ar-icon-' + idx);
    const bar  = document.getElementById('ar-bar-'  + idx);
    if (!step) return;
    step.classList.remove('visible','active','done');
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

  async function atlasGenerateDealReport(company) {
    const prof = loadAccountProfile(company);
    const status = prof.deal_status;
    if (status !== 'won' && status !== 'lost') return;

    const entries = loadHistory()
      .filter(h => (h.prospect||'').trim().toLowerCase() === company.toLowerCase())
      .sort((a,b) => { const da=a.callDate||a.ts.slice(0,10), db=b.callDate||b.ts.slice(0,10); return da<db?-1:da>db?1:0; });

    const modal    = document.getElementById('atlasReportModal');
    const titleEl  = document.getElementById('atlasReportModalTitle');
    const loadEl   = document.getElementById('atlasReportLoading');
    const bodyEl   = document.getElementById('atlasReportModalBody');
    const ctxLabel = document.getElementById('atlasLoadCtx');
    if (!modal||!titleEl||!bodyEl||!loadEl) return;

    const reportType = status === 'won' ? 'Closed Won Success Report' : 'Closed Lost Post Mortem';
    titleEl.textContent = `${reportType} — ${company}`;
    if (ctxLabel) ctxLabel.textContent = status === 'won' ? 'WIN ANALYSIS' : 'LOSS ANALYSIS';

    // Show loading, hide body
    loadEl.style.display = 'flex';
    bodyEl.style.display = 'none';
    bodyEl.innerHTML = '';
    const dlBtn = document.getElementById('atlasReportDownloadBtn');
    if (dlBtn) dlBtn.style.display = 'none';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Init steps
    [0,1,2,3].forEach(i => {
      const s = document.getElementById('ar-step-' + i);
      if (s) { s.classList.remove('active','done'); s.classList.add('visible'); }
      const b = document.getElementById('ar-bar-' + i);
      if (b) b.style.width = '0%';
      const ic = document.getElementById('ar-icon-' + i);
      if (ic) ic.textContent = '○';
    });

    _atlasStartRadar();
    _atlasSetStep(0, 'active');
    await new Promise(r => setTimeout(r, 600));
    _atlasSetStep(0, 'done'); _atlasSetStep(1, 'active');
    await new Promise(r => setTimeout(r, 700));
    _atlasSetStep(1, 'done'); _atlasSetStep(2, 'active');
    await new Promise(r => setTimeout(r, 800));
    _atlasSetStep(2, 'done'); _atlasSetStep(3, 'active');

    // Build call history summary for the prompt
    const callSummaries = entries.map((h,i) => {
      const ds = h.callDate || h.ts.slice(0,10);
      return `Call ${i+1} (${ds}, ${h.stage||'unknown stage'}): Grade ${h.letter_grade} ${h.total}/100. Strength: ${h.top_strength||'n/a'}. Priority: ${h.top_priority||'n/a'}.${h.overview ? ' Summary: ' + h.overview : ''}`;
    }).join('\n');

    const profileContext = [
      prof.champion ? `Champion: ${prof.champion.name}${prof.champion.title?' ('+prof.champion.title+')':''}` : '',
      (prof.contacts||[]).length ? `Key contacts: ${prof.contacts.map(c=>c.name+(c.title?' ('+c.title+')':'')).join(', ')}` : '',
      (prof.competitors||[]).length ? `Competitors: ${prof.competitors.join(', ')}` : '',
      (prof.techstack||[]).length ? `Tech stack: ${prof.techstack.join(', ')}` : '',
      _getProspectIndustry(company) ? `Industry: ${_getProspectIndustry(company)}` : '',
    ].filter(Boolean).join('\n');

    const prompt = status === 'won'
      ? `You are a sales excellence analyst for OneAxiom, a Houston-based MSSP. Write a Closed Won Success Report for the ${company} deal.

Account context:
${profileContext || 'No profile data available.'}

Call history (${entries.length} calls):
${callSummaries || 'No call history available.'}

Write a structured success report with these sections:
1. **Deal Summary** — what was sold, timeline, key metrics (avg score, number of calls)
2. **What Worked** — 3–5 specific factors that drove the win (reference actual call data)
3. **Champion & Stakeholder Dynamics** — how internal advocates were identified and leveraged
4. **Competitive Positioning** — how OneAxiom differentiated against competitors
5. **Replicable Playbook** — 3–5 concrete tactics this rep used that other reps should adopt
6. **Coaching Notes** — any areas where execution could have been stronger even in a win

Format in clean markdown. Be specific — cite call stages, grades, and actual strengths where available. Avoid generic sales advice.`
      : `You are a sales excellence analyst for OneAxiom, a Houston-based MSSP. Write a Closed Lost Post Mortem for the ${company} deal.

Account context:
${profileContext || 'No profile data available.'}

Call history (${entries.length} calls):
${callSummaries || 'No call history available.'}

Write a structured post mortem with these sections:
1. **Deal Summary** — what was pursued, timeline, key metrics (avg score, number of calls)
2. **Root Cause Analysis** — the 2–3 most likely reasons this deal was lost (reference call data)
3. **Early Warning Signs** — signals from the call history that predicted the loss
4. **Where the Rep Got Stuck** — specific execution gaps across the call progression
5. **Competitive & Positioning Gaps** — where OneAxiom failed to differentiate
6. **What to Do Differently** — 3–5 specific changes for similar deals in the future

Format in clean markdown. Be specific — cite call stages, grades, and actual weaknesses where available. Do not soften the analysis.`;

    try {
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
      const md = (data.content?.[0]?.text || '').trim();
      _atlasSetStep(3, 'done');
      await new Promise(r => setTimeout(r, 400));
      _atlasStopRadar();
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = _mdToHtml(md);
      const dlBtn = document.getElementById('atlasReportDownloadBtn');
      if (dlBtn) dlBtn.style.display = '';
    } catch (e) {
      _atlasStopRadar();
      loadEl.style.display = 'none';
      bodyEl.style.display = '';
      bodyEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Error generating report: ${escHtml(e.message)}</div>`;
    }
  }

  // Minimal markdown → HTML for report display
  function _mdToHtml(md) {
    return md
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/^### (.+)$/gm,'<h3 style="color:var(--siren-cyan-90);font-size:14px;margin:18px 0 6px;">$1</h3>')
      .replace(/^## (.+)$/gm,'<h2 style="color:var(--siren-cyan-90);font-size:15px;margin:20px 0 8px;">$1</h2>')
      .replace(/^# (.+)$/gm,'<h1 style="color:var(--siren-cyan-90);font-size:17px;margin:20px 0 8px;">$1</h1>')
      .replace(/^[-*] (.+)$/gm,'<li style="margin-bottom:4px;">$1</li>')
      .replace(/(<li[\s\S]*?<\/li>)/g,'<ul style="padding-left:18px;margin:6px 0;">$1</ul>')
      .replace(/\n{2,}/g,'</p><p style="margin:8px 0;">')
      .replace(/^(.)/,'<p style="margin:8px 0;">$1')
      .replace(/(.)$/,'$1</p>');
  }

  window.closeAtlasReportModal = function() {
    _atlasStopRadar();
    document.getElementById('atlasReportModal').classList.remove('open');
    document.body.style.overflow = '';
  };

  window.atlasDownloadReport = function() {
    const title = document.getElementById('atlasReportModalTitle').textContent || 'Deal Report';
    const bodyEl = document.getElementById('atlasReportModalBody');
    if (!bodyEl || bodyEl.style.display === 'none') return;
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${escHtml(title)}</title>
      <style>
        body { background:#fff; margin:0; padding:28px 36px; font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif; color:#0d1f2d; font-size:13px; line-height:1.65; }
        h1.pdf-title { font-size:15px; font-weight:700; color:#0d1f2d; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid rgba(0,0,0,.15); }
        h1,h2,h3 { color:#005580; }
        h1 { font-size:17px; margin:20px 0 8px; }
        h2 { font-size:15px; margin:18px 0 7px; }
        h3 { font-size:14px; margin:16px 0 6px; }
        p  { margin:8px 0; }
        ul { padding-left:18px; margin:6px 0; }
        li { margin-bottom:4px; }
        strong { color:#003d55; }
        @media print { body { padding:0; } @page { margin:16mm 14mm; } }
      </style>
    </head><body>
      <h1 class="pdf-title">${escHtml(title)}</h1>
      ${bodyEl.innerHTML}
      <script>
        window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });
        window.addEventListener('afterprint', function() { window.close(); });
      <\/script>
    </body></html>`);
    win.document.close();
  };
  window.atlasSetDealStatus = atlasSetDealStatus;
  window.atlasGenerateDealReport = atlasGenerateDealReport;

  // ── Account Profile storage ──
  function atlasRenameAccount(oldName) {
    const inp = document.getElementById('atlas-acct-name');
    if (!inp) return;
    const newName = inp.value.trim();
    if (!newName || newName === oldName) return;
    renameAccount(oldName, newName);
    // Re-populate dropdown with new name and re-render graph
    renderLifecyclePage();
    const sel = document.getElementById('lcCompanySelect');
    if (sel) { sel.value = newName; onLcCompanyChange(); }
    // Re-open account node sidebar with updated name
    setTimeout(() => lcSelectNode('account'), 80);
  }

  function atlasSetIndustry(company) {
    const inp = document.getElementById('atlas-acct-industry');
    if (!inp) return;
    const industry = inp.value.trim();
    _dbSaveProspect(company, { industry });
    inp.style.borderColor = 'rgba(34,197,94,.55)';
    setTimeout(() => { if (inp) inp.style.borderColor = ''; }, 1400);
  }

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

  function getHistoryEntry(id) { const sid=String(id); return loadHistory().find(h=>String(h.id)===sid)||null; }

  let _lcModalRecord = null;

  function openLcModal(id) {
    const h=getHistoryEntry(id);
    if (!h) return;
    _lcModalRecord = h;
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
      .replace(/<button[^>]*class="[^"]*reset-btn[^"]*"[\s\S]*?<\/button>/g,'')
      .replace(/<div class="rep-toggle">[\s\S]*?<\/div>\s*/,'')
      .replace(/class="score-view[^"]*"/g,'class="score-view active"');
    document.getElementById('lcModalBody').innerHTML=body||'<p style="color:var(--siren-text-faint);font-size:13px;">No detailed report available.</p>';
    const pdfBtn = document.getElementById('lcModalPdfBtn');
    if (pdfBtn) pdfBtn.style.display = h.resultsHtml ? '' : 'none';
    document.getElementById('lcModal').classList.add('open');
    document.body.style.overflow='hidden';
  }

  window.exportAtlasPDF = function() {
    if (!_lcModalRecord) return;
    const h = _lcModalRecord;
    const title = [h.prospect, h.stage, h.callDate].filter(Boolean).join(' — ');
    exportReportPDF(title, h.resultsHtml || '');
  };

  function closeLcModal() {
    document.getElementById('lcModal').classList.remove('open');
    document.body.style.overflow='';
  }

  function onLcModalOverlayClick(e) {
    if (e.target===document.getElementById('lcModal')) closeLcModal();
  }

  // Close modal on Escape key
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLcModal(); });

