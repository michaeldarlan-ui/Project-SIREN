  // ── Auth module ───────────────────────────────────────────────
  // Runs authInit() on load; provides user pill, change-password modal, users page.

  let _authUser = null;

  async function authInit() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { window.location.href = '/login'; return; }
      _authUser = await res.json();
    } catch { window.location.href = '/login'; return; }

    // Show user pill
    const pill = document.getElementById('userPill');
    const name = document.getElementById('userPillName');
    if (pill && name) {
      name.textContent = _authUser.username;
      pill.style.display = 'flex';
    }

    // Show admin-only items
    if (_authUser.role === 'admin') {
      const div = document.getElementById('usersMenuDivider');
      const btn = document.getElementById('usersMenuItem');
      const mobileBtn = document.getElementById('mobileUsersItem');
      if (div) div.style.display = '';
      if (btn) btn.style.display = '';
      if (mobileBtn) mobileBtn.style.display = '';
    }
  }

  async function authLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

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

  // ── Users page ────────────────────────────────────────────────
  async function usersLoad() {
    const el = document.getElementById('usersList');
    if (!el) return;
    if (_authUser?.role !== 'admin') {
      el.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,.3);font-size:13px;">Admin access required.</div>';
      return;
    }
    el.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,.3);font-size:12px;">Loading…</div>';
    try {
      const res = await fetch('/api/users');
      if (!res.ok) { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Failed to load users.</div>'; return; }
      const users = await res.json();
      if (!users.length) { el.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,.3);font-size:12px;">No users found.</div>'; return; }
      el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 16px;border-bottom:1px solid rgba(0,200,255,.1);">Username</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Role</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Created</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Status</th>
              <th style="padding:10px 16px 10px 8px;border-bottom:1px solid rgba(0,200,255,.1);"></th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const isSelf = u.username === _authUser?.username;
              const date   = u.createdAt ? new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
              return `<tr>
                <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:rgba(255,255,255,.85);">${escHtml(u.username)}${isSelf ? ' <span style="font-size:10px;color:rgba(0,200,255,.5);">(you)</span>' : ''}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${u.role==='admin'?'#00c8ff':'rgba(255,255,255,.45)'};">${escHtml(u.role)}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.3);">${date}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${u.mustChangePassword?'#f59e0b':'rgba(34,197,94,.6)'};">${u.mustChangePassword ? 'Must change pwd' : 'Active'}</td>
                <td style="padding:10px 16px 10px 8px;border-bottom:1px solid rgba(255,255,255,.04);text-align:right;white-space:nowrap;">
                  <button onclick="usersResetPwd('${escHtml(u.id)}','${escHtml(u.username)}')" style="background:none;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.4);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;margin-right:6px;">Reset pwd</button>
                  ${!isSelf ? `<button onclick="usersDelete('${escHtml(u.id)}','${escHtml(u.username)}')" style="background:none;border:1px solid rgba(239,68,68,.2);color:rgba(239,68,68,.5);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;">Delete</button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Error loading users.</div>'; }
  }

  function usersOpenAdd() {
    const f = document.getElementById('usersAddForm');
    if (f) { f.style.display = ''; document.getElementById('uaUsername').focus(); }
  }

  function usersCloseAdd() {
    const f = document.getElementById('usersAddForm');
    if (f) f.style.display = 'none';
    document.getElementById('uaErr').textContent = '';
  }

  async function usersAddSubmit() {
    const username = document.getElementById('uaUsername').value.trim();
    const password = document.getElementById('uaPassword').value;
    const role     = document.getElementById('uaRole').value;
    const err = document.getElementById('uaErr');
    err.textContent = '';
    if (!username || !password) { err.textContent = 'Username and password are required.'; return; }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || 'Failed to create user.'; return; }
      usersCloseAdd();
      document.getElementById('uaUsername').value = '';
      document.getElementById('uaPassword').value = '';
      usersLoad();
    } catch { err.textContent = 'Network error.'; }
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
