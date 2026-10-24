'use strict';
/* ion clone generator: part 1 (helpers). Run through tools/build.sh, which joins 00-head, 10-content, 20-pages, 90-tail. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const OUT = path.join(ROOT, 'site');
const ORIGIN = 'https://ionlabpeptides.com';

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
const write = (rel, data) => {
  const p = path.join(OUT, rel);
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, data);
};

/* page path (live) -> local file */
function fileForPath(p) {
  p = p.split('#')[0].split('?')[0];
  if (p === '/' || p === '') return 'index.html';
  p = p.replace(/^\//, '').replace(/\/$/, '');
  return p + '.html';
}
function relFrom(fromFile, toFile) {
  const fromDir = path.posix.dirname(fromFile);
  let r = path.posix.relative(fromDir === '.' ? '' : fromDir, toFile);
  return r || path.posix.basename(toFile);
}

/* local names for assets */
const safeName = (s) => {
  let d = s;
  try { d = decodeURIComponent(s); } catch (e) {}
  return d.replace(/[^A-Za-z0-9._\-\/]+/g, '_');
};
function assetLocal(urlPath) {
  /* urlPath: path part starting with / (no query) */
  let p = urlPath;
  let m;
  if ((m = p.match(/^\/wp-content\/uploads\/(.+)$/))) return 'assets/uploads/' + safeName(m[1]);
  if ((m = p.match(/^\/cf-fonts\/s\/(.+)$/))) return 'assets/fonts/cf/' + safeName(m[1]);
  if ((m = p.match(/^\/wp-content\/fonts\/(.+)$/))) return 'assets/fonts/' + safeName(m[1]);
  if ((m = p.match(/^\/wp-content\/themes\/gutenify-base\/css\/font-awesome\/webfonts\/(.+)$/))) return 'assets/fonts/fa/' + safeName(m[1]);
  if ((m = p.match(/^\/wp-content\/plugins\/ion-mission-donations\/assets\/receipts\/(.+)$/))) return 'assets/uploads/receipts/' + safeName(m[1]);
  if ((m = p.match(/^\/(?:wp-content|wp-includes)\/(.+)$/))) return 'assets/vendor/' + safeName(m[1]);
  if ((m = p.match(/^\/fonts\/(.+)$/))) return 'assets/vendor/fonts/' + safeName(m[1]);
  return null;
}
