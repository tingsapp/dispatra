// Read-only public entry acceptance; no account creation or delivery commands.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.screenshot({ path: '/tmp/dispatra-public-home-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByText('Shipper', { exact: true }).click();
  await page.getByRole('radio', { name: 'Shipper', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await page.getByRole('radio', { name: 'Driver', exact: true }).isChecked());
  await page.keyboard.press('ArrowLeft');
  assert.ok(await page.getByRole('radio', { name: 'Shipper', exact: true }).isChecked());
  await page.getByRole('button', { name: 'Continue as shipper' }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Company workspace').fill('admin');
  await page.getByRole('button', { name: 'Continue as shipper' }).click();
  assert.equal(new URL(page.url()).pathname, '/');
  for (const [role, path, title] of [['Dispatcher', '/demo/', 'Dispatch workspace'], ['Shipper', '/demo/shipper', 'Shipper portal'], ['Driver', '/demo/driver', 'Driver portal']]) {
    await page.goto(origin + '/');
    await page.getByText(role, { exact: true }).click();
    assert.ok(await page.getByRole('radio', { name: role, exact: true }).isChecked());
    await page.getByLabel('Company workspace').fill('https://dispatra.com/demo/');
    await page.getByRole('button', { name: `Continue as ${role.toLowerCase()}` }).click();
    await page.waitForURL(origin + path);
    await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
  }
  await page.goto(origin + '/');
  assert.equal(await page.getByLabel('Company workspace').inputValue(), 'demo');
  assert.ok(await page.getByRole('radio', { name: 'Driver', exact: true }).isChecked());
  await page.getByRole('link', { name: 'Platform administration', exact: true }).click();
  await page.waitForURL(origin + '/admin');
  await page.getByRole('heading', { level: 1, name: 'Platform administration', exact: true }).waitFor();
  for (const [path, role] of [['/shipper', 'Shipper'], ['/driver', 'Driver'], ['/dispatch', 'Dispatcher']]) {
    await page.goto(origin + path);
    assert.ok(await page.getByRole('radio', { name: role, exact: true }).isChecked());
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at ${width}px`);
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-public-home-mobile.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.route('**/api/v1/auth/me', route => route.fulfill({ json: { id: 'user-1', login_id: 'user@example.com', display_name: 'User', role: 'SHIPPER', organization: { id: 'company-1', name: 'Acme', slug: 'acme', active: true } } }));
  await page.goto(origin + '/');
  await page.getByRole('link', { name: 'Open my workspace' }).first().waitFor();
  for (const link of await page.getByRole('link', { name: 'Open my workspace' }).all()) assert.equal(await link.getAttribute('href'), '/acme/shipper');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: all three role sign-in routes, workspace validation/remembering, admin, shortcuts, authenticated resume and 390px/320px layout.');
} finally { await browser.close(); }
