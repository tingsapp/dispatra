import { PricingOrderInput } from '../types/pricing';
import { Driver, Order } from '../types';
import { Customer } from '../lib/customerStorage';
import { VehicleAsset } from '../lib/vehicleStorage';
export const splitTags = (s: string) => [...new Set(s.split(',').map(x => x.trim()).filter(Boolean))];
const nonnegative = (n: number | undefined) => n == null || Number.isFinite(n) && n >= 0;
const emailOK = (s?: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const windowErrors = (start?: string | null, end?: string | null, label = 'Window'): string[] => {
  const valid = (v: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v) && Number.isFinite(Date.parse(v));
  if (start && !valid(start) || end && !valid(end)) return [`${label}: enter valid dates and times.`];
  return end && (!start || end <= start) ? [`${label}: end must be after start.`] : [];
};
export function validateOrderFacts(input: PricingOrderInput): string[] {
  const errors: string[] = [];
  const ids = input.stops.map(s => s.id);
  if (new Set(ids).size !== ids.length) errors.push('Stop IDs must be unique.');
  if (!input.stops.some(s => s.type === 'PICKUP') || !input.stops.some(s => s.type === 'DROPOFF')) errors.push('Include a pickup and a drop-off.');
  input.stops.forEach((s, i) => {
    if (!s.label?.trim()) errors.push(`Stop ${i + 1}: address is required.`);
    errors.push(...windowErrors(s.windowStart, s.windowEnd, `Stop ${i + 1}`));
    if (!emailOK(s.contactEmail)) errors.push(`Stop ${i + 1}: invalid email.`);
    if (!nonnegative(s.handlingMinutes) || !nonnegative(s.waitMinutes)) errors.push(`Stop ${i + 1}: minutes must be nonnegative.`);
    if (s.type === 'DROPOFF' && (!s.pickupIds?.length || s.pickupIds.some(id => !input.stops.slice(0, i).some(p => p.id === id && p.type === 'PICKUP')))) errors.push(`Stop ${i + 1}: choose supplying pickups that occur before delivery.`);
  });
  if (!input.packages.length) errors.push('Add at least one item.');
  input.packages.forEach((p, i) => {
    if (!Number.isInteger(p.quantity) || p.quantity < 1 || ![p.weightKg,p.lengthCm,p.widthCm,p.heightCm,p.declaredValue].every(nonnegative)) errors.push(`Item ${i + 1}: use a positive whole quantity and nonnegative measurements.`);
    const pickup = input.stops.findIndex(s => s.id === p.pickupStopId && s.type === 'PICKUP');
    const drop = input.stops.findIndex(s => s.id === p.deliveryStopId && s.type === 'DROPOFF');
    if (pickup < 0 || drop <= pickup || !input.stops[drop].pickupIds?.includes(p.pickupStopId!)) errors.push(`Item ${i + 1}: link its pickup and later delivery, including the supplying pickup.`);
  });
  errors.push(...windowErrors(input.scheduledAt, input.scheduledEndAt, 'Service window'));
  if (input.rateCardOverrideId && !input.overrideReason?.trim()) errors.push('Enter a reason for the rate card override.');
  if (input.adjustments.some(a => !a.reason.trim() || !Number.isFinite(a.amount))) errors.push('Every price adjustment needs a valid amount and reason.');
  return errors;
}
export function validateCustomer(c: Partial<Customer>, all: Customer[], id?: string): string[] {
  if (!c.name?.trim() || !c.code?.trim()) return ['Customer name and number are required.'];
  if (all.some(x => x.id !== id && x.code.toLowerCase() === c.code!.trim().toLowerCase())) return ['Customer number already exists.'];
  if (!emailOK(c.email) || !emailOK(c.billingEmail) || c.addresses?.some(a => !a.address.trim())) return ['Enter valid emails and an address for each saved location.'];
  if (c.defaultWindowEnd && (!c.defaultWindowStart || c.defaultWindowEnd <= c.defaultWindowStart)) return ['Default window end must be after start.'];
  return [];
}
export function validateDriver(d: Driver, all: Driver[]): string[] {
  if (!d.name.trim() || !d.driverNumber?.trim() || !d.phone?.trim()) return ['Driver name, number and phone are required.'];
  if (all.some(x => x.id !== d.id && (x.driverNumber ?? x.id).toLowerCase() === d.driverNumber!.trim().toLowerCase())) return ['Driver number already exists.'];
  if (d.currentVehicleId && all.some(x => x.id !== d.id && x.currentVehicleId === d.currentVehicleId)) return ['Vehicle is already linked to another driver.'];
  if (!emailOK(d.email) || !nonnegative(d.maximumWorkMinutes)) return ['Check email and maximum work minutes.'];
  return [...windowErrors(d.shiftStart, d.shiftEnd, 'Shift'), ...(d.availabilitySchedule ?? []).flatMap(a => !a.start || !a.end ? ['Availability needs a start and end.'] : windowErrors(a.start, a.end, 'Availability'))];
}
export function validateVehicle(v: VehicleAsset, all: VehicleAsset[]): string[] {
  if (!v.unitNumber.trim() || !v.plateNumber.trim() || !v.vehicleTypeId) return ['Unit number, licence plate and vehicle type are required.'];
  if (all.some(x => x.id !== v.id && (x.unitNumber.toLowerCase() === v.unitNumber.toLowerCase() || x.plateNumber.toLowerCase() === v.plateNumber.toLowerCase() && x.plateProvince === v.plateProvince))) return ['Unit number or plate/province already exists.'];
  if (![v.payloadCapacityKg,v.palletCapacity,v.cargoLengthCm,v.cargoWidthCm,v.cargoHeightCm,v.cargoVolumeM3].every(nonnegative) || !Number.isInteger(v.palletCapacity)) return ['Enter nonnegative capacities and whole pallet counts.'];
  if (v.availability === 'UNAVAILABLE' && !v.unavailableReason?.trim()) return ['Enter the reason this vehicle is unavailable.'];
  return windowErrors(v.unavailableFrom, v.unavailableUntil, 'Unavailability');
}
export const orderLifecycle = (o: Order) => o.lifecycleStatus ?? (o.status === 'completed' ? 'COMPLETED' : o.assignedDriverId ? 'ASSIGNED' : o.pricing?.status === 'PRICED' ? 'READY_FOR_DISPATCH' : 'SUBMITTED');
export const orderEditable = (o: Order) => !o.invoicePreview && o.pricing?.stage !== 'FINAL' && !['IN_EXECUTION','COMPLETED','BILLING_FINALIZATION','INVOICED','CANCELLED','FAILED'].includes(orderLifecycle(o));
export const lifecycleLabel = (o: Order) => orderLifecycle(o).toLowerCase().replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
