import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against a local Vite preview; all API traffic is intercepted.
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:4183';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.E2E_OUTPUT || '/tmp/dispatra-button-loading';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    let release;
    let writes = 0;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/v1/auth/login') {
        writes++;
        await new Promise(resolve => { release = resolve; });
        return route.fulfill({ status: 401, json: { detail: 'Please try again.' } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { detail: 'Local test' } });
      return route.continue();
    });
    await page.goto(origin + '/login');
    await page.getByLabel('Email', { exact: true }).fill('spinner@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Local-preview-only');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await submit.click();
    const busy = page.getByRole('button', { name: 'Signing in…', exact: true });
    await busy.locator('[data-button-spinner]').waitFor({ state: 'visible' });
    assert.equal(await busy.isDisabled(), true);
    const metrics = await busy.evaluate(button => {
      const spinner = button.querySelector('[data-button-spinner]');
      const css = getComputedStyle(spinner);
      return { animation: css.animationName, size: spinner.getBoundingClientRect().width,
        color: css.color, pseudo: getComputedStyle(button, '::before').content,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(metrics.animation, 'app-button-spin');
    assert.ok(metrics.size >= 14);
    assert.equal(metrics.pseudo, 'none');
    assert.equal(metrics.overflow, false);
    const before = await busy.locator('svg').evaluate(el => getComputedStyle(el).transform);
    await page.waitForTimeout(100);
    const after = await busy.locator('svg').evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(before, after, 'spinner visibly rotates');
    await page.keyboard.press('Enter');
    assert.equal(writes, 1, 'pending submit cannot repeat');
    await page.screenshot({ path: `${output}/login-${width}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await busy.locator('svg').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await busy.locator('svg').isVisible(), true);
    release();
    await page.getByRole('alert').waitFor();
    await submit.waitFor();
    assert.equal(await submit.isEnabled(), true);
    assert.equal(await submit.locator('[data-button-spinner]').count(), 0);
    await submit.click();
    await busy.locator('[data-button-spinner]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('button[aria-busy="true"]'));
    assert.equal(writes, 2);
    release();
    await submit.waitFor();
    await page.close();
    console.log(`PASS ${width}px: visible rotation, pending lock, reduced motion, error recovery and retry`);
  }
} finally { await browser.close(); }
