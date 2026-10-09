import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { allOperations, operations } from '../operations/api';
import { ORDER_LIFECYCLE_LABELS, normalizeLifecycle } from '../domain/operations';
import { useOrderTracking } from '../components/orders/OrderTracking';
import { TrackingSummary, TrackingDetails } from '../components/orders/TrackingSections';
import { ShipperTrackingMap } from '../components/orders/ShipperTrackingMap';
import { Select } from '../components/ui/Select';
import { Button, Notice } from './ui';

/** The same authorized Shipper orders feed powers selection and order details. */
export function ShipperTracking({ slug, orderId, onSelect, logoutError }: { slug: string; orderId: string | null; onSelect: (id: string) => void; logoutError?: unknown }) {
  const orders = useQuery({ queryKey: ['shipper-orders', slug], queryFn: () => allOperations.orders(slug) });
  const preferences = useQuery({ queryKey: ['booking-preferences', slug], queryFn: () => operations.bookingPreferences(slug) });
  const profile = useQuery({ queryKey: ['shipper-profile', slug], queryFn: () => operations.ownShipper(slug) });
  const rows = orders.data ?? [];
  const selected = orderId ? rows.find(order => order.id === orderId) : rows.find(order => ['ASSIGNED', 'IN_PROGRESS'].includes(order.status)) ?? rows[0];
  const { query: tracking, now } = useOrderTracking(slug, selected?.id);
  const timeZone = preferences.data?.time_zone ?? 'America/Vancouver';
  const error = orders.error || preferences.error;
  const pending = orders.isPending || preferences.isPending;
  return <>
    <ShipperTrackingMap slug={slug} tracking={tracking.error ? undefined : tracking.data} version={selected?.version} warehouse={profile.data?.warehouse} timeZone={timeZone} locationReady={!profile.isPending} />
    <div className="shipper-tracking-overlays" role="region" aria-label="Tracking">
      <section className="shipper-tracking-card shipper-tracking-summary" aria-label="Order progress">
      <Notice error={logoutError} />
      {error ? <><Notice error={error} /><Button variant="outline" onClick={() => { void orders.refetch(); void preferences.refetch(); }}>Try again</Button></>
        : pending ? <p role="status" className="text-sm text-app-muted">Loading tracking…</p>
        : !rows.length ? <div className="py-4 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <h2 className="app-section-title">No orders to track</h2>
          <p className="mt-1 text-sm text-app-muted">Your orders will appear here after booking.</p>
        </div> : <>
      <div className="space-y-1.5">
      <p className="app-label">Order</p>
      <Select aria-label="Order to track" className="w-full" value={selected?.id ?? ''} onValueChange={onSelect} placeholder="Choose an order"
        options={rows.map(order => ({ value: order.id, label: `${order.number} · ${ORDER_LIFECYCLE_LABELS[normalizeLifecycle(order.status) ?? 'NEW']}` }))} />
      </div>
      {!selected ? <Notice error={new Error('This order is unavailable. Choose one of your orders to track.')} />
        : tracking.isPending ? <p role="status" className="text-sm text-app-muted">Loading tracking…</p>
        : tracking.error ? <><Notice error={tracking.error} /><Button variant="outline" onClick={() => void tracking.refetch()}>Retry tracking</Button></>
        : tracking.data && <TrackingSummary tracking={tracking.data} timeZone={timeZone} title={selected.number} />}
      </>}
      </section>
      {!error && !pending && selected && tracking.data && <section className="shipper-tracking-card shipper-tracking-details" aria-label="Stops and timeline">
        <TrackingDetails tracking={tracking.data} timeZone={timeZone} now={now} />
      </section>}
    </div>
  </>;
}
