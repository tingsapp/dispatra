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
  const consistentFields = async () => {
    const styles = await page.evaluate(() => [
      document.querySelector('input[autocomplete="organization"]').parentElement,
      document.querySelector('input[autocomplete="username"]'),
      document.querySelector('input[type="password"]'),
    ].map(element => {
      const style = getComputedStyle(element);
      return ['height', 'fontSize', 'lineHeight', 'borderRadius', 'borderWidth', 'borderColor', 'backgroundColor', 'paddingLeft', 'paddingRight'].map(property => style[property]);
    }));
    assert.deepEqual(styles[0], styles[1], 'Workspace and credentials use the same field styling');
    assert.deepEqual(styles[1], styles[2]);
    assert.equal(styles[0][0], '40px');
  };
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
  assert.equal(await page.getByRole('banner').getByRole('link').count(), 1);
  const homeLogo = await page.getByRole('banner').getByRole('link', { name: 'Dispatra home' }).boundingBox();
  await page.getByRole('link', { name: 'Sign in to your workspace', exact: true }).click();
  assert.ok(await company.evaluate(el => el === document.activeElement));
  for (const invalid of ['', 'admin', 'https://dispatra.com/demo/']) {
    await company.fill(invalid);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  }
  await company.fill('demo');
  await page.screenshot({ path: '/tmp/dispatra-public-home-desktop.png', fullPage: true, animations: 'disabled' });
  await company.press('Enter');
  await page.waitForURL(origin + '/demo/');
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await company.inputValue(), 'demo');
  assert.equal(await company.evaluate(el => el.readOnly), true);
  await consistentFields();
  const focusedStyles = [];
  for (const field of [company, page.getByLabel('Login ID', { exact: true }), page.getByLabel('Password', { exact: true })]) {
    await field.focus();
    focusedStyles.push(await field.evaluate(async el => {
      const surface = el.parentElement.classList.contains('app-input-group') ? el.parentElement : el;
      // Compare settled focus states after the shared border transition.
      getComputedStyle(surface).borderColor;
      await Promise.all(surface.getAnimations().map(animation => animation.finished));
      const style = getComputedStyle(surface);
      return [style.borderColor, style.outlineColor, style.outlineWidth, style.boxShadow];
    }));
  }
  assert.deepEqual(focusedStyles[0], focusedStyles[1], 'Prefix fields share the native-input focus style');
  assert.deepEqual(focusedStyles[1], focusedStyles[2]);
  const loginBounds = await page.locator('[aria-labelledby="login-title"]').boundingBox();
  assert.ok(loginBounds.width <= 384, 'Login remains a compact form');
  assert.ok(Math.abs(loginBounds.x + loginBounds.width / 2 - 720) < 1, 'Login is horizontally centered');
  const mainBounds = await page.getByRole('main').boundingBox();
  assert.ok(Math.abs(loginBounds.y + loginBounds.height / 2 - (mainBounds.y + mainBounds.height / 2)) < 1, 'Login is vertically centered below its header');
  assert.deepEqual(await page.getByRole('banner').getByRole('link', { name: 'Dispatra home' }).boundingBox(), homeLogo, 'Login logo matches the homepage header position');
  assert.equal(await page.getByText('Workspace preview · sample data', { exact: true }).count(), 0, 'Login has no map preview');
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
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
    await noOverflow();
    assert.equal(await company.inputValue(), 'demo');
    await consistentFields();
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
  console.log('PASS: hero workspace input, compact centered company login, role selection/payloads, failed-login retry, correct post-auth destination, no saved credentials, aliases and 390px/320px layouts.');
} finally { await browser.close(); }
