import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, CircleCheck, Clock, Package, Pencil, Truck } from 'lucide-react';
import { allOperations, operations, type Order } from '../operations/api';
import { orderToUi } from '../operations/orderAdapters';
import { shipperPricingContext } from '../operations/pricingAdapters';
import { applyCustomerDefaults, normalizeOrderInput } from '../domain/orderAdapters';
import { lifecycleLabel, orderAttention, orderEditable, orderLifecycle } from '../domain/validation';
import { ORDER_LIFECYCLES, ORDER_LIFECYCLE_LABELS } from '../domain/operations';
import { createBookingInput, describePrice } from '../lib/orderPricing';
import type { PricingContext } from '../lib/pricingEngine';
import { ListSummary } from '../components/layout/ListSummary';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { OrderDossierSections, formatWhen } from '../components/orders/OrderDossierSections';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import type { Job } from '../types';
import type { PricingOrderInput } from '../types/pricing';
import { ShipperOrderDialog } from './ShipperOrderDialog';
import { Notice } from './ui';

type Shipper = Awaited<ReturnType<typeof operations.ownShipper>>;
const dateIn = (iso: string | null | undefined, timeZone: string) => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone }) : '';
/** The API accepts shipper edits only while an order is unassigned. */
const shipperEditable = (job: Job) => job.lifecycleStatus === 'NEW' && orderEditable(job);

function newOrderInput(ctx: PricingContext, shipper: Shipper): PricingOrderInput {
  const self = ctx.customers[0];
  const input = applyCustomerDefaults(createBookingInput(ctx), self);
  const w = shipper.warehouse;
  let applied = false;
  return { ...input, customerId: null, stops: input.stops.map(stop => {
    if (applied || stop.type !== 'PICKUP' || stop.label?.trim() !== w.text.trim()) return stop;
    applied = true;
    return { ...stop, latitude: w.latitude, longitude: w.longitude, city: w.city, provinceCode: w.province, postalCode: w.postal_code, countryCode: w.country, normalizedAddress: w.text };
  }) };
}

