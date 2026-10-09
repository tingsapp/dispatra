// Read-only workspace navigation; anonymous account responses, no credentials or account writes.
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
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  let loginRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/auth/login') loginRequests++; });
  const dialog = page.getByRole('dialog', { name: 'Open your workspace' });
  const company = page.getByLabel('Company workspace');
  const checkBounds = async () => {
    const bounds = await dialog.locator('.app-dialog-surface').boundingBox();
    const { width, height } = page.viewportSize();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2 && Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, 'Popup is centered');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  };
  await page.goto(origin);
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await company.count(), 0, 'No inline workspace form');
  assert.equal(await page.locator('a[href="/admin"]').count(), 0);
  await page.screenshot({ path: '/tmp/dispatra-public-home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await dialog.waitFor(); await checkBounds();
  assert.ok(await company.evaluate(el => el === document.activeElement));
  assert.equal(await dialog.getByRole('textbox').count(), 1);
  assert.equal(await dialog.getByText('dispatra.com/', { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.screenshot({ path: '/tmp/dispatra-workspace-popup-desktop.png', animations: 'disabled' });
  await page.keyboard.press('Tab');
  assert.ok(await dialog.getByRole('button', { name: 'Continue', exact: true }).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Tab');
  assert.ok(await dialog.getByRole('button', { name: 'Close workspace selection' }).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Shift+Tab');
  assert.ok(await dialog.getByRole('button', { name: 'Continue', exact: true }).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 0);
  assert.ok(await page.getByRole('button', { name: 'Log in', exact: true }).evaluate(el => el === document.activeElement));
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.getByRole('button', { name: 'Shipper sign in', exact: true }).click();
  assert.ok(await dialog.getByRole('radio', { name: 'Shipper' }).isChecked());
  await dialog.getByRole('radio', { name: 'Shipper' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await dialog.getByRole('radio', { name: 'Driver' }).isChecked());
  await page.keyboard.press('ArrowLeft');
  assert.ok(await dialog.getByRole('radio', { name: 'Shipper' }).isChecked());
  for (const invalid of ['', 'admin', 'https://dispatra.com/demo/']) {
    await company.fill(invalid);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  }
  await dialog.getByRole('button', { name: 'Close workspace selection' }).click();
  for (const [role, path, title] of [['Dispatcher', '/demo/', 'Dispatch workspace'], ['Shipper', '/demo/shipper', 'Shipper portal'], ['Driver', '/demo/driver', 'Driver portal']]) {
    await page.goto(origin);
    await page.getByRole('button', { name: `${role} sign in`, exact: true }).click();
    assert.ok(await dialog.getByRole('radio', { name: role }).isChecked());
    await company.fill('demo');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(origin + path);
    await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
    await page.getByLabel('Password', { exact: true }).waitFor();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatra_public_workspace_v1')));
    assert.deepEqual(stored, { slug: 'demo', role: role.toLowerCase() });
  }
  assert.equal(loginRequests, 0, 'Continue navigates to a login page without submitting credentials');
  await page.goto(origin);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  assert.equal(await company.inputValue(), 'demo');
  assert.ok(await dialog.getByRole('radio', { name: 'Driver' }).isChecked());
  await page.mouse.click(20, 20);
  assert.equal(await dialog.count(), 0, 'Outside click dismisses the popup');
  await page.getByRole('button', { name: 'Open your workspace', exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Close workspace selection' }).click();
  await page.getByRole('button', { name: 'Sign in to your workspace', exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Close workspace selection' }).click();
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { level: 1, name: 'Platform administration', exact: true }).waitFor();
  for (const [path, role] of [['/shipper', 'Shipper'], ['/driver', 'Driver'], ['/dispatch', 'Dispatcher']]) {
    await page.goto(origin + path);
    assert.ok(await dialog.getByRole('radio', { name: role }).isChecked());
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await dialog.waitFor(); await checkBounds();
    assert.ok(await dialog.getByRole('button', { name: 'Continue', exact: true }).isVisible());
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-workspace-popup-mobile.png', animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Close workspace selection' }).click();
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-public-home-mobile.png', fullPage: true });
  }
  await context.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: 'SHIPPER', organization: { id: 'company-1', name: 'Acme', slug: 'acme', active: true } } }));
  await page.goto(origin);
  await page.getByRole('link', { name: 'Open my workspace' }).first().waitFor();
  for (const link of await page.getByRole('link', { name: 'Open my workspace' }).all()) assert.equal(await link.getAttribute('href'), '/acme/shipper');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: centered workspace popup, fixed prefix, focus trapping/restoration, keyboard roles, validation, all three existing login pages, close/outside/Escape, shortcuts, preferences, no auth submissions and 390px/320px layout.');
} finally { await browser.close(); }
