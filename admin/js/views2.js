/* Shop, promo codes, inbox, media, redirects, SEO, history, backup, team and help screens. */
(function () {
  'use strict';
  const A = window.ADM, h = A.h;

  /* ---------- products ---------- */
  const pidx = () => { const m = {}; A.products().forEach((p) => { m[p.id] = p; }); return m; };
  const varLabel = (v) => Object.values(v.attr || {}).join(' / ') || 'Option';
  const prodRange = (p, o) => {
    o = o || {};
    const vars = (p.vars || []).map((v) => { const x = (o.vars || {})[v.id]; return x && x.price != null && x.price !== '' ? +x.price : v.price; });
    const arr = vars.length ? vars : [o.price != null && o.price !== '' ? +o.price : p.price];
    return [Math.min(...arr), Math.max(...arr)];
  };
  const rangeText = (r) => (r[0] === r[1] ? A.money(r[0]) : A.money(r[0]) + ' – ' + A.money(r[1]));

  // change one product record; empty values are removed so only real changes are stored
  function setP(id, mutate) {
    const cur = A.clone(A.getProduct(id) || {});
    mutate(cur);
    ['name', 'badge', 'desc', 'short', 'image'].forEach((k) => { if (cur[k] === '' || cur[k] == null) delete cur[k]; });
    ['hidden', 'tiersOff'].forEach((k) => { if (!cur[k]) delete cur[k]; });
    if (cur.inStock !== false) delete cur.inStock;
    if (cur.order === '' || cur.order == null) delete cur.order;
    if (cur.price === '' || cur.price == null) delete cur.price;
    if (cur.tiers && !cur.tiers.length) delete cur.tiers;
    if (cur.vars) { Object.keys(cur.vars).forEach((k) => { const v = cur.vars[k]; ['price', 'max'].forEach((f) => { if (v[f] === '' || v[f] == null) delete v[f]; }); if (v.inStock !== false) delete v.inStock; if (!Object.keys(v).length) delete cur.vars[k]; }); if (!Object.keys(cur.vars).length) delete cur.vars; }
    A.stage('products', id, Object.keys(cur).length ? cur : null);
  }
  A.setP = setP;

  A.views.products = async function (rest, q) {
    A.ensureLinkList();
    const sub = rest[0];
    if (sub === 'edit') return productEditor(rest[1], rest[2] || 'basics');
    if (sub === 'quick') return quickEditor();
    if (sub === 'shared') {
      const f = A.fieldSections(A.byRegion.productpage || []);
      return [...A.pageHead('Text on all product pages', 'Words that appear on every product page, such as the research-use banner and the support section.', null, [{ label: 'Shop' }, { label: 'Products', href: A.link('products') }, { label: 'Text on all product pages' }]), A.note('Shown on every product page', ['Changing text here changes it on all product pages at once.', 'Product name, price, image and description are edited per product, in the products list.']), A.guard('editor', f.el)];
    }
    const prods = A.products();
    const search = h('input', { type: 'text', placeholder: 'Search products...', value: q.s || '' });
    const status = h('select', null, [['all', 'All products'], ['edited', 'Changed by you'], ['hidden', 'Hidden'], ['oos', 'Out of stock']].map(([v, l]) => h('option', { value: v }, l)));
    const tb = h('tbody');
    const draw = () => {
      tb.innerHTML = '';
      const term = search.value.trim().toLowerCase();
      const list = prods.filter((p) => {
        const o = A.getProduct(p.id) || {};
        if (term && !(p.name + ' ' + p.slug).toLowerCase().includes(term)) return false;
        if (status.value === 'edited') return !!A.getProduct(p.id);
        if (status.value === 'hidden') return !!o.hidden;
        if (status.value === 'oos') return o.inStock === false || p.inStock === false;
        return true;
      });
      list.forEach((p) => {
        const o = A.getProduct(p.id) || {};
        tb.appendChild(h('tr', { class: 'clickable', onclick: () => A.go('products/edit/' + p.id) },
          h('td', { style: 'width:64px' }, h('div', { class: 'thumb', style: 'width:46px;height:46px;background-image:url(' + JSON.stringify(A.imgUrl(o.image || p.image)) + ')' })),
          h('td', null, h('b', null, o.name || p.name), h('div', { class: 'mini' }, (o.badge || p.origBadge || '') + (p.vars && p.vars.length ? ' · ' + p.vars.length + ' options' : ''))),
          h('td', null, rangeText(prodRange(p, o))),
          h('td', null, o.hidden ? h('span', { class: 'pill red' }, 'Hidden') : (o.inStock === false || p.inStock === false) ? h('span', { class: 'pill amber' }, 'Out of stock') : h('span', { class: 'pill green' }, 'Live'), ' ', A.getProduct(p.id) ? h('span', { class: 'pill blue' }, 'Changed') : null),
          h('td', null, h('span', { class: 'btn small' }, 'Edit'))));
      });
      if (!list.length) tb.appendChild(h('tr', null, h('td', { colspan: 5, class: 'empty' }, 'No products match.')));
      count.textContent = list.length + ' of ' + prods.length + ' products';
    };
    const count = h('span', { class: 'mini' });
    search.addEventListener('input', draw); status.addEventListener('change', draw);
    draw();
    return [
      ...A.pageHead('Products', 'Every product: name, price, stock, picture, description and visibility.', [h('a', { class: 'btn', href: A.link('products/quick') }, 'Quick price and stock list')], [{ label: 'Shop' }, { label: 'Products' }]),
      A.note('What you are editing', ['Product details that appear in the shop, on the home page and on the product page.', 'Click a product to change its name, price, stock, picture, bulk discounts or to hide it.', 'To change prices of many products at once, use the Quick price and stock list.']),
      h('div', { class: 'toolbar' }, search, status, count),
      h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['', 'Product', 'Price', 'Status', ''].map((x) => h('th', null, x)))), tb)))
    ];
  };

  function productEditor(id, tab) {
    const p = pidx()[id]; if (!p) return A.pageHead('Product not found', '');
    const o = () => A.getProduct(id) || {};
    const tabs = [['basics', 'Basics'], ['pricing', 'Price and stock'], ['bulk', 'Bulk discounts'], ['visibility', 'Visibility']];
    const out = [
      ...A.pageHead(o().name || p.name, p.url, [h('a', { class: 'btn', href: '../' + p.url, target: '_blank', rel: 'noopener' }, 'View live page'), h('button', { class: 'btn small danger', onclick: async () => { if (!A.getProduct(id)) return A.toast('Nothing is changed on this product.'); if (await A.confirm('Reset this product?', 'Everything you changed on this product goes back to the original. You still need to press Save.', 'Reset product', true)) { A.stage('products', id, null); A.render(); } } }, 'Reset to original')], [{ label: 'Shop' }, { label: 'Products', href: A.link('products') }, { label: p.name }]),
      h('div', { class: 'tabs' }, tabs.map(([k, l]) => h('a', { href: A.link('products/edit/' + id + '/' + k), class: k === tab ? 'active' : '' }, l)))
    ];
    const chip = (t, c) => ({ chip: t, chipCls: c });
    const body = h('div');
    if (tab === 'basics') {
      body.append(A.note('What you are editing', 'How this product is described. Leave a field empty to keep the original text, shown in grey.'),
        A.card('Name and description', null, [
          A.frow(Object.assign({ label: 'Product name', help: 'Shown in the shop, the product page, the cart and search.', control: h('input', { type: 'text', value: o().name || '', placeholder: p.name, oninput: (e) => setP(id, (c) => { c.name = e.target.value; }) }) }, chip('Text', 'text'))),
          A.frow(Object.assign({ label: 'Label on the card', help: 'The small tag, for example "Lyophilized".', control: h('input', { type: 'text', value: o().badge || '', placeholder: p.origBadge, oninput: (e) => setP(id, (c) => { c.badge = e.target.value; }) }) }, chip('Text', 'text'))),
          A.frow(Object.assign({ label: 'Short description in the shop', help: 'One or two lines under the name on shop and home cards.', control: h('textarea', { placeholder: p.origDesc, oninput: (e) => setP(id, (c) => { c.desc = e.target.value; }) }) }, chip('Text', 'text'))),
          A.frow(Object.assign({ label: 'Description on the product page', help: 'The italic text under the price on the product page.', control: h('textarea', { placeholder: 'Leave empty to keep the original text', oninput: (e) => setP(id, (c) => { c.short = e.target.value; }) }) }, chip('Text', 'text')))
        ]),
        A.card('Picture', null, A.frow(Object.assign({ label: 'Main picture', help: 'Used on the shop card, product page and cart. Best: a portrait image about 414 by 512 pixels.', control: A.imageControl(o().image || p.image, (v) => setP(id, (c) => { c.image = v === p.image ? '' : v; }), { orig: p.image }) }, chip('Image', 'image')))));
      const ta = body.querySelectorAll('textarea'); ta[0].value = o().desc || ''; ta[1].value = o().short || '';
    } else if (tab === 'pricing') {
      const rows = (p.vars && p.vars.length) ? p.vars : null;
      const live = h('b'); const upd = () => { live.textContent = rangeText(prodRange(p, o())); };
      const tb = h('tbody');
      if (rows) rows.forEach((v) => {
        const x = () => (o().vars || {})[v.id] || {};
        tb.appendChild(h('tr', null,
          h('td', null, h('b', null, varLabel(v))),
          h('td', null, h('input', { type: 'number', step: '0.01', min: 0, value: x().price != null ? x().price : '', placeholder: v.price.toFixed(2), style: 'max-width:130px', oninput: (e) => { setP(id, (c) => { c.vars = c.vars || {}; c.vars[v.id] = Object.assign({}, c.vars[v.id], { price: e.target.value === '' ? '' : Number(e.target.value) }); }); upd(); } })),
          h('td', null, A.toggle(x().inStock !== false && v.inStock !== false, (on) => setP(id, (c) => { c.vars = c.vars || {}; c.vars[v.id] = Object.assign({}, c.vars[v.id], { inStock: on ? true : false }); }), 'In stock')),
          h('td', null, h('input', { type: 'number', min: 0, value: x().max != null ? x().max : '', placeholder: String(v.max || ''), style: 'max-width:110px', oninput: (e) => setP(id, (c) => { c.vars = c.vars || {}; c.vars[v.id] = Object.assign({}, c.vars[v.id], { max: e.target.value === '' ? '' : Number(e.target.value) }); }) }))));
      });
      body.append(A.note('Prices', ['Set the price for each option (size or colour). Leave a price empty to keep the original, shown in grey.', 'Prices are in USD. Bulk discounts are applied on top of these prices.']),
        A.card('Price and stock', null, h('div', null,
          rows ? h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Option', 'Price (USD)', 'Stock', 'Max per order'].map((x) => h('th', null, x)))), tb))
            : A.frow({ label: 'Price (USD)', chip: 'Price', chipCls: 'setting', control: h('input', { type: 'number', step: '0.01', min: 0, value: o().price != null ? o().price : '', placeholder: p.price.toFixed(2), style: 'max-width:160px', oninput: (e) => { setP(id, (c) => { c.price = e.target.value === '' ? '' : Number(e.target.value); }); upd(); } }) }),
          A.frow({ label: 'Whole product', control: A.toggle(o().inStock !== false && p.inStock !== false, (on) => setP(id, (c) => { c.inStock = on ? true : false; }), 'In stock'), help: 'Switch off to mark the whole product (all options) as out of stock.' }),
          h('div', { class: 'mini', style: 'padding:12px 0' }, 'Shown to visitors as: ', live))));
      upd();
    } else if (tab === 'bulk') {
      const mode = () => (o().tiersOff ? 'none' : o().tiers && o().tiers.length ? 'custom' : 'site');
      const box = h('div');
      const draw = () => {
        box.innerHTML = '';
        const sel = h('select', { onchange: () => { const m = sel.value; setP(id, (c) => { delete c.tiers; delete c.tiersOff; if (m === 'none') c.tiersOff = true; if (m === 'custom') c.tiers = ((A.getSetting('discounts') || {}).tiers || p.tiers || []).map((t) => ({ min: t.min, max: t.max >= 999999 ? 0 : t.max, pct: t.pct })); }); draw(); } },
          [['site', 'Use the site-wide bulk discounts'], ['custom', 'Use special steps for this product'], ['none', 'No bulk discount for this product']].map(([v, l]) => h('option', { value: v, selected: v === mode() }, l)));
        box.appendChild(A.frow({ label: 'Bulk discount for this product', chip: 'Price', chipCls: 'setting', control: sel }));
        if (mode() === 'custom') box.appendChild(A.frow({ label: 'Steps', control: A.tiersControl(o().tiers.map((t) => ({ min: t.min, max: t.max >= 999999 ? 0 : t.max, pct: t.pct })), (v) => setP(id, (c) => { c.tiers = v; })) }));
      };
      draw();
      body.append(A.note('Prices', ['Lower the unit price when a customer buys more of this product.', 'Site-wide steps are set under Shop > Bulk discounts.']), A.card('Bulk discounts', null, box));
    } else {
      body.append(A.note('What you are editing', ['Whether visitors can find this product, and where it sits in lists.']),
        A.card('Visibility', null, [
          A.frow({ label: 'Hide this product', chip: 'Setting', chipCls: 'setting', help: 'Removes it from the shop and home page. Its product page sends visitors to the shop. Nothing is deleted, you can show it again any time.', control: A.toggle(!!o().hidden, (on) => setP(id, (c) => { c.hidden = on; }), 'Hidden') }),
          A.frow({ label: 'Position in the shop', chip: 'Setting', chipCls: 'setting', help: 'Lower numbers show first. Leave empty to keep the normal order.', control: h('input', { type: 'number', min: 0, value: o().order != null ? o().order : '', style: 'max-width:140px', oninput: (e) => setP(id, (c) => { c.order = e.target.value === '' ? '' : Number(e.target.value); }) }) })
        ]));
    }
    out.push(A.guard('editor', body));
    return out;
  }

  function quickEditor() {
    const prods = A.products();
    const search = h('input', { type: 'text', placeholder: 'Filter products...' });
    const tb = h('tbody');
    const draw = () => {
      tb.innerHTML = '';
      const term = search.value.trim().toLowerCase();
      prods.filter((p) => !term || p.name.toLowerCase().includes(term)).forEach((p) => {
        const o = () => A.getProduct(p.id) || {};
        const rows = (p.vars && p.vars.length) ? p.vars : [null];
        rows.forEach((v, i) => {
          const x = () => (v ? ((o().vars || {})[v.id] || {}) : o());
          const orig = v ? v.price : p.price;
          tb.appendChild(h('tr', null,
            h('td', null, i === 0 ? h('a', { href: A.link('products/edit/' + p.id) }, h('b', null, p.name)) : ''),
            h('td', null, v ? varLabel(v) : 'Single'),
            h('td', null, h('input', { type: 'number', step: '0.01', min: 0, value: x().price != null ? x().price : '', placeholder: orig.toFixed(2), style: 'max-width:120px', oninput: (e) => setP(p.id, (c) => { const val = e.target.value === '' ? '' : Number(e.target.value); if (v) { c.vars = c.vars || {}; c.vars[v.id] = Object.assign({}, c.vars[v.id], { price: val }); } else c.price = val; }) })),
            h('td', null, v ? A.toggle(x().inStock !== false && v.inStock !== false, (on) => setP(p.id, (c) => { c.vars = c.vars || {}; c.vars[v.id] = Object.assign({}, c.vars[v.id], { inStock: on ? true : false }); }), '') : A.toggle(o().inStock !== false && p.inStock !== false, (on) => setP(p.id, (c) => { c.inStock = on ? true : false; }), ''))));
        });
      });
    };
    search.addEventListener('input', draw); draw();
    return [...A.pageHead('Quick price and stock list', 'Every product option in one list, so you can update prices fast.', null, [{ label: 'Shop' }, { label: 'Products', href: A.link('products') }, { label: 'Quick list' }]),
      A.note('Prices', ['Type a new price to change it. An empty box keeps the original price, shown in grey.', 'Use the switch to mark an option in or out of stock. Press Save when you are done.']),
      h('div', { class: 'toolbar' }, search), A.guard('editor', h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Product', 'Option', 'Price (USD)', 'In stock'].map((x) => h('th', null, x)))), tb))))];
  }

  /* ---------- promo codes (saved right away) ---------- */
  A.views.coupons = async function () {
    const refresh = async () => { const r = await A.sb.from('cms_coupons').select('*').order('created_at', { ascending: false }); A.S.coupons = r.data || []; A.render(); };
    const form = (c) => {
      const isNew = !c;
      c = Object.assign({ code: '', kind: 'percent', amount: 10, min_subtotal: 0, active: true, usage_limit: null, starts_at: null, ends_at: null, note: '' }, c || {});
      const v = {}; const inp = (k, type, extra) => { v[k] = h('input', Object.assign({ type, value: c[k] == null ? '' : (type === 'datetime-local' && c[k] ? new Date(c[k]).toISOString().slice(0, 16) : c[k]) }, extra || {})); return v[k]; };
      const kind = h('select', null, [['percent', 'Percent off the order'], ['fixed', 'Fixed amount off (USD)'], ['shipping', 'Free shipping protection']].map(([a, b]) => h('option', { value: a, selected: a === c.kind }, b)));
      const active = A.toggle(c.active, () => {}, 'Active');
      const body = h('div', null,
        A.frow({ label: 'Code', help: 'What the customer types. Not case sensitive.', control: inp('code', 'text', { disabled: !isNew, placeholder: 'WELCOME10' }) }),
        h('div', { class: 'row c2' }, A.frow({ label: 'Type', control: kind }), A.frow({ label: 'Amount', help: 'Percent or dollars. Ignored for free shipping.', control: inp('amount', 'number', { step: '0.01', min: 0 }) })),
        h('div', { class: 'row c2' }, A.frow({ label: 'Minimum order (USD)', control: inp('min_subtotal', 'number', { step: '0.01', min: 0 }) }), A.frow({ label: 'Maximum uses', help: 'Leave empty for unlimited.', control: inp('usage_limit', 'number', { min: 0 }) })),
        h('div', { class: 'row c2' }, A.frow({ label: 'Starts (optional)', control: inp('starts_at', 'datetime-local') }), A.frow({ label: 'Ends (optional)', control: inp('ends_at', 'datetime-local') })),
        A.frow({ label: 'Note for your team', control: inp('note', 'text') }),
        A.frow({ label: 'Status', control: active }));
      A.modal(isNew ? 'New promo code' : 'Edit ' + c.code, body, [{ label: 'Cancel' }, { label: 'Save code', cls: 'primary', onclick: async () => {
        const code = v.code.value.trim().toUpperCase(); if (!code) { A.toast('Please enter a code.', 'err'); return false; }
        const row = { code, kind: kind.value, amount: Number(v.amount.value) || 0, min_subtotal: Number(v.min_subtotal.value) || 0, usage_limit: v.usage_limit.value === '' ? null : Number(v.usage_limit.value), starts_at: v.starts_at.value ? new Date(v.starts_at.value).toISOString() : null, ends_at: v.ends_at.value ? new Date(v.ends_at.value).toISOString() : null, note: v.note.value, active: active.querySelector('input').checked };
        if (row.kind === 'percent' && (row.amount <= 0 || row.amount > 100)) { A.toast('Percent must be between 1 and 100.', 'err'); return false; }
        const r = await A.sb.from('cms_coupons').upsert(row, { onConflict: 'code' }); if (r.error) { A.toast(A.dbErr(r.error), 'err'); return false; }
        A.toast('Promo code saved. It works on the live site now.', 'ok'); refresh();
      } }]);
    };
    const tb = h('tbody');
    A.S.coupons.forEach((c) => tb.appendChild(h('tr', null,
      h('td', null, h('b', { class: 'mono' }, c.code), h('div', { class: 'mini' }, c.note || '')),
      h('td', null, c.kind === 'percent' ? c.amount + '% off' : c.kind === 'fixed' ? A.money(c.amount) + ' off' : 'Free shipping protection'),
      h('td', null, (c.min_subtotal > 0 ? 'Min ' + A.money(c.min_subtotal) : 'No minimum') + (c.ends_at ? ' · ends ' + new Date(c.ends_at).toLocaleDateString() : '')),
      h('td', null, c.used + (c.usage_limit ? ' / ' + c.usage_limit : ' times')),
      h('td', null, c.active ? h('span', { class: 'pill green' }, 'Active') : h('span', { class: 'pill gray' }, 'Stopped')),
      h('td', { style: 'white-space:nowrap;text-align:right' }, h('button', { class: 'btn small', onclick: () => form(c) }, 'Edit'), ' ', h('button', { class: 'btn small danger', onclick: async () => { if (await A.confirm('Delete ' + c.code + '?', 'The code stops working immediately.', 'Delete', true)) { const r = await A.sb.from('cms_coupons').delete().eq('code', c.code); if (r.error) A.toast(A.dbErr(r.error), 'err'); else { A.toast('Deleted.'); refresh(); } } } }, 'Delete')))));
    if (!A.S.coupons.length) tb.appendChild(h('tr', null, h('td', { colspan: 6, class: 'empty' }, 'No promo codes yet.')));
    return [...A.pageHead('Promo codes', 'Discount codes customers can type in the cart.', A.can('admin') ? [h('button', { class: 'btn primary', onclick: () => form() }, 'New promo code')] : null, [{ label: 'Shop' }, { label: 'Promo codes' }]),
      A.note('What you are editing', ['Codes customers enter under "Have a Promo Code?" in the cart.', 'Promo codes save immediately when you press Save code. You do not need to use the Save bar.', 'The code list is private. Visitors can only test a code they type.']),
      A.guard('admin', h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Code', 'Discount', 'Rules', 'Used', 'Status', ''].map((x) => h('th', null, x)))), tb))))];
  };

  /* ---------- messages ---------- */
  A.views.messages = async function () {
    const r = await A.sb.from('cms_messages').select('*').order('created_at', { ascending: false }).limit(300);
    if (r.error) throw r.error;
    let rows = r.data; const filter = h('select', null, [['all', 'All messages'], ['new', 'New'], ['read', 'Read'], ['done', 'Done'], ['spam', 'Spam']].map(([v, l]) => h('option', { value: v }, l)));
    const tb = h('tbody');
    const setStatus = async (m, s) => { const u = await A.sb.from('cms_messages').update({ status: s }).eq('id', m.id); if (u.error) return A.toast(A.dbErr(u.error), 'err'); m.status = s; A.newMessages = rows.filter((x) => x.status === 'new').length; draw(); };
    const open = (m) => {
      if (m.status === 'new') setStatus(m, 'read');
      A.modal(m.subject || 'Message', h('div', null, h('p', { class: 'mini' }, (m.name || 'Someone') + ' · ' + m.email + (m.phone ? ' · ' + m.phone : '') + ' · ' + A.fmtDate(m.created_at)), h('div', { style: 'white-space:pre-wrap;margin-top:12px' }, m.body)),
        [{ label: 'Mark done', onclick: () => { setStatus(m, 'done'); } }, { label: 'Spam', cls: 'danger', onclick: () => { setStatus(m, 'spam'); } }, { label: 'Reply by email', cls: 'primary', onclick: () => { window.location.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: ' + (m.subject || 'Your message')); } }]);
    };
    const draw = () => {
      tb.innerHTML = '';
      const list = rows.filter((m) => filter.value === 'all' || m.status === filter.value);
      list.forEach((m) => tb.appendChild(h('tr', { class: 'clickable', onclick: () => open(m) }, h('td', null, h('b', null, m.name || m.email), h('div', { class: 'mini' }, m.email)), h('td', null, (m.subject ? m.subject + ' – ' : '') + A.strip(m.body).slice(0, 90)), h('td', null, A.fmtDate(m.created_at)), h('td', null, h('span', { class: 'pill ' + ({ new: 'blue', read: 'gray', done: 'green', spam: 'red' }[m.status]) }, m.status)), h('td', null, A.can('editor') ? h('button', { class: 'btn small danger', onclick: async (e) => { e.stopPropagation(); if (await A.confirm('Delete this message?', 'This cannot be undone.', 'Delete', true)) { const d = await A.sb.from('cms_messages').delete().eq('id', m.id); if (d.error) return A.toast(A.dbErr(d.error), 'err'); rows = rows.filter((x) => x.id !== m.id); draw(); } } }, 'Delete') : null))));
      if (!list.length) tb.appendChild(h('tr', null, h('td', { colspan: 5, class: 'empty' }, 'No messages here.')));
    };
    filter.addEventListener('change', draw); draw();
    A.newMessages = rows.filter((x) => x.status === 'new').length;
    return [...A.pageHead('Messages', 'Everything sent through the contact form on your site.', null, [{ label: 'Customers' }, { label: 'Messages' }]), A.note('What you are looking at', ['Messages from visitors. Click a message to read it and reply by email.', 'The text customers see after sending is edited under Contact form texts.']), h('div', { class: 'toolbar' }, filter), h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['From', 'Message', 'Received', 'Status', ''].map((x) => h('th', null, x)))), tb)))];
  };

  /* ---------- media ---------- */
  A.views.media = async function () {
    const r = await A.sb.from('cms_media').select('*').order('created_at', { ascending: false }).limit(500);
    let items = r.data || [];
    const grid = h('div', { class: 'mediagrid' });
    const draw = () => {
      grid.innerHTML = '';
      items.forEach((m) => grid.appendChild(h('div', { class: 'mitem', onclick: () => {
        const alt = h('input', { type: 'text', value: m.alt || '', placeholder: 'Describe the picture' });
        A.modal(m.name || 'Image', h('div', null, h('div', { class: 'thumb', style: 'width:100%;height:240px;background-image:url(' + JSON.stringify(m.url) + ')' }),
          A.frow({ label: 'Address', help: 'Paste this address into any image field.', control: h('input', { type: 'text', readonly: true, value: m.url, onclick: (e) => e.target.select() }) }), A.frow({ label: 'Description (alt text)', control: alt })),
          [{ label: 'Delete', cls: 'danger', onclick: async () => { if (!await A.confirm('Delete this image?', 'Pages using it will show a broken picture.', 'Delete', true)) return false; await A.sb.storage.from('media').remove([m.path]); await A.sb.from('cms_media').delete().eq('id', m.id); items = items.filter((x) => x.id !== m.id); draw(); } }, { label: 'Copy address', onclick: async () => { try { await navigator.clipboard.writeText(m.url); A.toast('Copied.', 'ok'); } catch (e) { A.toast('Select the address and copy it.'); } return false; }, keep: true }, { label: 'Save', cls: 'primary', onclick: async () => { await A.sb.from('cms_media').update({ alt: alt.value }).eq('id', m.id); m.alt = alt.value; A.toast('Saved.', 'ok'); } }]);
      } }, h('div', { class: 'im', style: 'background-image:url(' + JSON.stringify(m.url) + ')' }), h('div', { class: 'n' }, m.name))));
      if (!items.length) grid.appendChild(h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'No uploads yet. Upload your first image above.'));
    };
    const file = h('input', { type: 'file', multiple: true, accept: 'image/*', style: 'display:none', onchange: async (e) => { for (const f of e.target.files) { try { items.unshift(await A.upload(f)); draw(); } catch (err) { A.toast(f.name + ': ' + A.dbErr(err), 'err'); } } A.toast('Upload finished.', 'ok'); } });
    draw();
    return [...A.pageHead('Images and files', 'Pictures you upload. Use them in any image field across the admin.', [h('button', { class: 'btn primary', onclick: () => file.click() }, 'Upload images'), file], [{ label: 'Content' }, { label: 'Images and files' }]), A.note('What you are editing', ['Your own uploaded pictures. The pictures that already come with the site are available inside every image field under "Images already on the site".', 'Uploading a picture here does not change any page. After uploading, open the page or product and choose it.']), A.guard('editor', grid)];
  };

  /* ---------- redirects ---------- */
  A.views.redirects = async function () {
    A.ensureLinkList();
    const get = () => ((A.getSetting('redirects') || {}).list || []).map((x) => Object.assign({}, x));
    let rows = get();
    const commit = () => A.stage('settings', 'redirects', rows.filter((r) => r.from || r.to).length ? { list: rows.filter((r) => r.from && r.to) } : null);
    const tb = h('tbody');
    const draw = () => {
      tb.innerHTML = '';
      rows.forEach((r, i) => tb.appendChild(h('tr', null,
        h('td', null, h('input', { type: 'text', list: 'pagelinks', value: r.from || '', placeholder: 'old-page.html', oninput: (e) => { r.from = e.target.value.trim(); commit(); } })),
        h('td', null, h('input', { type: 'text', list: 'pagelinks', value: r.to || '', placeholder: 'shop.html or https://...', oninput: (e) => { r.to = e.target.value.trim(); commit(); } })),
        h('td', null, h('button', { class: 'btn small danger', onclick: () => { rows.splice(i, 1); commit(); draw(); } }, 'Remove')))));
      if (!rows.length) tb.appendChild(h('tr', null, h('td', { colspan: 3, class: 'empty' }, 'No redirects yet.')));
    };
    draw();
    return [...A.pageHead('Redirects', 'Send visitors from one address to another.', [h('button', { class: 'btn', onclick: () => { rows.push({ from: '', to: '' }); draw(); } }, 'Add a redirect')], [{ label: 'Site' }, { label: 'Redirects' }]),
      A.note('What you are editing', ['When someone opens the first address, they land on the second.', 'Use it when a page is renamed, or to hide a page: send it to another page.', 'Write the page as it appears in the address, for example faq.html or product/ion3r.html.']),
      A.guard('admin', h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Old address', 'Send visitors to', ''].map((x) => h('th', null, x)))), tb))))];
  };

  /* ---------- page titles (SEO) ---------- */
  A.views['seo-pages'] = async function () {
    const pages = (A.defaults.pages || []);
    const search = h('input', { type: 'text', placeholder: 'Filter pages...' });
    const tb = h('tbody');
    const getS = () => Object.assign({}, A.getSetting('seo') || {});
    const setPage = (file, patch) => { const s = getS(); s.pages = Object.assign({}, s.pages); const cur = Object.assign({}, s.pages[file], patch); Object.keys(cur).forEach((k) => { if (cur[k] === '' || cur[k] === false || cur[k] == null) delete cur[k]; }); if (Object.keys(cur).length) s.pages[file] = cur; else delete s.pages[file]; if (!Object.keys(s.pages).length) delete s.pages; A.stage('settings', 'seo', Object.keys(s).length ? s : null); };
    const draw = () => {
      tb.innerHTML = '';
      pages.filter((p) => (p.file + p.title).toLowerCase().includes(search.value.toLowerCase())).forEach((p) => {
        const cur = (getS().pages || {})[p.file] || {};
        tb.appendChild(h('tr', null, h('td', { style: 'min-width:160px' }, h('b', null, A.pageName(p.file, p.title)), h('div', { class: 'mini' }, p.file)),
          h('td', null, h('input', { type: 'text', value: cur.title || '', placeholder: p.title, oninput: (e) => setPage(p.file, { title: e.target.value }) })),
          h('td', null, h('textarea', { style: 'min-height:48px', placeholder: 'Page description', oninput: (e) => setPage(p.file, { description: e.target.value }) })),
          h('td', null, A.toggle(!!cur.noindex, (on) => setPage(p.file, { noindex: on }), 'Hide'))));
        tb.lastChild.querySelector('textarea').value = cur.description || '';
      });
    };
    search.addEventListener('input', draw); draw();
    return [...A.pageHead('Page titles and descriptions', 'What Google shows for each page.', null, [{ label: 'Site' }, { label: 'Search and sharing', href: A.link('settings/seo') }, { label: 'Page titles' }]),
      A.note('SEO', ['The title is the blue link in Google. The description is the grey text under it.', 'Leave a title empty to keep the original. "Hide" asks search engines not to list that page.']),
      h('div', { class: 'toolbar' }, search), A.guard('admin', h('div', { class: 'card' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Page', 'Title', 'Description', 'Search engines'].map((x) => h('th', null, x)))), tb))))];
  };

  /* ---------- activity and undo ---------- */
  A.views.history = async function (rest, q) {
    const tblSel = h('select', null, [['', 'Everything'], ['cms_content', 'Page content'], ['cms_products', 'Products'], ['cms_settings', 'Settings'], ['cms_coupons', 'Promo codes']].map(([v, l]) => h('option', { value: v }, l)));
    const wrap = h('div');
    const load = async () => {
      wrap.innerHTML = '';
      let qy = A.sb.from('cms_history').select('*').order('at', { ascending: false }).limit(120); if (tblSel.value) qy = qy.eq('tbl', tblSel.value);
      const r = await qy; if (r.error) { wrap.appendChild(A.note('Error', A.dbErr(r.error), 'warn')); return; }
      const tb = h('tbody');
      r.data.forEach((x) => tb.appendChild(h('tr', null, h('td', null, h('b', null, A.histLabel(x)), h('div', { class: 'mini' }, (x.by || 'system') + ' · ' + A.fmtDate(x.at))), h('td', { style: 'text-align:right;white-space:nowrap' }, h('button', { class: 'btn small', onclick: () => {
        const fmt = (v) => v == null ? '(original)' : typeof v === 'string' ? v : JSON.stringify(v, null, 1);
        A.modal('Change details', h('div', { class: 'diff' }, h('div', { class: 'o' }, h('b', null, 'Before'), '\n', fmt(x.old)), h('div', { class: 'n' }, h('b', null, 'After'), '\n', fmt(x.new))), [{ label: 'Close' }].concat(x.tbl !== 'cms_coupons' && A.can(x.tbl === 'cms_settings' ? 'admin' : 'editor') ? [{ label: 'Restore the "before" version', cls: 'primary', onclick: () => { const t = x.tbl === 'cms_content' ? 'content' : x.tbl === 'cms_settings' ? 'settings' : 'products'; A.stage(t, t === 'products' ? Number(x.key) : x.key, x.old); A.toast('Restored in your unsaved changes. Press Save to publish it.', 'ok'); } }] : []), { width: '820px' });
      } }, 'View / undo')))));
      if (!r.data.length) tb.appendChild(h('tr', null, h('td', { class: 'empty' }, 'No activity yet.')));
      wrap.appendChild(h('div', { class: 'card' }, h('table', { class: 't' }, tb)));
    };
    tblSel.addEventListener('change', load); await load();
    return [...A.pageHead('Activity and undo', 'See who changed what and when. You can bring back an older version.', null, [{ label: 'Admin' }, { label: 'Activity' }]), A.note('How undo works', ['Open any change with View / undo, then choose Restore. The old version is placed in your unsaved changes.', 'Press Save to publish it. Nothing is lost: the restore itself is recorded too.']), h('div', { class: 'toolbar' }, tblSel), wrap];
  };

  /* ---------- backup ---------- */
  A.views.backup = async function () {
    const exportAll = async () => {
      const r = await A.sb.from('cms_coupons').select('*');
      const data = { app: 'ion-admin', version: 1, exported: new Date().toISOString(), content: A.S.content, settings: A.S.settings, products: A.S.products, coupons: r.data || [] };
      const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'ion-admin-backup-' + new Date().toISOString().slice(0, 10) + '.json' }); document.body.appendChild(a); a.click(); a.remove();
    };
    const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); if (d.app !== 'ion-admin') throw new Error('This is not an Ion admin backup file.');
        const nC = Object.keys(d.content || {}).length, nS = Object.keys(d.settings || {}).length, nP = Object.keys(d.products || {}).length;
        if (!await A.confirm('Load this backup?', 'It contains ' + nC + ' page edits, ' + nS + ' settings and ' + nP + ' products. They are added to your unsaved changes (existing edits not in the backup are kept). Press Save afterwards to publish.', 'Load backup')) return;
        Object.entries(d.content || {}).forEach(([k, v]) => A.stage('content', k, v)); Object.entries(d.settings || {}).forEach(([k, v]) => A.stage('settings', k, v)); Object.entries(d.products || {}).forEach(([k, v]) => A.stage('products', Number(k), v));
        A.toast('Backup loaded into unsaved changes.', 'ok');
      } catch (err) { A.toast(A.dbErr(err), 'err'); }
    } });
    return [...A.pageHead('Backup and restore', 'Download everything you have changed, or load an earlier backup.', null, [{ label: 'Admin' }, { label: 'Backup' }]),
      A.note('Good to know', ['The backup file contains all your page edits, settings, product changes and promo codes. It does not contain uploaded pictures (they stay stored online).', 'Download one before big changes. Promo codes are included in the file for your records but are not restored by loading it.']),
      A.card('Download', null, h('div', { style: 'padding:14px 0' }, h('button', { class: 'btn primary', onclick: exportAll }, 'Download backup file'))),
      A.card('Load a backup', null, h('div', { style: 'padding:14px 0' }, h('button', { class: 'btn', onclick: () => file.click(), disabled: !A.can('editor') }, 'Choose backup file'), file))];
  };

  /* ---------- team ---------- */
  A.views.team = async function () {
    if (!A.can('owner')) return [...A.pageHead('Team', ''), A.lockNote('owner')];
    const r = await A.sb.from('cms_admins').select('*').order('created_at'); if (r.error) throw r.error;
    const tb = h('tbody');
    const roleHelp = { owner: 'Everything, including adding people', admin: 'Everything except managing people', editor: 'Pages, products, images and messages', viewer: 'Can look, cannot change anything' };
    r.data.forEach((u) => {
      const sel = h('select', { style: 'max-width:160px', onchange: async () => { const x = await A.sb.from('cms_admins').update({ role: sel.value }).eq('user_id', u.user_id); if (x.error) { A.toast(A.dbErr(x.error), 'err'); sel.value = u.role; } else A.toast('Role updated.', 'ok'); } }, Object.keys(roleHelp).map((k) => h('option', { value: k, selected: k === u.role }, k)));
      tb.appendChild(h('tr', null, h('td', null, h('b', null, u.email), u.user_id === A.S.user.id ? h('span', { class: 'pill blue', style: 'margin-left:8px' }, 'You') : null), h('td', null, sel), h('td', null, u.user_id !== A.S.user.id ? h('button', { class: 'btn small danger', onclick: async () => { if (await A.confirm('Remove ' + u.email + '?', 'They can no longer sign in to the admin.', 'Remove', true)) { const x = await A.sb.from('cms_admins').delete().eq('user_id', u.user_id); if (x.error) A.toast(A.dbErr(x.error), 'err'); else A.render(); } } }, 'Remove') : null)));
    });
    const email = h('input', { type: 'email', placeholder: 'name@example.com' }); const role = h('select', null, ['editor', 'admin', 'viewer', 'owner'].map((k) => h('option', { value: k }, k)));
    return [...A.pageHead('Team', 'Who can sign in to this admin and what they can do.', null, [{ label: 'Admin' }, { label: 'Team' }]),
      A.note('Roles', Object.entries(roleHelp).map(([k, v]) => k + ': ' + v).join('. ') + '.'),
      A.card('People', null, h('table', { class: 't' }, h('tbody', null, tb.children.length ? Array.from(tb.children) : h('tr', null, h('td', null, 'No one yet'))))),
      A.card('Add a person', null, h('div', null, A.note('First create their login', ['In Supabase open Authentication > Users > Add user, enter their email and a password, then come back here and add the same email.'], 'warn'), h('div', { class: 'row c3', style: 'align-items:end;padding:6px 0 16px' }, A.frow({ label: 'Email', control: email }), A.frow({ label: 'Role', control: role }), h('div', null, h('button', { class: 'btn primary', onclick: async () => { const x = await A.sb.rpc('cms_add_admin', { p_email: email.value, p_role: role.value }); if (x.error || !x.data.ok) A.toast(x.error ? A.dbErr(x.error) : x.data.message, 'err'); else { A.toast('Added.', 'ok'); A.render(); } } }, 'Add person')))))];
  };

  /* ---------- help ---------- */
  A.views.help = async function () {
    return [...A.pageHead('Help and guide', 'A short guide to this admin.', null, [{ label: 'Admin' }, { label: 'Help' }]),
      A.card('The basics', null, h('div', { style: 'padding:14px 0' }, h('ol', { class: 'steps' },
        h('li', null, h('b', null, 'Find what to change. '), 'Use the menu on the left, or type in the search box at the top (press / to jump to it). You can search for any word that appears on your site.'),
        h('li', null, h('b', null, 'Change it. '), 'Fields with a grey example keep the original until you type something. A yellow tag "Edited" shows what you changed.'),
        h('li', null, h('b', null, 'Save and publish. '), 'A bar appears at the bottom with the number of unsaved changes. Press Save and publish. The live site updates within seconds, no redeploy needed.'),
        h('li', null, h('b', null, 'Changed your mind? '), 'Use "Reset to original" next to a field, or Activity and undo to bring back an older version.')))),
      A.card('What each label means', null, h('div', { style: 'padding:14px 0' }, h('p', null, h('span', { class: 'chip text' }, 'Text'), ' Words on the site, such as headings and paragraphs.'), h('p', null, h('span', { class: 'chip link' }, 'Link'), ' Where a button or menu item goes. Use a page name like shop.html, or a full address starting with https://.'), h('p', null, h('span', { class: 'chip image' }, 'Image'), ' A picture. Choose one already on the site or upload your own.'), h('p', null, h('span', { class: 'chip setting' }, 'Setting'), ' A switch or value that controls how part of the site behaves.'), h('p', null, h('span', { class: 'chip edited' }, 'Edited'), ' This field now differs from the original.'))),
      A.card('Where things live', null, h('div', { class: 'grid', style: 'padding:14px 0' },
        [['Page words and pictures', 'Content > Pages'], ['Menu, logo and footer', 'Content > Header, menu and footer'], ['Prices, stock, product names', 'Shop > Products'], ['Discounts for buying more', 'Shop > Bulk discounts'], ['Banner and pop-up', 'Promotions'], ['Messages from the contact form', 'Customers > Messages'], ['Colours, fonts, analytics', 'Site'], ['Closing the site temporarily', 'Site > Maintenance mode']].map(([a, b]) => h('div', { class: 'tile' }, h('h3', null, a), h('p', null, b))))),
      A.card('Good to know', null, h('ul', { style: 'padding:14px 0 14px 20px;margin:0' }, h('li', null, 'Only changes are stored. If something looks wrong, reset it and the original comes back.'), h('li', null, 'Visitors may see an older version for a moment while their browser refreshes.'), h('li', null, 'The cart and checkout work as before. Only the shipping fee and promo codes can be changed here.')))];
  };
})();
