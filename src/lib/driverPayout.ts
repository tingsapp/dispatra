import { DriverPayoutSnapshot } from '../domain/operations';
import { orderLifecycle } from '../domain/validation';
import { Driver, Job } from '../types';
import { PricingSnapshot } from '../types/pricing';

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const completed = (job: Job) => ['COMPLETED', 'INVOICED'].includes(orderLifecycle(job));

/** Pricing bases are frozen on the order; percentages are frozen at completion. */
export function payoutFromPrice(driverId: string, price: PricingSnapshot, orderSharePercent: number, fuelSharePercent: number, now = new Date()): DriverPayoutSnapshot | undefined {
  if (price.status !== 'PRICED' || ![orderSharePercent, fuelSharePercent].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return undefined;
  const orderBase = Math.max(0, cents(price.serviceFreight));
  const fuelBase = Math.max(0, cents(price.fuelSurcharge));
  const orderEarnings = cents(orderBase * orderSharePercent / 100);
  const fuelEarnings = cents(fuelBase * fuelSharePercent / 100);
  return { driverId, calculatedAt: now.toISOString(), priceStage: price.stage, currency: price.currency, orderSharePercent, fuelSharePercent, orderBase, fuelBase, orderEarnings, fuelEarnings, total: cents(orderEarnings + fuelEarnings) };
}

/** Capture a payout only when an assigned order first becomes completed. */
export function freezeCompletedOrder(previous: Job | undefined, next: Job, drivers: Driver[], now = new Date()): Job {
  if (!completed(next)) return next;
  if (previous && completed(previous)) return { ...next, completedAt: next.completedAt ?? previous.completedAt, driverPayout: next.driverPayout ?? previous.driverPayout };
  const driver = drivers.find(item => item.id === next.assignedDriverId);
  const payout = driver?.employmentType === 'CONTRACTOR' && next.pricing
    ? payoutFromPrice(driver.id, next.pricing, driver.revenueSharePercent ?? 70, driver.fuelSurchargeSharePercent ?? 100, now)
    : undefined;
  return { ...next, completedAt: next.completedAt ?? now.toISOString(), driverPayout: next.driverPayout ?? payout };
}

/** Final price may settle differently; retained percentages never follow later driver edits. */
export function payoutAtFinalPrice(saved: DriverPayoutSnapshot | undefined, finalPrice: PricingSnapshot, now = new Date()): DriverPayoutSnapshot | undefined {
  return saved ? payoutFromPrice(saved.driverId, finalPrice, saved.orderSharePercent, saved.fuelSharePercent, now) ?? saved : undefined;
}
