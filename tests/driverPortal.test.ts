import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/driver/orders', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLCanvasElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof typeof dom.window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, waitFor, within, fireEvent } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { DriverPortal } = await import('../src/portal/DriverPortal');
const { ProofOfDelivery } = await import('../src/components/orders/ProofOfDelivery');
afterEach(() => { cleanup(); history.replaceState(null, '', '/acme/driver/orders'); });

const address = (text: string) => ({ text, city: 'Vancouver', province: 'BC', postal_code: 'V6B 1A1', country: 'CA', latitude: 49.28, longitude: -123.1 });
const duty = { id: 'duty-1', version: 1, created_at: '2026-10-02T08:00:00Z', driver_id: 'd1', started_at: '2026-10-02T08:00:00Z', ended_at: null };
const profile = (online: boolean) => ({ id: 'd1', version: 3, number: 'DCO-0001', name: 'Dana Driver', email: 'dana@example.com', phone: '6045550102', address: address('1 Driver St, Vancouver'), service_city: 'Vancouver', vehicle_id: 'v1', vehicle_name: 'Test Van · TEST123', duty: online ? duty : null, location_permission: 'GRANTED' });
const order = { id: 'o1', number: 'DCO-1001', status: 'ASSIGNED', scheduled_at: '2026-10-02T16:00:00Z', completed_at: null, route_id: 'r1', route_status: 'PLANNED', service_name: 'Same day',
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
stub('driverOrders', [order]);
stub('sync', { cursor: '1-0', changes: [], unread: 0, reset: false, next_poll_ms: 60_000 });
stub('driverRoutes', [route]);
stub('startRoute', route);
stub('endDuty', () => { online = false; return duty; });
stub('updateDriverProfile', (_slug: unknown, version: unknown, phone: unknown) => ({ ...profile(online), version: Number(version) + 1, phone }));
const mount = () => render(React.createElement(QueryClientProvider, { client: client() },
  React.createElement(DriverPortal, { slug: 'acme', company: 'Acme Logistics', login: 'dana@example.com', onLogout: () => calls.push('logout'), loggingOut: false, logoutError: null })));

test('driver sidebar lists Profile then Orders and ends with a Logout card above the duty switch', async () => {
  const user = userEvent.setup({ document }); online = true; calls.length = 0;
  mount();
  const nav = screen.getByRole('navigation', { name: 'Portal navigation' });
  assert.deepEqual(within(nav).getAllByRole('link').map(link => link.getAttribute('aria-label')), ['Profile', 'Orders']);
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
