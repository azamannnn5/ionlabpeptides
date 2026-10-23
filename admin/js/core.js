/* Core helpers: database access, state, saving, small UI tools. */
(function () {
  'use strict';
  const A = window.ADM = {};

  /* ---------- tiny DOM helper ---------- */
  A.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return el;
  };
  A.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  A.strip = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  A.money = (n) => '$' + Number(n || 0).toFixed(2);
  A.fmtDate = (d) => { try { return new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } };
  A.clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
  A.eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ---------- state ---------- */
  A.S = { user: null, role: null, content: {}, settings: {}, products: {}, coupons: [], loaded: false };
  A.pending = { content: {}, settings: {}, products: {} }; // unsaved edits: table -> key -> value (null = reset to original)
  A.ROLE_RANK = { viewer: 1, editor: 2, admin: 3, owner: 4 };
  A.can = (min) => (A.ROLE_RANK[A.S.role] || 0) >= A.ROLE_RANK[min];

  /* ---------- toasts ---------- */
  A.toast = function (msg, kind) {
    const t = A.h('div', { class: 'toast ' + (kind || '') }, msg);
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3500);
  };

  /* ---------- modal ---------- */
  A.modal = function (title, body, buttons, opts) {
    const bg = A.h('div', { class: 'modal-bg' });
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    const foot = A.h('footer', null, (buttons || [{ label: 'Close' }]).map((b) => A.h('button', { class: 'btn ' + (b.cls || ''), onclick: async () => { const r = b.onclick ? await b.onclick(close) : undefined; if (r !== false && !b.keep) close(); } }, b.label)));
    const m = A.h('div', { class: 'modal', style: opts && opts.width ? 'max-width:' + opts.width : null },
      A.h('header', null, A.h('h2', null, title), A.h('button', { class: 'x', onclick: close, 'aria-label': 'Close' }, '×')),
      A.h('div', { class: 'mb' }, body), foot);
    bg.appendChild(m);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    return { close, el: m };
  };
  A.confirm = (title, text, okLabel, danger) => new Promise((res) => {
    A.modal(title, A.h('p', null, text), [
      { label: 'Cancel', onclick: () => { res(false); } },
      { label: okLabel || 'OK', cls: danger ? 'danger' : 'primary', onclick: () => { res(true); } }
    ]);
  });

  /* ---------- Supabase ---------- */
  const cfg = window.IONCMS_CONFIG || {};
  A.configured = !!(cfg.url && cfg.anonKey && !/YOUR[-_]/i.test(cfg.url + cfg.anonKey));
  A.cfg = cfg;
  if (A.configured && window.supabase) {
    A.sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ion-admin-auth' } });
  }
  A.dbErr = (e) => (e && (e.message || e.error_description)) || 'Something went wrong.';

  A.loadAll = async function () {
    const sb = A.sb;
    const [c, s, p, k] = await Promise.all([
      sb.from('cms_content').select('key,value').range(0, 9999),
      sb.from('cms_settings').select('key,value'),
      sb.from('cms_products').select('id,data'),
      sb.from('cms_coupons').select('*').order('created_at', { ascending: false })
    ]);
    for (const r of [c, s, p, k]) if (r.error) throw r.error;
    A.S.content = {}; c.data.forEach((r) => { A.S.content[r.key] = r.value; });
    A.S.settings = {}; s.data.forEach((r) => { A.S.settings[r.key] = r.value; });
    A.S.products = {}; p.data.forEach((r) => { A.S.products[r.id] = r.data; });
    A.S.coupons = k.data;
    A.S.loaded = true;
  };

  /* ---------- editing with unsaved changes ---------- */
  A.listeners = [];
  A.onPending = (fn) => A.listeners.push(fn);
  A.pendingCount = () => Object.values(A.pending).reduce((n, t) => n + Object.keys(t).length, 0);
  const notify = () => A.listeners.forEach((f) => f());

  // current saved value (or default) helpers
  A.getContent = (key) => (key in A.pending.content ? A.pending.content[key] : A.S.content[key]);
  A.getSetting = (g) => (g in A.pending.settings ? A.pending.settings[g] : A.S.settings[g]);
  A.getProduct = (id) => (id in A.pending.products ? A.pending.products[id] : A.S.products[id]);

  A.stage = function (table, key, value) {
    const saved = table === 'content' ? A.S.content[key] : table === 'settings' ? A.S.settings[key] : A.S.products[key];
    if (A.eq(saved == null ? null : saved, value == null ? null : value)) delete A.pending[table][key];
    else A.pending[table][key] = value;
    notify();
  };
  A.discard = function () { A.pending = { content: {}, settings: {}, products: {} }; notify(); };

  A.save = async function () {
    if (!A.can('editor')) { A.toast('Your role can only view. Ask the owner for edit access.', 'err'); return false; }
    const sb = A.sb, P = A.pending;
    const tables = { content: ['cms_content', 'key'], settings: ['cms_settings', 'key'], products: ['cms_products', 'id'] };
    if (Object.keys(P.settings).length && !A.can('admin')) { A.toast('Only admins can change site settings.', 'err'); return false; }
    try {
      for (const t of Object.keys(tables)) {
        const [tbl, pk] = tables[t];
        const keys = Object.keys(P[t]); if (!keys.length) continue;
        const up = [], del = [];
        keys.forEach((k) => {
          const v = P[t][k];
          const empty = v == null || (t === 'products' && v && !Object.keys(v).length);
          const id = t === 'products' ? Number(k) : k;
          if (empty) del.push(id); else up.push(t === 'products' ? { id, data: v, updated_at: new Date().toISOString() } : { key: k, value: v, updated_at: new Date().toISOString() });
        });
        for (let i = 0; i < up.length; i += 200) { const r = await sb.from(tbl).upsert(up.slice(i, i + 200), { onConflict: pk }); if (r.error) throw r.error; }
        for (let i = 0; i < del.length; i += 100) { const r = await sb.from(tbl).delete().in(pk, del.slice(i, i + 100)); if (r.error) throw r.error; }
        keys.forEach((k) => {
          const v = P[t][k], empty = v == null || (t === 'products' && v && !Object.keys(v).length);
          const bag = A.S[t];
          if (empty) delete bag[k]; else bag[k] = v;
        });
      }
      const n = A.pendingCount();
      A.pending = { content: {}, settings: {}, products: {} };
      notify();
      A.toast(n + (n === 1 ? ' change' : ' changes') + ' saved. Your live site is updated.', 'ok');
      return true;
    } catch (e) { A.toast('Could not save: ' + A.dbErr(e), 'err'); return false; }
  };

  /* ---------- routing ---------- */
  A.route = () => { const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const parts = path.split('/').filter(Boolean).map(decodeURIComponent); return { parts, q: Object.fromEntries(new URLSearchParams(qs || '')) }; };
  A.go = (path) => { location.hash = '#/' + path; };
  A.link = (path) => '#/' + path;

  /* ---------- uploads ---------- */
  A.upload = async function (file) {
    if (!A.can('editor')) throw new Error('Your role cannot upload files.');
    if (file.size > 8 * 1024 * 1024) throw new Error('That file is over 8 MB. Please use a smaller image.');
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
    const path = 'uploads/' + Date.now() + '-' + safe;
    const up = await A.sb.storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
    if (up.error) throw up.error;
    const url = A.sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    const ins = await A.sb.from('cms_media').insert({ path, url, name: file.name, size: file.size, mime: file.type, uploaded_by: A.S.user && A.S.user.email }).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  };
})();
