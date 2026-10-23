
(function(){
  'use strict';
  var cfg = {"version":"1.0.10","popupEnabled":false,"popupDelay":1200,"cooldownHours":24,"forcePreview":false,"topbarEnabled":true,"topbarHtml":"Please allow 2 extra days for order processing!","popupScopeAllowed":true};
  try { Object.assign(cfg, (window.IONCMS && window.IONCMS.promoCfg) || {}); } catch (e) { /* ignore */ }

  function gatesAreClear(){
    var blockers = [
      '#ion-auth-overlay',
      '#sp-ruo-stage1-overlay',
      '#sp-ruo-stage2-overlay',
      '#sp-login-gate-modal',
      '.sp-login-gate-overlay',
      '.age-gate',
      '.age-gate__wrapper'
    ];

    for (var i = 0; i < blockers.length; i++) {
      var el = document.querySelector(blockers[i]);
      if (!el) continue;
      var st = window.getComputedStyle(el);
      if (st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.01) {
        return false;
      }
    }
    return true;
  }

  function syncTopbarLayout(){
    var bar = document.getElementById('ion-promo-topbar');
    if (!bar || !document.body) return;

    document.documentElement.classList.add('ion-promo-topbar-active');
    document.body.classList.add('ion-promo-topbar-active');

    var h = Math.ceil(bar.getBoundingClientRect().height || 0);
    if (h < 1) h = 44;

    var header = document.querySelector('header.elementor-element.elementor-element-3ff1e64d, #masthead header.elementor-element.elementor-element-3ff1e64d, .elementor-element.elementor-element-3ff1e64d[data-settings*="fixed"]');
    var hh = header ? Math.ceil(header.getBoundingClientRect().height || 0) : 82;
    if (hh < 1) hh = 82;

    document.documentElement.style.setProperty('--ionpc-bar-real-height', h + 'px');
    document.documentElement.style.setProperty('--ionpc-mobile-header-height', hh + 'px');
    document.body.style.setProperty('--ionpc-bar-real-height', h + 'px');
    document.body.style.setProperty('--ionpc-mobile-header-height', hh + 'px');
  }

  function ensureTopbar(){
    if (!cfg.topbarEnabled) return;
    var existing = document.getElementById('ion-promo-topbar');
    if (existing) {
      if (document.body && existing.parentNode !== document.body) {
        document.body.insertBefore(existing, document.body.firstChild);
      } else if (document.body && document.body.firstChild !== existing) {
        document.body.insertBefore(existing, document.body.firstChild);
      }
      syncTopbarLayout();
      return;
    }
    if (!document.body) return;
    var bar = document.createElement('div');
    bar.id = 'ion-promo-topbar';
    bar.className = 'ion-promo-topbar';
    bar.setAttribute('role', 'note');
    bar.setAttribute('aria-label', 'Website announcement');
    var inner = document.createElement('div');
    inner.className = 'ion-promo-topbar__inner';
    inner.innerHTML = cfg.topbarHtml || '';
    bar.appendChild(inner);
    document.body.insertBefore(bar, document.body.firstChild);
    syncTopbarLayout();
  }

  function isMobileViewport(){
    return !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
  }

  function setMobileMenuMode(isOpen){
    if (!document.documentElement || !document.body) return;

    if (isOpen && isMobileViewport()) {
      document.documentElement.classList.add('ionpc-mobile-menu-open');
      document.body.classList.add('ionpc-mobile-menu-open');
      return;
    }

    document.documentElement.classList.remove('ionpc-mobile-menu-open');
    document.body.classList.remove('ionpc-mobile-menu-open');
    window.setTimeout(syncTopbarLayout, 60);
    window.setTimeout(syncTopbarLayout, 300);
  }

  function targetMatches(selector, target){
    return !!(target && target.closest && target.closest(selector));
  }

  function bindMobileMenuWatcher(){
    document.addEventListener('click', function(e){
      if (!isMobileViewport()) return;
      var target = e.target;

      var openTrigger = targetMatches('.hfe-flyout-trigger, .hfe-nav-menu__toggle, button.elementskit-menu-hamburger, .elementskit-menu-toggler', target);
      var closeTrigger = targetMatches('.hfe-flyout-close, .hfe-flyout-overlay, .hfe-flyout-content a, .elementskit-menu-close, .elementskit-menu-overlay, .elementskit-menu-container a', target);

      if (openTrigger && !closeTrigger) {
        setMobileMenuMode(true);
        window.setTimeout(function(){ setMobileMenuMode(true); }, 80);
        return;
      }

      if (closeTrigger) {
        window.setTimeout(function(){ setMobileMenuMode(false); }, 220);
      }
    }, true);

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') {
        setMobileMenuMode(false);
      }
    });
  }

  bindMobileMenuWatcher();

  window.addEventListener('resize', function(){
    if (!isMobileViewport()) {
      setMobileMenuMode(false);
    }
    syncTopbarLayout();
  });
  window.addEventListener('orientationchange', function(){
    setMobileMenuMode(false);
    window.setTimeout(syncTopbarLayout, 250);
  });
  window.addEventListener('load', function(){
    syncTopbarLayout();
    window.setTimeout(syncTopbarLayout, 250);
    window.setTimeout(syncTopbarLayout, 1000);
  });

  function bootPopup(){
    ensureTopbar();
    if (!cfg.popupEnabled || !cfg.popupScopeAllowed) return;

    var popup = document.getElementById('ion-promo-popup');
    if (!popup) return;

    var key = 'ion_promo_control_seen_' + cfg.version;
    var now = Date.now();
    var cooldown = (parseInt(cfg.cooldownHours, 10) || 0) * 60 * 60 * 1000;

    if (!cfg.forcePreview && cooldown > 0) {
      try {
        var last = parseInt(localStorage.getItem(key) || '0', 10);
        if (last && now - last < cooldown) return;
      } catch(e) {}
    }

    function open(){
      popup.hidden = false;
      popup.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('ion-promo-open');
      try { if (!cfg.forcePreview) localStorage.setItem(key, String(Date.now())); } catch(e) {}
    }

    function close(){
      popup.hidden = true;
      popup.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('ion-promo-open');
    }

    popup.querySelectorAll('[data-ion-promo-close]').forEach(function(el){
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !popup.hidden) close();
    });

    var tries = 0;
    function waitAndOpen(){
      tries++;
      if (gatesAreClear() || tries > 80 || cfg.forcePreview) {
        window.setTimeout(open, parseInt(cfg.popupDelay, 10) || 0);
        return;
      }
      window.setTimeout(waitAndOpen, 250);
    }

    waitAndOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPopup);
  } else {
    bootPopup();
  }
})();
//# sourceURL=ion-promo-control-front-js-after

