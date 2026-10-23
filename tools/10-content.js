/* part 2: load captured data, rewrite links and assets */
const CAP = readJSON(path.join(RAW, 'capture.json'));
const SHOPX = readJSON(path.join(RAW, 'shopx.json'));
const SCR1 = readJSON(path.join(RAW, 'scripts.json'));
const SCR2 = readJSON(path.join(RAW, 'scripts2.json'));
const ORDER = fs.existsSync(path.join(RAW, 'order.json')) ? readJSON(path.join(RAW, 'order.json')) : null;
const PAGES = CAP.pages;
const KNOWN = new Set(Object.keys(PAGES));
/* blank shells for pages that the live site blocked from capture (reported as blanks) */
['/cart/', '/checkout/'].forEach((p) => KNOWN.add(p));
const UNMAPPED = new Map();
const MISSING_ASSETS = new Set();
const ASSET_FILES = new Set();

function walk(dir, base = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, base, acc);
    else acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}

function mapPath(p, q, h, fromFile) {
  /* p: path starting with / ; returns local relative ref or null */
  const a = assetLocal(p);
  if (a) return relFrom(fromFile, a);
  let pp = p;
  if (!pp.endsWith('/') && KNOWN.has(pp + '/')) pp += '/';
  /* live short urls that redirect to the info pages */
  const short = pp.match(/^\/([a-z-]+)\/$/);
  if (short && !KNOWN.has(pp) && KNOWN.has('/peptide-information/' + short[1] + '/')) pp = '/peptide-information/' + short[1] + '/';
  if (KNOWN.has(pp)) return relFrom(fromFile, fileForPath(pp)) + (q || '') + (h || '');
  /* sub paths of my-account etc. fall back to the page itself */
  return null;
}

const URL_RE = /(?:https?:)?\/\/(?:i0\.wp\.com\/)?(?:www\.)?ionpeptide\.com(\/(?:[^\s"'<>)\\,&]|&(?!quot;|#0*39;|#x27;|lt;|gt;))*)?/g;
function rewriteValue(val, fromFile, attr) {
  const v = val.replace(/&amp;/g, '&');
  const enc = (s) => s.replace(/&(?!(?:quot|lt|gt|amp|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
  const one = (u) => {
    /* u: absolute or root relative path+query+hash */
    const m = u.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    let p = m[1] || '/', q = m[2] || '', h = m[3] || '';
    if (p === '') p = '/';
    const isAsset = !!assetLocal(p);
    const out = mapPath(p, isAsset ? '' : q, h, fromFile);
    if (out) return out;
    if (/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(p)) { MISSING_ASSETS.add(p); return ''; }
    UNMAPPED.set(p, (UNMAPPED.get(p) || 0) + 1);
    return attr === 'href' || attr === 'action' ? '#' : null;
  };
  let changed = false;
  let outv = v.replace(URL_RE, (full, pth) => {
    const r = one((pth || '/') + '');
    if (r === null) return full;
    changed = true;
    return r;
  });
  if (!changed && v.startsWith('/') && !v.startsWith('//')) {
    const r = one(v);
    if (r !== null) { outv = r; changed = true; }
  }
  return changed ? enc(outv) : val;
}

const URL_ATTRS = /\s((?:href|src|action|srcset|poster|content|value|style|data-[\w:-]+))="([^"]*)"/g;
function rewriteHtml(html, fromFile) {
  return html.replace(URL_ATTRS, (full, name, val) => {
    if (!/ionpeptide\.com|^\//.test(val)) return full;
    if (name === 'content' && !/^https?:\/\//.test(val)) return full;
    if (name === 'value' && !/ionpeptide\.com/.test(val)) return full;
    if (/^data-(?!thumb|src|lazy|original|large|o_|ion|product_variations|endpoint)/.test(name) && !/ionpeptide\.com/.test(val)) return full;
    const nv = rewriteValue(val, fromFile, name);
    return nv === val ? full : ` ${name}="${nv}"`;
  });
}
/* css text: rewrite url() */
function rewriteCss(css, fromFile, baseDir) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (full, q, u) => {
    if (/^(data:|#)/.test(u)) return full;
    let abs = u;
    if (!/^(https?:)?\/\//.test(u) && !u.startsWith('/')) {
      abs = path.posix.normalize(path.posix.join(baseDir || '/', u));
    }
    const m = abs.replace(/^(?:https?:)?\/\/(?:www\.)?ionpeptide\.com/, '').match(/^([^?#]*)/);
    const p = m ? m[1] : abs;
    const a = assetLocal(p);
    if (a) return `url(${q}${relFrom(fromFile, a)}${q})`;
    return full;
  });
}
