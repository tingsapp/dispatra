import { ActionButton } from '../ui/button';
import { useChatComposer } from '../chat/useChatComposer';
import type { Job } from '../../types';
import { useEffect, useId, useRef } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantChat } from './useAssistantChat';
import type { AssistantReference } from '../../operations/api';
import { useActivityPresence } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange, onSelectReference, jobs: _jobs, timeZone: _timeZone }: { jobs?: Job[]; timeZone?: string; slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void; onSelectReference?: (reference: AssistantReference) => void }) {
  const contentId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { visible, reducedMotion } = useActivityPresence();
  const chat = useAssistantChat(slug);
  const opening = !chat.messages.some(message => message.role === 'user');
  useEffect(() => { if (active) onOpenChange(true); }, [active]);
  const briefingRequested = useRef(false);
  useEffect(() => { briefingRequested.current = false; }, [slug]);
  useEffect(() => {
    const expanded = open && active;
    if (!expanded || briefingRequested.current) return;
    const timer = window.setTimeout(() => {
      if (!briefingRequested.current) { briefingRequested.current = true; void chat.submit(false, true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, active, slug]);

  useEffect(() => { if (!active) onOpenChange(false); }, [active, onOpenChange]);
  useChatComposer(inputRef, chat.draft, open);
  const submit = (retry = false) => {
    if (!active || chat.pending || (!retry && !chat.draft.trim())) return;
    onOpenChange(true);
    return chat.submit(retry);
  };
  return <section role={open ? 'dialog' : 'region'} aria-label="Dispatra" data-expanded={open} data-view={opening ? 'briefing' : 'conversation'} className="company-activity-panel">
    {open && <div id={contentId} className="assistant-panel-content">
    <div className="-mr-1 -mt-1 flex shrink-0 items-center justify-end pb-1">
      <button type="button" onClick={() => { inputRef.current?.blur(); onOpenChange(false); }} aria-label="Close Dispatra" className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-app-muted hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"><X size={14} /></button>
    </div>
    <div role="region" aria-label="Dispatra content" tabIndex={0} className="assistant-panel-body assistant-view-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <AssistantConversation slug={slug} messages={chat.messages} pending={chat.pending} active={open && active && visible} reducedMotion={reducedMotion} onSelect={onSelectReference} onFollowUp={prompt => chat.submit(false, false, prompt)} onConfirm={chat.confirmAction} onCancel={chat.cancelAction} />
    </div>
    </div>}
    <form className={`shrink-0 ${open ? 'mt-3' : ''}`} onSubmit={event => { event.preventDefault(); submit(); }}>
      {open && chat.error && <div role="alert" className="mb-2 text-xs text-rose-700"><p>{chat.error}</p>{chat.canRetry && <ActionButton type="button" onClick={() => submit(true)} className="mt-1 underline">Try again</ActionButton>}</div>}
      <div className="public-chat-composer">
        <textarea ref={inputRef} aria-label="Message Dispatra" aria-expanded={open} aria-controls={open ? contentId : undefined} placeholder="Ask Dispatra..." rows={1} maxLength={2000} value={chat.draft} disabled={chat.pending || !active}
          onChange={event => chat.setDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          }} className="public-chat-input" />
        <button aria-busy={chat.pending} type="submit" aria-label="Send message" disabled={chat.pending || !active || !chat.draft.trim()} className="public-chat-send inline-flex shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><ArrowUp size={18} /></button>
      </div>
    </form>
  </section>;
}
