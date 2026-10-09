import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ChevronRight, ClipboardList, Clock, Package, Phone, Shield, Truck, UserRound } from 'lucide-react';
import { operations, allOperations } from '../operations/api';
import { ORDER_LIFECYCLES, ORDER_LIFECYCLE_LABELS, type OrderLifecycle } from '../domain/operations';
import { ListSummary } from '../components/layout/ListSummary';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { formatWhen } from '../components/orders/OrderDossierSections';
import { evidenceUrl } from '../components/orders/ProofOfDelivery';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { PortalShell } from './PortalShell';
import { NotificationBell } from './Notifications';
import { useSync } from './sync';
import { PasswordPage } from './PasswordPage';
import { SignaturePad } from './SignaturePad';
import { Button, Card, Field, Notice } from './ui';
import type { components } from './schema';
import { formatPhone } from '../lib/phone';

type Route = components['schemas']['RouteView'];
type Visit = components['schemas']['RouteVisitView'];
type DriverOrder = components['schemas']['DriverOrderView'];
type Profile = components['schemas']['DriverProfileView'];
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dateIn = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone }) : '';
const statusLabel = (status: string) => ORDER_LIFECYCLE_LABELS[status as OrderLifecycle] ?? status;
const position = () => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
const contentBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const driverPages = [
  { path: 'profile', label: 'Profile', icon: UserRound },
  { path: 'orders', label: 'Orders', icon: ClipboardList },
];

