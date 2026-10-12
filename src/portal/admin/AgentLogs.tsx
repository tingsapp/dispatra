import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type AgentName } from '../api';
import { Button } from '../ui';
import { agentKeys } from './queryKeys';
import { QueryState } from './QueryState';
import { AGENTS } from './agentPresentation';
import { formatWhen } from './format';
import { MonitorPagination, useMonitorPages } from './MonitorPagination';

export function AgentLogs({ accountId, active, agent }: { accountId: string; active: boolean; agent?: AgentName }) {
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const pages = useMonitorPages();
  const viewport = useRef<HTMLDivElement>(null);
  const live = !paused && !pages.before;
  const query = useQuery({ queryKey: [...agentKeys, 'logs', accountId, { agent, before: pages.before }],
    queryFn: () => api.agentLogs(agent, undefined, pages.before),
    enabled: active, refetchInterval: live ? 5_000 : false, refetchOnWindowFocus: false, staleTime: live ? 0 : Infinity });
  useEffect(() => { viewport.current?.scrollTo?.({ top: 0 }); setExpanded(undefined); }, [pages.before, agent]);
  const rows = query.data?.items ?? [];
  return <section aria-label="Agent activity log" className="min-w-0 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-app-muted">{live ? 'Latest activity' : pages.before ? 'Earlier activity' : 'Updates paused'}</span>
      {pages.before ? <Button type="button" variant="ghost" size="sm" onClick={() => pages.latest()}>Latest logs</Button>
        : <Button type="button" variant="ghost" size="sm" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume live logs' : 'Pause live logs'}</Button>}
    </div>
    <div ref={viewport} role="region" aria-label="Log entries" tabIndex={0} className="h-[280px] overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]">
      <QueryState query={query} loading="Loading agent logs…" />
      {query.data && rows.length === 0 && <p className="py-5 text-xs text-app-muted">No agent activity recorded yet. New runs will appear here.</p>}
      <ol className="space-y-5 py-1" aria-live="off" aria-busy={query.isFetching}>{rows.map(row => {
        const tone = row.level === 'ERROR' ? 'text-rose-700' : row.level === 'WARNING' ? 'text-amber-700' : 'text-slate-400';
        return <li key={row.id} className="relative pl-4">
          <span aria-hidden="true" className={`absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full ${row.level === 'ERROR' ? 'bg-rose-600' : row.level === 'WARNING' ? 'bg-amber-500' : 'bg-slate-300'}`} />
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-app-muted"><time dateTime={row.created_at}>{formatWhen(row.created_at)}</time>{!agent && <span>{AGENTS[row.agent].name}</span>}{row.company_name && <span>{row.company_name}</span>}{row.level !== 'INFO' && <span className={tone}>{row.level === 'ERROR' ? 'Error' : 'Warning'}</span>}</div>
          <p className={`mt-1 break-words text-xs leading-5 text-app-text ${expanded === row.id ? '' : 'line-clamp-2'}`}>{row.message}</p>
          {row.message.length > 140 && <button type="button" className="mt-1 text-[11px] font-medium text-app-text underline underline-offset-2" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? undefined : row.id)}>{expanded === row.id ? 'Show less' : 'Show full message'}</button>}
        </li>;
      })}</ol>
    </div>
    <MonitorPagination page={pages.page} count={rows.length} next={query.data?.next_before} busy={query.isFetching} label="logs" onEarlier={pages.earlier} onNewer={pages.newer} />
  </section>;
}
