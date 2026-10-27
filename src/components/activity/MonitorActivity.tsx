import { useEffect, useId, useRef, useLayoutEffect } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantChat } from './useAssistantChat';
import type { AssistantReference } from '../../operations/api';
import { useActivityPresence } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange, onSelectReference }: { slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void; onSelectReference?: (reference: AssistantReference) => void }) {
  const contentId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { visible, reducedMotion } = useActivityPresence();
  const chat = useAssistantChat(slug);
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
      {chat.messages.length === 0 && <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2" role="group" aria-label="Suggested questions">
        {['What needs my attention?', 'Which orders are unassigned?', 'Are any deliveries running late?'].map(question => <button key={question} type="button" disabled={!active || chat.pending}
          onClick={() => { chat.setDraft(question); inputRef.current?.focus(); }}
          className="max-w-full rounded-full border border-app-border px-3 py-2 text-center text-xs text-app-muted transition-colors hover:bg-app-hover hover:text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:opacity-50">{question}</button>)}
      </div>}
      <AssistantConversation messages={chat.messages} pending={chat.pending} active={open && active && visible} reducedMotion={reducedMotion} onSelect={onSelectReference} />
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
