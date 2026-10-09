// Local UI acceptance against the API and a disposable PostgreSQL database.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
assert.equal(process.env.E2E_DISPOSABLE, 'true', 'Use a disposable database');
const base = `${origin}/api/v1/companies/demo`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
const headers = { Origin: origin, 'X-Requested-With': 'Dispatra' };
async function json(response) { assert.ok(response.ok(), `${response.status()} ${await response.text()}`); return response.json(); }
async function post(path, data) { return json(await context.request.post(base + path, { headers: { ...headers, 'Idempotency-Key': randomUUID() }, data })); }
try {
  await json(await context.request.post(origin + '/api/v1/auth/login', { headers, data: { portal: 'dispatch', organization: 'demo', login_id: 'dispatcher@example.com', password: '123456' } }));
  const shippers = await json(await context.request.get(base + '/shippers'));
  const catalog = await json(await context.request.get(base + '/catalog'));
  const rates = await json(await context.request.get(base + '/rate-cards'));
  const settings = await json(await context.request.get(base + '/settings'));
  const driver = (await json(await context.request.get(base + '/drivers')))[0];
  const shipper = shippers.find(row => row.warehouse);
  const service = catalog.find(row => row.code === 'SAME_DAY');
  const type = catalog.find(row => row.code === 'veh_1_ton');
  const fixed = rates.find(row => row.data.method === 'FIXED');
  const address = lat => ({ text: '123 Main Street, Vancouver, BC V5Y 1V4, Canada', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', latitude: lat, longitude: -123.11 });
  const pickup = randomUUID(), drop = randomUUID();
  const payload = { shipper_id: shipper.id, rate_card_id: fixed.id, service_id: service.id, vehicle_type_id: type.id,
    scheduled_at: new Date().toISOString(), stops: [{ id: pickup, kind: 'PICKUP', address: address(49.26) }, { id: drop, kind: 'DROPOFF', address: address(49.27) }],
    items: [{ id: randomUUID(), pickup_id: pickup, delivery_id: drop, quantity: 1, weight_kg: '10', length_cm: '20', width_cm: '20', height_cm: '20' }] };
  const order = await post('/orders', payload);
  const earlierPickup = randomUUID(), earlierDrop = randomUUID();
  await post('/orders', { ...payload, scheduled_at: new Date(Date.now() - 86400000).toISOString(),
    stops: payload.stops.map((stop, index) => ({ ...stop, id: index ? earlierDrop : earlierPickup })),
    items: payload.items.map(item => ({ ...item, id: randomUUID(), pickup_id: earlierPickup, delivery_id: earlierDrop })) });
  const data = { name: driver.name, email: driver.email, phone: driver.phone, address: driver.address, vehicle_id: driver.vehicle_id, ...driver.data };
  await json(await context.request.put(base + `/drivers/${driver.id}`, { headers: { ...headers, 'Idempotency-Key': randomUUID() }, data: { version: driver.version, data, duty_status: 'ON_DUTY', expected_on_duty: driver.on_duty } }));
  await post(`/orders/${order.id}/assign`, { version: order.version, driver_id: driver.id, vehicle_id: driver.vehicle_id, planned_at: order.scheduled_at });
  const assigned = await json(await context.request.get(base + `/orders/${order.id}`));
  await post(`/orders/${order.id}/complete`, { version: assigned.version });
  await page.goto(origin + '/demo/analytics', { waitUntil: 'domcontentloaded' });
  await page.getByRole('region', { name: 'Orders, drivers & shippers' }).waitFor();
  const report = await json(await context.request.get(base + '/analytics'));
  assert.equal(await page.getByLabel('Analytics summary').locator('dd').first().textContent(), String(report.orders));
  await page.waitForFunction(() => document.querySelectorAll('.recharts-surface').length === 3);
  for (const title of ['Delivery performance', 'Orders, drivers & shippers', 'Order sources']) {
    const box = await page.getByRole('region', { name: title }).locator('.recharts-surface').boundingBox();
    assert.ok(box.width > 100 && box.height > 100, `${title} must have visible chart geometry`);
  }
  assert.equal(await page.getByText(/billing|revenue|surcharges/i).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Export CSV' }).count(), 0);
  assert.equal(await page.getByRole('table', { name: 'Analytics orders' }).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Order volume' }).count(), 0);
  const activity = page.getByRole('region', { name: 'Orders, drivers & shippers' });
  const performance = page.getByRole('region', { name: 'Delivery performance' });
  const donutBox = await performance.boundingBox(), lineBox = await activity.boundingBox();
  const gap = lineBox.x - (donutBox.x + donutBox.width);
  assert.ok(Math.abs(lineBox.y - donutBox.y) < 1, 'Donut and line chart share the desktop row');
  assert.ok(Math.abs(lineBox.width - (2 * donutBox.width + gap)) < 2, 'Desktop panels use 4/12 and 8/12 widths');
  assert.equal(await performance.locator('.recharts-pie-sector path').count(), 1);
  assert.equal(await performance.locator('.absolute').textContent(), String(report.completed_orders) + 'completed');
  await performance.screenshot({ path: '/tmp/dispatra-donut-desktop.png' });
  assert.equal(await activity.locator('.recharts-line-curve').count(), 3);
  assert.equal(await activity.locator('circle').count(), 0);
  assert.equal(await activity.locator('.recharts-line-curve[stroke-dasharray]').count(), 0);
  await activity.locator('.recharts-surface').hover();
  assert.equal(await activity.locator('circle').count(), 0);
  await activity.screenshot({ path: '/tmp/dispatra-activity-desktop.png' });
  assert.equal(report.rows.find(row => row.id === order.id).driver_id, driver.id);
  assert.equal(report.rows.find(row => row.id === order.id).shipper_id, shipper.id);
  assert.equal(await page.getByRole('region', { name: 'Order sources' }).locator('.recharts-bar-rectangle path').first().getAttribute('fill'), '#000000');
  await page.evaluate(() => { document.querySelector('.app-page').scrollTop = 0; });
  await page.screenshot({ path: '/tmp/dispatra-analytics-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('.app-page').scrollTop = 0; });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '/tmp/dispatra-analytics-mobile.png', fullPage: true });
  await activity.screenshot({ path: '/tmp/dispatra-activity-mobile.png' });
  await performance.screenshot({ path: '/tmp/dispatra-donut-mobile.png' });
  const mobileDonut = await performance.boundingBox(), mobileLine = await activity.boundingBox();
  assert.ok(mobileLine.y > mobileDonut.y + mobileDonut.height, 'Mobile charts stack');
  assert.ok(Math.abs(mobileLine.width - mobileDonut.width) < 1);
  await page.getByRole('button', { name: /^Filter analytics by date:/ }).click();
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click();
  await activity.getByText('No orders for these dates').waitFor();
  await performance.getByText('No completed deliveries yet').waitFor();
  assert.equal(await performance.locator('.recharts-pie-sector').count(), 0);
  assert.equal(await page.getByRole('button', { name: `Open order ${order.number}` }).count(), 0);
  await page.getByRole('button', { name: /^Filter analytics by date:/ }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await activity.locator('.recharts-line-curve').first().waitFor({ state: 'attached' });
  assert.equal(await activity.locator('.recharts-line-curve').count(), 3, 'Single-date values remain visible without dots');
  assert.equal(await activity.locator('circle').count(), 0);
  await activity.screenshot({ path: '/tmp/dispatra-solid-line-single-date.png' });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: three real API charts, performance donut, 4/12 and 8/12 desktop widths, mobile stacking and date filtering.');
} finally { await browser.close(); }
