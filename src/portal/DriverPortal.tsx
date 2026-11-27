import { NotificationChat } from '../components/chat/NotificationChat';
import { LiveNotices } from '../components/chat/LiveNotices';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ChevronRight, ClipboardList, Clock, MessageSquare, Package, Map, Shield, Truck, UserRound } from 'lucide-react';
import { operations, allOperations } from '../operations/api';
import { ORDER_LIFECYCLES, ORDER_LIFECYCLE_LABELS, type OrderLifecycle } from '../domain/operations';
import { ListSummary } from '../components/layout/ListSummary';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { formatWhen } from '../components/orders/OrderDossierSections';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { CompanyChatPage } from '../components/chat/CompanyChatDialog';
import { useCompanyChannel, useChatInbox } from '../chat/api';
import { PortalShell } from './PortalShell';
import { DriverDashboard } from './DriverDashboard';
import { DriverOrderDialog } from './DriverOrderDialog';
import { NotificationBell } from './Notifications';
import { useSync } from './sync';
import { PasswordPage } from './PasswordPage';
import { AddressField, Button, Card, Field, Notice } from './ui';
import { LogoUpload } from '../components/settings/LogoUpload';
import { streetAddress } from '../operations/adapters';
import type { SelectedAddress } from '../components/ui/AddressAutocomplete';
import type { components } from './schema';

type Route = components['schemas']['RouteView'];
type DriverOrder = components['schemas']['DriverOrderView'];
type Profile = components['schemas']['DriverProfileView'];
const dateIn = (iso: string | null | undefined, timeZone: string) => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone }) : '';
const statusLabel = (status: string) => ORDER_LIFECYCLE_LABELS[status as OrderLifecycle] ?? status;
const position = () => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
export const driverPages = [
  { path: 'orders', label: 'Orders', icon: ClipboardList },
  { path: 'messages', label: 'Chat', icon: MessageSquare },
  { path: 'profile', label: 'Profile', icon: UserRound },
];
const dashboardPage = { path: 'dashboard', label: 'Dashboard', icon: Map };

