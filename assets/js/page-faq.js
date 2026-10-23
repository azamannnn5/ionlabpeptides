
    (function () {
      const page = document.getElementById("ion-faq-page");
      if (!page) return;

      const searchInput = page.querySelector("[data-ion-faq-search]");
      const filterButtons = Array.from(page.querySelectorAll("[data-ion-faq-filter]"));
      const categories = Array.from(page.querySelectorAll("[data-ion-faq-category]"));
      const items = Array.from(page.querySelectorAll("[data-ion-faq-item]"));
      const emptyState = page.querySelector("[data-ion-faq-empty]");

      let activeFilter = "all";

      function normalize(text) {
        return String(text || "").toLowerCase().trim();
      }

      function applyFaqFilters() {
        const query = normalize(searchInput ? searchInput.value : "");
        let visibleCount = 0;

        items.forEach(function (item) {
          const category = item.getAttribute("data-category") || "";
          const text = normalize(item.textContent);
          const matchesFilter = activeFilter === "all" || category === activeFilter;
          const matchesSearch = !query || text.includes(query);
          const shouldShow = matchesFilter && matchesSearch;

          item.classList.toggle("is-hidden", !shouldShow);

          if (shouldShow) {
            visibleCount += 1;

            if (query) {
              item.open = true;
            }
          }
        });

        categories.forEach(function (category) {
          const visibleItems = category.querySelectorAll(".ion-faq-item:not(.is-hidden)");
          category.classList.toggle("is-hidden", visibleItems.length === 0);
        });

        if (emptyState) {
          emptyState.classList.toggle("is-visible", visibleCount === 0);
        }
      }

      if (searchInput) {
        searchInput.addEventListener("input", applyFaqFilters);
      }

      filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          activeFilter = button.getAttribute("data-ion-faq-filter") || "all";

          filterButtons.forEach(function (btn) {
            btn.classList.remove("is-active");
          });

          button.classList.add("is-active");
          applyFaqFilters();
        });
      });
    })();
  
