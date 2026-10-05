import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { ClipboardList } = await import('lucide-react');
const { PortalShell } = await import('../src/portal/PortalShell');
const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
const { shipperPricingContext, catalogueFromApi } = await import('../src/operations/pricingAdapters');
const { inputToShipperBooking, orderToInput } = await import('../src/operations/orderAdapters');
const { ShipperOrderDialog } = await import('../src/portal/ShipperOrderDialog');
const { companyRateRows, travelRows } = await import('../src/lib/companyTax');
const { priceToUi } = await import('../src/operations/orderAdapters');
const { createDefaultOrderInput, createBookingInput, priceOrder } = await import('../src/lib/orderPricing');
afterEach(() => { cleanup(); localStorage.clear(); });

const catalog = (id: string, kind: string, name: string) => ({ id, kind, code: id, active: true, version: 1, data: { name, description: '', amount: '12.50', taxable: true, fuel_eligible: false, exclusive_vehicle: false, payload_kg: 1000, volume_m3: null, length_cm: null, width_cm: null, height_cm: null, pallet_capacity: 0, equipment: [], required_equipment: [], required_crew: 1 } });
const options = [catalog('11111111-1111-4111-8111-111111111111', 'SERVICE', 'Same day'), catalog('22222222-2222-4222-8222-222222222222', 'ACCESSORIAL', 'Liftgate'), catalog('33333333-3333-4333-8333-333333333333', 'VEHICLE_TYPE', 'Cargo van')] as never[];
const shipper = { id: '44444444-4444-4444-8444-444444444444', number: 'S01', name: 'Acme', company_name: 'Acme Ltd', kind: 'BUSINESS', email: 'a@example.ca', phone: '604-555-0100', status: 'ACTIVE',
  warehouse: { text: '100 Main St, Vancouver, BC V6A 2S5', city: 'Vancouver', province: 'BC', postal_code: 'V6A 2S5', country: 'CA', latitude: 49.28, longitude: -123.1 },
  rate_card_id: '55555555-5555-4555-8555-555555555555', discount: { kind: 'NONE', value: '0' }, terms: 'NET30', instructions: '', created_at: '2026-01-01T00:00:00Z' } as never;
const preferences = { currency: 'CAD', time_zone: 'America/Toronto', weight_unit: 'kg', dimension_unit: 'cm', distance_unit: 'km',
  gst_enabled: true, gst_percent: '13', provincial_enabled: false, provincial_percent: '0', fuel_enabled: true, fuel_percent: '28.5' } as never;

test('shipper context uses only shipper-visible API records and preferences', () => {
  localStorage.setItem('dispatra_customers_v1', JSON.stringify([{ id: 'leak' }]));
  const ctx = shipperPricingContext(preferences, options, shipper);
  assert.deepEqual(ctx.catalogue.services.map(s => s.name), ['Same day']);
  assert.deepEqual(ctx.catalogue.accessorials.map(a => a.name), ['Liftgate']);
  assert.deepEqual(ctx.customers.map(c => c.name), ['Acme']);
  assert.equal(ctx.pricing.rateCards.length, 0);
  assert.equal(ctx.billing.general.timeZone, 'America/Toronto');
  assert.equal(ctx.billing.general.weightUnit, 'kg');
});

test('shipper bookings strip dispatcher-only commercial fields', () => {
  const ctx = shipperPricingContext(preferences, options, shipper);
  const input = createDefaultOrderInput(ctx);
  input.customerId = 'someone-else'; input.rateCardOverrideId = 'card'; input.routeKm = 12; input.importedPrice = 99;
  input.adjustments = [{ id: '1', amount: 5, reason: 'x', taxable: true }];
  input.stops = input.stops.map((stop, i) => ({ ...stop, label: i ? '200 King St W, Toronto, ON M5H 1J9' : '100 Main St, Vancouver, BC V6A 2S5', windowStart: i ? undefined : '2026-10-01T09:00' }));
  input.scheduledAt = '2026-10-01T09:00';
  const booking = inputToShipperBooking(input, 'America/Toronto');
  assert.equal(booking.shipper_id, null); assert.equal(booking.billing_shipper_id, null); assert.equal(booking.rate_card_id, null);
  assert.equal(booking.distance_km, null); assert.equal(booking.imported_total, null); assert.deepEqual(booking.adjustments, []); assert.equal(booking.internal_notes, '');
  assert.equal(booking.stops.length, 2); assert.equal(booking.items.length, 1);
});

