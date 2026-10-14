import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Workflow, Truck, UserRound } from 'lucide-react';
import type { CompanyActivityEntry } from '../../operations/api';
import { clockTime, dateTime } from '../../lib/dateTimeFormat';
import { AGENTS } from '../../portal/admin/agentPresentation';

export function activityActor(entry: CompanyActivityEntry) {
  if (entry.actor === 'AGENT') return entry.agent ? AGENTS[entry.agent].name : 'Agent';
  return ({ DRIVER: 'Driver', SHIPPER: 'Shipper', DISPATCHER: 'Dispatch', SYSTEM: 'System', UNKNOWN: 'Recorded event' } as const)[entry.actor];
}

function EntryContent({ entry, latest = false, timeZone }: { entry: CompanyActivityEntry; latest?: boolean; timeZone?: string }) {
  const warning = entry.level !== 'INFO';
  const Icon = warning ? AlertTriangle : entry.kind === 'order.completed' ? Check : entry.agent ? AGENTS[entry.agent].icon : entry.actor === 'DRIVER' ? Truck : entry.actor === 'SHIPPER' ? UserRound : Workflow;
  return <>
    <span className={`company-activity-icon flex size-7 shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-amber-50 text-amber-700' : entry.kind === 'order.completed' ? 'bg-emerald-600 text-white' : latest ? 'bg-blue-600 text-white' : 'bg-slate-100 text-app-muted'}`}><Icon size={14} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><p title={entry.title} className="line-clamp-2 text-xs font-medium leading-4">{entry.title}</p><p className="truncate text-[10px] leading-4 text-app-muted">{activityActor(entry)}{entry.order_number ? ` · ${entry.order_number}` : ''}</p></div>
    <time dateTime={entry.created_at} title={dateTime(entry.created_at, timeZone)} className="shrink-0 self-start pt-1 text-right text-[10px] tabular-nums text-app-muted">{clockTime(entry.created_at, timeZone)}<span className="block text-[9px]">{new Date(entry.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone })}</span></time>
  </>;
}

function SlidingRow({ entry, age, animateIn, reducedMotion, timeZone }: { entry: CompanyActivityEntry; age: number; animateIn: boolean; reducedMotion: boolean; timeZone?: string }) {
  const [arrived, setArrived] = useState(!animateIn || reducedMotion);
  useEffect(() => {
    if (arrived || reducedMotion) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setArrived(true)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [arrived, reducedMotion]);
  return <li aria-hidden={age > 3} data-activity-entry={entry.id}
    className={`company-activity-row absolute inset-x-0 bottom-0 flex h-16 items-center gap-2.5 rounded-lg px-2 py-2 ${age === 0 ? 'bg-blue-50/80' : ''}`}
    style={{ transform: `translateY(${(-age + (arrived || reducedMotion ? 0 : 1)) * 64}px)` }}>
    <EntryContent entry={entry} latest={age === 0} timeZone={timeZone} />
  </li>;
}

/** Recent saved rows enter once on opening, followed by new committed rows in order. */
export function ActivityLog({ entries, active, reducedMotion, timeZone }: { entries?: CompanyActivityEntry[]; active: boolean; reducedMotion: boolean; timeZone?: string }) {
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  const [shown, setShown] = useState<CompanyActivityEntry[]>([]);
  const [pending, setPending] = useState<CompanyActivityEntry[]>([]);
  useEffect(() => {
    if (!entries) return;
    if (!initialized.current) {
      if (!entries.length) return;
      initialized.current = true;
      seen.current = new Set(entries.map(row => row.id));
      const opening = entries.slice(0, 4).reverse();
      setShown(reducedMotion ? opening : opening.slice(0, 1));
      setPending(reducedMotion ? [] : opening.slice(1));
      return;
    }
    const additions = entries.filter(row => !seen.current.has(row.id)).reverse();
    for (const row of entries) seen.current.add(row.id);
    if (seen.current.size > 600) seen.current = new Set([...seen.current].slice(-300));
    if (additions.length) setPending(rows => [...rows, ...additions].slice(-100));
  }, [entries, reducedMotion]);
  useEffect(() => {
    if (!active || !pending.length) return;
    if (reducedMotion) { setShown(entries?.slice(0, 5).reverse() ?? []); setPending([]); return; }
    const timer = window.setTimeout(() => { setShown(rows => [...rows.slice(-4), pending[0]]); setPending(rows => rows.slice(1)); }, 1200);
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion, pending, entries]);
  return <ol aria-label="Recent order and agent activity" aria-live="off" className="relative min-h-0 flex-1 overflow-hidden">
    {shown.map((entry, index) => <SlidingRow key={entry.id} entry={entry} age={shown.length - 1 - index} animateIn reducedMotion={reducedMotion} timeZone={timeZone} />)}
  </ol>;
}
