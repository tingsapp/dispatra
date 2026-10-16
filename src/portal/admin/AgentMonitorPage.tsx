import type { UseQueryResult } from '@tanstack/react-query';
import type { AgentMonitor } from '../api';
import { Notice } from '../ui';
import { QueryState } from './QueryState';
import { MachineMonitor } from './MachineMonitor';
import { AgentDetailsDialog, type MonitorFocus } from './AgentDetailsDialog';

export function AgentMonitorPage({ query, accountId, focus, onFocusChange, checkError, checkRequested, demo = false }: {
  query: UseQueryResult<AgentMonitor>; accountId: string; focus: MonitorFocus | null; onFocusChange: (focus: MonitorFocus | null) => void;
  demo?: boolean; checkError: unknown; checkRequested: boolean;
}) {
  return <div className="min-w-0 space-y-5">
    <Notice error={checkError} success={checkRequested ? 'Platform checks requested.' : undefined} />
    <QueryState query={query} loading="Loading agent progress…" />
    {query.data && <MachineMonitor monitor={query.data} accountId={accountId} onOpen={onFocusChange} delayed={query.isRefetchError} updatedAt={query.dataUpdatedAt} demo={demo} />}
    {focus && <AgentDetailsDialog key={focus} focus={focus} agents={query.data?.agents ?? []} accountId={accountId} onClose={() => onFocusChange(null)} />}
  </div>;
}
