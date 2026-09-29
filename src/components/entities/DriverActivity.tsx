import { useQuery } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { operations } from '../../operations/api';
import { Driver, Job } from '../../types';
import { orderLifecycle } from '../../domain/validation';
import { loadBillingConfig } from '../../lib/billingStorage';
import { connectivity } from '../../lib/driverStorage';
import { ReadFields } from './Fields';

const money = (amount: number, currency: string) => new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
const completed = (job: Job) => ['COMPLETED', 'INVOICED'].includes(orderLifecycle(job));

/** Read-only activity and the order-linked payout estimates already recorded for this driver. */
export function DriverActivity({ driver, jobs }: { driver: Driver; jobs: Job[] }) {
  const slug = companySlugForCurrentPath();
  const activityQuery = useQuery({ queryKey: ['operations', slug, 'driver-activity', driver.id], queryFn: () => operations.driverActivity(slug!, driver.id), enabled: !!slug });
  const activity = activityQuery.data;
  const currency = loadBillingConfig().invoicing.currency;
  const ownerOperator = driver.employmentType === 'CONTRACTOR';
  const rows = jobs.filter(job => job.assignedDriverId === driver.id && completed(job));
  const recorded = ownerOperator ? rows.map(job => job.driverPayout).filter(payout => payout?.driverId === driver.id) : [];
  const totals = new Map<string, number>();
  for (const payout of recorded) if (payout) totals.set(payout.currency, (totals.get(payout.currency) ?? 0) + payout.total);
  const totalLabel = totals.size ? [...totals].map(([unit, amount]) => money(amount, unit)).join(' · ') : rows.length ? 'Estimate unavailable' : money(0, currency);
  const missing = ownerOperator ? rows.length - recorded.length : 0;
  // Show the route by its orders' public numbers, not its internal ID.
  const routeId = activity?.current_route ?? (slug ? undefined : driver.routeId);
  const routeOrders = routeId ? jobs.filter(job => job.routeId === routeId).map(job => job.jobNumber) : [];
  const currentRoute = routeId ? routeOrders.length ? routeOrders.join(', ') : 'Planned route' : undefined;

  return <section aria-label="Activity & Earnings" className="space-y-4 text-sm">
    <h3 className="app-section-title">Activity & Earnings</h3>
    {ownerOperator ? <p className="text-xs text-slate-500">Payouts use each completed order’s saved share percentages and priced freight, service and fuel amounts. They are estimates; payment status is not tracked here.{missing ? ` ${missing} completed order${missing === 1 ? '' : 's'} ${missing === 1 ? 'has' : 'have'} no saved payout estimate.` : ''}</p>
      : <p className="text-xs text-slate-500">Employee pay is not tracked here.</p>}
    <ReadFields values={{
      'App connectivity': activity ? activity.app_connectivity : slug ? 'Unknown' : connectivity(driver.appLastSeenAt),
      'App last seen': activity?.app_last_seen ?? (slug ? undefined : driver.appLastSeenAt),
      'GPS captured': activity?.gps_captured ?? (slug ? undefined : driver.locationCapturedAt),
      'Location permission': activity?.location_permission ?? (slug ? 'UNKNOWN' : driver.locationPermissionStatus ?? 'UNKNOWN'),
      'Current route': currentRoute,
    }} />
    <div className="flex flex-wrap gap-2">
      <div className="w-44 max-w-full rounded-lg border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">Orders completed</p><p className="mt-0.5 text-lg font-medium text-slate-900">{activity?.completed_orders ?? (slug ? '—' : rows.length)}</p></div>
      {ownerOperator && <div className="w-44 max-w-full rounded-lg border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">Estimated earnings</p><p className="mt-0.5 text-lg font-medium text-slate-900">{activity ? activity.estimated_payout == null ? 'Estimate unavailable' : money(Number(activity.estimated_payout), currency) : slug ? '—' : totalLabel}</p></div>}
    </div>
  </section>;
}
