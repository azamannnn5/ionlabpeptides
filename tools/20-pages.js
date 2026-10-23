/* part 3: page assembly */
const GLOB = CAP.glob;
const PRODUCTS = CAP.products;
const PRODUCT_TYPE = Object.fromEntries(PRODUCTS.map((p) => ['/product/' + p.slug + '/', p.type]));
const SEQ = fs.existsSync(path.join(RAW, 'seq.json')) ? readJSON(path.join(RAW, 'seq.json')) : {};
const SHEETS = fs.existsSync(path.join(RAW, 'sheets.json')) ? readJSON(path.join(RAW, 'sheets.json')) : {};

/* which sequence template to use for a page */
function seqFor(p) {
  if (SEQ[p]) return SEQ[p];
  if (p.startsWith('/product/')) return PRODUCT_TYPE[p] === 'variable' ? SEQ['/product/ion3r/'] : SEQ['/product/ar50/'];
  return null;
}

const SHEET_KEY = (h) => h.replace(/^https?:\/\/(?:www\.)?ionpeptide\.com/, '').split('?')[0];
const sheetFileFor = (h) => 'assets/css/vendor/' + safeName(SHEET_KEY(h).replace(/^\/wp-content\//, '').replace(/\//g, '__'));
const EXCLUDE_SHEETS = /metorik|yith-woocommerce-pdf-invoice|wcwl|photoswipe-DISABLED/;

const emittedSheets = new Set();
function buildSheet(h) {
  const key = SHEET_KEY(h);
  const css = SHEETS[key] || SHEETS[h];
  if (!css || /^ERR/.test(css)) return null;
  const rel = sheetFileFor(h);
  if (!emittedSheets.has(rel)) {
    emittedSheets.add(rel);
    const baseDir = path.posix.dirname(key) + '/';
    let out = rewriteCss(css, rel, baseDir);
    if (/60cd925858e488661dffad7a0ee8f821/.test(key)) out = filterFontCss(out);
    write(rel, out);
  }
  return rel;
}
/* keep only latin and latin-ext faces for the Google font bundle and only if the file exists */
function filterFontCss(css) {
  return css.replace(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g, (full, sub, face) => {
    if (sub !== 'latin' && sub !== 'latin-ext') return '';
    const m = face.match(/url\(([^)]+)\)/);
    if (m) {
      const f = path.posix.join('site', 'assets/css/vendor', m[1].replace(/['"]/g, ''));
      const abs = path.join(ROOT, path.posix.normalize(f));
      if (!fs.existsSync(abs)) return '';
    }
    return `/* ${sub} */\n${face}`;
  });
}

const commonStyles = {};
(function computeCommon() {
  const n = Object.keys(PAGES).length;
  const cnt = {};
  for (const p of Object.values(PAGES)) {
    const seen = new Set();
    for (const k of p.styles) {
      const s = CAP.styles[k];
      const ident = s.id ? s.id + ':' + s.css.length : k;
      if (!seen.has(ident)) { seen.add(ident); cnt[ident] = (cnt[ident] || 0) + 1; }
    }
  }
  commonStyles.cnt = cnt; commonStyles.n = n;
})();

function headSequence(pagePath, fromFile) {
  const page = PAGES[pagePath];
  const seq = seqFor(pagePath);
  const used = new Set();
  const tags = [];
  const styleByKey = (k) => CAP.styles[k];
  if (seq) {
    for (const it of seq) {
      if (it.t === 'l') {
        if (EXCLUDE_SHEETS.test(it.h)) continue;
        const rel = buildSheet(it.h);
        if (rel) tags.push(`<link rel="stylesheet" href="${relFrom(fromFile, rel)}"${it.m && it.m !== 'all' ? ` media="${it.m}"` : ''}>`);
      } else {
        const s = CAP.styles[it.k];
        if (!s) {
          /* style hash differs from this page (template page); match by id on target page */
          const alt = page.styles.map((k) => CAP.styles[k]).find((x) => x.id && x.id === it.id && !used.has(x));
          if (alt) { used.add(alt); tags.push(styleTag(alt, fromFile)); }
          continue;
        }
        used.add(s);
        tags.push(styleTag(s, fromFile));
      }
    }
  }
  /* any style of this page not placed yet */
  for (const k of page.styles) {
    const s = CAP.styles[k];
    if (!used.has(s) && !seq) tags.push(styleTag(s, fromFile));
  }
  return tags.join('\n');
}
function styleTag(s, fromFile) {
  return `<style${s.id ? ` id="${s.id}"` : ''}>${rewriteCss(s.css, fromFile, '/')}</style>`;
}

/* a product page's own styles come from the template page sequence; swap to the page's real styles by id */
function headStylesForPage(pagePath, fromFile) {
  const page = PAGES[pagePath];
  const seq = seqFor(pagePath);
  if (!seq) {
    return page.styles.map((k) => styleTag(CAP.styles[k], fromFile)).join('\n');
  }
  const own = page.styles.map((k) => CAP.styles[k]);
  const pool = own.slice();
  const take = (it) => {
    /* exact hash first */
    let i = pool.findIndex((s) => CAP.styles[it.k] === s);
    if (i < 0 && it.id) i = pool.findIndex((s) => s.id === it.id);
    if (i < 0) return null;
    return pool.splice(i, 1)[0];
  };
  const tags = [];
  for (const it of seq) {
    if (it.t === 'l') {
      if (EXCLUDE_SHEETS.test(it.h)) continue;
      const rel = buildSheet(it.h);
      if (rel) tags.push(`<link rel="stylesheet" href="${relFrom(fromFile, rel)}"${it.m && it.m !== 'all' ? ` media="${it.m}"` : ''}>`);
    } else {
      const s = take(it);
      if (s) tags.push(styleTag(s, fromFile));
    }
  }
  pool.forEach((s) => tags.push(styleTag(s, fromFile)));
  return tags.join('\n');
}

const SCRIPTS_BY_PAGE = Object.assign({}, SCR1.scripts, SCR2);
function pageScripts(p) {
  const key = p.startsWith('/product/') ? (PRODUCT_TYPE[p] === 'variable' ? '/product/ion3r/' : '/product/ar50/') : p;
  return SCRIPTS_BY_PAGE[key] || null;
}

function composeBody(pagePath, fromFile) {
  const page = PAGES[pagePath];
  let main = page.main;
  const hdrBlock = [GLOB.header, GLOB.mobile, GLOB.float].join('\n');
  const ftrBlock = GLOB.footer;
  const emptyHdr = /<header class="wp-block-template-part">\s*<\/header>/;
  const emptyFtr = /<footer class="wp-block-template-part">\s*<\/footer>/;
  let hasWpHdr = emptyHdr.test(main), hasWpFtr = emptyFtr.test(main);
  if (hasWpHdr) main = main.replace(emptyHdr, `<header class="wp-block-template-part">${hdrBlock}</header>`);
  if (hasWpFtr) main = main.replace(emptyFtr, `<footer class="wp-block-template-part">${ftrBlock}</footer>`);
  const parts = [];
  parts.push(GLOB.promo || '');
  parts.push(GLOB.xoo || '');
  if (!hasWpHdr) parts.push(hdrBlock);
  parts.push(main);
  if (!hasWpFtr) parts.push(ftrBlock);
  parts.push(GLOB.pswp || '');
  return rewriteHtml(parts.join('\n'), fromFile);
}

function buildPage(pagePath) {
  const fromFile = fileForPath(pagePath);
  const page = PAGES[pagePath];
  const rootRel = relFrom(fromFile, 'x').replace(/x$/, '');
  const head = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${page.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`,
    page.desc ? `<meta name="description" content="${page.desc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">` : '',
    `<link rel="icon" href="${rootRel}assets/uploads/2025/08/New-Project-58.png">`,
    headStylesForPage(pagePath, fromFile),
  ].filter(Boolean).join('\n');
  const body = composeBody(pagePath, fromFile);
  const dec = (t) => String(t || '').replace(/&#8211;/g, '\u2013').replace(/&#038;|&amp;/g, '&').replace(/&#8217;/g, '\u2019').replace(/&#036;/g, '$').replace(/<[^>]+>/g, '');
  const prod = pagePath.startsWith('/product/') ? PRODUCTS.find((x) => '/product/' + x.slug + '/' === pagePath) : null;
  const scripts = [
    `<script src="${rootRel}assets/js/vendor/jquery.min.js"></script>`,
    `<script src="${rootRel}data/runtime.js"></script>`,
    `<script src="${rootRel}assets/js/main.js"></script>`,
    `<script src="${rootRel}assets/js/ion-promo.js"></script>`,
    `<script src="${rootRel}assets/js/ion-a11y.js"></script>`,
    `<script src="${rootRel}assets/js/ion-header.js"></script>`,
  ];
  scripts.push(`<script src="${rootRel}assets/js/ion-lazy-bg.js"></script>`);
  const PAGE_JS = { '/faq/': 'page-faq.js', '/lab-results/': 'page-lab-results.js', '/account/': 'page-account.js' };
  if (PAGE_JS[pagePath]) scripts.push(`<script src="${rootRel}assets/js/${PAGE_JS[pagePath]}"></script>`);
  if (pagePath === '/shop/') scripts.push(`<script src="${rootRel}assets/js/ion-shop-layout.js"></script>`);
  if (prod) {
    const pr = prod.prices, dv = Math.pow(10, pr.currency_minor_unit);
    const base = (pr.price_range ? pr.price_range.min_amount : pr.price) / dv;
    const cfg = {
      currencySymbol: '$', currencyPosition: 'left', decimalSeparator: '.', thousandSeparator: ',', decimals: '2',
      basePrice: String(base), regularPrice: String(base),
      priceRangeText: dec(prod.price_html), priceHtml: prod.price_html.replace(/&#036;/g, '$'),
      productName: dec(prod.name), sku: prod.sku || 'N/A', productId: String(prod.id), mediaManifestUrl: '',
    };
    scripts.push(`<script>var ionProductRedesign = ${JSON.stringify(cfg)};</script>`);
    scripts.push(`<script src="${rootRel}assets/js/ion-product-page.js"></script>`);
  }
  const html = `<!DOCTYPE html>\n<html lang="en-US" class="${(page.htmlClass || '').replace(/"/g, '')}">\n<head>\n${head}\n</head>\n<body class="${page.bodyClass.replace(/"/g, '')}">\n${body}\n${scripts.join('\n')}\n</body>\n</html>\n`;
  write(fromFile, html.replace(/\/\*# sourceURL=[^*]*\*\//g, '').replace(/data-endpoint="https?:\/\/ionpeptide\.com\/wp-admin\/admin-ajax\.php"/g, 'data-endpoint=""'));
  return fromFile;
}
