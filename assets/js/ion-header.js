
(function () {
  "use strict";

  /*
   * BRW mobile-only Shop dropdown guard.
   * This is intentionally placed before the search/header logic so the mobile
   * Shop toggle still works even if another header feature intercepts clicks.
   */
  var ionLastMobileShopTouch = 0;

  function ionMobileShopClosest(node, className) {
    var current = node;

    while (current) {
      if (current.nodeType === 1) {
        if (current.classList) {
          if (current.classList.contains(className)) {
            return current;
          }
        }
      }

      if (current === document) {
        break;
      }

      current = current.parentNode;
    }

    return null;
  }

  function ionHandleMobileShopToggle(event) {
    var trigger = ionMobileShopClosest(event.target, "ion-mobile-shop-toggle");
    var panel = null;
    var list = null;
    var isOpen = false;
    var now = Date.now();

    if (!trigger) {
      return;
    }

    panel = ionMobileShopClosest(trigger, "ion-mobile-menu-panel");

    if (!panel) {
      return;
    }

    if (!panel.classList.contains("is-open")) {
      return;
    }

    list = panel.querySelector(".ion-mobile-shop-list");

    if (!list) {
      return;
    }

    if (event.type === "click") {
      if (now - ionLastMobileShopTouch < 700) {
        event.preventDefault();
        event.stopPropagation();

        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }

        return;
      }
    }

    if (event.type === "touchend") {
      ionLastMobileShopTouch = now;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    isOpen = !list.classList.contains("is-open");
    list.classList.toggle("is-open", isOpen);
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  document.addEventListener("touchend", ionHandleMobileShopToggle, true);
  document.addEventListener("click", ionHandleMobileShopToggle, true);

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
      return;
    }

    fn();
  }

  onReady(function () {
    var header = document.getElementById("ion-site-header");
    var mobilePanel = document.querySelector(".ion-mobile-menu-panel");
    var productRoot = document.getElementById("ion-float-products");
    var productCache = [];
    var productLoadPromise = null;
    var activeSearchTimer = null;
    var requestId = 0;

    if (!header) {
      return;
    }

    var searchWrap = header.querySelector(".ion-header-search-wrap");
    var searchToggle = header.querySelector(".ion-header-search-toggle");
    var searchBox = header.querySelector(".ion-header-search-box");
    var searchInput = header.querySelector(".ion-header-search-input");
    var searchResults = header.querySelector(".ion-header-search-results");
    var mobileButton = header.querySelector(".ion-header-mobile-button");
    var mobileClose = document.querySelector(".ion-mobile-menu-close");
    var mobileBackdrop = document.querySelector(".ion-mobile-menu-backdrop");
    var mobileShopToggle = document.querySelector(".ion-mobile-shop-toggle");
    var mobileShopList = document.querySelector(".ion-mobile-shop-list");

    function nodeMatches(node, selector) {
      if (!node) {
        return false;
      }

      if (node.nodeType !== 1) {
        return false;
      }

      var matcher = node.matches || node.webkitMatchesSelector || node.msMatchesSelector;

      if (!matcher) {
        return false;
      }

      return matcher.call(node, selector);
    }

    function closestNode(node, selector) {
      var current = node;

      while (current) {
        if (nodeMatches(current, selector)) {
          return current;
        }

        if (current === document) {
          break;
        }

        current = current.parentNode;
      }

      return null;
    }

    function decodeText(value) {
      var box = document.createElement("textarea");
      box.innerHTML = String(value || "");
      return box.value;
    }

    function tidyText(value) {
      return decodeText(value)
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeText(value) {
      return tidyText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function relativeUrl(value) {
      try {
        var parsed = new URL(value || "#", window.location.origin);
        return parsed.pathname + parsed.search + parsed.hash;
      } catch (error) {
        return value || "#";
      }
    }

    function openSearch() {
      if (!searchBox) {
        return;
      }

      if (searchToggle) {
        searchToggle.checked = true;
      }

      searchBox.classList.add("is-open");

      window.setTimeout(function () {
        if (searchInput) {
          searchInput.focus();
        }
      }, 40);
    }

    function closeSearch() {
      if (!searchBox) {
        return;
      }

      if (searchToggle) {
        searchToggle.checked = false;
      }

      searchBox.classList.remove("is-open");
    }

    function clearSearchResults() {
      if (!searchResults) {
        return;
      }

      searchResults.innerHTML = "";
    }

    function renderHeaderMessage(message) {
      if (!searchResults) {
        return;
      }

      searchResults.innerHTML = "";

      if (!message) {
        return;
      }

      var li = document.createElement("li");
      var span = document.createElement("span");

      span.textContent = message;
      li.appendChild(span);
      searchResults.appendChild(li);
    }

    function renderHeaderProducts(items) {
      if (!searchResults) {
        return;
      }

      searchResults.innerHTML = "";

      if (!items.length) {
        renderHeaderMessage("No close product matches found");
        return;
      }

      items.forEach(function (item) {
        var li = document.createElement("li");
        var link = document.createElement("a");
        var label = document.createElement("span");

        link.href = relativeUrl(item.link);
        label.textContent = item.title;

        if (item.image) {
          var image = document.createElement("img");
          image.src = item.image;
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";
          link.appendChild(image);
        }

        link.appendChild(label);
        li.appendChild(link);
        searchResults.appendChild(li);
      });
    }

    function productKey(item) {
      return normalizeText(item.title || item.name || "");
    }

    function scoreProduct(item, query) {
      var name = productKey(item);
      var q = normalizeText(query);

      if (!name) {
        return 0;
      }

      if (!q) {
        return 0;
      }

      if (name === q) {
        return 10000;
      }

      if (name.indexOf(q) === 0) {
        return 9000;
      }

      var phraseIndex = name.indexOf(q);

      if (phraseIndex !== -1) {
        return 8000 - phraseIndex;
      }

      var tokens = q.split(" ").filter(function (token) {
        return token.length > 1;
      });

      if (!tokens.length) {
        return 0;
      }

      var matched = 0;
      var score = 0;

      tokens.forEach(function (token) {
        var tokenIndex = name.indexOf(token);

        if (tokenIndex !== -1) {
          matched = matched + 1;

          if (tokenIndex === 0) {
            score = score + 500;
          } else {
            score = score + 250 - Math.min(tokenIndex, 150);
          }
        }
      });

      if (tokens.length > 1) {
        if (matched !== tokens.length) {
          return 0;
        }
      }

      if (tokens.length === 1) {
        if (matched < 1) {
          return 0;
        }
      }

      return score;
    }

    function sortAndLimitMatches(items, query, limit) {
      var scored = [];

      items.forEach(function (item) {
        var score = scoreProduct(item, query);

        if (score > 0) {
          scored.push({
            item: item,
            score: score
          });
        }
      });

      scored.sort(function (a, b) {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.item.title.localeCompare(b.item.title);
      });

      return scored.slice(0, limit || 8).map(function (entry) {
        return entry.item;
      });
    }

    function ajaxSearchProducts(query) {
      /*
       * Locked visitors use the filtered Store API fallback instead of the
       * older custom AJAX search, which does not return category information.
       */
      if (!document.body.classList.contains("ion-prior-order-eligible")) {
        return Promise.resolve([]);
      }

      var url = new URL("/wp-admin/admin-ajax.php", window.location.origin);

      url.searchParams.set("action", "woo_live_search");
      url.searchParams.set("term", query);
      url.searchParams.set("ion_search_ts", String(Date.now()));

      return fetch(url.pathname + url.search, {
        credentials: "same-origin",
        cache: "no-store"
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (items) {
          if (!Array.isArray(items)) {
            return [];
          }

          return items.map(function (item) {
            return {
              title: tidyText(item.title || item.name || ""),
              link: item.link || item.url || "#",
              image: item.image || ""
            };
          }).filter(function (item) {
            if (!item.title) {
              return false;
            }

            if (!item.link) {
              return false;
            }

            return true;
          });
        })
        .catch(function () {
          return [];
        });
    }

    function makeStoreEndpoint(page) {
      var url = new URL("/wp-json/wc/store/v1/products", window.location.origin);

      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("orderby", "title");
      url.searchParams.set("order", "asc");
      url.searchParams.set("ion_search_ts", String(Date.now()));

      if (window.IONPriorOrderAccess && window.IONPriorOrderAccess.restNonce) {
        url.searchParams.set("_wpnonce", window.IONPriorOrderAccess.restNonce);
      }

      return url.pathname + url.search;
    }

    function fetchStoreProductsPage(page) {
      return fetch(makeStoreEndpoint(page), {
        credentials: "same-origin",
        cache: "no-store"
      })
        .then(function (response) {
          if (!response.ok) {
            if (response.status === 400) {
              return [];
            }

            if (response.status === 404) {
              return [];
            }

            throw new Error("Store product endpoint failed");
          }

          var totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "0", 10);

          return response.json().then(function (items) {
            if (!Array.isArray(items)) {
              return [];
            }

            var mapped = items.map(function (item) {
              var image = "";

              if (item.images) {
                if (item.images.length) {
                  if (item.images[0].src) {
                    image = item.images[0].src;
                  }
                }
              }

              return {
                title: tidyText(item.name || ""),
                link: item.permalink || "#",
                image: image
              };
            }).filter(function (item) {
              if (!item.title) {
                return false;
              }

              if (!item.link) {
                return false;
              }

              return true;
            });

            if (totalPages) {
              if (page >= totalPages) {
                return mapped;
              }
            }

            if (page >= 25) {
              return mapped;
            }

            return fetchStoreProductsPage(page + 1).then(function (next) {
              return mapped.concat(next);
            });
          });
        });
    }

    function makeWpEndpoint(page) {
      var url = new URL("/wp-json/wp/v2/product", window.location.origin);

      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("orderby", "title");
      url.searchParams.set("order", "asc");
      url.searchParams.set("_fields", "link,title");
      url.searchParams.set("ion_search_ts", String(Date.now()));

      if (window.IONPriorOrderAccess && window.IONPriorOrderAccess.restNonce) {
        url.searchParams.set("_wpnonce", window.IONPriorOrderAccess.restNonce);
      }

      return url.pathname + url.search;
    }

    function fetchWpProductsPage(page) {
      return fetch(makeWpEndpoint(page), {
        credentials: "same-origin",
        cache: "no-store"
      })
        .then(function (response) {
          if (!response.ok) {
            if (response.status === 400) {
              return [];
            }

            if (response.status === 404) {
              return [];
            }

            throw new Error("WP product endpoint failed");
          }

          var totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "0", 10);

          return response.json().then(function (items) {
            if (!Array.isArray(items)) {
              return [];
            }

            var mapped = items.map(function (item) {
              var title = "";

              if (item.title) {
                if (item.title.rendered) {
                  title = item.title.rendered;
                }
              }

              return {
                title: tidyText(title),
                link: item.link || "#",
                image: ""
              };
            }).filter(function (item) {
              if (!item.title) {
                return false;
              }

              if (!item.link) {
                return false;
              }

              return true;
            });

            if (totalPages) {
              if (page >= totalPages) {
                return mapped;
              }
            }

            if (page >= 25) {
              return mapped;
            }

            return fetchWpProductsPage(page + 1).then(function (next) {
              return mapped.concat(next);
            });
          });
        });
    }

    function loadAllProducts() {
      if (productCache.length) {
        return Promise.resolve(productCache);
      }

      if (productLoadPromise) {
        return productLoadPromise;
      }

      productLoadPromise = fetchStoreProductsPage(1)
        .catch(function () {
          return [];
        })
        .then(function (items) {
          if (items.length) {
            return items;
          }

          return fetchWpProductsPage(1).catch(function () {
            return [];
          });
        })
        .then(function (items) {
          var seen = {};
          var cleaned = [];

          items.forEach(function (item) {
            var key = productKey(item);

            if (!key) {
              return;
            }

            if (seen[key]) {
              return;
            }

            seen[key] = true;
            cleaned.push(item);
          });

          cleaned.sort(function (a, b) {
            return a.title.localeCompare(b.title);
          });

          productCache = cleaned;
          return productCache;
        })
        .catch(function () {
          productCache = [];
          return [];
        });

      return productLoadPromise;
    }

    function runHeaderSearch() {
      if (!searchInput) {
        return;
      }

      var query = searchInput.value.trim();
      requestId = requestId + 1;

      var thisRequest = requestId;

      if (query.length < 2) {
        clearSearchResults();
        return;
      }

      renderHeaderMessage("Searching products...");

      ajaxSearchProducts(query).then(function (ajaxItems) {
        if (thisRequest !== requestId) {
          return;
        }

        var ajaxMatches = sortAndLimitMatches(ajaxItems, query, 8);

        if (ajaxMatches.length) {
          renderHeaderProducts(ajaxMatches);
          return;
        }

        loadAllProducts().then(function (catalogItems) {
          if (thisRequest !== requestId) {
            return;
          }

          renderHeaderProducts(sortAndLimitMatches(catalogItems, query, 8));
        });
      });
    }

    function openMobileMenu() {
      if (!mobilePanel) {
        return;
      }

      mobilePanel.classList.add("is-open");
      mobilePanel.setAttribute("aria-hidden", "false");
      document.body.classList.add("ion-mobile-menu-open");
    }

    function closeMobileMenu() {
      if (!mobilePanel) {
        return;
      }

      mobilePanel.classList.remove("is-open");
      mobilePanel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("ion-mobile-menu-open");
    }

    function closeDesktopDrops(exceptDrop) {
      header.querySelectorAll(".ion-header-drop.is-open").forEach(function (drop) {
        if (drop !== exceptDrop) {
          drop.classList.remove("is-open");

          var trigger = drop.querySelector(".ion-header-drop-trigger");

          if (trigger) {
            trigger.setAttribute("aria-expanded", "false");
          }
        }
      });
    }

    function openDrop(drop) {
      if (!drop) {
        return;
      }

      closeDesktopDrops(drop);
      drop.classList.add("is-open");

      var trigger = drop.querySelector(".ion-header-drop-trigger");

      if (trigger) {
        trigger.setAttribute("aria-expanded", "true");
      }
    }

    function closeDrop(drop) {
      if (!drop) {
        return;
      }

      drop.classList.remove("is-open");

      var trigger = drop.querySelector(".ion-header-drop-trigger");

      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    }

    header.querySelectorAll(".ion-header-drop").forEach(function (drop) {
      var closeTimer = null;

      drop.addEventListener("mouseenter", function () {
        window.clearTimeout(closeTimer);
        openDrop(drop);
      });

      drop.addEventListener("mouseleave", function () {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
          closeDrop(drop);
        }, 220);
      });

      drop.addEventListener("focusin", function () {
        window.clearTimeout(closeTimer);
        openDrop(drop);
      });

      drop.addEventListener("focusout", function () {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
          closeDrop(drop);
        }, 220);
      });
    });

    document.addEventListener("click", function (event) {
      var searchButton = closestNode(event.target, ".ion-header-search-button");

      if (searchButton) {
        if (header.contains(searchButton)) {
          window.setTimeout(function () {
            openSearch();
            runHeaderSearch();
          }, 20);
          return;
        }
      }

      var dropTrigger = closestNode(event.target, ".ion-header-drop-trigger");

      if (dropTrigger) {
        if (header.contains(dropTrigger)) {
          event.preventDefault();
          event.stopPropagation();

          var drop = closestNode(dropTrigger, ".ion-header-drop");

          if (drop) {
            if (drop.classList.contains("is-open")) {
              closeDrop(drop);
            } else {
              openDrop(drop);
            }
          }

          return;
        }
      }

      if (searchWrap) {
        if (searchWrap.contains(event.target)) {
          return;
        }
      }

      closeSearch();

      if (!header.contains(event.target)) {
        closeDesktopDrops(null);
      }
    });

    if (searchToggle) {
      searchToggle.addEventListener("change", function () {
        if (searchToggle.checked) {
          openSearch();
          runHeaderSearch();
        } else {
          closeSearch();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        window.clearTimeout(activeSearchTimer);
        activeSearchTimer = window.setTimeout(runHeaderSearch, 180);
      });

      searchInput.addEventListener("keyup", function () {
        window.clearTimeout(activeSearchTimer);
        activeSearchTimer = window.setTimeout(runHeaderSearch, 180);
      });

      searchInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") {
          return;
        }

        var query = searchInput.value.trim();

        if (query.length < 2) {
          return;
        }

        event.preventDefault();

        ajaxSearchProducts(query).then(function (ajaxItems) {
          var best = sortAndLimitMatches(ajaxItems, query, 1)[0];

          if (best) {
            if (best.link) {
              window.location.href = relativeUrl(best.link);
              return;
            }
          }

          loadAllProducts().then(function (catalogItems) {
            var fallbackBest = sortAndLimitMatches(catalogItems, query, 1)[0];

            if (fallbackBest) {
              if (fallbackBest.link) {
                window.location.href = relativeUrl(fallbackBest.link);
              }
            }
          });
        });
      });
    }

    if (mobileButton) {
      mobileButton.addEventListener("click", openMobileMenu);
    }

    if (mobileClose) {
      mobileClose.addEventListener("click", closeMobileMenu);
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener("click", closeMobileMenu);
    }

    if (mobileShopToggle) {
      if (mobileShopList) {
        mobileShopToggle.addEventListener("click", function () {
          mobileShopList.classList.toggle("is-open");
        });
      }
    }

    document.querySelectorAll(".ion-mobile-menu-panel a").forEach(function (link) {
      link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDesktopDrops(null);
        closeSearch();
        closeMobileMenu();
      }
    });

    function shouldHideFloatProducts() {
      if (!productRoot) {
        return true;
      }

      var path = window.location.pathname.toLowerCase();

      var excludedPaths = [
        "/cart",
        "/checkout",
        "/my-account",
        "/account",
        "/order-pay",
        "/order-received",
        "/lost-password",
        "/customer-logout",
        "/view-order",
        "/edit-account",
        "/edit-address",
        "/payment-methods",
        "/add-payment-method",
        "/affiliate-dashboard"
      ];

      for (var index = 0; index < excludedPaths.length; index = index + 1) {
        if (path.indexOf(excludedPaths[index]) !== -1) {
          return true;
        }
      }

      var excludedClasses = [
        "woocommerce-cart",
        "woocommerce-checkout",
        "woocommerce-account"
      ];

      for (var classIndex = 0; classIndex < excludedClasses.length; classIndex = classIndex + 1) {
        if (document.body.classList.contains(excludedClasses[classIndex])) {
          return true;
        }
      }

      return false;
    }

    function renderFloatProducts(items) {
      var list = document.getElementById("ion-float-products-list");

      if (!list) {
        return;
      }

      list.innerHTML = "";

      if (!items.length) {
        var empty = document.createElement("div");
        empty.className = "ion-float-message";
        empty.textContent = "No matching products found.";
        list.appendChild(empty);
        return;
      }

      items.forEach(function (item) {
        var link = document.createElement("a");
        link.className = "ion-float-item";
        link.href = relativeUrl(item.link);
        link.textContent = item.title;
        list.appendChild(link);
      });
    }

    function runFloatSearch() {
      var input = document.getElementById("ion-float-products-search");

      if (!input) {
        return;
      }

      var query = input.value.trim();

      if (!query) {
        renderFloatProducts(productCache);
        return;
      }

      renderFloatProducts(sortAndLimitMatches(productCache, query, 40));
    }

    if (productRoot) {
      if (shouldHideFloatProducts()) {
        productRoot.remove();
      } else {
        productRoot.classList.add("is-ready");

        loadAllProducts().then(function () {
          renderFloatProducts(productCache);
        });

        var floatInput = document.getElementById("ion-float-products-search");

        if (floatInput) {
          floatInput.addEventListener("input", runFloatSearch);

          floatInput.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") {
              return;
            }

            var query = floatInput.value.trim();

            if (!query) {
              return;
            }

            event.preventDefault();

            loadAllProducts().then(function () {
              var best = sortAndLimitMatches(productCache, query, 1)[0];

              if (best) {
                if (best.link) {
                  window.location.href = relativeUrl(best.link);
                }
              }
            });
          });
        }
      }
    }

    function stripCartHtml(value) {
      var box = document.createElement("div");
      box.innerHTML = String(value || "");
      return (box.textContent || box.innerText || "").replace(/\s+/g, " ").trim();
    }

    function setCartText(total, count) {
      var cartLink = document.querySelector("#ion-site-header .ion-header-cart");
      var totalNode = document.querySelector("#ion-site-header .ion-header-cart-total");
      var countNode = document.querySelector("#ion-site-header .ion-header-cart-count");
      var accessibleTotal = "";
      var accessibleCount = "0";

      if (totalNode) {
        if (total) {
          totalNode.textContent = stripCartHtml(total);
        }
      }

      if (countNode) {
        if (count !== null) {
          if (count !== undefined) {
            if (count !== "") {
              countNode.textContent = String(count);
            }
          }
        }
      }

      if (cartLink) {
        if (total) {
          accessibleTotal = stripCartHtml(total);
        }

        if (count !== null) {
          if (count !== undefined) {
            if (count !== "") {
              accessibleCount = String(count);
            }
          }
        }

        cartLink.setAttribute(
          "aria-label",
          "Cart" +
            (accessibleTotal ? " " + accessibleTotal : "") +
            " " +
            accessibleCount +
            (accessibleCount === "1" ? " item" : " items")
        );
      }
    }

    function normalizeCartText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function extractLastCurrencyAmount(value) {
      var text = normalizeCartText(value);
      var matches = text.match(/(?:US\$|CAD\$|AUD\$|\$|€|£)\s*[0-9][0-9,]*(?:\.\d{2})?/g);

      if (matches) {
        if (matches.length) {
          return matches[matches.length - 1].trim();
        }
      }

      return "";
    }

    function getSideCartCheckoutTotal() {
      var checkoutButton = document.querySelector(
        ".xoo-wsc-ft-btn-checkout, " +
        ".xoo-wsc-ft-buttons-cont a[href*='checkout'], " +
        ".xoo-wsc-footer a[href*='checkout']"
      );
      var amountNode;
      var amountText;

      if (!checkoutButton) {
        return "";
      }

      amountNode = checkoutButton.querySelector(".amount");

      if (amountNode) {
        amountText = normalizeCartText(amountNode.textContent);

        if (amountText) {
          return amountText;
        }
      }

      return extractLastCurrencyAmount(checkoutButton.textContent);
    }

    function getSideCartExactTotal() {
      var rows = document.querySelectorAll(
        ".xoo-wsc-ft-totals .xoo-wsc-ft-amt, " +
        ".xoo-wsc-footer .xoo-wsc-ft-amt, " +
        ".xoo-wsc-ft-totals tr, " +
        ".xoo-wsc-ft-totals li"
      );
      var index;
      var row;
      var rowText;
      var amountNode;
      var amountText;

      for (index = 0; index < rows.length; index = index + 1) {
        row = rows[index];
        rowText = normalizeCartText(row.textContent);

        if (!/^total\b/i.test(rowText)) {
          continue;
        }

        if (/^subtotal\b/i.test(rowText)) {
          continue;
        }

        if (/savings?/i.test(rowText)) {
          continue;
        }

        amountNode = row.querySelector(".amount");

        if (amountNode) {
          amountText = normalizeCartText(amountNode.textContent);

          if (amountText) {
            return amountText;
          }
        }

        amountText = extractLastCurrencyAmount(rowText);

        if (amountText) {
          return amountText;
        }
      }

      return "";
    }

    function getSideCartCount() {
      var countSource = document.querySelector(
        ".xoo-wsc-items-count, .xoo-wsch-items-count, .xoo-wsc-sc-count, .hfe-cart-count, .xoo-wscb-count"
      );
      var countText;
      var countMatch;

      if (!countSource) {
        return "";
      }

      countText = normalizeCartText(countSource.textContent);
      countMatch = countText.match(/\d+/);

      if (countMatch) {
        return countMatch[0];
      }

      return "";
    }

    function syncCartFromSideCart() {
      var total = getSideCartCheckoutTotal();
      var count = getSideCartCount();

      if (!total) {
        total = getSideCartExactTotal();
      }

      if (total) {
        setCartText(total, count);
        return true;
      }

      return false;
    }

    function getCartItemCount(cart) {
      var total = 0;
      var index;
      var quantity;

      if (!cart) {
        return 0;
      }

      if (typeof cart.items_count === "number") {
        return cart.items_count;
      }

      if (!Array.isArray(cart.items)) {
        return 0;
      }

      for (index = 0; index < cart.items.length; index = index + 1) {
        quantity = parseInt(cart.items[index].quantity, 10);

        if (!isNaN(quantity)) {
          total = total + quantity;
        }
      }

      return total;
    }

    function formatStoreApiTotal(totals) {
      var raw;
      var minorUnit;
      var currencyCode;
      var amount;
      var prefix;
      var suffix;

      if (!totals) {
        return "";
      }

      if (totals.total_price === null) {
        return "";
      }

      if (totals.total_price === undefined) {
        return "";
      }

      raw = String(totals.total_price).replace(/[^0-9-]/g, "");
      minorUnit = parseInt(totals.currency_minor_unit, 10);
      currencyCode = totals.currency_code || "USD";

      if (!raw) {
        return "";
      }

      if (isNaN(Number(raw))) {
        return "";
      }

      if (isNaN(minorUnit)) {
        minorUnit = 2;
      }

      amount = Number(raw) / Math.pow(10, minorUnit);

      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currencyCode
        }).format(amount);
      } catch (error) {
        prefix = totals.currency_prefix || totals.currency_symbol || "$";
        suffix = totals.currency_suffix || "";
        return prefix + amount.toFixed(minorUnit) + suffix;
      }
    }

    var cartSyncTimer = null;
    var cartRequestSequence = 0;

    function syncCartFromWooCommerce() {
      var requestSequence = cartRequestSequence + 1;
      var endpoint = new URL("/wp-json/wc/store/v1/cart", window.location.origin);

      cartRequestSequence = requestSequence;

      return fetch(endpoint.pathname, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Cart request failed");
          }

          return response.json();
        })
        .then(function (cart) {
          var total = "";
          var count = 0;

          if (requestSequence !== cartRequestSequence) {
            return;
          }

          if (cart) {
            if (cart.totals) {
              total = formatStoreApiTotal(cart.totals);
            }

            count = getCartItemCount(cart);
          }

          if (total) {
            setCartText(total, count);
            return;
          }

          syncCartFromSideCart();
        })
        .catch(function () {
          syncCartFromSideCart();
        });
    }

    function queueCartSync(delay) {
      window.clearTimeout(cartSyncTimer);
      cartSyncTimer = window.setTimeout(function () {
        syncCartFromWooCommerce();
      }, delay || 0);
    }

    syncCartFromSideCart();
    queueCartSync(0);
    window.setTimeout(function () { queueCartSync(0); }, 500);
    window.setTimeout(function () { queueCartSync(0); }, 1400);

    if (window.jQuery) {
      jQuery(document.body).on(
        "added_to_cart removed_from_cart wc_fragments_refreshed wc_fragments_loaded updated_wc_div updated_cart_totals xoo_wsc_cart_updated xoo_wsc_cart_loaded",
        function () {
          window.setTimeout(syncCartFromSideCart, 80);
          queueCartSync(180);
          window.setTimeout(function () { queueCartSync(0); }, 700);
        }
      );
    }

    document.addEventListener("click", function (event) {
      var target = event.target;

      if (!target) {
        return;
      }

      if (!target.closest) {
        return;
      }

      if (
        target.closest(".xoo-wsc-chng") ||
        target.closest(".xoo-wsc-smr-del") ||
        target.closest(".xoo-wsc-remove") ||
        target.closest(".xoo-wsc-coupon-submit") ||
        target.closest(".xoo-wsc-ft-btn")
      ) {
        window.setTimeout(syncCartFromSideCart, 550);
        queueCartSync(750);
        window.setTimeout(function () { queueCartSync(0); }, 1500);
      }
    }, true);

    document.addEventListener("change", function (event) {
      var target = event.target;

      if (!target) {
        return;
      }

      if (!target.matches) {
        return;
      }

      if (target.matches(".xoo-wsc-qty, .xoo-wsc-qty-box input, input[name='quantity']")) {
        window.setTimeout(syncCartFromSideCart, 550);
        queueCartSync(750);
        window.setTimeout(function () { queueCartSync(0); }, 1500);
      }
    }, true);

    var sideCartRoot = document.querySelector(".xoo-wsc-markup");

    if (sideCartRoot) {
      if (window.MutationObserver) {
        var sideCartObserver = new MutationObserver(function () {
          window.clearTimeout(cartSyncTimer);
          cartSyncTimer = window.setTimeout(function () {
            if (!syncCartFromSideCart()) {
              syncCartFromWooCommerce();
            }
          }, 120);
        });

        sideCartObserver.observe(sideCartRoot, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }

  });
})();

