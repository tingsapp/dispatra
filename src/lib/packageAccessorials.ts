import type { PricingAccessorialInput, PricingPackageInput } from '../types/pricing';
import type { AccessorialItem } from '../types/simplePricing';

export type PackageChargeCode = 'FRAGILE' | 'DG';

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
