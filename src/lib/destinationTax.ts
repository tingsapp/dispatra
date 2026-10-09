import { BillingConfig, TaxProfileConfig } from '../types/billing';
import { PricingOrderInput } from '../types/pricing';
import { Customer } from './customerStorage';
import { DESTINATION_TAX_RATES, DESTINATION_TAX_RATES_EFFECTIVE_FROM, isValidDestinationTaxRate } from './destinationTaxRates';
import { CANADIAN_PROVINCES, resolveStopLocation } from './taxAddress';

export const TAX_RULE_VERSION = 'ca-domestic-freight-2026-09-17-v3';
export interface DestinationTaxDecision {
  ruleVersion: string;
  destinationKey: string;
  province?: string;
  description: string;
  profile: TaxProfileConfig | null;
  error?: string;
}
const groups = ['transport', 'accessorials', 'service_charge', 'fuel_surcharge'] as const;
export const taxDestinationKey = (order: PricingOrderInput) => JSON.stringify(order.stops.map(stop => ({ id: stop.id, type: stop.type, label: stop.label, country: stop.countryCode, province: stop.provinceCode })).sort((a, b) => a.id.localeCompare(b.id)));
/** Ordinary domestic carrier freight only. Special cases must not receive a guessed rate. */
export function resolveDestinationTax(order: PricingOrderInput, billing: BillingConfig, customer: Customer | undefined, asOf: Date): DestinationTaxDecision {
  const base = { ruleVersion: TAX_RULE_VERSION, destinationKey: taxDestinationKey(order) };
  const fail = (error: string): DestinationTaxDecision => ({ ...base, profile: null, description: 'Automatic tax needs review', error });
  if (order.freightTaxTreatment === 'REVIEW' || order.source === 'IMPORT' || order.importedPrice != null || customer?.taxExempt) return fail('This order has special tax treatment. Review the freight or exemption documents before pricing.');
  if (!order.stops.some(s => s.type === 'PICKUP') || !order.stops.some(s => s.type === 'DROPOFF')) return fail('Add a pickup and delivery address to calculate tax.');
  const locations = order.stops.map(stop => ({ stop, ...resolveStopLocation(stop) }));
  for (const [index, location] of locations.entries()) {
    if (!location.stop.label?.trim() || location.conflict) return fail(`Correct the address and country/province for stop ${index + 1}; the location is missing or conflicting.`);
    if (!location.country) return fail(`Confirm the country and province for stop ${index + 1} to calculate tax.`);
    if (location.country !== 'CA') return fail('International freight needs tax review. Automatic domestic tax has not been applied.');
    if (!location.province) return fail(`Confirm the province for stop ${index + 1} to calculate tax.`);
  }
  if (locations.some(location => location.province === 'QC')) return fail('Quebec freight needs a GST/QST review before pricing. Automatic provincial tax is not yet supported for this movement.');
  const destinations = [...new Set(locations.filter(location => location.stop.type === 'DROPOFF').map(location => location.province!))];
  if (destinations.length !== 1) return fail('Deliveries span different provinces. Allocate the freight charge to each destination for tax review before pricing.');
  if (!Number.isFinite(asOf.getTime()) || asOf.toISOString().slice(0, 10) < DESTINATION_TAX_RATES_EFFECTIVE_FROM) return fail('Historical tax dates before April 1, 2025 need review.');
  const province = destinations[0];
  const defaultRate = DESTINATION_TAX_RATES[province];
  if (!defaultRate) return fail('This destination needs tax review before pricing.');
  const { name } = defaultRate;
  const override = billing.destinationTaxRates?.[province];
  const rate = override === undefined ? defaultRate.ratePercent : override;
  if (!isValidDestinationTaxRate(rate)) return fail(`Set a tax rate from 0 to 100% for ${CANADIAN_PROVINCES[province]} in Billing → Taxes.`);
  const description = `${name} ${rate}% · delivery destination: ${CANADIAN_PROVINCES[province]}`;
  return { ...base, province, description, profile: {
    id: `auto_${province}`, name: description, description,
    taxes: [{ id: `auto_${province}_${name}`, name, ratePercent: rate, active: true, appliesTo: [...groups] }],
  } };
}
