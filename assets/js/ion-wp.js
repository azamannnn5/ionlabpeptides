/* WordPress glue: cart page, checkout page and contact form. Uses admin-ajax (the site script intercepts wp-json URLs). */
(function () {
  'use strict';
  var CFG = window.IONLAB || {};
  var CART_KEY = 'ion_static_cart_v1';
  var D = window.IONDATA || { products: {} };
  var FEE = typeof CFG.fee === 'number' ? CFG.fee : 3;
  var ROOT = CFG.root || '/';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
  function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []; } catch (e) { return []; } }
  function saveCart(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {} if (window.IONSTATIC && window.IONSTATIC.renderCart) window.IONSTATIC.renderCart(); }
  function prod(id) { return D.products[String(id)] || null; }
  function vr(p, vid) { if (!p || !vid) return null; for (var i = 0; i < p.vars.length; i++) if (String(p.vars[i].id) === String(vid)) return p.vars[i]; return null; }
  function unit(it) {
    var p = prod(it.pid), v = vr(p, it.vid), base = v ? v.price : (p ? p.price : 0), pct = 0;
    if (p) p.tiers.forEach(function (t) { if (it.qty >= t.min && it.qty <= t.max) pct = t.pct; });
    return Math.round(base * (1 - pct / 100) * 100) / 100;
  }
  var PROMO_KEY = 'ion_promo_v1', PROMO = null;
  try { PROMO = JSON.parse(localStorage.getItem(PROMO_KEY) || 'null'); } catch (e) {}
  function setPromo(p) { PROMO = p; try { if (p) localStorage.setItem(PROMO_KEY, JSON.stringify(p)); else localStorage.removeItem(PROMO_KEY); } catch (e) {} }
  function totals(items) {
    var sub = 0; items.forEach(function (it) { sub += unit(it) * it.qty; });
    sub = Math.round(sub * 100) / 100;
    var disc = items.length && PROMO ? Math.min(sub, PROMO.discount || 0) : 0;
    return { sub: sub, disc: disc, fee: items.length ? FEE : 0, total: items.length ? Math.round((sub - disc + FEE) * 100) / 100 : 0 };
  }
  function lineHtml(it, editable) {
    var p = prod(it.pid), v = vr(p, it.vid);
    var img = (v && v.image) || (p && p.image) || ''; if (img && !/^https?:|^\//.test(img)) img = ROOT + img.replace(/^(\.\.\/)+/, '');
    return '<div class="ion-wp-line" data-key="' + esc(it.key) + '">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') +
      '<div class="nm"><strong>' + esc(p ? p.name.replace(/ – /g, ' - ') : 'Item') + '</strong>' + (it.variant ? '<small>' + esc(it.variant) + '</small>' : '') +
      (editable ? '<div class="ion-wp-qty"><button type="button" data-d="-1" aria-label="Decrease">-</button><span>' + it.qty + '</span><button type="button" data-d="1" aria-label="Increase">+</button><button type="button" data-d="0" style="margin-left:8px;width:auto;padding:0 10px;border-radius:13px">Remove</button></div>' : '<small>Qty ' + it.qty + '</small>') +
      '</div><div class="pr">' + money(unit(it) * it.qty) + '</div></div>';
  }
  function summary(items) {
    var t = totals(items);
    return '<div class="ion-wp-row"><span>Subtotal</span><span>' + money(t.sub) + '</span></div>' + (t.disc ? '<div class="ion-wp-row"><span>Discount (' + esc(PROMO.code) + ')</span><span>-' + money(t.disc) + '</span></div>' : '') + '<div class="ion-wp-row"><span>Shipping protection</span><span>' + money(t.fee) + '</span></div><div class="ion-wp-row total"><span>Total</span><span>' + money(t.total) + '</span></div>';
  }
  function post(action, payload) {
    var body = new URLSearchParams(); body.set('action', action); body.set('payload', JSON.stringify(payload));
    return fetch(CFG.ajax, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }).then(function (r) { return r.json(); });
  }

  function cartPayload() { return loadCart().map(function (it) { return { pid: it.pid, vid: it.vid, qty: it.qty }; }); }
  function revalidate(cb) {
    if (!PROMO) return cb();
    post('ionlab_coupon', { cart: cartPayload(), coupon: PROMO.code }).then(function (r) {
      if (r && r.ok) setPromo({ code: r.code, discount: r.discount }); else setPromo(null); cb();
    }).catch(function () { cb(); });
  }
  function promoBox() {
    if (PROMO) return '<div class="ion-wp-promo"><span>Promo code <strong>' + esc(PROMO.code) + '</strong> applied</span> <button type="button" class="ion-wp-link" data-promo-remove>Remove</button></div>';
    return '<div class="ion-wp-promo"><div class="ion-wp-promo-row"><input type="text" placeholder="Promo code" aria-label="Promo code" data-promo-input autocomplete="off"><button type="button" data-promo-apply>Apply</button></div><p class="ion-wp-note" data-promo-msg style="margin:6px 0 0"></p></div>';
  }
  function sumBlock(items) { return promoBox() + summary(items); }
  function wireSum(el) {
    var box = el.querySelector('.ion-wp-sum'); if (!box) return;
    function paint(msg) { box.innerHTML = sumBlock(loadCart()); bind(); if (msg) { var m = box.querySelector('[data-promo-msg]'); if (m) { m.textContent = msg; m.style.color = '#9b1c1c'; } } }
    function bind() {
      var a = box.querySelector('[data-promo-apply]'), rm = box.querySelector('[data-promo-remove]'), inp = box.querySelector('[data-promo-input]');
      if (a) {
        var go = function () {
          var code = inp.value.trim(); if (!code) return; a.disabled = true;
          post('ionlab_coupon', { cart: cartPayload(), coupon: code }).then(function (r) {
            if (r && r.ok) { setPromo({ code: r.code, discount: r.discount }); paint(); } else { a.disabled = false; paint((r && r.message) || 'That promo code is not valid.'); }
          }).catch(function () { a.disabled = false; paint('Something went wrong. Please try again.'); });
        };
        a.addEventListener('click', go); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
      if (rm) rm.addEventListener('click', function () { setPromo(null); paint(); });
    }
    bind();
  }

  /* ---------- cart page ---------- */
  function renderCartPage(el) {
    var items = loadCart();
    if (!items.length) { el.innerHTML = '<div class="ion-wp-wrap"><h1>Cart</h1><div class="ion-wp-card ion-wp-empty"><p>Your cart is empty.</p><a class="ion-wp-btn" style="max-width:260px;margin:12px auto 0" href="' + esc(ROOT) + 'shop.html">Return to shop</a></div></div>'; return; }
    el.innerHTML = '<div class="ion-wp-wrap"><h1>Cart</h1><div class="ion-wp-grid"><div class="ion-wp-card">' + items.map(function (it) { return lineHtml(it, true); }).join('') + '</div>' +
      '<div class="ion-wp-card"><h2>Order summary</h2><div class="ion-wp-sum">' + sumBlock(items) + '</div><a class="ion-wp-btn" href="' + esc(ROOT) + 'checkout.html">Proceed to checkout</a><p class="ion-wp-note">Shipping and payment details are confirmed by email after you place your order.</p></div></div></div>';
    wireSum(el);
    el.querySelectorAll('.ion-wp-line').forEach(function (row) {
      row.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-d]'); if (!b) return;
        var d = parseInt(b.getAttribute('data-d'), 10), key = row.getAttribute('data-key'), cur = loadCart(), out = [];
        cur.forEach(function (it) { if (it.key !== key) { out.push(it); return; } var q = d === 0 ? 0 : it.qty + d; if (q > 0) { it.qty = q; out.push(it); } });
        saveCart(out); revalidate(function () { renderCartPage(el); });
      });
    });
  }

  /* ---------- checkout page ---------- */
  function renderCheckout(el) {
    var items = loadCart();
    if (!items.length) { el.innerHTML = '<div class="ion-wp-wrap"><h1>Checkout</h1><div class="ion-wp-card ion-wp-empty"><p>Your cart is empty.</p><a class="ion-wp-btn" style="max-width:260px;margin:12px auto 0" href="' + esc(ROOT) + 'shop.html">Return to shop</a></div></div>'; return; }
    el.innerHTML = '<div class="ion-wp-wrap"><h1>Checkout</h1><form class="ion-wp-grid" novalidate><div class="ion-wp-card"><h2>Your details</h2><div class="ion-wp-msg err" hidden></div>' +
      '<div class="ion-wp-two"><label class="ion-wp-field"><span>First name *</span><input name="first_name" autocomplete="given-name" required></label><label class="ion-wp-field"><span>Last name *</span><input name="last_name" autocomplete="family-name" required></label></div>' +
      '<div class="ion-wp-two"><label class="ion-wp-field"><span>Email *</span><input name="email" type="email" autocomplete="email" required></label><label class="ion-wp-field"><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label></div>' +
      '<label class="ion-wp-field"><span>Address *</span><input name="address" autocomplete="address-line1" required></label><label class="ion-wp-field"><span>Apartment, suite, etc.</span><input name="address2" autocomplete="address-line2"></label>' +
      '<div class="ion-wp-two"><label class="ion-wp-field"><span>City *</span><input name="city" autocomplete="address-level2" required></label><label class="ion-wp-field"><span>State / region</span><input name="state" autocomplete="address-level1"></label></div>' +
      '<div class="ion-wp-two"><label class="ion-wp-field"><span>ZIP / postal code *</span><input name="zip" autocomplete="postal-code" required></label><label class="ion-wp-field"><span>Country (2 letters)</span><input name="country" value="US" maxlength="2" autocomplete="country"></label></div>' +
      '<label class="ion-wp-field"><span>Preferred payment method</span><select name="payment"><option>Credit / debit card</option><option>ACH bank transfer</option></select></label>' +
      '<label class="ion-wp-field"><span>Order notes</span><textarea name="notes" rows="3"></textarea></label><div style="position:absolute;left:-9999px" aria-hidden="true"><input name="company_website" tabindex="-1" autocomplete="off"></div>' +
      '<label class="ion-wp-field" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="agree" style="width:auto;margin-top:3px"><span style="margin:0">I am 21 or older and a qualified researcher. Products are for laboratory research use only.</span></label></div>' +
      '<div class="ion-wp-card"><h2>Order summary</h2>' + items.map(function (it) { return lineHtml(it, false); }).join('') + '<div class="ion-wp-sum">' + sumBlock(items) + '</div>' +
      '<button class="ion-wp-btn" type="submit">Place order</button><p class="ion-wp-note">We will email you payment details after we receive your order.</p></div></form></div>';
    var form = el.querySelector('form'), err = form.querySelector('.ion-wp-msg');
    wireSum(el);
    var U = CFG.user;
    if (U) { ['first_name:first', 'last_name:last', 'email:email', 'phone:phone', 'address:address', 'address2:address2', 'city:city', 'state:state', 'zip:zip', 'country:country'].forEach(function (p) { var a = p.split(':'), i = form.querySelector('[name="' + a[0] + '"]'); if (i && U[a[1]]) i.value = U[a[1]]; }); }
    function showErr(m) { err.textContent = m; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var fd = {}; new FormData(form).forEach(function (v, k) { fd[k] = v; });
      if (!fd.first_name || !fd.last_name || !fd.email || !fd.address || !fd.city || !fd.zip) { showErr('Please fill in all required fields.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(fd.email)) { showErr('Please enter a valid email address.'); return; }
      if (!fd.agree) { showErr('Please confirm the research use statement.'); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Placing order...';
      fd.cart = cartPayload(); fd.coupon = PROMO ? PROMO.code : '';
      post('ionlab_order', fd).then(function (r) {
        if (r && r.ok) {
          setPromo(null); try { localStorage.removeItem(CART_KEY); } catch (x) {} if (window.IONSTATIC && window.IONSTATIC.renderCart) window.IONSTATIC.renderCart();
          el.innerHTML = '<div class="ion-wp-wrap"><div class="ion-wp-card ion-wp-done"><h2>Thank you for your order</h2><p>Your order number is <strong>#' + esc(r.order) + '</strong>.</p><p>We sent a confirmation to your email and will send payment details shortly.</p><a class="ion-wp-btn" style="max-width:260px;margin:12px auto 0" href="' + esc(ROOT) + 'shop.html">Continue shopping</a></div></div>';
          window.scrollTo(0, 0);
        } else { btn.disabled = false; btn.textContent = 'Place order'; showErr((r && r.message) || 'Something went wrong. Please try again.'); }
      }).catch(function () { btn.disabled = false; btn.textContent = 'Place order'; showErr('Something went wrong. Please try again.'); });
    });
  }

  /* ---------- contact form ---------- */
  function wireContact() {
    var f = document.querySelector('[data-ion-contact-form]'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var g = function (n) { var i = f.querySelector('[name="' + n + '"]'); return i ? i.value.trim() : ''; };
      var alertEl = f.querySelector('[data-ion-contact-alert]');
      var show = function (ok, msg) { if (alertEl) { alertEl.textContent = msg; alertEl.style.display = 'block'; alertEl.className = 'ion-contact-alert ' + (ok ? 'is-success' : 'is-error'); } };
      if (!g('ion_contact_first_name') || !g('ion_contact_email') || !g('ion_contact_message')) { show(false, 'Please fill in your name, email and message.'); return; }
      var phone = g('ion_contact_phone').replace(/^\+1\s*$/, '');
      post('ionlab_contact', { first_name: g('ion_contact_first_name'), last_name: g('ion_contact_last_name'), email: g('ion_contact_email'), phone: phone, order_number: g('ion_contact_order_number'), message: g('ion_contact_message'), company_website: g('ion_contact_company_website') })
        .then(function (r) { if (r && r.ok) { show(true, r.message || 'Thank you. Your message has been sent.'); f.reset(); } else show(false, (r && r.message) || 'Sorry, something went wrong. Please try again.'); })
        .catch(function () { show(false, 'Sorry, something went wrong. Please try again.'); });
    }, true);
  }

  /* ---------- notices (pop-up) ---------- */
  function notice(msg) {
    var m = document.createElement('div'); m.className = 'ion-wp-modal';
    m.innerHTML = '<div class="ion-wp-modal-box" role="dialog" aria-modal="true"><p></p><button type="button">OK</button></div>';
    m.querySelector('p').textContent = msg;
    function close() { m.remove(); }
    m.querySelector('button').onclick = close; m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.body.appendChild(m); m.querySelector('button').focus();
  }
  var NA = [
    { sel: '#return-center-form', msg: 'Returns request not available at the moment' },
    { sel: 'form[data-ion-rebate-form]', msg: 'Rebate request not available at the moment' },
    { sel: 'form.ion-aff-form', msg: 'Affiliate applications not available at the moment' },
    { sel: 'form.ionmd-poll__form', msg: 'Voting not available at the moment' }
  ];
  function wireNotAvailable() {
    document.addEventListener('submit', function (e) {
      var f = e.target; if (!f || !f.matches) return;
      var hit = null;
      NA.forEach(function (n) { if (f.matches(n.sel)) hit = n.msg; });
      if (!hit && /affiliate-dashboard/.test(location.pathname) && f.closest && f.closest('main, .entry-content, body')) hit = 'Affiliate dashboard not available at the moment';
      if (!hit && /affiliate-application/.test(location.pathname) && f.closest('.entry-content')) hit = 'Affiliate applications not available at the moment';
      if (hit) { e.preventDefault(); e.stopImmediatePropagation(); notice(hit); }
    }, true);
  }

  /* ---------- privacy request ---------- */
  function wirePrivacy() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.ion-privacy-btn'); if (!a) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var m = document.createElement('div'); m.className = 'ion-wp-modal';
      m.innerHTML = '<form class="ion-wp-modal-box ion-wp-modal-form" novalidate><h3>Privacy request</h3><div class="ion-wp-msg err" hidden></div>' +
        '<div class="ion-wp-two"><label class="ion-wp-field"><span>First name *</span><input name="first_name" required></label><label class="ion-wp-field"><span>Last name</span><input name="last_name"></label></div>' +
        '<label class="ion-wp-field"><span>Email *</span><input name="email" type="email" required></label>' +
        '<label class="ion-wp-field"><span>Request type *</span><select name="kind"><option>Access my data</option><option>Delete my data</option><option>Correct my data</option><option>Opt out of marketing</option><option>Other</option></select></label>' +
        '<label class="ion-wp-field"><span>Details *</span><textarea name="message" rows="4" required></textarea></label>' +
        '<div style="position:absolute;left:-9999px" aria-hidden="true"><input name="company_website" tabindex="-1" autocomplete="off"></div>' +
        '<div style="display:flex;gap:10px"><button type="submit" class="ion-wp-btn" style="margin:0">Send request</button><button type="button" class="ion-wp-btn" data-cancel style="margin:0;background:#e8ecf4;color:#1c2333!important">Cancel</button></div></form>';
      document.body.appendChild(m);
      var f = m.querySelector('form'), err = f.querySelector('.ion-wp-msg');
      m.querySelector('[data-cancel]').onclick = function () { m.remove(); };
      m.addEventListener('click', function (ev) { if (ev.target === m) m.remove(); });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault(); err.hidden = true;
        var d = {}; new FormData(f).forEach(function (v, k) { d[k] = String(v).trim(); });
        if (!d.first_name || !/^\S+@\S+\.\S+$/.test(d.email) || !d.message) { err.textContent = 'Please fill in your name, email and details.'; err.hidden = false; return; }
        var b = f.querySelector('button[type=submit]'); b.disabled = true;
        post('ionlab_contact', { first_name: d.first_name, last_name: d.last_name, email: d.email, phone: '', order_number: '', kind: 'Privacy request: ' + d.kind, message: d.kind + '\n\n' + d.message, company_website: d.company_website })
          .then(function (r) {
            if (r && r.ok) { m.remove(); notice('Thank you. Your privacy request was sent. We will email you soon.'); }
            else { b.disabled = false; err.textContent = (r && r.message) || 'Something went wrong. Please try again.'; err.hidden = false; }
          }).catch(function () { b.disabled = false; err.textContent = 'Something went wrong. Please try again.'; err.hidden = false; });
      });
    }, true);
  }

  /* ---------- accounts ---------- */
  function fieldHtml(label, name, type, extra) { return '<label class="ion-wp-field"><span>' + label + '</span><input name="' + name + '" type="' + (type || 'text') + '" ' + (extra || '') + '></label>'; }
  function renderAccount(el) {
    if (CFG.user) return renderDashboard(el);
    var start = /register/.test(location.pathname) ? 'register' : 'login';
    el.innerHTML = '<div class="ion-wp-wrap" style="max-width:520px"><div class="ion-wp-card"><div class="ion-wp-tabs"><button type="button" data-tab="login">Log in</button><button type="button" data-tab="register">Create account</button></div><div class="ion-wp-msg" hidden></div>' +
      '<form data-form="login" novalidate>' + fieldHtml('Email', 'email', 'email', 'autocomplete="username" required') + fieldHtml('Password', 'password', 'password', 'autocomplete="current-password" required') + '<button class="ion-wp-btn" type="submit">Log in</button><p class="ion-wp-note"><button type="button" class="ion-wp-link" data-tab="forgot">Forgot your password?</button></p></form>' +
      '<form data-form="register" novalidate hidden><div class="ion-wp-two">' + fieldHtml('First name *', 'first_name', 'text', 'autocomplete="given-name" required') + fieldHtml('Last name', 'last_name', 'text', 'autocomplete="family-name"') + '</div>' + fieldHtml('Email *', 'email', 'email', 'autocomplete="email" required') + fieldHtml('Password * (at least 8 characters)', 'password', 'password', 'autocomplete="new-password" required') +
      '<div style="position:absolute;left:-9999px" aria-hidden="true"><input name="company_website" tabindex="-1" autocomplete="off"></div><button class="ion-wp-btn" type="submit">Create account</button></form>' +
      '<form data-form="forgot" novalidate hidden><p class="ion-wp-note" style="margin:0 0 12px">Enter your email and we will send you a link to reset your password.</p>' + fieldHtml('Email', 'email', 'email', 'autocomplete="email" required') + '<button class="ion-wp-btn" type="submit">Send reset link</button><p class="ion-wp-note"><button type="button" class="ion-wp-link" data-tab="login">Back to log in</button></p></form></div></div>';
    var msg = el.querySelector('.ion-wp-msg');
    function show(tab) {
      el.querySelectorAll('form[data-form]').forEach(function (f) { f.hidden = f.getAttribute('data-form') !== tab; });
      el.querySelectorAll('.ion-wp-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
      msg.hidden = true;
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) show(b.getAttribute('data-tab')); });
    show(start);
    el.querySelectorAll('form[data-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var kind = f.getAttribute('data-form'), d = {}; new FormData(f).forEach(function (v, k) { d[k] = String(v).trim(); });
        function say(ok, t) { msg.className = 'ion-wp-msg ' + (ok ? 'ok' : 'err'); msg.textContent = t; msg.hidden = false; }
        if (!/^\S+@\S+\.\S+$/.test(d.email || '')) { say(false, 'Please enter a valid email address.'); return; }
        if (kind !== 'forgot' && !d.password) { say(false, 'Please enter your password.'); return; }
        if (kind === 'register' && (!d.first_name || d.password.length < 8)) { say(false, 'Please enter your name and a password of at least 8 characters.'); return; }
        var b = f.querySelector('button[type=submit]'); b.disabled = true;
        post(kind === 'login' ? 'ionlab_login' : kind === 'register' ? 'ionlab_register' : 'ionlab_forgot', d).then(function (r) {
          if (r && r.ok) { if (kind === 'forgot') { b.disabled = false; say(true, r.message); } else { window.location.href = ROOT + 'my-account.html'; } }
          else { b.disabled = false; say(false, (r && r.message) || 'Something went wrong. Please try again.'); }
        }).catch(function () { b.disabled = false; say(false, 'Something went wrong. Please try again.'); });
      });
    });
  }
  function renderDashboard(el) {
    el.innerHTML = '<div class="ion-wp-wrap"><h1>My account</h1><div class="ion-wp-grid"><div class="ion-wp-card"><h2>Your orders</h2><div data-orders><p class="ion-wp-note">Loading...</p></div></div>' +
      '<div class="ion-wp-card"><h2>Your details</h2><div class="ion-wp-msg" hidden></div><form data-profile novalidate></form><button class="ion-wp-btn" type="button" data-logout style="background:#e8ecf4;color:#1c2333!important">Log out</button></div></div></div>';
    post('ionlab_account', {}).then(function (r) {
      if (!r || !r.ok) { el.querySelector('[data-orders]').innerHTML = '<p class="ion-wp-note">We could not load your orders.</p>'; return; }
      var U = r.user, box = el.querySelector('[data-orders]');
      box.innerHTML = r.orders.length ? r.orders.map(function (o) {
        return '<div class="ion-wp-order"><div class="ion-wp-row" style="margin:0"><strong>Order #' + esc(o.number) + '</strong><span>' + esc(o.date) + '</span></div><div class="ion-wp-row" style="margin:4px 0"><span class="ion-wp-pill">' + esc(o.status) + '</span><strong>' + money(o.total) + '</strong></div><div class="ion-wp-note" style="margin:4px 0 0">' + o.items.map(esc).join('<br>') + '</div></div>';
      }).join('') : '<p class="ion-wp-note">You have no orders yet. <a href="' + esc(ROOT) + 'shop.html">Start shopping</a></p>';
      var pf = el.querySelector('[data-profile]');
      pf.innerHTML = '<div class="ion-wp-two">' + fieldHtml('First name', 'first', 'text', 'value="' + esc(U.first) + '"') + fieldHtml('Last name', 'last', 'text', 'value="' + esc(U.last) + '"') + '</div>' +
        '<label class="ion-wp-field"><span>Email</span><input value="' + esc(U.email) + '" disabled></label>' + fieldHtml('Phone', 'phone', 'tel', 'value="' + esc(U.phone) + '"') + fieldHtml('Address', 'address', 'text', 'value="' + esc(U.address) + '"') + fieldHtml('Apartment, suite, etc.', 'address2', 'text', 'value="' + esc(U.address2) + '"') +
        '<div class="ion-wp-two">' + fieldHtml('City', 'city', 'text', 'value="' + esc(U.city) + '"') + fieldHtml('State / region', 'state', 'text', 'value="' + esc(U.state) + '"') + '</div><div class="ion-wp-two">' + fieldHtml('ZIP / postal code', 'zip', 'text', 'value="' + esc(U.zip) + '"') + fieldHtml('Country (2 letters)', 'country', 'text', 'maxlength="2" value="' + esc(U.country) + '"') + '</div><button class="ion-wp-btn" type="submit">Save details</button>';
      pf.addEventListener('submit', function (e) {
        e.preventDefault(); var d = {}; new FormData(pf).forEach(function (v, k) { d[k] = String(v).trim(); });
        var m = el.querySelector('.ion-wp-msg'), b = pf.querySelector('button[type=submit]'); b.disabled = true;
        post('ionlab_profile', d).then(function (r) { b.disabled = false; m.className = 'ion-wp-msg ' + (r && r.ok ? 'ok' : 'err'); m.textContent = (r && r.message) || 'Something went wrong.'; m.hidden = false; }).catch(function () { b.disabled = false; });
      });
    });
    el.querySelector('[data-logout]').addEventListener('click', function () { post('ionlab_logout', {}).then(function () { window.location.href = ROOT + 'my-account.html'; }); });
  }

  function init() {
    var c = document.getElementById('ion-wp-cart'); if (c) revalidate(function () { renderCartPage(c); });
    var k = document.getElementById('ion-wp-checkout'); if (k) revalidate(function () { renderCheckout(k); });
    var a = document.getElementById('ion-wp-account'); if (a) renderAccount(a);
    wireContact(); wireNotAvailable(); wirePrivacy();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
