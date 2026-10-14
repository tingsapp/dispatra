import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { QueryState } from './QueryState';
import { CompanySubscriptionsTable } from './CompanySubscriptionsTable';
import { revenueKey } from './queryKeys';
import { subscriptionMoney } from './subscriptionFormat';

export function PlatformRevenuePage({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const query = useQuery({ queryKey: revenueKey, queryFn: api.platformRevenue, refetchInterval: 30_000 });
  const revenue = query.data;
  return <div className="space-y-8">
    <QueryState query={query} loading="Loading revenue…" />
    {revenue && <>
      {!!revenue.currencies.length && <div className="grid gap-4 lg:grid-cols-2">{revenue.currencies.map(row => <section key={row.currency} aria-label={`${row.currency} recurring revenue`} className="app-panel">
          <h3 className="font-medium">{row.currency}</h3>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-app-muted">Monthly recurring revenue</dt><dd className="mt-2 break-words text-2xl font-semibold">{subscriptionMoney(row.monthly_recurring_revenue, row.currency)}</dd></div>
            <div><dt className="text-sm text-app-muted">Annualized projection</dt><dd className="mt-2 break-words text-2xl font-semibold">{subscriptionMoney(row.annualized_revenue, row.currency)}</dd></div>
          </dl><p className="mt-4 text-xs text-app-muted">{row.active_subscriptions} active {row.active_subscriptions === 1 ? 'subscription' : 'subscriptions'}</p>
        </section>)}</div>}
      <dl aria-label="Platform subscription totals" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="app-panel min-w-0"><dt className="text-xs text-app-muted">Total</dt>
          <dd aria-label="Total monthly revenue" className="mt-2 space-y-1 break-words text-xl font-semibold">
            {revenue.currencies.length ? revenue.currencies.map(row => <span key={row.currency} className="block">{subscriptionMoney(row.monthly_recurring_revenue, row.currency)}</span>) : '0.00'}
          </dd>
        </div>
        {[
        ['Companies', revenue.total_companies], ['Active subscriptions', revenue.active_subscriptions],
        ['Not subscribed', revenue.not_subscribed], ['Paused', revenue.paused_subscriptions], ['Cancelled', revenue.cancelled_subscriptions],
      ].map(([label, value]) => <div key={label} className="app-panel"><dt className="text-xs text-app-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>
    </>}
    <CompanySubscriptionsTable onOpen={onOpenCompany} />
  </div>;
}
