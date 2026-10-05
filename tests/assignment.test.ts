import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { components } from '../src/portal/schema';
import { assignableRoute } from '../src/operations/assignment';

type Route = components['schemas']['RouteView'];
const route = (status: Route['status'], driver_id = 'driver-1', vehicle_id = 'vehicle-1'): Route =>
  ({ id: 'route-1', driver_id, vehicle_id, status, version: 2, locked: false } as Route);

test('an existing planned route is selected for an additional order', () => {
  const planned = route('PLANNED');
  assert.equal(assignableRoute([route('COMPLETED'), planned], 'driver-1', 'vehicle-1'), planned);
});

test('an in-progress route cannot accept another order', () => {
  assert.throws(() => assignableRoute([route('IN_PROGRESS')], 'driver-1', 'vehicle-1'), /in-progress route/);
});

test('a vehicle attached to a different active route cannot be reused', () => {
  assert.throws(() => assignableRoute([route('PLANNED', 'driver-2')], 'driver-1', 'vehicle-1'), /another active route/);
});
