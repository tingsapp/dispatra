import { VehicleType } from '../types/simplePricing';
import { PricingPackageInput } from '../types/pricing';

/** Company vehicle types offered for choice, A–Z. `fleet_` records are per-vehicle pricing copies in /prototype, not types. */
export const listedVehicleTypes = (types: VehicleType[]) => types.filter(type => type.active && !type.id.startsWith('fleet_')).sort((a, b) => a.name.localeCompare(b.name));

/** Body equipment a required vehicle type imposes on the assigned truck. Other equipment (e.g. Liftgate) is optional. */
export const BODY_EQUIPMENT = ['Refrigeration', 'Open deck'];
const key = (value: string) => value.toLowerCase().replace(/[_\s]+/g, ' ').trim();
export const bodyRequirements = (type?: Pick<VehicleType, 'equipment'> | null): string[] =>
  (type?.equipment ?? []).filter(item => BODY_EQUIPMENT.some(body => key(body) === key(item)));
/** A truck meets a required type when it has that type's body equipment; the load itself is checked against the truck's own capacity. */
export const meetsBodyRequirement = (truckEquipment: string[] | undefined, type?: Pick<VehicleType, 'equipment'> | null) =>
  bodyRequirements(type).every(need => (truckEquipment ?? []).some(have => key(have) === key(need)));

/** Smallest general (no special body) vehicle type the declared load fits: total weight, pallets and each item's size, which may turn on its base. */
export function suggestVehicleType(types: VehicleType[], packages: PricingPackageInput[]): string | null {
  const weight = packages.reduce((sum, item) => sum + item.quantity * item.weightKg, 0);
  const pallets = packages.reduce((sum, item) => sum + (item.handlingUnit === 'PALLET' ? item.quantity : 0), 0);
  const fits = (type: VehicleType) => weight <= type.payloadCapacityKg + 1e-6 && pallets <= type.palletCapacity &&
    packages.every(item => !type.cargoLengthCm || !type.cargoWidthCm || !type.cargoHeightCm || item.heightCm <= type.cargoHeightCm &&
      (item.lengthCm <= type.cargoLengthCm && item.widthCm <= type.cargoWidthCm || item.widthCm <= type.cargoLengthCm && item.lengthCm <= type.cargoWidthCm));
  return listedVehicleTypes(types).filter(type => !bodyRequirements(type).length).sort((a, b) => a.payloadCapacityKg - b.payloadCapacityKg).find(fits)?.id ?? null;
}
