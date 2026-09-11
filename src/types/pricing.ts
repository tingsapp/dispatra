// Commercial pricing model: Rate Cards, Zones, Customer Groups, and the
// Order-side inputs/outputs of the pricing engine.
//
// Four kinds of value, four homes:
//   Order facts           → PricingOrderInput   (route km, weight, stops…)
//   Pricing configuration → RateCard / Zone / catalogue / org defaults
//   Calculated amounts    → ChargeLine
//   Frozen result         → PricingSnapshot
//
// `null` on a Rate Card field means "inherit from the level below"
// (service default, vehicle default, or organization default).
// A numeric zero means explicitly zero.

export type PricingMethod = 'BASE_PLUS_DISTANCE' | 'FIXED' | 'ZONE' | 'HOURLY' | 'IMPORTED';

export type RateCardScope = 'ORGANIZATION' | 'CUSTOMER_GROUP' | 'CUSTOMER';

export type RateCardStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type DiscountType = 'NONE' | 'PERCENT' | 'FIXED';

/** Which charges a contractual discount reduces. */
export type DiscountScope = 'TRANSPORT_ONLY' | 'SUBTOTAL';

export interface Discount {
  type: DiscountType;
  value: number;
  scope: DiscountScope;
}

/** Per-service rate overrides inside a Rate Card. `null` inherits the card's base values. */
export interface ServiceRateOverride {
  baseFee: number | null;
  includedKm: number | null;
  kmRate: number | null;
  /** Overrides the Service's default multiplier. */
  multiplier: number | null;
}

export interface RateCard {
  id: string;
  name: string;
  code: string;
  status: RateCardStatus;
  /** Incremented on every save so a PricingSnapshot can pin the exact revision. */
  version: number;

  // ---- Scope & applicability -------------------------------------------
  scope: RateCardScope;
  customerId: string | null;
  customerGroupId: string | null;
  /** Restrict to one service. `null` = all services. */
  serviceId: string | null;
  /** Restrict to one vehicle type. `null` = any vehicle. */
  vehicleId: string | null;
  /** Tie-breaker within a level — higher wins. Equal priority = conflict. */
  priority: number;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  currency: 'CAD' | 'USD';

  pricingMethod: PricingMethod;

  // ---- BASE_PLUS_DISTANCE --------------------------------------------------
  baseFee: number;
  includedKm: number;
  kmRate: number;
  includedMinutes: number;
  minuteRate: number;
  includedWeightKg: number;
  weightRatePerKg: number;
  includedPieces: number;
  pieceRate: number;
  /** `null` inherits the organization default. */
  includedStops: number | null;
  extraStopRate: number | null;
  /** Floor applied to freight *before* the service multiplier. */
  minimumFreight: number;
  serviceOverrides: Record<string, ServiceRateOverride>;

  // ---- FIXED -------------------------------------------------------------
  fixedAmount: number;

  // ---- HOURLY ------------------------------------------------------------
  hourlyRate: number;
  minimumBillableMinutes: number;
  billingIncrementMinutes: number;

  // ---- ZONE --------------------------------------------------------------
  /** What to do when no origin→destination rate exists. */
  zoneNoMatchFallback: 'NEEDS_ATTENTION' | 'BASE_PLUS_DISTANCE';

  // ---- What still applies around a non-calculated freight amount ----------
  applyServiceMultiplier: boolean;
  applyVehicleSurcharge: boolean;
  applyFuelSurcharge: boolean;
  applyAccessorials: boolean;

  // ---- Overrides of organization / catalogue defaults (`null` = inherit) --
  fuelPercent: number | null;
  dimensionalPricingEnabled: boolean | null;
  dimensionalDivisor: number | null;
  waitFreeMinutes: number | null;
  waitIncrementMinutes: number | null;
  vehicleSurchargeOverrides: Record<string, number>;
  accessorialRateOverrides: Record<string, number>;

