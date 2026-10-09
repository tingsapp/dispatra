import type { BillingConfig, TaxRate } from '../types/billing';
import type { PricingOrderInput } from '../types/pricing';
import type { Customer } from './customerStorage';
import { type DestinationTaxDecision, taxDestinationKey } from './destinationTax';
import { isValidTaxRate } from './taxRate';
import { resolveFuelPercent } from './billingEngine';
import { formatDistance } from './units';
import type { PricingSnapshot } from '../types/pricing';

/** Configured company rates, independent of pickup or delivery province. */
export function resolveCompanyTax(order: PricingOrderInput, billing: BillingConfig, customer: Customer | undefined): DestinationTaxDecision {
  const base = { ruleVersion: 'company-tax-v2', destinationKey: taxDestinationKey(order) };
  const fail = (error: string): DestinationTaxDecision => ({ ...base, profile: null, description: 'Company tax needs review', error });
  if (order.freightTaxTreatment === 'REVIEW' || order.source === 'IMPORT' || order.importedPrice != null || customer?.taxExempt) {
    return fail('This order has special tax treatment. Review the freight or exemption documents before pricing.');
  }
  const { enabled, ratePercent, provincialEnabled, provincialRatePercent } = billing.companyTax;
  if (enabled && !isValidTaxRate(ratePercent)) return fail('Set a GST/HST rate from 0 to 100% in Company.');
  if (provincialEnabled && !isValidTaxRate(provincialRatePercent)) return fail('Set a provincial tax rate from 0 to 100% in Company.');
  const appliesTo: TaxRate['appliesTo'] = ['transport', 'accessorials', 'service_charge', 'fuel_surcharge'];
  const taxes: TaxRate[] = [];
  if (enabled && ratePercent !== null) taxes.push({ id: 'company_gst_hst', name: 'GST/HST', ratePercent, active: true, appliesTo });
  if (provincialEnabled && provincialRatePercent !== null) taxes.push({ id: 'company_provincial', name: 'Provincial tax', ratePercent: provincialRatePercent, active: true, appliesTo });
  const description = taxes.length ? taxes.map(tax => `${tax.name} ${tax.ratePercent}%`).join(' + ') : 'No company tax';
  return { ...base, description, profile: { id: 'company_tax', name: description, description, taxes } };
}

const percent = (value: number) => `${Number(value.toFixed(2))}%`;
/** The company's enabled tax and fuel rates for display, straight from company settings (only what is switched on). */
export function companyRateRows(billing: BillingConfig): { label: string; value: string }[] {
  const { enabled, ratePercent, provincialEnabled, provincialRatePercent } = billing.companyTax;
  const fuel = resolveFuelPercent(billing);
  return [
    ...(enabled && isValidTaxRate(ratePercent) ? [{ label: 'GST/HST', value: percent(ratePercent) }] : []),
    ...(provincialEnabled && isValidTaxRate(provincialRatePercent) ? [{ label: 'Provincial tax', value: percent(provincialRatePercent) }] : []),
    ...(billing.fuelSurcharge.enabled && Number.isFinite(fuel) ? [{ label: billing.fuelSurcharge.label || 'Fuel Surcharge', value: percent(fuel) }] : []),
  ];
}

const duration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
/** Road distance and time used for the price (dispatcher only; never shown to shippers). */
export function travelRows(snapshot: PricingSnapshot, units: BillingConfig['general']): { label: string; value: string }[] {
  const { routeKm, estimatedMinutes } = snapshot.inputs;
  return [
    ...(routeKm != null ? [{ label: 'Distance', value: formatDistance(routeKm, units) }] : []),
    ...(estimatedMinutes != null ? [{ label: 'Duration', value: duration(estimatedMinutes) }] : []),
  ];
}
