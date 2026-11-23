import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/driver/orders', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLCanvasElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof typeof dom.window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, waitFor, within, fireEvent, act } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { chat } = await import('../src/chat/api');
const { api } = await import('../src/portal/api');
api.driverOperationalQuestions = async () => [];
const { DriverPortal } = await import('../src/portal/DriverPortal');
const { ProofOfDelivery } = await import('../src/components/orders/ProofOfDelivery');
afterEach(() => { cleanup(); history.replaceState(null, '', '/acme/driver/orders'); });

const address = (text: string) => ({ text, city: 'Vancouver', province: 'BC', postal_code: 'V6B 1A1', country: 'CA', latitude: 49.28, longitude: -123.1 });
const duty = { id: 'duty-1', version: 1, created_at: '2026-10-02T08:00:00Z', driver_id: 'd1', started_at: '2026-10-02T08:00:00Z', ended_at: null };
const profile = (online: boolean) => ({ time_zone: 'America/Vancouver', id: 'd1', version: 3, number: 'DCO-0001', name: 'Dana Driver', email: 'dana@example.com', phone: '6045550102', address: address('1 Driver St, Vancouver'), service_city: 'Vancouver', vehicle_id: 'v1', vehicle_name: 'Test Van · TEST123', duty: online ? duty : null, location_permission: 'GRANTED' });
const order = { id: 'o1', number: 'DCO-1001', shipper: { name: 'Alice Shipper', company_name: 'Fresh Test', phone: '6045550101', email: 'alice@example.com' }, status: 'ASSIGNED', scheduled_at: '2026-10-02T16:00:00Z', completed_at: null, route_id: 'r1', route_status: 'PLANNED', service_name: 'Same day',
  stops: [{ id: 's1', kind: 'PICKUP', address: address('100 Main St, Vancouver'), contact_name: 'Dock', phone: '6045550000', instructions: '', window_start: null, window_end: null, unattended_allowed: false, photo_required: false },
    { id: 's2', kind: 'DROPOFF', address: address('200 King St, Vancouver'), contact_name: 'Pat', phone: '', instructions: 'Ring bell', window_start: null, window_end: null, unattended_allowed: false, photo_required: false }],
  items: [{ id: 'i1', pickup_id: 's1', delivery_id: 's2', quantity: 2, weight_kg: '5', length_cm: '10', width_cm: '10', height_cm: '10', pallets: 0, fragile: false, dangerous_goods: false, description: 'Boxes' }] };
const route = { id: 'r1', version: 1, created_at: '2026-10-02T08:00:00Z', driver_id: 'd1', vehicle_id: 'v1', status: 'PLANNED', locked: false, generation: 1, planned_at: '2026-10-02T08:00:00Z', started_at: null, completed_at: null, plan: {}, items: order.items,
  stops: order.stops.map((stop, position) => ({ id: `v${position}`, version: 1, created_at: '2026-10-02T08:00:00Z', route_id: 'r1', stop_id: stop.id, position, status: 'PLANNED', planned_at: '2026-10-02T08:00:00Z', arrived_at: null, completed_at: null, movements: {}, stop })) };

// Infinite cache lifetimes leave no garbage-collection timers holding the test process open.
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
const calls: string[] = [];
let online = false;
const stub = (name: string, value: unknown) => Object.assign(operations, { [name]: async (...args: unknown[]) => { calls.push(name); return typeof value === 'function' ? (value as (...a: unknown[]) => unknown)(...args) : value; } });
stub('driverProfile', () => profile(online));
// Order details include the order chat; an empty channel list keeps these tests about stop execution.
Object.assign(chat, { channels: async () => [], inbox: async () => [], companyChannel: async () => ({kind:'DISPATCH_DRIVER',title:'Company',conversation_id:null,driver_id:'d1',unread:0,can_send:true,closed_reason:null,last_message_at:null}) });
stub('driverOrders', [order]);
stub('sync', { cursor: '1-0', changes: [], unread: 0, reset: false, next_poll_ms: 60_000 });
stub('driverRoutes', [route]);
stub('startRoute', route);
stub('endDuty', () => { online = false; return duty; });
stub('updateDriverProfile', (_slug: unknown, version: unknown, phone: unknown) => ({ ...profile(online), version: Number(version) + 1, phone }));
const mount = () => render(React.createElement(QueryClientProvider, { client: client() },
  React.createElement(DriverPortal, { slug: 'acme', company: 'Acme Logistics', login: 'dana@example.com', onLogout: () => calls.push('logout'), loggingOut: false, logoutError: null })));

