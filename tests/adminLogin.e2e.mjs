// Owner login aliases and deep links against a disposable local API.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
assert.equal(process.env.E2E_DISPOSABLE, 'true', 'Use a disposable API database.');
assert.ok(process.env.E2E_OWNER_PASSWORD, 'Provide the disposable owner password.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [path, destination, title] of [
    ['/admin', '/admin/companies', 'Companies'],
    ['/admin/login', '/admin/companies', 'Companies'],
    ['/platform/login', '/admin/companies', 'Companies'],
    ['/admin/billing', '/admin/billing', 'Subscription'],
    ['/admin/revenue', '/admin/revenue', 'Revenue'],
    ['/admin/profile', '/admin/profile', 'Profile'],
  ]) {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Login ID', { exact: true }).fill(process.env.E2E_OWNER_LOGIN || 'browser-owner');
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_OWNER_PASSWORD);
    const reloads = [];
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reloads.push(request.url()); });
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: title, level: 1, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, destination);
    assert.deepEqual(reloads, [], 'owner success must open its panel without reloading the login URL');
    const me = await context.request.get(origin + '/api/v1/auth/me');
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).role, 'ADMIN');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: title, level: 1, exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, destination);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: real owner login opens Companies from /admin, /admin/login and /platform/login; billing/revenue/profile deep links survive; no login-page reload and authenticated refresh works.');
} finally { await browser.close(); }
