import type { NeedsAttentionItem } from '../../types';

export function attentionEntries(items: NeedsAttentionItem[], reviewAt?: string, includeReview = false) {
  const entries: { id: string; at: number; item?: NeedsAttentionItem }[] = items.map(item => ({ id: item.id, at: Date.parse(item.at ?? '') || 0, item }));
  if (includeReview) entries.push({ id: 'request-review', at: reviewAt ? Date.parse(reviewAt) || 0 : Number.MAX_SAFE_INTEGER });
  return entries.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