test('company timezone controls driver list and stop dates when the browser is in Pakistan', async () => {
  const user = userEvent.setup({ document });
  const scheduled = { ...order, scheduled_at: '2026-10-20T19:30:00Z', stops: order.stops.map((stop, i) => ({ ...stop, window_start: i === 0 ? '2026-10-20T19:30:00Z' : null, window_end: i === 1 ? '2026-10-21T01:00:00Z' : null })) };
  stub('driverOrders', [scheduled]);
  try {
    mount();
    const row = (await screen.findByText(order.number)).closest('tr')!;
    assert.match(row.textContent!, /Oct 20, 2026, 12:30/);
    assert.match(row.textContent!, /Deliver by Oct 20, 2026, 18:00/);
    assert.doesNotMatch(row.textContent!, /Oct 21/);
    await user.click(row);
    const dialog = await screen.findByRole('dialog');
    assert.match(dialog.textContent!, /Ready from Oct 20, 2026, 12:30/);
    assert.match(dialog.textContent!, /Deliver\s+by Oct 20, 2026, 18:00/);
  } finally { stub('driverOrders', [order]); }
});

test('missing company timezone waits for the profile instead of displaying browser times', async () => {
  stub('driverProfile', () => ({ ...profile(false), time_zone: undefined }));
  try {
    mount();
    assert.ok(await screen.findByText('Loading company time zone…'));
    assert.equal(screen.queryByRole('table', { name: 'Orders' }), null);
  } finally { stub('driverProfile', () => profile(online)); }
});

test('driver sidebar lists Orders, Chat and Profile and ends with a Logout card above the duty switch', async () => {
  const user = userEvent.setup({ document }); online = true; calls.length = 0;
  mount();
  const nav = screen.getByRole('navigation', { name: 'Portal navigation' });
  assert.deepEqual(within(nav).getAllByRole('link').map(link => link.getAttribute('aria-label')), ['Orders', 'Chat', 'Profile']);
  assert.equal(screen.queryByText('My routes'), null);
  assert.equal(screen.queryByRole('button', { name: /Driver account/ }), null);
  const toggle = await screen.findByRole('switch', { name: 'Duty status' });
  await waitFor(() => assert.equal(toggle.getAttribute('aria-checked'), 'true'));
  const header = screen.getByRole('banner', { name: 'Workspace header' });
  const bell = within(header).getByRole('button', { name: 'Notifications' });
  await user.click(toggle);
  await waitFor(() => assert.ok(calls.includes('endDuty')));
  await waitFor(() => assert.equal(screen.getByRole('switch', { name: 'Duty status' }).getAttribute('aria-checked'), 'false'));
  assert.ok(screen.getByText('Off duty'));
  await user.click(within(nav).getByRole('link', { name: 'Profile' }));
  assert.ok(await screen.findByRole('heading', { name: 'Profile' }));
  assert.equal(screen.getByRole('banner', { name: 'Workspace header' }), header);
  assert.equal(within(header).getByRole('button', { name: 'Notifications' }), bell);
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  assert.ok(calls.includes('logout'));
});

test('driver orders list opens an order with its stops; starting the route needs the driver On Duty', async () => {
  const user = userEvent.setup({ document }); online = false;
  mount();
  const row = (await screen.findByText('DCO-1001')).closest('tr')!;
  assert.ok(screen.getByRole('columnheader', { name: 'Pickup → Delivery' }));
  assert.ok(within(row).getByText('Assigned')); assert.ok(within(row).getByText('2 pieces'));
  await user.click(row);
  assert.ok(await screen.findByText(/200 King St/, { selector: 'p' }));
  assert.ok(screen.getByText('Instructions: Ring bell'));
  const start = await screen.findByRole('button', { name: 'Start route' });
  assert.equal((start as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByText(/Go On Duty from the sidebar switch/));
  await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  assert.equal(screen.queryByRole('dialog'), null);
});

test('order execution reports use the same progress badges as the dashboard', async () => {
  const user = userEvent.setup({ document });
  const original = operations.reportStopIssue;
  const executingRoute = { ...route, status: 'IN_PROGRESS', started_at: new Date().toISOString(), plan: { live_updates_supported: true } };
  stub('driverRoutes', [executingRoute]);
  let submitted: unknown[] = [];
  stub('reportStopIssue', (...args: unknown[]) => { submitted = args; return { id: 'issue-2' }; });
  try {
    mount();
    const row = (await screen.findByText('DCO-1001')).closest('tr')!;
    await user.click(row);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Report issue' }));
    const itemsNotReady = within(dialog).getByRole('button', { name: 'Items not ready' });
    assert.equal(itemsNotReady.getAttribute('data-size'), 'xs');
    await user.click(itemsNotReady);
    await user.click(within(dialog).getByRole('button', { name: 'Submit issue' }));
    await waitFor(() => assert.deepEqual(submitted, ['acme', 's1', 'OTHER', 'Items not ready']));
  } finally {
    operations.reportStopIssue = original;
    stub('driverRoutes', [route]);
  }
});

test('location sharing starts from Start route and stops locally even when End Duty fails', { timeout: 15_000 }, async () => {
  const user = userEvent.setup({ document }); online = true; calls.length = 0;
  let sample = 0;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => {
    calls.push('position');
    success({ timestamp: ++sample, coords: { latitude: 49.28, longitude: -123.1, accuracy: 10 } } as GeolocationPosition);
  } } });
  stub('driverLocation', (_slug: unknown, _duty: unknown, here: unknown) => {
    assert.equal((here as GeolocationPosition).timestamp, 1);
    return {};
  });
  stub('endDuty', () => { throw new Error('Connection unavailable'); });
  try {
    mount();
    assert.equal(calls.includes('position'), false);
    const row = (await screen.findByText('DCO-1001')).closest('tr')!;
    await user.click(row);
    await user.click(await screen.findByRole('button', { name: 'Start route' }));
    await waitFor(() => assert.equal(calls.filter(call => call === 'driverLocation').length, 1));
    assert.equal(calls.includes('startDuty'), false, 'reuse dispatcher-started duty after driver opts in');
    await user.click(screen.getByRole('switch', { name: 'Duty status' }));
    await screen.findByRole('alert');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(calls.filter(call => call === 'driverLocation').length, 1, 'going Off Duty must not trigger another upload');
  } finally {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    stub('endDuty', () => { online = false; return duty; });
  }
});

