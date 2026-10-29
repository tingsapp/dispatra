import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
 await page.route('**/api/**', route => route.fulfill({ status: 401, json: { detail: 'Sign in' } }));
 await page.goto(origin);
 await page.getByRole('button', { name: 'Route optimizer', exact: true }).click();
 const selected = page.locator('.process-route-selected');
 await selected.waitFor();
 const animation = await selected.evaluate(el => ({ name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration }));
 assert.equal(animation.name, 'process-route-draw');
 assert.ok(parseFloat(animation.duration) > 0);
 assert.equal(await page.locator('.process-route-option').count(), 2);
 await page.getByRole('button', { name: 'Driver', exact: true }).click();
 const signature = page.locator('.process-signature-canvas path');
 await signature.waitFor();
 assert.equal(await signature.evaluate(el => getComputedStyle(el).animationName), 'process-route-draw');
 await page.getByText('Signature collected', { exact: true }).waitFor();
 await page.emulateMedia({ reducedMotion: 'reduce' });
 assert.equal(await signature.evaluate(el => getComputedStyle(el).animationName), 'none');
 assert.equal(await signature.evaluate(el => getComputedStyle(el).strokeDashoffset), '0px');
 await page.getByRole('button', { name: 'Route optimizer', exact: true }).click();
 assert.equal(await selected.evaluate(el => getComputedStyle(el).animationName), 'none');
 for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 844 });
  for (const label of ['Route optimizer', 'Driver']) {
   await page.getByRole('button', { name: label, exact: true }).click();
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
 }
 console.log('PASS: selected-route and signature animations, complete reduced-motion states and phone fit.');
} finally { await browser.close(); }
