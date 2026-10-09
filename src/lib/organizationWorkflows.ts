import { driverOrderLimit } from './driverStorage';
import { validateOperationalAssignment } from '../domain/assignment';
import { loadVehicles } from './vehicleStorage';
import { orderClosed, orderEditable } from '../domain/validation';
import { Driver, Job } from '../types';
import { PricingOrderInput } from '../types/pricing';
import { PricingContext } from './pricingEngine';

/** A datetime-local value is an organization wall time; ISO instants are converted. */
export const organizationTime = (value: string | Date, timeZone: string) => {
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return { day: value.slice(0, 10), clock: value.slice(11, 16) };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (key: string) => parts.find(p => p.type === key)?.value;
    return { day: `${get('year')}-${get('month')}-${get('day')}`, clock: `${get('hour')}:${get('minute')}` };
  } catch { return null; }
};

export const validateBooking = (order: PricingOrderInput, ctx: PricingContext, now = new Date()): string[] => {
  const service = ctx.catalogue.services.find(s => s.id === order.serviceId);
  if (!service?.active) return ['Select an active service.'];
  const zone = ctx.billing.general.timeZone ?? 'America/Vancouver';
  const scheduleErrors = validateBookingSchedule(order, zone, now);
  if (scheduleErrors.length || !order.scheduledAt) return scheduleErrors;
  const booked = organizationTime(now, zone);
  const requested = organizationTime(order.scheduledAt, zone);
  if (!booked || !requested) return ['Invalid service date or organization timezone.'];
  if (service.bookingCutoffTime && requested.day === booked.day && booked.clock > service.bookingCutoffTime) return [`${service.name} booking cutoff is ${service.bookingCutoffTime} ${zone}; choose a later service date.`];
  return [];
};

/** Validate a new booking against the company wall clock, including stop times and delivery order. */
export const validateBookingSchedule = (order: PricingOrderInput, timeZone: string, now = new Date()): string[] => {
  const current = organizationTime(now, timeZone);
  if (!current) return ['Invalid organization timezone.'];
  const currentWall = `${current.day}T${current.clock}`;
  const check = (value: string | null | undefined, label: string) => {
    if (!value) return null;
    const wall = organizationTime(value, timeZone);
    if (!wall) return `${label}: enter a valid date and time.`;
    return `${wall.day}T${wall.clock}` <= currentWall ? `${label} must be in the future.` : null;
  };
  const errors = [check(order.scheduledAt, 'Pickup time'),
    ...order.stops.map((stop, index) => check(stop.type === 'PICKUP' ? stop.windowStart : stop.windowEnd, `Stop ${index + 1} ${stop.type === 'PICKUP' ? 'pickup' : 'delivery'} time`))].filter((message): message is string => !!message);
  if (order.scheduledAt && order.scheduledEndAt) {
    const pickup = organizationTime(order.scheduledAt, timeZone);
    const delivery = organizationTime(order.scheduledEndAt, timeZone);
    if (pickup && delivery && `${delivery.day}T${delivery.clock}` <= `${pickup.day}T${pickup.clock}`) errors.push('Delivery time must be after pickup time.');
  }
  order.stops.forEach((stop, index) => {
    if (stop.type !== 'DROPOFF' || !stop.windowEnd) return;
    const delivery = organizationTime(stop.windowEnd, timeZone);
    if (!delivery) return;
    for (const pickupId of stop.pickupIds ?? []) {
      const pickupStop = order.stops.find(candidate => candidate.id === pickupId && candidate.type === 'PICKUP');
      const pickup = pickupStop?.windowStart && organizationTime(pickupStop.windowStart, timeZone);
      if (pickup && `${delivery.day}T${delivery.clock}` <= `${pickup.day}T${pickup.clock}`) {
        errors.push(`Stop ${index + 1} delivery time must be after its pickup time.`);
        break;
      }
    }
  });
  return errors;
};

/** Shared by direct/manual assignment and the static recommendation action. */
export const validateAssignment = (job: Pick<Job, 'id' | 'pricing' | 'pricingInput' | 'status' | 'assignedDriverId'> & Partial<Job>, driver: Driver, jobs: Job[], ctx: PricingContext, now = new Date()): string[] => {
  if (job.status === 'completed' || orderClosed(job as Job)) return ['Completed orders cannot be reassigned.'];
  if (job.pricing?.status !== 'PRICED' || !job.pricingInput) return ['Resolve pricing before assigning this order.'];
  if (job.pricing.stage !== 'FINAL' && job.pricing.quoteExpiresAt && Date.parse(job.pricing.quoteExpiresAt) < now.getTime()) return ['Quote has expired. Re-price explicitly before assigning.'];
  if (driver.status === 'offline') return ['Driver is offline.'];
  const fleet = loadVehicles();
  const operationalErrors = validateOperationalAssignment(job, driver, fleet, ctx.billing.general.timeZone, ctx.catalogue.vehicles);
  if (operationalErrors.length) return operationalErrors;
  const active = jobs.filter(j => j.id !== job.id && j.assignedDriverId === driver.id && j.status !== 'completed');
  if (active.length >= driverOrderLimit(driver, ctx.billing.dispatch.maxActiveOrdersPerDriver)) return ['Driver has reached the maximum active orders.'];
  const exclusive = (serviceId?: string) => ctx.catalogue.services.find(s => s.id === serviceId)?.exclusiveVehicle;
  if (active.length && (exclusive(job.pricingInput.serviceId) || active.some(j => exclusive(j.pricingInput?.serviceId)))) return ['Exclusive service cannot share a vehicle with another active order.'];
  const vehicleTypeId = job.pricingInput.vehicleId ?? fleet.find(v => v.id === driver.currentVehicleId)?.vehicleTypeId;
  const vehicle = ctx.catalogue.vehicles.find(v => v.id === vehicleTypeId);
  if (vehicle && !vehicle.active) return ['Requested vehicle type is inactive.'];
  const weight = job.pricingInput.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const volume = job.pricingInput.packages.reduce((n, p) => n + p.quantity * p.lengthCm * p.widthCm * p.heightCm / 1e6, 0);
  if (vehicle && (weight > vehicle.payloadCapacityKg || vehicle.cargoVolumeCbm != null && volume > vehicle.cargoVolumeCbm)) return ['Order exceeds the requested vehicle type capacity.'];
  const needsLiftgate = job.pricingInput.accessorials.some(a => a.quantity > 0 && ctx.catalogue.accessorials.find(x => x.id === a.accessorialId)?.code === 'LIFTGATE');
  if (needsLiftgate && !vehicle?.hasLiftgate) return ['Choose a vehicle type equipped with a liftgate.'];
  return [];
};