test('driver profile has Details and Security tabs and saves only the phone', async () => {
  const user = userEvent.setup({ document }); online = false; calls.length = 0;
  history.replaceState(null, '', '/acme/driver/profile');
  mount();
  assert.ok(screen.getByRole('button', { name: 'Details' })); assert.ok(screen.getByRole('button', { name: 'Security' }));
  const phone = await screen.findByLabelText('Phone');
  assert.equal((phone as HTMLInputElement).value, '(604) 555-0102');
  assert.equal((screen.getByLabelText('Email') as HTMLInputElement).readOnly, true);
  assert.equal((screen.getByLabelText('Vehicle') as HTMLInputElement).value, 'Test Van · TEST123');
  await user.clear(phone); await user.type(phone, '6045550199');
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  assert.ok(await screen.findByText('Profile saved.'));
  assert.ok(calls.includes('updateDriverProfile'));
  await user.click(screen.getByRole('button', { name: 'Security' }));
  assert.ok(screen.getByRole('heading', { name: 'Change password' }));
});

test('proof of delivery shows the signature image, or that a dispatcher completed the order without proof', async () => {
  stub('deliveryProof', (_slug: unknown, id: unknown) => id === 'signed'
    ? [{ stop_id: 's2', address: address('200 King St, Vancouver'), completed_at: '2026-10-02T18:00:00Z', recipient_name: 'Pat', unattended: false, completed_by_dispatcher: false, evidence: [{ id: 'e1', kind: 'SIGNATURE', captured_at: '2026-10-02T17:59:00Z' }] }]
    : [{ stop_id: 's3', address: address('300 Oak St, Vancouver'), completed_at: '2026-10-02T18:00:00Z', recipient_name: '', unattended: false, completed_by_dispatcher: true, evidence: [] }]);
  const wrap = (orderId: string) => React.createElement(QueryClientProvider, { client: client() }, React.createElement(ProofOfDelivery, { slug: 'acme', orderId, timeZone: 'America/Vancouver' }));
  render(wrap('signed'));
  const image = await screen.findByRole('img', { name: /Signature for 200 King St/ });
  assert.equal(image.getAttribute('src'), '/api/v1/companies/acme/evidence/e1');
  assert.ok(screen.getByText('Received by Pat'));
  cleanup(); render(wrap('manual'));
  assert.ok(await screen.findByText('Completed by dispatcher – no proof of delivery'));
  assert.equal(screen.queryByRole('img'), null);
});

