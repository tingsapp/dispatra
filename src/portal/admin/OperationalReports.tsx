import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type OperationalIncident } from '../api';
import { Button, Notice } from '../ui';
import { QueryState } from './QueryState';
import { agentKeys } from './queryKeys';
import { MonitorPagination, useMonitorPages } from './MonitorPagination';
import { formatWhen } from './format';

const certainty = { OBSERVED: 'Recorded fact', PREDICTED: 'Prediction', REPORTED: 'Reported by a person', NEEDS_CONFIRMATION: 'Needs confirmation' };
const evidenceValue = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)) ? formatWhen(value) : value;
const status = { OPEN: 'Needs attention', ACKNOWLEDGED: 'Acknowledged · still open', RESOLVED: 'Resolved', SUPERSEDED: 'Plan changed' };
export function OperationalReports({ accountId }: { accountId: string }) {
  const [history, setHistory] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const pages = useMonitorPages();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: [...agentKeys, 'operational', accountId, history, pages.before], queryFn: () => api.operationalIssues(history ? 'ALL' : 'OPEN', pages.before), refetchInterval: pages.before ? false : 5_000 });
  const acknowledge = useMutation({ mutationFn: (row: OperationalIncident) => api.acknowledgeOperationalIssue(row), onSuccess: () => cache.invalidateQueries({ queryKey: agentKeys }) });
  const rows = query.data?.items ?? [];
  return <section aria-label="Operational order reports" className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-app-muted">Order risks, driver reports and suggested responses.</p>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setHistory(value => !value); pages.latest(); }}>{history ? 'Show open operational issues' : 'Show operational history'}</Button></div>
    <Notice error={acknowledge.error} /><QueryState query={query} loading="Loading operational reports…" />
    {query.data && !rows.length && <p className="py-4 text-sm text-app-muted">{history ? 'No operational history yet.' : 'No operational issues recorded. Check agent activity for the last review.'}</p>}
    <ol className="space-y-3">{rows.map(row => <li key={row.id} className="rounded-xl border border-app-border bg-white">
      <button type="button" aria-expanded={expanded === row.id} onClick={() => setExpanded(value => value === row.id ? undefined : row.id)} className="w-full rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
        <span className="block text-sm font-medium">{row.order_number} · {row.title}</span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-app-muted"><span>{row.company_name}</span><span>{certainty[row.certainty]}</span><span className={row.severity === 'CRITICAL' ? 'text-rose-700' : 'text-amber-700'}>{row.severity === 'CRITICAL' ? 'Urgent' : 'Warning'}</span><span>{status[row.status]}</span></span>
      </button>
      {expanded === row.id && <div className="space-y-4 px-4 pb-4 text-xs leading-5">
        <p className="break-words">{row.description}</p>
        <dl className="space-y-2">{row.evidence.map((item, index) => <div key={index}><dt className="font-medium">{item.label}</dt><dd className="break-words text-app-muted">{evidenceValue(item.value)}<span className="block text-[11px]">{item.source}{item.at ? ` · ${formatWhen(item.at)}` : ''}</span></dd></div>)}</dl>
        {row.driver_reply && <p className="break-words"><span className="font-medium">Driver reply: </span>{row.driver_reply}</p>}
        <div><p className="font-medium">Suggested responses</p><ul className="mt-1 list-disc space-y-1 pl-4">{row.suggestions.map(action => <li key={action}>{action}</li>)}</ul></div>
        {row.response_due_at && <p className="text-app-muted">Relevant commitment: {formatWhen(row.response_due_at)}</p>}
        {row.resolution && <p>{row.resolution}</p>}
        <p className="text-[11px] text-app-muted">Detected {formatWhen(row.created_at)} · Updated {formatWhen(row.updated_at)}</p>
        {row.status === 'OPEN' && <Button type="button" size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(row)}>Acknowledge issue</Button>}
      </div>}
    </li>)}</ol>
    <MonitorPagination page={pages.page} count={rows.length} next={query.data?.next_before} busy={query.isFetching} label="reports" onEarlier={pages.earlier} onNewer={pages.newer} />
  </section>;
}