/** Driver workspace opens on today’s map; duty sharing remains an explicit driver action. */
export function DriverPortal({ slug, company, login, onLogout, loggingOut, logoutError }: {
  slug: string; company: string; login: string; onLogout: () => void; loggingOut: boolean; logoutError: unknown;
}) {
  const cache = useQueryClient();
  const [notificationChat, setNotificationChat] = useState<string | null>(null);
  const [pathname, setPathname] = useState(() => location.pathname);
  useEffect(() => { const sync = () => setPathname(location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const go = (href: string) => { if (href !== location.pathname) history.pushState(null, '', href); setPathname(href); window.scrollTo(0, 0); };
  const base = `/${slug}/driver`;
  const suffix = pathname.replace(/\/+$/, '').split('/')[3];
  const page = suffix ? driverPages.find(item => item.path === suffix) ?? dashboardPage : dashboardPage;
  useSync(slug, 'DRIVER');
  const profile = useQuery({ queryKey: ['driver-profile', slug], queryFn: () => operations.driverProfile(slug) });
  const orderChats = useChatInbox(slug);
  const orderUnread = orderChats.data?.filter(row => row.kind === 'DRIVER_SHIPPER').reduce((sum,row) => sum + row.unread,0) ?? 0;
  const companyChat = useCompanyChannel(slug, profile.data?.id);
  const unreadMessages = companyChat.data?.unread ?? 0;
  const online = !!profile.data?.duty;
  const dutyLabel = profile.data ? (online ? 'On duty' : 'Off duty') : profile.isPending ? 'Checking duty…' : 'Duty unavailable';
  const tracking = useRef<string | null>(null);
  const trackingIntent = useRef(0);
  const [trackingDutyId, setTrackingDutyId] = useState<string | null>(null);
  const [fix, setFix] = useState<GeolocationPosition | null>(null);
  const stopTracking = () => { trackingIntent.current++; tracking.current = null; setTrackingDutyId(null); setFix(null); };
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
      if (tracking.current === current.id) { setTrackingDutyId(current.id); setFix(here); }
    } catch (error) { stopTracking(); throw error; }
  };
  // Stop actions reuse sharing the driver already started; Navigate and arrival start it like the driver app.
  const shareLocation = async () => { if (!profile.data?.duty || tracking.current !== profile.data.duty.id) await startSharing(); };
  const locate = async () => {
    await shareLocation();
    let here: GeolocationPosition;
    try { here = await position(); } catch { throw new Error('Allow location access in your browser to confirm arrival.'); }
    setFix(here);
    return here;
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
    let uploaded = Date.now();
    // Fixes every 15 s keep arrival detection current, as in the driver app; the server still gets one every 2 minutes.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && tracking.current === dutyId) position().then(here => {
        if (!active || tracking.current !== dutyId) return;
        setFix(here);
        if (Date.now() - uploaded < 120_000) return;
        uploaded = Date.now();
        return operations.driverLocation(slug, dutyId, here).then(() => Promise.all([
          cache.invalidateQueries({ queryKey: ['driver-routes', slug] }),
          cache.invalidateQueries({ queryKey: ['driver-route-road-path', slug] }),
        ]));
      }).catch(() => undefined);
    }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [slug, profile.data?.duty?.id, trackingDutyId]);
  useEffect(() => () => { trackingIntent.current++; tracking.current = null; }, [slug]);
  return <PortalShell company={company} login={login} primary={page.label} icon={page.icon} settings={false} homeOnExpand map={page.path === 'dashboard'} reading={page.path === 'profile' || page.path === 'messages'} chat={page.path === 'messages'}
    description={page.path === 'profile' ? 'Your details and account security.' : page.path === 'messages' ? 'Your conversation with Dispatch.' : online ? 'Your assigned orders. Open an order to work its stops.' : 'Your assigned orders. Go On Duty to receive and start a route.'}
    navigation={driverPages.map(item => ({ ...item, href: `${base}/${item.path}`, current: item.path === page.path, badge: item.path === 'messages' ? unreadMessages : item.path === 'orders' ? orderUnread : 0 }))}
    footer={collapsed => <div className={`mt-1 flex items-center py-3 ${collapsed ? 'justify-center' : 'justify-between px-3'}`} title={collapsed ? dutyLabel : undefined}>
      <span className={collapsed ? 'sr-only' : `text-sm font-normal ${online ? 'text-app-text' : 'text-slate-700'}`}>{duty.isPending ? (duty.variables ? 'Going on duty…' : 'Going off duty…') : dutyLabel}</span>
      <Switch checked={online} aria-label="Duty status" disabled={!profile.data || duty.isPending} onCheckedChange={next => duty.mutate(next)} />
    </div>}
    headerActions={<NotificationBell slug={slug} surface={page.path === 'dashboard' ? 'white' : true} onOpen={row => { if (row.conversation_id) setNotificationChat(row.conversation_id); else go(base); }} />}
    onNavigate={go} onHome={() => go(base)} onSettings={() => go(`${base}/profile`)} onLogout={onLogout} loggingOut={loggingOut}>
    {page.path !== 'dashboard' && <Notice error={logoutError || dutyError} />}
    {page.path === 'dashboard' ? <DriverDashboard slug={slug} profile={profile.data} profileError={profile.error} error={logoutError || dutyError} online={online} onStartRoute={startRoute} onFinishRoute={finishRoute} fix={fix} shareLocation={shareLocation} locate={locate} /> : page.path === 'profile' ? <DriverProfilePage slug={slug} profile={profile.data} loading={profile.isPending} error={profile.error} /> : page.path === 'messages' ? (profile.error ? <><Notice error={profile.error} /><Button variant="outline" onClick={() => profile.refetch()}>Try again</Button></> : profile.data && <div className="mx-auto flex min-h-0 w-full max-w-[var(--app-reading-width)] flex-1 flex-col"><CompanyChatPage slug={slug} driverId={profile.data.id} company={company} /></div>) : <DriverOrders timeZone={profile.data?.time_zone} slug={slug} online={online} onStartRoute={startRoute} onFinishRoute={finishRoute} />}
    <LiveNotices slug={slug} onOpen={row => { if (row.conversation_id) setNotificationChat(row.conversation_id); else go(base); }} />
    {notificationChat && <NotificationChat key={notificationChat} slug={slug} identity={notificationChat} onClose={() => setNotificationChat(null)} />}
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
  const [form, setForm] = useState({ name: profile.name, phone: profile.phone, address: profile.address.text, avatar_url: profile.avatar_url ?? '' });
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress>();
  const [saved, setSaved] = useState(false);
  const edit = (changes: Partial<typeof form>) => { setSaved(false); setForm(current => ({ ...current, ...changes })); };
  const mutation = useMutation({
    mutationFn: () => operations.updateDriverProfile(slug, { version: profile.version, name: form.name.trim(), phone: form.phone.trim(),
      address: streetAddress(form.address, profile.address, selectedAddress), avatar_url: form.avatar_url }),
    onSuccess: data => { cache.setQueryData(['driver-profile', slug], data); setSaved(true); },
  });
  const unchanged = form.name.trim() === profile.name && form.phone.trim() === profile.phone && form.address.trim() === profile.address.text && !selectedAddress && form.avatar_url === (profile.avatar_url ?? '');
  const onDuty = !!profile.duty;
  return <Card plain title="Driver details" description={`${profile.name} · ${profile.number}`}><form className="space-y-5" onSubmit={event => { event.preventDefault(); setSaved(false); mutation.mutate(); }}>
    <fieldset disabled={mutation.isPending} className="space-y-5">
    <LogoUpload label="Avatar" subject="driver avatar" round value={form.avatar_url} onChange={avatar_url => edit({ avatar_url })}
      aside={<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${onDuty ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
        <span aria-hidden className={`size-1.5 rounded-full ${onDuty ? 'bg-emerald-500' : 'bg-slate-400'}`} />{onDuty ? 'On duty' : 'Off duty'}</span>} />
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Name" required maxLength={160} value={form.name} onChange={event => edit({ name: event.target.value })} />
      <Field label="Email" type="email" disabled value={profile.email} />
      <Field label="Phone" type="tel" required minLength={3} maxLength={50} value={form.phone} onChange={event => edit({ phone: event.target.value })} />
      <Field label="Vehicle" disabled value={profile.vehicle_name ?? 'No vehicle assigned'} />
      <div className="sm:col-span-2"><AddressField label="Address" required maxLength={500} value={form.address} onChange={(address, selected) => { setSelectedAddress(selected); edit({ address }); }} /></div>
    </div>
    </fieldset>
    <Notice error={mutation.error} success={saved ? 'Profile saved.' : undefined} />
    <div className="flex gap-3"><Button loading={mutation.isPending} disabled={mutation.isPending || unchanged}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button></div>
    <p className="text-xs text-slate-500">Contact your dispatcher to change your email or vehicle.</p>
  </form></Card>;
}

