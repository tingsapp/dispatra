import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Dialog, DialogBody, DialogHeader } from '../../components/ui/Dialog';
import { useEntityDialog } from '../../components/entities/useEntityDialog';
import type { AgentName, AgentStatus } from '../api';
import { notificationAge } from '../Notifications';
import { AgentLogs } from './AgentLogs';
import { TechnicalReports } from './TechnicalReports';
import { AGENTS, agentLabel } from './agentPresentation';

export type MonitorFocus = AgentName | 'ALL';
export function AgentDetailsDialog({ focus, agents, accountId, onClose }: { focus: MonitorFocus; agents: AgentStatus[]; accountId: string; onClose: () => void }) {
  const [activity, setActivity] = useState(false);
  const activityId = useId();
  const agent = focus === 'ALL' ? undefined : focus;
  const item = agents.find(item => item.agent === agent);
  const title = agent ? `${AGENTS[agent].name} issues` : 'Platform issues';
  useEntityDialog(true, onClose, title);
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader title={title} description={item ? `${item.issue_count} open issue${item.issue_count === 1 ? '' : 's'}` : undefined} onClose={onClose} closeLabel="Close agent details" />
    <DialogBody className="space-y-5">
      <TechnicalReports accountId={accountId} active agent={agent} />
      <section className="border-t border-app-border pt-2">
        <h4><button type="button" aria-expanded={activity} aria-controls={activityId} onClick={() => setActivity(value => !value)} className="flex w-full items-center justify-between gap-3 rounded py-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          Activity <ChevronDown size={16} aria-hidden="true" className={`text-app-muted transition-transform ${activity ? 'rotate-180' : ''}`} />
        </button></h4>
        <div id={activityId} hidden={!activity} className="space-y-4 pt-1">
          {item && <div className="space-y-1 text-xs text-app-muted"><p className={`font-medium ${item.stale || item.run?.status === 'FAILED' ? 'text-rose-700' : 'text-app-text'}`}>{agentLabel(item)}</p><p className="break-words">{item.run?.step && item.run.step !== agentLabel(item) ? item.run.step : !item.run ? 'Waiting for the first recorded run.' : undefined}</p><p className="text-[11px]">{item.queued} pending · {item.run ? `Updated ${notificationAge(item.run.heartbeat_at).toLowerCase()}` : 'No recorded activity'}</p></div>}
          <AgentLogs accountId={accountId} active={activity} agent={agent} />
        </div>
      </section>
    </DialogBody>
  </Dialog>;
}
