/* Ion Peptide site loader.
   Reads the saved admin changes (one small file from Supabase) and applies them to the page.
   If Supabase is not set up yet (data/cms-config.js still has placeholders) the site shows exactly the original content. */
(function () {
  'use strict';
  var C = window.IONCMS_CONFIG || {};
  var enabled = !!(C.url && C.anonKey && !/YOUR[-_]/i.test(C.url + C.anonKey));
  var CACHE = 'ioncms_snapshot_v1';
  var API = enabled ? String(C.url).replace(/\/+$/, '') : '';
  var snap = null;
  var D = window.IONDATA || { products: {}, cards: [] };
  var CMS = window.IONCMS = { enabled: enabled, snap: null, shippingFee: null, promoCfg: {} };
  var root = (function () { // path prefix back to the site root, e.g. "../" inside /product/
    var s = document.currentScript; var src = s && s.getAttribute('src') || '';
    var m = src.match(/^((?:\.\.\/)*)assets\/js\/cms\.js/);
    return m ? m[1] : '';
  })();
  CMS.root = root;

  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } }
  function writeCache(s) { try { localStorage.setItem(CACHE, JSON.stringify(s)); } catch (e) { /* storage blocked */ } }
  function fetchSync() { // only used on a visitor's very first visit (nothing cached yet)
    try {
      var x = new XMLHttpRequest();
      x.open('GET', API + '/rest/v1/cms_snapshot?id=eq.1&select=data', false);
      x.setRequestHeader('apikey', C.anonKey); x.setRequestHeader('Authorization', 'Bearer ' + C.anonKey);
      x.send();
      if (x.status === 200) { var r = JSON.parse(x.responseText); return r[0] && r[0].data || null; }
    } catch (e) { /* offline */ }
    return null;
  }
  function fetchAsync(cb) {
    try {
      fetch(API + '/rest/v1/cms_snapshot?id=eq.1&select=data', { headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey } })
        .then(function (r) { return r.json(); }).then(function (r) { cb(r[0] && r[0].data || null); }).catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }
  function get(obj, path, dflt) { var o = obj; for (var i = 0; i < path.length; i++) { if (o == null) return dflt; o = o[path[i]]; } return o == null ? dflt : o; }
  function set(group) { return (snap && snap.settings && snap.settings[group]) || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return Number(n).toFixed(2); }
  function priceAmount(n) { return '<span class="woocommerce-Price-amount amount" aria-hidden="true"><span class="woocommerce-Price-currencySymbol">$</span>' + money(n) + '</span>'; }
  function priceRange(min, max) {
    if (min === max) return priceAmount(min) + '<span class="screen-reader-text">Price: $' + money(min) + '</span>';
    return priceAmount(min) + ' <span aria-hidden="true">–</span> ' + priceAmount(max) + '<span class="screen-reader-text">Price range: $' + money(min) + ' through $' + money(max) + '</span>';
  }
  function isAbs(u) { return /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u); }
  function prefixRel(u, prefix) { return (!u || isAbs(u)) ? u : prefix + u.replace(/^(\.\.\/)+/, ''); }
  function depthOf(attr) { var m = String(attr || '').match(/^((?:\.\.\/)+)/); return m ? m[1] : ''; }
  function fixHtmlPaths(html) { // content saved from a top level page, shown on a page inside a folder
    if (!root) return html;
    return html.replace(/(href|src)="(?!(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/|\.\.\/))([^"]*)"/gi, function (m, a, u) { return a + '="' + root + u + '"'; });
  }

  /* ---------- redirects and maintenance (run before the page is drawn) ---------- */
  function currentFile() { var p = location.pathname.replace(/\/+$/, ''); p = p.split('/').slice(-2).join('/'); return p.replace(/^(product|peptide-information)\//, function (m) { return m; }); }
  function pagePath() { var p = location.pathname; var i = p.indexOf('/product/'); var j = p.indexOf('/peptide-information/'); var k = Math.max(i, j); if (k >= 0) return p.slice(k + 1); return p.split('/').pop() || 'index.html'; }
  CMS.pagePath = pagePath;
  function redirects() {
    var list = set('redirects').list || [];
    var here = pagePath().replace(/\.html$/, '').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var r = list[i]; if (!r || !r.from || !r.to) continue;
      var f = String(r.from).replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/+$/, '').toLowerCase();
      if (f === here || (f === '' && here === 'index')) {
        var to = String(r.to); if (!isAbs(to) || /^\//.test(to)) to = (/^https?:/i.test(to) ? to : (/^\//.test(to) ? to : root + to));
        if (to !== location.href) { location.replace(to); return true; }
      }
    }
    return false;
  }
  function maintenance() {
    var m = set('maintenance'); if (!m.enabled) return false;
    try { if (sessionStorage.getItem('ioncms_bypass') === '1' || /[?&]preview=1/.test(location.search)) { sessionStorage.setItem('ioncms_bypass', '1'); return false; } } catch (e) { /* ignore */ }
    if (/\/admin\//.test(location.pathname)) return false;
    var show = function () {
      document.title = m.title || 'We will be right back';
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;font-family:system-ui,sans-serif;background:#f7f9ff;color:#0d0d67;text-align:center"><div style="max-width:520px"><h1 style="font-size:32px;margin:0 0 14px">' + esc(m.title || 'We will be right back') + '</h1><p style="font-size:17px;line-height:1.6;color:#424242;margin:0">' + esc(m.message || 'The site is being updated. Please check back soon.') + '</p></div></div>';
      document.documentElement.style.visibility = '';
    };
    document.documentElement.style.visibility = 'hidden';
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
    return true;
  }

  /* ---------- products: change the data the shop, cart and product pages are built from ---------- */
  function applyProducts() {
    var P = (snap && snap.products) || {};
    var G = set('discounts');
    var globalTiers = (G.tiers && G.tiers.length) ? G.tiers.map(function (t) { return { min: +t.min, max: (t.max === '' || t.max == null || +t.max <= 0) ? 999999 : +t.max, pct: +t.pct }; }) : null;
    if (G.enabled === false) globalTiers = [];
    var hidden = {}, order = {};
    Object.keys(D.products).forEach(function (id) {
      var p = D.products[id], o = P[id] || {};
      if (!p.__orig) p.__orig = true;
      if (globalTiers) p.tiers = globalTiers;
      if (o.tiers && o.tiers.length) p.tiers = o.tiers.map(function (t) { return { min: +t.min, max: (t.max === '' || t.max == null || +t.max <= 0) ? 999999 : +t.max, pct: +t.pct }; });
      if (o.tiersOff) p.tiers = [];
      if (o.name) p.name = o.name;
      if (o.image) { p.image = o.image; (p.vars || []).forEach(function (v) { v.image = isAbs(o.image) ? o.image : '../' + o.image; }); }
      var vo = o.vars || {}, touched = false;
      (p.vars || []).forEach(function (v) {
        var x = vo[v.id]; if (!x) return;
        if (x.price != null && x.price !== '') { v.price = +x.price; touched = true; }
        if (x.inStock === false) v.inStock = false;
        if (x.inStock === true) v.inStock = true;
        if (x.max != null && x.max !== '') v.max = +x.max;
      });
      if (o.price != null && o.price !== '' && !(p.vars && p.vars.length)) p.price = +o.price;
      if (touched && p.vars.length) p.price = Math.min.apply(null, p.vars.map(function (v) { return v.price; }));
      if (o.inStock === false) { p.inStock = false; (p.vars || []).forEach(function (v) { v.inStock = false; }); }
      p.__badge = o.badge || ''; p.__desc = o.desc || ''; p.__short = o.short || '';
      if (o.hidden) hidden[id] = 1;
      if (o.order != null && o.order !== '') order[id] = +o.order;
      p.hidden = !!o.hidden;
    });
    CMS.hidden = hidden;
    function range(p) { var arr = (p.vars && p.vars.length) ? p.vars.map(function (v) { return v.price; }) : [p.price]; return [Math.min.apply(null, arr), Math.max.apply(null, arr)]; }
    CMS.range = range;
    // shop cards
    var tpl = document.createElement('template'), out = [];
    (D.cards || []).forEach(function (c) {
      var p = D.products[String(c.id)]; if (!p) { out.push(c); return; }
      if (p.hidden) return;
      var o = P[String(c.id)] || {};
      var r = range(p); c.min = r[0]; c.max = r[1];
      var hasEdit = o.name || o.image || o.desc || o.badge || (o.vars && Object.keys(o.vars).length) || o.price != null || o.inStock === false;
      if (hasEdit) {
        tpl.innerHTML = c.html;
        var el = tpl.content.firstElementChild;
        if (el) {
          if (o.name) { c.title = o.name; var h = el.querySelector('h2 a'); if (h) h.textContent = o.name; var l = el.querySelector('.ion-shop-card-image-link'); if (l) l.setAttribute('aria-label', o.name); }
          var im = el.querySelector('img'); if (im) { if (o.image) { im.setAttribute('src', o.image); im.setAttribute('data-ion-shop-backend-src', o.image); im.removeAttribute('srcset'); } if (o.name) im.setAttribute('alt', o.name); }
          if (o.desc) { var d = el.querySelector('.ion-shop-card-description'); if (d) d.textContent = o.desc; }
          if (o.badge) { var b = el.querySelector('.ion-shop-card-badge'); if (b) b.textContent = o.badge; }
          var pr = el.querySelector('.ion-shop-card-price'); if (pr) pr.innerHTML = priceRange(r[0], r[1]);
          if (o.inStock === false) { var btn = el.querySelector('.ion-shop-card-button'); if (btn) btn.textContent = 'Out of stock'; el.classList.add('outofstock'); }
          c.html = el.outerHTML;
        }
      }
      if (order[c.id] != null) c.__order = order[c.id];
      out.push(c);
    });
    out.sort(function (a, b) { var x = a.__order == null ? 1e6 : a.__order, y = b.__order == null ? 1e6 : b.__order; return x - y; });
    D.cards = out;
    CMS.hasOrder = Object.keys(order).length > 0;
    // tools used by pages and cart
    var sf = set('checkout').shippingFee;
    CMS.shippingFee = (sf === '' || sf == null || isNaN(+sf)) ? null : +sf;
  }

  /* ---------- promo codes (checked in the database, never downloaded) ---------- */
  var PROMO_KEY = 'ioncms_promo';
  function savedPromo() { try { return JSON.parse(localStorage.getItem(PROMO_KEY) || 'null'); } catch (e) { return null; } }
  CMS.promoDiscount = function (sub) {
    var p = savedPromo(); if (!p || !p.code) return { amount: 0, freeShip: false };
    if (p.kind === 'shipping') return { amount: 0, freeShip: true, code: p.code };
    var a = p.kind === 'percent' ? sub * (p.amount / 100) : p.amount;
    a = Math.min(sub, Math.round(a * 100) / 100);
    return { amount: a, freeShip: false, code: p.code };
  };
  CMS.applyPromo = function (code, subtotal) {
    if (!enabled) return Promise.resolve({ ok: false, message: 'Promo codes are not available right now.' });
    return fetch(API + '/rest/v1/rpc/validate_promo', {
      method: 'POST', headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code, p_subtotal: subtotal })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (r && r.ok) { try { localStorage.setItem(PROMO_KEY, JSON.stringify({ code: r.code, kind: r.kind, amount: +r.amount })); } catch (e) { /* ignore */ } return { ok: true, message: 'Promo code ' + r.code + ' applied.' }; }
      return { ok: false, message: (r && r.message) || 'This promo code is not valid.' };
    }).catch(function () { return { ok: false, message: 'Could not check the promo code. Please try again.' }; });
  };

  /* ---------- top bar settings for the existing promo script ---------- */
  function promoCfg() {
    var t = set('topbar'), pc = {};
    if (t.enabled === false) pc.topbarEnabled = false;
    if (t.enabled === true) pc.topbarEnabled = true;
    if (t.html != null && t.html !== '') pc.topbarHtml = t.html;
    CMS.promoCfg = pc;
  }

  /* ---------- page text, links, images ---------- */
  function applyContent() {
    var C2 = (snap && snap.content) || {};
    if (!Object.keys(C2).length) return;
    var q = document.querySelectorAll('[data-cms],[data-cms-h],[data-cms-href],[data-cms-src],[data-cms-alt]');
    for (var i = 0; i < q.length; i++) {
      var el = q[i], k;
      if ((k = el.getAttribute('data-cms-h')) && C2[k] != null) el.innerHTML = fixHtmlPaths(String(C2[k]));
      else if ((k = el.getAttribute('data-cms')) && C2[k] != null) el.innerHTML = esc(String(C2[k])).replace(/\n/g, '<br>');
      if ((k = el.getAttribute('data-cms-href')) && C2[k + '@href'] != null) {
        var u = String(C2[k + '@href']); el.setAttribute('href', prefixRel(u, depthOf(el.getAttribute('href')) || (root && !isAbs(u) ? root : '')));
      }
      if ((k = el.getAttribute('data-cms-src')) && C2[k + '@src'] != null) {
        var s = String(C2[k + '@src']); el.setAttribute('src', prefixRel(s, depthOf(el.getAttribute('src')) || (root && !isAbs(s) ? root : '')));
        el.removeAttribute('srcset'); el.removeAttribute('sizes'); el.removeAttribute('data-src'); el.removeAttribute('data-lazy-src');
      }
      if ((k = el.getAttribute('data-cms-alt')) && C2[k + '@alt'] != null) el.setAttribute('alt', String(C2[k + '@alt']));
    }
  }

  /* ---------- site wide: SEO, scripts, colours, banner, popup ---------- */
  function addEl(tag, attrs, html, parent) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.textContent = html; (parent || document.head).appendChild(e); return e; }
  function meta(name, content, prop) { if (!content) return; var sel = prop ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]'; var m = document.head.querySelector(sel); if (!m) { m = document.createElement('meta'); m.setAttribute(prop ? 'property' : 'name', name); document.head.appendChild(m); } m.setAttribute('content', content); }
  function applySeo() {
    var s = set('seo'), pg = (s.pages || {})[pagePath()] || {};
    var title = pg.title || document.title;
    if (pg.title) document.title = pg.title;
    var desc = pg.description || s.defaultDescription;
    if (desc) { meta('description', desc); meta('og:description', desc, true); }
    meta('og:title', title, true);
    if (s.siteName) meta('og:site_name', s.siteName, true);
    var img = pg.ogImage || s.ogImage; if (img) meta('og:image', /^https?:/.test(img) ? img : location.origin + location.pathname.replace(/[^/]*$/, '').replace(/(product|peptide-information)\/$/, '') + img, true);
    if (s.noindexAll || pg.noindex) meta('robots', 'noindex, nofollow');
    if (s.favicon) { var l = document.head.querySelector('link[rel~="icon"]') || addEl('link', { rel: 'icon' }); l.setAttribute('href', prefixRel(s.favicon, root)); }
  }
  function applyScripts() {
    var t = set('scripts');
    if (t.gaId && /^[A-Za-z0-9-]+$/.test(t.gaId)) {
      addEl('script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=' + t.gaId });
      addEl('script', {}, 'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","' + t.gaId + '");');
    }
    if (t.metaPixelId && /^[0-9]+$/.test(t.metaPixelId)) {
      addEl('script', {}, '!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src="https://connect.facebook.net/en_US/fbevents.js";s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script");fbq("init","' + t.metaPixelId + '");fbq("track","PageView");');
    }
    if (t.headCode) inject(t.headCode, document.head);
    if (t.bodyCode) inject(t.bodyCode, document.body);
  }
  function inject(html, parent) { // lets script tags in pasted code run
    var d = document.createElement('div'); d.innerHTML = html;
    Array.prototype.slice.call(d.childNodes).forEach(function (n) {
      if (n.tagName === 'SCRIPT') { var s = document.createElement('script'); for (var i = 0; i < n.attributes.length; i++) s.setAttribute(n.attributes[i].name, n.attributes[i].value); s.text = n.text; parent.appendChild(s); }
      else parent.appendChild(n);
    });
  }
  function applyAppearance() {
    var a = set('appearance'), css = '';
    var vars = { '--ion-navy': a.navy, '--ion-deep': a.deep, '--ion-blue': a.blue, '--ion-soft': a.soft, '--ion-text': a.text };
    var decl = Object.keys(vars).filter(function (k) { return /^#[0-9a-f]{3,8}$/i.test(vars[k] || ''); }).map(function (k) { return k + ':' + vars[k] + ' !important'; }).join(';');
    if (decl) css += ':root,body{' + decl + '}';
    if (/^[\w\s,'"-]+$/.test(a.fontFamily || '') && a.fontFamily) css += 'body,button,input,select,textarea{font-family:' + a.fontFamily + ' !important}';
    if (a.customCss) css += a.customCss;
    var t = set('topbar');
    if (/^#[0-9a-f]{3,8}$/i.test(t.bg || '')) css += '.ion-promo-topbar{background:' + t.bg + ' !important}';
    if (/^#[0-9a-f]{3,8}$/i.test(t.color || '')) css += '.ion-promo-topbar,.ion-promo-topbar *{color:' + t.color + ' !important}';
    if (css) addEl('style', { id: 'ioncms-style' }, css);
  }
  function applyPopup() {
    var p = set('popup'); if (!p.enabled) return;
    var pages = p.pages || 'all';
    if (pages === 'home' && pagePath() !== 'index.html') return;
    if (pages === 'shop' && pagePath() !== 'shop.html') return;
    var key = 'ioncms_popup_seen', hrs = +p.cooldownHours || 24;
    try { var seen = +localStorage.getItem(key) || 0; if (seen && Date.now() - seen < hrs * 3600000 && !/[?&]popup=1/.test(location.search)) return; } catch (e) { /* ignore */ }
    setTimeout(function () {
      var wrap = document.createElement('div');
      wrap.id = 'ioncms-popup'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,5,57,.55)';
      var link = p.buttonLink ? prefixRel(p.buttonLink, root) : '';
      wrap.innerHTML = '<div style="position:relative;max-width:440px;width:100%;background:#fff;border-radius:18px;padding:32px 28px;text-align:center;box-shadow:0 24px 70px rgba(13,13,103,.25);font-family:inherit">' +
        '<button type="button" aria-label="Close" data-x style="position:absolute;top:10px;right:14px;border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#526071">&times;</button>' +
        (p.image ? '<img alt="" src="' + esc(prefixRel(p.image, root)) + '" style="max-width:100%;max-height:180px;margin:0 auto 16px;display:block;border-radius:10px">' : '') +
        '<h2 style="margin:0 0 10px;font-size:24px;color:#0d0d67">' + esc(p.title || '') + '</h2>' +
        '<p style="margin:0 0 20px;color:#424242;line-height:1.55">' + esc(p.text || '').replace(/\n/g, '<br>') + '</p>' +
        (p.buttonText ? '<a href="' + esc(link || '#') + '" data-x style="display:inline-block;padding:12px 26px;border-radius:999px;background:#007eff;color:#fff;text-decoration:none;font-weight:600">' + esc(p.buttonText) + '</a>' : '') + '</div>';
      document.body.appendChild(wrap);
      var close = function () { wrap.remove(); try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* ignore */ } };
      wrap.addEventListener('click', function (e) { if (e.target === wrap || (e.target.closest && e.target.closest('[data-x]'))) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }, (+p.delay || 1200));
  }

  function applyTopbar() {
    var t = set('topbar'); var bar = document.getElementById('ion-promo-topbar'); if (!bar) return;
    var inner = bar.querySelector('.ion-promo-topbar__inner') || bar;
    if (t.html != null && t.html !== '') inner.innerHTML = fixHtmlPaths(t.html);
    if (t.enabled === false) {
      bar.style.display = 'none';
      [document.documentElement, document.body].forEach(function (e) { e.classList.remove('ion-promo-topbar-active'); });
      ['--ionpc-bar-real-height', '--ionpc-bar-height'].forEach(function (v) { document.documentElement.style.setProperty(v, '0px'); document.body.style.setProperty(v, '0px'); });
    }
  }

  /* ---------- homepage featured products ---------- */
  function applyFeatured() {
    var grid = document.querySelector('.ion-product-card') && document.querySelector('.ion-product-card').parentNode;
    if (!grid) return;
    var P = (snap && snap.products) || {};
    var cards = {}; Array.prototype.forEach.call(grid.querySelectorAll('.ion-product-card'), function (c) { cards[c.getAttribute('data-ion-product-id')] = c; });
    var tplCard = grid.querySelector('.ion-product-card');
    var list = set('home').featured;
    function fill(el, id) {
      var p = D.products[id]; if (!p) return false;
      var o = P[id] || {};
      var a = el.querySelectorAll('a[data-ion-product-link]'); for (var i = 0; i < a.length; i++) a[i].setAttribute('href', (root || '') + p.url);
      var h = el.querySelector('[data-ion-product-name]'); if (h) h.textContent = p.name;
      var im = el.querySelector('[data-ion-product-image]'); if (im) { var src = o.image || p.image; im.setAttribute('src', isAbs(src) ? src : (root || '') + src); im.setAttribute('alt', p.name); im.removeAttribute('srcset'); }
      var pr = el.querySelector('[data-ion-product-price]'); if (pr) { var r = CMS.range(p); pr.innerHTML = priceRange(r[0], r[1]); }
      var ds = el.querySelector('.ion-product-desc'); if (ds && o.desc) ds.textContent = o.desc;
      el.setAttribute('data-ion-product-id', id);
      return true;
    }
    if (Array.isArray(list) && list.length) {
      var made = list.map(String).filter(function (id) { return D.products[id] && !D.products[id].hidden; }).map(function (id) { var el = cards[id] || tplCard.cloneNode(true); fill(el, id); return el; });
      Object.keys(cards).forEach(function (id) { cards[id].remove(); });
      made.forEach(function (el) { grid.appendChild(el); });
      return;
    }
    Object.keys(cards).forEach(function (id) {
      if (D.products[id] && D.products[id].hidden) { cards[id].remove(); return; }
      if (P[id]) fill(cards[id], id);
    });
  }

  /* ---------- product page (called from a small tag placed just before the product script) ---------- */
  CMS.productPage = function () {
    if (!snap) return;
    var box = document.querySelector('div.product[id^="product-"]'); if (!box) return;
    var id = box.id.replace('product-', ''), p = D.products[id]; if (!p) return;
    if (p.hidden) { location.replace(root + 'shop.html'); return; }
    var o = ((snap.products || {})[id]) || {};
    var t = box.querySelector('.product_title'); if (t && o.name) { t.textContent = o.name; document.title = document.title.replace(/^[^|–-]+/, o.name + ' '); }
    var pill = box.querySelector('.ionpd-product-pill'); if (pill && o.badge) pill.textContent = o.badge;
    var sd = box.querySelector('.woocommerce-product-details__short-description .woocommerce-product-details__short-description') || box.querySelector('.woocommerce-product-details__short-description');
    if (sd && o.short) sd.innerHTML = '<p><em>' + esc(o.short).replace(/\n/g, '<br>') + '</em></p>';
    var r = CMS.range(p);
    var cfgP = window.ionProductRedesign;
    if (cfgP) { if (o.name) cfgP.productName = o.name; cfgP.basePrice = String(r[0]); cfgP.regularPrice = String(r[0]); cfgP.priceHtml = priceRange(r[0], r[1]); cfgP.priceRangeText = '$' + money(r[0]) + (r[0] === r[1] ? '' : ' \u2013 $' + money(r[1])); }
    var price = box.querySelector('p.price'); if (price) price.innerHTML = priceRange(r[0], r[1]).replace(/<span class="woocommerce-Price-amount amount" aria-hidden="true">/g, '<span class="woocommerce-Price-amount amount" aria-hidden="true"><bdi>').replace(/<\/span><\/span>/g, '</span></bdi></span>').replace(/<bdi>/g, '<bdi>');
    // main image
    if (o.image) {
      var img = box.querySelector('.woocommerce-product-gallery__image img'); var src = isAbs(o.image) ? o.image : root + o.image;
      if (img) { ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-large_image', 'data-o_src', 'data-o_full_src'].forEach(function (a) { img.setAttribute(a, src); }); img.removeAttribute('srcset'); }
      var al = box.querySelector('.woocommerce-product-gallery__image a'); if (al) { al.setAttribute('href', src); al.setAttribute('data-o_href', src); }
    }
    // variations (price, stock, max quantity)
    var form = box.querySelector('form.variations_form');
    if (form) {
      try {
        var vs = JSON.parse(form.getAttribute('data-product_variations') || '[]'), vo = o.vars || {};
        vs.forEach(function (v) {
          var x = vo[v.variation_id]; if (!x && !o.inStock && o.inStock !== false) return;
          if (x && x.price != null && x.price !== '') { v.display_price = +x.price; v.display_regular_price = +x.price; v.price_html = '<span class="price"><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no">$</span>' + money(x.price) + '</bdi></span></span>'; }
          if (x && x.max != null && x.max !== '') v.max_qty = +x.max;
          if ((x && x.inStock === false) || o.inStock === false) { v.is_in_stock = false; v.availability_html = '<p class="stock out-of-stock">Out of stock</p>'; }
          if (o.image) { var u = isAbs(o.image) ? o.image : root + o.image; if (v.image) { v.image.src = u; v.image.url = u; v.image.full_src = u; v.image.thumb_src = u; v.image.gallery_thumbnail_src = u; v.image.srcset = ''; } }
        });
        form.setAttribute('data-product_variations', JSON.stringify(vs));
      } catch (e) { /* leave original */ }
    }
    // quantity discount table
    var tb = box.querySelector('.awdr-bulk-customizable-table tbody');
    var gd = set('discounts');
    if (tb && (o.tiers || o.tiersOff || (gd.tiers && gd.tiers.length) || gd.enabled === false)) {
      var rows = tb.querySelectorAll('tr.bulk_table_row'); var tpl = rows[0];
      if (tpl) {
        Array.prototype.forEach.call(rows, function (rw) { if (rw !== tpl) rw.remove(); });
        var tiers = p.tiers || [], base = r[0];
        if (!tiers.length) { var wrap = box.querySelector('.awdr-bulk-customizable-table'); if (wrap) wrap.style.display = 'none'; tpl.remove(); }
        tiers.forEach(function (ti, i) {
          var row = i === 0 ? tpl : tpl.cloneNode(true);
          var rng = ti.max >= 999999 ? ti.min + '+' : ti.min + ' - ' + ti.max;
          row.querySelector('.wdr_bulk_title').textContent = ti.pct + '% Off';
          row.querySelector('.wdr_bulk_range').textContent = rng;
          row.querySelector('.wdr_table_discounted_value').textContent = ti.pct + '%';
          row.querySelector('.wdr_table_discounted_price').innerHTML = priceAmount(Math.round(base * (1 - ti.pct / 100) * 100) / 100);
          if (i > 0) tb.appendChild(row);
        });
      }
    }
  };

  /* ---------- contact form ---------- */
  function wireContact() {
    var f = document.querySelector('[data-ion-contact-form]'); if (!f || !enabled) return;
    var cs = set('contact');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopPropagation();
      var g = function (n) { var i = f.querySelector('[name="' + n + '"]'); return i ? i.value.trim() : ''; };
      var alert = f.querySelector('[data-ion-contact-alert]');
      var show = function (ok, msg) { if (alert) { alert.textContent = msg; alert.style.display = 'block'; alert.className = 'ion-contact-alert ' + (ok ? 'is-success' : 'is-error'); } };
      if (g('ion_contact_company_website')) return; // spam trap
      if (!g('ion_contact_first_name') || !g('ion_contact_email') || !g('ion_contact_message')) { show(false, cs.errorMessage || 'Please fill in your name, email and message.'); return; }
      var phone = g('ion_contact_phone').replace(/^\+1\s*$/, '');
      var order = g('ion_contact_order_number');
      fetch(API + '/rest/v1/rpc/submit_message', {
        method: 'POST', headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: (g('ion_contact_first_name') + ' ' + g('ion_contact_last_name')).trim(), p_email: g('ion_contact_email'), p_phone: phone, p_subject: order ? 'Order ' + order : 'Contact form', p_body: g('ion_contact_message') })
      }).then(function (r) { return r.json(); }).then(function (r) {
        if (r && r.ok) { show(true, cs.successMessage || 'Thank you. Your message has been sent.'); f.reset(); }
        else show(false, (r && r.message) || cs.errorMessage || 'Sorry, something went wrong. Please try again.');
      }).catch(function () { show(false, cs.errorMessage || 'Sorry, something went wrong. Please try again.'); });
    }, true);
  }

  /* ---------- start ---------- */
  if (enabled) {
    snap = readCache();
    if (!snap) snap = fetchSync();
    if (snap) writeCache(snap);
  }
  CMS.snap = snap;
  if (snap && redirects()) return;
  if (snap && maintenance()) { /* page replaced when ready */ }
  if (snap) { applyProducts(); promoCfg(); } else { CMS.range = function (p) { var arr = (p.vars && p.vars.length) ? p.vars.map(function (v) { return v.price; }) : [p.price]; return [Math.min.apply(null, arr), Math.max.apply(null, arr)]; }; }

  function domReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  domReady(function () {
    if (snap) { applyContent(); applySeo(); applyScripts(); applyAppearance(); applyFeatured(); applyPopup(); applyTopbar(); window.addEventListener('load', function () { setTimeout(applyTopbar, 200); }); }
    wireContact();
    if (enabled) fetchAsync(function (fresh) { // quietly check for newer changes
      if (!fresh) return;
      var strip = function (s) { return s ? JSON.stringify([s.products, s.settings]) : ''; };
      var needsReload = !!snap && strip(fresh) !== strip(snap);
      var contentChanged = !!snap && JSON.stringify(fresh.content) !== JSON.stringify(snap.content);
      writeCache(fresh);
      if (needsReload) { // prices, products or settings changed: show them with one quick reload
        try { if (sessionStorage.getItem('ioncms_rl') !== String(fresh.v)) { sessionStorage.setItem('ioncms_rl', String(fresh.v)); location.reload(); } } catch (e) { /* ignore */ }
      } else if (contentChanged) { snap = fresh; CMS.snap = fresh; applyContent(); }
    });
  });
})();
