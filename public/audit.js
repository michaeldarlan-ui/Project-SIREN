// ── AUDIT LOG MODULE ──────────────────────────────────────────────────────────

  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let _auditRows = [];

  const AUDIT_META = {
    grade:            { label: 'Initial Grade',      color: '#22c55e',  bg: 'rgba(34,197,94,.1)',    icon: '✦' },
    regrade:          { label: 'Re-grade',           color: '#00c8ff',  bg: 'rgba(0,200,255,.1)',    icon: '↺' },
    bulk_regrade:     { label: 'Bulk Re-grade',      color: '#818cf8',  bg: 'rgba(129,140,248,.1)',  icon: '⟳' },
    delete:           { label: 'History Deleted',    color: '#ef4444',  bg: 'rgba(239,68,68,.1)',    icon: '✕' },
    clear_history:    { label: 'History Cleared',    color: '#ef4444',  bg: 'rgba(239,68,68,.12)',   icon: '⊘' },
    transcript_delete:{ label: 'Transcript Deleted', color: '#f97316',  bg: 'rgba(249,115,22,.1)',   icon: '✕' },
  };

  window.auditLoad = async function() {
    const listEl = document.getElementById('auditList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:rgba(255,255,255,.2);font-size:13px;padding:12px 0;">Loading…</div>';
    try {
      _auditRows = await fetch('/api/audit?limit=500').then(r => r.json());

      // Auto-backfill on first load if the log has no grade events yet
      const hasGrades = _auditRows.some(r => r.action === 'grade');
      if (!hasGrades) {
        try { await auditBackfill(true); } catch {}
        // auditBackfill updates _auditRows and calls auditRender — but fall through as a safety net
        return;
      }

      auditRender();
    } catch (e) {
      listEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Failed to load audit log: ${_esc(e.message)}</div>`;
    }
  };

  window.auditBackfill = async function(silent = false) {
    const btn = document.getElementById('auditBackfillBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Backfilling…'; }
    const listEl = document.getElementById('auditList');
    if (!silent && listEl) listEl.innerHTML = '<div style="color:rgba(255,255,255,.2);font-size:13px;padding:12px 0;">Importing history records…</div>';
    try {
      const res  = await fetch('/api/audit/backfill', { method: 'POST' });
      const data = await res.json();
      // Reload the full log after backfill
      _auditRows = await fetch('/api/audit?limit=500').then(r => r.json());
      auditRender();
      if (!silent && data.inserted > 0) {
        const notice = document.getElementById('auditBackfillNotice');
        if (notice) {
          notice.textContent = `✓ Imported ${data.inserted} historical grade${data.inserted !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} already present)` : ''}.`;
          notice.style.display = 'block';
          setTimeout(() => { notice.style.display = 'none'; }, 4000);
        }
      }
    } catch (e) {
      if (listEl) listEl.innerHTML = `<div style="color:#ef4444;font-size:13px;">Backfill failed: ${_esc(e.message)}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Import History'; }
    }
  };

  window.auditRender = function() {
    const listEl = document.getElementById('auditList');
    if (!listEl) return;
    const filter = document.getElementById('auditFilterSel')?.value || 'all';
    const rows   = filter === 'all' ? _auditRows : _auditRows.filter(r => r.action === filter);

    if (!rows.length) {
      listEl.innerHTML = `<div style="color:rgba(255,255,255,.2);font-size:13px;padding:20px 0;text-align:center;">${filter === 'all' ? 'No audit events recorded yet.' : 'No events with this action type.'}</div>`;
      return;
    }

    // Group by calendar day
    const groups = [];
    let lastDay = '';
    for (const row of rows) {
      const day = row.created_at.slice(0, 10);
      if (day !== lastDay) { groups.push({ day, rows: [] }); lastDay = day; }
      groups[groups.length - 1].rows.push(row);
    }

    const fmtDay = d => {
      const dt = new Date(d + 'T12:00:00');
      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (d === today)     return 'Today';
      if (d === yesterday) return 'Yesterday';
      return dt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const fmtTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    listEl.innerHTML = groups.map(g => `
      <div style="margin-bottom:20px;">
        <div style="font-family:var(--siren-font-hud);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--siren-text-muted);margin-bottom:10px;">${_esc(fmtDay(g.day))}</div>
        ${g.rows.map(row => {
          const m = AUDIT_META[row.action] || { label: row.action, color: 'rgba(255,255,255,.4)', bg: 'rgba(255,255,255,.05)', icon: '·' };
          const isBackfilled = row.details?.backfilled === true;
          const gradeChip = row.letter_grade
            ? `<span style="font-family:var(--siren-font-hud);font-size:11px;font-weight:800;color:${m.color};margin-left:6px;">${_esc(row.letter_grade)}</span>`
            : '';
          const scoreChip = row.score
            ? `<span style="font-size:11px;color:rgba(255,255,255,.35);margin-left:4px;">${_esc(row.score)}%</span>`
            : '';
          const repChip = row.rep
            ? `<span style="font-size:11px;color:rgba(255,255,255,.45);">${_esc(row.rep)}</span>`
            : '';
          const stageChip = row.stage
            ? `<span style="font-size:10px;color:rgba(255,255,255,.25);font-family:var(--siren-font-hud);">${_esc(row.stage)}</span>`
            : '';
          const backfilledChip = isBackfilled
            ? `<span style="font-size:9px;color:rgba(255,255,255,.2);font-family:var(--siren-font-hud);letter-spacing:.06em;margin-left:4px;">IMPORTED</span>`
            : '';
          const detailTip = row.details?.grade_label
            ? `<div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px;font-style:italic;">${_esc(row.details.grade_label)}</div>`
            : (row.details?.count != null
              ? `<div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px;">${row.details.count} records removed</div>`
              : (row.details?.batch_total != null
                ? `<div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px;">Batch ${row.details.batch_index} of ${row.details.batch_total}</div>`
                : ''));
          return `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.06);margin-bottom:5px;background:rgba(255,255,255,.02);">
              <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:${m.bg};flex-shrink:0;font-size:13px;color:${m.color};font-weight:700;">${m.icon}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:10px;font-weight:700;letter-spacing:.08em;font-family:var(--siren-font-hud);color:${m.color};background:${m.bg};padding:2px 7px;border-radius:3px;">${_esc(m.label)}</span>
                  ${row.entity_label ? `<span style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85);">${_esc(row.entity_label)}</span>` : ''}
                  ${gradeChip}${scoreChip}${backfilledChip}
                </div>
                <div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap;">
                  ${repChip}${stageChip}
                </div>
                ${detailTip}
              </div>
              <div style="font-size:10px;color:rgba(255,255,255,.2);white-space:nowrap;flex-shrink:0;padding-top:2px;">${_esc(fmtTime(row.created_at))}</div>
            </div>`;
        }).join('')}
      </div>`).join('');
  };
