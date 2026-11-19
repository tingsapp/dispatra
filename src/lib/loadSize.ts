import type { components } from '../portal/schema';
import type { PricingPackageInput, PricingStopInput } from '../types/pricing';
import { setPackageCharge, packageHasCharge, type PackageChargeCode } from './packageAccessorials';

export type LoadSize = NonNullable<components['schemas']['Booking-Input']['load_size']>;

export const LOAD_SIZE_OPTIONS: { value: LoadSize; label: string }[] = [
  { value: 'FTL', label: 'Full truckload (FTL)' },
  { value: 'LTL', label: 'Less than truckload (LTL)' },
  { value: 'SMALL_PARCEL', label: 'Small parcel' },
];

/** Rate cards saved before load sizes existed price LTL. */
export const cardLoadSize = (card?: { loadSize?: LoadSize } | null): LoadSize => card?.loadSize ?? 'LTL';
export const loadSizeShort = (value: LoadSize) => value === 'SMALL_PARCEL' ? 'Small parcel' : value;

export const loadSizeLabel = (value?: LoadSize | null) => LOAD_SIZE_OPTIONS.find(option => option.value === value)?.label ?? '';

/** Load sizes a vehicle type can be offered for (Settings → Vehicle Types). Small parcel orders choose no vehicle type. */
export type VehicleLoadSize = Extract<LoadSize, 'FTL' | 'LTL'>;
export const VEHICLE_LOAD_SIZES: VehicleLoadSize[] = ['FTL', 'LTL'];

/** Order form fields per load size. The API enforces the same rules (`Booking.load_fields`).
 * FTL: vehicle type required, no service level, no package weight or size (the load fills the vehicle: the API uses its payload and cargo space).
 * LTL: service level and package sizes required, vehicle type optional. Small parcel: service level and package sizes, no vehicle type. */
export function loadFields(value?: LoadSize | null) {
  return {
    service: value !== 'FTL',
    vehicle: value === 'FTL' ? 'required' as const : value === 'SMALL_PARCEL' ? 'hidden' as const : 'optional' as const,
    packageSizes: value !== 'FTL',
  };
}

const LOAD_FLAGS: PackageChargeCode[] = ['FRAGILE', 'DG'];
/** A full truckload has no package lines in the form: it books one load line per pickup → drop-off link (quantity 1, reusing a
 * matching line's identity), and Fragile/DG from Accessorials cover the whole load. Returns `packages` itself when nothing changes. */
export function fullTruckLoad(packages: PricingPackageInput[], stops: PricingStopInput[]): PricingPackageInput[] {
  const pickups = stops.filter(stop => stop.type === 'PICKUP');
  const drops = stops.filter(stop => stop.type === 'DROPOFF');
  const only = (list: PricingStopInput[]) => list.length === 1 ? list[0].id : undefined;
  const flags = LOAD_FLAGS.filter(code => packages.some(pkg => packageHasCharge(pkg, code)));
  const lines = drops.flatMap(drop => [...new Set(drop.pickupIds ?? (pickups.length === 1 ? [pickups[0].id] : []))]
    .filter(pickupId => pickups.some(pickup => pickup.id === pickupId)).map(pickupId => {
      const line = packages.find(pkg => (pkg.pickupStopId ?? only(pickups)) === pickupId && (pkg.deliveryStopId ?? only(drops)) === drop.id)
        ?? { id: `load_${pickupId}_${drop.id}`, quantity: 1, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, declaredValue: 0, missingFields: ['weightKg', 'lengthCm', 'widthCm', 'heightCm'] };
      const booked = { ...line, quantity: 1, pickupStopId: pickupId, deliveryStopId: drop.id, missingFields: line.missingFields?.filter(field => field !== 'quantity') };
      return LOAD_FLAGS.reduce((pkg, code) => setPackageCharge(pkg, code, flags.includes(code)), booked);
    }));
  return !lines.length || JSON.stringify(lines) === JSON.stringify(packages) ? packages : lines;
}
