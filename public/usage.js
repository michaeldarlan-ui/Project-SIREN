// ── USAGE MODULE ──────────────────────────────────────────────────────────────
// Claude API metrics dashboard — mirrors the Claude Console usage page.
// Data source: /api/usage-metrics (per-day, per-model rows metered server-side)
// plus /api/usage for the console-mirror (month spend + credit balance).

  let _usageDays = 1;
  let _tokenGroupBy = 'token_type';

  window.usageSetPeriod = function(days) {
    _usageDays = days;
    document.querySelectorAll('#page-usage .cd-period-btn').forEach(b =>
      b.classList.toggle('cd-period-btn-active',
        b.textContent === (days === 1 ? 'Today' : days + 'd')));
    renderUsagePage();
  };

  window.usageSetTokenGroup = function(val) {
    _tokenGroupBy = val;
    renderUsagePage();
  };

  function _fmtTok(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function _fmtCost(c) {
    return c >= 100 ? '$' + c.toFixed(0) : c >= 1 ? '$' + c.toFixed(2) : '$' + c.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00');
  }
  function _shortModel(m) {
    return String(m || 'unknown')
      .replace(/^claude-/, '')
      .replace(/-\d{8}$/, '');
  }

  async function renderUsagePage() {
    let metrics, usage, featureRows;
    try {
      [metrics, usage, featureRows] = await Promise.all([
        fetch('/api/usage-metrics?days=' + _usageDays).then(r => r.json()),
        fetch('/api/usage').then(r => r.json()),
        fetch('/api/usage/by-feature?days=' + _usageDays).then(r => r.json()),
      ]);
    } catch (e) {
      document.getElementById('usageKpis').innerHTML =
        `<div style="grid-column:1/-1;color:#ef4444;font-size:13px;">Failed to load metrics: ${escHtml(e.message)}</div>`;
      return;
    }
    const rows = metrics.rows || [];

    // ── Aggregate totals for the period ──
    const tot = rows.reduce((a, r) => {
      a.cost += r.cost; a.calls += r.calls;
      a.tin += r.tokens_in; a.tout += r.tokens_out;
      a.cw += r.cache_write; a.cr += r.cache_read;
      return a;
    }, { cost: 0, calls: 0, tin: 0, tout: 0, cw: 0, cr: 0 });

    // ── KPI cards ──
    const card = (label, value, sub) => `
      <div class="cd-panel" style="padding:14px 16px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffffff;margin-bottom:6px;">${label}</div>
        <div style="font-size:22px;font-weight:800;color:#ffffff;">${value}</div>
        ${sub ? `<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;">${sub}</div>` : ''}
      </div>`;
    const consoleCards = usage.console
      ? card('Spend this month', _fmtCost(usage.console.monthSpend), 'mirrors Claude console') +
        card('Credit balance', _fmtCost(Math.max(0, usage.console.balance)), 'remaining')
      : card('Spend this month', _fmtCost((usage.month || {}).cost || 0), 'set baseline in Cost &amp; Usage');
    document.getElementById('usageKpis').innerHTML =
      consoleCards +
      card(`Spend (${_usageDays}d)`, _fmtCost(tot.cost), `${tot.calls} request${tot.calls !== 1 ? 's' : ''}`) +
      card('Tokens in', _fmtTok(tot.tin), tot.cw || tot.cr ? `+ cache: ${_fmtTok(tot.cw)} written · ${_fmtTok(tot.cr)} read` : '') +
      card('Tokens out', _fmtTok(tot.tout), '') +
      card('All-time', _fmtCost(usage.cost || 0), `${usage.calls || 0} request${usage.calls !== 1 ? 's' : ''}`);

    // ── Build continuous day list (zero-filled) ──
    const byDay = {};
    rows.forEach(r => {
      const d = byDay[r.day] = byDay[r.day] || { cost: 0, tin: 0, tout: 0, calls: 0 };
      d.cost += r.cost; d.tin += r.tokens_in; d.tout += r.tokens_out; d.calls += r.calls;
    });
    const dayList = [];
    for (let i = _usageDays - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dayList.push({ day, ...(byDay[day] || { cost: 0, tin: 0, tout: 0, calls: 0 }) });
    }
    const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });

    // ── Spend per day (bars) ──
    const maxCost = Math.max(...dayList.map(d => d.cost), 0.0001);
    document.getElementById('usageSpendHint').textContent =
      tot.cost > 0 ? `peak ${_fmtCost(maxCost)}` : 'no metered spend in this period yet';
    document.getElementById('usageSpendChart').innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:2px;height:120px;">
        ${dayList.map(d => `
          <div title="${fmtDay(d.day)} — ${_fmtCost(d.cost)} · ${d.calls} request${d.calls !== 1 ? 's' : ''}"
               style="flex:1;min-width:2px;height:${d.cost > 0 ? Math.max(3, Math.round(d.cost / maxCost * 100)) : 0}%;background:rgba(0,200,255,${d.cost > 0 ? '.75' : '0'});border-radius:2px 2px 0 0;${d.cost === 0 ? 'border-bottom:2px solid rgba(255,255,255,.06);' : ''}"></div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.6);margin-top:6px;">
        <span>${fmtDay(dayList[0].day)}</span><span>${fmtDay(dayList[dayList.length - 1].day)}</span>
      </div>`;

    // ── Tokens per day (grouped) ──
    // sync dropdown
    const tokGroupEl = document.getElementById('tokenGroupBy');
    if (tokGroupEl) tokGroupEl.value = _tokenGroupBy;

    const MODEL_COLORS = [
      'rgba(0,200,255,.8)', 'rgba(74,222,128,.8)', 'rgba(251,191,36,.8)',
      'rgba(248,113,113,.8)', 'rgba(167,139,250,.8)', 'rgba(251,146,60,.8)',
    ];

    if (_tokenGroupBy === 'model') {
      // Group by model — one color per model, stacked bars per day
      const modelNames = [...new Set(rows.map(r => r.model))].sort();
      const byDayModel = {};
      rows.forEach(r => {
        byDayModel[r.day] = byDayModel[r.day] || {};
        const d = byDayModel[r.day][r.model] = byDayModel[r.day][r.model] || { tin: 0, tout: 0 };
        d.tin += r.tokens_in; d.tout += r.tokens_out;
      });
      const maxTokM = Math.max(...dayList.map(d => {
        const dm = byDayModel[d.day] || {};
        return Object.values(dm).reduce((s, m) => s + m.tin + m.tout, 0);
      }), 1);
      // legend
      const legendEl = document.getElementById('usageTokenLegend');
      if (legendEl) legendEl.innerHTML = modelNames.slice(0, 6).map((m, i) =>
        `<span style="color:${MODEL_COLORS[i % MODEL_COLORS.length]}">&#9632;</span> ${escHtml(_shortModel(m))}`
      ).join(' &nbsp;');

      document.getElementById('usageTokenChart').innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:2px;height:120px;">
          ${dayList.map(d => {
            const dm = byDayModel[d.day] || {};
            const total = Object.values(dm).reduce((s, m) => s + m.tin + m.tout, 0);
            const segments = modelNames.map((model, i) => {
              const tok = ((dm[model] || {}).tin || 0) + ((dm[model] || {}).tout || 0);
              const h = tok > 0 ? Math.max(2, Math.round(tok / maxTokM * 100)) : 0;
              return h > 0 ? `<div style="height:${h}%;background:${MODEL_COLORS[i % MODEL_COLORS.length]};"></div>` : '';
            }).join('');
            return `<div title="${fmtDay(d.day)} — ${_fmtTok(total)} tokens"
                 style="flex:1;min-width:2px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
              ${segments || `<div style="border-bottom:2px solid rgba(255,255,255,.06);"></div>`}
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.6);margin-top:6px;">
          <span>${fmtDay(dayList[0].day)}</span><span>${fmtDay(dayList[dayList.length - 1].day)}</span>
        </div>`;
    } else {
      // Token Type (default) — stacked input/output
      const legendEl = document.getElementById('usageTokenLegend');
      if (legendEl) legendEl.innerHTML = '<span style="color:#00c8ff;">&#9632;</span> input &nbsp;<span style="color:#4ade80;">&#9632;</span> output';
      const maxTok = Math.max(...dayList.map(d => d.tin + d.tout), 1);
      document.getElementById('usageTokenChart').innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:2px;height:120px;">
          ${dayList.map(d => {
            const hIn  = d.tin  > 0 ? Math.max(2, Math.round(d.tin  / maxTok * 100)) : 0;
            const hOut = d.tout > 0 ? Math.max(2, Math.round(d.tout / maxTok * 100)) : 0;
            return `<div title="${fmtDay(d.day)} — in ${_fmtTok(d.tin)} · out ${_fmtTok(d.tout)}"
                 style="flex:1;min-width:2px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
              <div style="height:${hOut}%;background:rgba(74,222,128,.75);border-radius:2px 2px 0 0;"></div>
              <div style="height:${hIn}%;background:rgba(0,200,255,.75);${hOut ? '' : 'border-radius:2px 2px 0 0;'}"></div>
              ${(d.tin + d.tout) === 0 ? '<div style="border-bottom:2px solid rgba(255,255,255,.06);"></div>' : ''}
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.6);margin-top:6px;">
          <span>${fmtDay(dayList[0].day)}</span><span>${fmtDay(dayList[dayList.length - 1].day)}</span>
        </div>`;
    }

    // ── By-feature breakdown ──
    const featureEl = document.getElementById('usageFeatureChart');
    if (featureEl) {
      const FEAT_COLORS = [
        '#00c8ff','#4ade80','#fb923c','#a78bfa','#f472b6','#facc15','#34d399','#f87171',
      ];
      const features = Array.isArray(featureRows) ? featureRows : [];
      const totalFeatCost = features.reduce((s, r) => s + r.cost, 0);
      if (!features.length || totalFeatCost === 0) {
        featureEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.25);padding:8px 0;">No feature-tagged calls in this period yet — metrics accrue as features are used.</div>';
      } else {
        const maxFeatCost = features[0].cost;
        featureEl.innerHTML = features.map((r, i) => {
          const color = FEAT_COLORS[i % FEAT_COLORS.length];
          const pct = totalFeatCost > 0 ? (r.cost / totalFeatCost * 100).toFixed(1) : '0.0';
          const barW = maxFeatCost > 0 ? Math.max(2, Math.round(r.cost / maxFeatCost * 100)) : 0;
          return `
            <div style="display:grid;grid-template-columns:90px 1fr 80px 70px;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);">
              <div style="font-size:12px;font-weight:700;color:${color};">${escHtml(r.feature)}</div>
              <div style="background:rgba(255,255,255,.06);border-radius:3px;height:8px;overflow:hidden;">
                <div style="width:${barW}%;height:100%;background:${color};border-radius:3px;"></div>
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,.7);text-align:right;">${pct}% · ${r.calls} req</div>
              <div style="font-size:12px;font-weight:700;color:#e8a020;text-align:right;">${_fmtCost(r.cost)}</div>
            </div>`;
        }).join('');
      }
    }

    // ── By-model table ──
    const byModel = {};
    rows.forEach(r => {
      const m = byModel[r.model] = byModel[r.model] || { cost: 0, calls: 0, tin: 0, tout: 0, cw: 0, cr: 0 };
      m.cost += r.cost; m.calls += r.calls; m.tin += r.tokens_in; m.tout += r.tokens_out;
      m.cw += r.cache_write; m.cr += r.cache_read;
    });
    const models = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost);
    const td = 'padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.05);';
    document.getElementById('usageModelTable').innerHTML = models.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="color:#ffffff;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">
          <th style="${td}">Model</th>
          <th style="${td}text-align:right;">Requests</th>
          <th style="${td}text-align:right;">Tokens in</th>
          <th style="${td}text-align:right;">Tokens out</th>
          <th style="${td}text-align:right;">Cache w/r</th>
          <th style="${td}text-align:right;">Cost</th>
        </tr></thead>
        <tbody style="color:#ffffff;">
          ${models.map(([model, m]) => `<tr>
            <td style="${td}font-weight:600;color:#ffffff;">${escHtml(_shortModel(model))}</td>
            <td style="${td}text-align:right;">${m.calls.toLocaleString()}</td>
            <td style="${td}text-align:right;">${_fmtTok(m.tin)}</td>
            <td style="${td}text-align:right;">${_fmtTok(m.tout)}</td>
            <td style="${td}text-align:right;">${_fmtTok(m.cw)} / ${_fmtTok(m.cr)}</td>
            <td style="${td}text-align:right;color:#e8a020;font-weight:600;">${_fmtCost(m.cost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
      : '<div style="font-size:13px;color:rgba(255,255,255,.25);padding:8px 0;">No metered calls in this period yet — metrics accrue as Claude actions run.</div>';
  }
  window.renderUsagePage = renderUsagePage;
