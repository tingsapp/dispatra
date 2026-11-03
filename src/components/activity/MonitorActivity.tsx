import { companyDay, ordersCompletedToday, todaysPlan } from '../monitor/todaysPlan';
import type { Job } from '../../types';
import { useState, useEffect, useId, useRef, useLayoutEffect } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantChat } from './useAssistantChat';
import type { AssistantReference } from '../../operations/api';
import { useActivityPresence } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange, onSelectReference, jobs = [], timeZone = "America/Vancouver" }: { jobs?: Job[]; timeZone?: string; slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void; onSelectReference?: (reference: AssistantReference) => void }) {
  const contentId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { visible, reducedMotion } = useActivityPresence();
  const chat = useAssistantChat(slug);
  const [now, setNow] = useState(() => new Date());
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const day = companyDay(now, timeZone);
  const evening = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now)) >= 18;
  const period = day + (evening ? '-evening' : '-plan');
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => { setSummaryDismissed(false); if (active) onOpenChange(true); }, [period, active]);
  const completedToday = ordersCompletedToday(jobs, day, timeZone);
  const plan = todaysPlan(jobs, day, timeZone, new Set<string>());

  useEffect(() => { if (!active) onOpenChange(false); }, [active, onOpenChange]);
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = '0px';
    field.style.height = `${Math.min(160, Math.max(24, field.scrollHeight))}px`;
    const composer = field.closest('.public-chat-composer');
    field.closest<HTMLElement>('.company-activity-panel')?.style.setProperty('--assistant-composer-height', `${composer?.getBoundingClientRect().height ?? 54}px`);
  }, [chat.draft]);
  const submit = (retry = false) => {
    if (!active || chat.pending || (!retry && !chat.draft.trim())) return;
    setSummaryDismissed(true);
    onOpenChange(true);
    void chat.submit(retry);
  };
  return <section role={open ? 'dialog' : 'region'} aria-label="Dispatra" data-expanded={open} className="company-activity-panel">
    {open && <div id={contentId} className="assistant-panel-content">
    <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
      <h3 className="text-sm font-medium">Dispatra</h3>
      <button type="button" onClick={() => { inputRef.current?.blur(); onOpenChange(false); }} aria-label="Close Dispatra" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"><X size={14} /></button>
    </div>
    <div role="region" aria-label="Dispatra content" tabIndex={0} className="assistant-panel-body assistant-view-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      {!summaryDismissed && <div className="flex flex-1 flex-col justify-center px-4 py-8" aria-label="Daily summary">
        <div className="mx-auto w-full max-w-72">
          <h4 className="text-sm font-medium tracking-tight text-slate-900">{evening ? 'Today’s summary' : 'Today’s plan'}</h4>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900">{plan.all.length}</span>
            <span className="text-xs text-slate-500">orders created today</span>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
            {(evening ? [
              { label: 'Completed', value: completedToday.length },
              { label: 'In progress', value: plan.in_progress.length },
              { label: 'Awaiting', value: plan.unassigned.length + plan.assigned.length },
            ] : [
              { label: 'Unassigned', value: plan.unassigned.length },
              { label: 'Assigned', value: plan.assigned.length },
              { label: 'In progress', value: plan.in_progress.length },
            ]).map(item => <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-[10px] leading-4 text-slate-500">{item.label}</dt>
              <dd className="text-lg font-medium leading-6 tabular-nums text-slate-800">{item.value}</dd>
            </div>)}
          </dl>
          <p className={`mt-4 flex items-center gap-2 text-xs ${plan.attention.length ? 'text-amber-700' : 'text-slate-500'}`}>
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${plan.attention.length ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {plan.attention.length ? `${plan.attention.length} need attention` : 'No orders need attention'}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Ask Dispatra to explore the details.</p>
        </div>
      </div>}
      {summaryDismissed && <AssistantConversation messages={chat.messages} pending={chat.pending} active={open && active && visible} reducedMotion={reducedMotion} onSelect={onSelectReference} />}
    </div>
    </div>}
    <form className={`shrink-0 ${open ? 'mt-3' : ''}`} onSubmit={event => { event.preventDefault(); submit(); }}>
      {open && chat.error && <div role="alert" className="mb-2 text-xs text-rose-700"><p>{chat.error}</p>{chat.canRetry && <button type="button" onClick={() => submit(true)} className="mt-1 underline">Try again</button>}</div>}
      <div className="public-chat-composer">
        <textarea ref={inputRef} aria-label="Message Dispatra" aria-expanded={open} aria-controls={open ? contentId : undefined} placeholder="Ask Dispatra..." rows={1} maxLength={2000} value={chat.draft} disabled={chat.pending || !active}
          onChange={event => chat.setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          }} className="public-chat-input" />
        <button type="submit" aria-label="Send message" disabled={chat.pending || !active || !chat.draft.trim()} className="public-chat-send inline-flex shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><ArrowUp size={18} /></button>
      </div>
    </form>
  </section>;
}
