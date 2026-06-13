  // ── ROADMAP & FEATURE REQUESTS ─────────────────────────────
  const RDM_KEY = 'oa_roadmap_items';

  function rdmLoad() {
    try { return JSON.parse(localStorage.getItem(RDM_KEY) || '[]'); } catch { return []; }
  }
  function rdmSave(items) {
    try { localStorage.setItem(RDM_KEY, JSON.stringify(items)); } catch {}
  }

  function rdmAdd() {
    const title  = document.getElementById('rdmTitle')?.value.trim();
    const desc   = document.getElementById('rdmDesc')?.value.trim();
    const status = document.getElementById('rdmStatus')?.value || 'planned';
    if (!title) { document.getElementById('rdmTitle')?.focus(); return; }
    const items = rdmLoad();
    items.unshift({ id: Date.now(), title, desc, status, ts: Date.now() });
    rdmSave(items);
    document.getElementById('rdmTitle').value = '';
    document.getElementById('rdmDesc').value = '';
    rdmRender();
  }

  function rdmSetStatus(id, status) {
    const items = rdmLoad().map(i => i.id === id ? { ...i, status } : i);
    rdmSave(items);
    rdmRender();
  }

  function rdmDelete(id) {
    rdmSave(rdmLoad().filter(i => i.id !== id));
    rdmRender();
  }

  function rdmRender() {
    const el = document.getElementById('rdmList');
    if (!el) return;
    const filter = document.getElementById('rdmFilterSel')?.value || 'all';
    let items = rdmLoad();
    if (filter !== 'all') items = items.filter(i => i.status === filter);

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
      const s = statusMeta[item.status] || statusMeta['planned'];
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
              style="background:${s.bg};border:1px solid ${s.color}33;color:${s.color};border-radius:5px;font-size:10px;font-weight:700;font-family:var(--siren-font-hud);letter-spacing:.06em;padding:3px 8px;cursor:pointer;outline:none;">
              <option value="planned"     ${item.status==='planned'     ?'selected':''}>PLANNED</option>
              <option value="in-progress" ${item.status==='in-progress' ?'selected':''}>IN PROGRESS</option>
              <option value="done"        ${item.status==='done'        ?'selected':''}>DONE</option>
            </select>
            <button onclick="rdmDelete(${item.id})" title="Remove"
              style="background:none;border:none;color:rgba(255,255,255,.2);cursor:pointer;font-size:16px;padding:0 2px;line-height:1;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='rgba(255,255,255,.2)'">×</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Allow Enter key in title field to add
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rdmTitle')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') rdmAdd();
    });
  });
