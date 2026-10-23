(function ($) {
  function isIonPhoneViewport() {
    var matchedViewport = false;
    var matchedDevice = false;
    var matchedVisual = false;

    if (window.matchMedia) {
      matchedViewport = window.matchMedia('(max-width: 767px)').matches;
    } else {
      matchedViewport = window.innerWidth <= 767;
    }

    if (window.visualViewport) {
      matchedVisual = Math.min(window.visualViewport.width || 9999, window.visualViewport.height || 9999) <= 767;
    }

    if (window.screen) {
      matchedDevice = Math.min(window.screen.width || 9999, window.screen.height || 9999) <= 520 && Math.max(window.screen.width || 0, window.screen.height || 0) <= 950;
    }

    return !!(matchedViewport || matchedVisual || (matchedDevice && navigator.maxTouchPoints > 0));
  }

  function setImportantStyle(node, property, value) {
    if (!node || !node.style) return;

    if (value === '') {
      node.style.removeProperty(property);
      return;
    }

    node.style.setProperty(property, value, 'important');
  }

  function forceMobileTwoColumnGrid() {
    var $root = $('#ion-shop-redesign');
    if (!$root.length) return;

    var isMobile = isIonPhoneViewport();
    var rootEl = document.documentElement;

    if (rootEl) {
      if (isMobile) {
        rootEl.classList.add('ion-shop-force-mobile-two-col');
      } else {
        rootEl.classList.remove('ion-shop-force-mobile-two-col');
      }
    }

    var $grids = $root.find('ul.products.ion-shop-grid, .ion-shop-grid');
    var $items = $grids.children('li.product, .ion-shop-card');

    if (!isMobile) {
      $grids.each(function () {
        setImportantStyle(this, 'display', '');
        setImportantStyle(this, 'flex-flow', '');
        setImportantStyle(this, 'flex-wrap', '');
        setImportantStyle(this, 'align-items', '');
        setImportantStyle(this, 'justify-content', '');
        setImportantStyle(this, 'gap', '');
        setImportantStyle(this, 'grid-template-columns', '');
        setImportantStyle(this, 'width', '');
        setImportantStyle(this, 'min-width', '');
        setImportantStyle(this, 'max-width', '');
        setImportantStyle(this, 'margin', '');
        setImportantStyle(this, 'padding', '');
      });

      $items.each(function () {
        setImportantStyle(this, 'flex', '');
        setImportantStyle(this, 'width', '');
        setImportantStyle(this, 'max-width', '');
        setImportantStyle(this, 'min-width', '');
        setImportantStyle(this, 'margin', '');
        setImportantStyle(this, 'padding', '');
        setImportantStyle(this, 'float', '');
        setImportantStyle(this, 'clear', '');
        setImportantStyle(this, 'grid-column', '');
        setImportantStyle(this, 'box-sizing', '');
        setImportantStyle(this, 'overflow', '');
      });

      return;
    }

    $root.find('.ion-shop-layout').each(function () {
      setImportantStyle(this, 'display', 'block');
      setImportantStyle(this, 'grid-template-columns', '1fr');
    });

    $root.find('.ion-shop-sidebar').each(function () {
      setImportantStyle(this, 'display', 'none');
    });

    $grids.each(function () {
      setImportantStyle(this, 'display', 'flex');
      setImportantStyle(this, 'flex-flow', 'row wrap');
      setImportantStyle(this, 'align-items', 'stretch');
      setImportantStyle(this, 'justify-content', 'flex-start');
      setImportantStyle(this, 'gap', '0');
      setImportantStyle(this, 'grid-template-columns', 'none');
      setImportantStyle(this, 'width', '100%');
      setImportantStyle(this, 'min-width', '0');
      setImportantStyle(this, 'max-width', '100%');
      setImportantStyle(this, 'margin', '0 -7px');
      setImportantStyle(this, 'padding', '0');
      setImportantStyle(this, 'list-style', 'none');
    });

    $items.each(function () {
      setImportantStyle(this, 'flex', '0 0 50%');
      setImportantStyle(this, 'width', '50%');
      setImportantStyle(this, 'max-width', '50%');
      setImportantStyle(this, 'min-width', '0');
      setImportantStyle(this, 'margin', '0 0 14px');
      setImportantStyle(this, 'padding', '0 7px');
      setImportantStyle(this, 'float', 'none');
      setImportantStyle(this, 'clear', 'none');
      setImportantStyle(this, 'grid-column', 'auto');
      setImportantStyle(this, 'box-sizing', 'border-box');
      setImportantStyle(this, 'overflow', 'hidden');
    });

    $grids.children('li.ion-shop-empty').each(function () {
      setImportantStyle(this, 'flex', '0 0 100%');
      setImportantStyle(this, 'width', '100%');
      setImportantStyle(this, 'max-width', '100%');
    });
  }

  
  window.ionShopForceMobileGrid = forceMobileTwoColumnGrid;
  $(function () { forceMobileTwoColumnGrid(); });
})(jQuery);
