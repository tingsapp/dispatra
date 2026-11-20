import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.PORTAL_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const address = (text, latitude, longitude) => ({ text, latitude, longitude, city: 'Vancouver', province: 'BC', postal_code: 'V6B 1A1', country: 'CA' });
const profile = { time_zone: 'America/Vancouver', id: 'd1', version: 1, number: 'D-1', name: 'Dana Driver', email: 'dana@example.com', phone: '6045550100', address: address('Vancouver', 49.28, -123.12), service_city: 'Vancouver', vehicle_id: 'v1', vehicle_name: 'Cargo van', duty: null, location_permission: 'UNKNOWN' };
const now = new Date().toISOString();
const orders = [
  { id: 'o1', number: 'DTO-1001', scheduled_at: now, status: 'IN_PROGRESS', route_id: 'r1', route_status: 'IN_PROGRESS', completed_at: null, service_name: 'Same day', shipper: {}, items: [], stops: [
    { id: 's1', kind: 'PICKUP', address: address('100 Main Street, Vancouver', 49.28, -123.1), contact_name: 'Warehouse', phone: '6045550001', instructions: '', window_start: null, window_end: null },
    { id: 's2', kind: 'DROPOFF', address: address('200 King Street, Vancouver', 49.26, -123.09), contact_name: 'Pat', phone: '', instructions: '', window_start: null, window_end: null },
  ] },
  { id: 'o2', number: 'DTO-1002', scheduled_at: now, status: 'ASSIGNED', route_id: 'r1', route_status: 'IN_PROGRESS', completed_at: null, service_name: 'Same day', shipper: {}, items: [], stops: [
    { id: 's3', kind: 'PICKUP', address: address('300 Terminal Avenue, Vancouver', 49.27, -123.08), contact_name: 'Dock', phone: '', instructions: '', window_start: null, window_end: null },
    { id: 's4', kind: 'DROPOFF', address: address('400 Commercial Drive, Vancouver', 49.27, -123.07), contact_name: 'Chris', phone: '', instructions: '', window_start: null, window_end: null },
  ] },
];
const route = { id: 'r1', version: 1, driver_id: 'd1', vehicle_id: 'v1', created_at: now, planned_at: now, started_at: now, completed_at: null, status: 'IN_PROGRESS', generation: 1, locked: false, plan: { live_updates_supported: true }, map_origin: { latitude: 49.29, longitude: -123.12, source: 'GPS' }, items: [], stops: [orders[0].stops[0], orders[1].stops[0], orders[0].stops[1], orders[1].stops[1]].map((stop, position) => ({ id: `visit-${position}`, stop_id: stop.id, route_id: 'r1', version: 1, position, planned_at: now, created_at: now, arrived_at: null, completed_at: position === 0 ? now : null, status: position === 0 ? 'COMPLETED' : 'PLANNED', movements: {}, stop })) };
let routeUnavailable = false;
let invalidTruckProvider = false;
await page.route('**/api/v1/**', async request => {
  const path = new URL(request.request().url()).pathname;
  let result = [];
  if (path.endsWith('/auth/me')) result = { id: 'u1', login_id: profile.email, role: 'DRIVER', organization: { id: 'company', slug: 'acme', name: 'Acme Logistics', active: true } };
  else if (path.endsWith('/driver/profile')) result = profile;
  else if (path.endsWith('/driver/orders')) result = orders;
  else if (path.endsWith('/driver/routes/r1/road-path')) {
    if (routeUnavailable) return request.fulfill({ status: 503, json: { detail: 'Road routing unavailable.' } });
    result = {
      points: [[49.29, -123.12], [49.28, -123.1], [49.27, -123.08], [49.26, -123.07]],
      provider: invalidTruckProvider ? 'GOOGLE' : 'TOMTOM',
      truck_profile_applied: !invalidTruckProvider,
    };
  }
  else if (path.endsWith('/driver/routes')) result = [route];
  else if (path.endsWith('/orders/o1/chats')) result = [{ kind: 'DRIVER_SHIPPER', conversation_id: null, title: 'Fresh Test Shipper', driver_id: 'd1', can_send: true, closed_reason: null, unread: 0, last_message_at: null }];
  else if (path.endsWith('/chats/null/messages')) result = { messages: [], has_more: false };
  else if (path.endsWith('/sync')) result = { cursor: '1-0', changes: [], unread: 0, unread_messages: 0, reset: false, next_poll_ms: 60000 };
  else if (path.endsWith('/drivers/d1/chat')) result = { unread: 0, can_send: true, kind: 'DISPATCH_DRIVER', conversation_id: null };
  await request.fulfill({ json: result });
});
try {
  const roadPathResponse = page.waitForResponse(response => response.url().endsWith('/driver/routes/r1/road-path'));
  await page.goto(`${origin}/acme/driver`, { waitUntil: 'domcontentloaded' });
  assert.equal((await roadPathResponse).status(), 200);
  await page.getByRole('list', { name: "Today's stops" }).waitFor();
  await page.getByRole('img', { name: 'Vehicle current location' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Dashboard', exact: true }).count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'Today’s jobs', exact: true }).count(), 1);
  assert.equal(await page.getByText('2 orders · 4 stops · 1 completed').count(), 1);
  const timeline = page.getByRole('complementary', { name: "Today's jobs" });
  const map = page.getByRole('region', { name: "Today's order map" }).first();
  const left = await timeline.boundingBox(), right = await map.boundingBox();
  assert.ok(right.x <= left.x && right.x + right.width >= left.x + left.width, 'map extends beneath the floating timeline');
  assert.ok(left.height < right.height, 'timeline height follows its content');
  const sidebar = await page.locator('.app-workspace-sidebar').boundingBox();
  assert.ok(sidebar && Math.abs(left.y - sidebar.y) <= 1, 'jobs panel aligns with the sidebar top');
  assert.equal(await timeline.getByText('(604) 555-0001').count(), 1);
  const reportButtons = page.getByRole('button', { name: /Report issue for/ });
  assert.equal(await reportButtons.count(), 4);
  await reportButtons.first().click();
  const reportDialog = page.getByRole('dialog', { name: 'Report a stop issue' });
  await reportDialog.waitFor();
  await reportDialog.getByRole('button', { name: 'Unsafe situation' }).click();
  await reportDialog.getByLabel('Additional details (optional)').fill('Loading area is unsafe');
  await reportDialog.getByRole('button', { name: 'Send report' }).click();
  await reportDialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Stop 3: Delivery/ }).click();
  await page.getByRole('button', { name: 'Open order', exact: true }).first().click();
  const orderDialog = page.getByRole('dialog', { name: /DTO-1001/ });
  await orderDialog.waitFor();
  await orderDialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Chat with shipper for DTO-1001' }).first().click();
  const chatDialog = page.getByRole('dialog', { name: /Fresh Test Shipper/ });
  await chatDialog.waitFor();
  await chatDialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.screenshot({ path: '/tmp/driver-dashboard-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await page.waitForURL('**/acme/driver/orders');
  routeUnavailable = true;
  await page.reload();
  await page.getByRole('table', { name: 'Orders', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Dispatra, Orders', exact: true }).click();
  await page.waitForURL('**/acme/driver');
  await page.getByText('Road route unavailable. Showing the stop order.').waitFor();
  await page.locator('svg[data-shipper-route="r1"] path[stroke-dasharray="6 6"]').waitFor();
  routeUnavailable = false;
  invalidTruckProvider = true;
  await page.reload();
  await page.locator('svg[data-shipper-route="r1"] path[d]').waitFor();
  assert.equal(await page.getByText('Road route unavailable. Showing the stop order.').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('list', { name: "Today's stops" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Dispatra, Dashboard', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Workspace sidebar' }).count(), 0);
  await page.screenshot({ path: '/tmp/driver-dashboard-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Passed desktop/mobile dashboard, per-stop reporting, route geometry, navigation and Orders reload (mocked driver API).');
} finally { await browser.close(); }
