// Shared billing helpers used by the pricing engine (`pricingEngine.ts`).
// No quote formula lives here — see calculatePricing().

import { BillingConfig } from '../types/billing';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const roundMoney = (amount: number, rule: BillingConfig['rules']['moneyRounding']): number => {
  switch (rule) {
    case 'nearest_05':
      return round2(Math.round(amount * 20) / 20);
    case 'nearest_25':
      return round2(Math.round(amount * 4) / 4);
    case 'nearest_1':
      return round2(Math.round(amount));
    default:
      return round2(amount);
  }
};

/** Round distance up to the configured increment, then apply the billable floor. */
export const applyDistanceRules = (distanceKm: number, config: BillingConfig): number => {
  const { distanceRoundingKm, minimumBillableKm } = config.rules;
  let km = distanceKm;
  if (distanceRoundingKm > 0) {
    km = Math.ceil(km / distanceRoundingKm) * distanceRoundingKm;
  }
  return round2(Math.max(km, minimumBillableKm));
};

/** Effective fuel-surcharge percentage, resolving the index-pegged mode. */
export const resolveFuelPercent = (config: BillingConfig): number => {
  const fs = config.fuelSurcharge;
  if (!fs.enabled) return 0;
  if (fs.mode === 'fixed_percent') return Math.max(0, fs.percent);

  const centsAbove = Math.max(0, (fs.currentFuelPrice - fs.baselineFuelPrice) * 100);
  return round2(centsAbove * fs.percentPerCentAboveBaseline);
};