test('order tracking shows the shipment stage, ETA, timeline and when live location appears', async () => {
  const { OrderTracking, trackingHeadline } = await import('../src/components/orders/OrderTracking');
  const base = { order_id: 'o1', status: 'IN_PROGRESS', dedicated: false, driver: { first_name: 'Dana', vehicle_type: 'Cargo van' }, delay_minutes: 0, late: false, live: false, location: null, location_stale: false, open_issue: false, updated_at: '2026-10-03T18:00:00Z',
    stops: [{ id: 's1', kind: 'PICKUP', address: address('100 Main St, Vancouver'), window_start: null, window_end: null, planned_at: '2026-10-03T17:00:00Z', eta: null, arrived_at: '2026-10-03T17:01:00Z', completed_at: '2026-10-03T17:05:00Z', status: 'COMPLETED' },
      { id: 's2', kind: 'DROPOFF', address: address('200 King St, Vancouver'), window_start: null, window_end: null, planned_at: '2026-10-03T18:20:00Z', eta: '2026-10-03T18:25:00Z', arrived_at: null, completed_at: null, status: 'PLANNED' }],
    events: [{ kind: 'BOOKED', label: 'Order booked', at: '2026-10-03T15:00:00Z' }, { kind: 'PICKUP_COMPLETED', label: 'Picked up · 100 Main St, Vancouver', at: '2026-10-03T17:05:00Z' }] };
  const view = { ...base, stage: 'IN_TRANSIT', stops_before_next: 2, eta: '2026-10-03T18:25:00Z' } as never;
  assert.equal(trackingHeadline(view, 'America/Vancouver'), 'Picked up · 2 stops before your delivery');
  assert.equal(trackingHeadline({ ...base, stage: 'OUT_FOR_DELIVERY', stops_before_next: 0, eta: null } as never, 'UTC'), 'Out for delivery – your stop is next');
  stub('orderTracking', view);
  render(React.createElement(QueryClientProvider, { client: client() }, React.createElement(OrderTracking, { slug: 'acme', orderId: 'o1', timeZone: 'America/Vancouver', version: 3 })));
  assert.ok(await screen.findByText('Picked up · 2 stops before your delivery'));
  assert.ok(screen.getByText('Delivery ETA')); assert.ok(screen.getByText('Driver Dana · Cargo van'));
  assert.equal(screen.getByRole('list', { name: 'Shipment progress' }).querySelector('[aria-current="step"]')?.textContent, 'On the way');
  assert.ok(screen.getByText(/Live location appears when the driver is heading to your stop/));
  assert.ok(screen.getByText('Picked up · 100 Main St, Vancouver'));
  assert.equal(screen.getByRole('img', { name: /Map of the pickup/ }).getAttribute('src'), '/api/v1/companies/acme/orders/o1/tracking/map?v=3&at=');
  cleanup(); let opened = 0;
  stub('orderTracking', { ...base, stage: 'OUT_FOR_DELIVERY', stops_before_next: 0, eta: '2026-10-03T18:25:00Z', live: true, location: { latitude: 49.26012, longitude: -123.11, accuracy_m: 5, captured_at: '2026-10-03T18:00:00Z' } });
  render(React.createElement(QueryClientProvider, { client: client() }, React.createElement(OrderTracking, { slug: 'acme', orderId: 'o1', timeZone: 'UTC', version: 3, onOpenMap: () => { opened++; } })));
  const map = await screen.findByRole('img', { name: /Map of the pickup/ });
  assert.equal(map.getAttribute('src'), '/api/v1/companies/acme/orders/o1/tracking/map?v=3&at=49.2601%2C-123.1100');
  fireEvent.click(screen.getByRole('button', { name: 'Open on Monitor' })); assert.equal(opened, 1);
});

