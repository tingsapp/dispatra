import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locatedOrderStops, separateStopMarkers, vehicleMapLocations } from '../src/components/monitor/mapLocations';
import type { Job } from '../src/types';
import type { Driver, Vehicle } from '../src/operations/api';

const parking = { text: 'Vehicle yard', latitude: 49.2, longitude: -123.1 };
const vehicle = { id: 'v1', number: 'DV-V1', active: true, data: { unit_number: 'V1', parking_address: parking, availability: 'AVAILABLE' } } as Vehicle;
const driver = { id: 'd1', name: 'Dana', vehicle_id: 'v1', active: true, address: { latitude: 48, longitude: -122 } } as Driver;
const observed = Date.parse('2026-11-10T15:00:00Z');
const gps = { id: 'd1', on_duty: true, location: { latitude: 49.3, longitude: -123.2, captured_at: '2026-11-10T14:59:30Z', accuracy_m: 10 } };

test('vehicle markers use accurate current-duty GPS, otherwise labelled parking, never home', () => {
  assert.equal(vehicleMapLocations([vehicle], [driver], [gps], observed)[0].source, 'GPS');
  for (const point of [{ ...gps, on_duty: false }, { ...gps, location: { ...gps.location, accuracy_m: 200 } },
    { ...gps, location: { ...gps.location, captured_at: '2026-11-10T14:50:00Z' } },
    { ...gps, location: { ...gps.location, captured_at: '2026-11-10T15:01:00Z' } }]) {
    const marker = vehicleMapLocations([vehicle], [driver], [point], observed)[0];
    assert.equal(marker.source, 'PARKING');
    assert.equal(marker.lat, parking.latitude);
    assert.equal(marker.address, parking.text);
  }
  assert.equal(vehicleMapLocations([vehicle], [], [], observed)[0].driverName, undefined);
  assert.deepEqual(vehicleMapLocations([{ ...vehicle, data: { ...vehicle.data, parking_address: null } }], [driver], [], observed), []);
  assert.deepEqual(vehicleMapLocations([{ ...vehicle, active: false }], [driver], [gps], observed), []);
});

test('all located visits retain stable identities and original numbers when final destination is unknown', () => {
  const job = { lat: NaN, lng: NaN, pricingInput: { stops: [
    { id: 'p1', type: 'PICKUP', label: 'Warehouse', latitude: 49.2, longitude: -123.1 },
    { id: 'd1', type: 'DROPOFF', label: 'Intermediate delivery', latitude: 49.25, longitude: -123.15 },
    { id: 'p2', type: 'PICKUP', label: 'Second pickup', latitude: 49.2, longitude: -123.1 },
    { id: 'd2', type: 'DROPOFF', label: 'Final delivery', latitude: null, longitude: null },
  ] } } as Job;
  const stops = locatedOrderStops(job);
  assert.deepEqual(stops.map(stop => [stop.id, stop.sequence]), [['p1', 1], ['d1', 2], ['p2', 3]]);
  const rows = separateStopMarkers([{ job, stops }]);
  assert.notDeepEqual(rows[0].stops[0].offset, rows[0].stops[2].offset);
  assert.equal(rows[0].stops[0].lat, rows[0].stops[2].lat, 'screen offsets do not alter geographic data');
});
