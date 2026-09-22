import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const errors = [];
async function scenario(name, run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  try { await run(page, context); console.log(`Passed: ${name}`); }
  finally { await context.close(); }
}
const intro = page => page.getByRole('region', { name: 'Map introduction' });
const gone = page => page.locator('.map-intro').waitFor({ state: 'detached', timeout: 16000 });
const standardMap = async page => {
  await gone(page);
  await page.locator('[aria-label="Monitor map"]:not([inert])').waitFor();
  assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
  await page.getByTitle('Zoom In', { exact: true }).click();
  await page.getByTitle('Zoom Out', { exact: true }).click();
  await page.getByRole('button', { name: 'Vancouver Overview' }).click();
};

try {
  await scenario('globe flight, real map handoff, controls, markers and once-per-session navigation', async page => {
    await page.goto(origin + '/');
    await intro(page).waitFor();
    assert.ok(await page.locator('[aria-label="Monitor map"][inert]').count());
    await page.locator('.map-intro[data-phase="orbit"]').waitFor({ timeout: 8000 });
    await page.screenshot({ path: '/tmp/dispatra-earth-orbit.png' });
    await page.locator('.map-intro[data-phase="descent"]').waitFor({ timeout: 7000 });
    await standardMap(page);
    await page.getByTitle('Map Layer Settings', { exact: true }).click();
    await page.getByRole('button', { name: 'Satellite', exact: true }).click();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('#d14-marker-container').click();
    await page.getByText('D14', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await page.waitForURL(origin + '/orders');
    await page.getByRole('button', { name: 'Dispatra — Monitor', exact: true }).click();
    await page.waitForURL(origin + '/');
    assert.equal(await page.locator('.map-intro').count(), 0);
    await page.reload();
    await page.getByTitle('Zoom In', { exact: true }).waitFor();
    assert.equal(await page.locator('.map-intro').count(), 0);
    await page.screenshot({ path: '/tmp/dispatra-earth-handoff.png' });
  });

  await scenario('Skip returns keyboard focus and leaves the original map mounted', async page => {
    await page.goto(origin + '/');
    const skip = page.getByRole('button', { name: 'Skip intro' });
    await skip.waitFor();
    await skip.focus(); await page.keyboard.press('Enter');
    await gone(page);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Monitor map');
    assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
    await page.getByRole('button', { name: 'Drivers', exact: true }).click();
    await page.waitForURL(origin + '/drivers');
  });

  await scenario('camera starts and progresses while satellite requests are stalled', async page => {
    const pending = [];
    await page.route('https://server.arcgisonline.com/**', route => { pending.push(route); });
    await page.goto(origin + '/');
    await page.locator('.map-intro[data-phase="orbit"]').waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.map-intro-globe').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.locator('.map-intro[data-phase="descent"]').waitFor({ timeout: 4000 });
    assert.ok(pending.length > 0);
    await page.screenshot({ path: '/tmp/dispatra-earth-local-fallback.png' });
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await gone(page);
    for (const route of pending) await route.abort().catch(() => {});
  });

  await scenario('first visit through Locate on Map bypasses the intro', async page => {
    await page.goto(origin + '/drivers');
    await page.getByTitle('Locate on Map', { exact: true }).first().click();
    await page.waitForURL(origin + '/');
    await page.getByTitle('Zoom In', { exact: true }).waitFor();
    assert.equal(await page.locator('.map-intro').count(), 0);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('dispatra:monitor-intro:v1')), 'seen');
  });

  await scenario('reduced motion creates only the operational map', async page => {
    await page.goto(origin + '/');
    await page.getByTitle('Zoom In', { exact: true }).waitFor();
    assert.equal(await page.locator('.map-intro').count(), 0);
    assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
  }, { reducedMotion: 'reduce' });

  await scenario('mobile navigation remains available during the intro and cancels it', async page => {
    await page.goto(origin + '/');
    await intro(page).waitFor();
    const skip = await page.getByRole('button', { name: 'Skip intro' }).boundingBox();
    assert.ok(skip.x >= 0 && skip.x + skip.width <= 390 && skip.y + skip.height <= 844);
    await page.screenshot({ path: '/tmp/dispatra-earth-mobile.png' });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await page.waitForURL(origin + '/orders');
    assert.equal(await page.locator('.map-intro').count(), 0);
    assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 0);
  }, { viewport: { width: 390, height: 844 } });

  await scenario('imagery failure releases the workspace', async page => {
    await page.route('https://server.arcgisonline.com/**', route => route.abort());
    await page.goto(origin + '/');
    await page.getByTitle('Zoom In', { exact: true }).waitFor({ timeout: 12000 });
    await gone(page);
    assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
  });
  assert.deepEqual(errors, []);
  console.log('All Monitor intro browser scenarios passed.');
} finally { await browser.close(); }
