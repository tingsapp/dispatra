import { useEffect, useState } from 'react';
import { Check, Mail, PackageCheck, Pause, Play, Route, ScanLine, Truck } from 'lucide-react';

// Illustrative events only; this animation never reads or changes company orders.
const events = [
  { title: 'Order received from email', actor: 'Email agent', time: '09:00', status: 'New', icon: Mail },
  { title: 'Order details prepared', actor: 'Email agent', time: '09:01', status: 'New', icon: PackageCheck },
  { title: 'Eligible driver assigned', actor: 'Dispatch agent · Auto', time: '09:02', status: 'Assigned', icon: Route },
  { title: 'Pickup confirmed', actor: 'Driver', time: '09:18', status: 'In progress', icon: Truck },
  { title: 'Delivery proof captured', actor: 'Driver', time: '09:42', status: 'In progress', icon: ScanLine },
  { title: 'Order completed', actor: 'Driver', time: '09:43', status: 'Completed', icon: Check },
] as const;

export function OrderActivityPreview() {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media?.matches ?? false);
    const updateVisibility = () => setHidden(document.hidden);
    media?.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media?.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || hidden) return;
    const timer = window.setTimeout(() => setStage(current => (current + 1) % events.length), stage === events.length - 1 ? 5500 : 2600);
    return () => window.clearTimeout(timer);
  }, [stage, paused, reducedMotion, hidden]);

  const currentStage = reducedMotion ? events.length - 1 : stage;
  const current = events[currentStage];
  return <>
    <div className="absolute left-3 top-3 rounded-xl border border-app-border bg-white px-3 py-2.5 shadow-md">
      <div className="flex items-center gap-5 text-[11px] font-medium"><span>Order 1042</span><span className={`flex items-center gap-1.5 ${current.status === 'Completed' ? 'text-app-muted' : 'text-blue-600'}`}>{current.status === 'Completed' ? <Check className="size-3" aria-hidden="true" /> : <span className="size-1 rounded-full bg-blue-500" />}{current.status}</span></div>
      <p className="mt-1 text-[10px] text-app-muted">Vancouver → Richmond · Email</p>
    </div>
    <section aria-label="Sample order activity" aria-live="off" className="absolute bottom-3 left-3 right-3 rounded-xl border border-app-border bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:left-auto sm:w-[280px]">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${paused || reducedMotion ? 'bg-slate-400' : 'bg-blue-600'}`} /><h3 className="text-[11px] font-medium">Order activity</h3></div>
        {!reducedMotion && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play preview animation' : 'Pause preview animation'} className="inline-flex size-6 items-center justify-center rounded-md text-app-muted hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{paused ? <Play className="size-3" aria-hidden="true" /> : <Pause className="size-3" aria-hidden="true" />}</button>}
      </div>
      <ol className="mt-2 flex h-[144px] flex-col justify-end gap-1" aria-label="Recent sample order events">
        {events.slice(Math.max(0, currentStage - 2), currentStage + 1).map(event => {
          const Icon = event.icon;
          const latest = event === current;
          return <li key={event.title} className={`flex min-h-[45px] items-center gap-2.5 rounded-lg px-2 py-1.5 ${latest ? 'preview-event-enter bg-blue-50/80' : ''}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${latest ? 'bg-blue-600 text-white' : 'bg-slate-100 text-app-muted'}`}><Icon className="size-3" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-medium leading-4">{event.title}</p><p className="text-[9px] leading-4 text-app-muted">{event.actor}</p></div><span className="self-start pt-0.5 text-[9px] tabular-nums text-app-muted">{event.time}</span>
          </li>;
        })}
      </ol>
    </section>
  </>;
}
