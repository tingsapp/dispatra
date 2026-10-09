// Local layout acceptance with synthetic tenant responses; no operational writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let unread = 1;
  const notification = { id: 'n1', version: 1, created_at: new Date().toISOString(), kind: 'order.assigned', severity: 'INFO',
    title: 'Order assigned', body: 'Your delivery has a driver.', order_id: 'order-1', route_id: null, read_at: null };
  const profile = { id: 'shipper-1', version: 1, number: 'DDS-1042', name: 'Example Shipper', company_name: 'Example Shipper', kind: 'BUSINESS',
    email: 'shipper@example.com', phone: '6045550100', status: 'ACTIVE', warehouse: { text: '100 Main St, Vancouver, BC V6A 2S5', city: 'Vancouver', province: 'BC', country: 'CA', postal_code: 'V6A 2S5' },
    discount: { kind: 'NONE', value: '0' }, instructions: '', rate_card_id: null };
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    let json;
    if (path === '/api/v1/auth/me') json = { id: 'user-1', login_id: profile.email, display_name: profile.name, role: 'SHIPPER', organization: { id: 'company-1', slug: 'demo', name: 'Demo Delivery', active: true } };
    else if (path.endsWith('/shipper/profile')) json = profile;
    else if (path.endsWith('/booking-preferences')) json = { currency: 'CAD', time_zone: 'America/Vancouver', weight_unit: 'kg', dimension_unit: 'cm', distance_unit: 'km', gst_enabled: false, provincial_enabled: false, fuel_enabled: false };
    else if (path.endsWith('/sync')) json = { cursor: '1-0', changes: [], unread, reset: false, next_poll_ms: 60000 };
    else if (path.endsWith('/notifications/n1/read')) { unread = 0; notification.read_at = new Date().toISOString(); json = notification; }
    else if (path.endsWith('/notifications')) json = [notification];
    else if (['/orders', '/booking-options', '/booking-drivers'].some(suffix => path.endsWith(suffix))) json = [];
    else return route.fulfill({ status: 404, json: { error: { message: 'Outside this local layout check.' } } });
    return route.fulfill({ json });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const header = page.getByRole('banner', { name: 'Workspace header' });
  const bell = header.getByRole('button', { name: /^Notifications/ });
  const checkHeader = async () => {
    assert.equal(await page.getByRole('button', { name: /^Notifications/ }).count(), 1);
    const bounds = await bell.boundingBox();
    assert.equal(bounds.y, 14);
    const contentRight = await page.locator('main.page-content').evaluate(main => {
      const bounds = main.getBoundingClientRect();
      return bounds.right - parseFloat(getComputedStyle(main).paddingRight);
    });
    assert.ok(Math.abs(bounds.x + bounds.width - contentRight) < 1, 'Header bell aligns with the content right edge');
    assert.equal(await header.getByRole('button', { name: 'New order', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  };
  await page.goto(origin + '/demo/shipper');
  await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
  await checkHeader();
  const originalBell = await bell.elementHandle();
  await page.screenshot({ path: '/tmp/dispatra-shipper-header-orders.png', fullPage: true });
  await page.getByRole('button', { name: 'Shipper account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Profile', exact: true }).click();
  await page.getByRole('heading', { name: 'Contact details', exact: true }).waitFor();
  await checkHeader();
  assert.ok(await originalBell.evaluate(element => element.isConnected), 'The same bell survives page navigation');
  await page.screenshot({ path: '/tmp/dispatra-shipper-header-profile.png', fullPage: true });
  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await page.getByRole('heading', { name: 'Change password', exact: true }).waitFor();
  await checkHeader();
  await bell.click();
  await page.getByRole('dialog', { name: 'Notifications', exact: true }).waitFor();
  await page.getByRole('button', { name: /Order assigned\. Your delivery has a driver/ }).click();
  await page.waitForURL(origin + '/demo/shipper');
  await checkHeader();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/demo/shipper/profile');
    await page.getByRole('heading', { name: 'Contact details', exact: true }).waitFor();
    await checkHeader();
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-shipper-header-mobile.png', fullPage: true });
    // Add a disposable tall area to verify content scrolling cannot move the shared header.
    await page.locator('main.page-content').evaluate(main => { const spacer = document.createElement('div'); spacer.id = 'scroll-fixture'; spacer.style.height = '1200px'; main.append(spacer); });
    await page.locator('.app-page').evaluate(canvas => { canvas.scrollTop = 500; });
    await checkHeader();
    await page.locator('#scroll-fixture').evaluate(spacer => spacer.remove());
    await bell.click();
    const panel = page.getByRole('dialog', { name: 'Notifications', exact: true });
    await panel.waitFor();
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 8 && bounds.x + bounds.width <= width - 8, 'Inbox stays inside mobile viewport');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Portal navigation' }).getByRole('link', { name: 'Orders', exact: true }).click();
    await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Workspace sidebar' }).count(), 0);
    await checkHeader();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: persistent Shipper header bell aligned with Orders/Profile/Security content, notification navigation, scrolling, mobile panel bounds and sidebar navigation.');
} finally { await browser.close(); }
