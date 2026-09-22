import { toDisplayWeight, toDisplayWeightRate, toDisplayDistance, toDisplayDistanceRate } from './units';
import { hasDimensionalWeightSetting } from './dimensionalWeight';
import { zoneAmountForWeight } from './zoneWeightBands';
import { resolveCompanyTax } from './companyTax';
import { DestinationTaxDecision, resolveDestinationTax, taxDestinationKey } from './destinationTax';
// Shared commercial pricing. Canonical units: km, kg, cm. Snapshots retain quoted terms.
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
import { organizationTime } from './organizationWorkflows';
import { applyDistanceRules, isValidFuelPercent, resolveFuelPercent, roundMoney } from './billingEngine';

export const PRICING_ENGINE_VERSION = 'client-static-v11-distance-only';

export interface PricingContext {
  /** New Distance quotes ignore weight rates; frozen quotes retain their original rule. */
  distanceWeightMode?: 'NONE' | 'LEGACY';
  /** Frozen legacy quotes retain multiplicative service terms. */
  servicePricingMode?: 'FIXED' | 'LEGACY_MULTIPLIER';
  /** New quotes scope dimensional weight by method; frozen contexts keep their quoted rule. */
  dimensionalWeightMode?: 'METHOD_SPECIFIC' | 'MAX' | 'LEGACY_CARD_SETTING';
  billing: BillingConfig;
  catalogue: SimplePricingConfig;
  pricing: PricingConfig;
  customers: Customer[];
  /** Pricing date — defaults to now. Drives effective-date filtering. */
  asOf?: Date;
  /** Frozen company or historical destination decision; key retained for saved snapshots. */
  destinationTax?: DestinationTaxDecision;
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

const explainIneligible = (card: RateCard): string | null => card.status === 'ACTIVE' ? null : 'Card is archived';

/** The organization's Default card: the one card every order falls back to. */
export const defaultRateCard = (cards: RateCard[]): RateCard | undefined =>
  cards.find(c => c.status === 'ACTIVE' && c.scope === 'ORGANIZATION');

/**
 * Precedence: card chosen on the order → card attached to the customer → Default.
 * Every card applies to every service and vehicle; there are no priorities or conflicts.
 */
export const resolveRateCard = (order: PricingOrderInput, ctx: PricingContext): ResolutionResult => {
  const candidates: RateCardCandidate[] = [];
  const customer = order.customerId ? ctx.customers.find((c) => c.id === order.customerId) : undefined;
  if (order.rateCardOverrideId && !ctx.pricing.rateCards.some((c) => c.id === order.rateCardOverrideId)) {
    return { card: null, source: 'OVERRIDE', candidates, error: { code: 'NO_RATE_CARD', message: 'The selected Rate Card no longer exists.' } };
  }
  const levels: { source: RateCardSource; label: string; card: RateCard | undefined }[] = [
    { source: 'OVERRIDE', label: 'Chosen on order', card: ctx.pricing.rateCards.find((c) => c.id === order.rateCardOverrideId) },
    { source: 'CUSTOMER', label: 'Attached to customer', card: ctx.pricing.rateCards.find((c) => c.id === customer?.rateCardId) },
    { source: 'ORGANIZATION_DEFAULT', label: 'Default', card: defaultRateCard(ctx.pricing.rateCards) }
  ];
  for (const { source, label, card } of levels) {
    if (!card) continue;
    const reason = explainIneligible(card);
    candidates.push({ id: card.id, name: card.name, source, eligible: !reason, reason: reason ?? label });
    if (!reason) return { card, source, candidates, error: null };
    if (source === 'OVERRIDE') return { card: null, source, candidates, error: { code: 'INVALID_CONFIGURATION', message: reason } };
  }
  return { card: null, source: null, candidates, error: { code: 'NO_RATE_CARD', message: 'No Rate Card applies to this order. Set a Default rate card.' } };
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

const isAfterHours = (iso: string | null, zone: string): boolean => {
  if (!iso) return false;
  const local = organizationTime(iso, zone);
  return !!local && (local.clock < '08:00' || local.clock >= '18:00');
};
const isWeekend = (iso: string | null, zone: string): boolean => {
  if (!iso) return false;
  const local = organizationTime(iso, zone);
  if (!local) return false;
  const day = new Date(`${local.day}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

const ceilToIncrement = (value: number, increment: number): number =>
  increment > 0 ? Math.ceil(value / increment) * increment : value;

/** Historical frozen contexts retain their original card discount semantics. */
const resolveDiscount = (card: RateCard): Discount | null =>
  card.discount && (card.discount.type === 'PERCENT' || card.discount.type === 'FIXED') ? card.discount : null;

const resolveTaxProfile = (customer: Customer | undefined, billing: BillingConfig): TaxProfileConfig | null => {
  const id = customer?.taxProfileId || billing.invoicing.defaultTaxProfileId;
  return billing.taxProfiles.find((p) => p.id === id) ?? null;
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
  routeKm: number | null;
  handlingMinutes?: number | null;
  waitMinutes?: number;
  durationBasis?: PricingOrderInput['durationBasis'];
  timeSource?: string;
  /** Driver's approach distance to the first pickup. Not billed to the customer. */
  deadheadKm?: number;
  stopCount: number;
  driveMinutes?: number;
  vehicleId?: string | null;
}

export const estimateInternalCost = (input: CostInput, billing: BillingConfig, revenue: number): CostEstimate => {
  const oc = billing.operatingCost;
  const costLines: ChargeLine[] = [];
  const perKm = (input.vehicleId ? oc.costPerKmByVehicleId[input.vehicleId] : undefined) ?? oc.defaultCostPerKm;
  const missingInputs = input.routeKm == null ? ['distance'] : [];
  if (input.driveMinutes == null) missingInputs.push('driving or total duration');
  if (!input.durationBasis) missingInputs.push('duration includes driving only or total service');

  const routeCost = round2(Math.max(0, input.routeKm ?? 0) * perKm);
  costLines.push(line({ key: 'cost_route', group: 'FREIGHT', label: 'Vehicle running cost', detail: `${input.routeKm} km × ${money(perKm)}/km`, amount: routeCost }));

  const deadhead = Math.max(0, input.deadheadKm ?? 0);
  if (deadhead > 0) {
    const deadheadCost = round2(deadhead * perKm);
    costLines.push(line({ key: 'cost_deadhead', group: 'FREIGHT', label: 'Deadhead (approach)', detail: `${deadhead} km × ${money(perKm)}/km`, amount: deadheadCost }));
  }

  const stops = Math.max(0, input.stopCount);
  const handling = input.handlingMinutes ?? stops * oc.averageMinutesPerStop;
  const minutes = Math.max(0, input.driveMinutes ?? 0) + (input.durationBasis === 'DRIVING_ONLY' ? handling + Math.max(0, input.waitMinutes ?? 0) : 0);
  const labour = round2((minutes / 60) * oc.driverCostPerHour);
  costLines.push(line({ key: 'cost_labour', group: 'FREIGHT', label: 'Driver labour', detail: `${minutes} min × ${money(oc.driverCostPerHour)}/hr`, amount: labour }));

  // Legacy per-stop consumables; V1 pins it to 0 so the line only appears on frozen estimates that had one.
  const stopCost = round2(stops * oc.fixedCostPerStop);
  if (stopCost > 0) costLines.push(line({ key: 'cost_stops', group: 'FREIGHT', label: 'Handling per stop', detail: `${stops} stops × ${money(oc.fixedCostPerStop)}`, amount: stopCost }));

  const direct = costLines.reduce((sum, l) => sum + l.amount, 0);
  const overhead = round2((direct * oc.overheadPercent) / 100);
  if (overhead > 0) {
    costLines.push(line({ key: 'cost_overhead', group: 'FREIGHT', label: 'Allocated overhead', detail: `${oc.overheadPercent}% of direct cost`, amount: overhead }));
  }

  const estimatedCost = round2(direct + overhead);
  const grossProfit = round2(revenue - estimatedCost);
  const grossMarginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;
  return {
    complete: missingInputs.length === 0,
    missingInputs,
    basis: `${input.timeSource ?? 'Estimated'} ${input.durationBasis === 'TOTAL_SERVICE' ? 'total service duration (handling and waiting included)' : 'driving + handling + waiting'}; ${input.handlingMinutes == null ? 'default' : 'entered'} handling; configured vehicle, labour and additional handling costs`,
    revenueExcludingTax: revenue,
    estimatedCost,
    costLines,
    grossProfit,
    grossMarginPercent
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
  const service: DeliveryService | undefined = catalogue.services.find((s) => s.id === order.serviceId);
  const vehicle: VehicleType | undefined = order.vehicleId
    ? catalogue.vehicles.find((v) => v.id === order.vehicleId)
    : undefined;
  const automaticTax = order.taxCalculation === 'COMPANY' || order.taxCalculation === 'DESTINATION';
  const taxCustomer = order.billingCustomerId ? ctx.customers.find(c => c.id === order.billingCustomerId) : customer;
  const taxDecision = automaticTax ? ctx.destinationTax ?? (order.taxCalculation === 'COMPANY' ? resolveCompanyTax(order, billing, taxCustomer) : resolveDestinationTax(order, billing, taxCustomer, ctx.asOf ?? new Date())) : undefined;
  const taxProfile = automaticTax ? taxDecision?.profile ?? null : resolveTaxProfile(customer, billing);
  const taxExempt = !automaticTax && !!customer?.taxExempt;
  const ratesFor = (group: ChargeGroup, taxable = true): TaxRate[] =>
    taxExempt || !taxable ? [] : (taxProfile?.taxes ?? []).filter(t => t.active && t.ratePercent > 0 && t.appliesTo.includes(group));
  const netValue = (amount: number, group: ChargeGroup, taxable = true): number =>
    billing.invoicing.pricesIncludeTax ? amount / (1 + ratesFor(group, taxable).reduce((n, t) => n + t.ratePercent, 0) / 100) : amount;
  const netAmount = (amount: number, group: ChargeGroup, taxable = true): number =>
    round2(netValue(amount, group, taxable));


  const resolutionMode = () => ctx.pricing.rateCards.find(c => c.id === order.rateCardOverrideId)?.importedPriceMode ?? resolvedImportMode;
  let resolvedImportMode: 'FREIGHT' | 'FINAL_TOTAL' = 'FREIGHT';
  const base = (status: PricingSnapshot['status'], extra: Partial<PricingSnapshot> = {}): PricingSnapshot => ({
    context: structuredClone({ ...ctx, distanceWeightMode: ctx.distanceWeightMode ?? 'NONE', servicePricingMode: ctx.servicePricingMode ?? 'FIXED', dimensionalWeightMode: ctx.dimensionalWeightMode ?? 'METHOD_SPECIFIC', asOf: ctx.asOf ?? new Date(), ...(taxDecision ? { destinationTax: taxDecision } : {}) }),
    taxDecision,
    orderFacts: structuredClone(order),
    quoteExpiresAt: new Date((ctx.asOf ?? new Date()).getTime() + billing.invoicing.quoteValidityDays * 86400000).toISOString(),
    imported: order.importedPrice != null ? { source: order.externalSource, reference: order.externalReference, amount: order.importedPrice, mode: resolutionMode() } : undefined,
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
    return base('UNAVAILABLE', {
      candidates: resolution.candidates
    });
  }
  const card = resolution.card;
  resolvedImportMode = card.importedPriceMode ?? 'FREIGHT';
  // Historical minuteRate/includedMinutes values never participate in normal freight.
  if (order.routeKm != null && (!Number.isFinite(order.routeKm) || order.routeKm < 0) || order.packages.some(p => [p.quantity, p.weightKg, p.lengthCm, p.widthCm, p.heightCm, p.declaredValue].some(n => !Number.isFinite(n) || n < 0))) {
    errors.push({ code: 'INVALID_ORDER', message: 'Distances, quantities, weights, dimensions and values must be finite nonnegative numbers.' });
    return base('NEEDS_ATTENTION');
  }
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

  if (taxDecision && (taxDecision.error || taxDecision.destinationKey !== taxDestinationKey(order))) {
    errors.push({ code: 'TAX_REVIEW_REQUIRED', message: taxDecision.error ?? 'Destinations changed from the saved quote. Re-price the order before settlement.' });
    return base('NEEDS_ATTENTION', { rateCard: resolved, method: card.pricingMethod });
  }
  if (!taxProfile && !taxExempt && !(card.importedPriceMode === 'FINAL_TOTAL' && ['SUPPLIED', 'EXEMPT'].includes(order.importedTaxTreatment ?? ''))) {
    errors.push({ code: 'INVALID_CONFIGURATION', message: 'The configured customer or organization tax profile is missing. Select a valid profile.' });
    return base('NEEDS_ATTENTION', { rateCard: resolved, method: card.pricingMethod });
  }
  const legacyDistanceWeight = ctx.distanceWeightMode === 'LEGACY';
  const dimEnabled = (card.pricingMethod !== 'BASE_PLUS_DISTANCE' || legacyDistanceWeight) && (ctx.dimensionalWeightMode === 'LEGACY_CARD_SETTING'
    ? inherit(card.dimensionalPricingEnabled, billing.general.dimensionalPricingEnabled)
    : ctx.dimensionalWeightMode === 'MAX' || hasDimensionalWeightSetting(card.pricingMethod) || card.pricingMethod === 'BASE_PLUS_DISTANCE');
  const dimDivisor = dimEnabled ? inherit(card.dimensionalDivisor, billing.general.dimensionalDivisor) : 0;
  if (dimEnabled && (!Number.isFinite(dimDivisor) || dimDivisor <= 0)) {
    errors.push({ code: 'INVALID_CONFIGURATION', message: 'Dimensional pricing requires a finite positive divisor.' });
    return base('NEEDS_ATTENTION', { rateCard: resolved, method: card.pricingMethod });
  }
  // ---- 2. Resolve inherited parameters -----------------------------------
  const svcOverride = card.serviceOverrides[service.id];
  const baseFee = inherit(svcOverride?.baseFee, card.baseFee);
  const includedKm = inherit(svcOverride?.includedKm, card.includedKm);
  const kmRate = inherit(svcOverride?.kmRate, card.kmRate);
  const fixedServicePricing = (ctx.servicePricingMode ?? 'FIXED') === 'FIXED';
  const multiplier = fixedServicePricing ? 1 : inherit(svcOverride?.multiplier, service.defaultMultiplier);
  const additionalCharge = service.additionalCharge;
  const includedStops = inherit(card.includedStops, billing.general.defaultIncludedStops);
  const extraStopRate = inherit(card.extraStopRate, billing.general.defaultExtraStopRate);
  const waitingRule = catalogue.accessorials.find(a => a.active && a.autoRule === 'WAITING_RECORDED');
  const waitFree = inherit(card.waitFreeMinutes, waitingRule?.freeAllowance ?? 0);
  const waitIncrement = inherit(card.waitIncrementMinutes, waitingRule?.incrementMinutes ?? 0);
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

  const costForOrder = (revenue: number): CostEstimate => estimateInternalCost({
    routeKm: order.routeKm, stopCount, driveMinutes: minutesForPricing ?? undefined,
    durationBasis: order.durationBasis, handlingMinutes: order.handlingMinutes,
    waitMinutes: order.stops.reduce((n, stop) => n + Math.max(0, stop.waitMinutes), 0),
    timeSource: order.stage === 'FINAL' && order.actualMinutes != null ? 'Actual' : 'Estimated', vehicleId: order.vehicleId
  }, billing, revenue);

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
    lines.push(line({ key: 'base_fee', group: 'FREIGHT', label: 'Base Fee', detail: `Includes ${round2(toDisplayDistance(includedKm, billing.general))} ${billing.general.distanceUnit}`, amount: round2(baseFee), fuelEligible: true }));

    const extraKm = round2(Math.max(0, billableKm - includedKm));
    if (extraKm > 0 || kmRate > 0) {
      lines.push(line({ key: 'distance', group: 'FREIGHT', label: 'Distance Charge', detail: extraKm > 0 ? `${round2(toDisplayDistance(extraKm, billing.general))} ${billing.general.distanceUnit} × ${money(toDisplayDistanceRate(kmRate, billing.general))}/${billing.general.distanceUnit}` : 'Within included distance', quantity: extraKm, unitRate: kmRate, amount: round2(extraKm * kmRate), fuelEligible: true }));
    }

    if (legacyDistanceWeight && card.weightRatePerKg > 0) {
      const extraKg = round2(Math.max(0, chargeableWeight - card.includedWeightKg));
      const basis = dimEnabled && dimWeight > actualWeight ? 'dimensional' : 'actual';
      if (extraKg > 0) lines.push(line({ key: 'load', group: 'FREIGHT', label: 'Load Charge', detail: extraKg > 0 ? `${round2(toDisplayWeight(extraKg, billing.general))} ${billing.general.weightUnit} (${basis}) × ${money(toDisplayWeightRate(card.weightRatePerKg, billing.general))}/${billing.general.weightUnit}` : `Within ${round2(toDisplayWeight(card.includedWeightKg, billing.general))} ${billing.general.weightUnit} included`, quantity: extraKg, unitRate: card.weightRatePerKg, amount: round2(extraKg * card.weightRatePerKg), fuelEligible: true }));
    }

    if (card.pieceRate > 0) {
      const extraPieces = Math.max(0, pieces - card.includedPieces);
      if (extraPieces > 0) lines.push(line({ key: 'pieces', group: 'FREIGHT', label: 'Piece Charge', detail: extraPieces > 0 ? `${extraPieces} × ${money(card.pieceRate)}` : `Within ${card.includedPieces} pieces included`, quantity: extraPieces, unitRate: card.pieceRate, amount: round2(extraPieces * card.pieceRate), fuelEligible: true }));
    }

    const extraStops = Math.max(0, stopCount - includedStops);
    if (extraStops > 0 && extraStopRate !== 0) {
      lines.push(line({ key: 'stops', group: 'FREIGHT', label: 'Extra Stops', detail: `${extraStops} × ${money(extraStopRate)}`, quantity: extraStops, unitRate: extraStopRate, amount: round2(extraStops * extraStopRate), fuelEligible: true }));
    }

    freight = round2(lines.filter((l) => l.group === 'FREIGHT').reduce((s, l) => s + l.amount, 0));
    serviceFreight = round2(freight * multiplier);
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
      if (!card.hourlyClockStart?.trim() || !card.hourlyClockStop?.trim()) {
        errors.push({ code: 'INVALID_CONFIGURATION', message: 'Define when this hourly contract starts and stops its billable clock.' });
        break;
      }
      const useActual = order.stage === 'FINAL' && (card.hourlySettleActual ?? true);
      let duration = useActual ? order.actualHourlyBillableMinutes : order.hourlyBillableMinutes;
      if (duration == null) {
        const supplied = useActual ? order.actualMinutes : order.estimatedMinutes;
        if (supplied != null && order.durationBasis === 'TOTAL_SERVICE' && (card.hourlyIncludesHandling ?? true) && (card.hourlyIncludesWaiting ?? true)) duration = supplied;
        if (supplied != null && order.durationBasis === 'DRIVING_ONLY') {
          const handling = order.handlingMinutes;
          if (!(card.hourlyIncludesHandling ?? true) || handling != null) duration = supplied + ((card.hourlyIncludesHandling ?? true) ? handling! : 0) + ((card.hourlyIncludesWaiting ?? true) ? order.stops.reduce((n, stop) => n + stop.waitMinutes, 0) : 0);
        }
      }
      if (duration == null || !Number.isFinite(duration) || duration < 0) {
        errors.push({ code: 'MISSING_DURATION', message: `Enter ${useActual ? 'actual' : 'estimated'} billable minutes for the agreed hourly clock.` });
        break;
      }
      const billable = Math.max(card.minimumBillableMinutes, ceilToIncrement(duration, card.billingIncrementMinutes));
      inputs.billableMinutes = billable;
      freight = round2((billable / 60) * card.hourlyRate);
      lines.push(line({ key: 'hourly', group: 'FREIGHT', label: 'Hourly Charge', detail: `${card.hourlyClockStart} → ${card.hourlyClockStop}; ${billable} min × ${money(card.hourlyRate)}/h (${useActual ? 'actual' : 'estimated'})`, amount: freight, fuelEligible: true }));
      serviceFreight = card.applyServiceMultiplier ? round2(freight * multiplier) : freight;
      multiplierApplied = card.applyServiceMultiplier;
      break;
    }

    case 'ZONE': {
      const drops = order.stops.filter(s => s.type === 'DROPOFF');
      const movements = drops.flatMap(drop => [...new Set(drop.pickupIds ?? [])].map(id => ({ pickup: order.stops.find(s => s.id === id && s.type === 'PICKUP'), drop })));
      const invalid = !drops.length || drops.some(d => !d.pickupIds?.length) || movements.some(m => !m.pickup?.zoneId || !m.drop.zoneId);
      if (invalid) {
        if (card.zoneNoMatchFallback === 'BASE_PLUS_DISTANCE') {
          warnings.push('Commercial pickup-to-delivery movements are incomplete; using the contract Base + Distance fallback.');
          effectiveMethod = 'BASE_PLUS_DISTANCE'; computeCalculated();
        } else errors.push({ code: 'MISSING_MOVEMENTS', message: 'Link each delivery to its supplying pickup(s) and assign zones to those stops.' });
        break;
      }
      let unmatched = false;
      const zoneLines: ChargeLine[] = [];
      const findRate = (rates: typeof ctx.pricing.zoneRates, origin: string, destination: string) => {
        const matches = rates.filter(r => r.originZoneId === origin && r.destinationZoneId === destination && (!r.serviceId || r.serviceId === service.id));
        const specific = matches.filter(r => r.serviceId === service.id);
        const candidates = specific.length ? specific : matches;
        if (candidates.length > 1) errors.push({ code: 'INVALID_CONFIGURATION', message: 'Duplicate zone rates match the same movement and service.' });
        return candidates[0];
      };
      for (const { pickup, drop } of movements) {
        const rate = findRate(card.zoneMatrixMode === 'CONTRACT' ? card.zoneRates ?? [] : ctx.pricing.zoneRates, pickup!.zoneId!, drop.zoneId!);
        if (!rate) { unmatched = true; break; }
        // A single movement can infer package links. Multiple movements require explicit links.
        const unknownLinks = rate.weightBands && order.packages.some(pkg => pkg.quantity > 0 &&
          ((!pkg.pickupStopId || !pkg.deliveryStopId) && movements.length > 1 ||
           pkg.pickupStopId && pkg.deliveryStopId && !movements.some(m => m.pickup?.id === pkg.pickupStopId && m.drop.id === pkg.deliveryStopId)));
        const packages = order.packages.filter(pkg =>
          (pkg.pickupStopId ?? (movements.length === 1 ? pickup!.id : null)) === pickup!.id &&
          (pkg.deliveryStopId ?? (movements.length === 1 ? drop.id : null)) === drop.id);
        const actualMovementWeight = packages.reduce((total, pkg) => total + pkg.quantity * pkg.weightKg, 0);
        // Historical quotes used actual movement weight, including the former global MAX mode.
        const useDimensionalBands = (ctx.dimensionalWeightMode ?? 'METHOD_SPECIFIC') === 'METHOD_SPECIFIC';
        const dimensionalMovementWeight = useDimensionalBands
          ? packages.reduce((total, pkg) => total + pkg.quantity * pkg.lengthCm * pkg.widthCm * pkg.heightCm, 0) / dimDivisor
          : 0;
        // Keep unknown/zero actual weights in review; never round down into a cheaper band.
        const movementWeight = unknownLinks ? NaN : actualMovementWeight <= 0 ? 0
          : Math.max(actualMovementWeight, dimensionalMovementWeight);
        const amount = zoneAmountForWeight(rate, movementWeight);
        if (amount == null) {
          errors.push({ code: 'ZONE_NO_MATCH', message: `No matching weight band for ${pickup!.label || pickup!.id} → ${drop.label || drop.id}. Check package weights, dimensions and pickup/delivery links, or request a quote.` });
          break;
        }
        zoneLines.push(line({ key: `zone_${pickup!.id}_${drop.id}`, group: 'FREIGHT', label: 'Zone movement', detail: `${pickup!.label || pickup!.id} → ${drop.label || drop.id}; ${rate.weightBands ? `${round2(toDisplayWeight(movementWeight, billing.general))} ${billing.general.weightUnit} ${useDimensionalBands ? `chargeable weight (actual ${round2(toDisplayWeight(actualMovementWeight, billing.general))} ${billing.general.weightUnit}, dimensional ${round2(toDisplayWeight(dimensionalMovementWeight, billing.general))} ${billing.general.weightUnit})` : 'actual weight'}` : 'packages on this movement combined'}`, amount: round2(amount), fuelEligible: true }));
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
      serviceFreight = card.applyServiceMultiplier ? round2(freight * multiplier) : freight;
      multiplierApplied = card.applyServiceMultiplier;
      break;
    }
  }

  if (errors.length) {
    return base('NEEDS_ATTENTION', { rateCard: resolved, candidates: resolution.candidates, method: effectiveMethod });
  }

  // Final agreed totals bypass every modifier, including final rounding.
  if (effectiveMethod === 'IMPORTED' && card.importedPriceMode === 'FINAL_TOTAL') {
    if (!order.importedTaxTreatment || order.importedPrice! < 0) {
      errors.push({ code: 'MISSING_IMPORT_TAX', message: 'Specify included tax, supplied tax, or tax exemption for the final agreed total.' });
      return base('NEEDS_ATTENTION', { rateCard: resolved, method: effectiveMethod });
    }
    const agreed = order.importedPrice!;
    const importRates = ratesFor('transport');
    if (order.importedTaxTreatment === 'INCLUDED' && !taxExempt && !taxProfile) {
      errors.push({ code: 'MISSING_IMPORT_TAX', message: 'Select a tax profile or provide the supplied tax amount.' });
      return base('NEEDS_ATTENTION', { rateCard: resolved, method: effectiveMethod });
    }
    const tax = order.importedTaxTreatment === 'EXEMPT' ? 0 : order.importedTaxTreatment === 'SUPPLIED' ? order.importedTaxAmount : round2(agreed - agreed / (1 + importRates.reduce((n, t) => n + t.ratePercent, 0) / 100));
    if (tax == null || !Number.isFinite(tax) || tax < 0 || tax > agreed) {
      errors.push({ code: 'MISSING_IMPORT_TAX', message: 'Supplied tax must be between zero and the agreed total.' });
      return base('NEEDS_ATTENTION', { rateCard: resolved, method: effectiveMethod });
    }
    const revenue = round2(agreed - tax);
    lines.splice(0, lines.length, line({ key: 'imported', group: 'FREIGHT', label: 'Imported agreed total (excluding tax)', detail: `${order.externalSource ?? 'External'} · ${order.externalReference ?? 'No reference'}`, amount: revenue }));
    return base('PRICED', { rateCard: resolved, candidates: resolution.candidates, method: effectiveMethod, freight: revenue, serviceFreight: revenue, subtotal: revenue, taxTotal: tax, total: agreed, taxLines: tax ? [line({ key: 'import_tax', group: 'TAX', label: 'Included / supplied tax', amount: tax, taxable: false })] : [], cost: costForOrder(revenue) });
  }

  if (!isValidFuelPercent(fuelPercent)) {
    errors.push({ code: 'INVALID_CONFIGURATION', message: 'Enter a valid nonnegative fuel surcharge in Pricing → Fuel Charge.' });
    return base('NEEDS_ATTENTION', { rateCard: resolved, method: effectiveMethod });
  }

  for (const charge of lines) charge.amount = netAmount(charge.amount, groupOfLine(charge), charge.taxable);
  freight = round2(lines.reduce((n, l) => n + l.amount, 0));
  const appliedMultiplier = multiplierApplied ? multiplier : 1;
  if (fixedServicePricing) {
    if (additionalCharge == null || !Number.isFinite(additionalCharge) || additionalCharge < 0 || Math.abs(additionalCharge * 100 - Math.round(additionalCharge * 100)) > 0.000001) {
      errors.push({ code: 'INVALID_CONFIGURATION', message: `Set a valid fixed charge for ${service.name} in Pricing → Service Level.` });
      return base('NEEDS_ATTENTION', { rateCard: resolved, method: effectiveMethod });
    }
    const serviceCharge = netAmount(additionalCharge, 'transport');
    inputs.serviceCharge = serviceCharge;
    serviceFreight = round2(freight + serviceCharge);
    if (serviceCharge > 0) lines.push(line({ key: 'service_charge', group: 'SERVICE', label: `${service.name} service`, detail: 'Fixed charge · once per order', amount: serviceCharge, fuelEligible: true }));
  } else serviceFreight = round2(freight * appliedMultiplier);
  if (appliedMultiplier !== 1) lines.push(line({ key: 'service_multiplier', group: 'SERVICE', label: `${service.name} ×${appliedMultiplier.toFixed(2)}`, amount: round2(serviceFreight - freight), fuelEligible: true }));
  if (effectiveMethod !== 'IMPORTED' && serviceFreight < card.minimumFreight) {
    lines.push(line({ key: 'minimum_freight', group: 'MINIMUM', label: 'Minimum freight', detail: fixedServicePricing ? 'Freight floor excluding tax, after the service charge' : 'Freight floor excluding tax, after the service multiplier', amount: round2(card.minimumFreight - serviceFreight), fuelEligible: true }));
    serviceFreight = card.minimumFreight;
  }

  // ---- 5. Vehicle surcharge ------------------------------------------------
  let vehicleSurcharge = 0;
  const applyVehicle = effectiveMethod === 'BASE_PLUS_DISTANCE' || card.applyVehicleSurcharge;
  if (vehicle && applyVehicle) {
    const override = card.vehicleSurchargeOverrides[vehicle.id];
    vehicleSurcharge = netAmount(inherit(override, vehicle.baseSurcharge), 'transport');
    if (vehicleSurcharge > 0 || override !== undefined) {
      lines.push(line({ key: 'vehicle', group: 'VEHICLE', label: 'Vehicle Surcharge', detail: override !== undefined ? `${vehicle.name} (contract rate)` : vehicle.name, amount: vehicleSurcharge, fuelEligible: vehicle.fuelEligible }));
    }
  }

  // ---- 6. Accessorials -----------------------------------------------------
  let accessorialsTotal = 0;
  const applyAccessorials = effectiveMethod === 'BASE_PLUS_DISTANCE' || card.applyAccessorials;
  if (applyAccessorials) {
    const reasons = new Map<string, string>();
    const requested = new Map(order.accessorials.map((a) => [a.accessorialId, Math.max(0, a.quantity)]));

    // Auto rules add an accessorial the dispatcher did not tick.
    for (const acc of catalogue.accessorials) {
      if (!acc.active || acc.autoRule === 'NONE' || requested.has(acc.id)) continue;
      if (acc.autoRule === 'AFTER_HOURS' && isAfterHours(order.scheduledAt, billing.general.timeZone ?? 'America/Vancouver')) requested.set(acc.id, 1);
      if (acc.autoRule === 'WEEKEND' && isWeekend(order.scheduledAt, billing.general.timeZone ?? 'America/Vancouver')) requested.set(acc.id, 1);
      if (acc.autoRule === 'RESIDENTIAL_STOP') {
        const residentialStops = order.stops.filter((s) => s.residential).length;
        if (residentialStops > 0) requested.set(acc.id, acc.appliesAt === 'PER_STOP' ? residentialStops : 1);
      }
    }

    for (const acc of catalogue.accessorials) if (acc.autoRule !== 'NONE' && requested.has(acc.id) && !order.accessorials.some(a => a.accessorialId === acc.id)) reasons.set(acc.id, `Automatic: ${acc.autoRule.toLowerCase().replaceAll('_', ' ')}`);

    // Only the explicit waiting trigger consumes stop waiting minutes.
    const totalWait = order.stops.reduce((n, s) => n + Math.max(0, s.waitMinutes), 0);
    for (const acc of catalogue.accessorials) {
      if (acc.active && acc.autoRule === 'WAITING_RECORDED' && totalWait > 0) {
        requested.set(acc.id, totalWait);
        reasons.set(acc.id, 'Automatic: waiting recorded at stops');
      }
    }

    const waitingRules = catalogue.accessorials.filter(a => a.active && a.autoRule === 'WAITING_RECORDED' && requested.has(a.id));
    if (waitingRules.length > 1) errors.push({ code: 'INVALID_CONFIGURATION', message: 'More than one waiting rule would charge the same minutes. Keep one active Waiting recorded rule.' });
    for (const [id, qty] of requested) {
      const acc: AccessorialItem | undefined = catalogue.accessorials.find((a) => a.id === id);
      if (!acc || !acc.active) continue;
      if (acc.autoRule === 'WAITING_RECORDED' && effectiveMethod === 'HOURLY' && (card.hourlyIncludesWaiting ?? true)) {
        warnings.push(`${acc.name} omitted: waiting is included in the hourly contract.`); continue;
      }
      const override = card.accessorialRateOverrides[acc.id];
      const rawRate = inherit(override, acc.rate);
      // Preserve unit-rate and per-stop-limit precision; round the completed charge.
      const rate = acc.calculationType.startsWith('PERCENT_') ? rawRate : netValue(rawRate, 'accessorials', acc.taxable);
      const rateLabel = `${money(rawRate)}${billing.invoicing.pricesIncludeTax && ratesFor('accessorials', acc.taxable).length ? ' incl. tax' : ''}`;
      const minimumCharge = acc.minimumCharge == null ? null : netValue(acc.minimumCharge, 'accessorials', acc.taxable);
      const maximumCharge = acc.maximumCharge == null ? null : netValue(acc.maximumCharge, 'accessorials', acc.taxable);
      let amount = 0;
      let detail = '';
      let billableQty = qty;

      switch (acc.calculationType) {
        case 'FLAT':
          billableQty = acc.appliesAt === 'PER_STOP' ? Math.max(1, qty) : 1;
          amount = rate * billableQty;
          detail = billableQty > 1 ? `${billableQty} stops × ${rateLabel}` : `Flat: ${rateLabel}`;
          break;
        case 'PER_UNIT': {
          const free = acc.freeAllowance ?? 0;
          billableQty = Math.max(0, qty - free);
          amount = billableQty * rate;
          detail = `${billableQty} ${acc.unitLabel.replace(/^per\s+/, '')}${free ? ` (after ${free} free)` : ''} × ${rateLabel}`;
          break;
        }
        case 'PER_MINUTE': {
          const free = acc.autoRule === 'WAITING_RECORDED' ? card.waitFreeMinutes ?? acc.freeAllowance ?? 0 : acc.freeAllowance ?? 0;
          const increment = acc.autoRule === 'WAITING_RECORDED' ? card.waitIncrementMinutes ?? acc.incrementMinutes ?? 0 : acc.incrementMinutes ?? 0;
          const stopWaits = order.stops.map((s) => Math.max(0, s.waitMinutes)).filter((w) => w > 0);
          if (acc.autoRule === 'WAITING_RECORDED' && acc.appliesAt === 'PER_STOP' && stopWaits.length) {
            // Allowance is per stop: 10 + 30 min waits with 15 free bills 15, not 10.
            billableQty = stopWaits.reduce((n, w) => n + ceilToIncrement(Math.max(0, w - free), increment), 0);
            detail = `${stopWaits.join(' + ')} min, ${free} free per stop → ${billableQty} billable × ${rateLabel} per minute`;
          } else {
            billableQty = ceilToIncrement(Math.max(0, qty - free), increment);
            detail = `${qty} min − ${free} free → ${billableQty} billable × ${rateLabel} per minute`;
          }
          amount = billableQty * rate;
          if (acc.autoRule === 'WAITING_RECORDED' && acc.appliesAt === 'PER_STOP' && stopWaits.length) {
            amount = stopWaits.reduce((sum, w) => {
              let charge = ceilToIncrement(Math.max(0, w - free), increment) * rate;
              if (charge > 0 && minimumCharge != null) charge = Math.max(charge, minimumCharge);
              if (maximumCharge != null) charge = Math.min(charge, maximumCharge);
              return sum + charge;
            }, 0);
          }
          break;
        }
        case 'PER_HOUR':
          amount = qty * rate;
          detail = `${qty} h × ${rateLabel} per hour`;
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

      if (!(acc.autoRule === 'WAITING_RECORDED' && acc.appliesAt === 'PER_STOP') && minimumCharge != null && amount > 0 && amount < minimumCharge) {
        amount = minimumCharge;
        detail += ` — min ${money(minimumCharge)}`;
      }
      if (!(acc.autoRule === 'WAITING_RECORDED' && acc.appliesAt === 'PER_STOP') && maximumCharge != null && amount > maximumCharge) {
        amount = maximumCharge;
        detail += ` — capped at ${money(maximumCharge)}`;
      }
      amount = round2(amount);
      if (amount <= 0 && override === undefined) continue;

      accessorialsTotal = round2(accessorialsTotal + amount);
      lines.push(line({ key: `acc_${acc.id}`, group: 'ACCESSORIAL', label: acc.name, detail: [override !== undefined ? `${detail} (contract rate)` : detail, reasons.get(id)].filter(Boolean).join(' · '), quantity: billableQty, unitRate: rate, amount, fuelEligible: acc.fuelEligible, taxable: acc.taxable }));
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
    lines.push(line({ key: 'fuel', group: 'FUEL', label: billing.fuelSurcharge.label || 'Fuel Surcharge', detail: `${fuelPercent}% of ${money(fuelBase)}${card.fuelPercent != null ? ' (contract rate)' : ''}`, amount: fuelSurcharge, taxable: billing.fuelSurcharge.taxable }));
  }

  // ---- 8. Contract-controlled Admin / Dispatch Fee -------------
  let companyCharge = 0;
  const sc = billing.serviceCharge;
  if (card.applyAdminFee ?? sc.enabled) {
    const basis = sc.basis === 'transport_only' ? serviceFreight + vehicleSurcharge : serviceFreight + vehicleSurcharge + accessorialsTotal;
    const asPercent = round2((basis * sc.percent) / 100);
    companyCharge = sc.mode === 'flat' ? netAmount(sc.flatAmount, 'service_charge', sc.taxable) : sc.mode === 'greater_of' ? Math.max(asPercent, netAmount(sc.flatAmount, 'service_charge', sc.taxable)) : asPercent;
    if (companyCharge > 0) {
      lines.push(line({ key: 'company_charge', group: 'COMPANY_CHARGE', label: sc.label, detail: sc.mode === 'flat' ? 'Flat' : `${sc.percent}% of ${money(basis)}`, amount: companyCharge, taxable: sc.taxable }));
    }
  }

  // Contract discounts are net amounts; one resolved discount, never stacked.
  const beforeDiscount = round2(serviceFreight + vehicleSurcharge + fuelSurcharge + accessorialsTotal + companyCharge);
  const shipperDiscount = customer?.discount;
  const discountRule = ctx.pricing.discountSource === 'SHIPPER'
    ? shipperDiscount && (shipperDiscount.type === 'PERCENT' || shipperDiscount.type === 'FIXED') ? { ...shipperDiscount, scope: 'TRANSPORT_ONLY' as const } : null
    : card.applyContractDiscount === false ? null : resolveDiscount(card);
  const discountGroups = discountRule?.scope === 'TRANSPORT_ONLY' ? ['FREIGHT', 'SERVICE', 'MINIMUM', 'VEHICLE'] : ['FREIGHT', 'SERVICE', 'MINIMUM', 'VEHICLE', 'FUEL', 'ACCESSORIAL', 'COMPANY_CHARGE'];
  const eligibleLines = lines.filter(l => discountGroups.includes(l.group));
  const discountBase = round2(eligibleLines.reduce((n, l) => n + l.amount, 0));
  const discount = discountRule ? round2(Math.min(discountBase, Math.max(0, discountRule.type === 'PERCENT' ? discountBase * discountRule.value / 100 : discountRule.value))) : 0;
  const taxBases = new Map<string, number>();
  let remainingDiscount = discount;
  eligibleLines.forEach((charge, index) => {
    const share = index === eligibleLines.length - 1 ? remainingDiscount : round2(discountBase > 0 ? discount * charge.amount / discountBase : 0);
    remainingDiscount = round2(remainingDiscount - share);
    taxBases.set(charge.key, round2(charge.amount - share));
  });
  if (discount > 0) lines.push(line({ key: 'discount', group: 'DISCOUNT', label: 'Contract discount', detail: discountRule!.scope === 'TRANSPORT_ONLY' ? 'Freight, service adjustment, freight minimum and vehicle surcharge; excludes fuel' : 'All pre-tax customer charges', amount: -discount, taxable: false }));
  let adjustmentsTotal = 0;
  for (const adj of order.adjustments) {
    const amount = round2(adj.amount);
    if (!Number.isFinite(amount)) { errors.push({ code: 'INVALID_ORDER', message: 'Adjustment amount must be finite.' }); continue; }
    adjustmentsTotal = round2(adjustmentsTotal + amount);
    lines.push(line({ key: `adj_${adj.id}`, group: 'ADJUSTMENT', label: amount < 0 ? 'Manual discount' : 'Manual adjustment', detail: `${adj.reason} (excluding tax)`, amount, taxable: adj.taxable }));
  }
  const minimum = card.applyOrderMinimum === false ? 0 : card.minimumOrderSubtotal ?? billing.rules.minimumChargePerJob;
  const discounted = round2(beforeDiscount - discount + adjustmentsTotal);
  const minimumAdjustment = round2(Math.max(0, minimum - discounted));
  if (minimumAdjustment > 0) lines.push(line({ key: 'minimum_order', group: 'MINIMUM', label: 'Minimum order subtotal', detail: `Floor excluding tax, after discounts and adjustments: ${money(minimum)}`, amount: minimumAdjustment }));
  const subtotal = round2(discounted + minimumAdjustment);
  const taxLines: ChargeLine[] = [];
  let taxTotal = 0;
  if (!taxExempt && taxProfile) {
    for (const tax of taxProfile.taxes.filter(t => t.active && t.ratePercent > 0)) {
      const taxableBase = lines.filter(l => l.taxable && l.group !== 'DISCOUNT' && tax.appliesTo.includes(groupOfLine(l))).reduce((n, l) => n + (taxBases.get(l.key) ?? l.amount), 0);
      const amount = round2(Math.max(0, taxableBase) * tax.ratePercent / 100);
      taxTotal = round2(taxTotal + amount);
      if (amount) taxLines.push(line({ key: `tax_${tax.id}`, group: 'TAX', label: `${tax.name} (${tax.ratePercent}%)`, detail: `on ${money(taxableBase)} excluding tax`, amount, taxable: false }));
    }
  }
  const total = roundMoney(subtotal + taxTotal);
  if (errors.length) return base('NEEDS_ATTENTION', { rateCard: resolved, candidates: resolution.candidates, method: effectiveMethod });
  return base('PRICED', {
    rateCard: resolved, candidates: resolution.candidates, method: effectiveMethod,
    freight, serviceFreight, vehicleSurcharge, fuelSurcharge, companyCharge,
    accessorialsTotal, minimumAdjustment, discount, adjustmentsTotal, subtotal,
    taxLines, taxTotal, total, roundingAdjustment: round2(total - subtotal - taxTotal), cost: costForOrder(subtotal)
  });
};

export const buildPricingContext = (parts: Omit<PricingContext, 'asOf'>): PricingContext => parts;
