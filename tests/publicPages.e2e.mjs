// Public website acceptance uses isolated API responses and never writes real accounts.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.PUBLIC_SCREENSHOT_DIR || '/tmp/dispatra-public-pages';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const writes = [], errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (route.request().method() !== 'GET') writes.push(url.pathname);
      if (url.pathname === '/api/v1/subscription/plan') return route.fulfill({ json: { name: 'Monthly subscription', interval: 'MONTHLY', trial_days: 30, monthly_price: null, currency: 'CAD', dispatch_monthly_price: null, dispatch_currency: 'CAD' } });
      return route.fulfill({ status: 401, json: { error: { message: 'Sign in' } } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const paths = ['/', '/plans', '/about', '/how-it-works', '/help', '/contact', '/terms', '/privacy'];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    for (const path of paths) {
      await page.goto(origin + path);
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, `${path}: one main title`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} at ${width}: no overflow`);
      const header = page.getByRole('banner');
      assert.equal(await header.getByRole('link', { name: 'Login', exact: true }).count(), 0);
      const footer = page.getByRole('contentinfo');
      assert.equal(await footer.getByRole('link', { name: 'Sign in to your workspace', exact: true }).getAttribute('href'), '/login');
      for (const label of ['Google Play', 'App Store']) {
        const link = footer.getByRole('link', { name: new RegExp(label) });
        await link.locator('img').evaluate(el => el.decode());
        assert.ok(await link.locator('img').evaluate(el => el.complete && el.naturalWidth > 0));
        assert.equal(await link.getAttribute('target'), '_blank');
      }
      assert.equal(await footer.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
      await footer.getByText(`Dispatra © ${new Date().getFullYear()}`, { exact: true }).waitFor();
      assert.equal(await header.evaluate(el => el.getBoundingClientRect().height), 96);
      if (width >= 768) {
        const nav = header.getByRole('navigation', { name: 'Website navigation', exact: true });
        for (const [label, href] of [['How it works', '/how-it-works'], ['Plans', '/plans'], ['Let’s talk', '/contact']]) {
          assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('href'), href);
          if (href === path) assert.equal(await nav.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
        }
        assert.equal(await header.getByRole('button', { name: 'Open website menu' }).isVisible(), false);
      } else {
        const trigger = header.getByRole('button', { name: 'Open website menu' });
        await trigger.click();
        const nav = page.getByRole('navigation', { name: 'Mobile website navigation' });
        await nav.waitFor();
        assert.equal(await nav.getByRole('link').count(), 4);
        assert.equal(await nav.evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
        await page.keyboard.press('Escape');
        await nav.waitFor({ state: 'hidden' });
        assert.ok(await trigger.evaluate(el => document.activeElement === el), 'Escape returns focus to menu trigger');
      }
      if ([1440, 390].includes(width) && ['/plans', '/about', '/help', '/login', '/how-it-works'].includes(path)) {
        await page.screenshot({ path: `${output}/${path.slice(1)}-${width}.png`, fullPage: true });
      }
    }
  }
  console.log('All eight public pages: shared navigation, active links, menu keyboard/focus, 96px header and 1440/768/390/320px bounds passed.');
  await page.goto(origin + '/about');
  await page.getByRole('button', { name: 'Open website menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile website navigation' }).getByRole('link', { name: 'Help & FAQs' }).click();
  await page.waitForURL(origin + '/help');
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Mobile website navigation' }).count(), 0);
  await page.getByRole('button', { name: 'Open website menu' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('navigation', { name: 'Mobile website navigation' }).waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.getByRole('button', { name: 'Open website menu' }).getAttribute('aria-expanded'), 'false');
  await page.locator('summary').first().click();
  assert.ok(await page.locator('details').first().evaluate(el => el.open));
  await page.goto(origin + '/how-it-works');
  await page.getByRole('button', { name: 'Step 6: Complete', exact: true }).click();
  await page.getByRole('region', { name: 'Sample order activity' }).getByText('Order completed', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Play preview animation' }).count(), 0, 'reduced motion keeps the selected preview static');
  for (const path of ['/login', '/signup/verify', '/admin']) {
    await page.goto(origin + path);
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal(await page.getByRole('banner').getByRole('link', { name: 'Login', exact: true }).count(), 0, 'account screens have no redundant Login action');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${path.replaceAll('/', '-')}-390.png`, fullPage: true });
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  console.log('Menu navigation/resize, FAQ expansion, shared delivery demonstration and account-screen branding passed; no real writes or runtime errors.');
} finally { await browser.close(); }
