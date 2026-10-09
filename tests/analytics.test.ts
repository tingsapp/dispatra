import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyticsBounds, activityDays, chartDays } from '../src/operations/analyticsAdapters';
import { DEMO_ANALYTICS } from '../src/lib/reportStorage';

test('company date bounds handle spring and fall DST without a fixed 24-hour assumption', () => {
  const spring = analyticsBounds({ kind: 'day', date: '2026-03-08' }, 'America/Vancouver');
  assert.equal(Date.parse(spring.end!) - Date.parse(spring.start!), 23 * 3600000);
  const fall = analyticsBounds({ kind: 'day', date: '2026-11-01' }, 'America/Vancouver');
  assert.equal(Date.parse(fall.end!) - Date.parse(fall.start!), 25 * 3600000);
});
test('charts zero-fill days and aggregate long ranges without losing counts', () => {
  const days = chartDays(DEMO_ANALYTICS, { kind: 'range', from: '2026-09-08', to: '2026-09-10' });
  assert.deepEqual(days.map(day => day.orders), [0, 7, 0]);
  const buckets = chartDays(DEMO_ANALYTICS, { kind: 'range', from: '2026-01-01', to: '2026-12-31' });
  assert.ok(buckets.length <= 13);
  assert.equal(buckets.reduce((sum, day) => sum + day.orders, 0), 7);
  assert.equal(buckets.reduce((sum, day) => sum + day.on_time + day.late + day.not_measured, 0), 7);
});
test('activity counts saved identities once per period, excludes unassigned drivers and fills empty dates', () => {
  const rows = DEMO_ANALYTICS.rows.map((row, index) => ({ ...row, shipper_name: 'Same display name',
    shipper_id: index < 4 ? 'shipper-1' : 'shipper-2', driver_id: index < 4 ? 'driver-1' : null }));
  const days = activityDays({ ...DEMO_ANALYTICS, rows }, { kind: 'range', from: '2026-09-08', to: '2026-09-10' }, 'America/Vancouver');
  assert.deepEqual(days.map(({ orders, drivers, shippers }) => ({ orders, drivers, shippers })), [
    { orders: 0, drivers: 0, shippers: 0 }, { orders: 7, drivers: 1, shippers: 2 }, { orders: 0, drivers: 0, shippers: 0 },
  ]);
  assert.deepEqual(activityDays({ ...DEMO_ANALYTICS, orders: 0, daily: [], rows: [] }, { kind: 'all' }, 'America/Vancouver'), []);
});
test('activity uses company dates and distinct identities across aggregated periods', () => {
  const rows = [
    { ...DEMO_ANALYTICS.rows[0], scheduled_at: '2026-09-10T02:00:00Z', shipper_id: 'shipper-1', driver_id: 'driver-1' },
    { ...DEMO_ANALYTICS.rows[1], scheduled_at: '2026-09-10T19:00:00Z', shipper_id: 'shipper-1', driver_id: 'driver-1' },
  ];
  const data = { ...DEMO_ANALYTICS, orders: 2, rows, daily: ['2026-09-09', '2026-09-10'].map(date => ({ date, orders: 1, completed: 1, on_time: 1, late: 0, not_measured: 0 })) };
  const daily = activityDays(data, { kind: 'range', from: '2026-09-09', to: '2026-09-10' }, 'America/Vancouver');
  assert.deepEqual(daily.map(day => day.drivers), [1, 1]);
  const periods = activityDays(data, { kind: 'range', from: '2026-09-01', to: '2026-12-31' }, 'America/Vancouver');
  const period = periods.find(day => day.orders === 2)!;
  assert.equal(period.drivers, 1);
  assert.equal(period.shippers, 1);
});
