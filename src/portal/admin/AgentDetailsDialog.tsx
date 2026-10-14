import { Dialog, DialogBody, DialogHeader } from '../../components/ui/Dialog';
import { useEntityDialog } from '../../components/entities/useEntityDialog';
import type { AgentName, AgentStatus } from '../api';
import { AgentLogFeed } from './AgentLogFeed';
import { AGENTS } from './agentPresentation';

export type MonitorFocus = AgentName | 'ALL';
export function AgentDetailsDialog({ focus, agents, accountId, onClose }: { focus: MonitorFocus; agents: AgentStatus[]; accountId: string; onClose: () => void }) {
  const agent = focus === 'ALL' ? undefined : focus;
  const item = agents.find(item => item.agent === agent);
  const title = agent ? `${AGENTS[agent].name} log` : 'Platform log';
  useEntityDialog(true, onClose, title);
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader title={title} description={item ? `${item.issue_count} open issue${item.issue_count === 1 ? '' : 's'}` : undefined} onClose={onClose} closeLabel="Close agent details" />
    <DialogBody><AgentLogFeed accountId={accountId} agent={agent} /></DialogBody>
  </Dialog>;
}
