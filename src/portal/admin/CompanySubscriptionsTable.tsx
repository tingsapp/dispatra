import { useDeferredValue, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type CompanySubscription, type SubscriptionFilter } from '../api';
import { Button, Field } from '../ui';
import { Select } from '../../components/ui/Select';
import { QueryState, StatusBadge } from './QueryState';
import { subscriptionsKey } from './queryKeys';
import { formatWhen } from './format';
import { subscriptionLabels, subscriptionMoney } from './subscriptionFormat';

export function CompanySubscriptionsTable({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CompanySubscription['status'] | ''>('');
  const deferredSearch = useDeferredValue(search);
  const filter: SubscriptionFilter = { search: deferredSearch, status: status || undefined };
  const query = useInfiniteQuery({ queryKey: subscriptionsKey(filter), queryFn: ({ pageParam }) => api.companySubscriptions(filter, pageParam),
    initialPageParam: undefined as string | undefined, getNextPageParam: last => last.length === 50 ? last[last.length - 1].organization_id : undefined, refetchInterval: 30_000 });
  const rows = query.data?.pages.flat() ?? [];
  return <section aria-label="Company subscriptions" className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
      <Field label="Search company subscriptions" type="search" maxLength={100} placeholder="Company name or identifier" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="grid gap-1.5 text-sm text-slate-700"><span>Filter subscription status</span><Select aria-label="Filter subscription status" value={status} onValueChange={value => setStatus(value as typeof status)} options={[{ value: '', label: 'All subscriptions' }, ...Object.entries(subscriptionLabels).map(([value, label]) => ({ value, label }))]} /></div>
    </div>
    <QueryState query={query} loading="Loading company subscriptions…" />
    {!!rows.length && <div className="app-table-shell overflow-x-auto"><table className="app-table text-left" aria-label="Company subscriptions" aria-busy={query.isFetching}>
      <thead><tr><th>Company</th><th>Subscription</th><th>Price per vehicle per month</th><th>Starts</th><th>Trial status</th><th>Trial ends</th><th>Access</th><th>Action</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.organization_id}>
        <td><div className="font-medium">{row.company_name}</div><div className="text-xs text-app-muted">{row.company_slug}</div></td>
        <td className="whitespace-nowrap">{row.status === 'ACTIVE' && !row.contributing ? 'Scheduled' : subscriptionLabels[row.status]}</td>
        <td className="whitespace-nowrap">{subscriptionMoney(row.monthly_price, row.currency)}</td>
        <td className="whitespace-nowrap text-app-muted">{row.starts_on ?? '—'}</td>
        <td className="whitespace-nowrap">{!row.trial_ends_at ? 'No trial' : row.trial_activated_at ? 'Activated' : new Date(row.trial_ends_at).getTime() <= Date.now() ? 'Trial ended' : 'Free trial'}</td>
        <td className="whitespace-nowrap text-app-muted">{formatWhen(row.trial_ends_at, '—')}</td>
        <td><StatusBadge active={row.workspace_active} inactiveLabel="Suspended" /></td>
        <td><a href={`/admin/companies/${row.organization_id}/subscription`} aria-label={`Manage ${row.company_name} subscription`} className="text-app-text underline-offset-4 hover:underline" onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); onOpen(row.organization_id);
        }}>Manage</a></td>
      </tr>)}</tbody>
    </table></div>}
    {query.data && !rows.length && <p className="py-6 text-sm text-app-muted">{search || status ? 'No company subscriptions match these filters.' : 'No companies yet. Company subscriptions will appear here.'}</p>}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more subscriptions'}</Button>}
  </section>;
}
