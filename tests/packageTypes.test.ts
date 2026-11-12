import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftToInput, inputToBooking } from '../src/operations/orderAdapters';
import { catalogueFromApi, packageTypeToCatalog } from '../src/operations/pricingAdapters';
import { applyPackageType, packageTypeOptions } from '../src/lib/packageTypes';
import type { CatalogItem } from '../src/operations/api';
import type { PricingPackageInput } from '../src/types/pricing';

const pickup = '11111111-1111-4111-8111-111111111111', dropoff = '22222222-2222-4222-8222-222222222222', item = '33333333-3333-4333-8333-333333333333';
const envelopeId = '44444444-4444-4444-8444-444444444444', palletId = '55555555-5555-4555-8555-555555555555';
const entry = (id: string, code: string, data: Record<string, unknown>, active = true) => ({ id, kind: 'PACKAGE_TYPE', code, active, version: 1, created_at: '2026-01-01T00:00:00Z',
  data: { name: code, description: '', amount: '0', taxable: true, fuel_eligible: false, exclusive_vehicle: false, pallet_capacity: 0, equipment: [], required_equipment: [], required_crew: 1, ...data } }) as unknown as CatalogItem;
const types = catalogueFromApi([
  entry(envelopeId, 'ENVELOPE', { name: 'Envelope', default_weight_kg: '0.5', length_cm: '32', width_cm: '24', height_cm: '2' }),
  entry(palletId, 'PALLET', { name: 'Pallet', length_cm: '122', width_cm: '102', height_cm: '120' }),
  entry('66666666-6666-4666-8666-666666666666', 'OLD', { name: 'Old crate' }, false),
]).packageTypes!;
const blank: PricingPackageInput = { id: item, quantity: 1, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, declaredValue: 0, missingFields: ['weightKg', 'lengthCm', 'widthCm', 'heightCm'] };

test('Package Type catalogue entries become order-form choices with their defaults in kg and cm', () => {
  assert.deepEqual(types.map(type => [type.name, type.defaultWeightKg, type.lengthCm]), [['Envelope', 0.5, 32], ['Old crate', null, null], ['Pallet', null, 122]]);
  assert.deepEqual(packageTypeOptions(types).map(type => type.code), ['ENVELOPE', 'PALLET']);
  assert.deepEqual(packageTypeOptions(types, types[1].id).map(type => type.code), ['ENVELOPE', 'OLD', 'PALLET']);
  const saved = packageTypeToCatalog(types[0]);
  assert.equal(saved.amount, 0);
  assert.equal(saved.default_weight_kg, 0.5);
});

test('choosing a type fills its saved size and weight and keeps unset values for the booker', () => {
  const envelope = applyPackageType(blank, envelopeId, types);
  assert.deepEqual([envelope.packageTypeId, envelope.weightKg, envelope.lengthCm, envelope.widthCm, envelope.heightCm], [envelopeId, 0.5, 32, 24, 2]);
  assert.deepEqual(envelope.missingFields, []);
  const pallet = applyPackageType(blank, palletId, types);
  assert.deepEqual(pallet.missingFields, ['weightKg']);
  assert.deepEqual([pallet.handlingUnit, pallet.palletsPerUnit], ['PALLET', 1]);
  const fresh = applyPackageType({ ...blank, quantity: 0, missingFields: ['quantity', 'weightKg', 'lengthCm', 'widthCm', 'heightCm'] }, envelopeId, types);
  assert.deepEqual([fresh.quantity, fresh.missingFields], [1, []]);
  assert.equal(applyPackageType({ ...blank, quantity: 5 }, envelopeId, types).quantity, 5);
  const cleared = applyPackageType(pallet, null, types);
  assert.deepEqual([cleared.packageTypeId, cleared.handlingUnit, cleared.palletsPerUnit, cleared.lengthCm], [null, undefined, 0, 122]);
});

test('the package type is sent with the booking and read back from a saved order', () => {
  const warehouse = { text: '123 Main Street, Vancouver, BC V5Y 1V4, Canada', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', country: 'CA', latitude: 49.26, longitude: -123.11 };
  const input = draftToInput({ shipper_id: 'shipper-1', service_id: 'service-1', vehicle_type_id: null, scheduled_at: '2026-10-06T09:00:00-07:00', external_reference: '',
    stops: [{ id: pickup, kind: 'PICKUP', address: warehouse }, { id: dropoff, kind: 'DROPOFF', address: { ...warehouse, text: '500 Granville Street, Vancouver, BC V6C 1W6, Canada', postal_code: 'V6C 1W6' } }],
    items: [{ id: item, pickup_id: pickup, delivery_id: dropoff, quantity: 3, weight_kg: '0.5', length_cm: '32', width_cm: '24', height_cm: '2', pallets: 0, fragile: false, dangerous_goods: false, description: '', package_type_id: envelopeId }] });
  assert.equal(input.packages[0].packageTypeId, envelopeId);
  assert.equal(inputToBooking(input).items[0].package_type_id, envelopeId);
  assert.equal(inputToBooking({ ...input, packages: [{ ...input.packages[0], packageTypeId: undefined }] }).items[0].package_type_id, null);
});
