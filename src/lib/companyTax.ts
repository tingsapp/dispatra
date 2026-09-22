import type { BillingConfig } from '../types/billing';
import type { PricingOrderInput } from '../types/pricing';
import type { Customer } from './customerStorage';
import { type DestinationTaxDecision, taxDestinationKey } from './destinationTax';
import { isValidTaxRate } from './taxRate';

/** Configured company rate, independent of pickup or delivery province. */
export function resolveCompanyTax(order: PricingOrderInput, billing: BillingConfig, customer: Customer | undefined): DestinationTaxDecision {
  const base = { ruleVersion: 'company-tax-v1', destinationKey: taxDestinationKey(order) };
  const fail = (error: string): DestinationTaxDecision => ({ ...base, profile: null, description: 'Company tax needs review', error });
  if (order.freightTaxTreatment === 'REVIEW' || order.source === 'IMPORT' || order.importedPrice != null || customer?.taxExempt) {
    return fail('This order has special tax treatment. Review the freight or exemption documents before invoicing.');
  }
  const rate = billing.companyTax.ratePercent;
  if (!isValidTaxRate(rate)) return fail('Set a Tax / GST rate from 0 to 100% in Company → Taxes.');
  const description = `Tax / GST ${rate}%`;
  return { ...base, description, profile: {
    id: 'company_tax', name: description, description,
    taxes: [{ id: 'company_tax', name: 'Tax / GST', ratePercent: rate, active: true,
      appliesTo: ['transport', 'accessorials', 'service_charge', 'fuel_surcharge'] }],
  } };
}
