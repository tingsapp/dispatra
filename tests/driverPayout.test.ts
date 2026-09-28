import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freezeCompletedOrder, payoutAtFinalPrice, payoutFromPrice } from '../src/lib/driverPayout';
import { Driver, Job } from '../src/types';
import { PricingSnapshot } from '../src/types/pricing';

const at = new Date('2026-09-22T12:00:00Z');
const price = { status: 'PRICED', stage: 'QUOTE', currency: 'CAD', serviceFreight: 120, fuelSurcharge: 15 } as unknown as PricingSnapshot;
const driver = { id: 'D1', employmentType: 'CONTRACTOR', revenueSharePercent: 65, fuelSurchargeSharePercent: 80 } as Driver;
const assigned = { id: 'J1', status: 'assigned', lifecycleStatus: 'ASSIGNED', assignedDriverId: driver.id, pricing: price } as unknown as Job;

test('completion freezes driver shares and the priced payout basis', () => {
  const done = freezeCompletedOrder(assigned, { ...assigned, status: 'completed', lifecycleStatus: 'COMPLETED' }, [driver], at);
  assert.equal(done.completedAt, at.toISOString());
  assert.deepEqual([done.driverPayout?.orderEarnings, done.driverPayout?.fuelEarnings, done.driverPayout?.total], [78, 12, 90]);
  const revised = freezeCompletedOrder(done, { ...done, version: 2 }, [{ ...driver, revenueSharePercent: 10 }], new Date('2026-09-23T12:00:00Z'));
  assert.deepEqual(revised.driverPayout, done.driverPayout);
  assert.equal(revised.completedAt, done.completedAt);
});

test('final pricing uses the saved percentages and new finalized amounts', () => {
  const saved = payoutFromPrice(driver.id, price, 65, 80, at)!;
  const final = payoutAtFinalPrice(saved, { ...price, stage: 'FINAL', serviceFreight: 150, fuelSurcharge: 20 }, new Date('2026-09-23T12:00:00Z'))!;
  assert.equal(final.orderSharePercent, 65);
  assert.equal(final.fuelSharePercent, 80);
  assert.equal(final.total, 113.5);
  assert.equal(final.priceStage, 'FINAL');
});

test('employees and legacy completions do not gain invented payout estimates', () => {
  const employee = { ...driver, employmentType: 'EMPLOYEE' } as Driver;
  assert.equal(freezeCompletedOrder(assigned, { ...assigned, status: 'completed', lifecycleStatus: 'COMPLETED' }, [employee], at).driverPayout, undefined);
  const legacy = { ...assigned, status: 'completed', lifecycleStatus: 'COMPLETED' } as unknown as Job;
  assert.equal(freezeCompletedOrder(legacy, { ...legacy, version: 2 }, [driver], at).driverPayout, undefined);
  assert.equal(payoutFromPrice(driver.id, { ...price, status: 'NEEDS_ATTENTION' }, 65, 80), undefined);
});
