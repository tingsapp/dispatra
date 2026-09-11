// Centralized pricing engine.
//
//   resolveRateCard(order, ctx)  → which card applies, and why
//   calculatePricing(order, ctx) → PricingSnapshot with ChargeLines
//   estimateInternalCost(...)    → dispatch-side cost, never the customer price
//
// The Price Simulator and Order forms MUST call these; no page may re-derive a
// formula. The API is the eventual authority — this mirrors its contract for
// static scenarios.
//
// Calculated formula (BASE_PLUS_DISTANCE):
//   DIM_WEIGHT        = VOLUME / DIM_FACTOR
//   CHARGEABLE_WEIGHT = max(ACTUAL_WEIGHT, DIM_WEIGHT)          (if dim pricing on)
//   DISTANCE_CHARGE   = max(0, ROUTE_KM − INCLUDED_KM) × KM_RATE
//   TIME_CHARGE       = max(0, MINUTES − INCLUDED_MINUTES) × MINUTE_RATE
//   LOAD_CHARGE       = max(0, CHARGEABLE_WEIGHT − INCLUDED_WEIGHT) × WEIGHT_RATE
//   PIECE_CHARGE      = max(0, PIECES − INCLUDED_PIECES) × PIECE_RATE
//   STOP_CHARGE       = max(0, STOPS − INCLUDED_STOPS) × EXTRA_STOP_RATE
//   FREIGHT           = BASE_FEE + DISTANCE + TIME + LOAD + PIECE + STOP
//   SERVICE_FREIGHT   = max(MINIMUM_FREIGHT, FREIGHT) × SERVICE_MULTIPLIER
//   FUEL              = (SERVICE_FREIGHT + fuel-eligible surcharges/accessorials) × FUEL %
//   BEFORE_DISCOUNT   = SERVICE_FREIGHT + VEHICLE_SURCHARGE + FUEL + ACCESSORIALS
//   SUBTOTAL          = max(ORG_MINIMUM, BEFORE_DISCOUNT) − DISCOUNT + ADJUSTMENTS
//   TOTAL             = SUBTOTAL + TAX
// FIXED / ZONE / HOURLY / IMPORTED replace SERVICE_FREIGHT and keep the frame.

import { BillingConfig, ChargeGroup, TaxProfileConfig, TaxRate } from '../types/billing';
import {
  AccessorialItem,
  DeliveryService,
  SimplePricingConfig,
  VehicleType
} from '../types/simplePricing';
import {
  ChargeLine,
  CostEstimate,
  CustomerGroup,
  Discount,
  PricingConfig,
  PricingError,
  PricingMethod,
  PricingOrderInput,
  PricingSnapshot,
  RateCard,
  RateCardCandidate,
  RateCardSource,
  ResolvedInputs,
  ResolvedRateCard
} from '../types/pricing';
import { Customer } from './customerStorage';
import { applyDistanceRules, resolveFuelPercent, roundMoney } from './billingEngine';

export const PRICING_ENGINE_VERSION = 'client-static-v1';

