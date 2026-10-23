/* Start-up: setup check, sign in, load data, show the admin. */
(function () {
  'use strict';
  const A = window.ADM, h = A.h, app = document.getElementById('app');

  function box(title, sub, kids) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'login' }, h('div', { class: 'box' }, h('div', { class: 'brand', style: 'padding:0' }, h('i'), h('div', null, 'Ion Peptide', h('small', null, 'Site admin'))), h('h1', null, title), sub ? h('p', null, sub) : null, kids)));
  }

  function setupScreen() {
    box('Almost ready', 'The admin needs to be connected to your Supabase project first.', h('div', null,
      h('ol', { class: 'steps' },
        h('li', null, 'In Supabase open the SQL Editor, paste the file ', h('code', null, 'supabase/schema.sql'), ' and press Run.'),
        h('li', null, 'Open Project Settings > API and copy the Project URL and the anon public key.'),
        h('li', null, 'Paste them into ', h('code', null, 'data/cms-config.js'), ' in the site folder, then upload that file to your hosting.'),
        h('li', null, 'Reload this page.')),
      h('p', { class: 'mini' }, 'Full steps with pictures of where to click are in SETUP-ADMIN.md.')));
  }

  function loginScreen(msg) {
    const email = h('input', { type: 'email', autocomplete: 'username', required: true }), pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const err = h('div', { class: 'err-text' }, msg || '');
    const form = h('form', { onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      const r = await A.sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
      if (r.error) { err.textContent = r.error.message === 'Invalid login credentials' ? 'That email or password is not correct.' : r.error.message; return; }
      start();
    } }, h('label', null, 'Email'), email, h('label', null, 'Password'), pw, h('button', { class: 'btn primary', type: 'submit' }, 'Sign in'), err,
      h('p', { style: 'text-align:center;margin:18px 0 0' }, h('button', { type: 'button', class: 'link-btn', onclick: async () => { if (!email.value) { err.textContent = 'Type your email first, then press this again.'; return; } const r = await A.sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.href.split('#')[0] }); err.textContent = r.error ? r.error.message : 'We sent you an email with a link to set a new password.'; err.style.color = r.error ? '' : 'var(--green)'; } }, 'Forgot password?')));
    box('Sign in', 'Use the email and password for your admin account.', form);
  }

  async function start() {
    if (!A.configured || !A.sb) return setupScreen();
    try {
      const { data } = await A.sb.auth.getSession();
      if (!data.session) return loginScreen();
      A.S.user = data.session.user;
      const me = await A.sb.from('cms_admins').select('role').eq('user_id', A.S.user.id).maybeSingle();
      if (me.error) { box('Database not ready', 'The admin tables were not found.', h('div', null, h('p', { class: 'err-text' }, me.error.message), h('p', { class: 'mini' }, 'Run supabase/schema.sql in the Supabase SQL Editor, then reload this page.'))); return; }
      if (!me.data) {
        box('No access yet', 'You are signed in as ' + A.S.user.email + ' but this account is not an admin.', h('div', null, h('p', { class: 'mini' }, 'Ask the owner to add you under Team. If you are the first person, run the "first admin" line at the bottom of schema.sql with this email.'), h('button', { class: 'btn', onclick: async () => { await A.sb.auth.signOut(); location.reload(); } }, 'Sign out')));
        return;
      }
      A.S.role = me.data.role;
      app.innerHTML = '<div class="boot">Loading your site content...</div>';
      await Promise.all([A.loadDefaults(), A.loadAll()]);
      A.ensureLinkList();
      A.renderShell();
      if (!location.hash) location.hash = '#/dashboard';
      A.render();
    } catch (e) { console.error(e); box('Something went wrong', null, h('p', { class: 'err-text' }, A.dbErr(e))); }
  }
  start();
})();
