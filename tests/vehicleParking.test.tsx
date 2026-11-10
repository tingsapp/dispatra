import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { VehicleEditor } = await import('../src/components/entities/VehicleEditor');
const { vehicleToUi, vehicleFromUi } = await import('../src/operations/adapters');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { validateOperationalAssignment } = await import('../src/domain/assignment');
const { normalizeDriver } = await import('../src/lib/driverStorage');
const { INITIAL_DRIVERS } = await import('../src/data/mockData');
afterEach(() => { cleanup(); localStorage.clear(); });

const parking = { text: '123 Yard St, Richmond, BC V6X 1A1', city: 'Richmond', province: 'BC', postal_code: 'V6X 1A1', country: 'CA' as const, latitude: 49.17, longitude: -123.13 };

test('parking address and coordinates survive vehicle read/edit/save, independently of driver home', () => {
  const row = { id: 'v1', number: 'DV-V1', type_id: 't1', plate: 'ABC1', province: 'BC', active: true, data: {
    name: 'V1', unit_number: 'V1', parking_address: parking, equipment: [], availability: 'AVAILABLE',
    length_cm: '300', width_cm: '180', height_cm: '180', payload_kg: '1000', pallet_capacity: 2,
  } } as never;
  const form = vehicleToUi(row);
  assert.equal(form.parkingAddress, parking.text);
  assert.deepEqual(vehicleFromUi(form, row).parking_address, parking);
  assert.throws(() => vehicleFromUi({ ...form, parkingAddress: '' }, row), /full Canadian address/);
  const changed = vehicleFromUi({ ...form, parkingAddress: '200 Yard St, Burnaby, BC V5C 1A1', parkingAddressCoordinates: undefined }, row);
  assert.equal(changed.parking_address?.city, 'Burnaby');
  assert.equal(changed.parking_address?.latitude, null, 'editing text must not reuse old coordinates');
});

test('vehicle form requires parking address, preserves it on edit and uses shorter type hint', async () => {
  const vehicle = { ...loadVehicles()[0], cargoLengthCm: 300, cargoWidthCm: 180, cargoHeightCm: 180, parkingAddress: parking.text, parkingAddressCoordinates: {
    latitude: parking.latitude, longitude: parking.longitude, city: parking.city, province: parking.province, postalCode: parking.postal_code, country: parking.country,
  } };
  let saved: typeof vehicle | undefined;
  render(<VehicleEditor vehicle={vehicle} vehicles={[vehicle]} onSave={value => { saved = value as typeof vehicle; }} onCancel={() => {}} />);
  const field = screen.getByRole('combobox', { name: 'Parking address' }) as HTMLInputElement;
  assert.equal(field.required, true);
  assert.equal(field.value, parking.text);
  assert.ok(screen.getByText('Sets capacity and box size. Changes apply only to this vehicle.'));
  fireEvent.submit(field.closest('form')!);
  await waitFor(() => assert.ok(saved));
  assert.equal(saved!.parkingAddress, parking.text);
  assert.deepEqual(saved!.parkingAddressCoordinates, vehicle.parkingAddressCoordinates);
  saved = undefined;
  fireEvent.change(field, { target: { value: '' } });
  fireEvent.submit(field.closest('form')!);
  assert.equal(saved, undefined);
  assert.match(screen.getByRole('alert').textContent!, /parking address is required/);
});

test('driver residential city and legacy service areas do not restrict pickup eligibility', () => {
  const driver = normalizeDriver({ ...INITIAL_DRIVERS[0], address: '1 Home St, Victoria, BC V8W 1A1', serviceAreaIds: ['victoria'], dutyStatus: 'ON_DUTY', accountStatus: 'ACTIVE', workStatus: 'AVAILABLE' });
  assert.deepEqual(validateOperationalAssignment({ pickupAddress: '123 Main St, Vancouver, BC V5Y 1V4' }, driver, []), []);
});
