import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { SearchInput } from '../ui/SearchInput';
import { MonitorBadge } from './MonitorBadge';
import { OrderMapCheckbox, type OrderMapVisibilityProps } from './OrderMapCheckbox';
import { clockTime, dateTime } from '../../lib/dateTimeFormat';
import type { Driver, Job } from '../../types';
import { lifecycleLabel, orderLifecycle } from '../../domain/validation';
import { companyDay, todaysPlan } from './todaysPlan';

interface TodaysPlanProps extends OrderMapVisibilityProps {
  onOpenAllOrders?: () => void;
  chatOpen?: boolean;
  onCloseChat?: () => void;
  jobs: Job[];
  drivers?: Driver[];
  attentionIds: ReadonlySet<string>;
  timeZone: string;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onSelectOrder: (job: Job) => void;
}

export function TodaysPlan({ drivers = [], hiddenOrderIds, onOrderVisibilityChange, onOpenAllOrders, chatOpen = false, onCloseChat, jobs, attentionIds, timeZone, loading, error, onRetry, onSelectOrder }: TodaysPlanProps) {
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState(false);
  const contentId = useId();
  const expanded = !hidden && !chatOpen;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const refresh = () => setNow(new Date());
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const day = companyDay(now, timeZone);
  const displayTime = (value: string) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && companyDay(parsed, timeZone) === day
      ? clockTime(value, timeZone) : dateTime(value, timeZone);
  };
  const groups = todaysPlan(jobs, day, timeZone, attentionIds);
  const query = search.trim().toLowerCase();
  const visibleOrders = groups.all.filter(job => [job.jobNumber, job.customerName, job.dropoffAddress, job.pickupAddress, job.driverName, drivers.find(driver => driver.id === job.assignedDriverId)?.name].some(value => value?.toLowerCase().includes(query)));
  const attention = new Set(groups.attention.map(job => job.id));
  return <section aria-label="Today’s plan" className="absolute left-3 top-20 z-20 w-[min(26rem,calc(100vw_-_112px))] max-w-[calc(100%_-_1.5rem)] overflow-hidden app-map-menu rounded-2xl border border-app-border bg-white shadow-sm sm:left-6 lg:top-5">
    <header className="px-4 pb-2 pt-3">
      <button type="button" aria-expanded={expanded} aria-controls={expanded ? contentId : undefined}
        onClick={() => { if (expanded) setHidden(true); else { setHidden(false); onCloseChat?.(); } }}
        className="flex w-full items-center justify-between gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-slate-500">
        <span className="flex items-center gap-2"><span className="text-sm font-medium">Today’s plan</span>{!loading && !error && <MonitorBadge>{groups.all.length}</MonitorBadge>}</span>
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      <p className="mt-0.5 text-[11px] text-app-muted">{new Intl.DateTimeFormat('en-CA', { timeZone, month: 'short', day: 'numeric' }).format(now)} · Created today{!loading && !error && groups.unassigned.length > 0 && ` · ${groups.unassigned.length} unassigned`}</p>
    </header>
    {expanded && <div id={contentId}>
      {!loading && !error && groups.all.length > 0 && <div className="px-3 pb-2"><SearchInput value={search} onChange={setSearch} placeholder="Search orders, shippers or addresses..." aria-label="Search today’s orders" /></div>}
      {error ? <div role="alert" className="px-4 pb-3 text-xs text-app-muted">Today’s plan is unavailable. <button type="button" className="underline" onClick={onRetry}>Try again</button></div>
        : loading ? <p role="status" className="px-4 pb-3 text-xs text-app-muted">Loading today’s orders…</p>
        : <>
          {groups.all.length === 0 ? <p className="px-4 pb-4 pt-1 text-xs text-app-muted">No orders created today.</p> :
          visibleOrders.length === 0 ? <p className="px-4 py-6 text-center text-xs text-slate-400">No matching orders found.</p> :
          <ul className="max-h-[min(34rem,60dvh)] overflow-y-auto overscroll-contain px-3 pb-2" aria-label="Orders created today">
            {visibleOrders.map(job => {
              const drop = job.pricingInput?.stops.find(stop => stop.type === 'DROPOFF');
              const deliveryTime = drop?.windowEnd ?? drop?.windowStart;
              const when = deliveryTime ? `Due ${displayTime(deliveryTime)}` :
                job.pricingInput?.scheduledAt || job.scheduledTime ? `Scheduled ${displayTime(job.pricingInput?.scheduledAt || job.scheduledTime)}` : 'Delivery time not set';
              const driverName = drivers.find(driver => driver.id === job.assignedDriverId)?.name ?? job.driverName;
              const statusLabel = orderLifecycle(job) === 'COMPLETED' ? lifecycleLabel(job) : job.statusLabel || (orderLifecycle(job) === 'NEW' ? 'Unassigned' : lifecycleLabel(job));
              const driverLabel = driverName ? `Driver: ${driverName}` : job.assignedDriverId ? 'Driver assigned' : /^(no driver|unassigned)$/i.test(statusLabel.trim()) ? undefined : 'No driver';
              return <li key={job.id} className="flex items-start rounded-xl hover:bg-slate-50">
              {!['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job)) && <OrderMapCheckbox job={job} hiddenOrderIds={hiddenOrderIds} onOrderVisibilityChange={onOrderVisibilityChange} />}
              <button type="button" aria-haspopup="dialog" onClick={() => onSelectOrder(job)}
                className="group min-w-0 flex-1 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-slate-500">
                <span className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 text-xs font-medium text-slate-900">{job.jobNumber}</span>
                  </span>
                  <MonitorBadge tone={job.status === 'at_risk' ? 'danger' : job.status === 'late_start' ? 'warning' : job.status === 'no_driver' ? 'neutral' : 'success'}>
                    {statusLabel}
                  </MonitorBadge>
                  {attention.has(job.id) && <span className="shrink-0 text-amber-600" aria-label="Needs attention" title="Needs attention"><AlertTriangle size={12} aria-hidden="true" /></span>}
                </span>
                <span className="mb-0.5 flex min-w-0 items-baseline gap-1.5 text-xs text-slate-600">
                  <span className="shrink-0" title={when}>{when}</span>{driverLabel && <><span aria-hidden="true">·</span><span title={driverLabel} className={`truncate ${job.assignedDriverId || driverName ? '' : 'font-medium text-amber-700'}`}>{driverLabel}</span></>}
                </span>
                <span className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex min-w-0 flex-1 items-baseline gap-1.5 pr-2">
                    <span className="min-w-0 flex-1 truncate" title={job.dropoffAddress}><span className="font-medium text-slate-600">To:</span> {job.dropoffAddress || 'Destination not set'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="max-w-[40%] truncate" title={job.customerName}>{job.customerName || 'Customer not set'}</span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700" />
                </span>
              </button>
            </li>;})}
          </ul>}
          {groups.all.length > 0 && <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2.5 text-xs">
            {onOrderVisibilityChange && <span className="text-slate-500">Check orders to show on map</span>}
            {onOpenAllOrders && <button type="button" onClick={onOpenAllOrders} className="ml-auto shrink-0 font-medium text-slate-700 hover:text-slate-950">View full list →</button>}
          </div>}

        </>}
    </div>}
  </section>;
}
