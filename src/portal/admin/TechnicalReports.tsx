import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CheckCheck } from 'lucide-react';
import { api, type AgentName, type TechnicalIssue } from '../api';
import { Button, Notice } from '../ui';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { agentKeys } from './queryKeys';
import { QueryState } from './QueryState';
import { formatWhen } from './format';
import { MonitorPagination, useMonitorPages } from './MonitorPagination';

const STATUS: Record<TechnicalIssue['status'], string> = {
  NEEDS_ADMIN: 'Needs investigation', AWAITING_APPROVAL: 'Awaiting approval', APPROVED: 'Approved · queued', APPLYING: 'Repair in progress',
  FIXED: 'Fixed', FAILED: 'Repair failed', REJECTED: 'Dismissed', SUPERSEDED: 'State changed',
};

export function TechnicalReports({ accountId, active, agent }: { accountId: string; active: boolean; agent?: AgentName }) {
  const [view, setView] = useState<'OPEN' | 'ALL'>('OPEN');
  const [expanded, setExpanded] = useState<string>();
  const detailsId = useId();
  const cache = useQueryClient();
  const pages = useMonitorPages();
  const query = useQuery({ queryKey: [...agentKeys, 'reports', accountId, view, pages.before, agent], queryFn: () => api.technicalReports(view, pages.before, 12, agent),
    enabled: active, refetchInterval: pages.before ? false : 5_000, refetchOnWindowFocus: false, staleTime: pages.before ? Infinity : 0 });
  const mutation = useMutation({ mutationFn: ({ row, approve }: { row: TechnicalIssue; approve: boolean }) => api.decideTechnicalReport(row, approve, crypto.randomUUID()),
    onSettled: () => { cache.invalidateQueries({ queryKey: agentKeys }); cache.invalidateQueries({ queryKey: ['platform', 'notifications', accountId] }); } });
  const decide = async (row: TechnicalIssue, approve: boolean) => {
    mutation.reset();
    if (await confirmDialog(approve ? {
      title: `Approve repair for ${row.company_name ?? 'the platform'}?`,
      message: row.action === 'RETRY_ORDER_AGENT' ? 'The Technical agent will requeue the saved email through normal booking validation. Processing may use the AI provider.'
        : 'The Technical agent will retry the mailbox connection with the saved settings. Incoming emails continue through the normal Order agent workflow.', confirmLabel: 'Approve repair',
    } : { title: 'Dismiss this report?', message: 'This marks the current report as reviewed. A new occurrence or changed task can produce a fresh report.', confirmLabel: 'Dismiss report' })) mutation.mutate({ row, approve });
  };
  const rows = query.data?.items ?? [];
  return <section id="technical-reports" aria-label="Technical reports" className="min-w-0 space-y-4">
    <div className="flex justify-end">
      <button type="button" aria-pressed={view === 'ALL'} onClick={() => { setView(view === 'OPEN' ? 'ALL' : 'OPEN'); pages.latest(); }} className="rounded text-xs text-app-muted underline underline-offset-4 hover:text-app-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{view === 'OPEN' ? 'Show history' : 'Show open issues'}</button>
    </div>
    <div role="region" aria-label="Report entries">
    <QueryState query={query} loading="Loading technical reports…" /><Notice error={mutation.error} />
    {query.data && rows.length === 0 && <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-4"><CheckCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><p className="text-xs text-app-muted">{view === 'OPEN' ? 'No open technical reports.' : 'No technical checks or repairs recorded yet.'}</p></div>}
    <div className="grid grid-cols-1 items-start gap-2">{rows.map(row => {
      const open = expanded === row.id;
      return <article key={row.id} aria-label={`${row.title} · ${row.company_name ?? 'Platform'}`} className="min-w-0 rounded-xl border border-app-border bg-white">
        <h3><button type="button" aria-label={`Details: ${row.title}`} aria-expanded={open} aria-controls={`${detailsId}-${row.id}`} onClick={() => setExpanded(open ? undefined : row.id)} className="flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{row.title}</span><span className="mt-1.5 flex items-center gap-2 text-[11px] font-normal"><span className="min-w-0 flex-1 truncate text-app-muted" title={row.company_name ?? 'Platform'}>{row.company_name ?? 'Platform'}</span><span className={`max-w-[65%] shrink-0 ${['NEEDS_ADMIN', 'AWAITING_APPROVAL', 'FAILED'].includes(row.status) ? 'text-rose-700' : 'text-app-muted'}`}>{row.automatic ? 'Fixed automatically' : STATUS[row.status]}{row.fixed_count > 0 ? ` · ${row.fixed_count} task${row.fixed_count === 1 ? '' : 's'}` : ''}</span></span></span>
          <ChevronDown size={15} aria-hidden="true" className={`mt-1 shrink-0 text-app-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button></h3>
        <div id={`${detailsId}-${row.id}`} hidden={!open} className="space-y-3 px-4 pb-4">
          <p className="break-words text-xs leading-5 text-app-muted">{row.description}</p>
          <p className="break-words text-[11px] text-app-muted">{row.company_name ?? 'Platform'} · {formatWhen(row.created_at)}</p>
          {['NEEDS_ADMIN', 'AWAITING_APPROVAL', 'FAILED'].includes(row.status) && <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => decide(row, false)}>Dismiss</Button>
            {row.status === 'AWAITING_APPROVAL' && row.action && <Button type="button" size="sm" disabled={mutation.isPending} onClick={() => decide(row, true)}>Review repair</Button>}
          </div>}
        </div>
      </article>;
    })}</div>
    </div>
    <MonitorPagination page={pages.page} count={rows.length} next={query.data?.next_before} busy={query.isFetching} label="reports" onEarlier={pages.earlier} onNewer={pages.newer} />
  </section>;
}
