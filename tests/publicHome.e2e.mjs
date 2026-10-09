// Local public/login acceptance with deterministic authentication responses; no real account writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let allowSuccess = false;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Isolate the post-auth destination document; operational portal data is outside this check.
    if (allowSuccess && route.request().isNavigationRequest() && url.pathname === '/demo/shipper') {
      return route.fulfill({ contentType: 'text/html', body: '<h1>Shipper workspace opened</h1>' });
    }
    return route.continue();
  });
  await context.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Sign in' } } }));
  const requests = [];
  await context.route('**/api/v1/auth/login', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill(allowSuccess ? { json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: 'SHIPPER', organization: { id: 'company-1', name: 'Demo', slug: 'demo', active: true } } }
      : { status: 401, json: { error: { message: 'Incorrect login or password.' } } });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const company = page.getByLabel('Company workspace');
  const noOverflow = async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await company.boundingBox();
    assert.ok(bounds && bounds.x >= 24 && bounds.x + bounds.width <= page.viewportSize().width - 24, 'Input stays inside the shared page gutters');
  };
  await page.goto(origin);
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('radio').count(), 0, 'Role selection is only on the login page');
  assert.ok(await page.locator('[aria-labelledby="home-title"]').getByLabel('Company workspace').isVisible());
  assert.equal(await page.locator('a[href="/admin"]').count(), 0);
  await page.getByRole('link', { name: 'Log in', exact: true }).click();
  assert.ok(await company.evaluate(el => el === document.activeElement));
  for (const invalid of ['', 'admin', 'https://dispatra.com/demo/']) {
    await company.fill(invalid);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  }
  await company.fill('demo');
  await page.screenshot({ path: '/tmp/dispatra-public-home-desktop.png', fullPage: true, animations: 'disabled' });
  const homeBounds = await page.locator('[aria-labelledby="home-title"]').boundingBox();
  const homeHeader = await page.getByRole('banner').boundingBox();
  await company.press('Enter');
  await page.waitForURL(origin + '/demo/');
  await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  assert.equal(await company.inputValue(), 'demo');
  assert.equal(await company.evaluate(el => el.readOnly), true);
  const loginBounds = await page.locator('[aria-labelledby="login-title"]').boundingBox();
  const loginHeader = await page.getByRole('banner').boundingBox();
  assert.equal(loginBounds.x, homeBounds.x); assert.equal(loginBounds.width, homeBounds.width);
  assert.equal(loginHeader.x, homeHeader.x); assert.equal(loginHeader.width, homeHeader.width);
  assert.equal(await page.getByRole('radio').count(), 3);
  await page.screenshot({ path: '/tmp/dispatra-company-login-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('radio', { name: 'Dispatcher' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await page.getByRole('radio', { name: 'Shipper' }).isChecked());
  assert.equal(new URL(page.url()).pathname, '/demo/shipper');
  for (const [role, portal, path] of [['Dispatcher', 'dispatch', '/demo/'], ['Shipper', 'customer', '/demo/shipper'], ['Driver', 'driver', '/demo/driver']]) {
    await page.getByText(role, { exact: true }).click();
    assert.ok(await page.getByRole('radio', { name: role }).isChecked());
    assert.equal(new URL(page.url()).pathname, path);
    await page.getByLabel(role === 'Shipper' ? 'Email or login ID' : 'Login ID', { exact: true }).fill('User@Example.com');
    await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Incorrect login or password.' }).waitFor();
    assert.deepEqual(requests.at(-1), { organization: 'demo', portal, login_id: 'user@example.com', password: 'Example-Password-99' });
    assert.equal(await company.inputValue(), 'demo');
    const saved = await page.evaluate(() => Object.values(localStorage).join(' '));
    assert.equal(saved.includes('Example-Password-99'), false);
    assert.equal(saved.includes('user@example.com'), false);
  }
  // Starting on dispatcher login, changing to Shipper must redirect to the returned account's home.
  await page.goto(origin + '/demo/');
  await page.getByText('Shipper', { exact: true }).click();
  await page.getByLabel('Email or login ID', { exact: true }).fill('User@Example.com');
  await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
  allowSuccess = true;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Shipper workspace opened' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/demo/shipper');
  allowSuccess = false;
  await page.goto(origin + '/demo/driver');
  assert.ok(await page.getByRole('radio', { name: 'Driver' }).isChecked());
  await page.getByRole('link', { name: 'Change workspace' }).click();
  await page.waitForURL(origin + '/#workspace');
  assert.equal(await company.inputValue(), 'demo');
  assert.equal(await page.getByRole('radio').count(), 0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin);
    await noOverflow();
    await company.fill('demo');
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-public-home-mobile.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    await noOverflow();
    assert.equal(await company.inputValue(), 'demo');
    for (const role of ['Dispatcher', 'Shipper', 'Driver']) assert.ok(await page.getByRole('radio', { name: role }).isVisible());
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-company-login-mobile.png', fullPage: true, animations: 'disabled' });
  }
  for (const [path, destination, role] of [['/shipper', '/demo/shipper', 'Shipper'], ['/driver', '/demo/driver', 'Driver'], ['/dispatch', '/demo/', 'Dispatcher']]) {
    await page.goto(origin + path);
    await company.fill('demo');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(origin + destination);
    assert.ok(await page.getByRole('radio', { name: role }).isChecked());
  }
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { name: 'Platform administration', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0);
  await context.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: 'SHIPPER', organization: { id: 'company-1', name: 'Acme', slug: 'acme', active: true } } }));
  await page.goto(origin);
  await page.getByRole('link', { name: 'Open my workspace' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Open my workspace' }).getAttribute('href'), '/acme/shipper');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: hero workspace input, prefilled company login, matching homepage/login widths, role selection/payloads, failed-login retry, correct post-auth destination, no saved credentials, aliases and 390px/320px layouts.');
} finally { await browser.close(); }
