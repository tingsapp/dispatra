import { scopedStorageKey } from './scopedStorage';
import { loadBillingConfig } from './billingStorage';
import { CENTRAL_PICKUP_ZONE_ID } from './centralZoneRates';
import { fromDisplayWeight, Units } from './units';
import { Discount, PricingConfig, RateCard, Zone, ZoneRate } from '../types/pricing';

export const PRICING_STORAGE_KEY = 'dispatra_pricing_v1';
const PRICING_SCHEMA_VERSION = 14;

export const NO_DISCOUNT: Discount = { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' };

/**
 * V1 keeps these contract terms in the background: every card carries these values and the
 * editor does not show them. Stored cards are normalised to them on load.
 */
export const RATE_CARD_BACKGROUND_DEFAULTS = {
  vehicleId: null, priority: 0, effectiveTo: null, notes: '',
  includedPieces: 0, pieceRate: 0, includedStops: null, extraStopRate: 0,
  minimumFreight: 0, serviceOverrides: {},
  applyAdminFee: false, applyContractDiscount: true, applyServiceMultiplier: true, applyVehicleSurcharge: true, applyFuelSurcharge: true, applyAccessorials: true,
  fuelPercent: null, waitFreeMinutes: null, waitIncrementMinutes: null,
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
  extraStopRate: 0,
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
  applyAdminFee: false,
  applyContractDiscount: true,
  applyOrderMinimum: true,
  minimumOrderSubtotal: 0,
  importedPriceMode: 'FREIGHT',
  applyServiceMultiplier: true,
  applyVehicleSurcharge: true,
  applyFuelSurcharge: true,
  applyAccessorials: true,
  fuelPercent: null,
  dimensionalPricingEnabled: true,
  dimensionalDivisor: loadBillingConfig().general.dimensionalDivisor,
  waitFreeMinutes: null,
  waitIncrementMinutes: null,
  vehicleSurchargeOverrides: {},
  accessorialRateOverrides: {},
  discount: { ...NO_DISCOUNT },
  notes: '',
  updatedAt: new Date().toISOString(),
  ...overrides
});

const LEGACY_PRESET_ZONES: Zone[] = [
  { id: 'zone_van', code: 'VAN', name: 'Vancouver', description: 'City of Vancouver & UBC' },
  { id: 'zone_bby', code: 'BBY', name: 'Burnaby / New West', description: 'Burnaby and New Westminster' },
  { id: 'zone_rmd', code: 'RMD', name: 'Richmond / YVR', description: 'Richmond incl. airport cargo' },
  { id: 'zone_sry', code: 'SRY', name: 'Surrey / Delta', description: 'Surrey, Delta, and Annacis Island' },
  { id: 'zone_nsh', code: 'NSH', name: 'North Shore', description: 'North & West Vancouver' },
  { id: 'zone_tri', code: 'TRI', name: 'Tri-Cities', description: 'Coquitlam, Port Coquitlam, Port Moody' }
];

/** Metro Vancouver starter zones; one verified example postal code each. Dispatch extends the lists. */
export const INITIAL_ZONES: Zone[] = [
  { id: 'zone_1', code: 'ZONE1', name: 'Zone 1', postalCodes: ['V5Y 1V4'] },
  { id: 'zone_2', code: 'ZONE2', name: 'Zone 2', postalCodes: ['V5G 1M2'] },
  { id: 'zone_3', code: 'ZONE3', name: 'Zone 3', postalCodes: ['V3T 1V8'] }
];

/** The first Zone row starts at zero, ends at 99 company weight units, and prices Zone 1 only. */
export const initialZoneOneRates = (cardId: string, zones: Zone[], units: Units): ZoneRate[] => {
  const zoneOne = zones.find(zone => zone.id === 'zone_1') ?? zones.find(zone => zone.name.trim().toLowerCase() === 'zone 1');
  if (!zoneOne) return [];
  return [{ id: `${cardId}_central_zone_1`, originZoneId: CENTRAL_PICKUP_ZONE_ID, destinationZoneId: zoneOne.id,
    serviceId: null, amount: 20, weightBands: [{ id: `${cardId}_zone_1_first_band`, maxWeightKg: fromDisplayWeight(99, units), amount: 20 }] }];
};