test('self mode shows the dispatcher form without shipper, rate card or vehicle choices', () => {
  const ctx = shipperPricingContext(preferences, options, shipper);
  const value = createDefaultOrderInput(ctx);
  render(React.createElement(OrderPricingForm, { value, ctx, snapshot: priceOrder(value, ctx), onChange: () => {}, customerMode: 'self', showVehicleSelection: false, showStopAddresses: true }));
  assert.equal(screen.queryByLabelText('Shipper'), null);
  assert.equal(screen.queryByLabelText('Rate Card'), null);
  assert.equal(screen.queryByLabelText('Vehicle'), null);
  assert.ok(screen.getByLabelText('Service'));
  assert.ok(screen.getByRole('button', { name: '+ Pickup' }));
  assert.ok(screen.getByRole('table', { name: 'Packages' }));
  assert.ok(screen.getByText(/Accessorials/));
});

test('shipper sidebar uses the dispatcher account card with Profile and Logout', async () => {
  const user = userEvent.setup({ document }); let profile = 0, logout = 0;
  render(React.createElement(PortalShell, { company: 'Demo', login: 'shipper@example.com', primary: 'Orders', icon: ClipboardList, settings: false,
    navigation: [{ label: 'Orders', href: '/demo/shipper', icon: ClipboardList, current: true }],
    account: { name: 'Demo Shipper', role: 'Shipper', profileCurrent: false },
    onHome: () => {}, onSettings: () => { profile += 1; }, onLogout: () => { logout += 1; }, loggingOut: false, children: null }));
  assert.equal(screen.queryByRole('button', { name: 'Sign out' }), null);
  await user.click(screen.getByRole('button', { name: 'Shipper account' }));
  assert.deepEqual(screen.getAllByRole('menuitem').map(item => item.textContent), ['Profile', 'Logout']);
  await user.click(screen.getByRole('menuitem', { name: 'Profile' }));
  assert.equal(profile, 1);
  await user.click(screen.getByRole('button', { name: 'Shipper account' }));
  await user.click(screen.getByRole('menuitem', { name: 'Logout' }));
  assert.equal(logout, 1);
});

test('dispatcher and shipper order forms get the same catalogue order and a vehicle-free blank booking', () => {
  const service = (id: string, code: string, created: string) => ({ ...catalog(id, 'SERVICE', code), code, created_at: created });
  const rows = [service('a0000000-0000-4000-8000-000000000003', 'SAME_DAY', '2026-01-01T00:00:02Z'), service('a0000000-0000-4000-8000-000000000001', 'DIRECT', '2026-01-01T00:00:01Z'), service('a0000000-0000-4000-8000-000000000002', 'NEXT_DAY', '2026-01-01T00:00:01Z')] as never[];
  // The dispatcher /catalog (id order) and shipper /booking-options (code order) return the same rows in different orders.
  const dispatcher = catalogueFromApi([rows[2], rows[0], rows[1]]).services.map(s => s.code);
  const shipperCtx = shipperPricingContext(preferences, [rows[1], rows[2], rows[0]], shipper);
  assert.deepEqual(shipperCtx.catalogue.services.map(s => s.code), dispatcher);
  assert.deepEqual(dispatcher, ['DIRECT', 'NEXT_DAY', 'SAME_DAY']);
  const blank = createBookingInput(shipperPricingContext(preferences, options, shipper));
  assert.equal(blank.serviceId, '11111111-1111-4111-8111-111111111111');
  assert.equal(blank.vehicleId, null); assert.equal(blank.customerId, null); assert.equal(blank.rateCardOverrideId, null);
  assert.ok(blank.stops.every(stop => stop.zoneId === null));
});

const driverA = { id: '66666666-6666-4666-8666-666666666666', name: 'Dana Driver' };
const bookable = (ctx: ReturnType<typeof shipperPricingContext>) => {
  const input = createDefaultOrderInput(ctx);
  input.stops = input.stops.map((stop, i) => ({ ...stop, label: i ? '200 King St W, Toronto, ON M5H 1J9' : '100 Main St, Vancouver, BC V6A 2S5' }));
  input.scheduledAt = '2026-10-01T09:00';
  return input;
};

