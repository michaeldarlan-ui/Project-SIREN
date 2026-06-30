// SIREN Management Portal — portal.js
// Requires superadmin role; all endpoints are under /api/portal/*

let _portalOrgs  = [];
let _portalUsers = [];
let _portalTickets = [];
let _portalFeatures = [];

// ── Navigation ─────────────────────────────────────────────────
function portalNav(section, btn) {
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.portal-section').forEach(s => s.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('section-' + section);
  if (el) el.classList.add('active');

  if (section === 'dashboard') portalLoadDash();
  if (section === 'accounts')  portalLoadAccounts();
  if (section === 'users')     portalLoadUsers();
  if (section === 'tickets')   portalLoadTickets();
  if (section === 'features')  portalLoadFeatures();
}

// ── Sign out ───────────────────────────────────────────────────
async function portalSignOut() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login';
}

// ── Search ─────────────────────────────────────────────────────
function portalSearch(q) {
  q = (q || '').toLowerCase();
  // Apply search to whichever section is visible
  const active = document.querySelector('.portal-section.active');
  if (!active) return;
  const rows = active.querySelectorAll('tr[data-search]');
  rows.forEach(r => {
    const txt = (r.dataset.search || '').toLowerCase();
    r.style.display = txt.includes(q) ? '' : 'none';
  });
}

// ── Dashboard ──────────────────────────────────────────────────
async function portalLoadDash() {
  try {
    const s = await fetch('/api/portal/stats').then(r => r.json());
    const el = id => document.getElementById(id);
    if (el('kpi-orgs'))    el('kpi-orgs').textContent    = s.orgCount    ?? '—';
    if (el('kpi-users'))   el('kpi-users').textContent   = s.userCount   ?? '—';
    if (el('kpi-tickets')) el('kpi-tickets').textContent = s.openTickets ?? '—';
    if (el('kpi-features'))el('kpi-features').textContent= s.features    ?? '—';
  } catch {}
}

// ── Accounts ───────────────────────────────────────────────────
async function portalLoadAccounts() {
  const tbody = document.getElementById('accountsTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    _portalOrgs = await fetch('/api/portal/orgs').then(r => r.json());
    renderAccountsTable(_portalOrgs);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center;padding:20px;">${e.message}</td></tr>`;
  }
}

function renderAccountsTable(orgs) {
  const tbody = document.getElementById('accountsTbody');
  if (!tbody) return;
  if (!orgs.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">No accounts yet.</td></tr>'; return; }
  tbody.innerHTML = orgs.map(o => {
    const badge = o.isDemo ? '<span style="background:rgba(99,102,241,.15);color:#818cf8;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">DEMO</span>' : '<span style="background:rgba(34,197,94,.1);color:#4ade80;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">PROD</span>';
    return `<tr data-search="${escP(o.name)} ${escP(o.slug)}">
      <td style="padding:10px 14px;color:#e2e8f0;">${escP(o.name)}</td>
      <td style="padding:10px 14px;color:rgba(255,255,255,.4);font-size:12px;">${escP(o.slug)}</td>
      <td style="padding:10px 14px;">${badge}</td>
      <td style="padding:10px 14px;color:rgba(255,255,255,.5);">${o.userCount ?? 0}</td>
      <td style="padding:10px 14px;color:rgba(255,255,255,.3);font-size:11px;">${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
      <td style="padding:10px 14px;"></td>
    </tr>`;
  }).join('');
}

function portalFilterAccounts(val) {
  const rows = document.querySelectorAll('#accountsTbody tr[data-search]');
  rows.forEach(r => {
    const txt = (r.dataset.search || '').toLowerCase();
    r.style.display = (!val || val === 'all' || txt.includes(val.toLowerCase())) ? '' : 'none';
  });
}

function portalToggleNewOrg() {
  const f = document.getElementById('newOrgForm');
  if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
}

async function portalCreateOrg() {
  const name = (document.getElementById('newOrgName')?.value || '').trim();
  const slug = (document.getElementById('newOrgSlug')?.value || '').trim();
  const isDemo = document.getElementById('newOrgDemo')?.checked ? 1 : 0;
  const err = document.getElementById('newOrgErr');
  if (err) err.textContent = '';
  if (!name || !slug) { if (err) err.textContent = 'Name and slug are required.'; return; }
  try {
    const res  = await fetch('/api/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug, isDemo }) });
    const data = await res.json();
    if (!res.ok) { if (err) err.textContent = data.error || 'Failed to create account.'; return; }
    document.getElementById('newOrgName').value = '';
    document.getElementById('newOrgSlug').value = '';
    portalToggleNewOrg();
    portalLoadAccounts();
  } catch (e) { if (err) err.textContent = 'Network error.'; }
}

// ── Users ──────────────────────────────────────────────────────
async function portalLoadUsers() {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    _portalUsers = await fetch('/api/portal/users').then(r => r.json());
    // Populate org filter
    const orgSel = document.getElementById('userOrgFilter');
    if (orgSel && orgSel.options.length <= 1) {
      const orgs = [...new Set(_portalUsers.map(u => u.orgName).filter(Boolean))].sort();
      orgs.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; orgSel.appendChild(o); });
    }
    renderUsersTable(_portalUsers);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center;padding:20px;">${e.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">No users found.</td></tr>'; return; }
  const roleBadge = r => {
    if (r === 'superadmin') return '<span style="background:rgba(239,68,68,.15);color:#fca5a5;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">SUPERADMIN</span>';
    if (r === 'admin')      return '<span style="background:rgba(245,158,11,.12);color:#fbbf24;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">ADMIN</span>';
    return '<span style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.4);padding:2px 8px;border-radius:10px;font-size:10px;">USER</span>';
  };
  tbody.innerHTML = users.map(u => `<tr data-search="${escP(u.username)} ${escP(u.email||'')} ${escP(u.orgName||'')} ${escP(u.displayName||'')}">
    <td style="padding:10px 14px;color:#e2e8f0;">${escP(u.displayName || u.username)}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.4);font-size:12px;">${escP(u.username)}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.35);font-size:12px;">${escP(u.email||'')}</td>
    <td style="padding:10px 14px;">${roleBadge(u.role)}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.5);font-size:12px;">${escP(u.orgName||'')}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.3);font-size:11px;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
  </tr>`).join('');
}

