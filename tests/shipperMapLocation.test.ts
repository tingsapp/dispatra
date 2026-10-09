import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Address } from '../src/operations/api';
import { addressPoint, initialShipperCenter, resolveShipperLocation } from '../src/components/orders/shipperMapLocation';

const warehouse: Address = { text: '100 Main St, Vancouver', city: 'Vancouver', province: 'BC', postal_code: '', country: 'CA', latitude: 49.28, longitude: -123.1 };
test('warehouse coordinates take priority without geocoding or requesting device location', async () => {
  const unexpected = async () => { throw new Error('Must not be called'); };
  assert.deepEqual(await resolveShipperLocation(warehouse, unexpected, unexpected), { point: { lat: 49.28, lng: -123.1 }, source: 'warehouse' });
  assert.deepEqual(initialShipperCenter(warehouse), { lat: 49.28, lng: -123.1 });
});
test('a saved address without coordinates is resolved before device fallback', async () => {
  let lookup = '';
  assert.deepEqual(await resolveShipperLocation({ ...warehouse, latitude: null, longitude: null }, async text => { lookup = text; return { lat: 49.27, lng: -123.12 }; },
    async () => { throw new Error('Must not request device location'); }), { point: { lat: 49.27, lng: -123.12 }, source: 'warehouse' });
  assert.equal(lookup, warehouse.text);
});
test('device fallback follows failed warehouse lookup, and denial leaves the map usable', async () => {
  const missing = { ...warehouse, latitude: null, longitude: null };
  assert.deepEqual(await resolveShipperLocation(missing, async () => { throw new Error('Unavailable'); }, async () => ({ lat: 43.65, lng: -79.38 })),
    { point: { lat: 43.65, lng: -79.38 }, source: 'device' });
  assert.equal(await resolveShipperLocation(undefined, async () => null, async () => null), null);
  assert.deepEqual(initialShipperCenter(undefined, 'America/Toronto'), { lat: 43.6532, lng: -79.3832 });
});
test('invalid or missing coordinates never become map points', () => {
  for (const address of [undefined, { latitude: null, longitude: null }, { latitude: NaN, longitude: -123 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) assert.equal(addressPoint(address), null);
  assert.deepEqual(addressPoint({ latitude: 0, longitude: 0 }), { lat: 0, lng: 0 });
});