  discount: Discount;
  notes: string;
  updatedAt: string;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface ZoneRate {
  id: string;
  originZoneId: string;
  destinationZoneId: string;
  amount: number;
  /** Optional service restriction. `null` = any service. */
  serviceId: string | null;
}

export interface CustomerGroup {
  id: string;
  name: string;
  description: string;
  /** Group-level card; a customer-specific card still wins. */
  rateCardId: string | null;
  discount: Discount;
}

export interface PricingConfig {
  rateCards: RateCard[];
  zones: Zone[];
  zoneRates: ZoneRate[];
  customerGroups: CustomerGroup[];
}

// ---------------------------------------------------------------------------
// Order-side input
// ---------------------------------------------------------------------------

export interface PricingStopInput {
  id: string;
  type: 'PICKUP' | 'DROPOFF';
  label?: string;
  zoneId: string | null;
  residential: boolean;
  /** Actual or expected waiting at this stop. */
  waitMinutes: number;
}

export interface PricingPackageInput {
  id: string;
  quantity: number;
  /** Per piece. Canonical units: kg and cm. */
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValue: number;
}

export interface PricingAccessorialInput {
  accessorialId: string;
  quantity: number;
}

export interface OrderPriceAdjustment {
  id: string;
  amount: number; // negative = discount
  reason: string;
  taxable: boolean;
}

export interface PricingOrderInput {
  customerId: string | null;
  serviceId: string;
  vehicleId: string | null;
  stops: PricingStopInput[];
  /** Standalone route for this order's stops. Never the driver's approach. */
  routeKm: number | null;
  estimatedMinutes: number | null;
  /** Settled duration for HOURLY at completion. */
  actualMinutes: number | null;
  packages: PricingPackageInput[];
  accessorials: PricingAccessorialInput[];
  /** ISO datetime the service window starts — drives after-hours / weekend rules. */
  scheduledAt: string | null;
  /** Order source — customer portal bookings can carry a channel discount later. */
  source: 'DISPATCHER' | 'CUSTOMER_PORTAL' | 'IMPORT';
  importedPrice: number | null;
  externalSource: string | null;
  externalReference: string | null;
  adjustments: OrderPriceAdjustment[];
  /** Explicit Rate Card override chosen by an authorized dispatcher. */
  rateCardOverrideId: string | null;
  /** ESTIMATE prices from estimates; FINAL uses actuals where available. */
  stage: 'ESTIMATE' | 'FINAL';
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type ChargeGroupKey =
  | 'FREIGHT'
  | 'MINIMUM'
  | 'SERVICE'
  | 'VEHICLE'
  | 'FUEL'
  | 'COMPANY_CHARGE'
  | 'ACCESSORIAL'
  | 'DISCOUNT'
  | 'ADJUSTMENT'
  | 'TAX';

export interface ChargeLine {
  key: string;
  group: ChargeGroupKey;
  label: string;
  detail?: string;
  quantity?: number;
  unitRate?: number;
  amount: number;
  fuelEligible: boolean;
  taxable: boolean;
}

export type PricingStatus = 'PRICED' | 'NEEDS_ATTENTION' | 'UNAVAILABLE';

export interface PricingError {
  code:
    | 'NO_RATE_CARD'
    | 'RATE_CARD_CONFLICT'
    | 'MISSING_DISTANCE'
    | 'ZONE_NO_MATCH'
    | 'MISSING_ZONE'
    | 'MISSING_DURATION'
    | 'MISSING_IMPORTED_PRICE'
    | 'CURRENCY_MISMATCH'
    | 'INACTIVE_SERVICE';
  message: string;
}

export type RateCardSource =
  | 'OVERRIDE'
  | 'CUSTOMER'
  | 'CUSTOMER_GROUP'
  | 'ORGANIZATION_SERVICE'
  | 'ORGANIZATION_DEFAULT';

export interface ResolvedRateCard {
  id: string;
  name: string;
  version: number;
  scope: RateCardScope;
  source: RateCardSource;
  pricingMethod: PricingMethod;
}

/** One entry per card considered during resolution — shown under "View calculation". */
export interface RateCardCandidate {
  id: string;
  name: string;
  source: RateCardSource;
  eligible: boolean;
  reason: string;
}

export interface ResolvedInputs {
  routeKm: number | null;
  billableKm: number;
  estimatedMinutes: number | null;
  billableMinutes: number;
  actualWeightKg: number;
  volumeCm3: number;
  dimensionalWeightKg: number;
  chargeableWeightKg: number;
  pieces: number;
  stopCount: number;
  serviceMultiplier: number;
  fuelPercent: number;
  fuelBase: number;
  dimensionalDivisor: number;
  dimensionalPricingEnabled: boolean;
  waitFreeMinutes: number;
  waitIncrementMinutes: number;
  declaredValue: number;
}

export interface CostEstimate {
  estimatedCost: number;
  costLines: ChargeLine[];
  grossProfit: number;
  grossMarginPercent: number;
  meetsTargetMargin: boolean;
}

export interface PricingSnapshot {
  engineVersion: string;
  pricedAt: string;
  stage: 'ESTIMATE' | 'FINAL';
  status: PricingStatus;
  errors: PricingError[];
  warnings: string[];
  currency: 'CAD' | 'USD';
  rateCard: ResolvedRateCard | null;
  candidates: RateCardCandidate[];
  method: PricingMethod | null;
  taxProfile: { id: string; name: string } | null;
  taxExempt: boolean;
  inputs: ResolvedInputs;
  lines: ChargeLine[];
  freight: number;
  serviceFreight: number;
  vehicleSurcharge: number;
  fuelSurcharge: number;
  companyCharge: number;
  accessorialsTotal: number;
  minimumAdjustment: number;
  discount: number;
  adjustmentsTotal: number;
  /** Before tax. */
  subtotal: number;
  taxLines: ChargeLine[];
  taxTotal: number;
  total: number;
  cost: CostEstimate | null;
}
