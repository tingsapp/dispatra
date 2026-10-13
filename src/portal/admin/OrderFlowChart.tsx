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
  return <div className="shrink-0 text-center sm:text-left xl:text-right">
    <p className={`text-[10px] sm:text-[11px] ${working ? 'text-blue-700' : item.stale || item.run?.status === 'FAILED' ? 'text-rose-700' : 'text-app-muted'}`}>{agentLabel(item)}</p>
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
    placement: 'col-start-1 row-start-1', compact: 'Email, portals, TMS', details: ['Email', 'Shipper portal', 'Dispatcher portal', 'TMS'] },
  { id: 'order', title: 'Order agent', agent: 'ORDER' as const, icon: AGENTS.ORDER.icon, tone: 'bg-blue-50 text-blue-600', fill: 'bg-blue-100/70',
    placement: 'col-start-3 row-start-1', compact: 'Intake & validation', details: ['Email intake', 'Booking validation'] },
  { id: 'dispatch', title: 'Dispatch agent', agent: 'DISPATCH' as const, icon: AGENTS.DISPATCH.icon, tone: 'bg-amber-50 text-amber-600', fill: 'bg-amber-100/60',
    placement: 'col-start-1 row-start-2', compact: 'Assignment & suggestions', details: ['Auto assignment', 'Manual suggestions'] },
  { id: 'delivery', title: 'Route & delivery', icon: Route, tone: 'bg-emerald-50 text-emerald-600',
    placement: 'col-start-3 row-start-2', compact: 'Routes, delivery & proof', details: ['Optimized routes', 'Delivery', 'Proof of delivery'] },
  { id: 'operational', title: 'Operational agent', agent: 'OPERATIONAL' as const, icon: AGENTS.OPERATIONAL.icon, tone: 'bg-orange-50 text-orange-600', fill: 'bg-orange-100/60',
    placement: 'col-start-1 row-start-3', compact: 'Order risks & responses', details: ['Order progress and arrival risk', 'Driver clarification', 'Evidence and suggested responses'] },
  { id: 'technical', title: 'Technical agent', agent: 'TECHNICAL' as const, icon: AGENTS.TECHNICAL.icon, tone: 'bg-purple-50 text-purple-600', fill: 'bg-purple-100/60',
    placement: 'col-start-3 row-start-3', compact: 'Checks & repairs', details: ['Platform checks', 'Approved repairs'] },
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
        if (branch.id === 'technical' || branch.id === 'operational') return [`M ${center.left + center.width / 2 - bounds.left} ${center.bottom - bounds.top} V ${target.top - bounds.top - 18} H ${target.left + target.width / 2 - bounds.left} V ${target.top - bounds.top}`];
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
    <div ref={canvas} className="relative grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-start gap-x-3 gap-y-7 sm:grid-cols-[minmax(0,1fr)_144px_minmax(0,1fr)] sm:gap-x-7 sm:gap-y-10 lg:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] xl:gap-x-16 xl:gap-y-12">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none">
        {drawing.paths.map((path, index) => <path key={index} d={path} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 7" strokeLinecap="round" />)}
      </svg>
      <div data-flow-hub role="group" aria-label="Order lifecycle" className="relative z-[1] col-start-2 row-start-1 row-span-2 w-full self-center rounded-2xl border border-slate-200 bg-white px-1.5 py-3 sm:px-3 sm:py-5 lg:px-5">
        <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2.5"><span className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Workflow size={18} strokeWidth={1.6} aria-hidden="true" /></span><h2 className="text-[10px] font-medium text-slate-800 sm:text-sm"><span className="sm:hidden">Workflow</span><span className="hidden sm:inline">Order workflow</span></h2></div>
        <ol aria-label="Order lifecycle stages" className="mt-4 space-y-3 sm:mt-5">
          {['New', 'Assigned', 'In progress', 'Completed'].map((stage, index) => <li key={stage} className="relative flex flex-col items-center gap-1 sm:flex-row sm:gap-2 lg:gap-3">
            {index < 3 && <span aria-hidden="true" className="absolute left-1/2 top-full h-3 border-l border-slate-200 sm:left-[13px] sm:top-7" />}
            <span aria-hidden="true" className="flex h-5 w-5 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500">{index + 1}</span><span className="text-center text-[10px] leading-3 text-slate-600 sm:text-left sm:text-xs sm:leading-4">{stage}</span>
          </li>)}
        </ol>
      </div>
      {BRANCHES.map(branch => {
        const item = branch.agent ? status(branch.agent) : undefined;
        const Icon = branch.icon;
        return <section key={branch.id} data-flow-branch className={`relative z-[1] min-w-0 ${branch.placement}`} aria-label={branch.title}>
          <div data-flow-header={branch.id} className="relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-2 text-center sm:min-h-14 sm:flex-row sm:justify-start sm:gap-2 sm:px-3 sm:py-3 sm:text-left xl:gap-3 xl:px-4">
            {item && <AgentCardProgress item={item} tone={branch.fill ?? 'bg-blue-100/70'} />}
            {item && <AgentCardAction item={item} onOpen={onOpen} />}
            <span className={`relative z-[1] flex h-5 w-5 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg ${branch.tone}`}><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
            <h3 className="relative z-[1] min-w-0 text-[11px] leading-4 font-medium text-slate-800 sm:text-sm sm:leading-5">{branch.title}</h3>
          </div>
          <div className="mt-2 flex flex-col items-center gap-1 text-center sm:mt-3 sm:items-start sm:gap-2 sm:text-left xl:flex-row xl:justify-between xl:gap-3">
            <ul aria-label={`${branch.title} description`} className="hidden min-w-0 flex-1 list-disc sm:block space-y-0.5 pl-5 text-xs leading-5 text-app-muted marker:text-slate-400">{branch.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
            <p className="text-[10px] leading-4 text-app-muted sm:hidden">{branch.compact}</p>
            {item && <AgentState item={item} />}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
