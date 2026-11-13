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
  assert.throws(() => assignableRoute([route('IN_PROGRESS')], 'driver-1', 'vehicle-1'), /update the app before work is added/);
});

test('a vehicle attached to a different active route cannot be reused', () => {
  assert.throws(() => assignableRoute([route('PLANNED', 'driver-2')], 'driver-1', 'vehicle-1'), /another active route/);
});

test('closed and executing orders cannot release a route or request assignment', async () => {
  const { changeAssignment, assignToDriver } = await import('../src/operations/assignment');
  const { operations, allOperations } = await import('../src/operations/api');
  const originals = { release: operations.releaseRoute, assign: operations.assignOrder, routes: allOperations.routes };
  let calls = 0;
  operations.releaseRoute = async () => { calls++; throw new Error('Unexpected release'); };
  operations.assignOrder = async () => { calls++; throw new Error('Unexpected assignment'); };
  allOperations.routes = async () => { calls++; return []; };
  try {
    for (const status of ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
      const order = { id: 'order-1', status } as components['schemas']['OrderView'];
      await assert.rejects(changeAssignment('acme', order, 'driver-2', 'vehicle-2', route('PLANNED')), /unavailable/);
      await assert.rejects(changeAssignment('acme', order, null, null, route('PLANNED')), /unavailable/);
      await assert.rejects(assignToDriver('acme', order, 'driver-2', 'vehicle-2'), /Only unassigned/);
    }
    assert.equal(calls, 0);
  } finally { operations.releaseRoute = originals.release; operations.assignOrder = originals.assign; allOperations.routes = originals.routes; }
});
