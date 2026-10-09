import { loadPricingContext } from '../lib/orderPricing';
import { createEmptyRateCard, INITIAL_PRICING_CONFIG } from '../lib/pricingStorage';
import { INITIAL_BILLING_CONFIG } from '../lib/billingStorage';
import { CENTRAL_PICKUP_ZONE_ID } from '../lib/centralZoneRates';
import type { PricingContext } from '../lib/pricingEngine';
import type { RateCard as UiRateCard, ZoneRate } from '../types/pricing';
import type { AccessorialItem, DeliveryService } from '../types/simplePricing';
import type { CatalogItem, RateCard, RateInput, Shipper } from './api';
import { catalogToVehicleType, shipperToCustomer } from './adapters';
import type { components } from '../portal/schema';

type Settings = components['schemas']['SettingsView'];
type BookingPreferences = components['schemas']['BookingPreferences'];
const n = (value: number | string | null | undefined) => Number(value ?? 0);

export function rateToUi(row: RateCard): UiRateCard {
  const zones = row.data.zones;
  const zoneRates: ZoneRate[] = zones.flatMap(zone => {
    const bands = row.data.weight_bands.filter(band => band.prices[zone.id] != null);
    return bands.length ? [{ id: `${row.id}-${zone.id}`, originZoneId: CENTRAL_PICKUP_ZONE_ID,
      destinationZoneId: zone.id, serviceId: null, amount: n(bands[0].prices[zone.id]),
      weightBands: bands.map((band, index) => ({ id: `${row.id}-${zone.id}-${index}`,
        maxWeightKg: n(band.to_kg), amount: n(band.prices[zone.id]) })) }] : [];
  });
  return createEmptyRateCard({
    id: row.id, code: row.code, name: row.data.name, status: row.active ? 'ACTIVE' : 'ARCHIVED',
    scope: row.is_default ? 'ORGANIZATION' : 'ORDER', version: row.version,
    // The API prices Imported cards as the final agreed total, including tax.
    pricingMethod: row.data.method, ...(row.data.method === 'IMPORTED' ? { importedPriceMode: 'FINAL_TOTAL' as const } : {}), baseFee: n(row.data.base_fee), includedKm: n(row.data.included_km),
    kmRate: n(row.data.per_km), fixedAmount: n(row.data.fixed_amount), hourlyRate: n(row.data.hourly_rate),
    minimumBillableMinutes: row.data.minimum_minutes, billingIncrementMinutes: row.data.increment_minutes,
    minimumOrderSubtotal: row.data.method === 'HOURLY' ? 0 : n(row.data.minimum_subtotal),
    dimensionalDivisor: n(row.data.dimensional_divisor), zoneRates,
    applyFuelSurcharge: row.data.apply_fuel, applyServiceMultiplier: row.data.apply_service,
    applyVehicleSurcharge: row.data.apply_vehicle, applyAccessorials: row.data.apply_accessorials,
    updatedAt: row.created_at,
  });
}

export function rateFromUi(card: UiRateCard, zones: PricingContext['pricing']['zones']): RateInput {
  const activeZones = card.pricingMethod === 'ZONE' ? zones.map(zone => ({ id: zone.id, name: zone.name, postal_codes: zone.postalCodes ?? [] })) : [];
  const edges = new Set([0, ...card.zoneRates?.flatMap(rate => rate.weightBands?.map(band => band.maxWeightKg ?? 0) ?? []) ?? []]);
  const sorted = [...edges].filter(x => Number.isFinite(x) && x >= 0).sort((a,b) => a-b);
  const weight_bands = card.pricingMethod === 'ZONE' ? sorted.slice(1).map((to,index) => ({
    from_kg: sorted[index], to_kg: to,
    prices: Object.fromEntries((card.zoneRates ?? []).filter(rate => rate.originZoneId === CENTRAL_PICKUP_ZONE_ID)
      .flatMap(rate => { const band = rate.weightBands?.find(b => b.maxWeightKg === to); return band?.amount == null ? [] : [[rate.destinationZoneId, band.amount]]; })),
  })) : [];
  return {
    name: card.name, method: card.pricingMethod, base_fee: card.baseFee, included_km: card.includedKm, per_km: card.kmRate,
    fixed_amount: card.fixedAmount, hourly_rate: card.hourlyRate, minimum_minutes: card.minimumBillableMinutes,
    increment_minutes: card.billingIncrementMinutes,
    minimum_subtotal: card.pricingMethod === 'HOURLY' ? 0 : card.minimumOrderSubtotal ?? 0, dimensional_divisor: card.dimensionalDivisor ?? 5000,
    zones: activeZones, weight_bands, apply_fuel: card.applyFuelSurcharge, apply_service: card.applyServiceMultiplier,
    apply_vehicle: card.applyVehicleSurcharge, apply_accessorials: card.applyAccessorials,
  };
}

