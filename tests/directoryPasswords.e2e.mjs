// Dispatcher password changes against a disposable migrated PostgreSQL API.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN;
if (!origin || !process.env.E2E_OWNER_PASSWORD || !process.env.TEST_OWNER_DATABASE_URL?.endsWith('_test') || !process.env.DATABASE_URL?.endsWith('_test')) throw new Error('Use disposable test servers and credentials.');
const headers = { Origin: origin, 'X-Requested-With': 'Dispatra' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
async function context() { const value = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: headers }); contexts.push(value); return value; }
async function post(ctx, path, data) { return ctx.request.post(origin + path, { data, headers: { 'Idempotency-Key': crypto.randomUUID() } }); }
async function json(response, status = 200) { assert.equal(response.status(), status, await response.text()); return response.json(); }
async function login(ctx, portal, slug, email, password) { return post(ctx, '/api/v1/auth/login', { portal, organization: slug, login_id: email, password }); }
const password = 'Dispatcher-password-2026!';
const newPassword = '  New-account-password-2026!  ';
const slug = `password-${Date.now()}`;
try {
  const owner = await context();
  await json(await login(owner, 'platform', undefined, process.env.E2E_OWNER_LOGIN || 'owner', process.env.E2E_OWNER_PASSWORD));
  await json(await post(owner, '/api/v1/platform/organizations', { name: 'Password acceptance', slug, admin_login: 'desk', password }), 201);
  const desk = await context(); await json(await login(desk, 'dispatch', slug, 'desk', password));
  const base = `/api/v1/companies/${slug}`;
  const address = { text: '123 Main Street, Vancouver, BC V5Y 1V4, Canada', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', latitude: 49.26, longitude: -123.11 };
  const shipper = await json(await post(desk, base + '/shippers', { name: 'Test Shipper', kind: 'INDIVIDUAL', email: 'shipper@example.com', phone: '6045550101', warehouse: address }), 201);
  const driver = await json(await post(desk, base + '/drivers', { name: 'Test Driver', email: 'driver@example.com', phone: '6045550102', address }), 201);
  const page = await desk.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const [kind, record, portal] of [['shipper', shipper, 'customer'], ['driver', driver, 'driver']]) {
    const account = await context(); await json(await login(account, portal, slug, record.email, record.initial_password));
    if (kind === 'driver') await json(await post(account, base + '/driver/duty', {}), 201);
    await page.goto(`${origin}/${slug}/${kind === 'shipper' ? 'shippers' : 'drivers'}`);
    if (kind === 'shipper') await page.getByRole('table', { name: 'Shippers' }).getByText(record.name, { exact: true }).click();
    else await page.getByRole('button', { name: `Details for ${record.name}` }).click();
    if (kind === 'driver') await page.getByLabel('Driver name', { exact: true }).fill('Unsaved driver name');
    const form = page.getByRole('region', { name: 'Account password' });
    await form.getByLabel('New password', { exact: true }).fill(newPassword);
    await form.getByLabel('Confirm password', { exact: true }).fill('Different-password-2026!');
    await form.getByRole('button', { name: 'Change password', exact: true }).click();
    await form.getByText('New passwords do not match.', { exact: true }).waitFor();
    assert.equal((await account.request.get(origin + '/api/v1/auth/me')).status(), 200);
    await form.getByLabel('Confirm password', { exact: true }).fill(newPassword);
    await form.getByRole('button', { name: 'Show new password' }).click();
    assert.equal(await form.getByLabel('New password', { exact: true }).getAttribute('type'), 'text');
    await page.setViewportSize({ width: 390, height: 844 });
    await form.getByRole('button', { name: 'Change password', exact: true }).click();
    await form.getByText('Password changed.', { exact: true }).waitFor();
    assert.equal(await form.getByLabel('New password', { exact: true }).inputValue(), '');
    assert.equal(await form.getByLabel('Confirm password', { exact: true }).inputValue(), '');
    assert.equal((await account.request.get(origin + '/api/v1/auth/me')).status(), 401);
    assert.equal((await login(account, portal, slug, record.email, record.initial_password)).status(), 401);
    await json(await login(account, portal, slug, record.email, newPassword));
    if (kind === 'driver') {
      assert.equal((await json(await account.request.get(origin + base + '/driver/profile'))).duty, null);
      await page.getByRole('combobox', { name: 'Duty', exact: true }).filter({ hasText: 'Off duty' }).waitFor();
      assert.equal(await page.getByLabel('Driver name', { exact: true }).inputValue(), 'Unsaved driver name');
    }
    assert.ok(await form.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
    assert.ok(!storage.includes(newPassword));
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: dispatcher Shipper/Driver password forms, confirmation and eye toggle, exact password login, session revocation, driver Off Duty, cleared credentials and mobile bounds.');
} finally { for (const ctx of contexts) await ctx.close(); await browser.close(); }
