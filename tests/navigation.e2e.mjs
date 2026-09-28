import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function at(path, title) {
  await page.waitForURL(origin + path);
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}
try {
  await page.goto(origin + '/');
  await page.getByRole('heading', { name: 'Automatic dispatch. Smarter deliveries.' }).waitFor();
  await page.goto(origin + '/prototype/orders');
  await page.getByLabel('Email').fill('dispatcher@dispatra.com');
  await page.getByLabel('Password').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(origin + '/prototype');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await at('/prototype/orders', 'Orders');
  for (const [title, path] of [['Drivers', '/prototype/drivers'], ['Vehicles', '/prototype/vehicles'], ['Shippers', '/prototype/shippers'], ['Analytics', '/prototype/analytics']]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await at(path, title);
    await page.reload();
    await at(path, title);
  }
  await page.goBack();
  await at('/prototype/shippers', 'Shippers');
  await page.goForward();
  await at('/prototype/analytics', 'Analytics');
  assert.deepEqual(errors, []);
  console.log('Public site and prototype navigation browser checks passed.');
} finally {
  await browser.close();
}
