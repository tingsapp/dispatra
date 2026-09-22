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
  await page.goto(origin + '/orders');
  await at('/orders', 'Orders');
  for (const [path, title] of [['/drivers', 'Drivers'], ['/vehicles', 'Vehicles'], ['/shippers', 'Shippers'], ['/analytics', 'Analytics']]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await at(path, title);
    await page.reload();
    await at(path, title);
  }
  await page.goBack(); await at('/shippers', 'Shippers');
  await page.goForward(); await at('/analytics', 'Analytics');
  await page.getByTitle('Dispatcher Account', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Company', exact: true }).click();
  await at('/settings/company', 'Company');
  await page.getByLabel('Company name', { exact: true }).fill('Unsaved navigation test');
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await page.getByRole('alertdialog').waitFor();
  assert.equal(new URL(page.url()).pathname, '/settings/company');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.evaluate(() => history.back());
  await page.getByRole('alertdialog').waitFor();
  await page.waitForURL(origin + '/settings/company');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await page.getByLabel('Company name', { exact: true }).inputValue(), 'Unsaved navigation test');
  await page.evaluate(() => history.back());
  await page.getByRole('alertdialog').waitFor();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await at('/analytics', 'Analytics');
  await page.goForward(); await at('/settings/company', 'Company');
  for (const [path, title] of [['/settings/pricing', 'Pricing'], ['/profile', 'Profile'], ['/help', 'Help & Support'], ['/prototype/orders', 'Orders']]) {
    await page.goto(origin + path);
    await at(path, title);
  }
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await at('/prototype/drivers', 'Drivers');
  await page.reload(); await at('/prototype/drivers', 'Drivers');
  await page.getByRole('button', { name: 'Dispatra — Monitor', exact: true }).click();
  await page.waitForURL(origin + '/prototype');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await at('/prototype/orders', 'Orders');
  assert.deepEqual(errors, []);
  console.log('Navigation browser checks passed: page URLs, direct loads, refresh, Back/Forward, dirty-settings cancellation/confirmation and prototype prefix.');
} finally {
  await browser.close();
}
