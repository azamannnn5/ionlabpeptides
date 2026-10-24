/* part 5: site scripts copied from the live inline scripts and runtime data built from the built pages */
mkdirp(path.join(OUT, 'assets/js/vendor'));
fs.copyFileSync(path.join(ROOT, 'tools/vendor/node_modules/jquery/dist/jquery.min.js'), path.join(OUT, 'assets/js/vendor/jquery.min.js'));
const INL = SCR1.scripts['/product/ion3r/'].inline;
const inlineById = (id) => (INL.find((t) => t.id === id) || {}).js;
const hdrJs = INL.find((t) => t.js.includes('BRW mobile-only Shop dropdown guard'));
write('assets/js/ion-header.js', hdrJs.js + '\n');
write('assets/js/ion-promo.js', inlineById('ion-promo-control-front-js-after') + '\n');
write('assets/js/ion-a11y.js', inlineById('ionpg-accessibility-runtime') + '\n');
fs.copyFileSync(path.join(RAW, 'ion-product-page-redesign.js'), path.join(OUT, 'assets/js/ion-product-page.js'));

const htmlDec = (t) => String(t).replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const plain = (t) => htmlDec(String(t || '').replace(/<[^>]+>/g, '')).replace(/&#8211;/g, '–').replace(/&#038;/g, '&').replace(/&#8217;/g, '’').replace(/&#036;/g, '$');
const RT = { products: {}, cards: [] };
for (const p of PRODUCTS) {
  const f = fileForPath('/product/' + p.slug + '/');
  const h = fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8') : '';
  const dv = Math.pow(10, p.prices.currency_minor_unit);
  const o = { id: p.id, slug: p.slug, name: plain(p.name), type: p.type, url: f, price: p.prices.price / dv, inStock: p.is_in_stock, vars: [], tiers: [] };
  const m = h.match(/data-product_variations="([^"]*)"/);
  if (m) {
    try {
      const arr = JSON.parse(htmlDec(m[1]));
      o.vars = arr.map((v) => ({ id: v.variation_id, attr: v.attributes, price: v.display_price, max: v.max_qty, min: v.min_qty, inStock: v.is_in_stock, image: v.image && v.image.src ? v.image.src : '' }));
    } catch (e) { console.log('var parse fail', p.slug); }
  }
  /* bulk tier table */
  const rows = [...h.matchAll(/<tr class="wdr_bulk_table_tr bulk_table_row">([\s\S]*?)<\/tr>/g)];
  for (const r of rows) {
    const rng = (r[1].match(/wdr_bulk_range[^>]*>\s*([^<]*)</) || [])[1];
    const pct = (r[1].match(/wdr_table_discounted_value[^>]*>\s*([\d.]+)%/) || [])[1];
    if (!rng) continue;
    const mm = rng.trim().match(/^(\d+)\s*(?:-\s*(\d+)|\+)/);
    if (mm) o.tiers.push({ min: +mm[1], max: mm[2] ? +mm[2] : 999999, pct: pct ? +pct : 0 });
  }
  const im = h.match(/<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/) || h.match(/<meta property="og:image" content="([^"]+)"/);
  o.image = im ? im[1].replace(/^(\.\.\/)+/, '') : '';
  RT.products[p.id] = o;
}
/* shop cards: page 1 from the captured shop page, pages 2 to 4 from the captured grids */
const cardsRaw = [];
const grabCards = (html) => { for (const m of html.matchAll(/<li class="ion-shop-card[\s\S]*?<\/li>/g)) cardsRaw.push(m[0]); };
grabCards(PAGES['/shop/'].main);
['2', '3', '4'].forEach((k) => grabCards(SHOPX.grids[k]));
for (const c of cardsRaw) {
  const id = +(c.match(/data-ion-shop-product-id="(\d+)"/) || [])[1];
  const cls = (c.match(/^<li class="([^"]*)"/) || [])[1] || '';
  const cats = [...cls.matchAll(/product_cat-([\w-]+)/g)].map((x) => x[1]);
  const title = plain((c.match(/<h2><a[^>]*>([\s\S]*?)<\/a><\/h2>/) || [])[1]);
  const prices = [...c.matchAll(/woocommerce-Price-currencySymbol">\$<\/span>([\d,.]+)/g)].map((x) => parseFloat(x[1].replace(/,/g, '')));
  RT.cards.push({ id, title, cats, min: Math.min(...prices), max: Math.max(...prices), html: rewriteHtml(c, 'shop.html') });
}
write('data/runtime.js', 'window.IONDATA = ' + JSON.stringify(RT) + ';\n');
console.log('runtime products', Object.keys(RT.products).length, 'cards', RT.cards.length, 'tiers', Object.values(RT.products).filter((x) => x.tiers.length).length);

/* shop layout helper taken from the live shop script */
{
  const src = fs.readFileSync(path.join(RAW, 'ion-shop-redesign.js'), 'utf8');
  const a = src.indexOf('function isIonPhoneViewport');
  const b = src.indexOf('function observeShopGrid');
  write('assets/js/ion-shop-layout.js', '(function ($) {\n  ' + src.slice(a, b) + '\n  window.ionShopForceMobileGrid = forceMobileTwoColumnGrid;\n  $(function () { forceMobileTwoColumnGrid(); });\n})(jQuery);\n');
}

/* page scripts copied from the live inline scripts */
{
  const find = (pg, test) => { const t = (SCR2[pg] || SCR1.scripts[pg]).inline.find((x) => !x.id && test(x.js)); return t && t.js; };
  const lazy = SCR2['/account/'].inline.find((x) => /lazyloadRunObserver/.test(x.js));
  write('assets/js/ion-lazy-bg.js', lazy.js + '\n');
  write('assets/js/page-faq.js', find('/faq/', (j) => /ion-faq-page/.test(j)) + '\n');
  write('assets/js/page-lab-results.js', find('/lab-results/', (j) => /normalizeIonCoaValue/.test(j)) + '\n');
  write('assets/js/page-account.js', find('/account/', (j) => /acknowledge/.test(j) && /continue-btn/.test(j)) + '\n');
}

/* site info and README */
{
  const pages = Object.keys(PAGES).map((k) => ({ path: k, file: fileForPath(k), title: PAGES[k].title || '' }));
  write('data/site-info.json', JSON.stringify({
    source_site: 'https://ionlabpeptides.com',
    captured_on: '2026-10-14 to 2026-10-15',
    home_title: PAGES['/'].title, home_description: PAGES['/'].desc || '',
    product_count: PRODUCTS.length, page_count: pages.length, pages,
  }, null, 1));
  write('README.md', `# ionlabpeptides.com static copy

Static copy (plain HTML, CSS and JS) of https://ionlabpeptides.com made on 2026-10-14 and 2026-10-15.
Open index.html through any static web server (for example: python3 -m http.server).

Original branding, text and photos are kept as on the source site and must be replaced before a real launch.

## Folders and files
- *.html, product/*.html, peptide-information/*.html: pages. Text and structure were copied from the rendered live pages.
- assets/css: style sheets from the live site (vendor/ holds the plugin and theme sheets).
- assets/uploads, assets/fonts, assets/vendor: images, fonts and plugin files downloaded from the live site.
- assets/js/main.js: hand written script (cart in localStorage, shop filter and load more, variation buttons, local stand-in for the store product and cart endpoints).
- assets/js/ion-header.js, ion-promo.js, ion-a11y.js, ion-lazy-bg.js, page-*.js: scripts copied from the live inline scripts.
- assets/js/ion-product-page.js and the shop layout helper: scripts copied from the live site.
- assets/js/vendor/jquery.min.js: jQuery 3.7.1 from the npm registry.
- data/store-products.json: product list as returned by the live store product endpoint (59 products).
- data/catalog.json, catalog.csv, catalog.js: same products reduced to the main fields.
- data/categories.json: product categories from the live store category endpoint.
- data/captured-pages.json: title, description and visible text of each captured page.
- data/runtime.js: data used by main.js. Built from the pages in this folder (variations, quantity tiers, shop cards).
- data/site-info.json: list of pages and counts.
- tools/: generator that builds this folder from the captured data (Node).

## Merging the zip files
Unzip every ionpeptide-*.zip into the same empty folder and choose to merge folders if asked. The code zip holds pages, scripts, styles, data and tools. The image zips only add files under assets/uploads. All paths inside the zips are relative to the site root.

## Not copied or not available
See the final report from the build. Cart and checkout pages are empty shells. Forms have no backend.
`);
}
