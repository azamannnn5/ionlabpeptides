// usage: node shoot.js <outdir> <width> <path> [<path>...]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const [out, width, ...paths] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: +width, height: 900 } });
  const page = await ctx.newPage();
  const fails = [];
  page.on('requestfailed', (r) => fails.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url()); });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  for (const p of paths) {
    await page.goto('http://localhost:8765' + p, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const name = (p.replace(/[^a-z0-9]+/gi, '_') || 'home') + '_' + width + '.png';
    await page.screenshot({ path: out + '/' + name, fullPage: true });
    console.log(name);
  }
  console.log('FAILS', [...new Set(fails)].slice(0, 20));
  console.log('ERRS', [...new Set(errs)].slice(0, 10));
  await browser.close();
})();
