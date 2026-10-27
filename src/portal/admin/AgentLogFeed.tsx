import { useId, useState } from 'react';
import type { AgentName } from '../api';
import { Notice } from '../ui';
import { AGENTS } from './agentPresentation';
import { certaintyLabel, operationalStatus, technicalStatus } from './agentFeed';
import { useAgentFeed } from './useAgentFeed';
import { useAgentReportActions } from './useAgentReportActions';
import { AgentReportDetails } from './AgentReportDetails';
import { AutoScrollingIssueList } from './AutoScrollingIssueList';
import { ReportLogLine } from './ReportLogLine';
import { QueryState } from './QueryState';

export function AgentLogFeed({ accountId, agent }: { accountId: string; agent?: AgentName }) {
  const [expanded, setExpanded] = useState<string>();
  const detailsId = useId();
  const { rows, queries, loadingReports } = useAgentFeed(accountId, agent);
  const actions = useAgentReportActions(accountId);
  return <section aria-label="Agent log" className="min-w-0 space-y-3">
    <p className="text-xs text-app-muted">Open issues first, then up to 20 recent errors and warnings from the last 24 hours. Repeated messages are combined.</p>
    <Notice error={actions.error} />
    {queries.map((query, index) => <QueryState key={index} query={query} loading={index < 2 ? 'Loading recent problems…' : 'Loading open reports…'} />)}
    {loadingReports && !queries.some(query => query.isPending || query.isError) && <p role="status" className="text-xs text-app-muted">Loading remaining open reports…</p>}
    {!rows.length && !loadingReports && queries.every(query => query.isSuccess) && <p className="py-4 text-sm text-app-muted">No open issues or recent errors or warnings.</p>}
    <AutoScrollingIssueList enabled={rows.length > 1} holding={actions.pending || rows.some(row => row.key === expanded)}
      contentKey={rows.map(entry => `${entry.key}:${entry.kind === 'event' ? `${entry.row.id}:${entry.count}` : entry.row.version}`).join('|')} resetKey={agent ?? 'ALL'} controls={null}>
      {rows.map(entry => {
        const row = entry.row;
        const title = entry.kind === 'event' ? entry.row.message : entry.kind === 'operational' ? `${entry.row.order_number} · ${entry.row.title}` : entry.row.title;
        const status = entry.kind === 'event' ? `Recent event${entry.count > 1 ? ` · ${entry.count} times` : ''}` : entry.kind === 'operational' ? operationalStatus[entry.row.status] : technicalStatus[entry.row.status];
        const open = expanded === entry.key;
        const controls = `${detailsId}-${entry.key}`;
        return <article key={entry.key} aria-label={`${title} · ${row.company_name ?? 'Platform'}`} className="agent-report-entry">
          <ReportLogLine title={title} company={row.company_name} severity={entry.kind === 'event' ? entry.row.level === 'ERROR' ? 'CRITICAL' : 'WARNING' : entry.row.severity}
            createdAt={row.created_at} status={status} certainty={entry.kind === 'operational' ? certaintyLabel[entry.row.certainty] : undefined}
            source={!agent ? AGENTS[entry.kind === 'operational' ? 'OPERATIONAL' : entry.row.agent].name : undefined}
            expanded={open} controls={controls} onClick={() => setExpanded(open ? undefined : entry.key)} />
          <div id={controls} hidden={!open} className="px-2 pb-4 sm:pl-[144px]">{open && <AgentReportDetails entry={entry} actions={actions} />}</div>
        </article>;
      })}
    </AutoScrollingIssueList>
  </section>;
}
