// Subscription plan saves and trial overview against a disposable local PostgreSQL API.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
assert.equal(process.env.E2E_DISPOSABLE, 'true', 'Use a disposable API database.');
assert.ok(process.env.E2E_OWNER_PASSWORD, 'Provide the disposable owner password.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/admin/billing', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Login ID', { exact: true }).fill(process.env.E2E_OWNER_LOGIN || 'browser-owner');
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Subscription & Billing', exact: true }).waitFor();
  await page.getByLabel('Monthly price').fill('49.95');
  await page.getByLabel('Currency').fill('USD');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await page.getByText('Subscription plan saved.', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByLabel('Monthly price').inputValue(), '49.95');
  assert.equal(await page.getByLabel('Currency').inputValue(), 'USD');
  const slug = 'billing-trial-' + Date.now().toString(36);
  const signup = await browser.newContext();
  const registered = await signup.request.post(origin + '/api/v1/auth/signup', {
    headers: { Origin: origin, 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
    data: { slug, name: slug, full_name: 'Billing Trial', email: slug + '@example.com', password: 'Trial-password-123!' },
  });
  assert.equal(registered.status(), 201, await registered.text());
  const org = (await registered.json()).organization;
  await signup.close();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: slug, exact: true }) });
  await row.getByRole('cell', { name: 'Free trial', exact: true }).waitFor();
  assert.ok(await row.getByText('Active', { exact: true }).isVisible());
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/dispatra-subscription-billing-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await row.getByRole('link', { name: 'Manage ' + slug }).click();
  await page.waitForURL(origin + '/admin/companies/' + org.id);
  await page.getByRole('region', { name: 'Company details' }).waitFor();
  await page.getByRole('link', { name: 'Subscription & Billing', exact: true }).click();
  await page.waitForURL(origin + '/admin/billing');
  // Clear the fixture price: the persistent demo plan must stay unset until the user chooses.
  await page.getByLabel('Monthly price').fill('');
  await page.getByLabel('Currency').fill('CAD');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await page.getByText('Subscription plan saved.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: owner billing deep link, exact monthly price save/reload, real signup trial overview, company navigation and 1440/390/320px layouts.');
} finally { await browser.close(); }