const PRESET_CARD_NAMES: Record<string, { previous: string; name: string }> = {
  rc_org_standard: { previous: 'Standard', name: 'Distance based' },
  rc_pacific_fresh: { previous: 'Pacific Fresh Contract', name: 'Zone to zone' },
  rc_nordic_direct: { previous: 'Nordic Bio — Direct Fixed', name: 'Fixed per delivery' },
  rc_westcoast_hourly: { previous: 'West Coast Cold — Dedicated Hourly', name: 'Hourly' },
};

/** Demo cards use only the fields the V1 editor shows. Distance based is the Default. */
export const INITIAL_RATE_CARDS: RateCard[] = [
  createEmptyRateCard({ id: 'rc_org_standard', name: 'Distance based', code: 'STD', scope: 'ORGANIZATION', effectiveFrom: '2026-01-01', baseFee: 20, includedKm: 5, kmRate: 1.5 }),
  createEmptyRateCard({ id: 'rc_medical_group', name: 'Medical & Pharma', code: 'MED', status: 'ARCHIVED', effectiveFrom: '2026-01-01', baseFee: 28, includedKm: 8, kmRate: 1.6 }),
  createEmptyRateCard({ id: 'rc_pacific_fresh', name: 'Zone to zone', code: 'PFL-2026', effectiveFrom: '2026-01-01', pricingMethod: 'ZONE', zoneRates: [] }),
  createEmptyRateCard({ id: 'rc_nordic_direct', name: 'Fixed per delivery', code: 'NBH-DIRECT', effectiveFrom: '2026-03-01', pricingMethod: 'FIXED', fixedAmount: 95 }),
  createEmptyRateCard({ id: 'rc_westcoast_hourly', name: 'Hourly', code: 'WCCS-HOURLY', effectiveFrom: '2026-01-01', pricingMethod: 'HOURLY', hourlyRate: 85, minimumBillableMinutes: 120, billingIncrementMinutes: 30 }),
  createEmptyRateCard({ id: 'rc_org_2025', name: 'Standard (2025)', code: 'STD-2025', status: 'ARCHIVED', effectiveFrom: '2025-01-01', baseFee: 18, includedKm: 5, kmRate: 1.4 })
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const freshPricingConfig = (): PricingConfig => {
  const defaults = clone(INITIAL_PRICING_CONFIG);
  for (const card of defaults.rateCards) if (card.status === 'ACTIVE' && card.pricingMethod === 'ZONE') {
    card.zoneRates = initialZoneOneRates(card.id, defaults.zones, loadBillingConfig().general);
  }
  return defaults;
};

export const INITIAL_PRICING_CONFIG: PricingConfig = {
  discountSource: 'SHIPPER',
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
  card.status !== 'DRAFT' && card.scope !== 'SHIPPER' && card.serviceId === null && card.customerId === null && card.currency === loadBillingConfig().invoicing.currency &&
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
  // Current cards always use the greater weight; archived cards and frozen contexts retain their terms.
  const general = loadBillingConfig().general;
  card.dimensionalPricingEnabled = card.status === 'ARCHIVED'
    ? stored.dimensionalPricingEnabled ?? general.dimensionalPricingEnabled : true;
  card.dimensionalDivisor = stored.dimensionalDivisor ?? general.dimensionalDivisor;
  // Retired demo card: keep its record for history, but omit it from active lists and selectors.
  if (card.id === 'rc_medical_group') card.status = 'ARCHIVED';
  const preset = PRESET_CARD_NAMES[card.id];
  if (preset && card.name === preset.previous) card.name = preset.name;
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
    const raw = localStorage.getItem(scopedStorageKey(PRICING_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PricingConfig> & { schemaVersion?: number };
      // Retire untouched demo zones once; renamed/custom zones and historical contexts survive.
      const storedZones = Array.isArray(parsed.zones) ? parsed.zones : [];
      const retired = new Set((parsed.schemaVersion ?? 0) < 8 ? storedZones.filter(zone =>
        !zone.postalCodes?.length && LEGACY_PRESET_ZONES.some(seed => seed.id === zone.id && seed.name === zone.name && seed.code === zone.code && seed.description === zone.description)
      ).map(zone => zone.id) : []);
      const keepRate = (rate: ZoneRate) => !retired.has(rate.originZoneId) && !retired.has(rate.destinationZoneId);
      const zones: Zone[] = storedZones.filter(zone => !retired.has(zone.id)).map(zone => ({ ...zone, postalCodes: zone.postalCodes ?? [] }));
      // Add missing starter zones once. An older zone that only shares a starter name is replaced.
      const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      const seedStarter = (parsed.schemaVersion ?? 0) < 11 && INITIAL_ZONES.some(seed => !zones.some(zone => zone.id === seed.id) || zones.some(zone => zone.id !== seed.id && sameName(zone.name, seed.name)));
      if (seedStarter) for (const seed of INITIAL_ZONES) {
        for (const zone of zones.filter(zone => zone.id !== seed.id && sameName(zone.name, seed.name))) zones.splice(zones.indexOf(zone), 1);
        if (!zones.some(zone => zone.id === seed.id)) zones.push(clone(seed));
      }
      // Schema 13 clears active zone prices once, including the retired organization-wide matrix.
      // Archived cards and frozen order quotes keep their historical prices.
      const clearSavedZoneRates = (parsed.schemaVersion ?? 0) < 13;
      const storedRates = Array.isArray(parsed.zoneRates) ? parsed.zoneRates.filter(keepRate) : [];
      const zoneRates = clearSavedZoneRates ? [] : normaliseZoneRates(storedRates);
      const config: PricingConfig = {
        discountSource: 'SHIPPER',
        zones,
        zoneRates,
        rateCards: normaliseDefault(Array.isArray(parsed.rateCards) ? parsed.rateCards.map(card => {
          const normalized = normaliseCard(card, zoneRates);
          const rates = normalized.zoneRates ?? [];
          let next = normalized;
          if (next.status === 'ACTIVE' && rates.some(rate => !keepRate(rate))) next = { ...next, zoneRates: rates.filter(keepRate), version: next.version + 1, updatedAt: new Date().toISOString() };
          if (next.status === 'ACTIVE' && next.pricingMethod === 'ZONE') {
            const cleared = clearSavedZoneRates && !!next.zoneRates?.length;
            const currentRates = cleared ? [] : next.zoneRates ?? [];
            // Empty saved cards need a real starter price so the matrix and formula agree.
            const starter = !currentRates.length ? initialZoneOneRates(next.id, zones, loadBillingConfig().general) : [];
            if (cleared || starter.length) next = { ...next, zoneRates: starter.length ? starter : currentRates,
              version: next.version + 1, updatedAt: new Date().toISOString() };
          }
          return next;
        }) : clone(INITIAL_RATE_CARDS).map(card => card.status === 'ACTIVE' && card.pricingMethod === 'ZONE'
          ? { ...card, zoneRates: initialZoneOneRates(card.id, zones, loadBillingConfig().general) } : card)),
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
  return freshPricingConfig();
};

export const savePricingConfig = (config: PricingConfig): void => {
  try {
    localStorage.setItem(scopedStorageKey(PRICING_STORAGE_KEY), JSON.stringify({ ...config, discountSource: 'SHIPPER', customerGroups: [], rateCards: normaliseDefault(config.rateCards.map(card => normaliseCard(card, config.zoneRates))), zoneRates: normaliseZoneRates(config.zoneRates), schemaVersion: PRICING_SCHEMA_VERSION }));
  } catch {
    // Storage unavailable — settings stay in memory.
  }
};

export const resetPricingConfig = (): PricingConfig => {
  const defaults = freshPricingConfig();
  savePricingConfig(defaults);
  return defaults;
};
