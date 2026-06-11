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

