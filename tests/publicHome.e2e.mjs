// Public sign-in acceptance with deterministic API responses; no real credentials or account writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Sign in' } } }));
  const requests = [];
  let allowLogin = false;
  await context.route('**/api/v1/auth/login', route => {
    const body = route.request().postDataJSON(); requests.push(body);
    return route.fulfill(allowLogin ? { json: { id: 'user-1', login_id: body.login_id, display_name: 'User',
      role: { dispatch: 'DISPATCHER', customer: 'SHIPPER', driver: 'DRIVER' }[body.portal],
      organization: { id: 'company-1', name: 'Entry check', slug: 'entry-check', active: true } } }
      : { status: 401, json: { error: { message: 'Incorrect login or password.' } } });
  });
  // Isolate the destination document: this check verifies authentication submission and redirect, not operational pages.
  await context.route('**/entry-check/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Signed in</h1>' }));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.screenshot({ path: '/tmp/dispatra-public-home-desktop.png', fullPage: true });
  assert.equal(await page.locator('a[href="/admin"]').count(), 0);
  await page.getByRole('link', { name: 'Shipper sign in', exact: true }).click();
  assert.ok(await page.getByRole('radio', { name: 'Shipper', exact: true }).isChecked());
  await page.getByRole('radio', { name: 'Shipper', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await page.getByRole('radio', { name: 'Driver', exact: true }).isChecked());
  await page.keyboard.press('ArrowLeft');
  assert.ok(await page.getByRole('radio', { name: 'Shipper', exact: true }).isChecked());
  await page.getByRole('button', { name: 'Sign in as shipper' }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Company workspace').fill('admin');
  await page.getByRole('button', { name: 'Sign in as shipper' }).click();
  assert.equal(requests.length, 0);
  await page.getByLabel('Company workspace').fill('entry-check');
  await page.getByLabel('Email or login ID').fill('User@Example.com');
  await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
  await page.getByRole('button', { name: 'Sign in as shipper' }).click();
  await page.getByRole('alert').filter({ hasText: 'Incorrect login or password.' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/');
  allowLogin = true;
  for (const [role, portal, path] of [['Dispatcher', 'dispatch', '/entry-check/'], ['Shipper', 'customer', '/entry-check/shipper'], ['Driver', 'driver', '/entry-check/driver']]) {
    await page.goto(origin + '/');
    await page.getByRole('link', { name: `${role} sign in`, exact: true }).click();
    assert.ok(await page.getByRole('radio', { name: role, exact: true }).isChecked());
    await page.getByLabel('Company workspace').fill('entry-check');
    await page.getByLabel('Email or login ID').fill('User@Example.com');
    await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
    await page.getByRole('button', { name: `Sign in as ${role.toLowerCase()}` }).click();
    await page.waitForURL(origin + path);
    assert.deepEqual(requests.at(-1), { organization: 'entry-check', portal, login_id: 'user@example.com', password: 'Example-Password-99' });
    const stored = await page.evaluate(() => Object.values(localStorage).join(' '));
    assert.equal(stored.includes('Example-Password-99'), false);
    assert.equal(stored.includes('user@example.com'), false);
  }
  await page.goto(origin + '/');
  assert.equal(await page.getByLabel('Company workspace').inputValue(), 'entry-check');
  assert.ok(await page.getByRole('radio', { name: 'Driver', exact: true }).isChecked());
  // Administration remains directly accessible without a public link.
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { level: 1, name: 'Platform administration', exact: true }).waitFor();
  for (const [path, role] of [['/shipper', 'Shipper'], ['/driver', 'Driver'], ['/dispatch', 'Dispatcher']]) {
    await page.goto(origin + path);
    assert.ok(await page.getByRole('radio', { name: role, exact: true }).isChecked());
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'Driver sign in', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Sign in as driver' }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at ${width}px`);
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-public-home-mobile.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: 'SHIPPER', organization: { id: 'company-1', name: 'Acme', slug: 'acme', active: true } } }));
  await page.goto(origin + '/');
  await page.getByRole('link', { name: 'Open my workspace' }).first().waitFor();
  for (const link of await page.getByRole('link', { name: 'Open my workspace' }).all()) assert.equal(await link.getAttribute('href'), '/acme/shipper');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: homepage role shortcuts, direct login requests/redirects for all three roles, failed-login retry, workspace validation/remembering, no stored credentials, direct admin access, authenticated resume and 390px/320px layout.');
} finally { await browser.close(); }
