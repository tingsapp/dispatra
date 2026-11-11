import type { PricingSnapshot } from '../types/pricing';

/** Messages which must be resolved before an estimate may be presented as usable. */
export function estimateAttention(snapshot: PricingSnapshot, draftMessages: string[]): string[] {
  const messages = [...draftMessages, ...snapshot.errors.map(error => error.message), ...snapshot.warnings];
  if (snapshot.status !== 'PRICED' && messages.length === 0) messages.push('Complete the shipment details before a live estimate can be calculated.');
  return [...new Set(messages)];
}
