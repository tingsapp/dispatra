import type { BillingConfig, TaxRate } from '../types/billing';
import type { PricingOrderInput } from '../types/pricing';
import type { Customer } from './customerStorage';
import { type DestinationTaxDecision, taxDestinationKey } from './destinationTax';
import { isValidTaxRate } from './taxRate';

/** Configured company rates, independent of pickup or delivery province. */
export function resolveCompanyTax(order: PricingOrderInput, billing: BillingConfig, customer: Customer | undefined): DestinationTaxDecision {
  const base = { ruleVersion: 'company-tax-v2', destinationKey: taxDestinationKey(order) };
  const fail = (error: string): DestinationTaxDecision => ({ ...base, profile: null, description: 'Company tax needs review', error });
  if (order.freightTaxTreatment === 'REVIEW' || order.source === 'IMPORT' || order.importedPrice != null || customer?.taxExempt) {
    return fail('This order has special tax treatment. Review the freight or exemption documents before invoicing.');
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
