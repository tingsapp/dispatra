import { useLayoutEffect, useRef, useState } from 'react';
import { Inbox, Route, Workflow } from 'lucide-react';
import type { AgentName, AgentStatus } from '../api';
import { AGENTS, agentLabel } from './agentPresentation';

function AgentCardAction({ item, onOpen }: { item: AgentStatus; onOpen: (agent: AgentName) => void }) {
  const runProblem = item.stale || item.run?.status === 'FAILED';
  const name = AGENTS[item.agent].name;
  return <button type="button" onClick={() => onOpen(item.agent)} aria-haspopup="dialog" aria-label={item.issue_count ? `${name}: ${item.issue_count} open issue${item.issue_count === 1 ? '' : 's'}` : runProblem ? `${name}: ${item.stale ? 'progress overdue' : 'latest run failed'}` : `${name} details`}
    className="absolute -inset-px z-10 cursor-pointer rounded-xl transition-colors hover:bg-slate-900/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
    {(item.issue_count > 0 || runProblem) && <span data-agent-issue-dot aria-hidden="true" className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-rose-600 ring-4 ring-white" />}
  </button>;
}

function AgentState({ item }: { item: AgentStatus }) {
  const working = item.run?.status === 'RUNNING' && !item.stale;
  return <div className="shrink-0 text-right">
    <p className={`text-[11px] ${working ? 'text-blue-700' : item.stale || item.run?.status === 'FAILED' ? 'text-rose-700' : 'text-app-muted'}`}>{agentLabel(item)}</p>
  </div>;
}

function AgentCardProgress({ item, tone }: { item: AgentStatus; tone: string }) {
  if (item.run?.status !== 'RUNNING' || item.stale) return null;
  const progress = Math.min(100, Math.max(0, item.run.progress));
  return <>
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span data-agent-card-fill className={`block h-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${tone}`} style={{ width: `${progress}%` }} />
    </span>
    <span role="progressbar" aria-label={`${AGENTS[item.agent].name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="sr-only" />
  </>;
}

const BRANCHES = [
  { id: 'requests', title: 'Booking requests', icon: Inbox, tone: 'bg-slate-100 text-slate-500',
    placement: 'xl:col-start-1 xl:row-start-1', details: ['Email', 'Shipper portal', 'Dispatcher portal', 'TMS'] },
  { id: 'order', title: 'Order agent', agent: 'ORDER' as const, icon: AGENTS.ORDER.icon, tone: 'bg-blue-50 text-blue-600', fill: 'bg-blue-100/70',
    placement: 'xl:col-start-3 xl:row-start-1', details: ['Email intake', 'Booking validation'] },
  { id: 'dispatch', title: 'Dispatch agent', agent: 'DISPATCH' as const, icon: AGENTS.DISPATCH.icon, tone: 'bg-amber-50 text-amber-600', fill: 'bg-amber-100/60',
    placement: 'xl:col-start-1 xl:row-start-2', details: ['Auto assignment', 'Manual suggestions'] },
  { id: 'delivery', title: 'Route & delivery', icon: Route, tone: 'bg-emerald-50 text-emerald-600',
    placement: 'xl:col-start-3 xl:row-start-2', details: ['Optimized routes', 'Delivery', 'Proof of delivery'] },
  { id: 'technical', title: 'Technical agent', agent: 'TECHNICAL' as const, icon: AGENTS.TECHNICAL.icon, tone: 'bg-purple-50 text-purple-600', fill: 'bg-purple-100/60',
    placement: 'xl:col-start-2 xl:row-start-3 xl:-mx-16', details: ['Platform checks', 'Approved repairs'] },
];

/** Connect the actual rendered blocks so labels, live status and resizing cannot detach the lines. */
function useFlowConnections() {
  const canvas = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState({ width: 1, height: 1, paths: [] as string[] });
  useLayoutEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const hub = root.querySelector<HTMLElement>('[data-flow-hub]');
    if (!hub) return;
    const update = () => {
      const bounds = root.getBoundingClientRect(), center = hub.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const paths = BRANCHES.flatMap(branch => {
        const header = root.querySelector<HTMLElement>(`[data-flow-header="${branch.id}"]`);
        if (!header) return [];
        const target = header.getBoundingClientRect();
        if (branch.id === 'technical') return [`M ${center.left + center.width / 2 - bounds.left} ${center.bottom - bounds.top} V ${target.top - bounds.top}`];
        const left = branch.id === 'requests' || branch.id === 'dispatch';
        const upper = branch.id === 'requests' || branch.id === 'order';
        const sx = (left ? center.left : center.right) - bounds.left, sy = center.top + center.height * (upper ? .3 : .7) - bounds.top;
        const tx = (left ? target.right : target.left) - bounds.left, ty = target.top + target.height / 2 - bounds.top;
        const mx = (sx + tx) / 2, dx = Math.sign(tx - sx), dy = Math.sign(ty - sy), r = Math.min(18, Math.abs(tx - sx) / 4, Math.abs(ty - sy) / 4);
        return [`M ${sx} ${sy} H ${mx - dx * r} Q ${mx} ${sy} ${mx} ${sy + dy * r} V ${ty - dy * r} Q ${mx} ${ty} ${mx + dx * r} ${ty} H ${tx}`];
      });
      setDrawing({ width: bounds.width, height: bounds.height, paths });
    };
    update();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }
    const observer = new ResizeObserver(update);
    observer.observe(root); observer.observe(hub);
    root.querySelectorAll<HTMLElement>('[data-flow-branch]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return { canvas, drawing };
}

export function OrderFlowChart({ agents, onOpen }: { agents: AgentStatus[]; onOpen: (agent: AgentName) => void }) {
  const { canvas, drawing } = useFlowConnections();
  const status = (agent: AgentName): AgentStatus => agents.find(item => item.agent === agent) ?? { agent, run: null, stale: false, queued: 0, issue_count: 0 };
  return <section aria-label="Order flow" className="min-w-0">
    <div ref={canvas} className="relative grid items-start gap-x-16 gap-y-10 xl:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] xl:gap-y-12">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full xl:block" viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none">
        {drawing.paths.map((path, index) => <path key={index} d={path} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 7" strokeLinecap="round" />)}
      </svg>
      <div data-flow-hub role="group" aria-label="Order lifecycle" className="relative z-[1] mx-auto w-full max-w-64 rounded-2xl border border-slate-200 bg-white px-5 py-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-center">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Workflow size={18} strokeWidth={1.6} aria-hidden="true" /></span><h2 className="text-sm font-medium text-slate-800">Order workflow</h2></div>
        <ol aria-label="Order lifecycle stages" className="mt-5 space-y-3">
          {['New', 'Assigned', 'In progress', 'Completed'].map((stage, index) => <li key={stage} className="relative flex items-center gap-3">
            {index < 3 && <span aria-hidden="true" className="absolute left-[13px] top-7 h-3 border-l border-slate-200" />}
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500">{index + 1}</span><span className="text-xs text-slate-600">{stage}</span>
          </li>)}
        </ol>
      </div>
      {BRANCHES.map(branch => {
        const item = branch.agent ? status(branch.agent) : undefined;
        const Icon = branch.icon;
        return <section key={branch.id} data-flow-branch className={`relative z-[1] min-w-0 ${branch.placement}`} aria-label={branch.title}>
          <div data-flow-header={branch.id} className="relative flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            {item && <AgentCardProgress item={item} tone={branch.fill ?? 'bg-blue-100/70'} />}
            {item && <AgentCardAction item={item} onOpen={onOpen} />}
            <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${branch.tone}`}><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
            <h3 className="relative z-[1] min-w-0 text-sm font-medium text-slate-800">{branch.title}</h3>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <ul aria-label={`${branch.title} description`} className="min-w-0 flex-1 list-disc space-y-0.5 pl-5 text-xs leading-5 text-app-muted marker:text-slate-400">{branch.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
            {item && <AgentState item={item} />}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