export function ShipperOrders({ slug, open, onClose }: { slug: string; open: boolean; onClose: () => void }) {
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ['shipper-profile', slug], queryFn: () => operations.ownShipper(slug) });
  const options = useQuery({ queryKey: ['booking-options', slug], queryFn: () => operations.bookingOptions(slug) });
  const preferences = useQuery({ queryKey: ['booking-preferences', slug], queryFn: () => operations.bookingPreferences(slug) });
  const drivers = useQuery({ queryKey: ['booking-drivers', slug], queryFn: () => operations.bookingDrivers(slug) });
  const orders = useQuery({ queryKey: ['shipper-orders', slug], queryFn: () => allOperations.orders(slug) });
  const ctx = useMemo(() => preferences.data && options.data && profile.data ? shipperPricingContext(preferences.data, options.data, profile.data) : null, [preferences.data, options.data, profile.data]);
  const jobs = useMemo(() => ctx && profile.data && options.data ? (orders.data ?? []).map(order => orderToUi(order, [profile.data], options.data, [])) : [], [ctx, orders.data, profile.data, options.data]);
  const timeZone = ctx?.billing.general.timeZone ?? 'America/Vancouver';
  const today = dateIn(new Date().toISOString(), timeZone);

  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('all');
  const [dateFilter, setDateFilter] = useState<OrderDateSelection>({ kind: 'all' });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [message, setMessage] = useState('');
  const detail = jobs.find(job => job.id === detailId) ?? null;
  const proof = useQuery({ queryKey: ['shipper-proof', slug, detailId], queryFn: () => operations.deliveryProof(slug, detailId!), enabled: !!detail && ['COMPLETED', 'INVOICED'].includes(detail.lifecycleStatus ?? '') });
  useEntityDialog(!!detail, () => setDetailId(null));

  const filtered = jobs.filter(job => {
    const q = search.toLowerCase().trim();
    const text = [job.jobNumber, job.pickupAddress, job.dropoffAddress, job.serviceLevel, ...(job.pricingInput?.stops.map(s => [s.label, s.contactName, s.contactPhone].join(' ')) ?? [])].join(' ').toLowerCase();
    const date = dateIn(job.pricingInput?.scheduledAt ?? job.scheduledTime, timeZone);
    const inDate = dateFilter.kind === 'all' || (dateFilter.kind === 'day' ? date === dateFilter.date : date >= dateFilter.from && date <= dateFilter.to);
    const inStatus = lifecycle === 'all' || (lifecycle === 'attention' ? orderAttention(job).length > 0 : orderLifecycle(job) === lifecycle);
    return (!q || text.includes(q)) && inDate && inStatus;
  });
  const openCount = jobs.filter(job => ['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(orderLifecycle(job))).length;
  const doneCount = jobs.filter(job => ['COMPLETED', 'INVOICED'].includes(orderLifecycle(job))).length;
  const attentionCount = jobs.filter(job => orderAttention(job).length > 0).length;

  const startEdit = (job: Job) => { const record = orders.data?.find(row => row.id === job.id); if (record) { setDetailId(null); setEditing(record); } };
  const closeForm = () => { setEditing(null); onClose(); };
  const saved = async (order: Order, created: boolean) => {
    closeForm(); setMessage(`${created ? 'Created' : 'Updated'} ${order.number}.`);
    await cache.invalidateQueries({ queryKey: ['shipper-orders', slug] });
  };
  const editingJob = editing && jobs.find(job => job.id === editing.id);

  return <div className="space-y-6">
    <Notice error={profile.error || options.error || preferences.error || orders.error} />
    {(orders.isPending || !ctx) && !(profile.error || options.error || preferences.error || orders.error) && <p role="status" className="text-sm text-slate-500">Loading orders…</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {ctx && <>
      <ListSummary label="Orders summary" items={[
        { label: 'Total', value: jobs.length, icon: Package },
        { label: 'Open', value: openCount, icon: Truck },
        { label: 'Needs attention', value: attentionCount, icon: AlertTriangle },
        { label: 'Delivered', value: doneCount, icon: CircleCheck },
      ]} />
      <div className="app-list-toolbar">
        <SearchInput className="app-list-search" value={search} onChange={setSearch} placeholder="Search orders, recipients or addresses..." />
        <div className="app-list-filters">
          <OrderDateFilter value={dateFilter} onValueChange={setDateFilter} today={today} />
          <Select aria-label="Filter by order status" value={lifecycle} onValueChange={setLifecycle} align="end" options={[{ value: 'all', label: 'All order statuses' }, ...ORDER_LIFECYCLES.map(value => ({ value, label: ORDER_LIFECYCLE_LABELS[value] })), { value: 'attention', label: 'Needs attention' }]} />
        </div>
      </div>
      <div className="app-table-shell bg-white overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="app-section-title text-slate-800">{jobs.length ? 'No orders match your filter' : 'No orders yet'}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{jobs.length ? 'Try adjusting your search or filters.' : 'Create an order to book a delivery.'}</p>
          {jobs.length > 0 && <button type="button" onClick={() => { setSearch(''); setLifecycle('all'); setDateFilter({ kind: 'all' }); }} className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Clear all filters</button>}
        </div> : <div className="overflow-x-auto"><table aria-label="Orders" className="app-table w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600">
            <th className="py-3 px-4">Order / Status</th><th className="py-3 px-4">Route Leg (Pickup → Delivery)</th><th className="py-3 px-4">Scheduled Window</th><th className="py-3 px-4">Service & Price</th><th className="py-3 px-4 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">{filtered.map(job => {
            const price = describePrice(job);
            const pickups = job.pricingInput?.stops.filter(s => s.type === 'PICKUP') ?? [];
            const drops = job.pricingInput?.stops.filter(s => s.type === 'DROPOFF') ?? [];
            const deliverBy = drops.map(s => s.windowEnd).filter(Boolean).sort().pop();
            return <tr key={job.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setDetailId(job.id)}>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="flex items-center gap-2"><span className="font-medium text-slate-900">{job.jobNumber}</span><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{lifecycleLabel(job)}</span>{orderAttention(job).map(a => <span key={a.flag} className="text-xs text-amber-700" title={a.detail}>{a.label}</span>)}</div>
                {job.riskText && <div className="text-xs text-slate-500 mt-0.5 font-normal">{job.riskText}</div>}
              </td>
              <td className="py-3.5 px-4 max-w-xs">
                <div className="flex items-start gap-1.5 text-slate-700"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-none" /><span className="truncate font-medium">{job.pickupAddress}{pickups.length > 1 && ` +${pickups.length - 1}`}</span></div>
                <div className="flex items-start gap-1.5 text-slate-500 mt-1"><span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-none" /><span className="truncate">{job.dropoffAddress}{drops.length > 1 && ` +${drops.length - 1}`}</span></div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="flex items-center gap-1 text-slate-700 font-medium"><Clock className="w-3.5 h-3.5 text-slate-400" />{formatWhen(job.pricingInput?.scheduledAt ?? job.scheduledTime, timeZone)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{deliverBy ? `Deliver by ${formatWhen(deliverBy, timeZone)}` : `${job.pricingInput?.stops.length ?? job.stopsCount} stops`}</div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <span className="font-medium text-slate-800">{job.serviceLevel || job.jobType}</span>
                <div className={`text-xs mt-0.5 font-medium ${price.tone === 'ok' ? 'text-slate-900' : price.tone === 'warn' ? 'text-amber-700' : 'text-slate-400'}`}>{price.tone === 'warn' && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}{price.text}</div>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={event => event.stopPropagation()}>
                <div className="inline-flex items-center gap-1">
                  {shipperEditable(job) && <button type="button" onClick={() => startEdit(job)} title="Edit order" aria-label={`Edit ${job.jobNumber}`} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"><Pencil className="w-4 h-4" /></button>}
                  <button type="button" onClick={() => setDetailId(job.id)} title="View order details" aria-label={`View ${job.jobNumber}`} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table></div>}
      </div>
    </>}

    {detail && ctx && <Dialog size="md" onClose={() => setDetailId(null)}>
      <DialogHeader onClose={() => setDetailId(null)} title={<>
        <span>{detail.jobNumber}</span>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">{detail.serviceLevel || detail.jobType}</span>
        {detail.pricing?.status === 'PRICED' && <span className="text-sm font-normal text-slate-600">${detail.pricing.total.toFixed(2)} {detail.pricing.currency}</span>}
      </>} />
      <DialogBody className="space-y-5">
        <OrderDossierSections job={detail} ctx={ctx} showShipper={false} showMargin={false} dispatch={<section className="rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
          <h4 className="app-section-title">Delivery</h4>
          <p>Status: <span className="font-medium">{lifecycleLabel(detail)}</span>{detail.lifecycleStatus === 'NEW' && <span className="text-slate-500"> · awaiting dispatch</span>}</p>
          {['COMPLETED', 'INVOICED'].includes(detail.lifecycleStatus ?? '') && <div>
            <p className="font-medium">Delivery proof</p>
            {proof.isPending && <p role="status">Loading proof…</p>}
            <Notice error={proof.error} />
            {proof.data?.length === 0 && <p className="text-slate-500">No completed delivery proof yet.</p>}
            {proof.data?.map(stop => <div key={stop.stop_id} className="mt-2 border-t border-slate-100 pt-2"><p>{stop.address.text} · {formatWhen(stop.completed_at, timeZone)}</p><p>{stop.unattended ? 'Unattended delivery' : `Received by ${stop.recipient_name || 'recipient'}`}</p>{stop.evidence.map(item => <a key={item.id} className="mr-3 text-blue-700 hover:underline" href={`/api/v1/companies/${slug}/evidence/${item.id}`} target="_blank" rel="noreferrer">View {item.kind.toLowerCase()}</a>)}</div>)}
          </div>}
        </section>} />
      </DialogBody>
      <DialogFooter note={shipperEditable(detail) ? undefined : 'Orders can be edited until they are assigned to a driver.'}>
        {shipperEditable(detail) && <Button variant="outline" onClick={() => startEdit(detail)}>Edit order</Button>}
        <Button onClick={() => setDetailId(null)}>Close</Button>
      </DialogFooter>
    </Dialog>}

    {ctx && profile.data && (open || editing) && <ShipperOrderDialog key={editing?.id ?? 'new'} slug={slug} ctx={ctx} editing={editing ?? undefined} onClose={closeForm} onSaved={saved}
      drivers={drivers.data ?? []} rateCardName={profile.data.rate_card_name ?? null}
      initial={editingJob?.pricingInput ? normalizeOrderInput({ ...structuredClone(editingJob.pricingInput), taxCalculation: 'COMPANY' }) : newOrderInput(ctx, profile.data)} />}
  </div>;
}