export interface PricingContext {
  billing: BillingConfig;
  catalogue: SimplePricingConfig;
  pricing: PricingConfig;
  customers: Customer[];
  /** Pricing date — defaults to now. Drives effective-date filtering. */
  asOf?: Date;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Rate Card resolution
// ---------------------------------------------------------------------------

interface ResolutionResult {
  card: RateCard | null;
  source: RateCardSource | null;
  candidates: RateCardCandidate[];
  error: PricingError | null;
}

const isEffective = (card: RateCard, asOf: Date): boolean => {
  const day = asOf.toISOString().slice(0, 10);
  if (card.effectiveFrom && card.effectiveFrom > day) return false;
  if (card.effectiveTo && card.effectiveTo < day) return false;
  return true;
};

/** Higher = more specific. Service + vehicle beats service, beats vehicle, beats neither. */
const specificity = (card: RateCard): number =>
  (card.serviceId ? 2 : 0) + (card.vehicleId ? 1 : 0);

const explainIneligible = (card: RateCard, order: PricingOrderInput, asOf: Date): string | null => {
  if (card.status !== 'ACTIVE') return `Card is ${card.status.toLowerCase()}`;
  if (!isEffective(card, asOf)) return 'Outside effective dates';
  if (card.serviceId && card.serviceId !== order.serviceId) return 'Different service';
  if (card.vehicleId && order.vehicleId && card.vehicleId !== order.vehicleId) return 'Different vehicle';
  return null;
};

/**
 * Precedence: explicit override → customer-specific → customer group →
 * organization service-specific → organization default. Within a level the
 * most specific service/vehicle combination wins; equal specificity and
 * priority is a conflict that needs attention.
 */
export const resolveRateCard = (order: PricingOrderInput, ctx: PricingContext): ResolutionResult => {
  const asOf = ctx.asOf ?? new Date();
  const candidates: RateCardCandidate[] = [];
  const customer = order.customerId ? ctx.customers.find((c) => c.id === order.customerId) : undefined;
  const group: CustomerGroup | undefined = customer?.customerGroupId
    ? ctx.pricing.customerGroups.find((g) => g.id === customer.customerGroupId)
    : undefined;

  if (order.rateCardOverrideId) {
    const card = ctx.pricing.rateCards.find((c) => c.id === order.rateCardOverrideId);
    if (card) {
      candidates.push({ id: card.id, name: card.name, source: 'OVERRIDE', eligible: true, reason: 'Explicit override' });
      return { card, source: 'OVERRIDE', candidates, error: null };
    }
  }

  const levels: { source: RateCardSource; cards: RateCard[] }[] = [
    {
      source: 'CUSTOMER',
      cards: customer
        ? ctx.pricing.rateCards.filter(
            (c) =>
              c.scope === 'CUSTOMER' &&
              (c.customerId === customer.id || c.id === customer.rateCardId)
          )
        : []
    },
    {
      source: 'CUSTOMER_GROUP',
      cards: group
        ? ctx.pricing.rateCards.filter(
            (c) =>
              c.scope === 'CUSTOMER_GROUP' &&
              (c.customerGroupId === group.id || c.id === group.rateCardId)
          )
        : []
    },
    {
      source: 'ORGANIZATION_SERVICE',
      cards: ctx.pricing.rateCards.filter((c) => c.scope === 'ORGANIZATION' && c.serviceId)
    },
    {
      source: 'ORGANIZATION_DEFAULT',
      cards: ctx.pricing.rateCards.filter((c) => c.scope === 'ORGANIZATION' && !c.serviceId)
    }
  ];

  for (const level of levels) {
    const eligible: RateCard[] = [];
    for (const card of level.cards) {
      const why = explainIneligible(card, order, asOf);
      candidates.push({
        id: card.id,
        name: card.name,
        source: level.source,
        eligible: !why,
        reason: why ?? 'Eligible'
      });
      if (!why) eligible.push(card);
    }
    if (!eligible.length) continue;

    eligible.sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority);
    const best = eligible[0];
    const rival = eligible[1];
    if (rival && specificity(rival) === specificity(best) && rival.priority === best.priority) {
      return {
        card: null,
        source: level.source,
        candidates,
        error: {
          code: 'RATE_CARD_CONFLICT',
          message: `"${best.name}" and "${rival.name}" both apply at the same level and priority. Set a priority or narrow one card.`
        }
      };
    }
    return { card: best, source: level.source, candidates, error: null };
  }

