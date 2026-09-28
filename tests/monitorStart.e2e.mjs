import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function monitor() {
  await page.getByLabel('Monitor map').waitFor();
  assert.equal(await page.locator('.map-intro, [data-arrival], [data-arrival-item], canvas.maplibregl-canvas').count(), 0);
  const missingKey = page.getByText('Set VITE_GOOGLE_MAPS_API_KEY in client/.env.local to show the Google map.');
  if (await missingKey.count()) {
    await missingKey.waitFor();
    return 'missing-key';
  }
  await page.locator('[data-map-provider="google"] .gm-style').waitFor();
  await page.getByLabel('Driver D14, Arles').waitFor();
  await page.getByTitle('Zoom In', { exact: true }).click();
  await page.getByTitle('Zoom Out', { exact: true }).click();
  await page.getByLabel('Driver D14, Arles').click();
  await page.getByText('D14', { exact: true }).first().waitFor();
  return 'google';
}

try {
  await page.goto(origin + '/');
  await page.getByLabel('Email').fill('dispatcher@dispatra.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(origin + '/');
  const mode = await monitor();
  await page.getByTitle('Map Layer Settings', { exact: true }).click();
  await page.getByRole('button', { name: 'Satellite', exact: true }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.waitForURL(origin + '/orders');
  await page.getByRole('button', { name: 'Dispatra — Monitor', exact: true }).click();
  await page.waitForURL(origin + '/');
  assert.equal(await monitor(), mode);
  await page.reload();
  assert.equal(await monitor(), mode);
  assert.deepEqual(errors, []);
  console.log(mode === 'google' ? 'Google Monitor map works on entry, return, and refresh.' : 'Google Maps setup state works on entry, return, and refresh; live map awaits a browser key.');
} finally {
  await browser.close();
}
