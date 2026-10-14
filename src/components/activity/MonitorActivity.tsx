import { useEffect } from 'react';
import { Activity, ArrowUp, X } from 'lucide-react';
import { FloatingPanel } from '../ui/FloatingPanel';
import { ActivityLog } from './ActivityLog';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantChat } from './useAssistantChat';
import type { AssistantReference } from '../../operations/api';
import { useActivityPresence, useCompanyActivity } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange, onSelectReference }: { slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void; onSelectReference?: (reference: AssistantReference) => void }) {
  const { visible, reducedMotion } = useActivityPresence();
  const chat = useAssistantChat(slug);
  const chatting = chat.messages.length > 0;
  const live = open && active && visible && !chatting;
  const query = useCompanyActivity(slug, live);
  useEffect(() => { if (!active) onOpenChange(false); }, [active, onOpenChange]);
  const page = query.data;
  const timeZone = page?.time_zone ?? undefined;
  const error = query.error instanceof Error ? query.error.message : 'Activity updates are unavailable.';
  return <FloatingPanel open={open} onOpenChange={onOpenChange} dismissible={false} focusOnOpen={false}
    anchor={<span aria-hidden="true" className="pointer-events-none absolute inset-0" />}
    label="Dispatra AI" align="end" side="bottom" avoidCollisions={false} size="rich" className="company-activity-panel app-map-menu p-3" trigger={
    <button type="button" aria-label="Dispatra AI" aria-expanded={open} title="Dispatra AI" className="company-activity-trigger app-metric app-map-icon relative">
      <span aria-hidden="true" className={`company-activity-waves pointer-events-none absolute inset-0 ${!visible || !active ? 'company-activity-pulse-paused' : ''}`}><span className="company-activity-pulse" /><span className="company-activity-pulse" /></span>
      <Activity aria-hidden="true" size={18} strokeWidth={2} className="company-activity-trigger-icon relative shrink-0" />
    </button>}>
    <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
      <div><h3 className="text-sm font-medium">Dispatra AI</h3><p className="text-[10px] text-app-muted">{chatting ? 'Workspace assistant' : 'Live activity'}</p></div>
      <button type="button" onClick={() => onOpenChange(false)} aria-label="Close Dispatra AI" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><X size={14} /></button>
    </div>
    <div role="region" aria-label="Dispatra AI content" tabIndex={chatting ? 0 : -1} className="assistant-panel-body flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain focus-visible:rounded-lg focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/70">
      {chatting ? <AssistantConversation messages={chat.messages} pending={chat.pending} onSelect={onSelectReference} /> : <>
        {query.isPending && !page && <p role="status" className="py-8 text-center text-xs text-app-muted">Loading activity…</p>}
        {query.isError && <div role="alert" className="py-3 text-xs text-rose-700"><p>{error}</p>{page && <p className="mt-1 text-app-muted">Showing the last saved activity.</p>}<button type="button" onClick={() => query.refetch()} className="mt-2 underline">Try again</button></div>}
        {page && <>{page.items.length === 0 && <p className="py-8 text-center text-xs text-app-muted">No activity recorded yet. Ask Dispatra AI a question below.</p>}
          <ActivityLog entries={page.items} active={live} reducedMotion={reducedMotion} timeZone={timeZone} /></>}
      </>}
    </div>
    <form className="mt-3 shrink-0" onSubmit={event => { event.preventDefault(); void chat.submit(); }}>
      {chat.error && <div role="alert" className="mb-2 text-xs text-rose-200"><p>{chat.error}</p>{chat.canRetry && <button type="button" onClick={() => void chat.submit(true)} className="mt-1 underline">Try again</button>}</div>}
      <div className="flex items-end gap-2 rounded-2xl border border-white/20 bg-white/10 p-2">
        <textarea aria-label="Message Dispatra AI" placeholder="Ask Dispatra AI…" rows={2} maxLength={2000} value={chat.draft} disabled={chat.pending}
          onChange={event => chat.setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void chat.submit(); }
          }} className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-[13px] leading-5 text-white outline-none placeholder:text-white/80 focus-visible:rounded-lg focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/70 disabled:opacity-70" />
        <button type="submit" aria-label="Send message" disabled={chat.pending || !chat.draft.trim()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"><ArrowUp size={18} /></button>
      </div>
    </form>
  </FloatingPanel>;
}
