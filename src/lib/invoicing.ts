// Invoicing step for completed orders. Local prototype: finalises the frozen price, records the
// invoice preview and marks the order INVOICED. Issuing/emailing the invoice belongs to the billing API.
import { Job } from '../types';
import { orderLifecycle } from '../domain/validation';
import { PricingContext } from './pricingEngine';
import { finalizeOrderPrice, loadPricingContext } from './orderPricing';
import { createInvoicePreview } from './organizationWorkflows';

export type InvoiceState = 'NOT_READY' | 'READY' | 'INVOICED';

/** READY once the order is completed and not yet invoiced. */
export const invoiceState = (job: Job): InvoiceState => {
  const lifecycle = orderLifecycle(job);
  if (lifecycle === 'INVOICED' || job.invoicedAt) return 'INVOICED';
  return lifecycle === 'COMPLETED' ? 'READY' : 'NOT_READY';
};

export const invoiceOrder = (job: Job, ctx: PricingContext = loadPricingContext(), now = new Date()): Job => {
  if (invoiceState(job) !== 'READY') throw new Error('Only completed orders that are not yet invoiced can be invoiced.');
  if (!job.pricingInput) throw new Error('This order has no pricing facts to invoice.');
  const { input, snapshot } = finalizeOrderPrice(job.pricingInput, job.pricingInput.actualHourlyBillableMinutes ?? null, ctx, job.pricing);
  if (snapshot.status !== 'PRICED') throw new Error(snapshot.errors.map(e => e.message).join(' ') || 'The order cannot be priced for invoicing.');
  const invoicePreview = job.invoicePreview ?? createInvoicePreview(job.id, snapshot, ctx, now);
  return { ...job, pricingInput: input, pricing: snapshot, invoicePreview, lifecycleStatus: 'INVOICED', invoicedAt: now.toISOString(), version: (job.version ?? 1) + 1 };
};
