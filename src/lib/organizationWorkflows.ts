import { validateOperationalAssignment } from '../domain/assignment';
import { loadVehicles } from './vehicleStorage';
import { orderEditable } from '../domain/validation';
import { Driver, Job } from '../types';
import { PricingOrderInput, PricingSnapshot } from '../types/pricing';
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
  if (!order.scheduledAt) return [];
  const zone = ctx.billing.general.timeZone ?? 'America/Vancouver';
  const booked = organizationTime(now, zone);
  const requested = organizationTime(order.scheduledAt, zone);
  if (!booked || !requested) return ['Invalid service date or organization timezone.'];
  if (requested.day < booked.day) return ['The service date is in the past.'];
  if (service.bookingCutoffTime && requested.day === booked.day && booked.clock > service.bookingCutoffTime) return [`${service.name} booking cutoff is ${service.bookingCutoffTime} ${zone}; choose a later service date.`];
  return [];
};

/** Shared by direct/manual assignment and the static recommendation action. */
export const validateAssignment = (job: Pick<Job, 'id' | 'pricing' | 'pricingInput' | 'status' | 'assignedDriverId'> & Partial<Job>, driver: Driver, jobs: Job[], ctx: PricingContext, now = new Date()): string[] => {
  if (job.status === 'completed' || job.lifecycleStatus && ['IN_EXECUTION','COMPLETED','BILLING_FINALIZATION','INVOICED','CANCELLED','FAILED'].includes(job.lifecycleStatus)) return ['Completed orders cannot be reassigned.'];
  if (job.pricing?.status !== 'PRICED' || !job.pricingInput) return ['Resolve pricing before assigning this order.'];
  if (job.pricing.stage !== 'FINAL' && job.pricing.quoteExpiresAt && Date.parse(job.pricing.quoteExpiresAt) < now.getTime()) return ['Quote has expired. Re-price explicitly before assigning.'];
  if (driver.status === 'offline') return ['Driver is offline.'];
  const operationalErrors = validateOperationalAssignment(job, driver, loadVehicles(), ctx.billing.general.timeZone);
  if (operationalErrors.length) return operationalErrors;
  const active = jobs.filter(j => j.id !== job.id && j.assignedDriverId === driver.id && j.status !== 'completed');
  if (active.length >= ctx.billing.dispatch.maxActiveOrdersPerDriver) return ['Driver has reached the maximum active orders.'];
  const exclusive = (serviceId?: string) => ctx.catalogue.services.find(s => s.id === serviceId)?.exclusiveVehicle;
  if (active.length && (exclusive(job.pricingInput.serviceId) || active.some(j => exclusive(j.pricingInput?.serviceId)))) return ['Exclusive service cannot share a vehicle with another active order.'];
  const vehicle = ctx.catalogue.vehicles.find(v => v.id === job.pricingInput?.vehicleId);
  if (vehicle && !vehicle.active) return ['Requested vehicle type is inactive.'];
  const weight = job.pricingInput.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const volume = job.pricingInput.packages.reduce((n, p) => n + p.quantity * p.lengthCm * p.widthCm * p.heightCm / 1e6, 0);
  if (vehicle && (weight > vehicle.payloadCapacityKg || vehicle.cargoVolumeCbm != null && volume > vehicle.cargoVolumeCbm)) return ['Order exceeds the requested vehicle type capacity.'];
  const needsLiftgate = job.pricingInput.accessorials.some(a => a.quantity > 0 && ctx.catalogue.accessorials.find(x => x.id === a.accessorialId)?.code === 'LIFTGATE');
  if (needsLiftgate && !vehicle?.hasLiftgate) return ['Choose a vehicle type equipped with a liftgate.'];
  return [];
};

export interface InvoicePreview {
  id: string; issuedAt: string; dueAt: string; billingEmail: string; taxRegistrationNumber: string;
  currency: string; subtotal: number; tax: number; total: number; lines: PricingSnapshot['lines'];
  status: 'PREVIEW';
}

/** Local preview only. Real invoice creation/email requires the billing workflow. */
export const createInvoicePreview = (jobId: string, snapshot: PricingSnapshot, ctx: PricingContext, now = new Date()): InvoicePreview => {
  if (snapshot.status !== 'PRICED' || snapshot.stage !== 'FINAL') throw new Error('Invoice preview requires finalized pricing.');
  const frozen = snapshot.context ?? ctx;
  const customer = frozen.customers.find(c => c.id === (snapshot.orderFacts?.billingCustomerId || snapshot.orderFacts?.customerId));
  const terms = customer?.paymentTerms && customer.paymentTerms !== 'INHERIT' ? customer.paymentTerms : frozen.billing.invoicing.defaultPaymentTerms;
  const days = terms === 'COD' ? 0 : Number(terms.replace('NET', ''));
  return { id: `preview-${jobId}`, issuedAt: now.toISOString(), dueAt: new Date(now.getTime() + days * 86400000).toISOString(), billingEmail: customer?.billingEmail || customer?.email || '', taxRegistrationNumber: frozen.billing.invoicing.taxRegistrationNumber, currency: snapshot.currency, subtotal: snapshot.subtotal, tax: snapshot.taxTotal, total: snapshot.total, lines: structuredClone([...snapshot.lines, ...snapshot.taxLines]), status: 'PREVIEW' };
};
