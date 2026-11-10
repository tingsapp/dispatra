import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

// Exercise the shipped CSS on real screens. No live accounts or API writes.
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:4176';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.E2E_OUTPUT || '/tmp/dispatra-typography';
await mkdir(output, { recursive: true });
const engines = { chromium, firefox, webkit };
const results = [];
for (const name of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
  const browser = await engines[name].launch({
    headless: true,
    ...(name === 'chromium' ? { channel: 'chrome' } : {}),
    // Deliberately different defaults must not change our font or rem baseline.
    ...(name === 'firefox' ? { firefoxUserPrefs: { 'font.size.variable.x-western': 24, 'font.default.x-western': 'serif' } } : {}),
  });
  try {
    for (const [width, height, dpr] of [[1440, 900, 1], [1280, 720, 1], [1440, 900, 2], [768, 1024, 2], [390, 844, 3], [320, 640, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { detail: 'Local typography check' } });
        return route.continue();
      });
      await context.addInitScript(() => localStorage.setItem('dispatra_session_v1', JSON.stringify({
        email: 'preview@example.com', name: 'Preview', signedInAt: new Date().toISOString(),
      })));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const path of ['/prototype/orders', '/prototype/settings', '/login']) {
        await page.goto(origin + path);
        await page.locator('h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(() => {
          const style = selector => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const css = getComputedStyle(el);
            return { family: css.fontFamily, size: css.fontSize, line: css.lineHeight };
          };
          const wrongFonts = [...document.querySelectorAll('button,input,select,textarea,h1,h2,th,td,[role="menuitem"]')]
            .filter(el => el.getClientRects().length && getComputedStyle(el).fontFamily.split(',')[0].replaceAll('"', '').trim() !== 'Inter')
            .map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 40), font: getComputedStyle(el).fontFamily }));
          return {
            root: style('html'), body: style('body'), nav: style('.app-nav-item'),
            title: style('.app-page-title'), field: style('input:not([type="checkbox"]):not([type="hidden"])'),
            loaded: [...document.fonts].some(font => font.family === 'Inter' && font.status === 'loaded'),
            overflow: document.documentElement.scrollWidth > innerWidth,
            wrongFonts,
          };
        });
        assert.equal(metrics.loaded, true, `${name}/${path}: bundled font loaded`);
        assert.equal(metrics.root.size, '16px');
        assert.equal(metrics.body.size, '13px');
        if (metrics.nav) assert.equal(metrics.nav.size, '13px');
        if (metrics.title) assert.equal(metrics.title.size, width < 768 ? '20px' : '24px');
        if (metrics.field) assert.equal(metrics.field.size, '13px');
        assert.deepEqual(metrics.wrongFonts, [], `${name}/${path}: all controls use Inter`);
        assert.equal(metrics.overflow, false, `${name}/${width}/${path}: page fits`);
        results.push({ browser: name, width, height, dpr, path, metrics });
        if (dpr !== 1 || width === 1440) await page.screenshot({ path: `${output}/${name}-${width}-${dpr}-${path.split('/').pop()}.png` });
      }
      // A real portalled account menu must retain the same font outside the sidebar.
      if (width === 1440 && dpr === 1) {
        await page.goto(origin + '/prototype/orders');
        await page.getByRole('button', { name: 'Dispatcher Account', exact: true }).click();
        const menu = page.getByRole('menu', { name: 'Account menu', exact: true });
        await menu.waitFor();
        const font = await menu.getByRole('menuitem').first().evaluate(el => ({ family: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize }));
        assert.equal(font.family.split(',')[0].replaceAll('"', '').trim(), 'Inter');
        assert.equal(font.size, '13px');
        await page.keyboard.press('Escape');
        // Explicit text enlargement still scales rem-based controls and content.
        await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
        assert.equal(await page.locator('.app-nav-item').first().evaluate(el => getComputedStyle(el).fontSize), '26px');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      assert.deepEqual(errors, [], `${name}/${width}: no JavaScript errors`);
      await context.close();
      console.log(`PASS ${name} ${width}x${height} DPR ${dpr}`);
    }
  } finally { await browser.close(); }
}
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
console.log(`PASS ${results.length} page/browser/viewport combinations`);
