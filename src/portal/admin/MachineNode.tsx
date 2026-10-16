import { Cog, type LucideIcon } from 'lucide-react';
import type { AgentName, AgentStatus, MachineAgentState } from '../api';
import { dateTime } from '../../lib/dateTimeFormat';
import { AGENTS, agentLabel } from './agentPresentation';

export function MachineNode({ id, title, eyebrow, detail, icon: Icon, item, active, demo, onOpen, support = false, state, delayed = false, dataLines }: {
  id: string; title: string; eyebrow: string; detail: string; icon: LucideIcon; item?: AgentStatus;
  state?: MachineAgentState; delayed?: boolean; dataLines?: string[]; active: boolean; demo: boolean; onOpen: (agent: AgentName) => void; support?: boolean;
}) {
  const problem = !!item && (item.stale || item.run?.status === 'FAILED');
  const progress = Math.min(100, Math.max(0, item?.run?.progress ?? 0));
  const working = !delayed && (state ? state.state === 'PROCESSING' : item?.run?.status === 'RUNNING' && !item.stale);
  const displayState = delayed ? 'Updates paused' : state ? ({PROCESSING:'Processing',WAITING:'Waiting',ERROR:'Error',UNKNOWN:'No telemetry'} as const)[state.state] : item ? agentLabel(item) : '';
  const currentDetail = delayed ? 'Live updates are delayed. Last recorded state is retained.' : state?.detail;
  const stateProblem = !delayed && (state ? state.state === 'ERROR' : problem);
  const label = item && (item.issue_count ? `${title}: ${item.issue_count} open issue${item.issue_count === 1 ? '' : 's'}` : problem ? `${title}: ${item.stale ? 'progress overdue' : 'latest run failed'}` : `${title} details`);
  return <section aria-label={title} data-machine-node={id} data-machine-agent={item?.agent} data-live-state={state?.state} data-active={active} data-problem={stateProblem && !demo} data-waiting={!demo && state?.state === 'WAITING'} className={`machine-node ${support ? 'machine-support-node' : ''}`}>
    {item && <button className="machine-node-action" type="button" aria-label={label} aria-haspopup="dialog" onClick={() => onOpen(item.agent)} />}
    <div className="machine-node-eyebrow">{eyebrow}</div>
    <div data-machine-port={id} className={`machine-core ${item ? 'machine-engine' : ''} ${id === 'data' ? 'machine-database' : ''}`}>
      {item && <><span className="machine-orbit" /><Cog className="machine-rotor" size={70} strokeWidth={.8} aria-hidden="true" /></>}
      <span className="machine-core-symbol"><Icon size={item ? 26 : 29} strokeWidth={1.5} aria-hidden="true" /></span>
      {item && <span className="machine-indicator" aria-hidden="true" />}
    </div>
    <div className="machine-node-copy">
      <h3>{title}</h3><p className="machine-node-detail">{detail}</p>
      {item ? <>
        <p className={`machine-state ${demo ? 'machine-state-demo' : stateProblem ? 'machine-state-error' : state?.state === 'WAITING' ? 'machine-state-waiting' : working ? 'machine-state-working' : ''}`}>
          <span aria-hidden="true" className="machine-state-light" />{demo ? active ? 'Sample processing' : 'Demo standby' : displayState}
          {!demo && working && <span className="machine-percentage">{progress}%</span>}
        </p>
        {!demo && working && <div role="progressbar" aria-label={`${AGENTS[item.agent].name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="machine-progress"><span data-agent-card-fill style={{ width: `${progress}%` }} /></div>}
        {(currentDetail || demo || item.run?.status !== 'SUCCEEDED') && <p className="machine-node-run" title={currentDetail || item.run?.step}>{demo ? `Live: ${displayState}` : currentDetail || (item.stale ? 'Open log to investigate overdue progress.' : working ? item.run?.step : !item.run ? 'No recorded run yet.' : item.run.status === 'QUEUED' ? 'Waiting for the agent' : item.run.status === 'FAILED' ? 'Open log to investigate this run.' : 'Latest recorded run finished.')}</p>}
        {!demo && state?.company_name && <p className="machine-current-company">{state.company_name}</p>}
        {!demo && item.run?.status === 'QUEUED' && <p className="machine-heartbeat">Queued {dateTime(item.run.created_at)}</p>}
        {!demo && state?.heartbeat_at && <p className="machine-heartbeat">Last heartbeat {new Date(state.heartbeat_at).toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})}</p>}
        <p className={`machine-node-issues ${item.issue_count ? 'has-issues' : ''}`}>{item.issue_count ? `${item.issue_count} open issue${item.issue_count === 1 ? '' : 's'} · View log ↗` : item.queued ? `${item.queued} queued · View log ↗` : 'View log ↗'}</p>{!demo && item.queued > 0 && item.issue_count > 0 && <p className="machine-queue-count">{item.queued} queued</p>}
      </> : <div className="machine-data-label">{dataLines ? dataLines.map(line => <p key={line}>{line}</p>) : <p>{id === 'inputs' ? 'Email · portals · TMS' : id === 'data' ? 'Orders · prices · stops' : 'Pickup → Delivery → Proof'}</p>}</div>}
    </div>
  </section>;
}
