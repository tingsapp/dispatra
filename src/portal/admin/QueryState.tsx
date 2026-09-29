import { Button, Notice } from '../ui';

type QueryLike = { isPending: boolean; isError: boolean; isRefetchError: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };

/** Loading, first-load error, and stale-data states shared by the owner pages. */
export function QueryState({ query, loading }: { query: QueryLike; loading: string }) {
  if (query.isPending && !query.isError) return <p role="status" className="text-sm text-app-muted">{loading}</p>;
  if (query.isRefetchError) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
    <span>Showing previously loaded data. The latest refresh failed: {query.error instanceof Error ? query.error.message : 'unknown error'}</span>
    <Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Retry</Button>
  </div>;
  if (query.isError) return <div className="space-y-3"><Notice error={query.error} /><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  return null;
}

export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel }: { active: boolean; activeLabel?: string; inactiveLabel: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-500'}`} />{active ? activeLabel : inactiveLabel}
  </span>;
}
