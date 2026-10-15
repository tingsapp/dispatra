import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, CircleAlert } from 'lucide-react';
import type { CompanyActivityEntry } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';
import { AGENTS } from '../../portal/admin/agentPresentation';

const visibleRows = 6;

export function activityActor(entry: CompanyActivityEntry) {
  if (entry.actor === 'AGENT') return entry.agent ? AGENTS[entry.agent].name : 'Agent';
  return ({ DRIVER: 'Driver', SHIPPER: 'Shipper', DISPATCHER: 'Dispatch', SYSTEM: 'System', UNKNOWN: 'Recorded event' } as const)[entry.actor];
}

function EntryContent({ entry, latest = false, timeZone }: { entry: CompanyActivityEntry; latest?: boolean; timeZone?: string }) {
  const completed = entry.kind === 'order.completed';
  const Icon = entry.level === 'ERROR' ? CircleAlert : entry.level === 'WARNING' ? AlertTriangle : completed ? Check : ChevronRight;
  const tone = entry.level === 'ERROR' ? 'text-rose-700' : entry.level === 'WARNING' ? 'text-amber-700' : 'text-app-muted';
  return <>
    <span className={`company-activity-icon mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ${entry.level !== 'INFO' ? tone : completed ? 'bg-emerald-600 text-white' : latest ? 'text-app-accent' : 'text-slate-400'}`}><Icon size={12} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-baseline gap-2 text-[10px] leading-4 text-app-muted">
        <time dateTime={entry.created_at} title={dateTime(entry.created_at, timeZone)} className="shrink-0 tabular-nums">{new Date(entry.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone })}<span className="sr-only"> · {dateTime(entry.created_at, timeZone)}</span></time>
        <span title={activityActor(entry)} className="truncate text-app-accent">[{activityActor(entry)}]</span>
        <span className={`ml-auto shrink-0 text-[9px] ${tone}`}>{entry.level}</span>
      </div>
      <p title={entry.title} className={`line-clamp-2 break-words text-[11px] font-normal leading-[17px] [overflow-wrap:anywhere] ${entry.level !== 'INFO' ? tone : 'text-slate-700'}`}>{entry.order_number && <span className="mr-1 text-app-muted">{entry.order_number}</span>}{entry.title}</p>
    </div>
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
  return <li aria-hidden={age >= visibleRows} data-activity-entry={entry.id}
    className="company-activity-row absolute inset-x-0 bottom-0 flex h-16 items-start gap-1.5 py-2 font-mono"
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
      const opening = entries.slice(0, visibleRows).reverse();
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
    if (reducedMotion) { setShown(entries?.slice(0, visibleRows).reverse() ?? []); setPending([]); return; }
    const timer = window.setTimeout(() => { setShown(rows => [...rows.slice(-visibleRows), pending[0]]); setPending(rows => rows.slice(1)); }, 1200);
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion, pending, entries]);
  return <ol aria-label="Recent order and agent activity" aria-live="off" className="relative min-h-0 flex-1 overflow-hidden" style={{ maxHeight: visibleRows * 64 }}>
    {shown.map((entry, index) => <SlidingRow key={entry.id} entry={entry} age={shown.length - 1 - index} animateIn reducedMotion={reducedMotion} timeZone={timeZone} />)}
  </ol>;
}
