import type { PricingPackageInput } from '../types/pricing';
import type { PackageType } from '../types/simplePricing';

type Measurement = 'weightKg' | 'lengthCm' | 'widthCm' | 'heightCm';

/** Order choices: active types, plus a deleted one an existing package still uses. */
export const packageTypeOptions = (types: PackageType[] = [], selected?: string | null) => types.filter(type => type.active || type.id === selected);

/** Choosing a type fills its saved weight and size (and Qty 1 when blank); the Pallet type counts one pallet per piece until another type is chosen. */
export function applyPackageType(pkg: PricingPackageInput, typeId: string | null, types: PackageType[] = []): PricingPackageInput {
  const type = types.find(row => row.id === typeId);
  const previous = types.find(row => row.id === pkg.packageTypeId);
  const next: PricingPackageInput = { ...pkg, packageTypeId: type?.id ?? null };
  if (type && pkg.missingFields?.includes('quantity')) Object.assign(next, { quantity: 1, missingFields: pkg.missingFields.filter(key => key !== 'quantity') });
  const defaults: Array<[Measurement, number | null]> = type ? [['weightKg', type.defaultWeightKg], ['lengthCm', type.lengthCm], ['widthCm', type.widthCm], ['heightCm', type.heightCm]] : [];
  for (const [field, value] of defaults) {
    if (value == null || value <= 0) continue;
    next[field] = value;
    next.missingFields = next.missingFields?.filter(key => key !== field);
  }
  if (type?.code === 'PALLET') return { ...next, handlingUnit: 'PALLET', palletsPerUnit: Math.max(1, pkg.palletsPerUnit ?? 0) };
  if (previous?.code === 'PALLET') return { ...next, handlingUnit: undefined, palletsPerUnit: 0 };
  return next;
}
