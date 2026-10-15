import { APP_ACCENT } from '../../lib/appearance';
import { useEffect, useId, useRef, useState } from 'react';
import { Search, ArrowUp, RefreshCw, X } from 'lucide-react';
import { ActivityLog } from './ActivityLog';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantChat } from './useAssistantChat';
import type { AssistantReference } from '../../operations/api';
import { useActivityPresence, useCompanyActivity } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange, onSelectReference }: { slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void; onSelectReference?: (reference: AssistantReference) => void }) {
  const contentId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { visible, reducedMotion } = useActivityPresence();
  const chat = useAssistantChat(slug);
  const [view, setView] = useState<'activity' | 'chat'>('activity');
  const chatting = view === 'chat';
  const live = open && active && visible && !chatting;
  const query = useCompanyActivity(slug, live);
  useEffect(() => { if (!active) onOpenChange(false); }, [active, onOpenChange]);
  const page = query.data;
  const timeZone = page?.time_zone ?? undefined;
  const error = query.error instanceof Error ? query.error.message : 'Activity updates are unavailable.';
  const submit = (retry = false) => {
    if (!active || chat.pending || (!retry && !chat.draft.trim())) return;
    setView('chat');
    void chat.submit(retry);
  };
  return <section role={open ? 'dialog' : 'region'} aria-label="Dispatra" data-expanded={open} className="company-activity-panel">
    {open && <div id={contentId} className="assistant-panel-content">
    <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
      <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => setView(chatting ? 'activity' : 'chat')} aria-label={chatting ? 'Show live activity' : 'Show chat'} title={chatting ? 'Show live activity' : 'Show chat'} aria-controls={`${contentId}-view`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-app-muted hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-slate-500">
            <svg className="assistant-toggle-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <g stroke={chatting ? '#0d0d0d' : APP_ACCENT}>
                <path d="M7 3v3m0 6v9" />
                <circle cx={7} cy={9} r={3} />
              </g>
              <g stroke={chatting ? APP_ACCENT : '#0d0d0d'}>
                <path d="M17 3v9m0 6v3" />
                <circle cx={17} cy={15} r={3} />
              </g>
            </svg>
          </button>
        <div className="grid min-w-0">
          <div className="assistant-view-layer col-start-1 row-start-1 min-w-0" data-active={!chatting} aria-hidden={chatting}>
            <h3 className="text-sm font-medium">Live activity</h3>
            <p className="text-[10px] text-app-muted">Dispatra</p>
          </div>
          <div className="assistant-view-layer col-start-1 row-start-1 min-w-0" data-active={chatting} aria-hidden={!chatting}>
            <h3 className="text-sm font-medium">Dispatra</h3>
            <p className="text-[10px] text-app-muted">Live activity</p>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => { inputRef.current?.blur(); onOpenChange(false); }} aria-label="Close Dispatra" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"><X size={14} /></button>
    </div>
    <div id={`${contentId}-view`} role="region" aria-label="Dispatra content" className="assistant-panel-body relative min-h-0 flex-1 overflow-hidden">
      <div data-active={chatting} aria-hidden={!chatting} inert={!chatting} tabIndex={chatting ? 0 : -1} className="assistant-view-layer assistant-view-scroll absolute inset-0 flex min-h-0 flex-col overflow-y-auto overscroll-contain focus-visible:rounded-lg focus-visible:outline focus-visible:outline-1 focus-visible:outline-slate-400">
        <AssistantConversation messages={chat.messages} pending={chat.pending} active={chatting} onSelect={onSelectReference} />
      </div>
      <div data-active={!chatting} aria-hidden={chatting} inert={chatting} className="assistant-view-layer assistant-view-scroll absolute inset-0 flex min-h-0 flex-col overflow-y-auto overscroll-contain">
        {query.isPending && !page && <p role="status" className="py-8 text-center text-xs text-app-muted">Loading activity…</p>}
        {query.isError && <div role="alert" className="py-3 text-xs text-rose-700"><p>{error}</p>{page && <p className="mt-1 text-app-muted">Showing the last saved activity.</p>}<button type="button" onClick={() => query.refetch()} className="mt-2 underline">Try again</button></div>}
        {page && <>{page.items.length === 0 && <p className="py-8 text-center text-xs text-app-muted">No activity recorded yet. Ask Dispatra a question below.</p>}
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            <ActivityLog entries={page.items} active={live} reducedMotion={reducedMotion} timeZone={timeZone} />
            <div className="flex shrink-0 items-center gap-2 pt-2 font-mono text-[10px] text-app-muted">
              <RefreshCw size={11} aria-hidden="true" className={live && query.isFetching && !reducedMotion ? 'animate-spin text-app-accent' : ''} />
              <span>{!live ? 'Activity updates paused' : query.isFetching ? 'Refreshing activity…' : query.isError ? 'Waiting to reconnect' : 'Watching for new activity'}</span>
            </div>
          </div></>}
      </div>
    </div>
    </div>}
    <form className={`shrink-0 ${open ? 'mt-3' : ''}`} onSubmit={event => { event.preventDefault(); submit(); }}>
      {open && chat.error && <div role="alert" className="mb-2 text-xs text-rose-700"><p>{chat.error}</p>{chat.canRetry && <button type="button" onClick={() => submit(true)} className="mt-1 underline">Try again</button>}</div>}
      <div className="assistant-search-composer relative rounded-2xl bg-white text-slate-800">
        <textarea ref={inputRef} aria-label="Message Dispatra" aria-expanded={open} aria-controls={open ? contentId : undefined} placeholder="Ask Dispatra..." rows={open ? 2 : 1} maxLength={2000} value={chat.draft} disabled={chat.pending || !active}
          onFocus={() => { if (active) onOpenChange(true); }}
          onChange={event => chat.setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          }} className="block w-full min-w-0 resize-none bg-transparent text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-500 disabled:opacity-70" />
        {open ? <button type="submit" aria-label="Send message" disabled={chat.pending || !chat.draft.trim()} className="absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"><ArrowUp size={16} /></button> : <Search aria-hidden="true" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />}
      </div>
    </form>
  </section>;
}
