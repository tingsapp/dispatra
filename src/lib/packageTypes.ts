import type { PricingPackageInput } from '../types/pricing';
import type { PackageType } from '../types/simplePricing';
import type { LoadSize } from './loadSize';

type Measurement = 'weightKg' | 'lengthCm' | 'widthCm' | 'heightCm';
const MEASUREMENTS: Measurement[] = ['weightKg', 'lengthCm', 'widthCm', 'heightCm'];
const TYPE_FIELD = { weightKg: 'defaultWeightKg', lengthCm: 'lengthCm', widthCm: 'widthCm', heightCm: 'heightCm' } as const;

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

/** The type a package starts with for a load size: LTL takes the Pallet type when the company has one, otherwise
 * LTL and Small parcel take the company Default; a full truckload has no packages. */
export function loadPackageTypeId(loadSize: LoadSize | null | undefined, types: PackageType[] = []): string | null {
  if (!loadSize || loadSize === 'FTL') return null;
  const active = packageTypeOptions(types);
  const fallback = active.find(type => type.isDefault)?.id ?? null;
  return loadSize === 'LTL' ? active.find(type => type.code.toUpperCase() === 'PALLET')?.id ?? fallback : fallback;
}

/** Packages without a type, or still on the type the previous load size gave them, take the new size's type.
 * Its saved weight and size fill only measurements the booker has not entered. */
export function prefillPackageTypes(packages: PricingPackageInput[], loadSize: LoadSize | null | undefined, types: PackageType[] = [], previous?: LoadSize | null): PricingPackageInput[] {
  const id = loadPackageTypeId(loadSize, types), automatic = loadPackageTypeId(previous, types);
  if (!id) return packages;
  return packages.map(pkg => {
    if (pkg.packageTypeId && pkg.packageTypeId !== automatic) return pkg;
    // Measurements the replaced automatic type brought are cleared first, so a parcel never keeps pallet sizes.
    const before = types.find(type => type.id === pkg.packageTypeId);
    const brought = before ? MEASUREMENTS.filter(key => before[TYPE_FIELD[key]] != null && pkg[key] === before[TYPE_FIELD[key]]) : [];
    const cleared = brought.length ? { ...pkg, ...Object.fromEntries(brought.map(key => [key, 0])), missingFields: [...new Set([...(pkg.missingFields ?? []), ...brought])] } : pkg;
    const filled = applyPackageType(cleared, id, types);
    const entered = pkg.packageTypeId ? [] : MEASUREMENTS.filter(key => pkg[key] > 0 && !pkg.missingFields?.includes(key));
    return { ...filled, ...Object.fromEntries(entered.map(key => [key, pkg[key]])) };
  });
}
