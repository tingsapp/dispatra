// Shared billing helpers used by the pricing engine (`pricingEngine.ts`).
// No quote formula lives here — see calculatePricing().

import { BillingConfig } from '../types/billing';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Monetary amounts are always rounded to the nearest cent. */
export const roundMoney = (amount: number): number => round2(amount);

/** Use hundredths of a kilometre and retain the configured billable floor. */
export const applyDistanceRules = (distanceKm: number, config: BillingConfig): number =>
  round2(Math.max(distanceKm, config.rules.minimumBillableKm));

/** Effective fuel-surcharge percentage, resolving the index-pegged mode. */
export const resolveFuelPercent = (config: BillingConfig): number => {
  const fs = config.fuelSurcharge;
  if (!fs.enabled) return 0;
  if (fs.mode === 'fixed_percent') return Math.max(0, fs.percent);

  const centsAbove = Math.max(0, (fs.currentFuelPrice - fs.baselineFuelPrice) * 100);
  return round2(centsAbove * fs.percentPerCentAboveBaseline);
};
