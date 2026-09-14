// Glue between Orders (the legacy `Job` mock) and the pricing engine.
//
// Pages call `priceOrder()` / `finalizeOrderPrice()`; they never compute a
// price themselves. `enrichJobsWithPricing()` gives the static mock orders a
// real snapshot so every surface shows engine output.

import { Job, NeedsAttentionItem } from '../types';
import { PricingOrderInput, PricingSnapshot, PricingStopInput } from '../types/pricing';
import { loadBillingConfig } from './billingStorage';
import { loadCustomers } from './customerStorage';
import { loadPricingConfig } from './pricingStorage';
import { loadSimplePricingConfig } from './simplePricingStorage';
import { calculatePricing, PricingContext } from './pricingEngine';

/** Every store the engine needs, read fresh so settings edits apply immediately. */
export const loadPricingContext = (): PricingContext => ({
  billing: loadBillingConfig(),
  catalogue: loadSimplePricingConfig(),
  pricing: loadPricingConfig(),
  customers: loadCustomers()
});

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const createStop = (type: PricingStopInput['type'], partial: Partial<PricingStopInput> = {}): PricingStopInput => ({
  id: uid('stop'),
  type,
  label: '',
  zoneId: null,
  residential: false,
  waitMinutes: 0,
  ...partial
});

export const createDefaultOrderInput = (ctx: PricingContext): PricingOrderInput => ({
  customerId: null,
  serviceId: ctx.catalogue.services.find((s) => s.active)?.id ?? ctx.catalogue.services[0]?.id ?? '',
  vehicleId: ctx.catalogue.vehicles.find((v) => v.active)?.id ?? null,
  stops: [
    createStop('PICKUP', { zoneId: ctx.pricing.zones[0]?.id ?? null }),
    createStop('DROPOFF', { zoneId: ctx.pricing.zones[1]?.id ?? null })
  ],
  routeKm: 15,
  estimatedMinutes: 40,
  actualMinutes: null,
  durationBasis: 'DRIVING_ONLY',
  handlingMinutes: null,
  packages: [
    { id: uid('pkg'), quantity: 1, weightKg: 10, lengthCm: 40, widthCm: 30, heightCm: 30, declaredValue: 0 }
  ],
  accessorials: [],
  scheduledAt: null,
  source: 'DISPATCHER',
  importedPrice: null,
  externalSource: null,
  externalReference: null,
  adjustments: [],
  rateCardOverrideId: null,
  stage: 'ESTIMATE'
});

export const priceOrder = (input: PricingOrderInput, ctx: PricingContext = loadPricingContext()): PricingSnapshot =>
  calculatePricing(input, ctx);

/**
 * Completion uses quoted terms. Only an hourly clock that permits actual
 * settlement changes the customer amount; operational time remains separate.
 */
export const finalizeOrderPrice = (
  input: PricingOrderInput,
  actualMinutes: number | null,
  ctx: PricingContext = loadPricingContext(),
  quoted?: PricingSnapshot
): { input: PricingOrderInput; snapshot: PricingSnapshot } => {
  if (quoted?.stage === 'FINAL') return { input, snapshot: quoted };
  const finalInput: PricingOrderInput = { ...input, stage: 'FINAL', actualHourlyBillableMinutes: actualMinutes }; // Billable-clock minutes are not driving minutes.
  const frozenContext = quoted?.context ? { ...quoted.context, asOf: quoted.context.asOf ? new Date(quoted.context.asOf) : undefined } : ctx;
  if (quoted?.method === 'HOURLY' && !quoted.context) {
    return { input: finalInput, snapshot: { ...structuredClone(quoted), status: 'NEEDS_ATTENTION', errors: [{ code: 'INVALID_CONFIGURATION', message: 'This legacy quote has no frozen contract terms. Review and re-price it explicitly before hourly settlement.' }] } };
  }
  const card = frozenContext.pricing.rateCards.find(c => c.id === quoted?.rateCard?.id);
  if (quoted?.status === 'PRICED' && (quoted.method !== 'HOURLY' || card?.hourlySettleActual === false)) {
    return { input: finalInput, snapshot: { ...structuredClone(quoted), stage: 'FINAL', orderFacts: structuredClone(finalInput) } };
  }
  return { input: finalInput, snapshot: calculatePricing(finalInput, frozenContext) };
};

// ---------------------------------------------------------------------------
// Legacy mock orders → priced orders
// ---------------------------------------------------------------------------

/** Stable pseudo-random in [min, max] from a string, so mock data is deterministic. */
const seeded = (key: string, min: number, max: number): number => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return min + (h % 1000) / 1000 * (max - min);
};

const SERVICE_BY_JOB_TYPE: Record<string, string> = {
  'Standard Delivery': 'srv_same_day',
  'Priority Freight': 'srv_rush',
  'Medical Supplies': 'srv_rush',
  'Express Courier': 'srv_direct',
  'Rush Expedited': 'srv_rush',
  'Direct Hotshot': 'srv_direct',
  'Scheduled Economy': 'srv_economy'
};

const parseKg = (text?: string): number => {
  const m = text?.match(/([\d.]+)\s*kg/i);
  return m ? Number(m[1]) : 120;
};