export function catalogToService(row: CatalogItem): DeliveryService {
  return { id: row.id, code: row.code, name: row.data.name, description: row.data.description,
    additionalCharge: n(row.data.amount), defaultMultiplier: 1, exclusiveVehicle: row.data.exclusive_vehicle, active: row.active };
}
export function catalogToAccessorial(row: CatalogItem): AccessorialItem {
  return { id: row.id, code: row.code, name: row.data.name, description: row.data.description,
    calculationType: row.code === 'FRAGILE' || row.code === 'DG' ? 'PER_UNIT' : 'FLAT', rate: n(row.data.amount),
    unitLabel: row.code === 'FRAGILE' || row.code === 'DG' ? 'per package' : 'per order', freeAllowance: null,
    incrementMinutes: null, minimumCharge: null, maximumCharge: null, appliesAt: 'ORDER',
    fuelEligible: row.data.fuel_eligible, taxable: row.data.taxable, autoRule: 'NONE', active: row.active };
}

/** Every catalogue consumer (dispatcher and shipper order forms, settings) sees one order: company setup order, then code. */
const catalogOrder = (a: CatalogItem, b: CatalogItem) => a.created_at.localeCompare(b.created_at) || a.code.localeCompare(b.code);
export function catalogueFromApi(items: CatalogItem[], defaultServiceId?: string | null): PricingContext['catalogue'] {
  const of = (kind: string) => items.filter(item => item.kind === kind).sort(catalogOrder);
  return { services: of('SERVICE').map(row => ({ ...catalogToService(row), isDefault: row.id === defaultServiceId })), accessorials: of('ACCESSORIAL').map(catalogToAccessorial), vehicles: of('VEHICLE_TYPE').map(catalogToVehicleType) };
}

/** Builds the same context shape the existing controls expect, using only API-owned operational records. */
export function apiPricingContext(settings: Settings, catalog: CatalogItem[], rates: RateCard[], shippers: Shipper[]): PricingContext {
  const base = loadPricingContext();
  const data = settings.data;
  const cards = rates.map(rateToUi);
  const zones = rates.find(rate => rate.data.method === 'ZONE')?.data.zones.map(zone => ({ id: zone.id, code: zone.id, name: zone.name, postalCodes: zone.postal_codes })) ?? [];
  return {
    ...base,
    billing: { ...base.billing,
      companyTax: { enabled: data.gst_enabled, ratePercent: n(data.gst_percent), provincialEnabled: data.provincial_enabled, provincialRatePercent: n(data.provincial_percent) },
      general: { ...base.billing.general, timeZone: data.time_zone, distanceUnit: data.distance_unit, weightUnit: data.weight_unit, dimensionUnit: data.dimension_unit },
      quoteSettings: { ...base.billing.quoteSettings, currency: data.currency, taxRegistrationNumber: data.tax_registration_number, quoteValidityDays: data.quote_validity_days },
      fuelSurcharge: { ...base.billing.fuelSurcharge, enabled: data.fuel_enabled, percent: n(data.fuel_percent) },
      dispatch: { ...base.billing.dispatch, maxActiveOrdersPerDriver: data.maximum_active_orders },
    },
    catalogue: catalogueFromApi(catalog, data.default_service_id),
    pricing: { ...base.pricing, rateCards: cards, zones, zoneRates: cards.flatMap(card => card.zoneRates ?? []) },
    customers: shippers.map(shipperToCustomer),
  };
}

import type { CatalogInput } from './api';
export function catalogFromUi(item: DeliveryService | AccessorialItem, previous?: CatalogItem): CatalogInput {
  return {
    name: item.name, description: item.description,
    amount: 'calculationType' in item ? item.rate : item.additionalCharge ?? 0,
    taxable: 'taxable' in item ? item.taxable : previous?.data.taxable ?? true,
    fuel_eligible: previous?.data.fuel_eligible ?? false,
    exclusive_vehicle: 'exclusiveVehicle' in item ? item.exclusiveVehicle : previous?.data.exclusive_vehicle ?? false,
    payload_kg: previous?.data.payload_kg ?? null, volume_m3: previous?.data.volume_m3 ?? null,
    length_cm: previous?.data.length_cm ?? null, width_cm: previous?.data.width_cm ?? null, height_cm: previous?.data.height_cm ?? null,
    pallet_capacity: previous?.data.pallet_capacity ?? 0, equipment: previous?.data.equipment ?? [],
    required_equipment: previous?.data.required_equipment ?? [], required_crew: previous?.data.required_crew ?? 1,
  };
}

/** Shipper booking context: built only from shipper-visible API records, never the dispatcher's browser stores. The API prices every order. */
export function shipperPricingContext(preferences: BookingPreferences, options: CatalogItem[], shipper: Shipper): PricingContext {
  const billing = structuredClone(INITIAL_BILLING_CONFIG);
  return {
    billing: { ...billing, general: { ...billing.general, timeZone: preferences.time_zone, distanceUnit: preferences.distance_unit, weightUnit: preferences.weight_unit, dimensionUnit: preferences.dimension_unit },
      quoteSettings: { ...billing.quoteSettings, currency: preferences.currency },
      companyTax: { enabled: preferences.gst_enabled, ratePercent: n(preferences.gst_percent), provincialEnabled: preferences.provincial_enabled, provincialRatePercent: n(preferences.provincial_percent) },
      fuelSurcharge: { ...billing.fuelSurcharge, mode: 'fixed_percent', enabled: preferences.fuel_enabled, percent: n(preferences.fuel_percent) } },
    catalogue: catalogueFromApi(options, preferences.default_service_id),
    pricing: { ...structuredClone(INITIAL_PRICING_CONFIG), rateCards: [], zones: [], zoneRates: [] },
    customers: [shipperToCustomer(shipper)],
  };
}
