import type { ReactNode } from 'react';
import { clockTime } from '../../lib/dateTimeFormat';
import { AGENTS } from './agentPresentation';
import { Button } from '../ui';
import { formatWhen } from './format';
import type { AgentFeedEntry } from './agentFeed';
import type { useAgentReportActions } from './useAgentReportActions';

const evidenceValue = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)) ? formatWhen(value) : value;

export function AgentReportDetails({ entry, actions, activityControls }: { entry: AgentFeedEntry; actions: ReturnType<typeof useAgentReportActions>; activityControls?: ReactNode }) {
  if (entry.kind === 'activity') return <div className="space-y-3">
    <ol aria-label="Activity entries" className="space-y-3">{entry.entries.map(row => <li key={row.id} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 text-xs leading-5">
      <time dateTime={row.created_at} title={formatWhen(row.created_at)} className="text-[11px] tabular-nums text-app-muted">{clockTime(row.created_at)}</time>
      <div className="min-w-0"><p className="break-words text-app-text">{row.message}</p>
        <p className="break-words text-[11px] text-app-muted"><span className="text-blue-600">Activity</span> · {row.company_name ?? 'Platform'} · {AGENTS[row.agent].name}</p>
      </div>
    </li>)}</ol>
    {activityControls && <div className="flex justify-end">{activityControls}</div>}
  </div>;
  if (entry.kind === 'technical') {
    const row = entry.row;
    return <div className="space-y-3">
      <p className="break-words text-xs leading-5 text-app-muted">{row.description}</p>
      <p className="break-words text-[11px] text-app-muted">{row.company_name ?? 'Platform'} · {formatWhen(row.created_at)}</p>
      {['NEEDS_ADMIN', 'AWAITING_APPROVAL', 'FAILED'].includes(row.status) && <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={actions.pending} onClick={() => actions.decide(row, false)}>Dismiss</Button>
        {row.status === 'AWAITING_APPROVAL' && row.action && <Button type="button" size="sm" disabled={actions.pending} onClick={() => actions.decide(row, true)}>Review repair</Button>}
      </div>}
    </div>;
  }
  const row = entry.row;
  return <div className="space-y-4 text-xs leading-5">
    <p className="break-words">{row.description}</p>
    <dl className="space-y-2">{row.evidence.map((item, index) => <div key={index}><dt className="font-medium">{item.label}</dt><dd className="break-words text-app-muted">{evidenceValue(item.value)}<span className="block text-[11px]">{item.source}{item.at ? ` · ${formatWhen(item.at)}` : ''}</span></dd></div>)}</dl>
    {row.driver_reply && <p className="break-words"><span className="font-medium">Driver reply: </span>{row.driver_reply}</p>}
    <div><p className="font-medium">Suggested responses</p><ul className="mt-1 list-disc space-y-1 pl-4">{row.suggestions.map(action => <li key={action}>{action}</li>)}</ul></div>
    {row.response_due_at && <p className="text-app-muted">Relevant commitment: {formatWhen(row.response_due_at)}</p>}
    {row.resolution && <p>{row.resolution}</p>}
    <p className="text-[11px] text-app-muted">Detected {formatWhen(row.created_at)} · Updated {formatWhen(row.updated_at)}</p>
    {row.status === 'OPEN' && <Button type="button" size="sm" disabled={actions.pending} onClick={() => actions.acknowledge(row)}>Acknowledge issue</Button>}
  </div>;
}
