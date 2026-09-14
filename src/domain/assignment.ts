import { Driver, Order } from '../types';
import { PricingOrderInput } from '../types/pricing';
import { VehicleAsset } from '../lib/vehicleStorage';
import { validateOrderFacts } from './validation';
const contains = (have: string[] | undefined, need: string[] | undefined) => (need ?? []).every(n => (have ?? []).some(h => h.toLowerCase() === n.toLowerCase()));
/** Single-order load progression. Combined route optimization remains API-owned. */
export function validateLoad(input: PricingOrderInput, vehicle: VehicleAsset): string[] {
  const issues = validateOrderFacts(input);
  if (issues.length) return issues;
  let weight = 0, volume = 0, pallets = 0;
  for (const [i, stop] of input.stops.entries()) {
    for (const p of input.packages) {
      const sign = p.pickupStopId === stop.id ? 1 : p.deliveryStopId === stop.id ? -1 : 0;
      weight += sign * p.quantity * p.weightKg;
      volume += sign * p.quantity * p.lengthCm * p.widthCm * p.heightCm / 1e6;
      pallets += sign * (p.handlingUnit === 'PALLET' ? p.quantity : 0);
      if (sign === 1 && [vehicle.cargoLengthCm,vehicle.cargoWidthCm,vehicle.cargoHeightCm].every(n => n != null && n > 0)) {
        // Upright cargo may rotate on its base; do not turn freight on its side.
        const fits = p.heightCm <= vehicle.cargoHeightCm! && (p.lengthCm <= vehicle.cargoLengthCm! && p.widthCm <= vehicle.cargoWidthCm! || p.widthCm <= vehicle.cargoLengthCm! && p.lengthCm <= vehicle.cargoWidthCm!);
        if (!fits) issues.push(`${p.description || 'Item'} does not fit the vehicle cargo dimensions.`);
      }
    }
    if (weight > vehicle.payloadCapacityKg + 1e-6) issues.push(`Stop ${i + 1}: loaded weight exceeds payload capacity.`);
    if (vehicle.cargoVolumeM3 != null && volume > vehicle.cargoVolumeM3 + 1e-6) issues.push(`Stop ${i + 1}: loaded volume exceeds cargo capacity.`);
    if (pallets > vehicle.palletCapacity) issues.push(`Stop ${i + 1}: loaded pallets exceed capacity.`);
  }
  return [...new Set(issues)];
}
export function validateOperationalAssignment(order: Partial<Order>, driver: Driver, fleet: VehicleAsset[], timeZone = 'America/Vancouver'): string[] {
  const errors: string[] = [];
  if (driver.accountStatus === 'INACTIVE' || driver.dutyStatus === 'OFF_DUTY' || driver.workStatus === 'ON_BREAK') errors.push('Driver must be active, on duty and not on break.');
  if (!contains(driver.skills, order.requiredSkills)) errors.push('Driver is missing required skills.');
  if (order.serviceAreaId && !contains(driver.serviceAreaIds, [order.serviceAreaId])) errors.push('Driver does not cover the service area.');
  const input = order.pricingInput;
  if (!input) return errors;
  if (input.packages.some(p => p.requiresTwoPeople) && !contains(driver.skills, ['Two people'])) errors.push('A two-person crew is required.');
  const requested = input.scheduledAt;
  // Organization wall values can be compared lexically. Existing non-ISO legacy shift labels are not interpreted.
  const dateKey = (value?: string | null) => {
    if (!value || !value.includes('T')) return null;
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return value;
    if (!Number.isFinite(Date.parse(value))) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(value));
    const get = (k: string) => parts.find(p => p.type === k)?.value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };
  const start = dateKey(requested), end = dateKey(input.scheduledEndAt) ?? start;
  if (start) {
    if (dateKey(driver.shiftStart) && start < dateKey(driver.shiftStart)! || dateKey(driver.shiftEnd) && end! > dateKey(driver.shiftEnd)!) errors.push('Order falls outside the driver shift.');
    if (driver.availabilitySchedule?.some(a => !a.available && dateKey(a.start) && dateKey(a.end) && start < dateKey(a.end)! && end! >= dateKey(a.start)!)) errors.push('Driver is unavailable during this period.');
  }
  const minutes = (input.estimatedMinutes ?? 0) + (input.durationBasis === 'TOTAL_SERVICE' ? 0 : (input.handlingMinutes ?? input.stops.reduce((n,s) => n + (s.handlingMinutes ?? 0), 0)) + input.stops.reduce((n,s) => n + s.waitMinutes, 0));
  if (driver.maximumWorkMinutes != null && minutes > driver.maximumWorkMinutes) errors.push('Order duration exceeds driver maximum work minutes.');
  const vehicle = fleet.find(v => v.id === driver.currentVehicleId);
  if (!vehicle) {
    if (order.version || order.requiredEquipment?.length) errors.push('Select a current fleet vehicle on the driver profile before assignment.');
    return errors;
  }
  if (vehicle.recordStatus === 'INACTIVE' || vehicle.availability === 'UNAVAILABLE') errors.push('Assigned fleet vehicle is unavailable.');
  if (vehicle.currentDriverId && vehicle.currentDriverId !== driver.id) errors.push('Fleet vehicle is assigned to another driver.');
  if (input.vehicleId && vehicle.vehicleTypeId !== input.vehicleId) errors.push('Assigned fleet vehicle does not match the required vehicle type.');
  if (driver.vehicleTypeQualifications?.length && vehicle.vehicleTypeId && !driver.vehicleTypeQualifications.includes(vehicle.vehicleTypeId)) errors.push('Driver is not qualified for this vehicle type.');
  if (!contains(vehicle.equipment, order.requiredEquipment)) errors.push('Fleet vehicle is missing required equipment.');
  if (order.serviceAreaId && !contains(vehicle.serviceAreaIds, [order.serviceAreaId])) errors.push('Fleet vehicle does not cover the service area.');
  if (start && vehicle.unavailableFrom && vehicle.unavailableUntil && start < vehicle.unavailableUntil && end! >= vehicle.unavailableFrom) errors.push('Fleet vehicle is unavailable during this period.');
  if (input.packages.every(p => p.pickupStopId && p.deliveryStopId)) errors.push(...validateLoad(input, vehicle));
  return errors;
}
