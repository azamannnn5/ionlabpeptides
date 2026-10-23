/* Static site behavior. Cart, shop filters, product variations and the local Store API stand-in. */
(function () {
  'use strict';
  var D = window.IONDATA || { products: {}, cards: [] };
  var $ = window.jQuery;
  var scriptEl = document.currentScript;
  var ROOT = scriptEl ? new URL('../../', scriptEl.src).href : '/';
  var CART_KEY = 'ion_static_cart_v1';
  var SHIPPING_PROTECTION = 3;

  /* the captured page already contains controls that the live product script adds on load, remove them so they are not doubled */
  (function () {
    var q = document.querySelectorAll('form.cart .quantity .ionpd-qty-button, form.cart .ionpd-unit-label');
    for (var i = 0; i < q.length; i++) q[i].parentNode.removeChild(q[i]);
  })();

  /* ---------- small helpers ---------- */
  function money(n) {
    var parts = (Math.round(n * 100) / 100).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.');
  }
  function priceHtml(n) {
    var parts = (Math.round(n * 100) / 100).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no">&#36;</span>' + parts.join('.') + '</bdi></span>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var memStore = null;
  function loadCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return memStore || []; }
  }
  function saveCart(items) {
    memStore = items;
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable */ }
  }
  function productOf(id) { return D.products[String(id)] || null; }
  function varOf(p, vid) {
    if (!p || !vid) return null;
    for (var i = 0; i < p.vars.length; i++) if (String(p.vars[i].id) === String(vid)) return p.vars[i];
    return null;
  }
  function tierPct(p, qty) {
    var pct = 0;
    for (var i = 0; i < p.tiers.length; i++) if (qty >= p.tiers[i].min && qty <= p.tiers[i].max) pct = p.tiers[i].pct;
    return pct;
  }
  function baseUnit(item) {
    var p = productOf(item.pid), v = varOf(p, item.vid);
    return v ? v.price : (p ? p.price : 0);
  }
  function unitPrice(item) {
    var p = productOf(item.pid);
    var base = baseUnit(item);
    var pct = p ? tierPct(p, item.qty) : 0;
    return Math.round(base * (1 - pct / 100) * 100) / 100;
  }
  function maxQty(item) {
    var p = productOf(item.pid), v = varOf(p, item.vid);
    return v && v.max ? v.max : 9999;
  }
  function totals(items) {
    var sub = 0, count = 0;
    items.forEach(function (it) { sub += unitPrice(it) * it.qty; count += it.qty; });
    sub = Math.round(sub * 100) / 100;
    var total = items.length ? Math.round((sub + SHIPPING_PROTECTION) * 100) / 100 : 0;
    return { subtotal: sub, count: count, total: total };
  }

  /* ---------- Store API stand-in (the header search and cart script call these) ---------- */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  function jsonResponse(body, headers) {
    var h = { 'Content-Type': 'application/json' };
    for (var k in (headers || {})) h[k] = headers[k];
    return new Response(JSON.stringify(body), { status: 200, headers: h });
  }
  function storeCart() {
    var items = loadCart();
    var t = totals(items);
    return {
      items: items.map(function (it) {
        var p = productOf(it.pid);
        return { key: it.key, id: it.pid, quantity: it.qty, name: p ? p.name : '', permalink: p ? ROOT + p.url : '#' };
      }),
      items_count: t.count,
      totals: {
        total_price: String(Math.round(t.total * 100)),
        currency_code: 'USD', currency_symbol: '$', currency_minor_unit: 2,
        currency_prefix: '$', currency_suffix: ''
      }
    };
  }
  function storeProducts() {
    return Object.keys(D.products).map(function (id) {
      var p = D.products[id];
      return {
        id: p.id, name: p.name, permalink: ROOT + p.url,
        images: p.image ? [{ src: ROOT + p.image }] : []
      };
    }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  }
  if (nativeFetch && window.Response) {
    window.fetch = function (input, init) {
      var u = '';
      try { u = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { u = ''; }
      var m = u.match(/wp-json\/(.*?)(?:\?|$)/);
      if (m) {
        var route = m[1].replace(/\/+$/, '');
        if (route === 'wc/store/v1/cart') return Promise.resolve(jsonResponse(storeCart()));
        if (route === 'wc/store/v1/products') {
          var pg = parseInt((u.match(/[?&]page=(\d+)/) || [])[1] || '1', 10);
          return Promise.resolve(jsonResponse(pg > 1 ? [] : storeProducts(), { 'X-WP-TotalPages': '1' }));
        }
        if (route === 'wp/v2/product') {
          var pg2 = parseInt((u.match(/[?&]page=(\d+)/) || [])[1] || '1', 10);
          var list = pg2 > 1 ? [] : storeProducts().map(function (x) { return { title: x.name, link: x.permalink }; });
          return Promise.resolve(jsonResponse(list, { 'X-WP-TotalPages': '1' }));
        }
        return Promise.resolve(new Response('[]', { status: 404, headers: { 'Content-Type': 'application/json' } }));
      }
      return nativeFetch(input, init);
    };
  }

  /* ---------- side cart (markup follows the live cart drawer) ---------- */
  var NOTICE_TIMER = null;
  function notice(section, kind, text) {
    var box = document.querySelector('.xoo-wsc-notice-container[data-section="' + section + '"]');
    if (!box) return;
    var icon = kind === 'error' ? 'xoo-wsc-icon-cross' : 'xoo-wsc-icon-check_circle';
    box.innerHTML = '<ul class="xoo-wsc-notices"><li class="xoo-wsc-notice-' + kind + '"><span class="' + icon + '"></span>' + esc(text) + '</li></ul>';
    clearTimeout(NOTICE_TIMER);
    NOTICE_TIMER = setTimeout(function () { box.innerHTML = '<ul class="xoo-wsc-notices"></ul>'; }, 5000);
  }
  function itemHtml(it) {
    var p = productOf(it.pid), v = varOf(p, it.vid);
    var name = p ? p.name.replace(/ \u2013 /g, ' - ') : '';
    var url = p ? ROOT + p.url : '#';
    if (it.variant) url += '?attribute_variant=' + encodeURIComponent(it.variant);
    var img = p && p.image ? ROOT + p.image : '';
    var unit = unitPrice(it);
    var total = unit * it.qty;
    var variation = it.variant
      ? '<dl class="variation"><dt class="variation-Variant">Variant:</dt><dd class="variation-Variant"><p>' + esc(it.variant) + '</p></dd></dl>' : '';
    return '<div data-key="' + esc(it.key) + '" class="xoo-wsc-product"><div class="xoo-wsc-img-col"><a href="' + esc(url) + '"><img width="300" height="300" src="' + esc(img) + '" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="' + esc(name) + '" decoding="async" /></a></div>' +
      '<div class="xoo-wsc-sum-col"><div class="xoo-wsc-sm-info"><div class="xoo-wsc-sm-left"><span class="xoo-wsc-pname"><a href="' + esc(url) + '">' + esc(name) + '</a></span>' + variation +
      '<div class="xoo-wsc-priceBox"><div class="xoo-wsc-pprice">Price: ' + priceHtml(unit) + '</div></div>' +
      '<div class="xoo-wsc-qty-box xoo-wsc-qtb-circle"><span class="xoo-wsc-minus xoo-wsc-chng">-</span><input type="number" class="xoo-wsc-qty" step="1" min="0" max="' + maxQty(it) + '" value="' + it.qty + '" placeholder="" inputmode="numeric" /><span class="xoo-wsc-plus xoo-wsc-chng">+</span></div></div>' +
      '<div class="xoo-wsc-sm-right"><div class="xoo-wsc-sm-right-tools"><div class="xoo-wsc-savl-tooltip xoo-wsc-tooltip-cont "><span class="xoo-wsc-save xoo-wsc-icon-heart1 xoo-wsc-has-tooltip"></span><span class="xoo-wsc-tooltip">Save for Later</span></div>' +
      '<div class="xoo-wsc-tooltip-cont xoo-wsc-del-cont"><span class="xoo-wsc-smr-del xoo-wsc-icon-trash xoo-wsc-has-tooltip"></span><span class="xoo-wsc-tooltip">Remove</span></div></div>' +
      '<span class="xoo-wsc-smr-ptotal">' + priceHtml(total) + '</span></div></div></div></div>';
  }
  function containerHtml(items) {
    var t = totals(items);
    var head = '<div class="xoo-wsc-basket"><span class="xoo-wsc-items-count">' + t.count + '</span><span class="xoo-wsc-bki xoo-wsc-icon-cart2"></span></div>' +
      '<div class="xoo-wsc-header"><div class="xoo-wsch-top"><div class="xoo-wsc-notice-container" data-section="cart"><ul class="xoo-wsc-notices"></ul></div>' +
      '<div class="xoo-wsch-section xoo-wsch-sec-left"><div class="xoo-wsch-basket"><span class="xoo-wsch-bki xoo-wsc-icon-cart2 xoo-wsch-icon"></span><span class="xoo-wsch-items-count">' + t.count + '</span></div><span class="xoo-wsch-text">Your Cart</span></div>' +
      '<div class="xoo-wsch-section xoo-wsch-sec-right"><div class="xoo-wsc-tooltip-cont"><div class="xoo-wsch-savelater xoo-wsc-has-tooltip xoo-wsc-toggle-slider" data-slider="savelater"><span class="xoo-wsch-save-count">0</span><span class="xoo-wsch-save-icon xoo-wsc-icon-heart1 xoo-wsch-icon"></span></div><span class="xoo-wsc-tooltip">Saved For Later</span></div>' +
      '<span class="xoo-wsch-close xoo-wsc-icon-cross xoo-wsch-icon"></span></div></div></div>';
    var body, foot;
    if (!items.length) {
      body = '<div class="xoo-wsc-body"><div class="xoo-wsc-empty-cart"><span>Your cart is empty</span><a class="xoo-wsc-btn" href="' + ROOT + 'shop.html">Return to Shop</a></div></div>';
      foot = '<div class="xoo-wsc-footer"><div class="xoo-wsc-ft-extras"></div><div class="xoo-wsc-ft-buttons-cont"><a href="#" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-cart-close xoo-wsc-ft-btn-continue" >Continue Shopping</a></div><div class="xoo-wsc-payment-btns"></div></div>';
    } else {
      body = '<div class="xoo-wsc-body"><div class="xoo-wsc-products xoo-wsc-pattern-row">' + items.map(itemHtml).join('') + '</div></div>';
      foot = '<div class="xoo-wsc-footer"><div class="xoo-wsc-ft-extras"><div class="xoo-wsc-ftx-row xoo-wsc-ftx-coupon"><span class="xoo-wsc-ftx-icon xoo-wsc-icon-coupon-8"></span><span class="xoo-wsc-toggle-slider" data-slider="coupon">Have a Promo Code?</span></div></div>' +
        '<div class="xoo-wsc-ft-totals">' +
        '<div class="xoo-wsc-ft-amt xoo-wsc-ft-amt-subtotal "><span class="xoo-wsc-ft-amt-label">Subtotal</span><span class="xoo-wsc-ft-amt-value">' + priceHtml(t.subtotal) + '</span></div>' +
        '<div class="xoo-wsc-ft-amt xoo-wsc-ft-amt-shipping xoo-wsc-add"><span class="xoo-wsc-ft-amt-label"><span class="xoo-wsc-toggle-slider" data-slider="shipping">Shipping<span class="xoo-wsc-icon-pencil"></span></span></span><span class="xoo-wsc-ft-amt-value"><span class="xoo-wsc-toggle-slider" data-slider="shipping">Calculate</span></span></div>' +
        '<div class="xoo-wsc-ft-amt xoo-wsc-ft-amt-fee_shipping-protection xoo-wsc-add"><span class="xoo-wsc-ft-amt-label">Shipping Protection</span><span class="xoo-wsc-ft-amt-value">' + priceHtml(SHIPPING_PROTECTION) + '</span></div>' +
        '<div class="xoo-wsc-ft-amt xoo-wsc-ft-amt-total "><span class="xoo-wsc-ft-amt-label">Total</span><span class="xoo-wsc-ft-amt-value">' + priceHtml(t.total) + '</span></div></div>' +
        '<span class="xoo-wsc-footer-txt">Shipping, taxes, and discounts calculated at checkout.</span>' +
        '<div class="xoo-wsc-ft-buttons-cont"><a href="' + ROOT + 'cart.html" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-ft-btn-cart" >View Cart</a><a href="#" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-cart-close xoo-wsc-ft-btn-continue" >Continue Shopping</a><a href="' + ROOT + 'checkout.html" class="xoo-wsc-ft-btn xoo-wsc-btn xoo-wsc-ft-btn-checkout" >Checkout<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">&#036;</span>' + t.total.toFixed(2) + '</span></a></div><div class="xoo-wsc-payment-btns"></div></div>';
    }
    return head + body + foot + '<span class="xoo-wsc-loader"></span><span class="xoo-wsc-icon-spinner8 xoo-wsc-loader-icon"></span>';
  }
  var SLIDER_HTML = '<div class="xoo-wsc-notice-container" data-section="slider"><ul class="xoo-wsc-notices"></ul></div>' +
    '<div class="xoo-wsc-sl-content xoo-wsc-sl-shipping" data-slider="shipping"><div class="xoo-wsc-sl-heading"><span class="xoo-wsc-toggle-slider xoo-wsc-slider-close xoo-wsc-icon-arrow-thin-right"></span> Calculate Shipping</div><div class="xoo-wsc-sl-body"></div></div>' +
    '<div class="xoo-wsc-sl-content xoo-wsc-sl-coupon" data-slider="coupon"><div class="xoo-wsc-sl-heading"><span class="xoo-wsc-toggle-slider xoo-wsc-slider-close xoo-wsc-icon-arrow-thin-right"></span> Apply Coupon</div><div class="xoo-wsc-sl-body"><form class="xoo-wsc-sl-apply-coupon"><input type="text" name="xoo-wsc-slcf-input" placeholder="Enter Promo Code"><button class="xoo-wsc-btn" type="submit">Submit</button></form></div></div>';

  function renderCart() {
    var items = loadCart();
    var cont = document.querySelector('.xoo-wsc-container');
    if (cont) cont.innerHTML = containerHtml(items);
    var sl = document.querySelector('.xoo-wsc-slider');
    if (sl && !sl.querySelector('.xoo-wsc-sl-content')) sl.innerHTML = SLIDER_HTML;
    var t = totals(items);
    var subt = document.querySelectorAll('.xoo-wsc-sc-subt');
    for (var i = 0; i < subt.length; i++) subt[i].innerHTML = priceHtml(t.subtotal);
    var cnt = document.querySelectorAll('.xoo-wsc-sc-count');
    for (var j = 0; j < cnt.length; j++) cnt[j].textContent = t.count;
    if ($) { try { $(document.body).trigger('xoo_wsc_cart_updated'); } catch (e) { /* ignore */ } }
  }
  function openCart() { document.body.classList.add('xoo-wsc-cart-active'); document.documentElement.classList.add('xoo-wsc-cart-active'); }
  function closeCart() {
    document.body.classList.remove('xoo-wsc-cart-active', 'xoo-wsc-slider-active', 'xoo-wsc-drawer-active');
    document.documentElement.classList.remove('xoo-wsc-cart-active');
  }
  function addToCart(pid, vid, variant, qty) {
    var items = loadCart();
    var key = pid + '|' + (vid || 0);
    var found = null;
    items.forEach(function (it) { if (it.key === key) found = it; });
    qty = Math.max(1, parseInt(qty, 10) || 1);
    if (found) found.qty += qty;
    else items.push({ key: key, pid: pid, vid: vid || 0, variant: variant || '', qty: qty });
    items.forEach(function (it) { var mx = maxQty(it); if (it.qty > mx) it.qty = mx; });
    saveCart(items);
    renderCart();
    openCart();
  }
  function setQty(key, qty) {
    var items = loadCart();
    var out = [];
    items.forEach(function (it) {
      if (it.key !== key) { out.push(it); return; }
      var mx = maxQty(it);
      if (qty > mx) {
        notice('cart', 'error', 'Only ' + mx + ' in stock');
        qty = mx;
      }
      if (qty > 0) { it.qty = qty; out.push(it); }
    });
    saveCart(out);
    var msg = document.querySelector('.xoo-wsc-notice-container[data-section="cart"]').innerHTML;
    renderCart();
    var box = document.querySelector('.xoo-wsc-notice-container[data-section="cart"]');
    if (box && /xoo-wsc-notice-error/.test(msg)) box.innerHTML = msg;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.xoo-wsc-cart-trigger, .xoo-wsc-basket')) { e.preventDefault(); renderCart(); openCart(); return; }
    if (t.closest('.xoo-wsch-close, .xoo-wsc-opac, .xoo-wsc-cart-close')) { e.preventDefault(); closeCart(); return; }
    var tog = t.closest('.xoo-wsc-toggle-slider');
    if (tog) {
      e.preventDefault();
      var which = tog.getAttribute('data-slider');
      var slider = document.querySelector('.xoo-wsc-slider');
      if (which && slider) {
        slider.querySelectorAll('.xoo-wsc-sl-content').forEach(function (c) { c.style.display = c.getAttribute('data-slider') === which ? '' : 'none'; });
        document.body.classList.add('xoo-wsc-slider-active');
      } else {
        document.body.classList.remove('xoo-wsc-slider-active');
      }
      return;
    }
    var prod = t.closest('.xoo-wsc-product');
    if (prod) {
      var key = prod.getAttribute('data-key');
      var items = loadCart(), cur = 0;
      items.forEach(function (it) { if (it.key === key) cur = it.qty; });
      if (t.closest('.xoo-wsc-plus')) { e.preventDefault(); setQty(key, cur + 1); return; }
      if (t.closest('.xoo-wsc-minus')) { e.preventDefault(); setQty(key, cur - 1); return; }
      if (t.closest('.xoo-wsc-smr-del')) { e.preventDefault(); setQty(key, 0); return; }
    }
    var atc = t.closest('a.add_to_cart_button.ajax_add_to_cart');
    if (atc) {
      e.preventDefault();
      addToCart(parseInt(atc.getAttribute('data-product_id'), 10), 0, '', parseInt(atc.getAttribute('data-quantity'), 10) || 1);
      return;
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('xoo-wsc-qty')) {
      var p = t.closest('.xoo-wsc-product');
      if (p) setQty(p.getAttribute('data-key'), parseInt(t.value, 10) || 0);
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.classList && f.classList.contains('xoo-wsc-sl-apply-coupon')) {
      e.preventDefault();
      var v = (f.querySelector('input') || {}).value || '';
      if (!v.trim()) notice('slider', 'error', 'Please enter promo code');
    }
  });

  /* ---------- product page: variation form ---------- */
  function initVariations() {
    var $forms = $('form.variations_form');
    $forms.each(function () {
      var $form = $(this);
      var variations = [];
      function reload() {
        try { variations = $form.data('product_variations') || JSON.parse($form.attr('data-product_variations') || '[]'); } catch (e) { variations = []; }
      }
      reload();
      function chosen() {
        var attrs = {}, all = true;
        $form.find('select[name^="attribute_"]').each(function () {
          var v = $(this).val();
          attrs[this.name] = v;
          if (!v) all = false;
        });
        return { attrs: attrs, all: all };
      }
      function match(attrs) {
        for (var i = 0; i < variations.length; i++) {
          var va = variations[i].attributes, ok = true;
          for (var k in va) if (va[k] !== '' && va[k] !== attrs[k]) { ok = false; break; }
          if (ok) return variations[i];
        }
        return null;
      }
      function syncSwatches() {
        $form.find('select[name^="attribute_"]').each(function () {
          var val = $(this).val(), name = this.name;
          $form.find('li.variable-item[data-attribute_name="' + name + '"]').each(function () {
            var on = $(this).attr('data-value') === val;
            $(this).toggleClass('selected', on).attr('aria-checked', on ? 'true' : 'false');
          });
          $form.find('.woo-selected-variation-item-name').text(val ? ': ' + val : '');
        });
      }
      function check() {
        syncSwatches();
        var c = chosen();
        var v = c.all ? match(c.attrs) : null;
        var $wrap = $form.find('.woocommerce-variation-add-to-cart');
        if (v) {
          $form.find('input.variation_id').val(v.variation_id);
          $form.find('.single_variation .woocommerce-variation-price').html(v.price_html);
          $form.find('.single_variation .woocommerce-variation-availability').html(v.availability_html);
          $form.find('.single_variation .woocommerce-variation-description').html(v.variation_description || '');
          $form.find('.single_variation_wrap .single_variation').show();
          $wrap.removeClass('woocommerce-variation-add-to-cart-disabled').addClass('woocommerce-variation-add-to-cart-enabled');
          $form.find('.single_add_to_cart_button').removeClass('disabled wc-variation-selection-needed');
          var $q = $form.find('input.qty');
          if (v.max_qty !== '' && v.max_qty != null) $q.attr('max', v.max_qty);
          if (v.min_qty) $q.attr('min', v.min_qty);
          $('.awdr-bulk-customizable-table tr.bulk_table_row').each(function () {
            var pct = parseFloat($(this).find('.wdr_table_discounted_value').text()) || 0;
            if (!pct) return;
            var np = Math.round(v.display_price * (1 - pct / 100) * 100 + 1e-7) / 100;
            $(this).find('.wdr_table_discounted_price').html('<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">$</span>' + np.toFixed(2) + '</span>');
          });
          $form.trigger('found_variation', [v]);
          $form.trigger('show_variation', [v, v.is_purchasable]);
        } else {
          $form.find('input.variation_id').val('');
          $wrap.removeClass('woocommerce-variation-add-to-cart-enabled').addClass('woocommerce-variation-add-to-cart-disabled');
          $form.find('.single_add_to_cart_button').addClass('disabled wc-variation-selection-needed');
          $form.trigger('hide_variation');
        }
        $form.find('.reset_variations').css('visibility', c.all || Object.keys(c.attrs).some(function (k) { return c.attrs[k]; }) ? 'visible' : 'hidden');
      }
      $form.on('check_variations', check);
      $form.on('reload_product_variations', function () { reload(); });
      $form.on('change', 'select[name^="attribute_"]', function () { $form.trigger('woocommerce_variation_select_change'); check(); });
      $form.on('click keydown', 'li.variable-item', function (e) {
        if (e.type === 'keydown' && e.which !== 13 && e.which !== 32) return;
        e.preventDefault();
        var $li = $(this);
        if ($li.hasClass('disabled')) return;
        var name = $li.attr('data-attribute_name');
        $form.find('select[name="' + name + '"]').val($li.attr('data-value')).trigger('change');
      });
      $form.on('click', '.reset_variations', function (e) {
        e.preventDefault();
        $form.find('select[name^="attribute_"]').val('');
        $form.trigger('reset_data');
        check();
      });
      check();
    });
    /* add to cart from the product page */
    $(document).on('click', '.single_add_to_cart_button', function (e) {
      var $btn = $(this);
      if ($btn.hasClass('disabled') || $btn.closest('.xoo-wsc-markup').length) return;
      var $form = $btn.closest('form.cart');
      if (!$form.length) return;
      e.preventDefault();
      var pid = parseInt($form.find('input[name="add-to-cart"]').val() || $btn.val(), 10);
      var vid = parseInt($form.find('input.variation_id').val(), 10) || 0;
      var variant = '';
      $form.find('select[name^="attribute_"]').each(function () { variant = $(this).val(); });
      var qty = parseInt($form.find('input.qty').val(), 10) || 1;
      addToCart(pid, vid, variant, qty);
    });
    $(document).on('submit', 'form.cart', function (e) { e.preventDefault(); });
  }

  /* ---------- shop page ---------- */
  function initShop() {
    var root = document.getElementById('ion-shop-redesign');
    if (!root) return;
    var grid = root.querySelector('ul.products.ion-shop-grid');
    var countEl = root.querySelector('.ion-shop-result-count');
    var loader = document.getElementById('ion-mu-shop-loader');
    var searchEl = root.querySelector('.ion-shop-search-input');
    var catEl = root.querySelector('.ion-shop-category-select');
    var sortEl = root.querySelector('.ion-shop-sort-select');
    var PER = 15;
    var params = new URLSearchParams(window.location.search);
    if (params.get('search')) searchEl.value = params.get('search');
    if (params.get('category')) catEl.value = params.get('category');
    if (params.get('sort')) sortEl.value = params.get('sort');
    var list = [], shown = 0, busy = false;

    function compute() {
      var q = (searchEl.value || '').trim().toLowerCase();
      var cat = catEl.value || '';
      if (cat === 'raws') cat = 'raw';
      var out = D.cards.filter(function (c) {
        if (cat && c.cats.indexOf(cat) < 0) return false;
        if (q && c.title.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      var s = sortEl.value || 'az';
      var byTitle = function (a, b) { return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }); };
      out.sort(function (a, b) {
        if (s === 'za') return byTitle(b, a);
        if (s === 'price_asc') return a.min - b.min || byTitle(a, b);
        if (s === 'price_desc') return b.min - a.min || byTitle(a, b);
        if (s === 'newest') return b.id - a.id;
        return byTitle(a, b);
      });
      return out;
    }
    function paged() { return !(catEl.value || (searchEl.value || '').trim()); }
    function layout() { if (window.ionShopForceMobileGrid) window.ionShopForceMobileGrid(); }
    function render() {
      list = compute();
      shown = 0;
      grid.innerHTML = '';
      countEl.textContent = list.length + (list.length === 1 ? ' product found' : ' products found');
      more();
    }
    function more() {
      var n = paged() ? PER : list.length;
      var html = list.slice(shown, shown + n).map(function (c) { return c.html; }).join('\n');
      shown += n;
      grid.insertAdjacentHTML('beforeend', html);
      root.setAttribute('data-page', String(Math.ceil(Math.min(shown, list.length) / PER) || 1));
      root.setAttribute('data-max-pages', paged() ? String(Math.ceil(list.length / PER)) : '1');
      layout();
    }
    function onScroll() {
      if (busy || !paged() || shown >= list.length) return;
      var r = grid.getBoundingClientRect();
      if (r.bottom - window.innerHeight < 500) {
        busy = true;
        root.setAttribute('data-loading-more', '1');
        if (loader) loader.classList.add('ion-loading');
        setTimeout(function () {
          more();
          busy = false;
          root.setAttribute('data-loading-more', '0');
          if (loader) loader.classList.remove('ion-loading');
        }, 250);
      }
    }
    var timer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var u = new URL(window.location.href);
        if (searchEl.value.trim()) u.searchParams.set('search', searchEl.value.trim()); else u.searchParams.delete('search');
        try { window.history.replaceState({}, '', u.toString()); } catch (e) { /* ignore */ }
        render();
      }, 280);
    });
    var form = root.querySelector('.ion-shop-filters');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); window.location.href = 'shop.html?' + new URLSearchParams(new FormData(form)).toString(); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout);
    render();
  }

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.tagName || f.tagName !== 'FORM') return;
    if (f.closest('.ion-shop-filters, .variations_form, form.cart') || f.classList.contains('ion-shop-filters')) return;
    if (f.classList.contains('xoo-wsc-sl-apply-coupon')) return;
    var a = f.getAttribute('action');
    if (!a || a === '#') e.preventDefault();
  }, true);

  function init() {
    document.documentElement.setAttribute('data-ionpd-media-requested', '1');
    renderCart();
    if ($) { initVariations(); }
    initShop();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.IONSTATIC = { addToCart: addToCart, openCart: openCart, closeCart: closeCart, renderCart: renderCart };
})();
