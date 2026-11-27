import assert from 'node:assert/strict';
import test from 'node:test';
import { driverMoves } from '../src/operations/adapters';

test('the monitor marks each stop the driver moved up with its latest change time', () => {
  assert.deepEqual(driverMoves({ driver_moves: [{ stop_id: 'c', at: '2026-11-27T10:00:00Z' }, { stop_id: 'd', at: '2026-11-27T10:05:00Z' }, { stop_id: 'c', at: '2026-11-27T10:09:00Z' }] }),
    { c: '2026-11-27T10:09:00Z', d: '2026-11-27T10:05:00Z' });
  assert.deepEqual(driverMoves({ revision: 2 }), {});
  assert.deepEqual(driverMoves({ driver_moves: [{ stop_id: 4 }, null] as never }), {});
  assert.deepEqual(driverMoves(undefined), {});
});
