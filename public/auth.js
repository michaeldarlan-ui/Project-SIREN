  // ── Auth module ───────────────────────────────────────────────
  // Runs authInit() on load; provides user pill, change-password modal, users page.

  let _authUser = null;

  async function authInit() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { window.location.href = '/login'; return; }
      _authUser = await res.json();
    } catch { window.location.href = '/login'; return; }

    // Store org context globally
    window._sirenOrg = { id: _authUser.orgId, name: _authUser.orgName, isDemo: _authUser.isDemo };

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
      const [usersRes, orgsRes] = await Promise.all([fetch('/api/users'), fetch('/api/orgs')]);
      if (!usersRes.ok) { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Failed to load users.</div>'; return; }
      const users = await usersRes.json();
      const orgs  = orgsRes.ok ? await orgsRes.json() : [];
      if (!users.length) { el.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,.3);font-size:12px;">No users found.</div>'; return; }
      const orgOptions = orgs.map(o => `<option value="${o.id}">${escHtml(o.name)}</option>`).join('');
      el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 16px;border-bottom:1px solid rgba(0,200,255,.1);">Username</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Role</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Org</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Created</th>
              <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(0,200,255,.5);text-align:left;padding:10px 8px;border-bottom:1px solid rgba(0,200,255,.1);">Status</th>
              <th style="padding:10px 16px 10px 8px;border-bottom:1px solid rgba(0,200,255,.1);"></th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const isSelf = u.username === _authUser?.username;
              const date   = u.createdAt ? new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
              const orgSelect = orgs.length
                ? `<select onchange="usersChangeOrg('${escHtml(u.id)}',this)"
                     style="background:#18181b;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:rgba(255,255,255,.6);padding:3px 6px;font-size:11px;cursor:pointer;max-width:130px;">
                     ${orgs.map(o => `<option value="${o.id}"${o.id===u.orgId?' selected':''}>${escHtml(o.name)}</option>`).join('')}
                   </select>`
                : escHtml(u.orgName || 'Production');
              return `<tr>
                <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:rgba(255,255,255,.85);">${escHtml(u.username)}${isSelf ? ' <span style="font-size:10px;color:rgba(0,200,255,.5);">(you)</span>' : ''}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;color:${u.role==='admin'?'#00c8ff':'rgba(255,255,255,.45)'};">${escHtml(u.role)}</td>
                <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.04);">${orgSelect}</td>
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

      // Load org management section for admins
      await orgsLoad();
    } catch { el.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px;">Error loading users.</div>'; }
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

  function usersOpenAdd() {
    const f = document.getElementById('usersAddForm');
    if (f) { f.style.display = ''; document.getElementById('uaUsername').focus(); }
  }

  function usersCloseAdd() {
    const f = document.getElementById('usersAddForm');
    if (f) f.style.display = 'none';
    document.getElementById('uaErr').textContent = '';
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
