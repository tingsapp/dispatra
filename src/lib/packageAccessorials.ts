import type { PricingAccessorialInput, PricingPackageInput, PricingStopInput } from '../types/pricing';
import type { AccessorialItem } from '../types/simplePricing';

export type PackageChargeCode = 'FRAGILE' | 'DG';
/** The API adds this once per order when a delivery falls on a weekend or company holiday; it is never ticked by hand. */
export const HOLIDAY_WEEKEND_CODE = 'HOLIDAY_WEEKEND';

export const packageHasCharge = (pkg: PricingPackageInput, code: PackageChargeCode): boolean =>
  code === 'FRAGILE' ? !!pkg.fragile : !!pkg.handlingTags?.includes('DANGEROUS_GOODS');

export function setPackageCharge(pkg: PricingPackageInput, code: PackageChargeCode, checked: boolean): PricingPackageInput {
  if (code === 'FRAGILE') return { ...pkg, fragile: checked };
  const tags = new Set(pkg.handlingTags ?? []);
  if (checked) tags.add('DANGEROUS_GOODS');
  else tags.delete('DANGEROUS_GOODS');
  return { ...pkg, handlingTags: [...tags] };
}

/** Package handling flags own these selections; the charge follows each row's Qty. */
export function syncPackageAccessorials(
  packages: PricingPackageInput[], selections: PricingAccessorialInput[], catalogue: AccessorialItem[],
): PricingAccessorialInput[] {
  const linked = catalogue.filter(item => item.active && (item.code === 'FRAGILE' || item.code === 'DG'));
  const linkedIds = new Set(linked.map(item => item.id));
  return [
    ...selections.filter(item => !linkedIds.has(item.accessorialId)),
    ...linked.map(item => ({ accessorialId: item.id, quantity: packages.reduce((total, pkg) =>
      total + (packageHasCharge(pkg, item.code as PackageChargeCode) ? pkg.quantity : 0), 0) }))
      .filter(item => item.quantity > 0),
  ];
}

/** Power Liftgate at Pickup and at Drop-off, each linked to its stops' liftgate checkboxes. */
export const LIFTGATE_CODES: Record<PricingStopInput['type'], string> = { PICKUP: 'LIFTGATE', DROPOFF: 'LIFTGATE_DROPOFF' };
export const isPackageCharge = (item: AccessorialItem): boolean => item.code === 'FRAGILE' || item.code === 'DG';
export const liftgateStopType = (item: AccessorialItem): PricingStopInput['type'] | undefined =>
  item.code === LIFTGATE_CODES.PICKUP ? 'PICKUP' : item.code === LIFTGATE_CODES.DROPOFF ? 'DROPOFF' : undefined;

/** Pickups or drop-offs needing a power liftgate select their Liftgate Accessorial once per order; with none, a hand-picked one is kept unless `release`. */
export function syncStopAccessorials(
  stops: PricingStopInput[], selections: PricingAccessorialInput[], catalogue: AccessorialItem[], release = false,
): PricingAccessorialInput[] {
  return (['PICKUP', 'DROPOFF'] as const).reduce((current, type) => {
    const liftgate = catalogue.find(item => item.active && item.code === LIFTGATE_CODES[type]);
    if (!liftgate) return current;
    const selected = current.some(item => item.accessorialId === liftgate.id);
    if (stops.some(stop => stop.type === type && stop.liftgate)) return selected ? current : [...current, { accessorialId: liftgate.id, quantity: 1 }];
    return release && selected ? current.filter(item => item.accessorialId !== liftgate.id) : current;
  }, selections);
}
