import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import type { Tracking } from './trackingPresentation';
import { TrackingSummary, TrackingDetails } from './TrackingSections';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';

export { trackingHeadline, trackingMoving, trackable } from './trackingPresentation';

/** Tracking in its own dialog, opened from the Orders list Actions column. */
export function OrderTrackingDialog({ slug, orderId, orderNumber, timeZone, version, onClose, onOpenMap }: { slug: string; orderId: string; orderNumber: string; timeZone: string; version?: number; onClose: () => void; onOpenMap?: () => void }) {
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={`Track ${orderNumber}`} />
    <DialogBody><OrderTracking slug={slug} orderId={orderId} timeZone={timeZone} version={version} onOpenMap={onOpenMap} /></DialogBody>
  </Dialog>;
}

/** One live query shared by the map and all tracking cards. */
export function useOrderTracking(slug: string, orderId?: string | null) {
  const query = useQuery({ queryKey: ['tracking', slug, orderId ?? null], queryFn: () => operations.orderTracking(slug, orderId!),
    enabled: !!orderId, refetchInterval: data => data.state.data && ['DELIVERED', 'CANCELLED'].includes(data.state.data.stage) ? false : 30_000 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  return { query, now };
}

/** Live tracking for one Order: progress, ETA, a map (live driver position when allowed), stops and timeline. */
export function OrderTracking({ slug, orderId, timeZone, version, onOpenMap, title = 'Tracking' }: { slug: string; orderId: string; timeZone: string; version?: number; onOpenMap?: () => void; title?: string }) {
  const { query, now } = useOrderTracking(slug, orderId);
  const t = query.data;
  if (query.isPending) return <section className="rounded-xl border border-slate-200 p-5 text-sm"><h4 className="app-section-title">{title}</h4><p role="status" className="mt-2 text-slate-500">Loading tracking…</p></section>;
  if (!t) return <section className="rounded-xl border border-slate-200 p-5 text-sm"><h4 className="app-section-title">{title}</h4><p role="alert" className="mt-2 text-red-700">{query.error instanceof Error ? query.error.message : 'Tracking is unavailable.'}</p></section>;
  return <section className="rounded-xl border border-slate-200 p-5 space-y-4 text-sm" aria-label="Tracking">
    <TrackingSummary tracking={t} timeZone={timeZone} title={title} />
    {t.stage !== 'BOOKED' && t.stage !== 'CANCELLED' && <TrackingMap slug={slug} tracking={t} version={version} onOpenMap={onOpenMap} />}
    <TrackingDetails tracking={t} timeZone={timeZone} now={now} />
  </section>;
}

/** Server-drawn static map: the API renders only what this viewer's tracking allows. A new image is requested only when the
 * Order changes or the driver has moved about 10 m; clicking opens the interactive map where one exists (dispatcher Monitor). */
function TrackingMap({ slug, tracking, version, onOpenMap }: { slug: string; tracking: Tracking; version?: number; onOpenMap?: () => void }) {
  const [failed, setFailed] = useState('');
  const at = tracking.location ? `${tracking.location.latitude.toFixed(4)},${tracking.location.longitude.toFixed(4)}` : '';
  const src = `/api/v1/companies/${encodeURIComponent(slug)}/orders/${encodeURIComponent(tracking.order_id)}/tracking/map?${new URLSearchParams({ v: String(version ?? ''), at })}`;
  if (failed === src || !tracking.stops.some(stop => stop.address.latitude != null && stop.address.longitude != null)) return null;
  const image = <img src={src} alt="Map of the pickup, delivery and driver position" onError={() => setFailed(src)} className="aspect-[2/1] w-full rounded-xl border border-slate-200 bg-slate-100 object-cover" />;
  return onOpenMap ? <button type="button" onClick={onOpenMap} title="Open on Monitor" aria-label="Open on Monitor" className="block w-full cursor-pointer">{image}</button> : image;
}
