import { useEffect, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleCheck, CirclePause } from 'lucide-react';
import { api, type CompanyFilter } from '../api';
import { Button, CredentialCard, type Credentials } from '../ui';
import { SearchInput } from '../../components/ui/SearchInput';
import { ListSummary } from '../../components/layout/ListSummary';
import { QueryState, StatusBadge } from './QueryState';
import { CreateCompanyDialog } from './CreateCompanyDialog';
import { formatWhen } from './format';
import { companiesKey } from './queryKeys';

type Status = NonNullable<CompanyFilter['status']> | 'ALL';

export function CompaniesPage({ creating, onCreatingChange, onOpen }: { creating: boolean; onCreatingChange: (open: boolean) => void; onOpen: (id: string) => void }) {
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<Status>('ALL');
  const [credentials, setCredentials] = useState<Credentials>();
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const filter: CompanyFilter = { search: debounced || undefined, status: status === 'ALL' ? undefined : status };
  const query = useInfiniteQuery({ queryKey: companiesKey(filter), queryFn: ({ pageParam }) => api.organizations(filter, pageParam), placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined, getNextPageParam: last => last.length === 50 ? last[last.length - 1].id : undefined });
  const rows = query.data?.pages.flat() ?? [];
  const filtered = Boolean(filter.search || filter.status);
  return <div className="space-y-6">
    {credentials && <CredentialCard value={credentials} onDismiss={() => setCredentials(undefined)} />}
    {creating && <CreateCompanyDialog onClose={() => onCreatingChange(false)} onCreated={(org, submitted) => {
      setCredentials({ url: `${location.origin}/${org.slug}/`, login: submitted.admin_login, password: submitted.password });
      onCreatingChange(false); cache.invalidateQueries({ queryKey: companiesKey() });
    }} />}
    {!filtered && query.data && <ListSummary label="Companies summary" items={[
      { label: 'Loaded companies', value: rows.length, icon: Building2 },
      { label: 'Active', value: rows.filter(c => c.active).length, icon: CircleCheck },
      { label: 'Suspended', value: rows.filter(c => !c.active).length, icon: CirclePause },
    ]} />}
    <div className="app-list-toolbar">
      <SearchInput className="app-list-search" value={search} onChange={setSearch} placeholder="Search by company name or identifier" aria-label="Search companies" />
      <div className="app-list-filters"><div className="app-list-status" role="group" aria-label="Company status">
        {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map(value => <button key={value} type="button" className="app-tab inline-flex items-center gap-2 whitespace-nowrap" aria-pressed={status === value} onClick={() => setStatus(value)}>{value === 'ALL' ? 'All' : value === 'ACTIVE' ? 'Active' : 'Suspended'}</button>)}
      </div></div>
    </div>
    <QueryState query={query} loading="Loading companies…" />
    {rows.length > 0 && <div className="app-table-shell overflow-x-auto">
      <table className="app-table text-left" aria-label="Dispatch companies" aria-busy={query.isFetching}>
        <thead><tr><th>Company</th><th>Workspace</th><th>Status</th><th>Dispatchers</th><th>Created</th><th>Action</th></tr></thead>
        <tbody>{rows.map(org => <tr key={org.id}>
          <td className="font-medium">{org.name}</td>
          <td className="text-app-muted">/{org.slug}/</td>
          <td><StatusBadge active={org.active} inactiveLabel="Suspended" /></td>
          <td>{org.active_dispatcher_count} active{org.dispatcher_count > org.active_dispatcher_count ? ` · ${org.dispatcher_count - org.active_dispatcher_count} inactive` : ''}</td>
          <td className="text-app-muted">{formatWhen(org.created_at)}</td>
          <td><a href={`/admin/companies/${org.id}`} className="text-app-text hover:underline underline-offset-4" aria-label={`Manage ${org.name}`}
            onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(org.id); }}>Manage</a></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {query.data && rows.length === 0 && <div className="py-10 text-center">
      <p className="text-sm text-app-muted">{filtered ? 'No companies match these filters.' : 'No companies yet. Add your first dispatch company.'}</p>
      {!filtered && <Button className="mt-4" onClick={() => onCreatingChange(true)}>Add company</Button>}
    </div>}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>}
  </div>;
}
