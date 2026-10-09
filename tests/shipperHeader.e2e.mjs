// Local layout acceptance with synthetic tenant responses; no operational writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__shipperDeviceRequests = 0;
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: success => {
      window.__shipperDeviceRequests++;
      success({ coords: { latitude: 43.65, longitude: -79.38 } });
    } } });
  });
  let unread = 1, changes = [];
  const notification = { id: 'n1', version: 1, created_at: new Date().toISOString(), kind: 'order.assigned', severity: 'INFO',
    title: 'Order assigned', body: 'Your delivery has a driver.', order_id: 'order-1', route_id: null, read_at: null };
  const profile = { id: 'shipper-1', version: 1, number: 'DDS-1042', name: 'Example Shipper', company_name: 'Example Shipper', kind: 'BUSINESS',
    email: 'shipper@example.com', phone: '6045550100', status: 'ACTIVE', warehouse: { text: '100 Main St, Vancouver, BC V6A 2S5', city: 'Vancouver', province: 'BC', country: 'CA', postal_code: 'V6A 2S5', latitude: 49.28, longitude: -123.1 },
    discount: { kind: 'NONE', value: '0' }, instructions: '', rate_card_id: null };
  let orders = [], failOrders = false, failTracking = false, openIssue = false;
  const trackingReads = [], roadReads = [];
  const stops = ['PICKUP', 'DROPOFF'].map((kind, index) => ({ id: `stop-${index}`, kind,
    address: { ...profile.warehouse, text: index ? '200 Granville St, Vancouver, BC' : profile.warehouse.text, latitude: 49.28 + index * 0.01, longitude: -123.1 },
    contact_name: '', phone: '', instructions: '', window_start: null, window_end: null }));
  const order = (id, status) => ({ id, version: 1, number: `DDO-104${id}`, shipper_id: profile.id, billing_shipper_id: profile.id,
    service_id: 'service-1', route_id: status === 'NEW' ? null : 'route-1', source: 'SHIPPER_PORTAL', status,
    scheduled_at: '2026-10-10T16:00:00Z', completed_at: null, created_at: '2026-10-09T16:00:00Z', booking: {},
    facts: { stops: stops.map((stop, index) => ({ ...stop, id: `${id}-${stop.id}`, address: { ...stop.address, text: id === '1' ? stop.address.text : `${id}00 ${index ? 'Granville' : 'Main'} St, Vancouver, BC`, longitude: stop.address.longitude + (Number(id) - 1) * 0.008 } })), items: [], accessorials: [], adjustments: [], external_reference: `REF-${id}`, internal_notes: '' },
    pricing: { status: 'PRICED', stage: 'ESTIMATE', currency: 'CAD', subtotal: '25', tax: '0', total: '25', lines: [], context: {} } });
  const tracking = row => {
    const stage = { NEW: 'BOOKED', ASSIGNED: 'OUT_FOR_DELIVERY', IN_PROGRESS: 'OUT_FOR_DELIVERY', COMPLETED: 'DELIVERED', CANCELLED: 'CANCELLED' }[row.status];
    return { order_id: row.id, status: row.status, stage, dedicated: true, driver: { first_name: 'Dana', vehicle_type: 'Cargo van' },
      stops: row.facts.stops.map(stop => ({ ...stop, planned_at: row.scheduled_at, eta: stage === 'OUT_FOR_DELIVERY' ? row.scheduled_at : null,
        arrived_at: null, completed_at: stage === 'DELIVERED' ? row.scheduled_at : null, status: stage === 'DELIVERED' ? 'COMPLETED' : 'PENDING' })),
      stops_before_next: 0, eta: stage === 'OUT_FOR_DELIVERY' ? row.scheduled_at : null, delay_minutes: 0, late: false, live: false,
      location: null, location_stale: stage === 'OUT_FOR_DELIVERY', events: [{ kind: 'BOOKED', label: 'Order booked', at: row.created_at }], open_issue: row.id === '1' && openIssue, updated_at: row.created_at };
  };
  const liveMap = process.env.TRACKING_LIVE_MAP === '1';
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin || liveMap && /(^|\.)(googleapis\.com|gstatic\.com|google\.com)$/.test(url.hostname) ? route.continue() : route.abort();
  });
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    let json;
    if (path === '/api/v1/auth/me') json = { id: 'user-1', login_id: profile.email, display_name: profile.name, role: 'SHIPPER', organization: { id: 'company-1', slug: 'demo', name: 'Demo Delivery', active: true } };
    else if (path.endsWith('/shipper/profile')) json = profile;
    else if (path.endsWith('/booking-preferences')) json = { currency: 'CAD', time_zone: 'America/Vancouver', weight_unit: 'kg', dimension_unit: 'cm', distance_unit: 'km', gst_enabled: false, provincial_enabled: false, fuel_enabled: false };
    else if (path.endsWith('/sync')) { json = { cursor: '1-0', changes, unread, reset: false, next_poll_ms: 60000 }; changes = []; }
    else if (path.endsWith('/notifications/n1/read')) { unread = 0; notification.read_at = new Date().toISOString(); json = notification; }
    else if (path.endsWith('/notifications')) json = [notification];
    else if (path.endsWith('/orders')) {
      if (failOrders) return route.fulfill({ status: 500, json: { error: { message: 'Orders unavailable.' } } });
      json = orders;
    }
    else if (path.endsWith('/tracking/map')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="384"><rect width="768" height="384" fill="#edf0ee"/><path d="M0 130H768M0 270H768M190 0V384M440 0V384M640 0V384" stroke="white" stroke-width="16"/><path d="M190 270V130H640" stroke="#6366f1" stroke-width="5" fill="none"/><circle cx="190" cy="270" r="7" fill="white" stroke="#171717" stroke-width="3"/><circle cx="640" cy="130" r="7" fill="#171717" stroke="white" stroke-width="3"/></svg>' });
    else if (path.endsWith('/tracking')) {
      const id = path.split('/').at(-2); trackingReads.push(id);
      if (failTracking) return route.fulfill({ status: 503, json: { error: { message: 'Tracking unavailable.' } } });
      const row = orders.find(row => row.id === id);
      if (!row) return route.fulfill({ status: 404, json: { error: { message: 'Order unavailable.' } } });
      json = tracking(row);
    }
    else if (path.endsWith('/road-path')) {
      const id = path.split('/').at(-2); roadReads.push(id);
      const row = orders.find(order => order.id === id);
      const points = row?.facts.stops.map(stop => [stop.address.latitude, stop.address.longitude]) ?? [];
      json = { points: points.length === 2 ? [points[0], [points[0][0] + 0.004, points[0][1]], [points[0][0] + 0.004, points[0][1] + 0.003], [points[1][0], points[0][1] + 0.003], points[1]] : points };
    }
    else if (['/booking-options', '/booking-drivers'].some(suffix => path.endsWith(suffix))) json = [];
    else return route.fulfill({ status: 404, json: { error: { message: 'Outside this local layout check.' } } });
    return route.fulfill({ json });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const header = page.getByRole('banner', { name: 'Workspace header' });
  const bell = header.getByRole('button', { name: /^Notifications/ });
  const checkMapBounds = async () => {
    // Check actual projected marker rectangles, not just that a fit button was clicked.
    await page.waitForFunction(() => {
      const main = document.querySelector('main[aria-label="Tracking"]');
      const card = document.querySelector('.shipper-tracking-card')?.getBoundingClientRect();
      if (!main || !card) return false;
      const view = main.getBoundingClientRect();
      const markers = [...main.querySelectorAll('[role="button"][aria-label*=" · Pickup:"], [role="button"][aria-label*=" · Drop-off:"]')];
      return markers.length > 0 && markers.every(marker => {
        const p = marker.getBoundingClientRect();
        const contained = p.left >= view.left + 8 && p.right <= view.right - 8 && p.top >= view.top + 64 && p.bottom <= view.bottom - 32;
        const uncovered = p.right <= card.left || p.left >= card.right || p.bottom <= card.top || p.top >= card.bottom;
        return contained && uncovered;
      });
    }, null, { timeout: 15000 });
  };
  const checkHeader = async () => {
    assert.equal(await page.getByRole('button', { name: /^Notifications/ }).count(), 1);
    const bounds = await bell.boundingBox();
    assert.equal(bounds.y, 14);
    await page.waitForFunction(button => getComputedStyle(button).backgroundColor === 'rgb(240, 240, 240)', await bell.elementHandle(), { timeout: 3000 });
    const isMap = await page.locator('[aria-label="Shipment map"][data-map-provider="google"]').count();
    const contentRight = isMap ? await page.getByRole('main', { name: 'Tracking', exact: true }).evaluate(main => {
      const bounds = main.getBoundingClientRect();
      return bounds.right - (innerWidth < 768 ? 16 : 24);
    }) : await page.locator('main.page-content').evaluate(main => {
      const bounds = main.getBoundingClientRect();
      return bounds.right - parseFloat(getComputedStyle(main).paddingRight);
    });
    assert.ok(Math.abs(bounds.x + bounds.width - contentRight) < 1, 'Header bell aligns with the content right edge');
    assert.equal(await header.getByRole('button', { name: 'New order', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (isMap) {
      const canvas = await page.getByRole('main', { name: 'Tracking', exact: true }).boundingBox();
      assert.equal(canvas.y, 0); assert.equal(canvas.height, page.viewportSize().height);
      assert.equal(canvas.x + canvas.width, page.viewportSize().width);
      const map = await page.locator('[data-map-provider="google"]').boundingBox();
      assert.deepEqual(map, canvas, 'Map fills the workspace canvas');
    }
  };
  await page.goto(origin + '/demo/shipper');
  await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
  await checkHeader();
  const nav = page.getByRole('navigation', { name: 'Portal navigation' });
  assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Orders', 'Tracking']);
  await nav.getByRole('link', { name: 'Tracking', exact: true }).click();
  await page.getByRole('heading', { name: 'No orders to track', exact: true }).waitFor();
  await checkHeader();
  await nav.getByRole('link', { name: 'Orders', exact: true }).click();
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
  orders = [order('1', 'ASSIGNED'), order('2', 'NEW'), order('3', 'COMPLETED'), order('4', 'CANCELLED'), order('5', 'IN_PROGRESS')];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/demo/shipper');
  await page.getByRole('button', { name: 'View DDO-1041', exact: true }).click();
  const detail = page.getByRole('dialog');
  await detail.waitFor();
  assert.equal(await detail.getByRole('region', { name: 'Tracking' }).count(), 0);
  assert.deepEqual(trackingReads, [], 'Orders and order details do not request tracking');
  const track = detail.getByRole('link', { name: 'Track', exact: true });
  assert.equal(await track.getAttribute('href'), '/demo/shipper/tracking?order=1');
  await detail.getByRole('button', { name: 'Close dialog', exact: true }).focus();
  for (let step = 0; step < 8 && !await track.evaluate(link => link === document.activeElement); step++) await page.keyboard.press('Tab');
  assert.ok(await track.evaluate(link => link === document.activeElement), 'Track participates in dialog keyboard navigation');
  await page.keyboard.press('Enter');
  await page.waitForURL(origin + '/demo/shipper/tracking?order=1');
  await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await nav.getByRole('link', { name: 'Tracking', exact: true }).getAttribute('aria-current'), 'page');
  await checkHeader();
  await page.getByRole('region', { name: 'Stops and timeline', exact: true }).waitFor();
  assert.equal(await page.getByText(/Live location|Tracking refreshes every 30 seconds/).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Stops and timeline' }).evaluate(section => parseFloat(getComputedStyle(section).borderTopWidth)), 0);
  const issue = page.getByText('The driver reported an issue with this order. Dispatch is handling it.', { exact: true });
  assert.equal(await issue.count(), 0, 'No issue warning when the API reports no open issue');
  openIssue = true; changes = [{ entity: 'issue', order_id: '1' }];
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await issue.waitFor();
  openIssue = false; changes = [{ entity: 'issue', order_id: '1' }];
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await issue.waitFor({ state: 'detached' });

  if (liveMap) {
    await page.locator('svg[data-shipper-route="1"] path').waitFor({ timeout: 60000 });
    assert.equal(await page.getByRole('img', { name: /Your warehouse|Your device location/ }).count(), 0);
    const rounded = page.locator('svg[data-shipper-route="1"] path');
    assert.equal(await rounded.getAttribute('stroke-width'), '4');
    assert.equal(await rounded.getAttribute('stroke-linecap'), 'round');
    assert.equal(await rounded.getAttribute('stroke-linejoin'), 'round');
    assert.ok((await rounded.getAttribute('d')).includes('Q'), 'Road turns are visibly rounded');
    for (const number of ['DDO-1041', 'DDO-1042', 'DDO-1045']) {
      await page.getByRole('button', { name: new RegExp(`^${number} · Pickup:`) }).waitFor();
      await page.getByRole('button', { name: new RegExp(`^${number} · Drop-off:`) }).waitFor();
    }
    assert.equal(await page.getByRole('button', { name: /^DDO-104[34] · (Pickup|Drop-off):/ }).count(), 0);
    assert.deepEqual([...new Set(roadReads)].sort(), ['1', '2', '5'], 'Only open own orders request road geometry');
    await checkMapBounds(); // Initial framing must work without pressing Fit.
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.getByRole('button', { name: 'Fit open orders on map', exact: true }).click();
    await checkMapBounds();
    await page.getByRole('button', { name: 'Focus warehouse or fallback location', exact: true }).click();
    await page.getByRole('button', { name: 'Fit open orders on map', exact: true }).click();
    await checkMapBounds();
    assert.equal(await page.evaluate(() => window.__shipperDeviceRequests), 0, 'Warehouse coordinates avoid device location requests');
    await page.waitForFunction(() => [...document.querySelectorAll('.gm-style img')].some(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 200), null, { timeout: 60000 });
  }
  if (liveMap) await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/dispatra-shipper-tracking-desktop.png', fullPage: true });
  assert.equal(await page.getByRole('combobox', { name: 'Order to track' }).count(), 0);
  assert.equal(await page.locator('.shipper-tracking-card').count(), 1, 'Progress, stops and timeline share one card');
  const search = header.getByRole('searchbox', { name: 'Search your orders' });
  const selectOrder = async number => {
    await search.fill(number);
    await page.getByRole('dialog', { name: 'Your order search results' }).getByRole('button', { name: new RegExp(`^${number}`) }).click();
  };
  await search.fill('REF-2');
  await page.getByRole('dialog', { name: 'Your order search results' }).getByRole('button', { name: /^DDO-1042/ }).waitFor();
  await search.fill('another-shipper-order');
  await page.getByText('No matching orders.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.ok(!trackingReads.includes('another-shipper-order'));
  await search.fill('1045');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL(origin + '/demo/shipper/tracking?order=5');
  if (liveMap) {
    const pickup = page.getByRole('button', { name: /^DDO-1041 · Pickup:/ });
    await pickup.focus(); await page.keyboard.press('Enter');
    await page.waitForURL(origin + '/demo/shipper/tracking?order=1');
  }

  await selectOrder('DDO-1042');
  await page.waitForURL(origin + '/demo/shipper/tracking?order=2');
  await page.getByText('Booked – waiting for a driver', { exact: true }).waitFor();
  await page.goBack();
  await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
  await page.goForward();
  await page.getByText('Booked – waiting for a driver', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Booked – waiting for a driver', { exact: true }).waitFor();
  await selectOrder('DDO-1043');
  await page.getByRole('region', { name: 'Tracking' }).getByText(/^Delivered /).first().waitFor();
  await selectOrder('DDO-1044');
  await page.getByText('Order cancelled', { exact: true }).waitFor();
  if (liveMap) {
    assert.equal(await page.getByRole('button', { name: /^DDO-104[34] · (Pickup|Drop-off):/ }).count(), 0, 'Historical selection never draws terminal orders');
    assert.equal(await page.getByRole('button', { name: /^DDO-104[125] · (Pickup|Drop-off):/ }).count(), 6);
    orders = orders.map(row => row.id === '5' ? { ...row, status: 'COMPLETED', version: 2 } : row);
    changes = [{ entity: 'order', order_id: '5' }];
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.getByRole('button', { name: /^DDO-1045 · Pickup:/ }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: /^DDO-104[12] · (Pickup|Drop-off):/ }).count(), 4, 'Completion sync removes closed-order markers');

  }
  await page.goto(origin + '/demo/shipper/tracking?order=other-shipper-order');
  await page.getByRole('alert').filter({ hasText: 'This order is unavailable' }).waitFor();
  assert.ok(!trackingReads.includes('other-shipper-order'), 'Unlisted identities never trigger tracking requests');
  failTracking = true;
  await page.goto(origin + '/demo/shipper/tracking?order=1');
  await page.getByRole('alert').filter({ hasText: 'Tracking unavailable' }).waitFor();
  failTracking = false; failOrders = true;
  await page.goto(origin + '/demo/shipper/tracking');
  await page.getByRole('alert').filter({ hasText: 'Orders unavailable' }).waitFor();
  failOrders = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
  if (liveMap) {
    await page.setViewportSize({ width: 1040, height: 700 });
    await page.goto(origin + '/demo/shipper/tracking?order=1');
    await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
    await page.locator('svg[data-shipper-route="1"] path').waitFor({ timeout: 60000 });
    await checkMapBounds();
    await page.setViewportSize({ width: 1440, height: 900 });
    await checkMapBounds(); // Resizing and sidebar width must use current measurements.
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin + '/demo/shipper/tracking?order=1');
    await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
    await checkHeader();
    await search.fill('1042');
    const searchPanel = page.getByRole('dialog', { name: 'Your order search results' });
    await searchPanel.waitFor();
    const searchBounds = await searchPanel.boundingBox();
    assert.ok(searchBounds.x >= 8 && searchBounds.x + searchBounds.width <= width - 8, 'Order search stays inside the mobile viewport');
    await page.keyboard.press('Escape');
    if (liveMap) {
      await page.locator('svg[data-shipper-route="1"] path').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.gm-style img')].some(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 200), null, { timeout: 60000 });
      await checkMapBounds();
      await page.getByRole('button', { name: 'Fit open orders on map', exact: true }).click();
      await checkMapBounds();
      const details = page.getByRole('region', { name: 'Order progress', exact: true });
      await details.evaluate(card => { card.scrollTop = card.scrollHeight; });
      await details.getByText('Order booked', { exact: true }).waitFor();
      await details.evaluate(card => { card.scrollTop = 0; });
    }
    await search.fill('');
    if (liveMap) {
      const card = await page.locator('.shipper-tracking-card').boundingBox();
      assert.ok(card.y + card.height < page.viewportSize().height / 2, 'Combined mobile card leaves the map center accessible');
      await page.waitForTimeout(1200);
    }
    if (width === 390) await page.screenshot({ path: '/tmp/dispatra-shipper-tracking-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await nav.getByRole('link', { name: 'Orders', exact: true }).click();
    await page.getByRole('button', { name: 'View DDO-1041', exact: true }).click();
    await page.getByRole('link', { name: 'Track', exact: true }).click();
    await page.getByText('Out for delivery – your stop is next', { exact: true }).waitFor();
    await checkHeader();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: Shipper header background/alignment, persistent navigation, separate tracking, Track links, own-order search/keyboard selection/history/reload, one combined card, all open orders on map, terminal-map exclusion, all delivery states, unavailable/error/retry states and desktop/mobile bounds.');
} finally { await browser.close(); }
