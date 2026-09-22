import { ZoneRate, ZoneWeightBand } from '../types/pricing';

export const sortWeightBands = (bands: ZoneWeightBand[]) => [...bands].sort((a, b) =>
  (a.maxWeightKg ?? Infinity) - (b.maxWeightKg ?? Infinity));

const weightIssue = (weight: number | null) => weight == null || !Number.isFinite(weight) || weight <= 0
  ? 'Enter a weight limit greater than zero for every band.' : null;
const priceIssue = (amount: number | null) => amount == null || !Number.isFinite(amount) || amount < 0
  ? 'Enter a price of zero or more for every band.' : null;

/** Field-specific feedback uses the same rules as card-save validation. */
export function zoneBandFieldIssues(band: ZoneWeightBand, bands: ZoneWeightBand[]) {
  return {
    weight: weightIssue(band.maxWeightKg) ?? (bands.filter(other => other.maxWeightKg === band.maxWeightKg).length > 1
      ? 'Each weight limit must be different.' : null),
    price: priceIssue(band.amount),
  };
}

export function zoneRateIssue(rate: ZoneRate): string | null {
  if (!rate.weightBands) return Number.isFinite(rate.amount) && rate.amount >= 0 ? null : 'Enter a price of zero or more.';
  if (!rate.weightBands.length) return 'Add a weight band.';
  const limits = new Set<number>();
  for (const band of rate.weightBands) {
    const weight = weightIssue(band.maxWeightKg);
    if (weight) return weight;
    const price = priceIssue(band.amount);
    if (price) return price;
    if (limits.has(band.maxWeightKg!)) return 'Each weight limit must be different.';
    limits.add(band.maxWeightKg!);
  }
  return null;
}

/** Zero is a valid price. Undefined means this movement requires a quote. */
export function zoneAmountForWeight(rate: ZoneRate, weightKg: number): number | undefined {
  if (zoneRateIssue(rate)) return undefined;
  if (!rate.weightBands) return rate.amount;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return undefined;
  return sortWeightBands(rate.weightBands).find(band => band.maxWeightKg! >= weightKg)?.amount ?? undefined;
}
