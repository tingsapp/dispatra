import { useEffect, useRef } from 'react';
import type { AssistantReference } from '../../operations/api';
import type { ChatMessage } from './useAssistantChat';

export function AssistantConversation({ messages, pending, onSelect }: {
  messages: ChatMessage[]; pending: boolean; onSelect?: (reference: AssistantReference) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, pending]);
  return <div role="log" aria-label="Dispatra AI conversation" aria-live="polite" aria-relevant="additions" className="mt-auto shrink-0 space-y-4 p-1">
    {messages.map(message => <article key={message.id} aria-label={message.role === 'user' ? 'Your message' : 'Dispatra AI message'}
      className={`assistant-message ${message.role === 'user' ? 'ml-6 rounded-2xl bg-white/15 px-3 py-2' : 'mr-2'}`}>
      <p className="mb-1 text-[10px] text-white/75">{message.role === 'user' ? 'You' : 'Dispatra AI'}</p>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.content}</p>
      {!!message.reply?.references.length && message.reply.limited && <p className="mt-2 text-[11px] text-white/75">Showing recent matches. Refine your question to narrow the results.</p>}
      {!!message.reply?.references.length && <ul aria-label="Matching workspace records" className="mt-2 space-y-1.5">
        {message.reply.references.map(reference => <li key={reference.key}><button type="button" onClick={() => onSelect?.(reference)}
          className="assistant-reference w-full rounded-xl bg-white/10 px-3 py-2 text-left hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <span className="block text-xs font-medium">{reference.label}<span className="ml-2 text-[10px] font-normal text-white/75">{reference.kind.toLowerCase()}</span></span>
          <span className="mt-1 block break-words text-[11px] text-white/75">{reference.detail}</span>
        </button></li>)}
      </ul>}
    </article>)}
    {pending && <p role="status" className="text-xs text-white/75">Dispatra AI is thinking…</p>}
    <div ref={end} />
  </div>;
}
