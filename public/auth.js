  // ── Auth module ───────────────────────────────────────────────
  // Runs authInit() on load; provides user pill, change-password modal, users page.

  let _authUser = null;

  async function authInit() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { window.location.href = '/login'; return; }
      _authUser = await res.json();
    } catch { window.location.href = '/login'; return; }

    // Store org + user context globally for other modules
    window._sirenOrg  = { id: _authUser.orgId, name: _authUser.orgName, isDemo: _authUser.isDemo };
    window._sirenUser = { role: _authUser.role, username: _authUser.username, displayName: _authUser.displayName || _authUser.username, orgId: _authUser.orgId };
    window.sirenIsAdmin = () => ['admin','superadmin'].includes(window._sirenUser?.role);
    window._sirenGradingLevel = _authUser.gradingLevel || 3;

    window.GRADING_PRESETS = [
      {
        level: 1, label: 'Supportive', offset: 12,
        tagline: 'Grade thresholds shift down 12 points',
        description: 'Designed for reps in their first 90 days or teams handling high-complexity deals. A raw score of 71 displays as a B-. Builds confidence while still surfacing meaningful coaching gaps.'
      },
      {
        level: 2, label: 'Coaching', offset: 6,
        tagline: 'Grade thresholds shift down 6 points',
        description: 'Recommended for mid-tenure reps or moderate deal complexity. A raw score of 77 displays as a B-. Recognizes solid effort while still making coaching priorities visible.'
      },
      {
        level: 3, label: 'Standard', offset: 0,
        tagline: 'No adjustment — unmodified AI assessment',
        description: 'The default calibration for experienced reps in typical enterprise deals. An 83 is a B, a 70 is a C-. Scores reflect the AI\'s direct evaluation with no offset applied.'
      },
      {
        level: 4, label: 'Rigorous', offset: -8,
        tagline: 'Grade thresholds shift up 8 points',
        description: 'For elite teams, competitive benchmarking, or promotion evaluations. A raw score of 91 displays as a B+. Expects near-flawless execution — very few calls will reach A range.'
      },
    ];

    window.applyGradingOffset = function(rawScore, level) {
      const preset = window.GRADING_PRESETS.find(p => p.level === (level ?? window._sirenGradingLevel)) || window.GRADING_PRESETS[2];
      return Math.max(0, Math.min(100, rawScore + preset.offset));
    };

    window.adjustedScoreDisplay = function(rawScore, level) {
      return window.applyGradingOffset(rawScore, level);
    };

    window.adjustedGradeFromRaw = function(rawScore, level) {
      const adj = window.applyGradingOffset(rawScore, level);
      const n = adj;
      if (n >= 97) return 'A+';
      if (n >= 93) return 'A';
      if (n >= 90) return 'A-';
      if (n >= 87) return 'B+';
      if (n >= 83) return 'B';
      if (n >= 80) return 'B-';
      if (n >= 77) return 'C+';
      if (n >= 73) return 'C';
      if (n >= 70) return 'C-';
      if (n >= 67) return 'D+';
      if (n >= 63) return 'D';
      if (n >= 60) return 'D-';
      return 'F';
    };

    // Show user pill
    const pill = document.getElementById('userPill');
    const name = document.getElementById('userPillName');
    if (pill && name) {
      name.textContent = _authUser.username;
      pill.style.display = 'flex';
    }


    // Assume-role banner (admin viewing as a specific user)
    if (_authUser.assumedRole) {
      let assumeBanner = document.getElementById('assumeRoleBanner');
      if (!assumeBanner) {
        assumeBanner = document.createElement('div');
        assumeBanner.id = 'assumeRoleBanner';
        assumeBanner.style.cssText = 'position:fixed;top:52px;left:0;right:0;z-index:160;background:rgba(239,68,68,.15);border-bottom:2px solid rgba(239,68,68,.4);padding:6px 20px;display:flex;align-items:center;gap:12px;font-size:12px;color:rgba(255,100,100,.9);';
        const label = _authUser.assumedUserDisplay || _authUser.assumedRole;
        assumeBanner.innerHTML = `<span style="font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:10px;">&#128100; Viewing as: ${escHtml(label)}</span><span style="color:rgba(255,255,255,.35);font-size:11px;">You are seeing the app as this user would. Admin capabilities are hidden.</span><button onclick="exitAssumeRole()" style="margin-left:auto;background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);color:#fca5a5;border-radius:5px;padding:3px 12px;font-size:11px;cursor:pointer;font-weight:700;">Exit Preview</button>`;
        document.body.appendChild(assumeBanner);
        const pages = document.getElementById('pages') || document.querySelector('.pages');
        if (pages) pages.style.paddingTop = ((parseInt(pages.style.paddingTop)||0) + 36) + 'px';
      }
    }

    // Admin "Exit User Preview" button in settings dropdown (only when currently assuming)
    if ((_authUser.realRole === 'admin' || _authUser.realRole === 'superadmin') && _authUser.assumedRole) {
      const settingsDropdown = document.getElementById('settingsDropdown');
      if (settingsDropdown && !document.getElementById('assumeRoleBtn')) {
        const divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:rgba(255,255,255,.06);margin:4px 0;';
        settingsDropdown.appendChild(divider);
        const btn = document.createElement('div');
        btn.id = 'assumeRoleBtn';
        btn.style.cssText = 'padding:8px 16px;cursor:pointer;font-size:12px;color:rgba(255,100,100,.7);white-space:nowrap;user-select:none;';
        btn.textContent = '↩ Exit User Preview';
        btn.onclick = exitAssumeRole;
        settingsDropdown.appendChild(btn);
      }
    }

    // Hide admin-only settings items for non-admin users
    if (_authUser.realRole !== 'admin' && _authUser.realRole !== 'superadmin') {
      document.querySelectorAll('[data-admin-only]').forEach(el => { el.style.display = 'none'; });
    }

    // Restrict nav tabs based on per-user tab permissions
    if (_authUser.allowedTabs) {
      const allowed = new Set(_authUser.allowedTabs);
      document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
        if (!allowed.has(btn.dataset.tab)) btn.style.display = 'none';
      });
      // Auto-navigate to first allowed tab if current tab isn't permitted
      if (typeof navTo === 'function') {
        const firstAllowed = _authUser.allowedTabs[0];
        if (firstAllowed) setTimeout(() => navTo(firstAllowed), 0);
      }
    }

    // Show demo banner if in demo org
    if (_authUser.isDemo) {
      let banner = document.getElementById('demoBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'demoBanner';
        banner.style.cssText = 'position:fixed;top:52px;left:0;right:0;z-index:150;background:rgba(245,158,11,.12);border-bottom:1px solid rgba(245,158,11,.25);padding:6px 20px;display:flex;align-items:center;gap:10px;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:.12em;color:rgba(245,158,11,.85);text-transform:uppercase;';
        banner.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></span> Demo Mode — data is fictional and will reset periodically';
        document.body.appendChild(banner);
      }
      // Push page content down to account for banner
      const pages = document.getElementById('pages') || document.querySelector('.pages');
      if (pages) pages.style.paddingTop = '36px';
    }
  }

  async function authLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function assumeUserRole(userId) {
    const res = await fetch('/api/auth/assume-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) location.reload();
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not assume role.'); }
  }
  window.assumeUserRole = assumeUserRole;

  async function exitAssumeRole() {
    const res = await fetch('/api/auth/exit-assume-role', { method: 'POST' });
    if (res.ok) location.reload();
    else alert('Could not exit assume role.');
  }
  window.exitAssumeRole = exitAssumeRole;

  const ALL_TABS = [
    { key: 'pulse',     label: 'PULSE' },
    { key: 'vigil',     label: 'VIGIL' },
    { key: 'forge',     label: 'FORGE' },
    { key: 'grader',    label: 'ENGAGE' },
    { key: 'lifecycle', label: 'ATLAS' },
    { key: 'scope',     label: 'SCOPE' },
    { key: 'coach',     label: 'COACH' },
    { key: 'usage',     label: 'USAGE' },
    { key: 'dash',      label: 'DASH' },
  ];

  async function openTabPermissions(userId, displayName) {
    // Build or reuse modal
    let modal = document.getElementById('tabPermModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tabPermModal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);align-items:center;justify-content:center;';
      modal.innerHTML = `<div style="background:#111113;border:1px solid rgba(245,158,11,.18);border-radius:10px;width:min(400px,94vw);padding:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div id="tabPermTitle" style="font-size:11px;font-weight:700;letter-spacing:.14em;color:rgba(245,158,11,.7);text-transform:uppercase;font-family:'JetBrains Mono',monospace;"></div>
          <button onclick="document.getElementById('tabPermModal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,.3);font-size:18px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;">Select which tabs this user can access. Leave all unchecked to grant access to all tabs.</div>
        <div id="tabPermChecks" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px;"></div>
        <div id="tabPermErr" style="font-size:11px;color:#ef4444;margin-bottom:10px;min-height:16px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="document.getElementById('tabPermModal').style.display='none'" style="background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);border-radius:5px;padding:7px 16px;font-size:12px;cursor:pointer;">Cancel</button>
          <button id="tabPermSaveBtn" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);color:#f59e0b;border-radius:5px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;">Save</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
    }

    modal.querySelector('#tabPermTitle').textContent = `Tab Access — ${displayName}`;
    const checksEl = modal.querySelector('#tabPermChecks');
    const errEl = modal.querySelector('#tabPermErr');
    errEl.textContent = '';
    checksEl.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:11px;">Loading…</div>';
    modal.style.display = 'flex';

    // Load current permissions
    let currentTabs = null;
    try {
      const r = await fetch(`/api/users/${userId}/tabs`);
      const d = await r.json();
      currentTabs = d.tabs; // null = all tabs
    } catch {}

    checksEl.innerHTML = ALL_TABS.map(t => {
      const checked = !currentTabs || currentTabs.includes(t.key) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.7);">
        <input type="checkbox" data-tab-key="${t.key}" ${checked} style="accent-color:#f59e0b;width:14px;height:14px;cursor:pointer;">
        ${t.label}
      </label>`;
    }).join('');

    modal.querySelector('#tabPermSaveBtn').onclick = async () => {
      const checked = [...checksEl.querySelectorAll('input[type=checkbox]:checked')].map(c => c.dataset.tabKey);
      const tabs = checked.length === ALL_TABS.length ? [] : checked; // empty = all tabs (no restriction)
      try {
        const r = await fetch(`/api/users/${userId}/tabs`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabs }) });
        if (r.ok) { modal.style.display = 'none'; }
        else { errEl.textContent = 'Failed to save permissions.'; }
      } catch { errEl.textContent = 'Network error.'; }
    };
  }
  window.openTabPermissions = openTabPermissions;

  function authChangePwdOpen() {
    document.getElementById('cpCurPwd').value = '';
    document.getElementById('cpNewPwd').value = '';
    document.getElementById('cpConfPwd').value = '';
    document.getElementById('cpErr').textContent = '';
    const m = document.getElementById('changePwdModal');
    m.style.display = 'flex';
    document.getElementById('cpCurPwd').focus();
  }

  function authChangePwdClose() {
    document.getElementById('changePwdModal').style.display = 'none';
  }

  async function authDoChangePassword() {
    const curPwd  = document.getElementById('cpCurPwd').value;
    const newPwd  = document.getElementById('cpNewPwd').value;
    const confPwd = document.getElementById('cpConfPwd').value;
    const err = document.getElementById('cpErr');
    err.textContent = '';
    if (!newPwd || newPwd.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
    if (newPwd !== confPwd) { err.textContent = 'Passwords do not match.'; return; }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || 'Failed.'; return; }
      authChangePwdClose();
    } catch { err.textContent = 'Network error.'; }
  }

  // ── Add member mode toggle ─────────────────────────────────────
  function uaSetMode(mode) {
    const isInvite = mode === 'invite';
    document.getElementById('uaInvitePanel').style.display = isInvite ? '' : 'none';
    document.getElementById('uaManualPanel').style.display = isInvite ? 'none' : '';
    document.getElementById('uaFormTitle').textContent = isInvite ? 'Invite Team Member' : 'Create Member Manually';
    document.getElementById('uaModeInvite').style.background = isInvite ? 'rgba(245,158,11,.15)' : 'none';
    document.getElementById('uaModeInvite').style.color       = isInvite ? '#f59e0b' : 'rgba(255,255,255,.35)';
    document.getElementById('uaModeManual').style.background  = !isInvite ? 'rgba(245,158,11,.15)' : 'none';
    document.getElementById('uaModeManual').style.color       = !isInvite ? '#f59e0b' : 'rgba(255,255,255,.35)';
    document.getElementById('uaErr').innerHTML = '';
    if (!isInvite) {
      const sel = document.getElementById('uaSalesRole');
      if (sel && typeof buildRoleOptions === 'function') sel.innerHTML = buildRoleOptions('', '— Select role —');
      document.getElementById('uaDisplayName')?.focus();
    } else {
      document.getElementById('uaEmail')?.focus();
    }
  }

  async function usersAddManual() {
    const displayName = (document.getElementById('uaDisplayName')?.value || '').trim();
    const salesRole   = (document.getElementById('uaSalesRole')?.value || '').trim();
    const username    = (document.getElementById('uaUsername')?.value || '').trim();
    const password    = (document.getElementById('uaPassword')?.value || '');
    const role        = document.getElementById('uaRoleManual')?.value || 'user';
    const err = document.getElementById('uaErr');
    err.style.color = '#ef4444'; err.innerHTML = '';
    if (!displayName) { err.textContent = 'Display name is required.'; return; }
    if (!username || !password) { err.textContent = 'Username and password are required.'; return; }
    try {
      const res  = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role, displayName, salesRole }) });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || 'Failed to create member.'; return; }
      usersCloseAdd();
      usersLoad();
    } catch { err.textContent = 'Network error.'; }
  }

  // ── Team page (merged Sales Team + Users) ─────────────────────
  async function usersLoad() {
    const el = document.getElementById('usersList');
    if (!el) return;
    const isAdmin = _authUser?.role === 'admin';

    // Show/hide the Add Member button
    const addBtn = document.getElementById('addUserBtn');
    if (addBtn) addBtn.style.display = isAdmin ? '' : 'none';

    el.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,.3);font-size:12px;">Loading…</div>';
    try {
      if (!isAdmin) {
        // Non-admins: read-only team list from /api/team
        const res = await fetch('/api/team');
        const team = res.ok ? await res.json() : [];
        if (!team.length) {
          el.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,.3);font-size:13px;">No team members yet.</div>';
          return;
        }
        el.innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(245,158,11,.5);text-align:left;padding:10px 16px;border-bottom:1px solid rgba(245,158,11,.1);">Name</th>
                <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(245,158,11,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(245,158,11,.1);">Role</th>
              </tr>
            </thead>
            <tbody>
              ${team.map(m => `<tr>
                <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:rgba(255,255,255,.85);">${escHtml(m.name)}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.45);">${escHtml(m.role || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
        return;
      }

      // Admin view: full account management table
      const [usersRes, orgsRes] = await Promise.all([fetch('/api/users'), fetch('/api/orgs')]);
      if (!usersRes.ok) { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Failed to load team.</div>'; return; }
      const users   = await usersRes.json();
      const orgs    = orgsRes.ok ? await orgsRes.json() : [];
      const invites = await fetch('/api/invites').then(r => r.ok ? r.json() : []).catch(() => []);
      if (!users.length) { el.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,.3);font-size:12px;">No team members found.</div>'; return; }
      const thStyle = 'font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(245,158,11,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(245,158,11,.1);';
      el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="${thStyle}padding-left:16px;">Display Name</th>
              <th style="${thStyle}">Sales Role</th>
              <th style="${thStyle}">Username</th>
              <th style="${thStyle}">Platform Role</th>
              <th style="${thStyle}">Last Login</th>
              <th style="${thStyle}">Spend</th>
              <th style="${thStyle}">Status</th>
              <th style="${thStyle}padding-right:16px;"></th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const isSelf = u.username === _authUser?.username;
              const uid = escHtml(u.id);
              const uname = escHtml(u.username);
              const dn = escHtml(u.displayName || '');
              const sr = escHtml(u.salesRole || '');
              const lastLogin = u.lastLoginAt
                ? (() => { const d = new Date(u.lastLoginAt); return d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); })()
                : '—';
              const spendStr = u.totalSpend > 0
                ? `$${u.totalSpend.toFixed(4)} <span style="color:rgba(255,255,255,.25);font-size:10px;">(${u.totalCalls} call${u.totalCalls !== 1 ? 's' : ''})</span>`
                : '<span style="color:rgba(255,255,255,.2);">—</span>';
              return `<tr id="urow-${uid}">
                <td style="padding:8px 8px 8px 16px;border-bottom:1px solid rgba(255,255,255,.04);">
                  <input value="${dn}" placeholder="Full name" data-uid="${uid}" data-field="displayName"
                    onblur="usersUpdateProfile(this)"
                    style="background:rgba(255,255,255,.04);border:1px solid rgba(245,158,11,.12);border-radius:4px;color:rgba(255,255,255,.85);padding:4px 8px;font-size:12px;font-family:inherit;width:140px;outline:none;"
                    onfocus="this.style.borderColor='rgba(245,158,11,.4)'" onblur2="this.style.borderColor='rgba(245,158,11,.12)'">
                </td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);">
                  <select data-uid="${uid}" data-field="salesRole"
                    onchange="usersUpdateProfile(this)"
                    style="background:#18181b;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:rgba(255,255,255,.6);padding:4px 6px;font-size:11px;font-family:inherit;max-width:160px;outline:none;cursor:pointer;">
                    ${typeof buildRoleOptions === 'function' ? buildRoleOptions(u.salesRole, '— role —') : `<option value="${sr}">${sr || '— role —'}</option>`}
                  </select>
                </td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:rgba(255,255,255,.5);font-family:'JetBrains Mono',monospace;">${uname}${isSelf ? ' <span style="font-size:9px;color:rgba(245,158,11,.5);">(you)</span>' : ''}</td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${u.role==='admin'?'rgba(245,158,11,.8)':'rgba(255,255,255,.35)'};">${escHtml(u.role)}</td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.4);white-space:nowrap;">${lastLogin}</td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;">${spendStr}</td>
                <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${u.mustChangePassword?'#f59e0b':'rgba(34,197,94,.6)'};">${u.mustChangePassword ? 'Change pwd' : 'Active'}</td>
                <td style="padding:8px 16px 8px 8px;border-bottom:1px solid rgba(255,255,255,.04);text-align:right;white-space:nowrap;">
                  ${(!isSelf && u.role !== 'admin' && u.role !== 'superadmin') ? `<button onclick="assumeUserRole('${uid}')" style="background:none;border:1px solid rgba(99,102,241,.3);color:rgba(149,152,255,.7);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;margin-right:6px;" title="View app as this user">View as</button>` : ''}
                  ${(!isSelf && u.role !== 'admin' && u.role !== 'superadmin') ? `<button onclick="openTabPermissions('${uid}','${escHtml(u.displayName||u.username)}')" style="background:none;border:1px solid rgba(245,158,11,.25);color:rgba(245,158,11,.6);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;margin-right:6px;" title="Configure tab access">Tabs</button>` : ''}
                  <button onclick="usersResetPwd('${uid}','${uname}')" style="background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.35);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;margin-right:6px;">Reset pwd</button>
                  ${!isSelf ? `<button onclick="usersDelete('${uid}','${uname}')" style="background:none;border:1px solid rgba(239,68,68,.2);color:rgba(239,68,68,.5);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;">Remove</button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${invites.length ? `
        <div style="margin-top:20px;padding:14px 16px;background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.1);border-radius:8px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(245,158,11,.6);text-transform:uppercase;margin-bottom:10px;">Pending Invitations</div>
          ${invites.map(inv => {
            const pdfUrl = `/api/invite/${encodeURIComponent(inv.token)}/pdf`;
            const exp = new Date(inv.expiresAt).toLocaleDateString([], { month:'short', day:'numeric' });
            return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(245,158,11,.07);">
              <div style="flex:1;font-size:13px;color:rgba(255,255,255,.7);">${escHtml(inv.email)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.3);">Expires ${exp}</div>
              <a href="${pdfUrl}" target="_blank" style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.25);color:#f59e0b;border-radius:4px;padding:3px 10px;font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;">&#8595; PDF</a>
            </div>`;
          }).join('')}
        </div>` : ''}`;

      await orgsLoad();
    } catch { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Error loading team.</div>'; }
  }

  // ── Org management section ────────────────────────────────────
  async function orgsLoad() {
    const el = document.getElementById('orgsList');
    if (!el) return;
    try {
      const res = await fetch('/api/orgs');
      if (!res.ok) return;
      const orgs = await res.json();
      el.innerHTML = `
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(0,200,255,.08);">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(0,200,255,.4);margin-bottom:16px;">Org Management</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:8px 16px;border-bottom:1px solid rgba(0,200,255,.1);">Name</th>
                <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:8px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Slug</th>
                <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:8px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Type</th>
                <th style="padding:8px 16px 8px 8px;border-bottom:1px solid rgba(0,200,255,.1);"></th>
              </tr>
            </thead>
            <tbody>
              ${orgs.map(o => `<tr>
                <td style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:rgba(255,255,255,.85);">${escHtml(o.name)}</td>
                <td style="padding:8px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.3);font-family:'JetBrains Mono',monospace;">${escHtml(o.slug)}</td>
                <td style="padding:8px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${o.isDemo?'rgba(245,158,11,.7)':'rgba(34,197,94,.6)'};">${o.isDemo ? 'Demo' : 'Production'}</td>
                <td style="padding:8px 16px 8px 8px;border-bottom:1px solid rgba(255,255,255,.04);text-align:right;">
                  ${o.isDemo ? `<button onclick="orgsResetDemo(${o.id},'${escHtml(o.name)}')" style="background:none;border:1px solid rgba(245,158,11,.25);color:rgba(245,158,11,.6);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;">Reset Demo Data</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top:16px;">
            <button onclick="orgsOpenAdd()" style="background:none;border:1px solid rgba(0,200,255,.2);color:rgba(0,200,255,.6);border-radius:4px;padding:5px 12px;font-size:11px;cursor:pointer;">+ New Org</button>
          </div>
          <div id="orgsAddForm" style="display:none;margin-top:12px;padding:16px;background:rgba(0,200,255,.03);border:1px solid rgba(0,200,255,.1);border-radius:6px;">
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
              <div>
                <div style="font-size:9px;color:rgba(0,200,255,.4);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Org Name</div>
                <input id="oaName" placeholder="e.g. Acme Corp" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:6px 10px;font-size:12px;color:#e2e8f0;width:200px;" />
              </div>
              <div>
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.5);cursor:pointer;">
                  <input type="checkbox" id="oaIsDemo" /> Demo org
                </label>
              </div>
              <button onclick="orgsAddSubmit()" style="background:rgba(0,200,255,.1);border:1px solid rgba(0,200,255,.2);color:#00c8ff;border-radius:4px;padding:6px 14px;font-size:11px;cursor:pointer;">Create</button>
              <button onclick="orgsCloseAdd()" style="background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.3);border-radius:4px;padding:6px 14px;font-size:11px;cursor:pointer;">Cancel</button>
            </div>
            <div id="oaErr" style="margin-top:8px;font-size:11px;color:#ef4444;"></div>
          </div>
        </div>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,.06);">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.25);margin-bottom:12px;">Database Maintenance</div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <button onclick="adminCleanupOrphans()" id="cleanupOrphansBtn" style="background:none;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.4);border-radius:4px;padding:5px 12px;font-size:11px;cursor:pointer;">Clean Up Orphaned Call Records</button>
            <span id="cleanupOrphansMsg" style="font-size:11px;color:rgba(255,255,255,.3);"></span>
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,.2);margin-top:6px;">Removes call_spiced, call_reps, call_dimensions, and other normalized rows that have no matching call in history.</div>
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.04);">
            <div style="font-size:10px;color:rgba(255,255,255,.25);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Move Prospect Data Between Orgs</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
              <div>
                <label style="display:block;font-size:9px;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Prospect (contains)</label>
                <input id="migrateProspect" type="text" placeholder="e.g. AVN HLTH" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:rgba(255,255,255,.8);padding:5px 8px;font-size:12px;font-family:inherit;outline:none;width:140px;">
              </div>
              <div>
                <label style="display:block;font-size:9px;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Target Org Name</label>
                <input id="migrateTargetOrg" type="text" placeholder="e.g. OneAxiom" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:rgba(255,255,255,.8);padding:5px 8px;font-size:12px;font-family:inherit;outline:none;width:140px;">
              </div>
              <button onclick="adminPreviewMigration()" style="background:none;border:1px solid rgba(99,102,241,.3);color:rgba(149,152,255,.7);border-radius:4px;padding:5px 12px;font-size:11px;cursor:pointer;">Preview</button>
              <button onclick="adminMigrateProspect()" id="migrateProspectBtn" style="background:none;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.4);border-radius:4px;padding:5px 12px;font-size:11px;cursor:pointer;">Migrate</button>
              <span id="migrateProspectMsg" style="font-size:11px;color:rgba(255,255,255,.3);"></span>
            </div>
          </div>
        </div>`;
    } catch {}
  }

  function orgsOpenAdd() {
    const f = document.getElementById('orgsAddForm');
    if (f) { f.style.display = ''; document.getElementById('oaName').focus(); }
  }

  function orgsCloseAdd() {
    const f = document.getElementById('orgsAddForm');
    if (f) f.style.display = 'none';
    const err = document.getElementById('oaErr');
    if (err) err.textContent = '';
  }

  async function orgsAddSubmit() {
    const name = document.getElementById('oaName').value.trim();
    const isDemo = document.getElementById('oaIsDemo').checked;
    const err = document.getElementById('oaErr');
    if (err) err.textContent = '';
    if (!name) { if (err) err.textContent = 'Name is required.'; return; }
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isDemo }),
      });
      const data = await res.json();
      if (!res.ok) { if (err) err.textContent = data.error || 'Failed to create org.'; return; }
      orgsCloseAdd();
      document.getElementById('oaName').value = '';
      document.getElementById('oaIsDemo').checked = false;
      await orgsLoad();
    } catch { if (err) err.textContent = 'Network error.'; }
  }

  async function orgsResetDemo(id, name) {
    if (!confirm(`Reset all demo data for "${name}"? This will wipe and re-seed it.`)) return;
    try {
      const res = await fetch(`/api/orgs/${id}/reset-demo`, { method: 'POST' });
      if (res.ok) { alert('Demo data reset successfully.'); } else { alert('Failed to reset demo data.'); }
    } catch { alert('Network error.'); }
  }

  async function adminCleanupOrphans() {
    const btn = document.getElementById('cleanupOrphansBtn');
    const msg = document.getElementById('cleanupOrphansMsg');
    if (btn) btn.disabled = true;
    if (msg) msg.textContent = 'Running…';
    try {
      const res = await fetch('/api/admin/cleanup-orphans', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (msg) msg.textContent = data.deleted > 0 ? `Done — ${data.deleted} orphaned row(s) removed.` : 'Done — no orphaned rows found.';
      } else {
        if (msg) msg.textContent = 'Error: ' + (data.error || 'unknown');
      }
    } catch {
      if (msg) msg.textContent = 'Network error.';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function usersOpenAdd() {
    const f = document.getElementById('usersAddForm');
    if (!f) return;
    f.style.display = '';
    uaSetMode('invite');
  }

  function usersCloseAdd() {
    const f   = document.getElementById('usersAddForm');
    const err = document.getElementById('uaErr');
    if (err?.dataset?.closeTimer) { clearTimeout(Number(err.dataset.closeTimer)); delete err.dataset.closeTimer; }
    if (f) f.style.display = 'none';
    if (err) err.innerHTML = '';
  }

  async function adminPreviewMigration() {
    const prospect = (document.getElementById('migrateProspect')?.value || '').trim();
    const msg = document.getElementById('migrateProspectMsg');
    if (!prospect) { if (msg) { msg.style.color='#ef4444'; msg.textContent='Enter a prospect name to preview.'; } return; }
    if (msg) { msg.style.color='rgba(255,255,255,.3)'; msg.textContent='Searching…'; }
    try {
      const res = await fetch(`/api/admin/migrate-prospect-org?prospect=${encodeURIComponent(prospect)}`);
      const d = await res.json();
      if (!res.ok) { msg.style.color='#ef4444'; msg.textContent='Error: ' + (d.error||'unknown'); return; }
      const hNames = [...new Set(d.history.map(r=>r.prospect))];
      const tNames = [...new Set(d.transcripts.map(r=>r.prospect))];
      if (!hNames.length && !tNames.length) {
        msg.style.color='#f59e0b'; msg.textContent=`No records found matching "${prospect}". Check the exact name in the DB.`;
      } else {
        msg.style.color='#4ade80'; msg.textContent=`Found: ${d.history.length} call(s) [${hNames.slice(0,3).join(', ')}], ${d.transcripts.length} transcript(s). Ready to migrate.`;
      }
    } catch { if (msg) { msg.style.color='#ef4444'; msg.textContent='Network error.'; } }
  }
  window.adminPreviewMigration = adminPreviewMigration;

  async function adminMigrateProspect() {
    const prospect  = (document.getElementById('migrateProspect')?.value || '').trim();
    const targetOrg = (document.getElementById('migrateTargetOrg')?.value || '').trim();
    const btn = document.getElementById('migrateProspectBtn');
    const msg = document.getElementById('migrateProspectMsg');
    if (!prospect || !targetOrg) { if (msg) { msg.style.color='#ef4444'; msg.textContent='Enter prospect name and target org.'; } return; }
    if (!confirm(`Move all records matching "${prospect}" to org "${targetOrg}"? This cannot be undone.`)) return;
    if (btn) btn.disabled = true;
    if (msg) { msg.style.color='rgba(255,255,255,.3)'; msg.textContent='Migrating…'; }
    try {
      const res  = await fetch('/api/admin/migrate-prospect-org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect, targetOrgName: targetOrg }) });
      const data = await res.json();
      if (res.ok) {
        msg.style.color = '#4ade80';
        msg.textContent = `Done — ${data.historyCalls} call(s), ${data.transcripts} transcript(s), ${data.profiles} profile(s), ${data.prospects} prospect(s) moved to org #${data.orgId}.`;
        document.getElementById('migrateProspect').value  = '';
        document.getElementById('migrateTargetOrg').value = '';
      } else {
        msg.style.color = '#ef4444';
        msg.textContent = 'Error: ' + (data.error || 'unknown');
      }
    } catch { if (msg) { msg.style.color='#ef4444'; msg.textContent='Network error.'; } }
    finally { if (btn) btn.disabled = false; }
  }

  async function usersChangeOrg(userId, selectEl) {
    const orgId = Number(selectEl.value);
    const prev  = selectEl.dataset.prev || selectEl.value;
    selectEl.dataset.prev = selectEl.value;
    selectEl.disabled = true;
    try {
      const res = await fetch(`/api/users/${userId}/org`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to update org.');
        selectEl.value = prev;
      } else {
        selectEl.dataset.prev = String(orgId);
      }
    } catch {
      alert('Network error — org not changed.');
      selectEl.value = prev;
    } finally {
      selectEl.disabled = false;
    }
  }

  async function usersAddSubmit() {
    const email = (document.getElementById('uaEmail')?.value || '').trim();
    const role  = document.getElementById('uaRole').value;
    const err   = document.getElementById('uaErr');
    err.style.color = '#ef4444';
    err.textContent = '';
    if (!email || !email.includes('@')) { err.textContent = 'A valid email address is required.'; return; }
    try {
      const res  = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || 'Failed to send invitation.'; return; }
      // Extract token from inviteUrl for PDF link
      const token = data.inviteUrl ? new URL(data.inviteUrl).searchParams.get('token') : null;
      const pdfUrl = token ? `/api/invite/${encodeURIComponent(token)}/pdf` : null;
      err.style.color = '#4ade80';
      err.innerHTML = `Invitation created for <strong>${escHtml(email)}</strong>.`
        + (pdfUrl ? ` <a href="${pdfUrl}" target="_blank" style="color:#f59e0b;font-weight:700;text-decoration:underline;">Download invite PDF &darr;</a>` : '')
        + (data.inviteUrl && !pdfUrl ? ` <span style="color:rgba(255,255,255,.4);">No SMTP — <a href="${data.inviteUrl}" target="_blank" style="color:#60a5fa;">open link</a></span>` : '');
      document.getElementById('uaEmail').value = '';
      // Don't auto-close — let admin download the PDF first
      const closeTimer = setTimeout(() => { usersCloseAdd(); usersLoad(); }, 12000);
      err.dataset.closeTimer = closeTimer;
    } catch { err.textContent = 'Network error — could not send invitation.'; }
  }

  async function usersUpdateProfile(input) {
    input.style.borderColor = '';
    const uid = input.dataset.uid;
    const field = input.dataset.field;
    // Collect both fields from the same row
    const row = document.getElementById('urow-' + uid);
    if (!row) return;
    const dnInput = row.querySelector('[data-field="displayName"]');
    const srInput = row.querySelector('[data-field="salesRole"]');
    const displayName = dnInput ? dnInput.value.trim() : '';
    const salesRole   = srInput ? srInput.value.trim() : '';
    try {
      await fetch(`/api/users/${encodeURIComponent(uid)}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, salesRole }),
      });
    } catch { /* silent */ }
  }

  async function usersResetPwd(id, username) {
    const pwd = prompt(`New password for "${username}":`);
    if (!pwd) return;
    if (pwd.length < 8) { alert('Password must be at least 8 characters.'); return; }
    const res = await fetch(`/api/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) { usersLoad(); } else { alert('Failed to reset password.'); }
  }

  async function usersDelete(id, username) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) { usersLoad(); } else { alert('Failed to delete user.'); }
  }

  async function renderGradingDifficultyUI() {
    const el = document.getElementById('gradingDifficultySection');
    if (!el) return;
    const isAdmin = _authUser?.realRole === 'admin' || _authUser?.realRole === 'superadmin';
    const currentLevel = window._sirenGradingLevel || 3;

    el.innerHTML = `
      <div style="font-family:var(--siren-font-hud);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--siren-text-muted);margin-bottom:12px;">Grading Difficulty</div>
      <div class="cd-panel" style="padding:20px 24px;margin-bottom:28px;">
        <p style="font-size:12px;color:rgba(255,255,255,.4);margin:0 0 16px;line-height:1.6;">Controls how scores are translated into letter grades. The AI always scores the same way — this offset shifts where each grade boundary falls, making the grading scale easier or harder. Raw scores are preserved; changing this setting retroactively updates all displayed grades.</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;" id="gradingPresetGrid">
          ${window.GRADING_PRESETS.map(p => {
            const active = p.level === currentLevel;
            const canClick = isAdmin ? `onclick="selectGradingPreset(${p.level})"` : '';
            return `<div id="gpreset-${p.level}" ${canClick} style="border:2px solid ${active ? 'rgba(245,158,11,.6)' : 'rgba(255,255,255,.08)'};border-radius:8px;padding:14px 12px;cursor:${isAdmin ? 'pointer' : 'default'};background:${active ? 'rgba(245,158,11,.06)' : 'rgba(255,255,255,.02)'};transition:border-color .15s,background .15s;">
              <div style="font-size:18px;font-weight:800;color:${active ? '#f59e0b' : 'rgba(255,255,255,.3)'};font-family:var(--siren-font-hud);letter-spacing:.04em;margin-bottom:4px;">${p.level}</div>
              <div style="font-size:11px;font-weight:700;color:${active ? '#f59e0b' : 'rgba(255,255,255,.5)'};margin-bottom:6px;">${p.label}</div>
              <div style="font-size:10px;color:rgba(255,255,255,.3);line-height:1.4;">${p.tagline}</div>
            </div>`;
          }).join('')}
        </div>
        <div id="gradingPresetDesc" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:12px 14px;font-size:12px;color:rgba(255,255,255,.55);line-height:1.6;"></div>
        ${!isAdmin ? '<p style="font-size:11px;color:rgba(255,255,255,.2);margin-top:12px;margin-bottom:0;">Only admins can change the grading difficulty.</p>' : ''}
        <div id="gradingPresetMsg" style="font-size:11px;margin-top:10px;min-height:16px;"></div>
      </div>`;

    updateGradingPresetDesc(currentLevel);
  }
  window.renderGradingDifficultyUI = renderGradingDifficultyUI;

  function updateGradingPresetDesc(level) {
    const preset = window.GRADING_PRESETS.find(p => p.level === level);
    const el = document.getElementById('gradingPresetDesc');
    if (el && preset) el.textContent = preset.description;
  }

  async function selectGradingPreset(level) {
    if (_authUser?.realRole !== 'admin' && _authUser?.realRole !== 'superadmin') return;
    const msg = document.getElementById('gradingPresetMsg');
    if (msg) { msg.style.color = 'rgba(255,255,255,.3)'; msg.textContent = 'Saving…'; }
    try {
      const res = await fetch('/api/settings/grading', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }) });
      if (!res.ok) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Failed to save.'; } return; }
      window._sirenGradingLevel = level;
      // Update card styles
      window.GRADING_PRESETS.forEach(p => {
        const card = document.getElementById('gpreset-' + p.level);
        if (!card) return;
        const active = p.level === level;
        card.style.borderColor = active ? 'rgba(245,158,11,.6)' : 'rgba(255,255,255,.08)';
        card.style.background = active ? 'rgba(245,158,11,.06)' : 'rgba(255,255,255,.02)';
        card.querySelector('div').style.color = active ? '#f59e0b' : 'rgba(255,255,255,.3)';
        card.querySelectorAll('div')[1].style.color = active ? '#f59e0b' : 'rgba(255,255,255,.5)';
      });
      updateGradingPresetDesc(level);
      if (msg) { msg.style.color = '#4ade80'; msg.textContent = 'Grading difficulty updated. All displayed grades now reflect the new scale.'; }
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
    } catch { if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Network error.'; } }
  }
  window.selectGradingPreset = selectGradingPreset;