/** Driver workspace: Profile and Orders, with the On duty/Off duty switch in the sidebar. */
export function DriverPortal({ slug, company, login, onLogout, loggingOut, logoutError }: {
  slug: string; company: string; login: string; onLogout: () => void; loggingOut: boolean; logoutError: unknown;
}) {
  const cache = useQueryClient();
  const [pathname, setPathname] = useState(() => location.pathname);
  useEffect(() => { const sync = () => setPathname(location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const go = (href: string) => { if (href !== location.pathname) history.pushState(null, '', href); setPathname(href); window.scrollTo(0, 0); };
  const base = `/${slug}/driver`;
  const suffix = pathname.replace(/\/+$/, '').split('/')[3];
  const page = driverPages.find(item => item.path === suffix) ?? driverPages[1];
  useSync(slug, 'DRIVER');
  const profile = useQuery({ queryKey: ['driver-profile', slug], queryFn: () => operations.driverProfile(slug) });
  const online = !!profile.data?.duty;
  const tracking = useRef<string | null>(null);
  const trackingIntent = useRef(0);
  const [trackingDutyId, setTrackingDutyId] = useState<string | null>(null);
  const stopTracking = () => { trackingIntent.current++; tracking.current = null; setTrackingDutyId(null); };
  const [dutyError, setDutyError] = useState<unknown>();
  const duty = useMutation({
    mutationFn: async (next: boolean) => {
      if (!next) { stopTracking(); if (profile.data?.duty) await operations.endDuty(slug, profile.data.duty); return; }
      if (!profile.data?.duty) await operations.startDuty(slug);
    },
    onMutate: () => setDutyError(undefined), onError: setDutyError,
    onSettled: () => Promise.all([cache.invalidateQueries({ queryKey: ['driver-profile', slug] }), cache.invalidateQueries({ queryKey: ['driver-routes', slug] })]),
  });
  const startSharing = async () => {
    const current = profile.data?.duty;
    if (!current) throw new Error('Go On Duty before starting this route.');
    const intent = ++trackingIntent.current;
    let here: GeolocationPosition;
    try { here = await position(); } catch { throw new Error('Allow location access in your browser to start this route.'); }
    if (trackingIntent.current !== intent) return;
    tracking.current = current.id;
    try {
      await operations.driverLocation(slug, current.id, here);
      if (tracking.current === current.id) setTrackingDutyId(current.id);
    } catch (error) { stopTracking(); throw error; }
  };
  const startRoute = async (route: Route) => {
    await startSharing();
    await operations.startRoute(slug, route);
  };
  const finishRoute = async (route: Route) => {
    await operations.finishRoute(slug, route);
    stopTracking();
  };
  // Only a driver's action in this browser starts tracking. Server duty changes cannot.
  useEffect(() => {
    const dutyId = profile.data?.duty?.id;
    if (!dutyId || dutyId !== trackingDutyId || !navigator.geolocation) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && tracking.current === dutyId) position().then(here => {
        if (active && tracking.current === dutyId) return operations.driverLocation(slug, dutyId, here);
      }).catch(() => undefined);
    }, 120_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [slug, profile.data?.duty?.id, trackingDutyId]);
  useEffect(() => () => { trackingIntent.current++; tracking.current = null; }, [slug]);
  return <PortalShell company={company} login={login} primary={page.label} icon={page.icon} settings={false} reading={page.path === 'profile'}
    description={page.path === 'profile' ? 'Your details and account security.' : online ? 'Your assigned orders. Open an order to work its stops.' : 'Your assigned orders. Go On Duty to receive and start a route.'}
    navigation={driverPages.map(item => ({ ...item, href: item.path === 'orders' ? base : `${base}/${item.path}`, current: item.path === page.path }))}
    footer={collapsed => <div className={`mt-1 flex items-center py-3 ${collapsed ? 'justify-center' : 'justify-between px-3'}`} title={collapsed ? (online ? 'On duty' : 'Off duty') : undefined}>
      <span className={collapsed ? 'sr-only' : `text-sm font-normal ${online ? 'text-emerald-700' : 'text-slate-700'}`}>{duty.isPending ? (duty.variables ? 'Going on duty…' : 'Going off duty…') : online ? 'On duty' : 'Off duty'}</span>
      <Switch checked={online} aria-label="Duty status" disabled={!profile.data || duty.isPending} onCheckedChange={next => duty.mutate(next)} />
    </div>}
    actions={<NotificationBell slug={slug} onOpen={() => go(base)} />}
    onNavigate={go} onHome={() => go(base)} onSettings={() => go(`${base}/profile`)} onLogout={onLogout} loggingOut={loggingOut}>
    <Notice error={logoutError || dutyError} />
    {page.path === 'profile' ? <DriverProfilePage slug={slug} profile={profile.data} loading={profile.isPending} error={profile.error} /> : <DriverOrders slug={slug} online={online} onStartRoute={startRoute} onFinishRoute={finishRoute} />}
  </PortalShell>;
}

function DriverProfilePage({ slug, profile, loading, error }: { slug: string; profile?: Profile; loading: boolean; error: unknown }) {
  const [section, setSection] = useState<'details' | 'security'>('details');
  return <>
    <div className="flex items-center gap-2" aria-label="Profile sections">
      <button type="button" className="app-tab inline-flex items-center gap-2" aria-pressed={section === 'details'} onClick={() => setSection('details')}><UserRound size={14} />Details</button>
      <button type="button" className="app-tab inline-flex items-center gap-2" aria-pressed={section === 'security'} onClick={() => setSection('security')}><Shield size={14} />Security</button>
    </div>
    {section === 'details' && (loading ? <p role="status">Loading your profile…</p> : error ? <Notice error={error} /> : profile && <DriverProfileForm key={profile.id} slug={slug} profile={profile} />)}
    {section === 'security' && <PasswordPage plain />}
  </>;
}

function DriverProfileForm({ slug, profile }: { slug: string; profile: Profile }) {
  const cache = useQueryClient();
  const [phone, setPhone] = useState(profile.phone);
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({ mutationFn: () => operations.updateDriverProfile(slug, profile.version, phone.trim()), onSuccess: data => { cache.setQueryData(['driver-profile', slug], data); setSaved(true); } });
  return <Card plain title="Driver details" description={`${profile.name} · ${profile.number}`}><form className="space-y-5" onSubmit={event => { event.preventDefault(); setSaved(false); mutation.mutate(); }}>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Name" readOnly value={profile.name} />
      <Field label="Email" type="email" readOnly value={profile.email} />
      <Field label="Phone" type="tel" required minLength={3} maxLength={50} value={phone} onChange={event => { setSaved(false); setPhone(event.target.value); }} />
      <Field label="Service city" readOnly value={profile.service_city} />
      <div className="sm:col-span-2"><Field label="Address" readOnly value={profile.address.text} /></div>
      <Field label="Vehicle" readOnly value={profile.vehicle_name ?? 'No vehicle assigned'} />
      <Field label="Status" readOnly value={profile.duty ? 'On duty' : 'Off duty'} />
    </div>
    <Notice error={mutation.error} success={saved ? 'Profile saved.' : undefined} />
    <div className="flex gap-3"><Button disabled={mutation.isPending || phone.trim() === profile.phone}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button></div>
    <p className="text-xs text-slate-500">Contact your dispatcher to change your name, email, address or vehicle.</p>
  </form></Card>;
}

function DriverOrders({ slug, online, onStartRoute, onFinishRoute }: { slug: string; online: boolean; onStartRoute: (route: Route) => Promise<void>; onFinishRoute: (route: Route) => Promise<void> }) {
  const orders = useQuery({ queryKey: ['driver-orders', slug], queryFn: () => operations.driverOrders(slug) });
  const routes = useQuery({ queryKey: ['driver-routes', slug], queryFn: () => allOperations.driverRoutes(slug) });
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('all');
  const [dateFilter, setDateFilter] = useState<OrderDateSelection>({ kind: 'all' });
  const [detailId, setDetailId] = useState<string | null>(null);
  const rows = orders.data ?? [];
  const detail = rows.find(order => order.id === detailId) ?? null;
  const filtered = rows.filter(order => {
    const q = search.toLowerCase().trim();
    const text = [order.number, order.service_name, ...order.stops.map(stop => [stop.address.text, stop.contact_name, stop.phone].join(' '))].join(' ').toLowerCase();
    const date = dateIn(order.scheduled_at);
    const inDate = dateFilter.kind === 'all' || (dateFilter.kind === 'day' ? date === dateFilter.date : date >= dateFilter.from && date <= dateFilter.to);
    return (!q || text.includes(q)) && inDate && (lifecycle === 'all' || order.status === lifecycle);
  });
  const active = rows.filter(order => ['ASSIGNED', 'IN_PROGRESS'].includes(order.status)).length;
  const delivered = rows.filter(order => ['COMPLETED'].includes(order.status)).length;
  const today = rows.filter(order => dateIn(order.scheduled_at) === dateIn(new Date().toISOString())).length;
  return <div className="space-y-6">
    <Notice error={orders.error || routes.error} />
    {orders.isPending && <p role="status" className="text-sm text-slate-500">Loading orders…</p>}
    {orders.data && <>
      <ListSummary label="Orders summary" items={[
        { label: 'Total', value: rows.length, icon: Package },
        { label: 'Active', value: active, icon: Truck },
        { label: 'Today', value: today, icon: Clock },
        { label: 'Delivered', value: delivered, icon: CircleCheck },
      ]} />
      <div className="app-list-toolbar">
        <SearchInput className="app-list-search" value={search} onChange={setSearch} placeholder="Search orders, contacts or addresses..." />
        <div className="app-list-filters">
          <OrderDateFilter value={dateFilter} onValueChange={setDateFilter} today={dateIn(new Date().toISOString())} />
          <Select aria-label="Filter by order status" value={lifecycle} onValueChange={setLifecycle} align="end" options={[{ value: 'all', label: 'All order statuses' }, ...ORDER_LIFECYCLES.filter(value => value !== 'NEW').map(value => ({ value, label: ORDER_LIFECYCLE_LABELS[value] }))]} />
        </div>
      </div>
      <div className="app-table-shell bg-white overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="app-section-title text-slate-800">{rows.length ? 'No orders match your filter' : 'No orders assigned yet'}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{rows.length ? 'Try adjusting your search or filters.' : 'Orders appear here when dispatch assigns them to you.'}</p>
          {rows.length > 0 && <button type="button" onClick={() => { setSearch(''); setLifecycle('all'); setDateFilter({ kind: 'all' }); }} className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Clear all filters</button>}
        </div> : <div className="overflow-x-auto"><table aria-label="Orders" className="app-table w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600">
            <th className="py-3 px-4">Order / Status</th><th className="py-3 px-4">Pickup → Delivery</th><th className="py-3 px-4">Scheduled Window</th><th className="py-3 px-4">Service & Items</th><th className="py-3 px-4 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">{filtered.map(order => {
            const pickups = order.stops.filter(stop => stop.kind === 'PICKUP');
            const drops = order.stops.filter(stop => stop.kind === 'DROPOFF');
            const deliverBy = drops.map(stop => stop.window_end).filter(Boolean).sort().pop();
            const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return <tr key={order.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setDetailId(order.id)}>
              <td className="py-3.5 px-4 whitespace-nowrap"><div className="flex items-center gap-2"><span className="font-medium text-slate-900">{order.number}</span><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{statusLabel(order.status)}</span></div></td>
              <td className="py-3.5 px-4 max-w-xs">
                <div className="flex items-start gap-1.5 text-slate-700"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-none" /><span className="truncate font-medium">{pickups[0]?.address.text}{pickups.length > 1 && ` +${pickups.length - 1}`}</span></div>
                <div className="flex items-start gap-1.5 text-slate-500 mt-1"><span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-none" /><span className="truncate">{drops[drops.length - 1]?.address.text}{drops.length > 1 && ` +${drops.length - 1}`}</span></div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="flex items-center gap-1 text-slate-700 font-medium"><Clock className="w-3.5 h-3.5 text-slate-400" />{formatWhen(order.scheduled_at, timeZone)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{deliverBy ? `Deliver by ${formatWhen(deliverBy, timeZone)}` : `${order.stops.length} stops`}</div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap"><span className="font-medium text-slate-800">{order.service_name || 'Delivery'}</span><div className="text-xs mt-0.5 text-slate-500">{pieces} {pieces === 1 ? 'piece' : 'pieces'}</div></td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={event => event.stopPropagation()}>
                <button type="button" onClick={() => setDetailId(order.id)} title="View order details" aria-label={`View ${order.number}`} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </td>
            </tr>;
          })}</tbody>
        </table></div>}
      </div>
    </>}
    {detail && <DriverOrderDialog slug={slug} order={detail} orders={rows} route={routes.data?.find(route => route.id === detail.route_id)} online={online} onStartRoute={onStartRoute} onFinishRoute={onFinishRoute} onOpen={setDetailId} onClose={() => setDetailId(null)} />}
  </div>;
}

function DriverOrderDialog({ slug, order, orders, route, online, onStartRoute, onFinishRoute, onOpen, onClose }: {
  slug: string; order: DriverOrder; orders: DriverOrder[]; route?: Route; online: boolean; onStartRoute: (route: Route) => Promise<void>; onFinishRoute: (route: Route) => Promise<void>; onOpen: (id: string) => void; onClose: () => void;
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
  const nextOrder = next && !stopIds.has(next.stop_id) ? orders.find(row => row.stops.some(stop => stop.id === next.stop_id)) : undefined;
  const done = ['COMPLETED'].includes(order.status);
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={<><span>{order.number}</span><span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{statusLabel(order.status)}</span></>} description={`${order.service_name || 'Delivery'} · scheduled ${formatWhen(order.scheduled_at, timeZone)}`} />
    <DialogBody className="space-y-5">
      <section className="rounded-xl border border-slate-200 p-5 space-y-4 text-sm">
        <h4 className="app-section-title">Stops</h4>
        {order.stops.map((stop, index) => {
          const items = order.items.filter(item => (stop.kind === 'PICKUP' ? item.pickup_id : item.delivery_id) === stop.id);
          return <div key={stop.id} className="space-y-1 border-t border-slate-100 pt-3 first-of-type:border-0 first-of-type:pt-0">
            <p className="font-medium text-slate-900"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${stop.kind === 'PICKUP' ? 'bg-emerald-500' : 'bg-blue-500'}`} />{index + 1}. {stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery'} · {stop.address.text}</p>
            {(stop.contact_name || stop.phone) && <p className="text-slate-600">{stop.contact_name}{stop.phone && <> · <a className="inline-flex items-center gap-1 text-inherit hover:underline" href={`tel:${stop.phone}`}><Phone className="h-3 w-3" />{formatPhone(stop.phone)}</a></>}</p>}
            {(stop.window_start || stop.window_end) && <p className="text-xs text-slate-500">{stop.kind === 'PICKUP' ? 'Ready' : 'Deliver'} {stop.window_start ? `from ${formatWhen(stop.window_start, timeZone)}` : ''} {stop.window_end ? `by ${formatWhen(stop.window_end, timeZone)}` : ''}</p>}
            {stop.instructions && <p className="text-xs text-slate-600">Instructions: {stop.instructions}</p>}
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
        {!done && route?.status === 'IN_PROGRESS' && <>
          {nextOrder && <p className="text-slate-600">Next stop is on order <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => onOpen(nextOrder.id)}>{nextOrder.number}</button>. Complete stops in the planned order.</p>}
          <ol className="space-y-3">{visits.map(visit => <VisitControls key={visit.id} slug={slug} route={route} visit={visit} current={next?.id === visit.id} onChange={refresh} />)}</ol>
        </>}
        {route?.status === 'IN_PROGRESS' && route.stops.every(visit => visit.status === 'COMPLETED') && <Button type="button" disabled={busy} onClick={() => call(() => onFinishRoute(route))}>Complete job</Button>}
      </section>
    </DialogBody>
    <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
  </Dialog>;
}

function VisitControls({ slug, route, visit, current, onChange }: { slug: string; route: Route; visit: Visit; current: boolean; onChange: () => Promise<unknown> }) {
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
  const [issueKind, setIssueKind] = useState<'FAILED_PICKUP' | 'FAILED_DELIVERY' | 'SHORT_LOAD' | 'WRONG_ADDRESS' | 'UNSAFE' | 'VEHICLE' | 'OTHER'>('OTHER');
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
    {current && <div className="space-y-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setIssueOpen(value => !value)}>Report issue</Button>{issueOpen && <div className="flex flex-wrap gap-2"><select aria-label="Issue type" className="app-input" value={issueKind} onChange={event => setIssueKind(event.target.value as typeof issueKind)}><option value="OTHER">Other</option><option value="FAILED_PICKUP">Failed pickup</option><option value="FAILED_DELIVERY">Failed delivery</option><option value="SHORT_LOAD">Short load</option><option value="WRONG_ADDRESS">Wrong address</option><option value="UNSAFE">Unsafe location</option><option value="VEHICLE">Vehicle issue</option></select><input aria-label="Issue details" className="app-input flex-1" minLength={3} value={issueText} onChange={event => setIssueText(event.target.value)} placeholder="Describe the issue" /><Button type="button" disabled={busy || issueText.trim().length < 3} onClick={() => call(async () => { await operations.reportStopIssue(slug, visit.stop_id, issueKind, issueText.trim()); setIssueOpen(false); setIssueText(''); })}>Submit issue</Button></div>}</div>}
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
