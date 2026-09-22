// Shared billing helpers used by the pricing engine (`pricingEngine.ts`).
// No quote formula lives here — see calculatePricing().

import { BillingConfig, FuelSurchargeSettings } from '../types/billing';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Monetary amounts are always rounded to the nearest cent. */
export const roundMoney = (amount: number): number => round2(amount);

/** Use hundredths of a kilometre and retain the configured billable floor. */
export const applyDistanceRules = (distanceKm: number, config: BillingConfig): number =>
  round2(Math.max(distanceKm, config.rules.minimumBillableKm));

/** Percentages may exceed 100; reject missing, negative and non-finite rates. */
export const isValidFuelPercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const fuelPercentForSettings = (fs: FuelSurchargeSettings): number => {
  if (!fs.enabled) return 0;
  if (fs.mode === 'fixed_percent') return isValidFuelPercent(fs.percent) ? fs.percent : NaN;

  const centsAbove = Math.max(0, (fs.currentFuelPrice - fs.baselineFuelPrice) * 100);
  return round2(centsAbove * fs.percentPerCentAboveBaseline);
};

export const resolveFuelPercent = (config: BillingConfig): number => fuelPercentForSettings(config.fuelSurcharge);

/** Only live settings pass through here. Frozen quote contexts keep their original mode. */
export const normalizeFuelSurcharge = (fuel: FuelSurchargeSettings): FuelSurchargeSettings => {
  // Retain invalid entries for validation rather than silently turning an unknown charge off.
  const percent = fuel.mode === 'fixed_percent' && !isValidFuelPercent(fuel.percent)
    ? NaN : fuelPercentForSettings(fuel);
  return { ...fuel, mode: 'fixed_percent', percent, enabled: !isValidFuelPercent(percent) || percent > 0 };
};
