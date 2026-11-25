import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { operations } from '../operations/api';
import { ORDER_LIFECYCLE_LABELS, type OrderLifecycle } from '../domain/operations';
import { formatWhen } from '../components/orders/OrderDossierSections';
import { evidenceUrl } from '../components/orders/ProofOfDelivery';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { OrderChat } from '../components/chat/OrderChat';
import { Tabs } from '../components/ui/Tabs';
import { SignaturePad } from './SignaturePad';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { driverIssueReport, driverReportChoices, driverReportReady, toggleReason, type DriverReportReason } from './driverReportOptions';
import { Button, Notice } from './ui';
import { formatPhone, phoneHref } from '../lib/phone';
import type { DriverOrder, DriverRoute as Route, DriverVisit as Visit } from './driverDayPlan';

const statusLabel = (status: string) => ORDER_LIFECYCLE_LABELS[status as OrderLifecycle] ?? status;
const contentBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export function DriverOrderDialog({ timeZone, slug, order, orders, route, online, onStartRoute, onFinishRoute, onOpen, onClose }: {
  timeZone: string; slug: string; order: DriverOrder; orders: DriverOrder[]; route?: Route; online: boolean; onStartRoute: (route: Route) => Promise<void>; onFinishRoute: (route: Route) => Promise<void>; onOpen: (id: string) => void; onClose: () => void;
}) {
  useEntityDialog(true, onClose);
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const refresh = () => Promise.all(['driver-orders', 'driver-routes', 'driver-profile'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
  const call = async (action: () => Promise<unknown>) => { setBusy(true); setError(undefined); try { await action(); } catch (cause) { setError(cause); } finally { await refresh(); setBusy(false); } };
  const stopIds = new Set(order.stops.map(stop => stop.id));
  const visits = route?.stops.filter(visit => stopIds.has(visit.stop_id)) ?? [];
  const next = route?.stops.find(visit => visit.status !== 'COMPLETED');
  const reviewKey = useRef(crypto.randomUUID());
  const needsReview = route?.status === 'IN_PROGRESS' && (!!route.plan.requires_acknowledgement || !route.plan.live_updates_supported);
  const nextOrder = next && !stopIds.has(next.stop_id) ? orders.find(row => row.stops.some(stop => stop.id === next.stop_id)) : undefined;
  const done = ['COMPLETED'].includes(order.status);
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={<><span>{order.number}</span><span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{statusLabel(order.status)}</span></>} description={`${order.service_name || 'Delivery'} · scheduled ${formatWhen(order.scheduled_at, timeZone)}`} />
    <DialogBody className="space-y-5">
      <Tabs label={`${order.number} details`} keepMounted={false} items={[
        { id: 'order', label: 'Order', content: <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 p-5 space-y-4 text-sm">
        <h4 className="app-section-title">Stops</h4>
        {order.stops.map((stop, index) => {
          const items = order.items.filter(item => (stop.kind === 'PICKUP' ? item.pickup_id : item.delivery_id) === stop.id);
          return <div key={stop.id} className="space-y-1 border-t border-slate-100 pt-3 first-of-type:border-0 first-of-type:pt-0">
            <p className="font-medium text-slate-900"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${stop.kind === 'PICKUP' ? 'bg-emerald-500' : 'bg-app-accent'}`} />{index + 1}. {stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery'} · {stop.address.text}</p>
            {(stop.contact_name || stop.phone) && <p className="text-slate-600">{stop.contact_name}{phoneHref(stop.phone) ? <> · <a className="inline-flex items-center gap-1 text-inherit hover:underline" href={phoneHref(stop.phone)} aria-label={`Call ${stop.contact_name || 'stop contact'}`}><Phone className="h-3 w-3" aria-hidden="true" />{formatPhone(stop.phone)}</a></> : stop.phone ? <> · {formatPhone(stop.phone)}</> : null}</p>}
            {(stop.window_start || stop.window_end) && <p className="text-xs text-slate-500">{stop.kind === 'PICKUP' ? 'Ready' : 'Deliver'} {stop.window_start ? `from ${formatWhen(stop.window_start, timeZone)}` : ''} {stop.window_end ? `by ${formatWhen(stop.window_end, timeZone)}` : ''}</p>}
            {stop.instructions && <p className="text-xs text-slate-600">Instructions: {stop.instructions}</p>}
            {stop.liftgate && <p className="text-xs font-medium text-slate-700">Power liftgate needed</p>}
            {items.length > 0 && <p className="text-xs text-slate-500">{items.map(item => `${item.quantity} × ${item.description || 'package'}${item.fragile ? ' (fragile)' : ''}`).join(', ')}</p>}
          </div>;
        })}
      </section>
      <section className="rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
        <h4 className="app-section-title">Delivery</h4>
        <Notice error={error} />
        {done && <p className="text-emerald-700">Delivered {formatWhen(order.completed_at, timeZone)}.</p>}
        {!done && !route && <p role="status" className="text-slate-500">Loading route…</p>}
        {!done && route?.status === 'PLANNED' && <div className="space-y-2">
          <p className="text-slate-600">This order is on your next route ({route.stops.length} stops).</p>
          <Button type="button" disabled={busy || !online} onClick={() => call(() => onStartRoute(route))}>Start route</Button>
          {!online && <p className="text-xs text-amber-700">Go On Duty from the sidebar switch to start the route.</p>}
        </div>}
        {!done && route?.status === 'IN_PROGRESS' && needsReview && <div className="space-y-3"><p>When safely stopped, review the remaining stops to enable compatible assignments during delivery.</p><ol className="list-decimal pl-5">{route.stops.filter(v => v.status !== 'COMPLETED').map(v => <li key={v.id}>{v.stop.address.text}</li>)}</ol><Button type="button" disabled={busy} onClick={() => call(() => operations.acknowledgeRoute(slug, route, reviewKey.current))}>Acknowledge updated route</Button></div>}
        {!done && route?.status === 'IN_PROGRESS' && !needsReview && <>
          {nextOrder && <p className="text-slate-600">Next stop is on order <button type="button" className="font-medium text-app-accent hover:underline" onClick={() => onOpen(nextOrder.id)}>{nextOrder.number}</button>. Complete stops in the planned order.</p>}
          <ol className="space-y-3">{visits.map(visit => <VisitControls key={visit.id} slug={slug} route={route} visit={visit} current={next?.id === visit.id} onChange={refresh} />)}</ol>
        </>}
        {route?.status === 'IN_PROGRESS' && !needsReview && route.stops.every(visit => visit.status === 'COMPLETED') && <Button type="button" disabled={busy} onClick={() => call(() => onFinishRoute(route))}>Complete job</Button>}
      </section>
        </div> },
        { id: 'message', label: 'Message', content: <OrderChat slug={slug} orderId={order.id} orderNumber={order.number} driverOnly /> },
      ]} />
    </DialogBody>
  </Dialog>;
}

export function VisitControls({ slug, route, visit, current, report = true, onChange }: { slug: string; route: Route; visit: Visit; current: boolean; report?: boolean; onChange: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [recipient, setRecipient] = useState('');
  const [unattended, setUnattended] = useState(false);
  const [safePlacement, setSafePlacement] = useState(false);
  const cache = useQueryClient();
  const evidenceQuery = useQuery({ queryKey: ['driver-evidence', slug, visit.stop_id], queryFn: () => operations.stopEvidence(slug, visit.stop_id), enabled: visit.stop.kind === 'DROPOFF' && route.status === 'IN_PROGRESS' && !!visit.arrived_at && visit.status !== 'COMPLETED' });
  const evidence = evidenceQuery.data ?? [];
  const signature = [...evidence].reverse().find(item => item.kind === 'SIGNATURE');
  const photo = [...evidence].reverse().find(item => item.kind === 'PHOTO');
  const [issueReasons, setIssueReasons] = useState<DriverReportReason[]>([]);
  const [issueText, setIssueText] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const call = async (action: () => Promise<unknown>) => { setBusy(true); setError(undefined); try { await action(); await onChange(); } catch (cause) { setError(cause); } finally { setBusy(false); } };
  const save = async (kind: 'PHOTO' | 'SIGNATURE', content: string, mediaType: 'image/png' | 'image/jpeg') => {
    setBusy(true); setError(undefined);
    try { const saved = await operations.uploadEvidence(slug, visit.stop_id, kind, content, mediaType); if (typeof saved.id !== 'string') throw new Error('Evidence response was incomplete.'); await cache.invalidateQueries({ queryKey: ['driver-evidence', slug, visit.stop_id] }); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  };
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000 || !['image/png', 'image/jpeg'].includes(file.type)) { setError(new Error('Choose a PNG or JPEG photo up to 2 MB.')); return; }
    await save('PHOTO', await contentBase64(file), file.type as 'image/png' | 'image/jpeg');
  };
  const linked = route.items?.filter(item => visit.stop.kind === 'PICKUP' ? item.pickup_id === visit.stop_id : item.delivery_id === visit.stop_id) ?? [];
  const quantities = Object.fromEntries(linked.map(item => [item.id, item.quantity]));
  const dropoff = visit.stop.kind === 'DROPOFF';
  const proofReady = !dropoff || (unattended ? safePlacement && !!photo : !!recipient.trim() && !!signature && (!visit.stop.photo_required || !!photo));
  const evidenceIds = [signature, photo].filter(Boolean).map(item => item!.id);
  return <li className="rounded-lg border border-slate-200 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{visit.position + 1}. {dropoff ? 'Delivery' : 'Pickup'}</p><p className="text-sm text-slate-600">{visit.stop.address.text}</p></div><span className="text-xs text-slate-500">{visit.status === 'COMPLETED' ? 'Completed' : visit.arrived_at ? 'Arrived' : current ? 'Next stop' : 'Upcoming'}</span></div>
    <Notice error={error || evidenceQuery.error} />
    {current && report && <div className="space-y-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setIssueOpen(value => !value)}>Report issue</Button>{issueOpen && <div className="space-y-3">
      <DriverChoiceBadges choices={driverReportChoices} value={issueReasons} disabled={busy} onSelect={reason => setIssueReasons(current => toggleReason(current, reason))} />
      <label className="block text-sm">Additional details (optional)<input aria-label="Additional details (optional)" className="app-input mt-1 w-full" maxLength={1900} value={issueText} onChange={event => setIssueText(event.target.value)} placeholder="Add context that will help dispatch respond" /></label>
      <Button type="button" size="sm" disabled={busy || !driverReportReady(issueReasons, issueText)} onClick={() => call(async () => {
        const issue = driverIssueReport(issueReasons, visit.stop.kind, issueText);
        await operations.reportStopIssue(slug, visit.stop_id, issue.kind, issue.description);
        setIssueOpen(false); setIssueReasons([]); setIssueText('');
      })}>Submit issue</Button>
    </div>}</div>}
    {current && !visit.arrived_at && <Button type="button" disabled={busy} onClick={() => call(() => operations.arriveStop(slug, route, visit.id))}>Record arrival</Button>}
    {current && visit.arrived_at && <div className="space-y-3">
      {dropoff && <>
        {visit.stop.unattended_allowed && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unattended} onChange={event => setUnattended(event.target.checked)} />Recipient not available – leave unattended</label>}
        {unattended ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={safePlacement} onChange={event => setSafePlacement(event.target.checked)} />Safe placement confirmed</label> : <>
          <label className="block text-sm">Recipient name<input className="app-input mt-1 w-full" value={recipient} onChange={event => setRecipient(event.target.value)} required /></label>
          {signature ? <div className="space-y-1"><p className="text-sm">Signature saved</p><img src={evidenceUrl(slug, signature.id)} alt="Saved signature" className="h-24 rounded-lg border border-slate-200 bg-white object-contain" /></div> : <SignaturePad disabled={busy} onSave={content => save('SIGNATURE', content, 'image/png')} />}
        </>}
        {(unattended || visit.stop.photo_required) && <label className="block text-sm">{unattended ? 'Delivery photo' : 'Required delivery photo'}<input className="app-input mt-1 w-full" type="file" accept="image/png,image/jpeg" capture="environment" disabled={busy} onChange={event => void uploadPhoto(event.target.files?.[0])} /></label>}
        {photo && <img src={evidenceUrl(slug, photo.id)} alt="Saved delivery photo" className="h-24 rounded-lg border border-slate-200 bg-white object-contain" />}
      </>}
      <Button type="button" disabled={busy || !proofReady} onClick={() => call(() => operations.completeStop(slug, route, visit.id, { quantities, recipient_name: unattended ? '' : recipient.trim(), unattended, safe_placement: unattended && safePlacement, evidence_ids: unattended ? (photo ? [photo.id] : []) : evidenceIds }))}>Confirm {dropoff ? 'delivery' : 'pickup'}</Button>
    </div>}
  </li>;
}
