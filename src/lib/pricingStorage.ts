import { CustomerGroup, Discount, PricingConfig, RateCard, Zone, ZoneRate } from '../types/pricing';

export const PRICING_STORAGE_KEY = 'dispatra_pricing_v1';

export const NO_DISCOUNT: Discount = { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' };

/** A blank card with every inheritable field set to "inherit". */
export const createEmptyRateCard = (overrides: Partial<RateCard> = {}): RateCard => ({
  id: `rc_${Date.now()}`,
  name: 'New Rate Card',
  code: '',
  status: 'DRAFT',
  version: 1,
  scope: 'ORGANIZATION',
  customerId: null,
  customerGroupId: null,
  serviceId: null,
  vehicleId: null,
  priority: 0,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: null,
  currency: 'CAD',
  pricingMethod: 'BASE_PLUS_DISTANCE',
  baseFee: 20,
  includedKm: 5,
  kmRate: 1.4,
  includedMinutes: 0,
  minuteRate: 0,
  includedWeightKg: 50,
  weightRatePerKg: 0.15,
  includedPieces: 0,
  pieceRate: 0,
  includedStops: null,
  extraStopRate: null,
  minimumFreight: 35,
  serviceOverrides: {},
  fixedAmount: 55,
  hourlyRate: 85,
  minimumBillableMinutes: 120,
  billingIncrementMinutes: 30,
  zoneNoMatchFallback: 'NEEDS_ATTENTION',
  applyServiceMultiplier: false,
  applyVehicleSurcharge: true,
  applyFuelSurcharge: true,
  applyAccessorials: true,
  fuelPercent: null,
  dimensionalPricingEnabled: null,
  dimensionalDivisor: null,
  waitFreeMinutes: null,
  waitIncrementMinutes: null,
  vehicleSurchargeOverrides: {},
  accessorialRateOverrides: {},
  discount: { ...NO_DISCOUNT },
  notes: '',
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const INITIAL_ZONES: Zone[] = [
  { id: 'zone_van', code: 'VAN', name: 'Vancouver', description: 'City of Vancouver & UBC' },
  { id: 'zone_bby', code: 'BBY', name: 'Burnaby / New West', description: 'Burnaby and New Westminster' },
  { id: 'zone_rmd', code: 'RMD', name: 'Richmond / YVR', description: 'Richmond incl. airport cargo' },
  { id: 'zone_sry', code: 'SRY', name: 'Surrey / Delta', description: 'Surrey, Delta, and Annacis Island' },
  { id: 'zone_nsh', code: 'NSH', name: 'North Shore', description: 'North & West Vancouver' },
  { id: 'zone_tri', code: 'TRI', name: 'Tri-Cities', description: 'Coquitlam, Port Coquitlam, Port Moody' }
];

const zr = (o: string, d: string, amount: number): ZoneRate => ({
  id: `zr_${o}_${d}`,
  originZoneId: `zone_${o}`,
  destinationZoneId: `zone_${d}`,
  amount,
  serviceId: null
});

export const INITIAL_ZONE_RATES: ZoneRate[] = [
  zr('van', 'van', 35),
  zr('van', 'bby', 45),
  zr('van', 'rmd', 50),
  zr('van', 'sry', 70),
  zr('van', 'nsh', 55),
  zr('van', 'tri', 65),
  zr('bby', 'van', 45),
  zr('bby', 'bby', 35),
  zr('bby', 'rmd', 55),
  zr('bby', 'sry', 60),
  zr('bby', 'tri', 45),
  zr('rmd', 'van', 50),
  zr('rmd', 'rmd', 35),
  zr('rmd', 'sry', 55),
  zr('sry', 'van', 70),
  zr('sry', 'sry', 40),
  zr('sry', 'bby', 60)
];

export const INITIAL_CUSTOMER_GROUPS: CustomerGroup[] = [
  {
    id: 'grp_preferred_retail',
    name: 'Preferred Retailers',
    description: 'High-volume retail accounts on the standard card with a group discount.',
    rateCardId: null,
    discount: { type: 'PERCENT', value: 8, scope: 'TRANSPORT_ONLY' }
  },
  {
    id: 'grp_medical',
    name: 'Medical & Pharma',
    description: 'Cold-chain and clinical accounts priced on the medical card.',
    rateCardId: 'rc_medical_group',
    discount: { ...NO_DISCOUNT }
  }
];

export const INITIAL_RATE_CARDS: RateCard[] = [
  createEmptyRateCard({
    id: 'rc_org_standard',
    name: 'Standard',
    code: 'STD',
    status: 'ACTIVE',
    scope: 'ORGANIZATION',
    effectiveFrom: '2026-01-01',
    baseFee: 20,
    includedKm: 5,
    kmRate: 1.5,
    includedMinutes: 30,
    minuteRate: 0.4,
    includedWeightKg: 50,
    weightRatePerKg: 0.15,
    includedPieces: 5,
    pieceRate: 1.5,
    minimumFreight: 35,
    // Each service keeps its own starting fee; the multiplier still applies.
    serviceOverrides: {
      srv_rush: { baseFee: 35, includedKm: null, kmRate: 2.0, multiplier: null },
      srv_direct: { baseFee: 50, includedKm: null, kmRate: 2.5, multiplier: null },
      srv_economy: { baseFee: 15, includedKm: null, kmRate: 1.25, multiplier: null }
    },
    notes: 'Organization default. Applies whenever no customer or group card matches.'
  }),
  createEmptyRateCard({
    id: 'rc_medical_group',
    name: 'Medical & Pharma Group',
    code: 'MED',
    status: 'ACTIVE',
    scope: 'CUSTOMER_GROUP',
    customerGroupId: 'grp_medical',
    effectiveFrom: '2026-01-01',
    baseFee: 28,
    includedKm: 8,
    kmRate: 1.6,
    includedMinutes: 30,
    minuteRate: 0.4,
    includedWeightKg: 30,
    weightRatePerKg: 0.2,
    minimumFreight: 45,
    fuelPercent: 6,
    waitFreeMinutes: 20,
    accessorialRateOverrides: { acc_fragile: 0 },
    notes: 'Fragile wrap included. Longer free wait for clinical receiving.'
  }),
  createEmptyRateCard({
    id: 'rc_pacific_fresh',
    name: 'Pacific Fresh Contract',
    code: 'PFL-2026',
    status: 'ACTIVE',
    scope: 'CUSTOMER',
    customerId: 'cust-1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    pricingMethod: 'ZONE',
    zoneNoMatchFallback: 'BASE_PLUS_DISTANCE',
    baseFee: 22,
    includedKm: 5,
    kmRate: 1.35,
    minimumFreight: 40,
    fuelPercent: 5,
    applyServiceMultiplier: true,
    vehicleSurchargeOverrides: { veh_2_ton: 0 },
    serviceOverrides: { srv_same_day: { baseFee: null, includedKm: null, kmRate: null, multiplier: 1.05 } },
    discount: { type: 'PERCENT', value: 10, scope: 'TRANSPORT_ONLY' },
    notes: 'Zone matrix pricing. 2-Tonne surcharge waived. Falls back to base + distance outside the matrix.'
  }),
  createEmptyRateCard({
    id: 'rc_nordic_direct',
    name: 'Nordic Bio — Direct Fixed',
    code: 'NBH-DIRECT',
    status: 'ACTIVE',
    scope: 'CUSTOMER',
    customerId: 'cust-2',
    serviceId: 'srv_direct',
    priority: 10,
    effectiveFrom: '2026-03-01',
    pricingMethod: 'FIXED',
    fixedAmount: 95,
    applyServiceMultiplier: false,
    applyVehicleSurcharge: false,
    notes: 'Flat $95 per Direct run regardless of distance. Other services use the group card.'
  }),
  createEmptyRateCard({
    id: 'rc_westcoast_hourly',
    name: 'West Coast Cold — Dedicated Hourly',
    code: 'WCCS-HOURLY',
    status: 'ACTIVE',
    scope: 'CUSTOMER',
    customerId: 'cust-4',
    effectiveFrom: '2026-01-01',
    pricingMethod: 'HOURLY',
    hourlyRate: 85,
    minimumBillableMinutes: 120,
    billingIncrementMinutes: 30,
    applyVehicleSurcharge: false,
    notes: 'Dedicated reefer route. Estimated at booking, settled on actual hours at completion.'
  }),
  createEmptyRateCard({
    id: 'rc_org_2025',
    name: 'Standard (2025)',
    code: 'STD-2025',
    status: 'ARCHIVED',
    scope: 'ORGANIZATION',
    effectiveFrom: '2025-01-01',
    effectiveTo: '2025-12-31',
    baseFee: 18,
    includedKm: 5,
    kmRate: 1.4,
    minimumFreight: 30,
    notes: 'Superseded by Standard on 2026-01-01. Kept for historical orders.'
  })
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const INITIAL_PRICING_CONFIG: PricingConfig = {
  rateCards: INITIAL_RATE_CARDS,
  zones: INITIAL_ZONES,
  zoneRates: INITIAL_ZONE_RATES,
  customerGroups: INITIAL_CUSTOMER_GROUPS
};

/** Fill any field a stored card lacks so newly added settings never arrive undefined. */
const normaliseCard = (stored: Partial<RateCard>): RateCard => ({
  ...createEmptyRateCard(),
  ...stored,
  serviceOverrides: stored.serviceOverrides || {},
  vehicleSurchargeOverrides: stored.vehicleSurchargeOverrides || {},
  accessorialRateOverrides: stored.accessorialRateOverrides || {},
  discount: { ...NO_DISCOUNT, ...(stored.discount || {}) }
});

export const loadPricingConfig = (): PricingConfig => {
  try {
    const raw = localStorage.getItem(PRICING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PricingConfig>;
      return {
        rateCards: Array.isArray(parsed.rateCards) ? parsed.rateCards.map(normaliseCard) : clone(INITIAL_RATE_CARDS),
        zones: Array.isArray(parsed.zones) ? parsed.zones : clone(INITIAL_ZONES),
        zoneRates: Array.isArray(parsed.zoneRates) ? parsed.zoneRates : clone(INITIAL_ZONE_RATES),
        customerGroups: Array.isArray(parsed.customerGroups)
          ? parsed.customerGroups
          : clone(INITIAL_CUSTOMER_GROUPS)
      };
    }
  } catch {
    // fall through to defaults
  }
  return clone(INITIAL_PRICING_CONFIG);
};

export const savePricingConfig = (config: PricingConfig): void => {
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable — settings stay in memory.
  }
};

export const resetPricingConfig = (): PricingConfig => {
  const defaults = clone(INITIAL_PRICING_CONFIG);
  savePricingConfig(defaults);
  return defaults;
};
