
    (function () {
      function normalizeIonCoaValue(value) {
        var textarea = document.createElement("textarea");
        textarea.innerHTML = value || "";
        return textarea.value.toString().toLowerCase().replace(/\s+/g, " ").trim();
      }

      function getIonCoaParts() {
        var page = document.getElementById("ion-lab-results-page");

        if (!page) {
          return null;
        }

        var search = page.querySelector("#dp-search");
        var product = page.querySelector("#dp-product-filter");
        var results = page.querySelector("#dp-results");
        var cards = Array.prototype.slice.call(page.querySelectorAll(".dp-coa-card"));

        if (!search || !product || !results || !cards.length) {
          return null;
        }

        return {
          page: page,
          search: search,
          product: product,
          results: results,
          cards: cards
        };
      }

      function prepareIonCoaCards(parts) {
        parts.cards.forEach(function (card) {
          if (card.getAttribute("data-ion-prepared") === "1") {
            return;
          }

          var titleNode = card.querySelector("h3") || card.querySelector(".dp-coa-title");
          var titleText = titleNode ? titleNode.textContent : "";
          var productData = card.getAttribute("data-product") || "";
          var batchText = Array.prototype.slice.call(card.querySelectorAll(".dp-coa-lotbtn")).map(function (button) {
            return [
              button.getAttribute("data-batch") || "",
              button.textContent || ""
            ].join(" ");
          }).join(" ");

          card.setAttribute("data-ion-product-normalized", normalizeIonCoaValue(productData || titleText));
          card.setAttribute("data-ion-search-normalized", normalizeIonCoaValue([productData, titleText, batchText, card.textContent].join(" ")));
          card.setAttribute("data-ion-prepared", "1");
        });
      }

      function getSelectedIonProductText(productSelect) {
        if (!productSelect || !productSelect.value) {
          return "";
        }

        var selectedOption = productSelect.options[productSelect.selectedIndex];
        var selectedText = selectedOption ? selectedOption.textContent : productSelect.value;

        return normalizeIonCoaValue(selectedText || productSelect.value);
      }

      function ensureIonCoaEmptyMessage(parts) {
        var emptyMessage = parts.page.querySelector(".ion-coa-empty-message");

        if (!emptyMessage) {
          emptyMessage = document.createElement("div");
          emptyMessage.className = "ion-coa-empty-message";
          emptyMessage.textContent = "No matching lab results found. Try a different product or batch number.";
          parts.results.parentNode.insertBefore(emptyMessage, parts.results.nextSibling);
        }

        return emptyMessage;
      }

      function filterIonCoas(shouldScroll) {
        var parts = getIonCoaParts();

        if (!parts) {
          return false;
        }

        prepareIonCoaCards(parts);

        var emptyMessage = ensureIonCoaEmptyMessage(parts);
        var selectedProduct = getSelectedIonProductText(parts.product);
        var selectedProductValue = normalizeIonCoaValue(parts.product.value);
        var searchValue = normalizeIonCoaValue(parts.search.value);
        var visibleCount = 0;
        var firstVisible = null;

        parts.cards.forEach(function (card) {
          var cardProduct = card.getAttribute("data-ion-product-normalized") || "";
          var cardSearch = card.getAttribute("data-ion-search-normalized") || "";

          var productMatches = !selectedProduct || cardProduct === selectedProduct || cardProduct === selectedProductValue || cardSearch.indexOf(selectedProduct) !== -1 || cardSearch.indexOf(selectedProductValue) !== -1;
          var searchMatches = !searchValue || cardSearch.indexOf(searchValue) !== -1;
          var shouldShow = productMatches && searchMatches;

          if (shouldShow) {
            card.style.removeProperty("display");
            visibleCount++;

            if (!firstVisible) {
              firstVisible = card;
            }
          } else {
            card.style.setProperty("display", "none", "important");
          }
        });

        emptyMessage.classList.toggle("is-visible", visibleCount === 0);

        if (shouldScroll && firstVisible) {
          window.setTimeout(function () {
            firstVisible.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          }, 80);
        }

        return true;
      }

      function bindIonCoaFilters() {
        var parts = getIonCoaParts();

        if (!parts) {
          return false;
        }

        if (parts.page.getAttribute("data-ion-coa-filter-bound") === "1") {
          filterIonCoas(false);
          return true;
        }

        parts.page.setAttribute("data-ion-coa-filter-bound", "1");
        prepareIonCoaCards(parts);
        ensureIonCoaEmptyMessage(parts);

        parts.product.addEventListener("change", function () {
          filterIonCoas(true);
        });

        parts.product.addEventListener("input", function () {
          filterIonCoas(true);
        });

        parts.search.addEventListener("input", function () {
          filterIonCoas(false);
        });

        parts.search.addEventListener("keyup", function () {
          filterIonCoas(false);
        });

        parts.search.addEventListener("change", function () {
          filterIonCoas(false);
        });

        document.addEventListener("change", function (event) {
          if (event.target && event.target.id === "dp-product-filter") {
            filterIonCoas(true);
          }
        }, true);

        document.addEventListener("input", function (event) {
          if (event.target && event.target.id === "dp-search") {
            filterIonCoas(false);
          }
        }, true);

        filterIonCoas(false);

        return true;
      }

      function bootIonCoaFilters() {
        if (bindIonCoaFilters()) {
          return;
        }

        var attempts = 0;
        var timer = window.setInterval(function () {
          attempts++;

          if (bindIonCoaFilters() || attempts >= 80) {
            window.clearInterval(timer);
          }
        }, 250);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootIonCoaFilters);
      } else {
        bootIonCoaFilters();
      }

      window.addEventListener("load", bootIonCoaFilters);
    })();
  
