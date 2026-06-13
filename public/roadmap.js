  // ── ROADMAP & FEATURE REQUESTS ─────────────────────────────
  let _rdmItems = [];

  async function rdmInit() {
    // One-time migration from localStorage to DB
    if (!localStorage.getItem('oa_roadmap_migrated')) {
      try {
        const local = JSON.parse(localStorage.getItem('oa_roadmap_items') || '[]');
        for (const item of local.reverse()) {
          await fetch('/api/roadmap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: item.title, desc: item.desc || '', status: item.status || 'planned' }),
          });
        }
      } catch (e) { console.warn('[roadmap] migration failed', e.message); }
      localStorage.setItem('oa_roadmap_migrated', 'v1');
    }
    await rdmFetch();
  }

  async function rdmFetch() {
    try {
      const res = await fetch('/api/roadmap');
      _rdmItems = await res.json();
    } catch (e) { console.warn('[roadmap] fetch failed', e.message); }
    rdmRender();
  }

  async function rdmAdd() {
    const titleEl  = document.getElementById('rdmTitle');
    const descEl   = document.getElementById('rdmDesc');
    const statusEl = document.getElementById('rdmStatus');
    const title  = titleEl?.value.trim();
    const desc   = descEl?.value.trim();
    const status = statusEl?.value || 'planned';
    if (!title) { titleEl?.focus(); return; }

    try {
      await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, desc, status }),
      });
      if (titleEl) titleEl.value = '';
      if (descEl)  descEl.value  = '';
      await rdmFetch();
    } catch (e) { console.error('[roadmap] add failed', e.message); }
  }

  async function rdmSetStatus(id, status) {
    try {
      await fetch(`/api/roadmap/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await rdmFetch();
    } catch (e) { console.error('[roadmap] status update failed', e.message); }
  }

  async function rdmDelete(id) {
    try {
      await fetch(`/api/roadmap/${id}`, { method: 'DELETE' });
      await rdmFetch();
    } catch (e) { console.error('[roadmap] delete failed', e.message); }
  }

  function rdmRender() {
    const el = document.getElementById('rdmList');
    if (!el) return;
    const filter = document.getElementById('rdmFilterSel')?.value || 'all';
    const items  = filter === 'all' ? _rdmItems : _rdmItems.filter(i => i.status === filter);

    if (!items.length) {
      el.innerHTML = `<div style="font-size:13px;color:rgba(255,255,255,.25);padding:20px 0;text-align:center;">${filter === 'all' ? 'No items yet — add a feature request above.' : 'No items with this status.'}</div>`;
      return;
    }

    const statusMeta = {
      'planned':     { label: 'PLANNED',     color: 'rgba(255,255,255,.4)',  bg: 'rgba(255,255,255,.06)' },
      'in-progress': { label: 'IN PROGRESS', color: '#e8a020',               bg: 'rgba(232,160,32,.1)'   },
      'done':        { label: 'DONE',         color: '#22c55e',               bg: 'rgba(34,197,94,.1)'    },
    };

    el.innerHTML = items.map(item => {
      const s    = statusMeta[item.status] || statusMeta['planned'];
      const date = new Date(item.ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `<div class="rdm-item">
        <div class="rdm-item-top">
          <div style="flex:1;min-width:0;">
            <div class="rdm-item-title">${escHtml(item.title)}</div>
            ${item.desc ? `<div class="rdm-item-desc">${escHtml(item.desc)}</div>` : ''}
            <div class="rdm-item-meta">${date}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <select onchange="rdmSetStatus(${item.id}, this.value)"
              style="background:${s.bg};border:1px solid ${s.color}55;color:${s.color};border-radius:5px;font-size:10px;font-weight:700;font-family:var(--siren-font-hud);letter-spacing:.06em;padding:3px 8px;cursor:pointer;outline:none;">
              <option value="planned"     ${item.status==='planned'     ?'selected':''}>PLANNED</option>
              <option value="in-progress" ${item.status==='in-progress' ?'selected':''}>IN PROGRESS</option>
              <option value="done"        ${item.status==='done'        ?'selected':''}>DONE</option>
            </select>
            <button onclick="rdmDelete(${item.id})" title="Remove"
              style="background:none;border:none;color:rgba(255,255,255,.2);cursor:pointer;font-size:16px;padding:0 2px;line-height:1;"
              onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='rgba(255,255,255,.2)'">×</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Called by navTo('settings')
  window.rdmRender = rdmRender;

  // Init on first nav to settings
  let _rdmInited = false;
  const _rdmOrigRender = window.rdmRender;
  window.rdmRender = function() {
    if (!_rdmInited) { _rdmInited = true; rdmInit(); return; }
    _rdmOrigRender();
  };

  // Enter key in title field
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rdmTitle')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') rdmAdd();
    });
  });
