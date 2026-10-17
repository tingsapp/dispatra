import { useEffect, useLayoutEffect, useRef } from 'react';
import type { AssistantReference } from '../../operations/api';
import type { ChatMessage } from './useAssistantChat';

export function AssistantConversation({ messages, pending, active, reducedMotion, onSelect }: {
  messages: ChatMessage[]; pending: boolean; active: boolean; reducedMotion: boolean; onSelect?: (reference: AssistantReference) => void;
}) {
  const transcript = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set(messages.map(message => message.id)));
  const pendingHeight = useRef(0);
  useLayoutEffect(() => {
    const initialHeight = pendingHeight.current;
    pendingHeight.current = transcript.current?.querySelector<HTMLElement>('[role="status"]')?.offsetHeight ?? 0;
    const fresh = new Set(messages.filter(message => message.role === 'assistant' && !seen.current.has(message.id)).map(message => message.id));
    seen.current = new Set(messages.map(message => message.id));
    if (!active || reducedMotion || !fresh.size) return;
    const animations: Animation[] = [];
    transcript.current?.querySelectorAll<HTMLElement>('[data-message-id]').forEach(element => {
      if (!fresh.has(element.dataset.messageId!) || !element.animate) return;
      animations.push(element.animate([
        { height: `${initialHeight}px`, opacity: 0, transform: 'translateY(24px)', overflow: 'hidden' },
        { height: `${element.offsetHeight}px`, opacity: 1, transform: 'translateY(0)', overflow: 'hidden' },
      ], { duration: 480, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
    });
    // Follow the growing reply inside this pane without scrolling the map/page.
    const viewport = transcript.current?.parentElement;
    const follow = () => { if (viewport) viewport.scrollTop = viewport.scrollHeight; };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(follow);
    if (animations.length && transcript.current) observer?.observe(transcript.current);
    void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => observer?.disconnect());
    return () => { observer?.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [messages, pending, active, reducedMotion]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active) end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, pending, active]);
  return <div ref={transcript} role="log" aria-label="Dispatra conversation" aria-live="polite" aria-relevant="additions" className="mt-auto shrink-0 space-y-4 p-1">
    {messages.map(message => <article key={message.id} data-message-id={message.id} aria-label={message.role === 'user' ? 'Your message' : 'Dispatra message'}
      className={`assistant-message ${message.role === 'user' ? 'ml-auto w-fit max-w-[calc(100%-1.5rem)] rounded-2xl bg-slate-100 px-3 py-2' : 'mr-2'}`}>
      <p className="mb-1 text-[10px] text-app-muted">{message.role === 'user' ? 'You' : 'Dispatra'}</p>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.content}</p>
      {!!message.reply?.references.length && message.reply.limited && <p className="mt-2 text-[11px] text-app-muted">Showing recent matches. Refine your question to narrow the results.</p>}
      {!!message.reply?.references.length && <ul aria-label="Matching workspace records" className="mt-2 space-y-1.5">
        {message.reply.references.map(reference => <li key={reference.key}><button type="button" onClick={() => onSelect?.(reference)}
          className="assistant-reference w-full rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500">
          <span className="block text-xs font-medium">{reference.label}<span className="ml-2 text-[10px] font-normal text-app-muted">{reference.kind.toLowerCase()}</span></span>
          <span className="mt-1 block break-words text-[11px] text-app-muted">{reference.detail}</span>
        </button></li>)}
      </ul>}
    </article>)}
    {pending && <p role="status" className="text-xs text-app-muted">Thinking...</p>}
    <div ref={end} />
  </div>;
}
