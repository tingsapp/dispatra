import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shipperMapPadding, shipperMapSpan } from '../src/components/orders/shipperMapViewport';
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

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
test('map fitting chooses usable space from actual card bounds, including a narrow desktop canvas', () => {
  for (const [view, card] of [
    [rect(260, 0, 1180, 900), rect(284, 80, 520, 358)],
    [rect(260, 0, 780, 700), rect(284, 80, 520, 465)],
    [rect(0, 0, 320, 844), rect(16, 80, 288, 326)],
  ]) {
    const padding = shipperMapPadding(view, card, { top: 12, right: 80, bottom: 112, left: 80 });
    // The anchors can occupy a narrower band; captions extend into the reserved margins.
    assert.ok(view.width - padding.left - padding.right > 32);
    const halfCaption = view.width <= 480 ? 72 : 80;
    assert.ok(padding.left >= halfCaption + 8 && padding.right >= halfCaption + 8);
    assert.ok(view.height - padding.top - padding.bottom > 150);
    assert.ok(view.left + padding.left >= card.right + 8 || view.top + padding.top >= card.bottom + 8,
      'The fitting rectangle must not overlap the card');
    if (view.top + padding.top >= card.bottom) assert.ok(view.top + padding.top - card.bottom <= 24,
      'The card must not add a large blank gap above the routes');
  }
});

test('route shape chooses the area allowing a closer fit instead of the largest empty area', () => {
  const view = rect(260, 0, 1180, 900), card = rect(284, 80, 520, 358);
  const insets = { top: 12, right: 12, bottom: 12, left: 12 };
  const horizontal = shipperMapPadding(view, card, insets, { width: 10, height: 1 });
  const vertical = shipperMapPadding(view, card, insets, { width: 1, height: 10 });
  assert.ok(view.top + horizontal.top > card.bottom, 'Wide routes use the full map width below the card');
  assert.ok(view.left + vertical.left > card.right, 'Tall routes use the full height beside the card');
  assert.ok(horizontal.left < 32 && horizontal.right < 32, 'Bare stop circles need only a small edge gap');
});

test('Mercator route dimensions account for latitude and support a single focus point', () => {
  const span = shipperMapSpan([{ lat: 49, lng: -123 }, { lat: 50, lng: -122 }]);
  assert.ok(span.height > span.width);
  assert.deepEqual(shipperMapSpan([warehouse].map(address => addressPoint(address)!)), { width: 0, height: 0 });
});
