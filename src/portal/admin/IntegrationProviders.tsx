import { useQuery } from '@tanstack/react-query';
import { integrationAdmin, integrationKeys } from '../../integrations/admin';
import { QueryState } from './QueryState';

export function IntegrationProviders() {
  const query = useQuery({ queryKey: [...integrationKeys, 'providers'], queryFn: integrationAdmin.providers, refetchInterval: 30_000 });
  return <section aria-label="TMS connectors" className="space-y-4">
    <QueryState query={query} loading="Loading connectors…" />
    {query.data?.length === 0 && <p className="text-sm text-app-muted">No connectors listed yet.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{query.data?.map(row => <article key={row.id} aria-label={row.name} className="app-panel min-w-0 space-y-5">
      <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-app-hover text-xs font-semibold">{row.initials}</span><h2 className="app-section-title">{row.name}</h2></div>
      <dl><dt className="text-sm text-app-muted">Connected dispatchers</dt><dd className="mt-1 text-3xl font-medium tabular-nums">{row.connected_dispatchers}</dd></dl>
    </article>)}</div>
  </section>;
}
