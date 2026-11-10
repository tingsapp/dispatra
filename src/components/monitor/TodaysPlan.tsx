import { ActionButton } from '../ui/button';
import { type CSSProperties, useEffect, useId, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { SearchInput } from '../ui/SearchInput';
import { MonitorBadge } from './MonitorBadge';
import { OrderMapCheckbox, type OrderMapVisibilityProps } from './OrderMapCheckbox';
import { clockTime, dateTime } from '../../lib/dateTimeFormat';
import type { Driver, Job, NeedsAttentionItem } from '../../types';
import { lifecycleLabel, orderAttention, orderLifecycle } from '../../domain/validation';
import { companyDay, todaysPlan } from './todaysPlanData';
import { OrderMapFocusButton } from './OrderMapFocusButton';

interface TodaysPlanProps extends OrderMapVisibilityProps {
  attentionItems?: NeedsAttentionItem[];
  onLocateOrder?: (job: Job) => void;
  onAssignOrder?: (job: Job, anchor: HTMLButtonElement) => void;
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

export function TodaysPlan({ attentionItems = [], onLocateOrder, onAssignOrder, drivers = [], hiddenOrderIds, onOrderVisibilityChange, chatOpen = false, onCloseChat, jobs, attentionIds, timeZone, loading, error, onRetry, onSelectOrder }: TodaysPlanProps) {
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned' | 'in_progress' | 'completed' | 'attention'>('all');
  const [warningId, setWarningId] = useState<string | null>(null);
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
  const visibleOrders = groups[filter].filter(job => [job.jobNumber, job.customerName, job.dropoffAddress, job.pickupAddress, job.driverName, drivers.find(driver => driver.id === job.assignedDriverId)?.name].some(value => value?.toLowerCase().includes(query)));
  const attention = new Set(groups.attention.map(job => job.id));
  return <section aria-label="Today’s plan" className="absolute left-3 top-20 z-20 w-[min(26rem,calc(100vw_-_112px))] max-w-[calc(100%_-_1.5rem)] overflow-hidden app-map-menu rounded-2xl border border-app-border bg-white shadow-sm sm:left-6 lg:top-5">
    <header className="px-4 pb-3 pt-4">
      <button type="button" aria-expanded={expanded} aria-controls={expanded ? contentId : undefined}
        onClick={() => { if (expanded) setHidden(true); else { setHidden(false); onCloseChat?.(); } }}
        className="flex w-full items-center justify-between gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-slate-500">
        <span className="flex items-center gap-2"><span className="text-sm font-medium">Today’s plan</span>{!loading && !error && <MonitorBadge>{groups.all.length}</MonitorBadge>}</span>
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
      <p className="mt-1 text-[11px] text-app-muted">{new Intl.DateTimeFormat('en-CA', { timeZone, month: 'short', day: 'numeric' }).format(now)} · Created today{!loading && !error && groups.unassigned.length > 0 && ` · ${groups.unassigned.length} unassigned`}</p>
    </header>
    {expanded && <div id={contentId}>
      {!loading && !error && groups.all.length > 0 && <div className="px-4 pb-3"><SearchInput value={search} onChange={setSearch} placeholder="Search orders, shippers or addresses..." aria-label="Search today’s orders" /></div>}
      {!loading && !error && <div role="tablist" aria-label="Filter today’s orders" className="flex gap-0.5 overflow-x-auto border-b border-slate-100 px-3 pb-3">
        {([['all', 'All'], ['unassigned', 'New'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['attention', 'At risk']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-slate-500 ${filter === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>}
      {error ? <div role="alert" className="px-4 pb-3 text-xs text-app-muted">Today’s plan is unavailable. <ActionButton type="button" className="underline" onClick={onRetry}>Try again</ActionButton></div>
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
              const statusLabel = lifecycleLabel(job);
              const canAssign = !!onAssignOrder && !['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job));
              const assignLabel = job.assignedDriverId || orderLifecycle(job) === 'ASSIGNED' ? 'Reassign' : 'Assign';
              const warningAnchor = `--warning-${contentId}-${job.id}`.replace(/[^a-zA-Z0-9-]/g, '');
              const warningDetails = [...attentionItems.filter(item => item.jobNumber === job.jobNumber).map(item => ({ label: item.statusLabel, detail: item.subtitle })), ...orderAttention(job)];
              const driverLabel = driverName ? `Driver: ${driverName}` : job.assignedDriverId ? 'Driver assigned' : onAssignOrder && orderLifecycle(job) === 'NEW' || /^(no driver|unassigned)$/i.test((job.statusLabel || statusLabel).trim()) ? undefined : 'No driver';
              return <li key={job.id} className="flex items-start gap-1 py-2.5 first:pt-2 rounded-lg shadow-none hover:bg-slate-50">
              {!['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job)) && <div className="flex w-9 shrink-0 flex-col items-center">
                <OrderMapCheckbox job={job} hiddenOrderIds={hiddenOrderIds} onOrderVisibilityChange={onOrderVisibilityChange} />
                {onLocateOrder && <OrderMapFocusButton job={job} onLocate={() => onLocateOrder(job)} />}
              </div>}
              <div className="relative min-w-0 flex-1">
              <button type="button" aria-haspopup="dialog" onClick={() => onSelectOrder(job)}
                className="group w-full min-w-0 flex-1 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-slate-500">
                <span className={`mb-0.5 flex min-w-0 items-center justify-between gap-2 ${canAssign ? 'pr-16' : ''}`}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 text-xs font-medium text-slate-900">{job.jobNumber}</span>
                  <MonitorBadge tone={job.status === 'at_risk' ? 'danger' : job.status === 'late_start' ? 'warning' : job.status === 'no_driver' ? 'neutral' : 'success'}>
                    {statusLabel}
                  </MonitorBadge>
                  {attention.has(job.id) && <span className="size-5 shrink-0" style={{ anchorName: warningAnchor } as CSSProperties} aria-hidden="true" />}
                  </span>
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
              {attention.has(job.id) && <button type="button" aria-label="Needs attention" title={`Warnings for ${job.jobNumber}`} aria-expanded={warningId === job.id}
                onClick={() => setWarningId(current => current === job.id ? null : job.id)}
                style={{ positionAnchor: warningAnchor, left: 'anchor(left)', top: 'anchor(top)' } as CSSProperties}
                className="absolute flex size-5 items-center justify-center rounded text-xs text-amber-600 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-slate-500"><AlertTriangle size={12} aria-hidden="true" /></button>}
              {warningId === job.id && attention.has(job.id) && <div role="region" aria-label={`Warnings for ${job.jobNumber}`} className="mx-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <p className="mb-1 font-medium">{job.jobNumber} · Needs attention</p>
                {warningDetails.length ? [...new Map(warningDetails.map(item => [`${item.label}:${item.detail ?? ''}`, item])).values()].map((item, index) => <p key={index}>{item.label}{item.detail ? `: ${item.detail}` : ''}</p>) : <p>{job.riskText || 'This order has an active operational warning. Open order details for more information.'}</p>}
              </div>}
              {canAssign && <button type="button" aria-label={`${assignLabel} ${job.jobNumber}`} aria-haspopup="dialog" onClick={event => onAssignOrder?.(job, event.currentTarget)} className="absolute right-2 top-2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] leading-4 font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500">{assignLabel}</button>}
              </div>
            </li>;})}
          </ul>}


        </>}
    </div>}
  </section>;
}