function DriverOrders({ timeZone, slug, online, onStartRoute, onFinishRoute }: { timeZone?: string; slug: string; online: boolean; onStartRoute: (route: Route) => Promise<void>; onFinishRoute: (route: Route) => Promise<void> }) {
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
    const date = dateIn(order.scheduled_at, timeZone ?? 'UTC');
    const inDate = dateFilter.kind === 'all' || (dateFilter.kind === 'day' ? date === dateFilter.date : date >= dateFilter.from && date <= dateFilter.to);
    return (!q || text.includes(q)) && inDate && (lifecycle === 'all' || order.status === lifecycle);
  });
  const active = rows.filter(order => ['ASSIGNED', 'IN_PROGRESS'].includes(order.status)).length;
  const delivered = rows.filter(order => ['COMPLETED'].includes(order.status)).length;
  const today = rows.filter(order => dateIn(order.scheduled_at, timeZone ?? 'UTC') === dateIn(new Date().toISOString(), timeZone ?? 'UTC')).length;
  return <div className="space-y-6">
    <Notice error={orders.error || routes.error} />
    {orders.isPending && <p role="status" className="text-sm text-slate-500">Loading orders…</p>}
    {!timeZone && <p role="status">Loading company time zone…</p>}
    {orders.data && timeZone && <>
      <ListSummary label="Orders summary" items={[
        { label: 'Total', value: rows.length, icon: Package },
        { label: 'Active', value: active, icon: Truck },
        { label: 'Today', value: today, icon: Clock },
        { label: 'Delivered', value: delivered, icon: CircleCheck },
      ]} />
      <div className="app-list-toolbar">
        <SearchInput className="app-list-search" value={search} onChange={setSearch} placeholder="Search orders, contacts or addresses..." />
        <div className="app-list-filters">
          <OrderDateFilter value={dateFilter} onValueChange={setDateFilter} today={dateIn(new Date().toISOString(), timeZone ?? 'UTC')} />
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
                <div className="flex items-start gap-1.5 text-slate-500 mt-1"><span className="w-2 h-2 rounded-full bg-app-accent mt-1 flex-none" /><span className="truncate">{drops[drops.length - 1]?.address.text}{drops.length > 1 && ` +${drops.length - 1}`}</span></div>
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
    {detail && timeZone && <DriverOrderDialog timeZone={timeZone} slug={slug} order={detail} orders={rows} route={routes.data?.find(route => route.id === detail.route_id)} online={online} onStartRoute={onStartRoute} onFinishRoute={onFinishRoute} onOpen={setDetailId} onClose={() => setDetailId(null)} />}
  </div>;
}
