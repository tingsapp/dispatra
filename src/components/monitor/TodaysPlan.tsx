import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { Job } from '../../types';
import { lifecycleLabel, orderLifecycle } from '../../domain/validation';
import { companyDay, todaysPlan } from './todaysPlan';

interface TodaysPlanProps {
  jobs: Job[];
  attentionIds: ReadonlySet<string>;
  timeZone: string;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onSelectOrder: (job: Job) => void;
}

export function TodaysPlan({ jobs, attentionIds, timeZone, loading, error, onRetry, onSelectOrder }: TodaysPlanProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const refresh = () => setNow(new Date());
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const day = companyDay(now, timeZone);
  const groups = todaysPlan(jobs, day, timeZone, attentionIds);
  const attention = new Set(groups.attention.map(job => job.id));
  return <section aria-label="Today’s plan" className="absolute left-3 top-20 z-20 w-[320px] max-w-[calc(100%_-_1.5rem)] overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm sm:left-6 lg:top-5">
    <header className="px-4 pb-2 pt-3">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Today’s plan</h2>{!loading && !error && groups.all.length > 0 && <span className="text-[11px] tabular-nums text-app-muted">{groups.all.length} {groups.all.length === 1 ? 'order' : 'orders'}</span>}</div>
      <p className="mt-0.5 text-[11px] text-app-muted">{new Intl.DateTimeFormat('en-CA', { timeZone, month: 'short', day: 'numeric' }).format(now)} · Created today</p>
    </header>
    <div>
      {error ? <div role="alert" className="px-4 pb-3 text-xs text-app-muted">Today’s plan is unavailable. <button type="button" className="underline" onClick={onRetry}>Try again</button></div>
        : loading ? <p role="status" className="px-4 pb-3 text-xs text-app-muted">Loading today’s orders…</p>
        : <>
          {groups.all.length === 0 ? <p className="px-4 pb-4 pt-1 text-xs text-app-muted">No orders created today.</p> :
          <ul className="max-h-[min(22rem,45dvh)] divide-y divide-slate-100 overflow-y-auto overscroll-contain px-2 pb-2" aria-label="Orders created today">
            {groups.all.map(job => <li key={job.id}>
              <button type="button" aria-haspopup="dialog" onClick={() => onSelectOrder(job)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-app-hover focus-visible:outline-2 focus-visible:outline-slate-500">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{job.jobNumber}</span>
                    <span className={`shrink-0 text-[11px] ${orderLifecycle(job) === 'COMPLETED' ? 'text-emerald-700' : 'text-app-muted'}`}>{orderLifecycle(job) === 'NEW' ? 'Unassigned' : lifecycleLabel(job)}</span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs text-app-muted">{job.customerName}{job.driverName ? ` · ${job.driverName}` : ''}</span>
                    {attention.has(job.id) && <span className="shrink-0 text-amber-600" aria-label="Needs attention" title="Needs attention"><AlertTriangle size={12} aria-hidden="true" /></span>}
                  </span>
                </span>
                <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-slate-400" />
              </button>
            </li>)}
          </ul>}

        </>}
    </div>
  </section>;
}
