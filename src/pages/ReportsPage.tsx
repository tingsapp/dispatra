import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, PackageCheck, PackageX, Truck } from 'lucide-react';
import { ListSummary } from '../components/layout/ListSummary';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { AnalyticsCharts } from '../components/analytics/AnalyticsCharts';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { prototypeAnalytics } from '../lib/reportStorage';
import { companySettingsKey } from '../portal/WorkspaceAccount';
import { api } from '../portal/api';
import { operations } from '../operations/api';
import { analyticsBounds } from '../operations/analyticsAdapters';

interface ReportsPageProps { today?: string }
export function ReportsPage({ today }: ReportsPageProps) {
  const slug = companySlugForCurrentPath();
  const [dateFilter, setDateFilter] = useState<OrderDateSelection>({ kind: 'all' });
  const settings = useQuery({ queryKey: companySettingsKey(slug!), queryFn: () => api.companySettings(slug!), enabled: !!slug });
  const timeZone = settings.data?.data.time_zone ?? 'America/Vancouver';
  const bounds = analyticsBounds(dateFilter, timeZone);
  const query = useQuery({ queryKey: ['operations', slug, 'analytics', bounds.start, bounds.end], queryFn: () => operations.analytics(slug!, bounds.start, bounds.end), enabled: !!slug && !!settings.data });
  const data = slug ? query.data : prototypeAnalytics(bounds.start, bounds.end);
  const error = settings.error ?? query.error;
  const failed = !!slug && !!error;
  const loading = !!slug && !failed && !data;
  const companyToday = today ?? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
    <PageHeader title="Analytics" description="A clear view of your delivery performance." actions={<>
      <OrderDateFilter value={dateFilter} onValueChange={setDateFilter} today={companyToday} subject="analytics" />
    </>} />
    <div className="page-content flex-1 overflow-y-auto py-5">
      {failed ? <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-700">{error.message}</p><Button variant="outline" className="mt-3" onClick={() => { void settings.refetch(); void query.refetch(); }}>Try again</Button></div>
        : loading ? <div role="status" className="space-y-4"><span className="text-sm text-slate-500">Loading analytics…</span><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /></div>
        : data && <div className="space-y-5">
          <ListSummary label="Analytics summary" items={[
            { label: 'Total', value: data.orders, icon: Package },
            { label: 'In progress', value: data.statuses.IN_PROGRESS ?? 0, icon: Truck },
            { label: 'Completed', value: data.completed_orders, icon: PackageCheck },
            { label: 'Canceled', value: data.statuses.CANCELLED ?? 0, icon: PackageX },
          ]} />
          {query.isFetching && <span role="status" className="sr-only">Updating analytics…</span>}
          <AnalyticsCharts data={data} filter={dateFilter} timeZone={timeZone} />
        </div>}
    </div>
  </div>;
}
