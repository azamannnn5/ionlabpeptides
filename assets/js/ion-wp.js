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
  function totals(items) {
    var sub = 0; items.forEach(function (it) { sub += unit(it) * it.qty; });
    sub = Math.round(sub * 100) / 100;
    return { sub: sub, fee: items.length ? FEE : 0, total: items.length ? Math.round((sub + FEE) * 100) / 100 : 0 };
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
    return '<div class="ion-wp-row"><span>Subtotal</span><span>' + money(t.sub) + '</span></div><div class="ion-wp-row"><span>Shipping protection</span><span>' + money(t.fee) + '</span></div><div class="ion-wp-row total"><span>Total</span><span>' + money(t.total) + '</span></div>';
  }
  function post(action, payload) {
    var body = new URLSearchParams(); body.set('action', action); body.set('payload', JSON.stringify(payload));
    return fetch(CFG.ajax, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }).then(function (r) { return r.json(); });
  }

  /* ---------- cart page ---------- */
  function renderCartPage(el) {
    var items = loadCart();
    if (!items.length) { el.innerHTML = '<div class="ion-wp-wrap"><h1>Cart</h1><div class="ion-wp-card ion-wp-empty"><p>Your cart is empty.</p><a class="ion-wp-btn" style="max-width:260px;margin:12px auto 0" href="' + esc(ROOT) + 'shop.html">Return to shop</a></div></div>'; return; }
    el.innerHTML = '<div class="ion-wp-wrap"><h1>Cart</h1><div class="ion-wp-grid"><div class="ion-wp-card">' + items.map(function (it) { return lineHtml(it, true); }).join('') + '</div>' +
      '<div class="ion-wp-card"><h2>Order summary</h2>' + summary(items) + '<a class="ion-wp-btn" href="' + esc(ROOT) + 'checkout.html">Proceed to checkout</a><p class="ion-wp-note">Shipping and payment details are confirmed by email after you place your order.</p></div></div></div>';
    el.querySelectorAll('.ion-wp-line').forEach(function (row) {
      row.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-d]'); if (!b) return;
        var d = parseInt(b.getAttribute('data-d'), 10), key = row.getAttribute('data-key'), cur = loadCart(), out = [];
        cur.forEach(function (it) { if (it.key !== key) { out.push(it); return; } var q = d === 0 ? 0 : it.qty + d; if (q > 0) { it.qty = q; out.push(it); } });
        saveCart(out); renderCartPage(el);
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
      '<div class="ion-wp-card"><h2>Order summary</h2>' + items.map(function (it) { return lineHtml(it, false); }).join('') + summary(items) +
      '<button class="ion-wp-btn" type="submit">Place order</button><p class="ion-wp-note">We will email you payment details after we receive your order.</p></div></form></div>';
    var form = el.querySelector('form'), err = form.querySelector('.ion-wp-msg');
    function showErr(m) { err.textContent = m; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var fd = {}; new FormData(form).forEach(function (v, k) { fd[k] = v; });
      if (!fd.first_name || !fd.last_name || !fd.email || !fd.address || !fd.city || !fd.zip) { showErr('Please fill in all required fields.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(fd.email)) { showErr('Please enter a valid email address.'); return; }
      if (!fd.agree) { showErr('Please confirm the research use statement.'); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Placing order...';
      fd.cart = loadCart().map(function (it) { return { pid: it.pid, vid: it.vid, qty: it.qty }; });
      post('ionlab_order', fd).then(function (r) {
        if (r && r.ok) {
          try { localStorage.removeItem(CART_KEY); } catch (x) {} if (window.IONSTATIC && window.IONSTATIC.renderCart) window.IONSTATIC.renderCart();
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

  function init() {
    var c = document.getElementById('ion-wp-cart'); if (c) renderCartPage(c);
    var k = document.getElementById('ion-wp-checkout'); if (k) renderCheckout(k);
    wireContact();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
