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
  const { rows, queries, activity, loadingReports } = useAgentFeed(accountId, agent, expanded === 'activity');
  const actions = useAgentReportActions(accountId);
  return <section aria-label="Agent log" className="min-w-0 space-y-3">
    <Notice error={actions.error} />
    {queries.map((query, index) => <QueryState key={index} query={query} loading={index === 0 ? 'Loading activity…' : 'Loading open reports…'} />)}
    {loadingReports && !queries.some(query => query.isPending || query.isError) && <p role="status" className="text-xs text-app-muted">Loading remaining open reports…</p>}
    {!rows.length && !loadingReports && queries.every(query => query.isSuccess) && <p className="py-4 text-sm text-app-muted">No unresolved issues or recorded activity.</p>}
    <AutoScrollingIssueList enabled={rows.length > 1} holding={actions.pending || rows.some(row => row.key === expanded)}
      contentKey={rows.map(entry => `${entry.key}:${entry.kind === 'activity' ? entry.entries.map(row => row.id).join(',') : entry.row.version}`).join('|')} resetKey={agent ?? 'ALL'} controls={null}>
      {rows.map(entry => {
        const row = entry.row;
        const title = entry.kind === 'activity' ? 'Recorded activity' : entry.kind === 'operational' ? `${entry.row.order_number} · ${entry.row.title}` : entry.row.title;
        const status = entry.kind === 'activity' ? `${entry.entries.length} ${entry.entries.length === 1 ? 'entry' : 'entries'}` : entry.kind === 'operational' ? operationalStatus[entry.row.status] : technicalStatus[entry.row.status];
        const open = expanded === entry.key;
        const controls = `${detailsId}-${entry.key}`;
        return <article key={entry.key} aria-label={entry.kind === 'activity' ? 'Recorded activity' : `${title} · ${row.company_name ?? 'Platform'}`} className="agent-report-entry">
          <ReportLogLine title={title} company={entry.kind === 'activity' ? 'All companies' : row.company_name} severity={entry.kind === 'activity' ? 'INFO' : entry.row.severity}
            createdAt={row.created_at} status={status} certainty={entry.kind === 'operational' ? certaintyLabel[entry.row.certainty] : undefined}
            source={!agent ? entry.kind === 'activity' ? 'All agents' : AGENTS[entry.kind === 'operational' ? 'OPERATIONAL' : entry.row.agent].name : undefined}
            expanded={open} controls={controls} onClick={() => setExpanded(open ? undefined : entry.key)} />
          <div id={controls} hidden={!open} className="px-2 pb-4 sm:pl-[144px]">{open && <AgentReportDetails entry={entry} actions={actions} activityControls={activity.hasNextPage && !activity.isError ? <p role="status" className="text-xs text-app-muted">Loading activity entries…</p> : null} />}</div>
        </article>;
      })}
    </AutoScrollingIssueList>
  </section>;
}
