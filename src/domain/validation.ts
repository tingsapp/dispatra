import { isValidEmail } from '../lib/email';
import { cityFromAddress } from '../lib/driverCity';
import { PricingOrderInput } from '../types/pricing';
import { Driver, Order } from '../types';
import { ORDER_LIFECYCLE_LABELS, ORDER_ATTENTION_LABELS, normalizeLifecycle, OrderAttentionFlag, OrderLifecycle } from './operations';
import { Customer } from '../lib/customerStorage';
import { VehicleAsset } from '../lib/vehicleStorage';
export const splitTags = (s: string) => [...new Set(s.split(',').map(x => x.trim()).filter(Boolean))];
const nonnegative = (n: number | undefined) => n == null || Number.isFinite(n) && n >= 0;
const emailOK = (s?: string) => !s || isValidEmail(s);
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
  if (input.adjustments.some(a => !a.reason.trim() || !Number.isFinite(a.amount))) errors.push('Every price adjustment needs a valid amount and reason.');
  return errors;
}
export function validateCustomer(c: Partial<Customer>, all: Customer[], id?: string): string[] {
  if (!c.name?.trim() || !c.code?.trim()) return ['Customer name and number are required.'];
  if (all.some(x => x.id !== id && x.code.toLowerCase() === c.code!.trim().toLowerCase())) return ['Customer number already exists.'];
  if (!emailOK(c.email) || c.addresses?.some(a => !a.address.trim())) return ['Enter a valid email and an address for each saved location.'];
  if (c.discount && (!nonnegative(c.discount.value) || c.discount.type === 'PERCENT' && c.discount.value > 100)) return ['Enter a valid discount; percentage must be between 0 and 100.'];
  if (c.defaultWindowEnd && (!c.defaultWindowStart || c.defaultWindowEnd <= c.defaultWindowStart)) return ['Default window end must be after start.'];
  return [];
}
export function validateDriver(d: Driver, all: Driver[]): string[] {
  if (d.maxActiveOrders != null && (!Number.isSafeInteger(d.maxActiveOrders) || d.maxActiveOrders < 1)) return ['Maximum active orders must be a whole number of at least 1.'];
  if (!d.name.trim() || !d.phone?.trim()) return ['Driver name and phone are required.'];
  if (!d.address?.trim()) return ['Driver address is required.'];
  if (!cityFromAddress(d.address)) return ['Driver address must include a Canadian city and province.'];
  if (!d.email?.trim() || !emailOK(d.email)) return ['Enter a valid driver email for portal login.'];
  if (!d.driverNumber?.trim()) return ['Driver number could not be assigned.'];
  if (all.some(x => x.id !== d.id && (x.driverNumber ?? x.id).toLowerCase() === d.driverNumber!.trim().toLowerCase())) return ['Driver number already exists.'];
  if (d.currentVehicleId && all.some(x => x.id !== d.id && x.currentVehicleId === d.currentVehicleId)) return ['Vehicle is already linked to another driver.'];
  if (!emailOK(d.email) || !nonnegative(d.maximumWorkMinutes)) return ['Check email and maximum work minutes.'];
  return [...windowErrors(d.shiftStart, d.shiftEnd, 'Shift'), ...(d.availabilitySchedule ?? []).flatMap(a => !a.start || !a.end ? ['Availability needs a start and end.'] : windowErrors(a.start, a.end, 'Availability'))];
}
export function validateVehicle(v: VehicleAsset, all: VehicleAsset[]): string[] {
  if (!v.unitNumber.trim() || !v.plateNumber.trim() || !v.vehicleTypeId) return ['Unit number, licence plate and vehicle type are required.'];
  if (all.some(x => x.id !== v.id && (x.unitNumber.toLowerCase() === v.unitNumber.toLowerCase() || x.plateNumber.toLowerCase() === v.plateNumber.toLowerCase() && x.plateProvince === v.plateProvince))) return ['Unit number or plate/province already exists.'];
  if (![v.payloadCapacityKg,v.palletCapacity,v.cargoLengthCm,v.cargoWidthCm,v.cargoHeightCm,v.cargoVolumeM3].every(nonnegative) || !Number.isInteger(v.palletCapacity)) return ['Enter nonnegative capacities and whole pallet counts.'];
  if ([v.cargoLengthCm,v.cargoWidthCm,v.cargoHeightCm].some(value => value == null || !Number.isFinite(value) || value <= 0)) return ['Box length, width and height must be greater than zero.'];
  if (v.maxStops != null && (!Number.isSafeInteger(v.maxStops) || v.maxStops < 1)) return ['Maximum stops must be a positive whole number.'];
  if (v.availability === 'UNAVAILABLE' && !v.unavailableReason?.trim()) return ['Enter the reason this vehicle is unavailable.'];
  return windowErrors(v.unavailableFrom, v.unavailableUntil, 'Unavailability');
}
export const orderLifecycle = (o: Order): OrderLifecycle => normalizeLifecycle(o.lifecycleStatus) ?? (o.status === 'completed' ? 'COMPLETED' : o.assignedDriverId ? 'ASSIGNED' : 'NEW');
export const orderClosed = (o: Order) => ['IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED'].includes(orderLifecycle(o));
export const orderEditable = (o: Order) => !o.invoicePreview && o.pricing?.stage !== 'FINAL' && !orderClosed(o);
export const lifecycleLabel = (o: Order) => ORDER_LIFECYCLE_LABELS[orderLifecycle(o)];
/** Exceptions overlaying the status; each clears itself when its cause goes away. */
export const orderAttention = (o: Order): { flag: OrderAttentionFlag; label: string; detail?: string }[] => {
  const flags: { flag: OrderAttentionFlag; label: string; detail?: string }[] = [];
  const open = !['COMPLETED', 'INVOICED', 'CANCELLED'].includes(orderLifecycle(o));
  if (open && o.pricing && o.pricing.status !== 'PRICED') flags.push({ flag: 'PRICING', label: ORDER_ATTENTION_LABELS.PRICING, detail: o.pricing.errors[0]?.message });
  if (open && o.status === 'at_risk') flags.push({ flag: 'AT_RISK', label: ORDER_ATTENTION_LABELS.AT_RISK, detail: o.riskText });
  if (open && o.status === 'late_start') flags.push({ flag: 'LATE_START', label: ORDER_ATTENTION_LABELS.LATE_START, detail: o.riskText });
  if (o.pricingInput?.stops.some(s => s.stopStatus === 'FAILED')) flags.push({ flag: 'FAILED_ATTEMPT', label: ORDER_ATTENTION_LABELS.FAILED_ATTEMPT });
  return flags;
};
