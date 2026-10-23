
(function(){
  function text(node){ return node ? String(node.textContent || "").replace(/\s+/g," ").trim() : ""; }
  function repair(){
    var search = document.getElementById("ion-header-search-toggle");
    if (search) {
      search.removeAttribute("aria-hidden");
      if (!search.getAttribute("aria-label")) { search.setAttribute("aria-label","Toggle site search"); }
    }
    document.querySelectorAll("input.xoo-wsc-qty").forEach(function(input){
      if (!input.getAttribute("aria-label")) { input.setAttribute("aria-label","Quantity"); }
    });
    document.querySelectorAll("a.ion-hero-mobile-hotspot, a.ion-hero-hotspot").forEach(function(link){
      var label = text(link);
      if (label) { link.setAttribute("aria-label", label); }
    });
    var cart = document.querySelector("#ion-site-header .ion-header-cart");
    if (cart) {
      var total = text(cart.querySelector(".ion-header-cart-total"));
      var count = text(cart.querySelector(".ion-header-cart-count")) || "0";
      cart.setAttribute("aria-label","Cart" + (total ? " " + total : "") + " " + count + (count === "1" ? " item" : " items"));
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", repair, {once:true});
  } else {
    repair();
  }
})();

