/* part 4: run */
fs.rmSync(OUT, { recursive: true, force: true });
mkdirp(OUT);

/* pages */
const built = [];
for (const p of Object.keys(PAGES)) built.push(buildPage(p));
/* blank shells for pages the live site blocked from capture */
for (const p of ['/cart/', '/checkout/']) {
  if (PAGES[p]) continue;
  const base = PAGES['/contact/'];
  const fake = Object.assign({}, base, { path: p, title: '', desc: '', main: '', styles: [] });
  PAGES[p] = fake;
  built.push(buildPage(p));
}

/* assets: copy files from raw/files with local names */
let copied = 0;
for (const rel of walk(path.join(RAW, 'files'))) {
  const p = '/' + rel;
  const a = assetLocal(p);
  if (!a) { continue; }
  const dst = path.join(OUT, a);
  mkdirp(path.dirname(dst));
  fs.copyFileSync(path.join(RAW, 'files', rel), dst);
  ASSET_FILES.add(a); copied++;
}

/* data */
mkdirp(path.join(OUT, 'data'));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&#8211;/g, '–').replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&#8217;/g, '’').replace(/&#036;/g, '$');
const catalog = PRODUCTS.map((p) => ({
  id: p.id, name: stripTags(p.name), slug: p.slug, url: '/product/' + p.slug + '/', type: p.type, sku: p.sku,
  categories: p.categories.map((c) => ({ id: c.id, name: stripTags(c.name), slug: c.slug })),
  price: p.prices, price_html: p.price_html, in_stock: p.is_in_stock, stock_availability: p.stock_availability && p.stock_availability.text,
  short_description: p.short_description, description: p.description,
  attributes: p.attributes, variations: p.variations, images: p.images.map((i) => ({ id: i.id, src: i.src, alt: i.alt })),
}));
const localizeJson = (txt) => txt.replace(/https?:\/\/(?:i0\.wp\.com\/)?(?:www\.)?ionpeptide\.com(\/[^"\\?#]*)?/g, (m, pth) => {
  const pp = pth || '/';
  const a = assetLocal(pp);
  if (a) return a;
  if (KNOWN.has(pp)) return fileForPath(pp);
  return pp;
});
write('data/catalog.js', 'window.IONCATALOG = ' + localizeJson(JSON.stringify(PRODUCTS)) + ';\n');
write('data/catalog.json', localizeJson(JSON.stringify(catalog, null, 2)));
write('data/store-products.json', localizeJson(JSON.stringify(PRODUCTS)));
write('data/categories.json', JSON.stringify(CAP.cats, null, 2));
const csvEsc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
const csvRows = [['id', 'name', 'slug', 'type', 'sku', 'categories', 'price', 'regular_price', 'sale_price', 'in_stock', 'image'].join(',')];
for (const p of PRODUCTS) {
  const pr = p.prices;
  const div = Math.pow(10, pr.currency_minor_unit);
  csvRows.push([p.id, stripTags(p.name), p.slug, p.type, p.sku, p.categories.map((c) => stripTags(c.name)).join('|'), pr.price / div, pr.regular_price / div, pr.sale_price / div, p.is_in_stock, p.images[0] ? localizeJson(p.images[0].src) : ''].map(csvEsc).join(','));
}
write('data/catalog.csv', csvRows.join('\n') + '\n');
write('data/captured-pages.json', JSON.stringify(Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, { title: v.title, description: v.desc, text: v.text }])), null, 1));

/* hand written behavior script */
if (fs.existsSync(path.join(ROOT, 'tools', 'src', 'main.js'))) {
  mkdirp(path.join(OUT, 'assets/js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'src', 'main.js'), path.join(OUT, 'assets/js/main.js'));
}
console.log('pages', built.length, 'assets', copied, 'unmapped', UNMAPPED.size, 'missing assets', MISSING_ASSETS.size);
fs.writeFileSync(path.join(ROOT, 'raw', 'build-report.json'), JSON.stringify({ unmapped: [...UNMAPPED], missing: [...MISSING_ASSETS] }, null, 1));
