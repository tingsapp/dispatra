import { Driver, Job } from '../../types';
import { lifecycleLabel } from '../../domain/validation';
import { loadBillingConfig } from '../../lib/billingStorage';
import { formatWhen } from '../orders/OrderDossierSections';

const when = (job: Job) => job.completedAt ?? job.pricingInput?.scheduledAt ?? job.createdAt ?? '';

/** Every order assigned to this driver, newest first. */
const ordersFor = (driver: Driver, jobs: Job[]) => jobs
  .filter(job => job.assignedDriverId === driver.id)
  .sort((a, b) => when(b).localeCompare(when(a)));

export function DriverOrders({ driver, jobs, timeZone = loadBillingConfig().general.timeZone, onSelectJob }: { driver: Driver; jobs: Job[]; timeZone?: string; onSelectJob?: (jobNumber: string) => void }) {
  const rows = ordersFor(driver, jobs);
  return <section aria-label="Driver orders" className="space-y-3 text-sm">
    <p className="text-xs text-slate-500">{rows.length} order{rows.length === 1 ? '' : 's'}</p>
    {rows.length ? <ul className="space-y-2">{rows.map(job => <li key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs">
      <div className="min-w-0"><div className="font-medium text-slate-900">{job.jobNumber} · {lifecycleLabel(job)}</div><div className="text-slate-700 truncate">{job.customerName}</div><div className="text-slate-500 truncate">{job.pickupAddress.split(',')[0]} → {job.dropoffAddress.split(',')[0]}</div></div>
      <div className="shrink-0 text-right"><div className="text-slate-500 whitespace-nowrap">{job.completedAt ? `Completed ${formatWhen(job.completedAt, timeZone)}` : formatWhen(job.pricingInput?.scheduledAt ?? job.scheduledTime, timeZone)}</div>
        {onSelectJob && <button type="button" onClick={() => onSelectJob(job.jobNumber)} className="mt-1 rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200">View &rarr;</button>}</div>
    </li>)}</ul> : <p className="text-xs text-slate-500">No orders assigned to this driver.</p>}
  </section>;
}
