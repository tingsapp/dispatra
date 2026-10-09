import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { allOperations, operations } from '../operations/api';
import { ORDER_LIFECYCLE_LABELS, normalizeLifecycle } from '../domain/operations';
import { OrderTracking } from '../components/orders/OrderTracking';
import { Select } from '../components/ui/Select';
import { Button, Notice } from './ui';

/** The same authorized Shipper orders feed powers selection and order details. */
export function ShipperTracking({ slug, orderId, onSelect }: { slug: string; orderId: string | null; onSelect: (id: string) => void }) {
  const orders = useQuery({ queryKey: ['shipper-orders', slug], queryFn: () => allOperations.orders(slug) });
  const preferences = useQuery({ queryKey: ['booking-preferences', slug], queryFn: () => operations.bookingPreferences(slug) });
  const rows = orders.data ?? [];
  const selected = orderId ? rows.find(order => order.id === orderId) : rows.find(order => ['ASSIGNED', 'IN_PROGRESS'].includes(order.status)) ?? rows[0];
  const error = orders.error || preferences.error;
  if (error) return <div className="space-y-4"><Notice error={error} /><Button variant="outline" onClick={() => { void orders.refetch(); void preferences.refetch(); }}>Try again</Button></div>;
  if (orders.isPending || preferences.isPending) return <p role="status" className="text-sm text-app-muted">Loading tracking…</p>;
  if (!rows.length) return <div className="py-12 text-center">
    <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
    <h2 className="app-section-title">No orders to track</h2>
    <p className="mt-1 text-sm text-app-muted">Your orders will appear here after booking.</p>
  </div>;
  return <div className="space-y-6">
    <div className="space-y-1.5">
      <p className="app-label">Order</p>
      <Select aria-label="Order to track" className="w-full" value={selected?.id ?? ''} onValueChange={onSelect} placeholder="Choose an order"
        options={rows.map(order => ({ value: order.id, label: `${order.number} · ${ORDER_LIFECYCLE_LABELS[normalizeLifecycle(order.status) ?? 'NEW']}` }))} />
    </div>
    {!selected ? <Notice error={new Error('This order is unavailable. Choose one of your orders to track.')} />
      : <OrderTracking key={selected.id} slug={slug} orderId={selected.id} timeZone={preferences.data?.time_zone ?? 'America/Vancouver'} version={selected.version} title={selected.number} />}
  </div>;
}