/** Build order facts for a mock Job that predates the pricing model. */
export const legacyJobToPricingInput = (job: Job, ctx: PricingContext): PricingOrderInput => {
  const base = createDefaultOrderInput(ctx);
  const customer = ctx.customers.find(
    (c) => c.name === job.customerName || c.contactName === job.customerName
  );
  const serviceId =
    job.serviceId ??
    (ctx.catalogue.services.find((s) => s.id === SERVICE_BY_JOB_TYPE[job.jobType])?.id ?? base.serviceId);
  const stops: PricingStopInput[] = [
    createStop('PICKUP', { id: `${job.id}_pu`, label: job.pickupAddress, zoneId: ctx.pricing.zones[0]?.id ?? null })
  ];
  const dropCount = Math.max(1, job.stopsCount - 1);
  for (let i = 0; i < dropCount; i++) {
    stops.push(
      createStop('DROPOFF', {
        id: `${job.id}_do${i}`,
        label: i === 0 ? job.dropoffAddress : `Additional stop ${i + 1}`,
        zoneId: ctx.pricing.zones[(i + 1) % Math.max(1, ctx.pricing.zones.length)]?.id ?? null
      })
    );
  }
  const weightKg = parseKg(job.cargoWeight);
  return {
    ...base,
    customerId: job.customerId ?? customer?.id ?? null,
    serviceId,
    vehicleId: job.vehicleId ?? (job.palletCount && job.palletCount > 2 ? 'veh_2_ton' : 'veh_1_ton'),
    stops: stops.map(stop => stop.type === 'DROPOFF' ? { ...stop, pickupIds: [stops[0].id] } : stop),
    routeKm: Number(seeded(job.id, 6, 28).toFixed(1)),
    estimatedMinutes: Math.round(seeded(`${job.id}-min`, 25, 75)),
    packages: [
      {
        id: `${job.id}_pkg`,
        quantity: job.palletCount ?? 1,
        weightKg: Math.round(weightKg / (job.palletCount ?? 1)),
        lengthCm: 120,
        widthCm: 100,
        heightCm: 90,
        declaredValue: 0
      }
    ]
  };
};

export const enrichJobsWithPricing = (jobs: Job[], ctx: PricingContext = loadPricingContext()): Job[] =>
  jobs.map((job) => {
    const retryLegacyFailure = job.status !== 'completed' && !job.invoicePreview &&
      job.pricing?.stage === 'ESTIMATE' && job.pricing.status !== 'PRICED' &&
      job.pricingInput?.stage === 'ESTIMATE' &&
      job.pricing.errors.some(error => error.code === 'LEGACY_TIME_PRICING');
    if (job.pricing && job.pricingInput && !retryLegacyFailure) return job;
    const pricingInput = job.pricingInput ?? legacyJobToPricingInput(job, ctx);
    const service = ctx.catalogue.services.find((s) => s.id === pricingInput.serviceId);
    return {
      ...job,
      customerId: pricingInput.customerId,
      serviceId: pricingInput.serviceId,
      vehicleId: pricingInput.vehicleId,
      serviceLevel: job.serviceLevel ?? service?.name,
      pricingInput,
      pricing: calculatePricing(pricingInput, ctx)
    };
  });

/** Orders whose price could not be produced become Needs Attention rows. */
export const pricingAttentionItems = (jobs: Job[]): NeedsAttentionItem[] =>
  jobs
    .filter((j) => j.pricing && j.pricing.status !== 'PRICED' && j.status !== 'completed')
    .map((j) => {
      const error = j.pricing!.errors[0];
      return {
        id: `att-pricing-${j.id}`,
        jobNumber: j.jobNumber,
        statusType: 'pricing',
        statusLabel: j.pricing!.status === 'NEEDS_ATTENTION' ? 'Pricing Needs Attention' : 'Price Unavailable',
        subtitle: error?.message ?? 'The order could not be priced.',
        pickupAddress: j.pickupAddress,
        badgeColor: 'amber',
        bulletColor: 'orange'
      };
    });

/** Human summary for tables and popovers. */
export const describePrice = (job: Job): { text: string; tone: 'ok' | 'warn' | 'muted' } => {
  const p = job.pricing;
  if (!p) return { text: 'Not priced', tone: 'muted' };
  if (p.status !== 'PRICED') return { text: p.status === 'NEEDS_ATTENTION' ? 'Needs attention' : 'Unavailable', tone: 'warn' };
  return { text: `$${p.total.toFixed(2)} ${p.currency}${p.stage === 'FINAL' ? ' · final' : ''}`, tone: 'ok' };
};

const ORDER_STORAGE_KEY = 'dispatra_orders_v1';
export const loadSavedOrders = (fallback: Job[]): Job[] => {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Retry only the retired migration blocker; successful/final prices stay frozen.
      if (Array.isArray(parsed)) return enrichJobsWithPricing(parsed);
    }
  } catch { /* Existing mock data remains available when browser storage is unavailable. */ }
  return enrichJobsWithPricing(fallback);
};
export const saveOrders = (jobs: Job[]): void => {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(jobs));
};
