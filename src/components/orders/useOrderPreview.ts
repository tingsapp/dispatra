import { useEffect, useMemo, useState } from 'react';
import { operations, type Booking, type RateCard } from '../../operations/api';
import { priceToUi } from '../../operations/orderAdapters';
import { priceOrder } from '../../lib/orderPricing';
import type { PricingContext } from '../../lib/pricingEngine';
import type { PricingOrderInput, PricingSnapshot } from '../../types/pricing';

/** Debounced API price preview for the order form. Without a company slug (prototype) the local engine price is used.
 *  `rateCardName` labels the card for callers that cannot list rate cards (the shipper portal). */
export function useOrderPreview({ slug, input, ctx, enabled, toBooking, rates, rateCardName }: {
  slug: string | null | undefined; input: PricingOrderInput; ctx: PricingContext; enabled: boolean;
  toBooking: (input: PricingOrderInput) => Booking; rates?: RateCard[]; rateCardName?: string | null;
}): PricingSnapshot {
  const local = useMemo(() => priceOrder(input, ctx), [input, ctx]);
  const key = slug ? JSON.stringify([input, ctx.billing.general.timeZone]) : '';
  const [preview, setPreview] = useState<{ key: string; snapshot: PricingSnapshot }>();
  const [error, setError] = useState('Checking price…');
  useEffect(() => {
    if (!slug || !enabled) return;
    setError('Checking price…');
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const booking = toBooking(input);
        const result = await operations.preview(slug, booking);
        const snapshot = priceToUi(result, booking, new Date().toISOString(), rates?.find(rate => rate.id === result.rate_card_id));
        if (!snapshot.rateCard && rateCardName && result.rate_card_id && result.method) snapshot.rateCard = { id: result.rate_card_id, name: rateCardName, version: result.rate_card_version ?? 1, scope: 'SHIPPER', source: 'SHIPPER', pricingMethod: result.method as PricingSnapshot['method'] & string };
        if (current) { setPreview({ key, snapshot }); setError(''); }
      } catch (cause) { if (current) { setPreview(undefined); setError(cause instanceof Error ? cause.message : 'Could not check the price.'); } }
    }, 500);
    return () => { current = false; window.clearTimeout(timer); };
  }, [slug, enabled, key, rates, rateCardName]);
  if (!slug) return local;
  return preview?.key === key ? preview.snapshot : {
    ...local, status: 'NEEDS_ATTENTION', rateCard: rateCardName ? { id: '', name: rateCardName, version: 0, scope: 'SHIPPER', source: 'SHIPPER', pricingMethod: local.method ?? 'FIXED' } : null, lines: [], taxLines: [], subtotal: 0, taxTotal: 0, total: 0,
    errors: [{ code: 'INVALID_ORDER', message: error || 'Checking price…' }], warnings: [],
  };
}
