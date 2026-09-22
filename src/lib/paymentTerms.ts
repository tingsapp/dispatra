import type { CustomerOperations } from '../domain/operations';
import type { BillingConfig } from '../types/billing';

export type PaymentTerms = Exclude<CustomerOperations['paymentTerms'], 'INHERIT' | undefined>;

export const PAYMENT_TERM_LABELS: Record<PaymentTerms, string> = {
  COD: 'COD — Due on delivery', NET7: 'Net 7 days', NET15: 'Net 15 days',
  NET30: 'Net 30 days', NET45: 'Net 45 days', NET60: 'Net 60 days',
};

/** Older customers and frozen quotes may still inherit the stored organization default. */
export const resolvePaymentTerms = (terms: CustomerOperations['paymentTerms'], fallback: BillingConfig['invoicing']['defaultPaymentTerms']): PaymentTerms =>
  terms && terms !== 'INHERIT' ? terms : fallback;

export const paymentTermOptions = (current: CustomerOperations['paymentTerms']) => {
  const terms: PaymentTerms[] = ['COD', 'NET15', 'NET30', 'NET45'];
  if (current === 'NET7' || current === 'NET60') terms.push(current);
  return terms.map(value => ({ value, label: PAYMENT_TERM_LABELS[value] }));
};
