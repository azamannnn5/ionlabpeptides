/* Shell (menu, search, save bar) and the content screens. */
(function () {
  'use strict';
  const A = window.ADM, h = A.h;
  A.views = {};
  let mainEl, sideEl, savebar, contentEl, searchBox, resultsEl;

  /* ---------- shell ---------- */
  A.renderShell = function () {
    const app = document.getElementById('app'); app.innerHTML = '';
    sideEl = h('aside', { class: 'side', id: 'side' });
    contentEl = h('div', { class: 'content', id: 'content' });
    searchBox = h('input', { type: 'text', placeholder: 'Search pages, text, products, settings...', autocomplete: 'off', 'aria-label': 'Search the admin' });
    resultsEl = h('div', { class: 'results' });
    const top = h('div', { class: 'top' },
      h('button', { class: 'burger', onclick: () => sideEl.classList.toggle('open'), 'aria-label': 'Menu' }, '☰'),
      h('div', { class: 'search' }, searchBox, h('kbd', null, '/'), resultsEl),
      h('div', { class: 'me' }, h('span', { class: 'who' }, h('b', null, A.S.user.email), ' · ' + A.S.role), h('a', { class: 'btn small', href: '../index.html', target: '_blank', rel: 'noopener' }, 'View site'), h('button', { class: 'btn small', onclick: async () => { await A.sb.auth.signOut(); location.reload(); } }, 'Sign out')));
    savebar = h('div', { class: 'savebar', id: 'savebar' });
    mainEl = h('div', { class: 'main' }, top, contentEl);
    app.append(h('div', { class: 'shell' }, sideEl, mainEl), savebar);
    wireSearch();
    A.onPending(drawSavebar);
    drawSavebar();
    drawNav();
    window.addEventListener('beforeunload', (e) => { if (A.pendingCount()) { e.preventDefault(); e.returnValue = ''; } });
  };

  function drawSavebar() {
    if (!savebar) return;
    const n = A.pendingCount();
    savebar.classList.toggle('show', n > 0);
    savebar.innerHTML = '';
    if (!n) return;
    const parts = []; const P = A.pending;
    if (Object.keys(P.content).length) parts.push(Object.keys(P.content).length + ' text/link/image');
    if (Object.keys(P.products).length) parts.push(Object.keys(P.products).length + ' product');
    if (Object.keys(P.settings).length) parts.push(Object.keys(P.settings).length + ' setting');
    const btn = h('button', { class: 'btn primary', onclick: async (e) => { e.target.disabled = true; e.target.textContent = 'Saving...'; const ok = await A.save(); if (ok) A.render(); else drawSavebar(); } }, 'Save and publish');
    savebar.append(h('div', null, h('b', null, n + (n === 1 ? ' unsaved change' : ' unsaved changes')), h('div', { class: 'mini' }, parts.join(', ') + '. Nothing is live until you press Save.')), h('div', { class: 'sp' }),
      h('button', { class: 'btn', onclick: async () => { if (await A.confirm('Discard changes?', 'All unsaved changes will be lost.', 'Discard', true)) { A.discard(); A.render(); } } }, 'Discard'), btn);
  }

  /* ---------- menu ---------- */
  function navChildren(it) { return typeof it.children === 'function' ? it.children() : (it.children || []); }
  function curPath() { const r = A.route(); return r.parts.join('/'); }
  A.newMessages = 0;
  function drawNav() {
    if (!sideEl) return;
    const path = curPath(); sideEl.innerHTML = '';
    sideEl.appendChild(h('div', { class: 'brand' }, h('i'), h('div', null, 'Ion Peptide', h('small', null, 'Site admin'))));
    A.NAV.forEach((it) => {
      if (it.group) { sideEl.appendChild(h('div', { class: 'navgroup' }, it.group)); return; }
      if (it.min && !A.can(it.min)) return;
      const kids = navChildren(it);
      const active = path === it.route || path.startsWith(it.route.split('/')[0] + '/') && it.route.split('/')[0] === path.split('/')[0] && (!kids.length || kids.some((k) => path === k.route || path.startsWith(k.route + '/')) || path === it.route);
      const open = active && kids.length;
      const badge = it.badge === 'newMessages' && A.newMessages ? h('span', { class: 'badge' }, A.newMessages) : null;
      sideEl.appendChild(h('div', { class: 'navitem' + (active ? ' active' : '') + (open ? ' open' : '') },
        h('a', { href: A.link(it.route) }, h('span', null, it.label), badge || (kids.length ? h('span', { class: 'chev' }, '▸') : null)),
        kids.length ? h('div', { class: 'subnav' }, kids.map((k) => h('a', { href: A.link(k.route), class: path === k.route || path.startsWith(k.route + '/') ? 'active' : '' }, k.label))) : null));
    });
    sideEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => sideEl.classList.remove('open')));
  }

  /* ---------- search ---------- */
  function searchAll(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    const words = q.split(/\s+/);
    const hit = (t) => words.every((w) => t.includes(w));
    const out = [];
    // menu
    A.NAV.forEach((it) => {
      if (it.group || (it.min && !A.can(it.min))) return;
      if (hit((it.label + ' ' + (it.keywords || '')).toLowerCase())) out.push({ type: 'Go to', label: it.label, sub: it.keywords || '', href: it.route });
      navChildren(it).forEach((k) => { if (hit((k.label + ' ' + it.label).toLowerCase())) out.push({ type: 'Go to', label: it.label + ' / ' + k.label, sub: '', href: k.route }); });
    });
    // settings fields
    Object.entries(A.SETTINGS).forEach(([id, d]) => d.fields.forEach((f) => { if (hit((d.title + ' ' + f.label + ' ' + (f.help || '')).toLowerCase())) out.push({ type: 'Settings', label: d.title + ': ' + f.label, sub: d.title, href: 'settings/' + id + '?f=' + encodeURIComponent((d.group || id) + '.' + f.k) }); }));
    // pages
    (A.defaults.pages || []).forEach((p) => { if (!p.file.startsWith('product/') && hit((p.file + ' ' + p.title + ' ' + A.pageName(p.file, p.title)).toLowerCase())) out.push({ type: 'Pages', label: A.pageName(p.file, p.title), sub: p.file, href: 'pages/page/' + encodeURIComponent(p.file) }); });
    // products
    A.products().forEach((p) => { if (hit((p.name + ' ' + p.slug).toLowerCase())) out.push({ type: 'Products', label: p.name, sub: A.money(p.price) + (p.vars && p.vars.length ? ' and up' : ''), href: 'products/edit/' + p.id }); });
    A.S.coupons.forEach((c) => { if (hit(c.code.toLowerCase() + ' promo coupon')) out.push({ type: 'Promo codes', label: c.code, sub: c.kind, href: 'coupons' }); });
    // text on pages
    let n = 0;
    for (const e of A.fieldIndex) {
      if (n >= 14) break;
      if (!hit(e.text)) continue;
      const f = e.f;
      const where = f.scope === 'global' ? (f.region === 'header' ? 'global/header' : f.region === 'footer' ? 'global/footer' : f.region === 'floatpanel' ? 'global/floatpanel' : 'products/shared') : 'pages/page/' + encodeURIComponent(f.page);
      out.push({ type: 'Text, links and images', label: A.strip(f.value).slice(0, 80) || f.label, sub: (f.scope === 'global' ? 'Shared: ' + f.region : A.pageName(f.page)) + ' · ' + f.section, href: where + '?f=' + encodeURIComponent(f.key) }); n++;
    }
    return out;
  }
  function wireSearch() {
    let items = [], idx = -1;
    const draw = () => {
      resultsEl.innerHTML = '';
      if (!searchBox.value.trim()) { resultsEl.classList.remove('show'); return; }
      resultsEl.classList.add('show');
      if (!items.length) { resultsEl.appendChild(h('div', { class: 'none' }, 'Nothing found. Try another word.')); return; }
      let last = '';
      items.forEach((it, i) => {
        if (it.type !== last) { resultsEl.appendChild(h('h4', null, it.type)); last = it.type; }
        resultsEl.appendChild(h('a', { href: A.link(it.href), class: i === idx ? 'hl' : '', onclick: () => { resultsEl.classList.remove('show'); searchBox.value = ''; } }, it.label, it.sub ? h('small', null, it.sub) : null));
      });
    };
    let t;
    searchBox.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { items = searchAll(searchBox.value); idx = -1; draw(); }, 90); });
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { const it = items[idx < 0 ? 0 : idx]; if (it) { A.go(it.href); resultsEl.classList.remove('show'); searchBox.value = ''; searchBox.blur(); } }
      else if (e.key === 'Escape') { resultsEl.classList.remove('show'); searchBox.blur(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) resultsEl.classList.remove('show'); });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); searchBox.focus(); } });
  }

  /* ---------- render current route ---------- */
  A.render = async function () {
    if (!contentEl) return;
    const r = A.route();
    const [sec, ...rest] = r.parts.length ? r.parts : ['dashboard'];
    const fn = A.views[sec];
    drawNav();
    contentEl.innerHTML = '';
    window.scrollTo(0, 0);
    if (!fn) { contentEl.append(...A.pageHead('Page not found', 'That address does not exist in the admin.'), h('a', { class: 'btn', href: '#/dashboard' }, 'Back to dashboard')); return; }
    try { const el = await fn(rest, r.q); if (el) contentEl.append(...[].concat(el).flat().filter(Boolean)); } catch (e) { console.error(e); contentEl.append(A.note('Error', 'Something went wrong while loading this screen: ' + A.dbErr(e), 'warn')); }
    if (r.q.f) setTimeout(() => {
      const t = Array.from(contentEl.querySelectorAll('[data-key]')).find((x) => x.getAttribute('data-key') === r.q.f);
      if (t) { const c = t.closest('.card'); if (c) c.classList.remove('collapsed'); t.classList.add('hl'); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = t.querySelector('input,textarea,select'); if (i) i.focus({ preventScroll: true }); }
    }, 60);
  };
  window.addEventListener('hashchange', () => { if (contentEl) A.render(); });

  const lockNote = (min) => A.can(min) ? null : A.note('View only', 'Your role (' + A.S.role + ') can look at this screen but not change it. Ask the owner if you need more access.', 'warn');
  A.lockNote = lockNote;
  const guard = (min, el) => { if (!A.can(min)) { const w = h('div', { class: 'locked' }, el); return [lockNote(min), w]; } return el; };
  A.guard = guard;

  /* ---------- dashboard ---------- */
  A.views.dashboard = async function () {
    const topbar = A.getSetting('topbar') || {}, maint = A.getSetting('maintenance') || {}, popup = A.getSetting('popup') || {};
    const prods = A.products(); const edited = Object.keys(A.S.products).length; const hidden = Object.values(A.S.products).filter((p) => p && p.hidden).length;
    let msgs = [], hist = [];
    try { const m = await A.sb.from('cms_messages').select('id,status').eq('status', 'new'); msgs = m.data || []; A.newMessages = msgs.length; const hr = await A.sb.from('cms_history').select('*').order('at', { ascending: false }).limit(8); hist = hr.data || []; } catch (e) { /* ignore */ }
    drawNav();
    const stat = (n, l, href) => h('a', { class: 'stat', href: A.link(href), style: 'color:inherit;text-decoration:none' }, h('b', null, n), h('span', null, l));
    const status = (label, on, href, onText, offText, warnWhenOn) => h('tr', { class: 'clickable', onclick: () => A.go(href) }, h('td', null, label), h('td', null, h('span', { class: 'pill ' + (on ? (warnWhenOn ? 'amber' : 'green') : 'gray') }, on ? onText : offText)));
    return [
      ...A.pageHead('Dashboard', 'Everything about your site in one place. Use the menu on the left, or search at the top.'),
      A.note('How this works', ['Pick what you want to change from the menu. Edit the fields, then press Save and publish at the bottom.', 'Changes show on your live site within seconds. You do not need to upload files or redeploy.', 'Every change is recorded under Activity and undo, so you can go back.']),
      h('div', { class: 'grid', style: 'margin-bottom:28px' }, stat(Object.keys(A.S.content).length, 'text, link and image edits', 'pages'), stat(edited + ' of ' + prods.length, 'products changed', 'products'), stat(hidden, 'products hidden', 'products'), stat(msgs.length, 'new messages', 'messages')),
      h('div', { class: 'row c2' },
        A.card('Site status', null, h('table', { class: 't' }, h('tbody', null,
          status('Top banner', topbar.enabled !== false, 'settings/topbar', 'Showing', 'Hidden'),
          status('Pop-up message', !!popup.enabled, 'settings/popup', 'On', 'Off'),
          status('Maintenance mode', !!maint.enabled, 'settings/maintenance', 'ON: visitors see a closed page', 'Off', true),
          status('Promo codes', A.S.coupons.some((c) => c.active), 'coupons', A.S.coupons.filter((c) => c.active).length + ' active', 'None active')))),
        A.card('Recent activity', null, hist.length ? h('table', { class: 't' }, h('tbody', null, hist.map((x) => h('tr', null, h('td', null, h('b', null, A.histLabel(x)), h('div', { class: 'mini' }, (x.by || 'system') + ' · ' + A.fmtDate(x.at))))))) : h('div', { class: 'empty' }, 'No changes yet.'))),
      A.card('Quick links', null, h('div', { class: 'grid', style: 'padding:10px 0' },
        h('a', { class: 'tile', href: A.link('pages/page/index.html') }, h('h3', null, 'Edit the home page'), h('p', null, 'Headlines, text, buttons and images.')),
        h('a', { class: 'tile', href: A.link('products/quick') }, h('h3', null, 'Update prices'), h('p', null, 'Change prices and stock in one list.')),
        h('a', { class: 'tile', href: A.link('settings/topbar') }, h('h3', null, 'Top banner'), h('p', null, 'Turn the announcement bar on or off.')),
        h('a', { class: 'tile', href: A.link('coupons') }, h('h3', null, 'Promo codes'), h('p', null, 'Create or stop discount codes.'))))
    ];
  };
  A.histLabel = (x) => {
    const t = { cms_content: 'Page content', cms_settings: 'Setting', cms_products: 'Product', cms_coupons: 'Promo code' }[x.tbl] || x.tbl;
    let name = x.key; const f = A.defaults.fields[x.key];
    if (x.tbl === 'cms_content' && f) name = (f.scope === 'global' ? 'Shared ' + f.region : A.pageName(f.page)) + ': ' + (A.strip(f.value).slice(0, 40) || f.label);
    if (x.tbl === 'cms_products') { const p = (window.IONDATA.products || {})[x.key]; name = p ? p.name : 'Product ' + x.key; }
    if (x.tbl === 'cms_settings') name = (A.SETTINGS[x.key] || {}).title || x.key;
    const verb = x.old == null ? 'added' : x.new == null ? 'reset' : 'changed';
    return t + ' ' + verb + ': ' + name;
  };

  /* ---------- pages ---------- */
  function editedCount(fields) { return fields.filter((f) => A.getContent(f.key) !== undefined).length; }
  A.views.pages = async function (rest) {
    A.ensureLinkList();
    const defsPages = (A.defaults.pages || []).filter((p) => !p.file.startsWith('product/'));
    if (rest[0] === 'page') return pageEditor(decodeURIComponent(rest[1] || ''));
    if (rest[0] === 'group') return groupView(rest[1]);
    return [
      ...A.pageHead('Pages', 'Every page of your site, grouped. Open a page to change its headings, text, buttons, links and images.', null, [{ label: 'Pages' }]),
      A.note('What you are editing', ['Words, links and pictures that appear on a page. Prices and product names are not here: they are under Shop > Products.', 'Pick a group, then a page. Each page is split into the same sections you see on the live page.']),
      h('div', { class: 'grid' }, A.PAGE_GROUPS.map((g) => {
        const files = defsPages.filter((p) => A.groupOfPage(p.file).id === g.id);
        if (!files.length) return null;
        return h('a', { class: 'tile', href: A.link('pages/group/' + g.id) }, h('h3', null, g.label), h('p', null, g.help), h('p', { style: 'margin-top:10px;color:var(--navy);font-weight:600' }, files.length + ' pages'));
      }))
    ];
  };
  function groupView(id) {
    const g = A.PAGE_GROUPS.find((x) => x.id === id) || { label: 'Other pages', help: '' };
    const pages = (A.defaults.pages || []).filter((p) => !p.file.startsWith('product/') && A.groupOfPage(p.file).id === id);
    const filter = h('input', { type: 'text', placeholder: 'Filter these pages...' });
    const tbody = h('tbody');
    const draw = () => { tbody.innerHTML = ''; pages.filter((p) => (p.file + p.title).toLowerCase().includes(filter.value.toLowerCase())).forEach((p) => { const fs = (A.byPage[p.file] || []).filter((f) => f.kind !== 'alt'); const ed = editedCount(fs); tbody.appendChild(h('tr', { class: 'clickable', onclick: () => A.go('pages/page/' + encodeURIComponent(p.file)) }, h('td', null, h('b', null, A.pageName(p.file, p.title)), h('div', { class: 'mini' }, p.file)), h('td', null, fs.length + ' items'), h('td', null, ed ? h('span', { class: 'pill amber' }, ed + ' edited') : h('span', { class: 'pill gray' }, 'Original')), h('td', null, h('span', { class: 'btn small' }, 'Edit')))); }); };
    filter.addEventListener('input', draw); draw();
    return [...A.pageHead(g.label, g.help, null, [{ label: 'Pages', href: A.link('pages') }, { label: g.label }]), h('div', { class: 'toolbar' }, filter), h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Page', 'Editable items', 'Status', ''].map((x) => h('th', null, x)))), tbody)))];
  }
  function groupFields(fields) {
    const secs = []; const map = new Map();
    fields.filter((f) => f.kind !== 'alt').sort((a, b) => a.order - b.order).forEach((f) => { if (!map.has(f.section)) { const s = { name: f.section, fields: [] }; map.set(f.section, s); secs.push(s); } map.get(f.section).fields.push(f); });
    return secs;
  }
  A.fieldSections = function (fields, opts) {
    opts = opts || {};
    const wrap = h('div'); const q = A.route().q.f;
    const render = (term) => {
      wrap.innerHTML = '';
      const secs = groupFields(fields);
      let shown = 0;
      secs.forEach((s, i) => {
        const list = s.fields.filter((f) => !term || (f.label + ' ' + A.strip(f.value) + ' ' + (A.getContent(f.key) || '')).toLowerCase().includes(term));
        if (!list.length) return;
        shown += list.length;
        const ed = editedCount(list);
        const hasTarget = q && list.some((f) => f.key === q);
        wrap.appendChild(A.card(s.name.replace(/^Ion /i, ''), list.length + (list.length === 1 ? ' item' : ' items') + (ed ? ' · ' + ed + ' edited' : ''), list.map((f) => A.contentField(f, { hl: q === f.key })), { collapsible: true, collapsed: !term && !hasTarget && secs.length > 4 && i > 1 }));
      });
      if (!shown) wrap.appendChild(h('div', { class: 'empty' }, 'Nothing matches "' + term + '".'));
    };
    render('');
    return { el: wrap, render };
  };
  function pageEditor(file) {
    const meta = (A.defaults.pages || []).find((p) => p.file === file);
    if (!meta) return A.pageHead('Page not found', file);
    const fields = A.byPage[file] || [];
    const grp = A.groupOfPage(file);
    const f = A.fieldSections(fields);
    const filter = h('input', { type: 'text', placeholder: 'Search inside this page...', oninput: () => f.render(filter.value.toLowerCase()) });
    const reset = h('button', { class: 'btn small danger', onclick: async () => { const ks = fields.filter((x) => A.getContent(x.key) !== undefined); if (!ks.length) return A.toast('Nothing is edited on this page.'); if (await A.confirm('Reset this page?', 'All ' + ks.length + ' edits on this page go back to the original text. You still need to press Save.', 'Reset page', true)) { ks.forEach((x) => A.stage('content', x.key, null)); A.render(); } } }, 'Reset page to original');
    return [
      ...A.pageHead(A.pageName(file, meta.title), file, [h('a', { class: 'btn', href: '../' + file, target: '_blank', rel: 'noopener' }, 'View live page'), reset], [{ label: 'Pages', href: A.link('pages') }, { label: grp.label, href: A.link('pages/group/' + grp.id) }, { label: A.pageName(file, meta.title) }]),
      A.note('What you are editing', ['The words, links and pictures on this page. The sections below follow the page from top to bottom.', 'Labels show the kind of edit: Text, Link or Image. A yellow "Edited" tag means the field differs from the original, and you can reset it any time.', 'The menu, footer and product details are edited elsewhere: Header, menu and footer, and Shop > Products.']),
      h('div', { class: 'toolbar' }, filter, h('span', { class: 'mini' }, fields.filter((x) => x.kind !== 'alt').length + ' editable items')),
      A.guard('editor', f.el)
    ];
  }

  /* ---------- header, footer, product finder ---------- */
  A.views.global = async function (rest) {
    A.ensureLinkList();
    const region = rest[0];
    const info = {
      header: { title: 'Header and menu', help: ['The bar at the top of every page: logo, menu links and the shop drop-down.', 'Changes here appear on every page of the site at once.'] },
      footer: { title: 'Footer', help: ['The area at the bottom of every page: description, link columns, social links and copyright line.', 'Changes here appear on every page at once.'] },
      floatpanel: { title: 'Product finder tab', help: ['The small "Products" tab that slides out from the side of the screen so visitors can search product names.', 'The product list inside is built from your products. Change names under Shop > Products.'] }
    };
    if (!info[region]) return [...A.pageHead('Header, menu and footer', 'Parts of the site that repeat on every page.', null, [{ label: 'Header, menu and footer' }]), h('div', { class: 'grid' }, Object.entries(info).map(([k, v]) => h('a', { class: 'tile', href: A.link('global/' + k) }, h('h3', null, v.title), h('p', null, v.help[0]))))];
    const f = A.fieldSections(A.byRegion[region] || []);
    const filter = h('input', { type: 'text', placeholder: 'Search in ' + info[region].title.toLowerCase() + '...', oninput: () => f.render(filter.value.toLowerCase()) });
    return [...A.pageHead(info[region].title, null, null, [{ label: 'Header, menu and footer', href: A.link('global') }, { label: info[region].title }]), A.note('Shown on every page', info[region].help), h('div', { class: 'toolbar' }, filter), A.guard('editor', f.el)];
  };

  /* ---------- settings screens ---------- */
  A.views.settings = async function (rest) {
    A.ensureLinkList();
    const id = rest[0], def = A.SETTINGS[id];
    if (!def) return A.pageHead('Not found', '');
    const crumbs = [{ label: def.nav }, { label: def.title }];
    const out = [...A.pageHead(def.title, null, null, crumbs), A.note(def.tag === 'Price' ? 'Prices' : def.tag === 'Code' ? 'Advanced' : 'What you are editing', def.help)];
    if (def.group === 'appearance') out.push(h('div', { class: 'tabs' }, ['appearance_colours', 'appearance_fonts', 'appearance_css'].map((k) => h('a', { href: A.link('settings/' + k), class: k === id ? 'active' : '' }, A.SETTINGS[k].title))));
    out.push(A.guard('admin', A.settingsForm(id)));
    return out;
  };

  /* ---------- home page products ---------- */
  A.views.home = async function () {
    let orig = [];
    try { const t = await (await fetch('../index.html')).text(); orig = Array.from(t.matchAll(/class="ion-product-card"[^>]*data-ion-product-id="(\d+)"/g)).map((m) => m[1]); } catch (e) { /* ignore */ }
    const prods = A.products(); const byId = Object.fromEntries(prods.map((p) => [String(p.id), p]));
    const get = () => ((A.getSetting('home') || {}).featured || null);
    let list = (get() || orig).map(String);
    const wrap = h('div');
    const commit = () => { const same = A.eq(list, orig); A.stage('settings', 'home', same ? null : { featured: list.map(Number) }); };
    const draw = () => {
      wrap.innerHTML = '';
      const tb = h('tbody');
      list.forEach((id, i) => { const p = byId[id]; if (!p) return; tb.appendChild(h('tr', null, h('td', { style: 'width:60px' }, h('div', { class: 'thumb', style: 'width:44px;height:44px;background-image:url(' + JSON.stringify(A.imgUrl(p.image)) + ')' })), h('td', null, h('b', null, p.name), h('div', { class: 'mini' }, A.money(p.price) + (p.vars && p.vars.length > 1 ? ' and up' : ''))), h('td', { style: 'text-align:right;white-space:nowrap' }, h('button', { class: 'btn small', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; commit(); draw(); } }, 'Up'), ' ', h('button', { class: 'btn small', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; commit(); draw(); } }, 'Down'), ' ', h('button', { class: 'btn small danger', onclick: () => { list.splice(i, 1); commit(); draw(); } }, 'Remove')))); });
      if (!list.length) tb.appendChild(h('tr', null, h('td', { class: 'empty' }, 'No products selected. The home page will show no featured products.')));
      const sel = h('select', null, h('option', { value: '' }, 'Add a product...'), prods.filter((p) => !list.includes(String(p.id)) && !(A.getProduct(p.id) || {}).hidden).map((p) => h('option', { value: p.id }, p.name)));
      sel.addEventListener('change', () => { if (sel.value) { list.push(sel.value); commit(); draw(); } });
      wrap.append(A.card('Featured products', list.length + ' shown', h('div', null, h('table', { class: 't' }, tb), h('div', { style: 'margin:14px 0 6px;max-width:360px' }, sel))),
        h('button', { class: 'btn', onclick: () => { list = orig.slice(); commit(); draw(); } }, 'Reset to original list'));
    };
    draw();
    return [...A.pageHead('Home page products', 'Choose which products appear in the featured area of the home page, and in what order.', null, [{ label: 'Shop' }, { label: 'Home page products' }]), A.note('What you are editing', ['The product cards in the "Featured products" part of the home page.', 'Names, prices and pictures come from the product itself. To change them go to Shop > Products.']), A.guard('editor', wrap)];
  };
})();
