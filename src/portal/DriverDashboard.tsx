import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageSquare, Package } from 'lucide-react';
import { allOperations, operations } from '../operations/api';
import { ChatDialog } from '../components/chat/OrderChat';
import { clockTime, dateTime } from '../lib/dateTimeFormat';
import { formatPhone, phoneHref } from '../lib/phone';
import { DriverDashboardMap } from './DriverDashboardMap';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { DriverOrderDialog } from './DriverOrderDialog';
import { DriverStopReportDialog } from './DriverStopReportDialog';
import { driverDayPlan, driverStopStatus, type DriverDayStop, type DriverRoute } from './driverDayPlan';
import type { components } from './schema';
import { Button, Notice } from './ui';

interface Props {
  slug: string;
  profile?: components['schemas']['DriverProfileView'];
  profileError: unknown;
  error: unknown;
  online: boolean;
  onStartRoute: (route: DriverRoute) => Promise<void>;
  onFinishRoute: (route: DriverRoute) => Promise<void>;
}

function StopTimelineItem({ row, index, selected, timeZone, onSelect, onOpen, onChat, onReport }: {
  row: DriverDayStop; index: number; selected: boolean; timeZone: string; onSelect: () => void; onOpen: () => void; onChat: () => void; onReport: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (selected) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [selected]);
  const status = driverStopStatus(row);
  const timestamp = row.visit?.completed_at ?? row.visit?.arrived_at ?? row.visit?.planned_at ?? row.stop.window_start;
  const name = row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery';
  const contactName = row.stop.contact_name || row.order.shipper.name || row.order.shipper.company_name;
  const contactPhone = row.stop.phone || row.order.shipper.phone;
  const phone = phoneHref(contactPhone);
  return <li ref={ref} className={`driver-timeline-stop ${selected ? 'is-selected' : ''}`}>
    <div className="driver-stop-heading">
      <span className={`driver-stop-dot ${selected ? 'is-selected' : ''}`} aria-hidden="true" />
      <button type="button" className="driver-stop-select" aria-pressed={selected} onClick={onSelect}
        aria-label={`Stop ${index + 1}: ${name}, ${row.order.number}, ${row.stop.address.text}`}>
        <span className="driver-stop-title">{name} · {row.order.number}</span>
        <span className={`driver-stop-status ${row.next ? 'is-next' : ''}`}>{status}</span>
      </button>
      <Button type="button" size="xs" variant="link" className="driver-open-order" onClick={onOpen}>Open order</Button>
    </div>
    <button type="button" className="driver-stop-location" onClick={onSelect} aria-label={`Select ${name} ${row.order.number}`}>
      {timestamp ? dateTime(timestamp, timeZone) : 'Time pending'} · {row.stop.address.text}
    </button>
    <div className="driver-stop-contact">
      <span className="driver-stop-contact-name">{contactName || 'Contact not provided'}</span>
      {contactPhone ? (phone ? <a href={phone} className="driver-stop-phone">{formatPhone(contactPhone)}</a> : <span className="driver-stop-phone">{formatPhone(contactPhone)}</span>) : <span className="driver-stop-phone">Phone not provided</span>}
      <Button type="button" size="icon-xs" variant="ghost" className="driver-stop-chat" aria-label={`Chat with shipper for ${row.order.number}`}
        title="Chat with shipper" onClick={onChat}><MessageSquare aria-hidden="true" /></Button>
    </div>
    {(row.stop.window_start || row.stop.window_end) && <p className="driver-stop-window">
      {row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery'} {row.stop.window_start ? `from ${clockTime(row.stop.window_start, timeZone)}` : ''}{row.stop.window_start && row.stop.window_end ? ' · ' : ''}{row.stop.window_end ? `by ${clockTime(row.stop.window_end, timeZone)}` : ''}
    </p>}
    {row.stop.instructions && <p className="driver-stop-instructions">{row.stop.instructions}</p>}
    {(!row.visit || !row.point) && <p className="driver-stop-warning">{!row.visit ? 'Route sequence unavailable.' : 'Map location unavailable.'}</p>}
    <div className="driver-stop-actions">
      <Button type="button" size="xs" variant="outline" className="driver-stop-report"
        aria-label={`Report issue for ${name} ${row.order.number}`}
        disabled={row.order.status === 'COMPLETED'} title={row.order.status === 'COMPLETED' ? 'Completed orders cannot receive reports.' : undefined}
        onClick={onReport}>Report</Button>
    </div>
  </li>;
}

/** Driver-only feeds supply both the map and its accessible stop timeline. */
export function DriverDashboard({ slug, profile, profileError, error, online, onStartRoute, onFinishRoute }: Props) {
  const cache = useQueryClient();
  const panelRef = useRef<HTMLElement>(null);
  const orders = useQuery({ queryKey: ['driver-orders', slug], queryFn: () => operations.driverOrders(slug) });
  const routes = useQuery({ queryKey: ['driver-routes', slug], queryFn: () => allOperations.driverRoutes(slug) });
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString());
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const [selectedId, setSelectedId] = useState<string>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reportStop, setReportStop] = useState<DriverDayStop>();
  const [chatStop, setChatStop] = useState<DriverDayStop>();
  const timeZone = profile?.time_zone;
  const plan = timeZone ? driverDayPlan(orders.data ?? [], routes.data ?? [], timeZone, now) : { orders: [], stops: [] };
  const selected = plan.stops.find(row => row.id === selectedId) ?? plan.stops.find(row => row.next) ?? plan.stops[0];
  const completed = plan.stops.filter(row => driverStopStatus(row) === 'Completed').length;
  const unmapped = plan.stops.filter(row => !row.point).length;
  const detail = orders.data?.find(order => order.id === detailId);
  const pending = orders.isPending || (!timeZone && !profileError);
  const failure = orders.error || profileError;
  return <div className="driver-dashboard">
    <aside ref={panelRef} className="driver-day-panel" aria-label="Today's jobs">
      <div className="driver-day-heading">
        <h2 className="text-sm font-medium">Today’s jobs</h2>
        {!pending && !failure && <p className="mt-1 text-xs text-app-muted" title={timeZone ? `Today in ${timeZone}` : undefined}>{plan.orders.length} {plan.orders.length === 1 ? 'order' : 'orders'} · {plan.stops.length} stops · {completed} completed</p>}
      </div>
      <div className="driver-day-scroll">
        <Notice error={error || failure} />
        {failure ? <Button variant="outline" onClick={() => Promise.all([orders.refetch(), routes.refetch(), cache.invalidateQueries({ queryKey: ['driver-profile', slug] })])}>Try again</Button>
          : pending ? <p role="status" className="text-sm text-app-muted">Loading today's orders…</p>
          : !plan.orders.length ? <div className="driver-day-empty"><Package size={32} className="text-slate-400" /><h3 className="mt-3 font-medium">No orders today</h3><p className="mt-2 text-sm text-app-muted">Orders scheduled for today appear here when dispatch assigns them to you.</p></div>
          : <>
            <Notice error={routes.error} />
            {routes.isPending && <p role="status" className="mb-3 text-sm text-app-muted">Loading route sequence…</p>}
            {routes.error && <Button variant="outline" onClick={() => routes.refetch()}>Retry routes</Button>}
            {unmapped > 0 && <p className="mb-3 flex items-start gap-2 text-sm text-app-muted"><MapPin size={16} className="mt-0.5 shrink-0" />{unmapped} {unmapped === 1 ? 'stop has' : 'stops have'} no map location. All stops remain in the timeline.</p>}
            <ol aria-label="Today's stops" className="driver-stop-timeline">{plan.stops.map((row, index) => <StopTimelineItem key={row.id} row={row} index={index} selected={selected?.id === row.id} timeZone={timeZone!} onSelect={() => setSelectedId(row.id)} onOpen={() => setDetailId(row.order.id)} onChat={() => setChatStop(row)} onReport={() => setReportStop(row)} />)}</ol>
          </>}
      </div>
    </aside>
    <DriverDashboardMap slug={slug} stops={failure ? [] : plan.stops} routes={routes.data ?? []} selectedId={selected?.id} timeZone={timeZone} onSelect={setSelectedId} panelRef={panelRef} />
    {detail && timeZone && <DriverOrderDialog timeZone={timeZone} slug={slug} order={detail} orders={orders.data ?? []} route={routes.data?.find(route => route.id === detail.route_id)} online={online} onStartRoute={onStartRoute} onFinishRoute={onFinishRoute} onOpen={setDetailId} onClose={() => setDetailId(null)} />}
    {reportStop && <DriverStopReportDialog slug={slug} row={reportStop} onClose={() => setReportStop(undefined)} />}
    {chatStop && <ChatDialog slug={slug} orderId={chatStop.order.id} orderNumber={chatStop.order.number} initialKind="DRIVER_SHIPPER" driverOnly onClose={() => setChatStop(undefined)} />}
  </div>;
}
