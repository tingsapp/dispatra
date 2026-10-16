import { Database, Inbox, Pause, Play, Route, SkipForward } from 'lucide-react';
import type { AgentMonitor, AgentName } from '../api';
import type { MonitorFocus } from './AgentDetailsDialog';
import { AGENTS } from './agentPresentation';
import { MachineNode } from './MachineNode';
import { MachineStream } from './MachineStream';
import { useMachineConnections, type MachineLink } from './useMachineConnections';
import { SAMPLE_FLOW, useMachineDemo } from './useMachineDemo';
import { useObservedTransfers } from './useObservedTransfers';
import { MachineTransfer } from './MachineTransfer';
import { clockTime } from '../../lib/dateTimeFormat';

export function MachineMonitor({ monitor, accountId, onOpen, delayed = false, updatedAt, demo = false }: { monitor: AgentMonitor; accountId: string; onOpen: (focus: MonitorFocus) => void; delayed?: boolean; updatedAt?: number; demo?: boolean }) {
  const playback = useMachineDemo(demo);
  const { signals, stale } = useObservedTransfers(monitor.machine, accountId, delayed || demo, updatedAt);
  const paused = delayed || stale;
  const state = (agent: AgentName) => monitor.machine?.agents.find(item => item.agent === agent);
  const work = monitor.machine?.workload;
  const transfer = (from: string, to: string) => signals.find(event => event.from_node === from && event.to_node === to);
  const status = (agent: AgentName) => monitor.agents.find(item => item.agent === agent) ?? { agent, run: null, stale: false, queued: 0, issue_count: 0 };
  const active = (id: string) => {
    if (demo) return SAMPLE_FLOW[playback.step].node === id;
    if (paused) return false;
    const current = monitor.machine?.agents.find(item => item.agent === id);
    return current ? current.state === 'PROCESSING' : signals.some(event => event.from_node === id || event.to_node === id);
  };
  const problem = (id: string) => !playback.demo && (monitor.machine?.agents.some(item => item.agent === id && item.state === 'ERROR') || monitor.agents.some(item => item.agent === id && (item.stale || item.run?.status === 'FAILED')));
  const baseLinks: MachineLink[] = [
    { id: 'email-intake', from: 'inputs', to: 'ORDER', active: false },
    { id: 'validated-data', from: 'ORDER', to: 'data', active: false },
    { id: 'portal-data', from: 'inputs', to: 'data', route: 'bypass', active: false },
    { id: 'dispatch-input', from: 'data', to: 'DISPATCH', active: false },
    { id: 'route-output', from: 'DISPATCH', to: 'delivery', active: false },
    { id: 'delivery-update', from: 'delivery', to: 'data', route: 'return', active: false },
    ...(['OPERATIONAL', 'TECHNICAL', 'CHAT'] as const).map(agent => ({ id: `shared-${agent}`, from: 'data', to: agent, route: 'bus' as const, active: false })),
  ];
  const links = baseLinks.map(link => ({ ...link, event: demo ? undefined : transfer(link.from, link.to),
    active: demo ? active(link.from) || active(link.to) : !!transfer(link.from, link.to), problem: problem(link.to),
    waiting: !demo && !paused && state(link.to as AgentName)?.state === 'WAITING' && (state(link.to as AgentName)?.queued ?? 0) > 0 }));
  const { root, drawing } = useMachineConnections(links);
  const agentsNeedingReview = monitor.agents.filter(item => item.stale || item.run?.status === 'FAILED');
  return <section aria-label="Agent activity" className="machine-monitor" data-demo={playback.demo} data-motion={playback.demo && !playback.moving ? 'paused' : 'running'}>
    <div className="machine-telemetry" aria-label="Platform summary" role="region">
      <span className="machine-telemetry-update">{paused ? 'Updates paused' : `Updated ${clockTime(monitor.observed_at)}`}<span> · every 5s</span></span>
      <span><b>{monitor.machine?.agents.filter(item => item.state === 'PROCESSING').length ?? monitor.running}</b> processing</span><span><b>{monitor.machine?.agents.filter(item => item.state === 'WAITING').length ?? 0}</b> waiting</span><span className="has-issues"><b>{monitor.machine?.agents.filter(item => item.state === 'ERROR').length ?? 0}</b> errors</span><span><b>{monitor.machine?.agents.filter(item => item.state === 'UNKNOWN').length ?? 0}</b> unknown</span><span><b>{monitor.awaiting_approval}</b> awaiting approval</span><span><b>{monitor.automatic_fixes_24h}</b> fixes / 24h</span>
      <button type="button" className={monitor.needs_attention || agentsNeedingReview.length ? 'machine-review has-issues' : 'machine-review'} onClick={() => onOpen('ALL')}>{monitor.needs_attention ? `${monitor.needs_attention} report${monitor.needs_attention === 1 ? ' needs' : 's need'} attention` : agentsNeedingReview.length ? 'Agent runs need review' : 'View platform log'} ↗</button>
    </div>
    {!demo && <div className="machine-now" role="status">{paused ? 'Live updates are delayed. Motion is paused until a fresh snapshot arrives.' : !monitor.machine ? 'Waiting for live machine telemetry.' : <><b>Right now: </b>{monitor.machine.agents.some(item => item.state === 'PROCESSING') ? monitor.machine.agents.filter(item => item.state === 'PROCESSING').map(item => `${AGENTS[item.agent].name}: ${item.detail}${item.company_name ? ` · ${item.company_name}` : ''}`).join(' / ') : 'No agent is currently processing. Waiting and error reasons are shown on the engines.'}</>}</div>}
    {playback.demo && <div className="machine-playback"><span><b>Demonstration</b> · sample signals, independent of live runs</span><div>
      {!playback.reduced && <button type="button" onClick={playback.toggle} aria-label={playback.paused ? 'Play demonstration' : 'Pause demonstration'}>{playback.paused ? <Play size={14} /> : <Pause size={14} />}</button>}
      <button type="button" onClick={playback.next} aria-label="Next demonstration step"><SkipForward size={14} /></button>
    </div></div>}
    <div ref={root} className="machine-diagram" aria-label="Connected processing pipeline" role="group">
      <svg aria-hidden="true" className="machine-connections" viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none">
        <defs><marker id="machine-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 1 L 7 4 L 0 7" fill="none" stroke="context-stroke" strokeWidth="1.4" /></marker></defs>
        {drawing.paths.map(path => {
          const link = links.find(item => item.id === path.id)!;
          return <g key={path.id} data-machine-link={path.id} data-active={link.active} data-problem={link.problem} data-waiting={link.waiting}>
            <path id={`machine-path-${path.id}`} className="machine-wire" d={path.d} markerEnd="url(#machine-arrow)" />
            {demo && link.active && <path className="machine-signal" d={path.d} />}{link.event && !paused && <MachineTransfer key={link.event.id} event={link.event} path={path} reduced={playback.reduced} />}
          </g>;
        })}
      </svg>
      <div className="machine-bypass-label">Portal / TMS → order data</div>
      <div className="machine-pipeline">
        <MachineNode id="inputs" title="Booking inputs" eyebrow="01 / INPUT" detail="Requests enter the system" dataLines={work ? [`${work.emails_waiting} emails waiting`, `${work.emails_review} need review · ${work.emails_failed} failed`] : undefined} icon={Inbox} active={active('inputs')} demo={playback.demo} onOpen={onOpen} />
        <MachineNode id="ORDER" title="Order agent" eyebrow="02 / ORDER ENGINE" detail="Extract · validate" icon={AGENTS.ORDER.icon} item={status('ORDER')} state={state('ORDER')} delayed={paused} active={active('ORDER')} demo={playback.demo} onOpen={onOpen} />
        <MachineNode id="data" title="Order data" eyebrow="03 / SHARED DATA" detail="Validated orders & saved prices" dataLines={work ? [`${work.orders_waiting} unassigned orders`, `${work.auto_waiting} automatic · ${work.manual_waiting} manual`] : undefined} icon={Database} active={active('data')} demo={playback.demo} onOpen={onOpen} />
        <MachineNode id="DISPATCH" title="Dispatch agent" eyebrow="04 / DISPATCH ENGINE" detail="Match · assign · optimize" icon={AGENTS.DISPATCH.icon} item={status('DISPATCH')} state={state('DISPATCH')} delayed={paused} active={active('DISPATCH')} demo={playback.demo} onOpen={onOpen} />
        <MachineNode id="delivery" title="Route & delivery" eyebrow="05 / EXECUTION" detail="Driver route & delivery proof" dataLines={work ? [`${work.orders_assigned} assigned · ${work.orders_in_progress} in progress`, `${work.routes_in_progress} routes active · ${work.completed_24h} completed / 24h`] : undefined} icon={Route} active={active('delivery')} demo={playback.demo} onOpen={onOpen} />
      </div>
      <div className="machine-bus-label">SHARED RECORDS & TELEMETRY</div>
      <div className="machine-support">
        <MachineNode id="OPERATIONAL" title="Operational agent" eyebrow="WATCH & RESPOND" detail="Order progress · arrival risks · driver responses" icon={AGENTS.OPERATIONAL.icon} item={status('OPERATIONAL')} state={state('OPERATIONAL')} delayed={paused} active={active('OPERATIONAL')} demo={playback.demo} onOpen={onOpen} support />
        <MachineNode id="TECHNICAL" title="Technical agent" eyebrow="MONITOR & REPAIR" detail="Platform checks · approved repairs" icon={AGENTS.TECHNICAL.icon} item={status('TECHNICAL')} state={state('TECHNICAL')} delayed={paused} active={active('TECHNICAL')} demo={playback.demo} onOpen={onOpen} support />
        <MachineNode id="CHAT" title="Chat agent" eyebrow="ASK & RETRIEVE" detail="Workspace questions · company records" icon={AGENTS.CHAT.icon} item={status('CHAT')} state={state('CHAT')} delayed={paused} active={active('CHAT')} demo={playback.demo} onOpen={onOpen} support />
      </div>
    </div>
    <footer className="machine-legend"><span><i className="is-active" />Processing</span><span><i className="is-waiting" />Waiting</span><span><i className="is-error" />Error</span><span><i />Unknown / idle</span><span className="machine-legend-note">{playback.demo ? 'Sample flow · no live records changed' : 'Moving labels are newly observed handoffs. Gears show current processing.'}</span></footer>
    <MachineStream machine={monitor.machine} accountId={accountId} demo={playback.demo} step={playback.step} />
  </section>;
}
