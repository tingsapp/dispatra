import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Sign in"}' });
    return url.origin === origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  const section = page.locator('#why-dispatra');
  const scene = page.getByRole('figure', { name: 'Route constellation' });
  const canvas = section.locator('canvas');
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.why-dispatra-figure')?.dataset.running === 'true');
  const pixels = () => canvas.evaluate(el => el.toDataURL());
  const first = await pixels();
  await page.waitForTimeout(150);
  assert.notEqual(await pixels(), first, 'The canvas visibly animates');
  await section.getByRole('button', { name: 'Pause route constellation animation' }).click();
  await page.waitForFunction(() => document.querySelector('.why-dispatra-figure')?.dataset.running === 'false');
  const paused = await pixels();
  await page.waitForTimeout(150);
  assert.equal(await pixels(), paused, 'Paused canvas pixels remain unchanged');
  assert.equal(await section.locator('article').count(), 4);
  await section.screenshot({ path: '../why-desktop.png' });
  await section.getByRole('button', { name: 'Play route constellation animation' }).click();
  await page.waitForTimeout(150);
  assert.notEqual(await pixels(), paused, 'Playback resumes');
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.why-dispatra-figure')?.dataset.running === 'false');
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.why-dispatra-figure')?.dataset.running === 'true');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await section.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await section.locator('article').evaluateAll(els => els.map(el => ({ x: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
    assert.ok(bounds.every(box => box.x >= 0 && box.right <= width));
    if (width === 390) await section.screenshot({ path: '../why-mobile.png' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.why-dispatra-figure')?.dataset.running === 'false');
  assert.equal(await section.getByRole('button').count(), 0);
  const still = await pixels();
  await page.waitForTimeout(150);
  assert.equal(await pixels(), still, 'Reduced motion stays static');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: visible canvas movement, pause/resume, offscreen suspension, reduced motion, four benefits, desktop and 390/320px bounds; no browser errors.');
} finally { await browser.close(); }
