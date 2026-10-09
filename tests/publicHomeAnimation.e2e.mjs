// Read-only animation acceptance: all events are illustrative and no orders are changed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(origin);
  const feed = page.getByRole('region', { name: 'Sample order activity' });
  await feed.getByText('Order received from email').waitFor();
  for (const title of ['Order details prepared', 'Eligible driver assigned', 'Pickup confirmed', 'Delivery proof captured', 'Order completed']) {
    await page.clock.fastForward(2600);
    await page.clock.runFor(50);
    await feed.getByText(title, { exact: true }).waitFor();
    assert.ok(await feed.getByRole('listitem').count() <= 3);
  }
  await page.getByRole('button', { name: 'Pause preview animation' }).click();
  const completed = await feed.innerText();
  const retainedCompletion = await feed.getByText('Order completed', { exact: true }).elementHandle();
  await page.clock.fastForward(10000);
  assert.equal(await feed.innerText(), completed);
  assert.ok(await page.getByText('Completed', { exact: true }).isVisible());
  await page.screenshot({ path: '/tmp/dispatra-home-animation-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Play preview animation' }).click();
  await page.clock.fastForward(5500);
  await page.clock.runFor(50);
  await feed.getByText('Order received from email').waitFor();
  assert.equal(await feed.getByRole('listitem').count(), 3, 'The loop retains previous progress instead of clearing the feed');
  assert.ok(await retainedCompletion.evaluate(el => el.isConnected), 'Completion keeps the same DOM node across the loop');
  assert.ok(await feed.locator('.preview-event-row').evaluateAll(rows => rows.every(row => getComputedStyle(row).opacity === '1')), 'Rows never fade or blink');
  assert.equal(await feed.locator('.preview-event-row').first().evaluate(el => getComputedStyle(el).transitionProperty), 'transform, background-color');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.fastForward(2600);
    await page.clock.fastForward(2600);
    await page.clock.runFor(50);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await feed.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-home-animation-mobile.png', fullPage: true, animations: 'disabled' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await feed.getByText('Order completed', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Pause preview animation' }).count(), 0);
  const reducedDurations = await feed.locator('.preview-event-row').evaluateAll(rows => rows.map(row => getComputedStyle(row).transitionDuration));
  assert.ok(reducedDurations.every(duration => duration.split(',').every(value => Number.parseFloat(value) <= 0.00001)), JSON.stringify(reducedDurations));
  const staticView = await feed.innerText();
  await page.clock.fastForward(20000);
  assert.equal(await feed.innerText(), staticView);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: sample order lifecycle, retained opaque rows through the loop, smooth transform transitions, pause/resume, reduced motion and 390px/320px layout.');
} finally { await browser.close(); }
