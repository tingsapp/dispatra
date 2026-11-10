import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { operations } from '../operations/api';
import { draftToInput } from '../operations/orderAdapters';
import { normalizeOrderInput } from '../domain/orderAdapters';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../components/ui/Dialog';
import { Button } from '../components/ui/button';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import type { PricingContext } from '../lib/pricingEngine';
import { ShipperOrderDialog } from './ShipperOrderDialog';

export function ShipperDraftCompletion({ slug, id, ctx, drivers, rateCardName, onClose, onSubmitted }: {
  slug: string; id: string; ctx: PricingContext; drivers: { id: string; name: string }[]; rateCardName: string | null;
  onClose: () => void; onSubmitted: () => void;
}) {
  const detail = useQuery({ queryKey: ['shipper-draft', slug, id], queryFn: () => operations.shipperDraft(slug, id), retry: false, refetchOnWindowFocus: false });
  const initial = useMemo(() => detail.data && normalizeOrderInput({ ...draftToInput(detail.data.draft as Record<string, unknown>), taxCalculation: 'COMPANY' }), [detail.data]);
  useEntityDialog(!initial || !!detail.data?.submitted_at, onClose);
  if (initial && detail.data && !detail.data.submitted_at) return <ShipperOrderDialog key={id} slug={slug} ctx={ctx} initial={initial} draft={detail.data}
    drivers={drivers} rateCardName={rateCardName} onClose={onClose} onDraftSubmitted={onSubmitted} onSaved={() => {}} />;
  return <Dialog onClose={onClose}><DialogHeader title="Order draft" onClose={onClose} /><DialogBody>
    {detail.isPending ? <p role="status">Loading draft…</p> : detail.error ? <p role="alert">This draft is unavailable. Sign in with the shipper account that received the request, or contact your dispatcher.</p> : <p role="status">Your details have already been sent to the dispatcher.</p>}
  </DialogBody><DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter></Dialog>;
}
