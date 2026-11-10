import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftToInput, emailDraftRow, inputToBooking, inputToDraftBooking } from '../src/operations/orderAdapters';
import { EMAIL_DRAFT_STATUSES } from '../src/components/orders/EmailIntake';
import type { CatalogItem, EmailIntake, Shipper } from '../src/operations/api';
import { syncInvalidations } from '../src/portal/sync';

const pickup = '11111111-1111-4111-8111-111111111111', dropoff = '22222222-2222-4222-8222-222222222222', item = '33333333-3333-4333-8333-333333333333';
const warehouse = { text: '123 Main Street, Vancouver, BC V5Y 1V4, Canada', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', country: 'CA', latitude: 49.26, longitude: -123.11 };
const draft = { shipper_id: 'shipper-1', service_id: null, vehicle_type_id: null, scheduled_at: '2026-10-06T09:00:00-07:00', external_reference: 'PO-77',
  stops: [{ id: pickup, kind: 'PICKUP', address: warehouse, contact_name: '', phone: '', instructions: '', window_start: null, window_end: null },
    { id: dropoff, kind: 'DROPOFF', address: null, contact_name: 'Bob', phone: '6045550199', instructions: 'Front desk', window_start: null, window_end: null }],
  items: [{ id: item, pickup_id: pickup, delivery_id: dropoff, quantity: 2, weight_kg: null, length_cm: '30.48', width_cm: '25.40', height_cm: '20.32', pallets: 0, fragile: true, dangerous_goods: false, description: 'Boxes' }] };

test('an incomplete email draft opens as blank form fields instead of failing', () => {
  const input = draftToInput(draft);
  assert.equal(input.customerId, 'shipper-1');
  assert.equal(input.serviceId, '');
  assert.equal(input.source, 'EMAIL');
  assert.deepEqual(input.packages[0].missingFields, ['weightKg']);
  assert.equal(input.requiredDriverId, null);
  assert.equal(input.requiredDriverName, null);
  assert.equal(input.externalReference, 'PO-77');
  assert.deepEqual(input.stops.map(stop => [stop.type, stop.label]), [['PICKUP', warehouse.text], ['DROPOFF', '']]);
  assert.equal(input.stops[1].contactName, 'Bob');
  assert.deepEqual(input.packages.map(p => [p.quantity, p.weightKg, p.lengthCm, p.pickupStopId, p.deliveryStopId]), [[2, 0, 30.48, pickup, dropoff]]);
});

test('a completed draft keeps the stop and item identities the agent created', () => {
  const input = draftToInput({ ...draft, service_id: 'service-1', stops: [draft.stops[0], { ...draft.stops[1], address: { ...warehouse, text: '500 Granville Street, Vancouver, BC V6C 1W6, Canada', postal_code: 'V6C 1W6' } }],
    items: [{ ...draft.items[0], weight_kg: '9.98' }] });
  const booking = inputToBooking(input, '', 'America/Vancouver');
  assert.deepEqual(booking.stops.map(stop => stop.id), [pickup, dropoff]);
  assert.equal(booking.items[0].id, item);
  assert.equal(booking.items[0].weight_kg, 9.98);
  assert.equal(booking.service_id, 'service-1');
});

test('Order agent changes refresh the email queue and orders', () => {
  const keys = syncInvalidations('DISPATCHER', 'acme', [{ entity: 'intake' } as never, { entity: 'mailbox' } as never]).map(key => JSON.stringify(key));
  assert.deepEqual(keys, [JSON.stringify(['operations', 'acme', 'email-intakes']), JSON.stringify(['operations', 'acme', 'orders']), JSON.stringify(['operations', 'acme', 'mailbox']), JSON.stringify(['operations', 'acme', 'activity', 'latest'])]);
  assert.deepEqual(syncInvalidations('SHIPPER', 'acme', [{ entity: 'intake' } as never]), []);
});

test('only order emails become Draft rows, shown like an Order with missing facts blank', () => {
  assert.deepEqual(EMAIL_DRAFT_STATUSES, ['NEEDS_REVIEW', 'UNKNOWN_SENDER']);
  const intake = { id: 'intake-1', shipper_id: 'shipper-1', from_address: 'alice@example.com', draft } as unknown as EmailIntake;
  const shippers = [{ id: 'shipper-1', name: 'Alice Shipper', phone: '6045550101' }] as Shipper[];
  const row = emailDraftRow(intake, shippers, [] as CatalogItem[]);
  assert.deepEqual([row.shipper, row.phone, row.pickup, row.dropoff, row.scheduledAt, row.stops, row.service], ['Alice Shipper', '6045550101', warehouse.text, '', draft.scheduled_at, 2, '']);
  const unknown = emailDraftRow({ ...intake, shipper_id: null, draft: { ...draft, shipper_id: null } } as unknown as EmailIntake, shippers, []);
  assert.deepEqual([unknown.shipper, unknown.phone, unknown.from], ['', '', 'alice@example.com']);
  assert.equal(emailDraftRow({ ...intake, draft: null } as unknown as EmailIntake, shippers, []).pickup, '');
});


test('saving and reopening a partial draft keeps missing measurements null and supplied values intact', () => {
  const input = draftToInput({ ...draft, scheduled_at: null, items: [{ ...draft.items[0], quantity: null, width_cm: null }] });
  const saved = inputToDraftBooking(input);
  assert.equal(saved.scheduled_at, null);
  assert.equal(saved.service_id, null);
  assert.equal(saved.items[0].quantity, null);
  assert.equal(saved.items[0].weight_kg, null);
  assert.equal(saved.items[0].width_cm, null);
  assert.equal(saved.items[0].length_cm, 30.48);
  const restored = draftToInput(saved as unknown as Record<string, unknown>);
  assert.deepEqual(restored.packages[0].missingFields, ['quantity', 'weightKg', 'widthCm']);
  assert.equal(restored.stops[0].label, warehouse.text);
});

test('empty drafts have editable blank pickup, delivery and package fields', () => {
  const input = draftToInput({});
  assert.deepEqual(input.stops.map(stop => [stop.type, stop.label]), [['PICKUP',''],['DROPOFF','']]);
  assert.equal(input.packages.length, 1);
  assert.equal(input.packages[0].missingFields?.length, 5);
  assert.equal(input.customerId, null);
  assert.equal(input.vehicleId, null);
});

test('old incomplete-address drafts recover supplied address text from the extraction', () => {
  const input = draftToInput(draft, { stops: [{}, { address: { street: '456 Lougheed hiway', city: 'Burnaby' } }] });
  assert.equal(input.stops[1].label, '456 Lougheed hiway, Burnaby');
  assert.equal(input.stops[1].postalCode, '');
  assert.equal(input.stops[1].contactName, 'Bob');
});


test('two pallets retain one pallet per item, not quantity squared', () => {
  const input = draftToInput({ ...draft, items: [{ ...draft.items[0], quantity: 2, pallets: 1 }] });
  const saved = inputToDraftBooking(input);
  assert.equal(saved.items[0].quantity, 2);
  assert.equal(saved.items[0].pallets, 1);
});


test('legacy drafts recover stated measurements using company units without restoring cleared saved fields', () => {
  const original = { ...draft, items: [{ ...draft.items[0], length_cm: null, weight_kg: null }] };
  const extraction = { items: [{ length: 48, weight_each: 200, weight_unit: 'lb', dimension_unit: null }] };
  const units = { weightUnit: 'lb' as const, dimensionUnit: 'in' as const, distanceUnit: 'km' as const };
  const input = draftToInput(original, extraction, units);
  assert.equal(input.packages[0].lengthCm, 121.92);
  assert.equal(input.packages[0].weightKg, 90.72);
  const cleared = draftToInput({ ...original, internal_notes: '' }, extraction, units);
  assert.ok(cleared.packages[0].missingFields?.includes('lengthCm'));
});