function portalFilterUsers() {
  const orgVal  = (document.getElementById('userOrgFilter')?.value  || '').toLowerCase();
  const roleVal = (document.getElementById('userRoleFilter')?.value || '').toLowerCase();
  const filtered = _portalUsers.filter(u => {
    const orgMatch  = !orgVal  || orgVal === 'all'  || (u.orgName||'').toLowerCase() === orgVal;
    const roleMatch = !roleVal || roleVal === 'all' || u.role === roleVal;
    return orgMatch && roleMatch;
  });
  renderUsersTable(filtered);
}

// ── Tickets ────────────────────────────────────────────────────
async function portalLoadTickets() {
  const tbody = document.getElementById('ticketsTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    _portalTickets = await fetch('/api/portal/tickets').then(r => r.json());
    renderTicketsTable(_portalTickets);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:20px;">${e.message}</td></tr>`;
  }
}

function renderTicketsTable(tickets) {
  const tbody = document.getElementById('ticketsTbody');
  if (!tbody) return;
  if (!tickets.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">No tickets.</td></tr>'; return; }
  const statusColor = s => ({ open:'#4ade80', in_progress:'#fbbf24', resolved:'rgba(255,255,255,.3)', closed:'rgba(255,255,255,.2)' })[s] || '#e2e8f0';
  const priBadge = p => ({ critical:'#ef4444', high:'#f97316', normal:'rgba(255,255,255,.4)', low:'rgba(255,255,255,.2)' })[p] || '#e2e8f0';
  tbody.innerHTML = tickets.map(t => `<tr data-search="${escP(t.subject)} ${escP(t.orgName||'')} ${escP(t.reporterName||'')}">
    <td style="padding:10px 14px;font-size:11px;color:rgba(255,255,255,.3);">#${t.id}</td>
    <td style="padding:10px 14px;color:#e2e8f0;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escP(t.subject)}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.5);font-size:12px;">${escP(t.orgName||'')}</td>
    <td style="padding:10px 14px;"><span style="color:${statusColor(t.status)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${t.status}</span></td>
    <td style="padding:10px 14px;"><span style="color:${priBadge(t.priority)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${t.priority}</span></td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.3);font-size:11px;">${escP(t.category||'')}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.25);font-size:11px;">${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
  </tr>`).join('');
}

function portalFilterTickets() {
  const status   = document.getElementById('ticketStatusFilter')?.value   || '';
  const priority = document.getElementById('ticketPriorityFilter')?.value || '';
  const category = document.getElementById('ticketCategoryFilter')?.value || '';
  const filtered = _portalTickets.filter(t =>
    (!status   || status   === 'all' || t.status   === status)   &&
    (!priority || priority === 'all' || t.priority === priority) &&
    (!category || category === 'all' || t.category === category)
  );
  renderTicketsTable(filtered);
}

// ── Feature Requests ───────────────────────────────────────────
async function portalLoadFeatures() {
  const tbody = document.getElementById('featuresTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">Loading…</td></tr>';
  try {
    _portalFeatures = await fetch('/api/portal/features').then(r => r.json());
    renderFeaturesTable(_portalFeatures);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444;text-align:center;padding:20px;">${e.message}</td></tr>`;
  }
}

function renderFeaturesTable(features) {
  const tbody = document.getElementById('featuresTbody');
  if (!tbody) return;
  if (!features.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:rgba(255,255,255,.2);text-align:center;padding:20px;">No feature requests.</td></tr>'; return; }
  const statusColor = s => ({ submitted:'#60a5fa', under_review:'#fbbf24', planned:'#a78bfa', in_progress:'#4ade80', released:'rgba(255,255,255,.3)', declined:'rgba(255,255,255,.2)' })[s] || '#e2e8f0';
  tbody.innerHTML = features.map(f => `<tr data-search="${escP(f.title)} ${escP(f.orgName||'')} ${escP(f.submittedBy||'')}">
    <td style="padding:10px 14px;font-size:11px;color:rgba(255,255,255,.3);">#${f.id}</td>
    <td style="padding:10px 14px;color:#e2e8f0;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escP(f.title)}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.5);font-size:12px;">${escP(f.orgName||'')}</td>
    <td style="padding:10px 14px;"><span style="color:${statusColor(f.status)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${(f.status||'').replace(/_/g,' ')}</span></td>
    <td style="padding:10px 14px;color:#fbbf24;font-weight:700;">${f.votes||0}</td>
    <td style="padding:10px 14px;color:rgba(255,255,255,.25);font-size:11px;">${f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}</td>
  </tr>`).join('');
}

function portalFilterFeatures() {
  const status = document.getElementById('featureStatusFilter')?.value || '';
  const filtered = _portalFeatures.filter(f => !status || status === 'all' || f.status === status);
  renderFeaturesTable(filtered);
}

// ── Utils ──────────────────────────────────────────────────────
function escP(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  portalLoadDash();
});
