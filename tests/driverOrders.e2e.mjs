// Actual Driver portal with isolated API fixtures; no operational records are changed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3016';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.E2E_OUTPUT || '/tmp/dispatra-driver-orders';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const time = '2026-11-05T16:00:00Z';
const address = text => ({ text, city: 'Vancouver', province: 'BC', postal_code: 'V6B 1A1', country: 'CA', latitude: 49.28, longitude: -123.1 });
const orders = Array.from({ length: 40 }, (_, i) => ({ id: `o${i}`, number: `DDO-${2022 + i}`, status: 'ASSIGNED', scheduled_at: time, completed_at: null, route_id: null, route_status: null, service_name: 'Same-Day Standard',
  stops: [{ id: `p${i}`, kind: 'PICKUP', address: address('350 W Georgia St, Vancouver, BC'), contact_name: 'Dock', phone: '', instructions: '' }, { id: `d${i}`, kind: 'DROPOFF', address: address('1455 Quebec St, Vancouver, BC'), contact_name: 'Recipient', phone: '', instructions: '' }],
  items: [{ quantity: 2 }] }));
const questions = Array.from({ length: 100 }, (_, i) => ({ id: `q${i}`, version: 1, order_id: `o${i % 2}`, order_number: orders[i % 2].number, prompt: `Request ${i + 1}: The booked arrival deadline has passed and arrival is not recorded. Confirm your current progress when safely stopped.`,
  choices: [{ value: 'ITEMS_NOT_READY', label: 'Items not ready' }, { value: 'WAITING_FOR_STAFF', label: 'Waiting for staff' }, { value: 'ACCESS_BLOCKED', label: 'Access blocked' }, { value: 'TRAFFIC_DELAY', label: 'Traffic delay' }, { value: 'OTHER', label: 'Another issue' }], status: 'OPEN', reason: null, details: '', estimated_ready_at: null, created_at: time, answered_at: null }));
const errors = [];
const unexpected = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  let rowCount = 2;
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path === '/api/v1/auth/me') data = { id: 'driver', role: 'DRIVER', login_id: 'driver@example.com', display_name: 'Demo Driver', organization: { id: 'acme', slug: 'acme', name: 'Acme', active: true, payment_required: false } };
    else if (path.endsWith('/driver/profile')) data = { id: 'driver', version: 1, number: 'DCO-1', name: 'Demo Driver', email: 'driver@example.com', phone: '6045550102', address: address('Vancouver'), service_city: 'Vancouver', vehicle_name: 'Cargo van', duty: null, time_zone: 'America/Vancouver' };
    else if (path.endsWith('/driver/orders')) data = orders.slice(0, rowCount);
    else if (path.endsWith('/driver/routes')) data = [];
    else if (path.endsWith('/driver/operational/questions')) data = questions;
    else if (path.endsWith('/chats')) data = [];
    else if (path.endsWith('/chat')) data = { kind: 'DISPATCH_DRIVER', title: 'Dispatch', conversation_id: null, driver_id: 'driver', unread: 0, can_send: true };
    else if (path.endsWith('/sync')) data = { cursor: '1-0', changes: [], unread: 0, unread_messages: 0, reset: false, next_poll_ms: 60000 };
    else { unexpected.push(path); return route.abort(); }
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  const checkBounds = async () => {
    const bounds = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
    assert.ok(bounds.scrollWidth <= bounds.width, JSON.stringify(bounds));
    assert.ok(bounds.scrollHeight <= bounds.height, JSON.stringify(bounds));
  };
  for (const [width, height] of [[1440, 900], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/acme/driver`);
    await page.getByText('100 pending requests · 2 orders').waitFor();
    await page.getByRole('table', { name: 'Orders', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Additional details').count(), 0);
    await checkBounds();
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.screenshot({ path: `${output}/orders-${width}.png` });
    const trigger = page.getByRole('button', { name: 'Review updates' });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Additional details').count(), 1);
    await dialog.getByLabel('Additional details').fill('Waiting at the dock');
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Request 2 of 100').waitFor();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    assert.equal(await page.getByLabel('Additional details').inputValue(), 'Waiting at the dock');
    await dialog.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: `${output}/review-${width}.png` });
    await dialog.locator('.app-dialog-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const sendBounds = await dialog.getByRole('button', { name: 'Send progress update' }).boundingBox();
    assert.ok(sendBounds.y >= 0 && sendBounds.y + sendBounds.height <= height);
    const surface = await page.locator('.app-dialog-surface').boundingBox();
    assert.ok(surface.x >= 0 && surface.y >= 0 && surface.x + surface.width <= width && surface.y + surface.height <= height);
    // Tab focus stays inside the popup, and Escape returns to the review action.
    for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement))); }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.ok(await trigger.evaluate(el => el === document.activeElement));
    await trigger.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.ok(await trigger.evaluate(el => el === document.activeElement));
    await checkBounds();
  }
  rowCount = 40;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/acme/driver`);
  await page.getByRole('button', { name: `View ${orders[39].number}`, exact: true }).waitFor({ state: 'attached' });
  const scroll = await page.evaluate(() => {
    const canvas = document.querySelector('.app-page');
    canvas.scrollTop = canvas.scrollHeight;
    return { documentHeight: document.documentElement.scrollHeight, height: innerHeight, canvasHeight: canvas.clientHeight, contentHeight: canvas.scrollHeight, scrollTop: canvas.scrollTop };
  });
  assert.equal(scroll.documentHeight, scroll.height);
  assert.ok(scroll.contentHeight > scroll.canvasHeight && scroll.scrollTop > 0);
  assert.ok(await page.getByRole('button', { name: `View ${orders[39].number}`, exact: true }).isVisible());
  await page.screenshot({ path: `${output}/orders-long.png` });
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByLabel('Phone', { exact: true }).waitFor();
  await checkBounds();
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  console.log('Driver Orders: compact queue, responsive popup, drafts, keyboard access and one scrolling canvas passed at desktop/390/320px.');
} finally { await browser.close(); }