test('driver login home opens today’s jobs and stop map, with Orders remaining a separate page', async () => {
  const user = userEvent.setup({ document });
  const todayOrder = { ...order, scheduled_at: new Date().toISOString() };
  const tomorrowOrder = { ...order, id: 'tomorrow', number: 'DCO-TOMORROW', scheduled_at: new Date(Date.now() + 86_400_000).toISOString() };
  const yesterdayOrder = { ...order, id: 'yesterday', number: 'DCO-YESTERDAY', scheduled_at: new Date(Date.now() - 86_400_000).toISOString() };
  stub('driverOrders', [todayOrder, tomorrowOrder, yesterdayOrder]);
  history.replaceState(null, '', '/acme/driver');
  calls.length = 0;
  try {
    mount();
    assert.ok(screen.getByRole('heading', { name: 'Dashboard' }));
    assert.ok(screen.getByRole('heading', { name: 'Today’s jobs' }));
    const timeline = await screen.findByRole('list', { name: "Today's stops" });
    assert.equal(within(timeline).getAllByRole('listitem').length, 2);
    assert.ok(screen.getByText('1 order · 2 stops · 0 completed'));
    assert.equal(screen.queryByText('DCO-TOMORROW'), null);
    assert.equal(screen.queryByText('DCO-YESTERDAY'), null);
    assert.ok(screen.getByRole('region', { name: "Today's order map" }));
    assert.ok(screen.getByText('Map is unavailable. All stops are listed in the timeline.'));
    assert.ok(screen.getByRole('button', { name: /Stop 1: Pickup/ }).getAttribute('aria-pressed') === 'true');
    assert.ok(screen.getByText('Dock'));
    assert.ok(screen.getByRole('link', { name: '(604) 555-0000' }));
    assert.equal(within(timeline).getAllByRole('button', { name: /Message shipper for/ }).length, 2);
    assert.equal(within(timeline).getAllByRole('button', { name: 'Start' }).length, 1, 'only the route’s next stop carries its step');
    assert.equal((within(timeline).getByRole('button', { name: 'Upload POD for Delivery DCO-1001' }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole('button', { name: /Stop 2: Delivery/ }));
    assert.equal(screen.getByRole('button', { name: /Stop 2: Delivery/ }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(within(timeline).getAllByRole('button', { name: /Report issue for/ }).map(button => (button as HTMLButtonElement).disabled), [true, true], 'reports wait for the route to start');
    await user.click(screen.getAllByRole('button', { name: 'Open order' })[0]);
    assert.ok(await screen.findByRole('dialog'));
    assert.equal(calls.includes('position'), false, 'opening the dashboard must not start device tracking');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.click(screen.getByRole('link', { name: 'Orders' }));
    assert.equal(location.pathname, '/acme/driver/orders');
    assert.ok(await screen.findByRole('table', { name: 'Orders' }));
    await user.click(screen.getByRole('button', { name: 'Dispatra, Orders' }));
    assert.equal(location.pathname, '/acme/driver');
    assert.ok(await screen.findByRole('list', { name: "Today's stops" }));
  } finally { stub('driverOrders', [order]); }
});

test('the order’s next stop reports several reasons at once in a popup', async () => {
  const user = userEvent.setup({ document });
  const original = operations.reportStopIssue;
  let submitted: unknown[] = [];
  stub('reportStopIssue', (...args: unknown[]) => { submitted = args; return { id: 'issue-1' }; });
  stub('driverOrders', [{ ...order, scheduled_at: new Date().toISOString() }]);
  stub('driverRoutes', [{ ...route, status: 'IN_PROGRESS', started_at: new Date().toISOString(), plan: { live_updates_supported: true } }]);
  history.replaceState(null, '', '/acme/driver');
  try {
    mount();
    const timeline = await screen.findByRole('list', { name: "Today's stops" });
    await waitFor(() => assert.equal((within(timeline).getByRole('button', { name: 'Report issue for Pickup DCO-1001' }) as HTMLButtonElement).disabled, false));
    assert.equal((within(timeline).getByRole('button', { name: 'Report issue for Delivery DCO-1001' }) as HTMLButtonElement).disabled, true, 'only the order’s next stop can report');
    const reportButton = within(timeline).getAllByRole('button').find(button => button.textContent?.trim() === 'Report');
    assert.ok(reportButton);
    await user.click(reportButton);
    const dialog = await screen.findByRole('dialog');
    assert.ok(within(dialog).getByRole('heading', { name: 'Report a stop issue' }));
    const unsafe = within(dialog).getByRole('button', { name: 'Unsafe situation' });
    assert.equal(unsafe.getAttribute('data-size'), 'xs');
    await user.click(within(dialog).getByRole('button', { name: 'Items not ready' }));
    await user.click(unsafe);
    await user.click(within(dialog).getByRole('button', { name: 'Traffic delay' }));
    await user.click(within(dialog).getByRole('button', { name: 'Traffic delay' }));
    assert.deepEqual(within(dialog).getAllByRole('button', { pressed: true }).map(button => button.textContent), ['Items not ready', 'Unsafe situation']);
    await user.click(within(dialog).getByRole('button', { name: 'Another issue' }));
    assert.equal((within(dialog).getByRole('button', { name: 'Send report' }) as HTMLButtonElement).disabled, true, 'Another issue needs details');
    await user.type(within(dialog).getByRole('textbox', { name: /Additional details/ }), 'The gate is blocked');
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
    assert.deepEqual(submitted, ['acme', 's1', 'UNSAFE', 'Items not ready; Unsafe situation; Another issue\n\nThe gate is blocked']);
  } finally { operations.reportStopIssue = original; stub('driverOrders', [order]); stub('driverRoutes', [route]); }
});

test('stop actions run the driver app’s route step: Start, Navigate, confirm arrival nearby and confirm loading', async () => {
  const user = userEvent.setup({ document }); online = true; calls.length = 0;
  const today = { ...order, scheduled_at: new Date().toISOString() };
  const started = { ...route, status: 'IN_PROGRESS', started_at: new Date().toISOString(), plan: { live_updates_supported: true } };
  let current: Record<string, unknown> = route;
  let here = { latitude: 49.2, longitude: -123.0 };
  const opened: string[] = [];
  const tab = { opener: {}, location: { href: '' }, close: () => opened.push('closed') };
  const originalOpen = window.open, originalInterval = window.setInterval;
  const fixes: (() => void)[] = [];
  window.setInterval = ((fn: () => void, ms: number) => { if (ms === 15_000) fixes.push(fn); return 0; }) as typeof window.setInterval;
  window.open = ((url?: string) => { opened.push(url ?? ''); return tab; }) as unknown as typeof window.open;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) =>
    success({ timestamp: Date.now(), coords: { ...here, accuracy: 10 } } as GeolocationPosition) } });
  stub('driverOrders', [today]);
  stub('driverRoutes', () => [current]);
  stub('driverLocation', {});
  stub('startRoute', () => { current = started; return started; });
  stub('arriveStop', (_slug: unknown, _route: unknown, visitId: unknown) => {
    current = { ...started, stops: started.stops.map(visit => visit.id === visitId ? { ...visit, arrived_at: new Date().toISOString() } : visit) };
    return current;
  });
  let loaded: unknown;
  stub('completeStop', (_slug: unknown, _route: unknown, visitId: unknown, body: unknown) => { loaded = [visitId, body]; return current; });
  history.replaceState(null, '', '/acme/driver');
  try {
    mount();
    const timeline = await screen.findByRole('list', { name: "Today's stops" });
    await user.click(await within(timeline).findByRole('button', { name: 'Start' }));
    await waitFor(() => assert.ok(calls.includes('startRoute')));
    const navigate = await within(timeline).findByRole('button', { name: 'Navigate to pickup' });
    assert.equal(calls.filter(call => call === 'driverLocation').length, 1, 'Start shares location once');
    await user.click(navigate);
    await waitFor(() => assert.match(tab.location.href, /google\.com\/maps\/dir\/.*destination=200%20King.*waypoints=100%20Main/));
    assert.equal(calls.filter(call => call === 'driverLocation').length, 1, 'Navigate reuses the sharing already started');

    here = { latitude: 49.28, longitude: -123.1 };
    // The next 15 s fix puts the driver within 100 m of the pickup.
    await act(async () => { fixes.at(-1)!(); await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.click(await within(timeline).findByRole('button', { name: 'Confirm pickup arrival' }));
    await waitFor(() => assert.ok(calls.includes('arriveStop')));
    const pickup = await within(timeline).findByRole('button', { name: 'Navigate to destination' });
    assert.ok(within(timeline).getByText('Tapping Navigate confirms all items at this pickup are loaded.'));
    await user.click(pickup);
    await waitFor(() => assert.deepEqual(loaded, ['v0', { quantities: { i1: 2 }, recipient_name: '', unattended: false, safe_placement: false, evidence_ids: [] }]));

    assert.equal(tab.location.href.includes('100%20Main'), false, 'directions after loading skip the completed pickup');
  } finally {
    window.open = originalOpen; window.setInterval = originalInterval; online = false;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    stub('driverOrders', [order]); stub('driverRoutes', [route]); stub('startRoute', route);
  }
});

test('an arrived delivery uploads POD from its stop; a completed delivery shows POD submitted', async () => {
  const user = userEvent.setup({ document });
  const at = new Date().toISOString();
  const arrived = { ...route, status: 'IN_PROGRESS', started_at: at, plan: { live_updates_supported: true },
    stops: [{ ...route.stops[0], status: 'COMPLETED', arrived_at: at, completed_at: at }, { ...route.stops[1], arrived_at: at }] };
  stub('driverOrders', [{ ...order, scheduled_at: at }]);
  stub('driverRoutes', [arrived]);
  stub('stopEvidence', []);
  history.replaceState(null, '', '/acme/driver');
  try {
    mount();
    const timeline = await screen.findByRole('list', { name: "Today's stops" });
    const pod = await within(timeline).findByRole('button', { name: 'Upload POD for Delivery DCO-1001' });
    await waitFor(() => assert.equal((pod as HTMLButtonElement).disabled, false));
    assert.equal(within(timeline).queryByRole('button', { name: 'Report issue for Pickup DCO-1001' }), null, 'completed stops cannot report');
    assert.equal((within(timeline).getByRole('button', { name: 'Complete' }) as HTMLButtonElement).disabled, true, 'Complete waits for the POD');
    await user.click(pod);
    const dialog = await screen.findByRole('dialog', { name: /Upload POD/ });
    assert.ok(within(dialog).getByRole('textbox', { name: 'Recipient name' }));
    assert.equal((within(dialog).getByRole('button', { name: 'Confirm delivery' }) as HTMLButtonElement).disabled, true);
    assert.equal(within(dialog).queryByRole('button', { name: 'Report issue' }), null);
    cleanup();
    stub('driverRoutes', [{ ...arrived, stops: arrived.stops.map(visit => ({ ...visit, status: 'COMPLETED', completed_at: at })) }]);
    mount();
    const done = await screen.findByRole('list', { name: "Today's stops" });
    assert.ok(await within(done).findByText('POD submitted'));
    assert.ok(within(done).getByRole('button', { name: 'Complete' }));
  } finally { stub('driverOrders', [order]); stub('driverRoutes', [route]); }
});

test('driver route step mirrors the driver app, including the 100 m arrival check', async () => {
  const { driverRouteStep, stepHere, isCurrentStopNearby, issueReady, podReady } = await import('../src/portal/driverStopStep');
  type R = Parameters<typeof driverRouteStep>[0] & {};
  const at = '2026-10-02T09:00:00Z', now = Date.parse('2026-10-02T09:10:00Z');
  const planned = route as unknown as R;
  const running = { ...route, status: 'IN_PROGRESS', plan: { live_updates_supported: true } } as unknown as R;
  const near = { timestamp: now - 5_000, coords: { latitude: 49.2804, longitude: -123.1, accuracy: 20 } };
  assert.equal(driverRouteStep(planned)?.title, 'Start');
  assert.ok(stepHere(driverRouteStep(planned), planned, planned.stops[0]));
  assert.equal(stepHere(driverRouteStep(planned), planned, planned.stops[1]), false);
  assert.equal(driverRouteStep(running, null, now)?.title, 'Navigate to pickup');
  assert.equal(driverRouteStep(running, near, now)?.title, 'Confirm pickup arrival');
  assert.equal(isCurrentStopNearby(running, { ...near, coords: { ...near.coords, accuracy: 80 } }, now), false, 'inaccurate fix');
  assert.equal(isCurrentStopNearby(running, { ...near, timestamp: now - 31_000 }, now), false, 'stale fix');
  assert.equal(isCurrentStopNearby(running, { ...near, coords: { ...near.coords, latitude: 49.282 } }, now), false, 'over 100 m');
  assert.equal(driverRouteStep({ ...running, plan: { requires_acknowledgement: true, live_updates_supported: true } } as R)?.kind, 'sync');
  const atPickup = { ...running, stops: [{ ...running.stops[0], arrived_at: at }, running.stops[1]] } as R;
  assert.deepEqual([driverRouteStep(atPickup)?.kind, driverRouteStep(atPickup)?.title], ['pickup', 'Navigate to destination']);
  assert.ok(issueReady(atPickup, atPickup.stops[0], order as never));
  assert.equal(issueReady(atPickup, atPickup.stops[1], order as never), false);
  const atDelivery = { ...running, stops: [{ ...running.stops[0], status: 'COMPLETED', arrived_at: at }, { ...running.stops[1], arrived_at: at }] } as R;
  assert.deepEqual([driverRouteStep(atDelivery)?.title, driverRouteStep(atDelivery)?.disabled], ['Complete', true]);
  assert.ok(podReady(atDelivery, atDelivery.stops[1]));
  assert.equal(podReady(atPickup, atPickup.stops[1]), false);
  const delivered = { ...atDelivery, stops: atDelivery.stops.map(visit => ({ ...visit, status: 'COMPLETED' })) } as R;
  assert.deepEqual([driverRouteStep(delivered)?.title, driverRouteStep(delivered)?.disabled], ['Complete', undefined]);
  assert.ok(stepHere(driverRouteStep(delivered), delivered, delivered.stops[1]));
});

test('each dashboard stop opens its shipper conversation', async () => {
  const user = userEvent.setup({ document });
  const originalChannels = chat.channels;
  chat.channels = async () => [{ kind: 'DRIVER_SHIPPER', conversation_id: null, title: 'Fresh Test Shipper', driver_id: 'd1', can_send: true, closed_reason: null, unread: 0, last_message_at: null }];
  stub('driverOrders', [{ ...order, scheduled_at: new Date().toISOString() }]);
  history.replaceState(null, '', '/acme/driver');
  try {
    mount();
    const timeline = await screen.findByRole('list', { name: "Today's stops" });
    await user.click(within(timeline).getAllByRole('button', { name: /Message shipper for/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: /Fresh Test Shipper/ });
    assert.ok(within(dialog).getByText(/No messages yet\. Write to Fresh Test Shipper/));
  } finally { chat.channels = originalChannels; stub('driverOrders', [order]); }
});

test('driver dashboard exposes empty and recoverable error states', async () => {
  history.replaceState(null, '', '/acme/driver');
  stub('driverOrders', []);
  try {
    mount();
    assert.ok(await screen.findByText('No orders today'));
    cleanup();
    stub('driverOrders', () => { throw new Error('Orders connection unavailable'); });
    mount();
    assert.ok(await screen.findByRole('alert'));
    stub('driverOrders', []);
    await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Try again' }));
    assert.ok(await screen.findByText('No orders today'));
  } finally { stub('driverOrders', [order]); }
});

test('driver day plan uses company midnight and authoritative interleaved route stops', async () => {
  const { driverDayPlan, driverStopStatus } = await import('../src/portal/driverDayPlan');
  const first = { ...order, scheduled_at: '2026-07-01T17:00:00Z' };
  const second = { ...first, id: 'o2', number: 'DCO-1002', stops: first.stops.map(stop => ({ ...stop, id: `two-${stop.id}` })) };
  const future = { ...first, id: 'future', scheduled_at: '2026-07-02T07:00:00Z' };
  const past = { ...first, id: 'past', scheduled_at: '2026-07-01T06:59:59Z' };
  const cancelled = { ...first, id: 'cancelled', status: 'CANCELLED' };
  const sequence = [first.stops[0], second.stops[0], first.stops[1], second.stops[1]];
  const interleaved = { ...route, stops: sequence.map((stop, position) => ({ ...route.stops[0], stop, stop_id: stop.id, id: `visit-${position}`, position, status: position === 0 ? 'COMPLETED' : 'PLANNED' })).reverse() };
  const plan = driverDayPlan([future, past, cancelled, second, first] as never, [interleaved] as never, 'America/Vancouver', '2026-07-02T06:59:00Z');
  assert.deepEqual(plan.orders.map(row => row.id).sort(), ['o1', 'o2']);
  assert.deepEqual(plan.stops.map(row => row.stop.id), sequence.map(stop => stop.id));
  assert.deepEqual(plan.stops.map(driverStopStatus), ['Completed', 'Next stop', 'Upcoming', 'Upcoming']);
  assert.equal(interleaved.stops[0].position, 3, 'planning must not mutate server data');
  const tomorrow = driverDayPlan([future, first] as never, [route] as never, 'America/Vancouver', '2026-07-02T07:00:00Z');
  assert.deepEqual(tomorrow.orders.map(row => row.id), ['future']);
});

test('driver day plan retains completed stops and stops without map coordinates when route data is unavailable', async () => {
  const { driverDayPlan, driverStopStatus } = await import('../src/portal/driverDayPlan');
  const completed = { ...order, status: 'COMPLETED', stops: order.stops.map(stop => ({ ...stop, address: { ...stop.address, latitude: null, longitude: null } })) };
  const plan = driverDayPlan([completed] as never, [], 'UTC', order.scheduled_at);
  assert.equal(plan.stops.length, 2);
  assert.ok(plan.stops.every(row => row.point === null && !row.next && driverStopStatus(row) === 'Completed'));
});

test('driver route map starts at its vehicle source and omits completed visits while executing', async () => {
  const { driverDayPlan, driverRouteSequence } = await import('../src/portal/driverDayPlan');
  const mappedOrder = { ...order, stops: order.stops.map((stop, index) => ({ ...stop,
    address: { ...stop.address, latitude: index === 0 ? 49.26 : 49.28, longitude: index === 0 ? -123.11 : -123.1 } })) };
  const plan = driverDayPlan([mappedOrder] as never, [route] as never, 'UTC', order.scheduled_at);
  const planned = driverRouteSequence({ ...route, map_origin: { latitude: 49.25, longitude: -123.12, source: 'PARKING' } } as never, plan.stops);
  assert.deepEqual(planned.points, [{ lat: 49.25, lng: -123.12 }, { lat: 49.26, lng: -123.11 }, { lat: 49.28, lng: -123.1 }]);
  const active = { ...route, status: 'IN_PROGRESS', stops: route.stops.map((visit, index) => ({ ...visit, status: index === 0 ? 'COMPLETED' : 'PLANNED' })) };
  const remaining = driverRouteSequence({ ...active, map_origin: { latitude: 49.27, longitude: -123.1, source: 'GPS' } } as never, plan.stops);
  assert.deepEqual(remaining.points, [{ lat: 49.27, lng: -123.1 }, { lat: 49.28, lng: -123.1 }]);
});

test('driver logo returns to Dashboard from Orders and Profile, including compact navigation', async () => {
  const user = userEvent.setup({ document });
  mount();
  await screen.findByRole('table', { name: 'Orders' });
  await user.click(screen.getByRole('button', { name: 'Dispatra, Orders' }));
  assert.equal(location.pathname, '/acme/driver');
  assert.ok(screen.getByRole('heading', { name: 'Dashboard' }));
  await user.click(screen.getByRole('link', { name: 'Profile' }));
  await screen.findByRole('heading', { name: 'Profile' });
  await user.click(screen.getByRole('button', { name: 'Collapse menu' }));
  const sidebar = screen.getByRole('complementary', { name: 'Workspace sidebar' });
  assert.equal(sidebar.getAttribute('data-collapsed'), 'true');
  await user.click(screen.getByRole('button', { name: 'Dispatra, Profile' }));
  assert.equal(location.pathname, '/acme/driver');
  assert.ok(screen.getByRole('heading', { name: 'Dashboard' }));
  assert.equal(sidebar.getAttribute('data-collapsed'), 'false');
});

test('pending progress requests do not appear on Orders or the Today’s jobs card', async () => {
  const user = userEvent.setup({ document });
  const question = { id: 'progress-1', version: 1, order_id: order.id, order_number: order.number, prompt: 'What is happening at pickup?', choices: [{ value: 'ITEMS_NOT_READY' as const, label: 'Items not ready' }], status: 'OPEN' as const, reason: null, details: '', estimated_ready_at: null, created_at: new Date().toISOString(), answered_at: null };
  let questionRequests = 0;
  api.driverOperationalQuestions = async () => { questionRequests++; return [question]; };
  try {
    mount();
    await screen.findByRole('table', { name: 'Orders' });
    assert.equal(screen.queryByText('Progress updates requested'), null);
    assert.equal(screen.queryByRole('button', { name: 'Review updates' }), null);
    await user.click(screen.getByRole('button', { name: 'Dispatra, Orders' }));
    const panel = screen.getByRole('complementary', { name: "Today's jobs" });
    assert.equal(within(panel).queryByRole('region', { name: 'Supervisor agent questions' }), null);
    assert.equal(within(panel).queryByRole('button', { name: 'Review updates' }), null);
    assert.equal(questionRequests, 0);
  } finally { api.driverOperationalQuestions = async () => []; }
});


test('sign-in waits for saved duty instead of showing Off duty or changing availability', async () => {
  const original = operations.driverProfile;
  let resolve!: (value: ReturnType<typeof profile>) => void;
  const pending = new Promise<ReturnType<typeof profile>>(done => { resolve = done; });
  operations.driverProfile = () => pending as ReturnType<typeof operations.driverProfile>;
  calls.length = 0;
  try {
    mount();
    assert.ok(screen.getByText('Checking duty…'));
    assert.equal(screen.queryByText('Off duty'), null);
    assert.equal((screen.getByRole('switch', { name: 'Duty status' }) as HTMLButtonElement).disabled, true);
    await act(async () => { resolve(profile(true)); });
    await screen.findByText('On duty');
    assert.equal(screen.getByRole('switch', { name: 'Duty status' }).getAttribute('aria-checked'), 'true');
    assert.equal(calls.includes('endDuty'), false);
    assert.equal(calls.includes('startDuty'), false);
  } finally { resolve(profile(true)); operations.driverProfile = original; }
});