  return {
    card: null,
    source: null,
    candidates,
    error: { code: 'NO_RATE_CARD', message: 'No active Rate Card applies to this order. Create an organization default card.' }
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inherit = <T,>(override: T | null | undefined, fallback: T): T =>
  override === null || override === undefined ? fallback : override;

const line = (
  partial: Omit<ChargeLine, 'fuelEligible' | 'taxable'> & Partial<Pick<ChargeLine, 'fuelEligible' | 'taxable'>>
): ChargeLine => ({ fuelEligible: false, taxable: true, ...partial });

const emptyInputs = (): ResolvedInputs => ({
  routeKm: null,
  billableKm: 0,
  estimatedMinutes: null,
  billableMinutes: 0,
  actualWeightKg: 0,
  volumeCm3: 0,
  dimensionalWeightKg: 0,
  chargeableWeightKg: 0,
  pieces: 0,
  stopCount: 0,
  serviceMultiplier: 1,
  fuelPercent: 0,
  fuelBase: 0,
  dimensionalDivisor: 0,
  dimensionalPricingEnabled: false,
  waitFreeMinutes: 0,
  waitIncrementMinutes: 0,
  declaredValue: 0
});

const isAfterHours = (iso: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const h = d.getHours();
  return h < 8 || h >= 18;
};

const isWeekend = (iso: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
};

const ceilToIncrement = (value: number, increment: number): number =>
  increment > 0 ? Math.ceil(value / increment) * increment : value;

/** Contractual discount: customer-level beats card-level beats group-level. */
const resolveDiscount = (customer: Customer | undefined, card: RateCard, group: CustomerGroup | undefined): Discount | null => {
  if (customer && customer.discount.type !== 'NONE' && customer.discount.value > 0) return customer.discount;
  if (card.discount.type !== 'NONE' && card.discount.value > 0) return card.discount;
  if (group && group.discount.type !== 'NONE' && group.discount.value > 0) return group.discount;
  return null;
};

const resolveTaxProfile = (customer: Customer | undefined, billing: BillingConfig): TaxProfileConfig | null => {
  const id = customer?.taxProfileId || billing.invoicing.defaultTaxProfileId;
  return billing.taxProfiles.find((p) => p.id === id) ?? billing.taxProfiles[0] ?? null;
};

const groupOfLine = (l: ChargeLine): ChargeGroup => {
  switch (l.group) {
    case 'ACCESSORIAL':
      return 'accessorials';
    case 'FUEL':
      return 'fuel_surcharge';
    case 'COMPANY_CHARGE':
      return 'service_charge';
    default:
      return 'transport';
  }
};

// ---------------------------------------------------------------------------
// Internal cost (dispatch side)
// ---------------------------------------------------------------------------

export interface CostInput {
  routeKm: number;
  /** Driver's approach distance to the first pickup. Not billed to the customer. */
  deadheadKm?: number;
  stopCount: number;
  driveMinutes?: number;
  vehicleId?: string | null;
}

export const estimateInternalCost = (input: CostInput, billing: BillingConfig, revenue: number): CostEstimate => {
  const oc = billing.operatingCost;
  const costLines: ChargeLine[] = [];
  const perKm = (input.vehicleId && oc.costPerKmByVehicleId[input.vehicleId]) || oc.defaultCostPerKm;

  const routeCost = round2(Math.max(0, input.routeKm) * perKm);
  costLines.push(line({ key: 'cost_route', group: 'FREIGHT', label: 'Vehicle running cost', detail: `${input.routeKm} km × ${money(perKm)}/km`, amount: routeCost }));

  const deadhead = Math.max(0, input.deadheadKm ?? 0);
  if (deadhead > 0) {
    const deadheadCost = round2(deadhead * perKm);
    costLines.push(line({ key: 'cost_deadhead', group: 'FREIGHT', label: 'Deadhead (approach)', detail: `${deadhead} km × ${money(perKm)}/km`, amount: deadheadCost }));
  }

  const stops = Math.max(1, input.stopCount);
  const minutes = input.driveMinutes ?? stops * oc.averageMinutesPerStop;
  const labour = round2((minutes / 60) * oc.driverCostPerHour);
  costLines.push(line({ key: 'cost_labour', group: 'FREIGHT', label: 'Driver labour', detail: `${minutes} min × ${money(oc.driverCostPerHour)}/hr`, amount: labour }));

  const stopCost = round2(stops * oc.fixedCostPerStop);
  costLines.push(line({ key: 'cost_stops', group: 'FREIGHT', label: 'Handling per stop', detail: `${stops} stops × ${money(oc.fixedCostPerStop)}`, amount: stopCost }));

  const direct = costLines.reduce((sum, l) => sum + l.amount, 0);
  const overhead = round2((direct * oc.overheadPercent) / 100);
  if (overhead > 0) {
    costLines.push(line({ key: 'cost_overhead', group: 'FREIGHT', label: 'Allocated overhead', detail: `${oc.overheadPercent}% of direct cost`, amount: overhead }));
  }

  const estimatedCost = round2(direct + overhead);
  const grossProfit = round2(revenue - estimatedCost);
  const grossMarginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;
  return {
    estimatedCost,
    costLines,
    grossProfit,
    grossMarginPercent,
    meetsTargetMargin: grossMarginPercent >= oc.targetGrossMarginPercent
  };
};

// ---------------------------------------------------------------------------
// calculatePricing
// ---------------------------------------------------------------------------

export const calculatePricing = (order: PricingOrderInput, ctx: PricingContext): PricingSnapshot => {
  const { billing, catalogue } = ctx;
  const errors: PricingError[] = [];
  const warnings: string[] = [];
  const lines: ChargeLine[] = [];
  const inputs = emptyInputs();

  const customer = order.customerId ? ctx.customers.find((c) => c.id === order.customerId) : undefined;
  const group = customer?.customerGroupId
    ? ctx.pricing.customerGroups.find((g) => g.id === customer.customerGroupId)
    : undefined;
  const service: DeliveryService | undefined = catalogue.services.find((s) => s.id === order.serviceId);
  const vehicle: VehicleType | undefined = order.vehicleId
    ? catalogue.vehicles.find((v) => v.id === order.vehicleId)
    : undefined;
  const taxProfile = resolveTaxProfile(customer, billing);
  const taxExempt = !!customer?.taxExempt;

  const base = (status: PricingSnapshot['status'], extra: Partial<PricingSnapshot> = {}): PricingSnapshot => ({
    engineVersion: PRICING_ENGINE_VERSION,
    pricedAt: new Date().toISOString(),
    stage: order.stage,
    status,
    errors,
    warnings,
    currency: billing.invoicing.currency,
    rateCard: null,
    candidates: [],
    method: null,
    taxProfile: taxProfile ? { id: taxProfile.id, name: taxProfile.name } : null,
    taxExempt,
    inputs,
    lines,
    freight: 0,
    serviceFreight: 0,
    vehicleSurcharge: 0,
    fuelSurcharge: 0,
    companyCharge: 0,
    accessorialsTotal: 0,
    minimumAdjustment: 0,
    discount: 0,
    adjustmentsTotal: 0,
    subtotal: 0,
    taxLines: [],
    taxTotal: 0,
    total: 0,
    cost: null,
    ...extra
  });

  if (!service || !service.active) {
    errors.push({ code: 'INACTIVE_SERVICE', message: 'The selected service is missing or inactive.' });
    return base('UNAVAILABLE');
  }

  // ---- 1. Resolve the Rate Card -----------------------------------------
  const resolution = resolveRateCard(order, ctx);
  if (!resolution.card) {
    if (resolution.error) errors.push(resolution.error);
    return base(resolution.error?.code === 'RATE_CARD_CONFLICT' ? 'NEEDS_ATTENTION' : 'UNAVAILABLE', {
      candidates: resolution.candidates
    });
  }
  const card = resolution.card;
  const resolved: ResolvedRateCard = {
    id: card.id,
    name: card.name,
    version: card.version,
    scope: card.scope,
    source: resolution.source!,
    pricingMethod: card.pricingMethod
  };
  if (card.currency !== billing.invoicing.currency) {
    errors.push({
      code: 'CURRENCY_MISMATCH',
      message: `Rate Card "${card.name}" is in ${card.currency} but the organization bills in ${billing.invoicing.currency}.`
    });
    return base('NEEDS_ATTENTION', { rateCard: resolved, candidates: resolution.candidates, method: card.pricingMethod });
  }

  // ---- 2. Resolve inherited parameters -----------------------------------
  const svcOverride = card.serviceOverrides[service.id];
  const baseFee = inherit(svcOverride?.baseFee, card.baseFee);
  const includedKm = inherit(svcOverride?.includedKm, card.includedKm);
  const kmRate = inherit(svcOverride?.kmRate, card.kmRate);
  const multiplier = inherit(svcOverride?.multiplier, service.defaultMultiplier);
  const includedStops = inherit(card.includedStops, billing.general.defaultIncludedStops);
  const extraStopRate = inherit(card.extraStopRate, billing.general.defaultExtraStopRate);
  const dimEnabled = inherit(card.dimensionalPricingEnabled, billing.general.dimensionalPricingEnabled);
  const dimDivisor = inherit(card.dimensionalDivisor, billing.general.dimensionalDivisor);
  const waitFree = inherit(card.waitFreeMinutes, billing.general.defaultWaitFreeMinutes);
  const waitIncrement = inherit(card.waitIncrementMinutes, billing.general.defaultWaitIncrementMinutes);
  const fuelPercent = billing.fuelSurcharge.enabled
    ? inherit(card.fuelPercent, resolveFuelPercent(billing))
    : 0;

  // ---- 3. Order facts ------------------------------------------------------
  const pieces = order.packages.reduce((n, p) => n + Math.max(0, p.quantity), 0);
  const actualWeight = round2(order.packages.reduce((n, p) => n + p.quantity * Math.max(0, p.weightKg), 0));
  const volume = order.packages.reduce(
    (n, p) => n + p.quantity * Math.max(0, p.lengthCm) * Math.max(0, p.widthCm) * Math.max(0, p.heightCm),
    0
  );
  const dimWeight = dimEnabled && dimDivisor > 0 ? round2(volume / dimDivisor) : 0;
  const chargeableWeight = dimEnabled ? Math.max(actualWeight, dimWeight) : actualWeight;
  const declaredValue = round2(order.packages.reduce((n, p) => n + p.quantity * Math.max(0, p.declaredValue), 0));
  const stopCount = order.stops.length;
  const minutesForPricing =
    order.stage === 'FINAL' && order.actualMinutes != null ? order.actualMinutes : order.estimatedMinutes;

  Object.assign(inputs, {
    routeKm: order.routeKm,
    billableKm: order.routeKm == null ? 0 : applyDistanceRules(order.routeKm, billing),
    estimatedMinutes: minutesForPricing,
    actualWeightKg: actualWeight,
    volumeCm3: volume,
    dimensionalWeightKg: dimWeight,
    chargeableWeightKg: chargeableWeight,
    pieces,
    stopCount,
    serviceMultiplier: multiplier,
    fuelPercent,
    dimensionalDivisor: dimDivisor,
    dimensionalPricingEnabled: dimEnabled,
    waitFreeMinutes: waitFree,
    waitIncrementMinutes: waitIncrement,
    declaredValue
  } satisfies Partial<ResolvedInputs>);

  // ---- 4. Freight by pricing method ----------------------------------------
  let freight = 0;
  let serviceFreight = 0;
  let multiplierApplied = false;
  let effectiveMethod: PricingMethod = card.pricingMethod;

  const computeCalculated = (): void => {
    if (order.routeKm == null) {
      errors.push({ code: 'MISSING_DISTANCE', message: 'Route distance is required to price this order.' });
      return;
    }
    const billableKm = applyDistanceRules(order.routeKm, billing);
    inputs.billableKm = billableKm;
    lines.push(line({ key: 'base_fee', group: 'FREIGHT', label: 'Base Fee', detail: `Includes ${includedKm} km`, amount: round2(baseFee), fuelEligible: true }));

    const extraKm = round2(Math.max(0, billableKm - includedKm));
    if (extraKm > 0 || kmRate > 0) {
      lines.push(line({ key: 'distance', group: 'FREIGHT', label: 'Distance Charge', detail: extraKm > 0 ? `${extraKm} km × ${money(kmRate)}/km` : 'Within included distance', quantity: extraKm, unitRate: kmRate, amount: round2(extraKm * kmRate), fuelEligible: true }));
    }

    if (card.minuteRate > 0) {
      const mins = Math.max(0, minutesForPricing ?? 0);
      const extraMin = Math.max(0, mins - card.includedMinutes);
      inputs.billableMinutes = extraMin;
      if (extraMin > 0) lines.push(line({ key: 'time', group: 'FREIGHT', label: 'Time Charge', detail: extraMin > 0 ? `${extraMin} min × ${money(card.minuteRate)}/min` : `Within ${card.includedMinutes} included minutes`, quantity: extraMin, unitRate: card.minuteRate, amount: round2(extraMin * card.minuteRate), fuelEligible: true }));
    }

    if (card.weightRatePerKg > 0) {
      const extraKg = round2(Math.max(0, chargeableWeight - card.includedWeightKg));
      const basis = dimEnabled && dimWeight > actualWeight ? 'dimensional' : 'actual';
      if (extraKg > 0) lines.push(line({ key: 'load', group: 'FREIGHT', label: 'Load Charge', detail: extraKg > 0 ? `${extraKg} kg (${basis}) × ${money(card.weightRatePerKg)}/kg` : `Within ${card.includedWeightKg} kg included`, quantity: extraKg, unitRate: card.weightRatePerKg, amount: round2(extraKg * card.weightRatePerKg), fuelEligible: true }));
    }

    if (card.pieceRate > 0) {
      const extraPieces = Math.max(0, pieces - card.includedPieces);
      if (extraPieces > 0) lines.push(line({ key: 'pieces', group: 'FREIGHT', label: 'Piece Charge', detail: extraPieces > 0 ? `${extraPieces} × ${money(card.pieceRate)}` : `Within ${card.includedPieces} pieces included`, quantity: extraPieces, unitRate: card.pieceRate, amount: round2(extraPieces * card.pieceRate), fuelEligible: true }));
    }

    const extraStops = Math.max(0, stopCount - includedStops);
    if (extraStops > 0) {
      lines.push(line({ key: 'stops', group: 'FREIGHT', label: 'Extra Stops', detail: `${extraStops} × ${money(extraStopRate)}`, quantity: extraStops, unitRate: extraStopRate, amount: round2(extraStops * extraStopRate), fuelEligible: true }));
    }

    freight = round2(lines.filter((l) => l.group === 'FREIGHT').reduce((s, l) => s + l.amount, 0));
    let floored = freight;
    if (freight < card.minimumFreight) {
      floored = card.minimumFreight;
      lines.push(line({ key: 'minimum_freight', group: 'MINIMUM', label: 'Minimum Freight', detail: `Raised to the ${money(card.minimumFreight)} card minimum`, amount: round2(card.minimumFreight - freight), fuelEligible: true }));
    }
    serviceFreight = round2(floored * multiplier);
    multiplierApplied = true;
  };

  // An imported price on the Order is the top of the precedence chain: it
  // replaces freight while the resolved card still governs surcharges.
  if (order.importedPrice != null || order.source === 'IMPORT') effectiveMethod = 'IMPORTED';

  switch (effectiveMethod) {
    case 'BASE_PLUS_DISTANCE':
      computeCalculated();
      break;

    case 'FIXED': {
      freight = round2(card.fixedAmount);
      lines.push(line({ key: 'fixed', group: 'FREIGHT', label: 'Contract Fixed Price', detail: `Per delivery — ${card.name}`, amount: freight, fuelEligible: true }));
      serviceFreight = card.applyServiceMultiplier ? round2(freight * multiplier) : freight;
      multiplierApplied = card.applyServiceMultiplier;
      break;
    }

    case 'HOURLY': {
      if (minutesForPricing == null) {
        errors.push({ code: 'MISSING_DURATION', message: 'Hourly pricing needs an estimated or actual duration.' });
        break;
      }
      const billable = Math.max(card.minimumBillableMinutes, ceilToIncrement(minutesForPricing, card.billingIncrementMinutes));
      inputs.billableMinutes = billable;
      freight = round2((billable / 60) * card.hourlyRate);
      lines.push(line({ key: 'hourly', group: 'FREIGHT', label: 'Hourly Charge', detail: `${billable} min (${(billable / 60).toFixed(2)} h) × ${money(card.hourlyRate)}/h${order.stage === 'FINAL' && order.actualMinutes != null ? ' — settled on actual' : ''}`, quantity: billable, unitRate: card.hourlyRate, amount: freight, fuelEligible: true }));
      serviceFreight = card.applyServiceMultiplier ? round2(freight * multiplier) : freight;
      multiplierApplied = card.applyServiceMultiplier;
      break;
    }

    case 'ZONE': {
      const pickups = order.stops.filter((s) => s.type === 'PICKUP');
      const drops = order.stops.filter((s) => s.type === 'DROPOFF');
      const origin = pickups[0];
      const missingZone = order.stops.some((s) => !s.zoneId);
      if (!origin || !drops.length || missingZone) {
        if (card.zoneNoMatchFallback === 'BASE_PLUS_DISTANCE') {
          warnings.push('Zone missing on a stop — priced by base + distance instead.');
          effectiveMethod = 'BASE_PLUS_DISTANCE';
          computeCalculated();
        } else {
          errors.push({ code: 'MISSING_ZONE', message: 'Every stop needs a zone for zone-to-zone pricing.' });
        }
        break;
      }
      // Each drop-off is priced from the first pickup's zone; legs are summed.
      let unmatched = false;
      const zoneLines: ChargeLine[] = [];
      for (const drop of drops) {
        const rate =
          ctx.pricing.zoneRates.find((r) => r.originZoneId === origin.zoneId && r.destinationZoneId === drop.zoneId && r.serviceId === service.id) ??
          ctx.pricing.zoneRates.find((r) => r.originZoneId === origin.zoneId && r.destinationZoneId === drop.zoneId && !r.serviceId);
        if (!rate) {
          unmatched = true;
          break;
        }
        const from = ctx.pricing.zones.find((z) => z.id === origin.zoneId)?.name ?? origin.zoneId;
        const to = ctx.pricing.zones.find((z) => z.id === drop.zoneId)?.name ?? drop.zoneId;
        zoneLines.push(line({ key: `zone_${drop.id}`, group: 'FREIGHT', label: 'Zone Rate', detail: `${from} → ${to}`, amount: round2(rate.amount), fuelEligible: true }));
      }
      if (unmatched) {
        if (card.zoneNoMatchFallback === 'BASE_PLUS_DISTANCE') {
          warnings.push('No zone rate for this origin → destination — priced by base + distance instead.');
          effectiveMethod = 'BASE_PLUS_DISTANCE';
          computeCalculated();
        } else {
          errors.push({ code: 'ZONE_NO_MATCH', message: 'No zone rate exists for this origin → destination pair.' });
        }
        break;
      }
      lines.push(...zoneLines);
      freight = round2(zoneLines.reduce((s, l) => s + l.amount, 0));
      serviceFreight = card.applyServiceMultiplier ? round2(freight * multiplier) : freight;
      multiplierApplied = card.applyServiceMultiplier;
      break;
    }

    case 'IMPORTED': {
      if (order.importedPrice == null) {
        errors.push({ code: 'MISSING_IMPORTED_PRICE', message: 'This customer is priced by import but the order carries no imported price.' });
        break;
      }
      freight = round2(order.importedPrice);
      lines.push(line({ key: 'imported', group: 'FREIGHT', label: 'Imported Price', detail: [order.externalSource, order.externalReference].filter(Boolean).join(' · ') || 'External system', amount: freight, fuelEligible: true }));
      serviceFreight = freight;
      break;
    }
  }

  if (errors.length) {
    return base('NEEDS_ATTENTION', { rateCard: resolved, candidates: resolution.candidates, method: effectiveMethod });
  }

  if (multiplierApplied && multiplier !== 1) {
    const before = round2(serviceFreight / multiplier);
    lines.push(line({ key: 'service_multiplier', group: 'SERVICE', label: `${service.name} ×${multiplier.toFixed(2)}`, detail: `${money(before)} × ${multiplier.toFixed(2)}`, amount: round2(serviceFreight - before), fuelEligible: true }));
  }

  // ---- 5. Vehicle surcharge ------------------------------------------------
  let vehicleSurcharge = 0;
  const applyVehicle = effectiveMethod === 'BASE_PLUS_DISTANCE' || card.applyVehicleSurcharge;
  if (vehicle && applyVehicle) {
    const override = card.vehicleSurchargeOverrides[vehicle.id];
    vehicleSurcharge = round2(inherit(override, vehicle.baseSurcharge));
    if (vehicleSurcharge > 0 || override !== undefined) {
      lines.push(line({ key: 'vehicle', group: 'VEHICLE', label: 'Vehicle Surcharge', detail: override !== undefined ? `${vehicle.name} — card override` : vehicle.name, amount: vehicleSurcharge, fuelEligible: vehicle.fuelEligible }));
    }
  }

  // ---- 6. Accessorials -----------------------------------------------------
  let accessorialsTotal = 0;
  const applyAccessorials = effectiveMethod === 'BASE_PLUS_DISTANCE' || card.applyAccessorials;
  if (applyAccessorials) {
    const requested = new Map(order.accessorials.map((a) => [a.accessorialId, Math.max(0, a.quantity)]));

    // Auto rules add an accessorial the dispatcher did not tick.
    for (const acc of catalogue.accessorials) {
      if (!acc.active || acc.autoRule === 'NONE' || requested.has(acc.id)) continue;
      if (acc.autoRule === 'AFTER_HOURS' && isAfterHours(order.scheduledAt)) requested.set(acc.id, 1);
      if (acc.autoRule === 'WEEKEND' && isWeekend(order.scheduledAt)) requested.set(acc.id, 1);
      if (acc.autoRule === 'RESIDENTIAL_STOP') {
        const residentialStops = order.stops.filter((s) => s.residential).length;
        if (residentialStops > 0) requested.set(acc.id, acc.appliesAt === 'PER_STOP' ? residentialStops : 1);
      }
    }

    // Waiting time comes from the stops themselves.
    const totalWait = order.stops.reduce((n, s) => n + Math.max(0, s.waitMinutes), 0);
    for (const acc of catalogue.accessorials) {
      if (acc.active && acc.calculationType === 'PER_MINUTE' && !requested.has(acc.id) && totalWait > 0) {
        requested.set(acc.id, totalWait);
      }
    }

    for (const [id, qty] of requested) {
      const acc: AccessorialItem | undefined = catalogue.accessorials.find((a) => a.id === id);
      if (!acc || !acc.active) continue;
      const override = card.accessorialRateOverrides[acc.id];
      const rate = inherit(override, acc.rate);
      let amount = 0;
      let detail = '';
      let billableQty = qty;

      switch (acc.calculationType) {
        case 'FLAT':
          billableQty = acc.appliesAt === 'PER_STOP' ? Math.max(1, qty) : 1;
          amount = rate * billableQty;
          detail = billableQty > 1 ? `${billableQty} stops × ${money(rate)}` : 'Flat';
          break;
        case 'PER_UNIT': {
          const free = acc.freeAllowance ?? 0;
          billableQty = Math.max(0, qty - free);
          amount = billableQty * rate;
          detail = `${billableQty} ${acc.unitLabel.replace(/^per\s+/, '')}${free ? ` (after ${free} free)` : ''} × ${money(rate)}`;
          break;
        }
        case 'PER_MINUTE': {
          const free = acc.freeAllowance ?? waitFree;
          const increment = acc.incrementMinutes ?? waitIncrement;
          const stopWaits = order.stops.map((s) => Math.max(0, s.waitMinutes)).filter((w) => w > 0);
          if (acc.appliesAt === 'PER_STOP' && stopWaits.length) {
            // Allowance is per stop: 10 + 30 min waits with 15 free bills 15, not 10.
            billableQty = stopWaits.reduce((n, w) => n + ceilToIncrement(Math.max(0, w - free), increment), 0);
            detail = `${stopWaits.join(' + ')} min, ${free} free per stop → ${billableQty} billable × ${money(rate)}/min`;
          } else {
            billableQty = ceilToIncrement(Math.max(0, qty - free), increment);
            detail = `${qty} min − ${free} free → ${billableQty} billable × ${money(rate)}/min`;
          }
          amount = billableQty * rate;
          break;
        }
        case 'PER_HOUR':
          amount = qty * rate;
          detail = `${qty} h × ${money(rate)}/h`;
          break;
        case 'PERCENT_OF_FREIGHT':
          amount = (serviceFreight * rate) / 100;
          detail = `${rate}% of ${money(serviceFreight)}`;
          break;
        case 'PERCENT_OF_DECLARED_VALUE':
          amount = (declaredValue * rate) / 100;
          detail = `${rate}% of ${money(declaredValue)} declared`;
          break;
      }

      if (acc.minimumCharge != null && amount > 0 && amount < acc.minimumCharge) {
        amount = acc.minimumCharge;
        detail += ` — min ${money(acc.minimumCharge)}`;
      }
      if (acc.maximumCharge != null && amount > acc.maximumCharge) {
        amount = acc.maximumCharge;
        detail += ` — capped at ${money(acc.maximumCharge)}`;
      }
      amount = round2(amount);
      if (amount <= 0 && override === undefined) continue;

      accessorialsTotal = round2(accessorialsTotal + amount);
      lines.push(line({ key: `acc_${acc.id}`, group: 'ACCESSORIAL', label: acc.name, detail: override !== undefined ? `${detail} (card rate)` : detail, quantity: billableQty, unitRate: rate, amount, fuelEligible: acc.fuelEligible, taxable: acc.taxable }));
    }
  }

  // ---- 7. Fuel surcharge ---------------------------------------------------
  let fuelSurcharge = 0;
  const applyFuel = effectiveMethod === 'BASE_PLUS_DISTANCE' || card.applyFuelSurcharge;
  const fuelBase = round2(
    lines.filter((l) => l.fuelEligible && l.group !== 'FUEL').reduce((s, l) => s + l.amount, 0)
  );
  inputs.fuelBase = fuelBase;
  if (applyFuel && fuelPercent > 0 && fuelBase > 0) {
    fuelSurcharge = round2((fuelBase * fuelPercent) / 100);
    lines.push(line({ key: 'fuel', group: 'FUEL', label: billing.fuelSurcharge.label || 'Fuel Surcharge', detail: `${fuelPercent}% of ${money(fuelBase)}${card.fuelPercent != null ? ' (card rate)' : ''}`, amount: fuelSurcharge, taxable: billing.fuelSurcharge.taxable }));
  }

  // ---- 8. Optional company service charge (legacy org setting) -------------
  let companyCharge = 0;
  const sc = billing.serviceCharge;
  if (sc.enabled) {
    const basis = sc.basis === 'transport_only' ? serviceFreight + vehicleSurcharge : serviceFreight + vehicleSurcharge + accessorialsTotal;
    const asPercent = round2((basis * sc.percent) / 100);
    companyCharge = sc.mode === 'flat' ? round2(sc.flatAmount) : sc.mode === 'greater_of' ? Math.max(asPercent, round2(sc.flatAmount)) : asPercent;
    if (companyCharge > 0) {
      lines.push(line({ key: 'company_charge', group: 'COMPANY_CHARGE', label: sc.label, detail: sc.mode === 'flat' ? 'Flat' : `${sc.percent}% of ${money(basis)}`, amount: companyCharge, taxable: sc.taxable }));
    }
  }

  // ---- 9. Organization minimum, discount, adjustments ----------------------
  let beforeDiscount = round2(serviceFreight + vehicleSurcharge + fuelSurcharge + accessorialsTotal + companyCharge);
  let minimumAdjustment = 0;
  if (beforeDiscount < billing.rules.minimumChargePerJob) {
    minimumAdjustment = round2(billing.rules.minimumChargePerJob - beforeDiscount);
    beforeDiscount = round2(billing.rules.minimumChargePerJob);
    lines.push(line({ key: 'minimum_job', group: 'MINIMUM', label: 'Minimum Charge', detail: `Raised to the ${money(billing.rules.minimumChargePerJob)} organization minimum`, amount: minimumAdjustment }));
  }

  let discount = 0;
  const discountRule = resolveDiscount(customer, card, group);
  if (discountRule) {
    const scopeBase =
      discountRule.scope === 'TRANSPORT_ONLY'
        ? serviceFreight + vehicleSurcharge + fuelSurcharge
        : beforeDiscount;
    discount = discountRule.type === 'PERCENT' ? round2((scopeBase * discountRule.value) / 100) : round2(Math.min(discountRule.value, scopeBase));
    if (discount > 0) {
      const who = customer && customer.discount === discountRule ? 'customer' : group && group.discount === discountRule ? 'group' : 'rate card';
      lines.push(line({ key: 'discount', group: 'DISCOUNT', label: 'Contract Discount', detail: `${discountRule.type === 'PERCENT' ? `${discountRule.value}%` : money(discountRule.value)} ${discountRule.scope === 'TRANSPORT_ONLY' ? 'on transport' : 'on subtotal'} — ${who}`, amount: -discount }));
    }
  }

  let adjustmentsTotal = 0;
  for (const adj of order.adjustments) {
    const amount = round2(adj.amount);
    if (!amount) continue;
    adjustmentsTotal = round2(adjustmentsTotal + amount);
    lines.push(line({ key: `adj_${adj.id}`, group: 'ADJUSTMENT', label: amount < 0 ? 'Manual Discount' : 'Manual Adjustment', detail: adj.reason || 'Dispatcher adjustment', amount, taxable: adj.taxable }));
  }

  const subtotal = round2(beforeDiscount - discount + adjustmentsTotal);

  // ---- 10. Tax ---------------------------------------------------------------
  const taxLines: ChargeLine[] = [];
  let taxTotal = 0;
  if (!taxExempt && taxProfile) {
    // The discount is spread across taxable lines in proportion to their share
    // of the discounted base, so a freight discount lowers freight tax.
    const discountBase = discountRule?.scope === 'TRANSPORT_ONLY' ? serviceFreight + vehicleSurcharge + fuelSurcharge : beforeDiscount;
    const discountRatio = discountBase > 0 ? discount / discountBase : 0;
    const inDiscountScope = (l: ChargeLine) =>
      discountRule?.scope === 'SUBTOTAL' || ['FREIGHT', 'MINIMUM', 'SERVICE', 'VEHICLE', 'FUEL'].includes(l.group);

    const groupAmounts: Record<ChargeGroup, number> = { transport: 0, accessorials: 0, service_charge: 0, fuel_surcharge: 0 };
    for (const l of lines) {
      if (!l.taxable || l.group === 'DISCOUNT') continue;
      const net = inDiscountScope(l) ? l.amount * (1 - discountRatio) : l.amount;
      groupAmounts[groupOfLine(l)] += net;
    }

    taxProfile.taxes
      .filter((t: TaxRate) => t.active && t.ratePercent > 0)
      .forEach((tax) => {
        const taxable = tax.appliesTo.reduce((sum, g) => sum + (groupAmounts[g] || 0), 0);
        if (taxable <= 0) return;
        const amount = billing.invoicing.pricesIncludeTax
          ? round2(taxable - taxable / (1 + tax.ratePercent / 100))
          : round2((taxable * tax.ratePercent) / 100);
        if (amount <= 0) return;
        taxTotal = round2(taxTotal + amount);
        taxLines.push(line({ key: `tax_${tax.id}`, group: 'TAX', label: `${tax.name} (${tax.ratePercent}%)`, detail: `on ${money(round2(taxable))}`, amount, taxable: false }));
      });
  }

  const total = billing.invoicing.pricesIncludeTax
    ? roundMoney(subtotal, billing.rules.moneyRounding)
    : roundMoney(subtotal + taxTotal, billing.rules.moneyRounding);

  // ---- 11. Internal cost (never shown to the customer) ---------------------
  const cost =
    order.routeKm != null
      ? estimateInternalCost(
          { routeKm: order.routeKm, stopCount, driveMinutes: minutesForPricing ?? undefined, vehicleId: order.vehicleId },
          billing,
          subtotal
        )
      : null;

  return base('PRICED', {
    rateCard: resolved,
    candidates: resolution.candidates,
    method: effectiveMethod,
    freight,
    serviceFreight,
    vehicleSurcharge,
    fuelSurcharge,
    companyCharge,
    accessorialsTotal,
    minimumAdjustment,
    discount,
    adjustmentsTotal,
    subtotal,
    taxLines,
    taxTotal,
    total,
    cost
  });
};

/** Convenience for pages that only hold the raw stores. */
export const buildPricingContext = (parts: Omit<PricingContext, 'asOf'>): PricingContext => parts;
