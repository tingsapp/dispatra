import { loadBillingConfig } from './billingStorage';
import { Discount, PricingConfig, RateCard, Zone, ZoneRate } from '../types/pricing';

export const PRICING_STORAGE_KEY = 'dispatra_pricing_v1';
const PRICING_SCHEMA_VERSION = 7;

export const NO_DISCOUNT: Discount = { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' };

/**
 * V1 keeps these contract terms in the background: every card carries these values and the
 * editor does not show them. Stored cards are normalised to them on load.
 */
export const RATE_CARD_BACKGROUND_DEFAULTS = {
  vehicleId: null, priority: 0, effectiveTo: null, notes: '',
  includedPieces: 0, pieceRate: 0, includedStops: null, extraStopRate: null,
  minimumFreight: 0, serviceOverrides: {},
  applyAdminFee: null, applyContractDiscount: true, applyServiceMultiplier: true, applyVehicleSurcharge: true, applyFuelSurcharge: true, applyAccessorials: true,
  fuelPercent: null, dimensionalPricingEnabled: null, dimensionalDivisor: null, waitFreeMinutes: null, waitIncrementMinutes: null,
  vehicleSurchargeOverrides: {}, accessorialRateOverrides: {},
  zoneFallbackToOrganization: false, zoneMatrixMode: 'CONTRACT' as const, zoneNoMatchFallback: 'NEEDS_ATTENTION' as const,
  hourlyClockStart: 'Arrival at first pickup', hourlyClockStop: 'Completion of final delivery', hourlyIncludesHandling: true, hourlyIncludesWaiting: true, hourlySettleActual: true,
} satisfies Partial<RateCard>;

/** Background code for zones; not shown in the UI. */
export const zoneCode = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'ZONE';

/** Background code for cards saved without one. */
export const rateCardCode = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'CARD';

/** A blank card with every inheritable field set to "inherit" and no background charges. */
export const createEmptyRateCard = (overrides: Partial<RateCard> = {}): RateCard => ({
  id: `rc_${Date.now()}`,
  name: 'New Rate Card',
  code: '',
  status: 'ACTIVE',
  version: 1,
  scope: 'ORDER',
  customerId: null,
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
  includedWeightKg: 0,
  weightRatePerKg: 0,
  includedPieces: 0,
  pieceRate: 0,
  includedStops: null,
  extraStopRate: null,
  minimumFreight: 0,
  serviceOverrides: {},
  fixedAmount: 55,
  hourlyClockStart: 'Arrival at first pickup',
  hourlyClockStop: 'Completion of final delivery',
  hourlyIncludesHandling: true,
  hourlyIncludesWaiting: true,
  hourlySettleActual: true,
  hourlyRate: 85,
  minimumBillableMinutes: 120,
  billingIncrementMinutes: 30,
  zoneMatrixMode: 'CONTRACT',
  zoneRates: [],
  zoneFallbackToOrganization: false,
  zoneNoMatchFallback: 'NEEDS_ATTENTION',
  applyAdminFee: null,
  applyContractDiscount: true,
  applyOrderMinimum: true,
  minimumOrderSubtotal: 0,
  importedPriceMode: 'FREIGHT',
  applyServiceMultiplier: true,
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

/** Demo prices for the Pacific Fresh zone card only; the organization's standard grid ships empty. */
const PACIFIC_FRESH_ZONE_RATES: ZoneRate[] = [
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

/** Demo cards use only the fields the V1 editor shows. Standard is the Default. */
export const INITIAL_RATE_CARDS: RateCard[] = [
  createEmptyRateCard({ id: 'rc_org_standard', name: 'Standard', code: 'STD', scope: 'ORGANIZATION', effectiveFrom: '2026-01-01', baseFee: 20, includedKm: 5, kmRate: 1.5 }),
  createEmptyRateCard({ id: 'rc_medical_group', name: 'Medical & Pharma', code: 'MED', effectiveFrom: '2026-01-01', baseFee: 28, includedKm: 8, kmRate: 1.6 }),
  createEmptyRateCard({ id: 'rc_pacific_fresh', name: 'Pacific Fresh Contract', code: 'PFL-2026', effectiveFrom: '2026-01-01', pricingMethod: 'ZONE', zoneRates: PACIFIC_FRESH_ZONE_RATES.map(rate => ({ ...rate, id: `pfl_${rate.originZoneId}_${rate.destinationZoneId}` })), discount: { type: 'PERCENT', value: 10, scope: 'TRANSPORT_ONLY' } }),
  createEmptyRateCard({ id: 'rc_nordic_direct', name: 'Nordic Bio — Direct Fixed', code: 'NBH-DIRECT', effectiveFrom: '2026-03-01', pricingMethod: 'FIXED', fixedAmount: 95 }),
  createEmptyRateCard({ id: 'rc_westcoast_hourly', name: 'West Coast Cold — Dedicated Hourly', code: 'WCCS-HOURLY', effectiveFrom: '2026-01-01', pricingMethod: 'HOURLY', hourlyRate: 85, minimumBillableMinutes: 120, billingIncrementMinutes: 30 }),
  createEmptyRateCard({ id: 'rc_org_2025', name: 'Standard (2025)', code: 'STD-2025', status: 'ARCHIVED', effectiveFrom: '2025-01-01', baseFee: 18, includedKm: 5, kmRate: 1.4 })
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const INITIAL_PRICING_CONFIG: PricingConfig = {
  rateCards: INITIAL_RATE_CARDS,
  zones: INITIAL_ZONES,
  zoneRates: [],
  customerGroups: []
};

const hasRoutineTimeSettings = (card: Partial<RateCard>): boolean =>
  ['BASE_PLUS_DISTANCE', 'ZONE'].includes(card.pricingMethod ?? 'BASE_PLUS_DISTANCE') &&
  ((card.minuteRate ?? 0) !== 0 || (card.includedMinutes ?? 0) !== 0);

/** One price per origin → destination; service-specific rows collapse onto their pair. */
const normaliseZoneRates = (rates: ZoneRate[]): ZoneRate[] => {
  const byPair = new Map<string, ZoneRate>();
  for (const rate of rates) {
    const key = `${rate.originZoneId}→${rate.destinationZoneId}`;
    const current = byPair.get(key);
    if (!current || (current.serviceId && !rate.serviceId)) byPair.set(key, rate);
  }
  return [...byPair.values()].map(rate => rate.serviceId ? { ...rate, serviceId: null } : rate);
};

/** V1 cards are flat: every card applies to every service, vehicle and customer, with no background contract terms. */
const isSimple = (card: RateCard): boolean =>
  card.status !== 'DRAFT' && card.scope !== 'CUSTOMER' && card.serviceId === null && card.customerId === null && card.currency === loadBillingConfig().invoicing.currency &&
  (Object.keys(RATE_CARD_BACKGROUND_DEFAULTS) as (keyof typeof RATE_CARD_BACKGROUND_DEFAULTS)[]).every(key => JSON.stringify(card[key]) === JSON.stringify(RATE_CARD_BACKGROUND_DEFAULTS[key]));

/** Retire obsolete routine time rates and background contract terms; saved quote contexts remain untouched. */
const normaliseCard = (stored: Partial<RateCard>, standardZoneRates: ZoneRate[] = []): RateCard => {
  const base: RateCard = {
    ...createEmptyRateCard(),
    ...stored,
    serviceOverrides: stored.serviceOverrides || {},
    vehicleSurchargeOverrides: stored.vehicleSurchargeOverrides || {},
    accessorialRateOverrides: stored.accessorialRateOverrides || {},
    discount: { ...NO_DISCOUNT, ...(stored.discount || {}) }
  };
  const card = { ...base };
  // Every zone card owns its prices; cards that inherited the organization matrix take a copy of it.
  if (card.pricingMethod === 'ZONE' && card.zoneMatrixMode !== 'CONTRACT') card.zoneRates = standardZoneRates.map(rate => ({ ...rate, id: `${card.id}_${rate.originZoneId}_${rate.destinationZoneId}` }));
  // V1 discounts: None / Percentage / Fixed on freight only; legacy INHERIT and subtotal scopes collapse to that.
  card.discount = { ...card.discount, type: card.discount.type === 'INHERIT' ? 'NONE' : card.discount.type, scope: 'TRANSPORT_ONLY' };
  // Move inherited organization minimums onto cards; frozen quote contexts stay untouched.
  if (stored.minimumOrderSubtotal == null) card.minimumOrderSubtotal = card.applyOrderMinimum === false ? 0 : loadBillingConfig().rules.minimumChargePerJob;
  delete card.customerGroupId;
  if (hasRoutineTimeSettings(card)) Object.assign(card, { minuteRate: 0, includedMinutes: 0 });
  card.zoneRates = normaliseZoneRates(card.zoneRates ?? []);
  if (!isSimple(card)) {
    Object.assign(card, RATE_CARD_BACKGROUND_DEFAULTS, {
      status: card.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      scope: card.scope === 'ORGANIZATION' ? 'ORGANIZATION' : 'ORDER',
      serviceId: null, customerId: null, currency: loadBillingConfig().invoicing.currency
    });
  }
  // One version bump per migration so historical PricingSnapshots stay pinned to the old version.
  if (JSON.stringify(card) !== JSON.stringify(base)) Object.assign(card, { version: base.version + 1, updatedAt: new Date().toISOString() });
  return card;
};

/** Exactly one active Default card: the first active organization card keeps the role; later ones become selectable cards. */
const normaliseDefault = (cards: RateCard[]): RateCard[] => {
  let found = false;
  const next = cards.map(card => {
    if (card.status !== 'ACTIVE' || card.scope !== 'ORGANIZATION') return card;
    if (found) return { ...card, scope: 'ORDER' as const, version: card.version + 1, updatedAt: new Date().toISOString() };
    found = true;
    return card;
  });
  if (!found) {
    const first = next.findIndex(card => card.status === 'ACTIVE');
    if (first >= 0) next[first] = { ...next[first], scope: 'ORGANIZATION', version: next[first].version + 1, updatedAt: new Date().toISOString() };
  }
  return next;
};


export const loadPricingConfig = (): PricingConfig => {
  try {
    const raw = localStorage.getItem(PRICING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PricingConfig> & { schemaVersion?: number };
      const zoneRates = normaliseZoneRates(Array.isArray(parsed.zoneRates) ? parsed.zoneRates : []);
      const config: PricingConfig = {
        zones: Array.isArray(parsed.zones) ? parsed.zones : clone(INITIAL_ZONES),
        zoneRates,
        rateCards: normaliseDefault(Array.isArray(parsed.rateCards) ? parsed.rateCards.map(card => normaliseCard(card, zoneRates)) : clone(INITIAL_RATE_CARDS)),
        customerGroups: []
      };
      if ((parsed.schemaVersion ?? 0) < PRICING_SCHEMA_VERSION || JSON.stringify(config.rateCards) !== JSON.stringify(parsed.rateCards) || parsed.customerGroups?.length) {
        savePricingConfig(config);
      }
      return config;
    }
  } catch {
    // fall through to defaults
  }
  return clone(INITIAL_PRICING_CONFIG);
};

export const savePricingConfig = (config: PricingConfig): void => {
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, customerGroups: [], rateCards: normaliseDefault(config.rateCards.map(card => normaliseCard(card, config.zoneRates))), zoneRates: normaliseZoneRates(config.zoneRates), schemaVersion: PRICING_SCHEMA_VERSION }));
  } catch {
    // Storage unavailable — settings stay in memory.
  }
};

export const resetPricingConfig = (): PricingConfig => {
  const defaults = clone(INITIAL_PRICING_CONFIG);
  savePricingConfig(defaults);
  return defaults;
};
