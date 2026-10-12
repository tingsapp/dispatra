import type { UseQueryResult } from '@tanstack/react-query';
import type { AgentMonitor } from '../api';
import { Notice } from '../ui';
import { QueryState } from './QueryState';
import { OrderFlowChart } from './OrderFlowChart';
import { AgentDetailsDialog, type MonitorFocus } from './AgentDetailsDialog';

export function AgentMonitorPage({ query, accountId, focus, onFocusChange, checkError, checkRequested }: {
  query: UseQueryResult<AgentMonitor>; accountId: string; focus: MonitorFocus | null; onFocusChange: (focus: MonitorFocus | null) => void;
  checkError: unknown; checkRequested: boolean;
}) {
  return <div className="min-w-0 space-y-5">
    <Notice error={checkError} success={checkRequested ? 'Platform checks requested.' : undefined} />
    <QueryState query={query} loading="Loading agent progress…" />
    {query.data && <OrderFlowChart agents={query.data.agents} onOpen={onFocusChange} />}
    {focus && <AgentDetailsDialog key={focus} focus={focus} agents={query.data?.agents ?? []} accountId={accountId} onClose={() => onFocusChange(null)} />}
  </div>;
}
