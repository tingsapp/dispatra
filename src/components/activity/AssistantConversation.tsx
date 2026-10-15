import { useEffect, useRef } from 'react';
import type { AssistantReference } from '../../operations/api';
import type { ChatMessage } from './useAssistantChat';

export function AssistantConversation({ messages, pending, active, onSelect }: {
  messages: ChatMessage[]; pending: boolean; active: boolean; onSelect?: (reference: AssistantReference) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active) end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, pending, active]);
  return <div role="log" aria-label="Dispatra conversation" aria-live="polite" aria-relevant="additions" className="mt-auto shrink-0 space-y-4 p-1">
    {messages.map(message => <article key={message.id} aria-label={message.role === 'user' ? 'Your message' : 'Dispatra message'}
      className={`assistant-message ${message.role === 'user' ? 'ml-6 rounded-2xl bg-slate-100 px-3 py-2' : 'mr-2'}`}>
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