test('the optional preferred driver travels with the booking and back from the order', () => {
  const ctx = shipperPricingContext(preferences, options, shipper);
  const input = bookable(ctx);
  assert.equal(inputToShipperBooking(input, 'America/Toronto').preferred_driver_id, null);
  const booking = inputToShipperBooking({ ...input, preferredDriverId: driverA.id }, 'America/Toronto');
  assert.equal(booking.preferred_driver_id, driverA.id);
  const order = { id: 'o1', version: 1, number: 'O-1', shipper_id: 'S', billing_shipper_id: 'S', service_id: booking.service_id, route_id: null, source: 'SHIPPER_PORTAL', status: 'NEW',
    scheduled_at: booking.scheduled_at, completed_at: null, created_at: '2026-01-01T00:00:00Z', booking: {}, facts: { ...booking, adjustments: [], accessorials: [] }, pricing: { status: 'PRICED', stage: 'ESTIMATE', lines: [], context: {} } } as never;
  assert.equal(orderToInput(order).preferredDriverId, driverA.id);
});

test('shipper order form offers an optional "Want specific driver?" choice and names its rate card only in the live estimate', async () => {
  const user = userEvent.setup({ document });
  const ctx = shipperPricingContext(preferences, options, shipper);
  render(React.createElement(ShipperOrderDialog, { slug: 'demo', ctx, initial: bookable(ctx), drivers: [driverA], rateCardName: 'Fixed Demo', onClose: () => {}, onSaved: () => {} }));
  const field = screen.getByRole('combobox', { name: 'Want specific driver?' });
  assert.match(field.textContent ?? '', /No preference/);
  assert.equal(screen.queryByText(/Priced with your rate card/), null);
  assert.equal(screen.queryByText('Resolved via'), null); assert.equal(screen.queryByText('Method'), null);
  assert.equal(screen.getByText('GST/HST').nextElementSibling!.textContent, '13%');
  assert.equal(screen.getByText('Fuel Surcharge').nextElementSibling!.textContent, '28.5%');
  assert.ok(screen.getByText('Fixed Demo'), 'the live estimate names the shipper rate card before pricing completes');
  await user.click(field);
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['No preference', 'Dana Driver']);
  await user.click(screen.getByRole('option', { name: 'Dana Driver' }));
  assert.match(screen.getByRole('combobox', { name: 'Want specific driver?' }).textContent ?? '', /Dana Driver/);
});

test('the live estimate shows company GST/HST and fuel rates only when enabled in the dispatch account', () => {
  const on = shipperPricingContext({ ...(preferences as object), provincial_enabled: true, provincial_percent: '7', gst_percent: '5' } as never, options, shipper);
  assert.deepEqual(companyRateRows(on.billing), [{ label: 'GST/HST', value: '5%' }, { label: 'Provincial tax', value: '7%' }, { label: 'Fuel Surcharge', value: '28.5%' }]);
  const off = shipperPricingContext({ ...(preferences as object), gst_enabled: false, fuel_enabled: false } as never, options, shipper);
  assert.deepEqual(companyRateRows(off.billing), []);
});

test('road distance and duration from API pricing reach dispatcher rows only; shipper responses carry none', () => {
  const ctx = shipperPricingContext(preferences, options, shipper);
  const booking = inputToShipperBooking(bookable(ctx), 'America/Toronto');
  const price = (context: object) => ({ status: 'PRICED', stage: 'ESTIMATE', currency: 'CAD', method: 'BASE_PLUS_DISTANCE', rate_card_id: 'c', rate_card_version: 1, lines: [], subtotal: '10', tax: '0', total: '10', context }) as never;
  const units = { ...ctx.billing.general, distanceUnit: 'km' as const };
  assert.deepEqual(travelRows(priceToUi(price({ distance_km: '12.35', estimated_minutes: 86 }), booking, '2026-01-01T00:00:00Z'), units), [{ label: 'Distance', value: '12.3 km' }, { label: 'Duration', value: '1 h 26 min' }]);
  assert.deepEqual(travelRows(priceToUi(price({}), booking, '2026-01-01T00:00:00Z'), units), []);
});
