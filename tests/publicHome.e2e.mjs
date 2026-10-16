// Browser acceptance with deterministic auth responses; no real account writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let success = false;
  let selectedRole = 'SHIPPER';
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (success && route.request().isNavigationRequest() && url.pathname.startsWith('/matched-company')) {
      return route.fulfill({ contentType: 'text/html', body: '<h1>Workspace opened</h1>' });
    }
    return route.continue();
  });
  await context.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Sign in' } } }));
  const requests = [];
  await context.route('**/api/v1/auth/login', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill(success ? { json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: selectedRole,
      organization: { id: 'company-1', name: 'Matched company', slug: 'matched-company', active: true } } }
      : { status: 401, json: { error: { message: 'Incorrect email or password.' } } });
  });
  await context.route('**/api/v1/subscription/plan', route => route.fulfill({json:{name:'Monthly subscription',interval:'MONTHLY',trial_days:30,monthly_price:null,currency:'CAD'}}));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  assert.equal(await page.getByLabel('Workspace', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('radio').count(), 0);
  assert.equal(await page.getByRole('navigation', {name:'Website navigation',exact:true}).getByRole('link', {name:'Plans',exact:true}).getAttribute('href'), '/plans');
  assert.equal(await page.getByRole('banner').getByRole('link', {name:'Login',exact:true}).count(), 0);
  await page.getByRole('contentinfo').getByRole('link', {name:'Sign in to your workspace',exact:true}).click();
  await page.waitForURL(origin + '/login');
  await page.getByRole('heading', {name:'Sign in',exact:true}).waitFor();
  await page.goBack();
  await page.waitForURL(origin + '/');
  await page.getByRole('link', { name: 'Start Free Trial', exact: true }).click();
  await page.waitForURL(origin + '/plans');
  await page.getByRole('heading', { name: 'TMS + Smart Dispatching' }).waitFor();
  await page.getByRole('button', { name: 'Start free trial', exact: true }).click();
  await page.getByRole('dialog', { name: 'Start your free trial' }).waitFor();
  assert.equal(await page.getByLabel('Workspace', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(origin + '/login');
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 3);
  assert.equal(await page.getByLabel('Workspace', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Change workspace' }).count(), 0);
  await page.screenshot({ path: '/tmp/dispatra-shared-login-desktop.png', fullPage: true });
  await page.getByRole('radio', { name: 'Dispatcher' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await page.getByRole('radio', { name: 'Shipper' }).isChecked());
  for (const [role, portal] of [['Dispatcher', 'dispatch'], ['Shipper', 'customer'], ['Driver', 'driver']]) {
    await page.getByText(role, { exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('User@Example.com');
    await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' }).waitFor();
    assert.deepEqual(requests.at(-1), { portal, login_id: 'user@example.com', password: 'Example-Password-99' });
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.evaluate(() => Object.values(localStorage).join(' ').includes('Example-Password-99')), false);
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const role of ['Dispatcher', 'Shipper', 'Driver']) assert.ok(await page.getByRole('radio', { name: role }).isVisible());
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-shared-login-mobile.png', fullPage: true });
  }
  for (const [role, accountRole, suffix] of [['Dispatcher', 'DISPATCHER', '/'], ['Shipper', 'SHIPPER', '/shipper'], ['Driver', 'DRIVER', '/driver']]) {
    success = false;
    await page.goto(origin + '/login');
    await page.getByText(role, { exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('user@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
    selectedRole = accountRole; success = true;
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Workspace opened' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/matched-company' + suffix);
  }
  success = false;
  for (const [path, role] of [['/shipper', 'Shipper'], ['/driver', 'Driver'], ['/dispatch', 'Dispatcher']]) {
    await page.goto(origin + path);
    assert.ok(await page.getByRole('radio', { name: role }).isChecked());
  }
  // Old company links also route to the authenticated account's company.
  await page.goto(origin + '/old-company/driver');
  await page.getByLabel('Email', { exact: true }).fill('user@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Example-Password-99');
  selectedRole = 'DRIVER'; success = true;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Workspace opened' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/matched-company/driver');
  success = false;
  await page.goto(origin + '/admin');
  await page.getByRole('heading', { name: 'Platform administration', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0);
  assert.ok(await page.getByLabel('Login ID', { exact: true }).isVisible());
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: shared role/email/password login, keyboard and mobile layouts, retry, company discovery redirects, legacy links and separate owner login.');
} finally { await browser.close(); }
