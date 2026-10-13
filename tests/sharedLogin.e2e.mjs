// Real browser/API acceptance. Use only a disposable API database.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const password = process.env.E2E_OWNER_PASSWORD;
if (!password) throw new Error('Set E2E_OWNER_PASSWORD for a disposable API database.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const headers = { Origin: origin, 'X-Requested-With': 'Dispatra' };
const errors = [];
const slug = `login-${Date.now().toString(36)}`;
const email = `team-${slug}@example.com`;
const phone = '604' + String(Date.now() % 10000000).padStart(7, '0');
const address = { text: '123 Main Street, Vancouver, BC V5Y 1V4, Canada', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', latitude: 49.26, longitude: -123.11 };
const result = async (response, status) => { assert.equal(response.status(), status, await response.text()); return response.json(); };
const post = (context, path, data) => context.request.post(origin + path, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data });
try {
  const owner = await browser.newContext();
  await result(await post(owner, '/api/v1/auth/login', { portal: 'platform', login_id: process.env.E2E_OWNER_LOGIN || 'browser-owner', password }), 200);
  await result(await post(owner, '/api/v1/platform/organizations', { name: 'Shared login company', slug, admin_login: email, password, phone }), 201);
  const provisioning = await browser.newContext();
  await result(await post(provisioning, '/api/v1/auth/login', { portal: 'dispatch', login_id: email, password }), 200);
  const base = `/api/v1/companies/${slug}`;
  const shipper = await result(await post(provisioning, base + '/shippers', { name: 'Shared Shipper', kind: 'INDIVIDUAL', email, phone, warehouse: address }), 201);
  const driver = await result(await post(provisioning, base + '/drivers', { name: 'Shared Driver', email, phone, address }), 201);
  // Same-role duplicate email and phone fail without creating a partial profile.
  await result(await post(provisioning, base + '/drivers', { name: 'Duplicate phone', email: `other-${slug}@example.com`, phone: '+1 ' + phone, address }), 409);
  await result(await post(owner, '/api/v1/platform/organizations', { name: 'Duplicate email', slug: `other-${slug}`, admin_login: email, password }), 409);
  for (const [role, apiRole, accountPassword, suffix] of [
    ['Dispatcher', 'DISPATCHER', password, '/'],
    ['Shipper', 'SHIPPER', shipper.initial_password, '/shipper'],
    ['Driver', 'DRIVER', driver.initial_password, '/driver'],
  ]) {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/login');
    await page.getByText(role, { exact: true }).click();
    assert.equal(await page.getByLabel('Workspace', { exact: true }).count(), 0);
    await page.getByLabel('Email', { exact: true }).fill(email.toUpperCase());
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }).waitFor();
    await page.getByLabel('Password', { exact: true }).fill(accountPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(origin + `/${slug}${suffix}`);
    const me = await result(await context.request.get(origin + '/api/v1/auth/me'), 200);
    assert.equal(me.role, apiRole);
    assert.equal(me.organization.slug, slug);
    await result(await context.request.get(origin + '/api/v1/companies/unrelated-company/settings'), 404);
    if (role === 'Driver') {
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
    } else {
      await page.getByRole('button', { name: role === 'Dispatcher' ? 'Dispatcher Account' : `${role} account`, exact: true }).click();
      await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    }
    await page.waitForURL(origin + '/login');
    assert.equal((await context.request.get(origin + '/api/v1/auth/me')).status(), 401);
    await context.close();
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: live company-free browser login/logout for all roles sharing email/phone, normalized credentials, same-role duplicate rejection and tenant boundaries.');
} finally { await browser.close(); }
