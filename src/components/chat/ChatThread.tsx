import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';
import { useMarkRead, useSendMessage, useThread, type ChatChannel, type ChatMessage } from '../../chat/api';

const MAX_LENGTH = 2000;
const time = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function Bubble({ message }: { message: ChatMessage }) {
  return <li className={`flex flex-col ${message.mine ? 'items-end' : 'items-start'}`}>
    <span className="mb-0.5 max-w-full break-words [overflow-wrap:anywhere] text-[10px] text-slate-400">{message.mine ? 'You' : message.sender_name} · <time dateTime={message.created_at}>{time(message.created_at)}</time></span>
    <p className={`max-w-[88%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.mine ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800'}`}>{message.body}</p>
  </li>;
}

/** One conversation: its messages (newest at the bottom) and, when the caller may send, a composer. */
export function ChatThread({ slug, orderId, driverId, channel }: { slug: string; orderId?: string; driverId?: string; channel: ChatChannel }) {
  const thread = useThread(slug, channel.conversation_id);
  const messages = thread.data?.messages;
  useMarkRead(slug, channel.conversation_id, messages, true);
  const send = useSendMessage(slug, orderId, channel.kind, driverId);
  const [draft, setDraft] = useState('');
  // One idempotency key per attempt: retrying the same text never posts it twice.
  const attempt = useRef(crypto.randomUUID());
  const list = useRef<HTMLOListElement>(null);
  const last = messages?.at(-1)?.seq;
  useEffect(() => { const node = list.current; if (node) node.scrollTop = node.scrollHeight; }, [last, channel.conversation_id]);
  const composer = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = composer.current;
    if (!field) return;
    field.style.height = '0px';
    field.style.height = `${Math.min(112, Math.max(52, field.scrollHeight))}px`;
  }, [draft, channel.kind]);
  const body = draft.trim();
  const submit = () => {
    if (!body || send.isPending || !channel.can_send) return;
    send.mutate({ body, key: attempt.current }, { onSuccess: () => { setDraft(''); attempt.current = crypto.randomUUID(); } });
  };
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <ol ref={list} role="log" tabIndex={0} aria-live="polite" aria-label={`Messages with ${channel.title}`} className="chat-message-list h-[min(42vh,360px)] min-h-0 space-y-4 overflow-y-auto overscroll-contain px-1 py-2">
      {thread.canShowEarlier && <li className="text-center"><button type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900" onClick={thread.showEarlier}>Show earlier messages</button></li>}
      {!channel.conversation_id ? <li className="py-10 text-center text-xs text-slate-500">{channel.can_send ? `No messages yet. Write to ${channel.title} below.` : 'No messages.'}</li>
        : thread.isPending ? <li role="status" className="py-10 text-center text-xs text-slate-500">Loading messages…</li>
        : thread.error && !messages ? <li className="py-10 text-center"><p role="alert" className="text-xs text-red-700">Messages could not be loaded.</p><button type="button" className="mt-2 text-xs underline" onClick={() => void thread.refetch()}>Try again</button></li>
        : messages?.length ? messages.map(message => <Bubble key={message.id} message={message} />)
        : <li className="py-10 text-center text-xs text-slate-500">No messages.</li>}
    </ol>
    {channel.can_send ? <form className="relative shrink-0" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label className="sr-only" htmlFor={`chat-${orderId}-${channel.kind}`}>Message {channel.title}</label>
      <textarea ref={composer} style={{minHeight:52,maxHeight:112}} id={`chat-${orderId}-${channel.kind}`} rows={1} disabled={send.isPending} maxLength={MAX_LENGTH} value={draft} placeholder="Write a message…" className="app-input block min-h-0 w-full resize-none! rounded-xl bg-white py-3 pl-3.5 pr-12 text-sm"
        onChange={event => { setDraft(event.target.value); attempt.current = crypto.randomUUID(); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
      {/* Icon-only send inside the field's bottom-right corner. */}
      <Button type="submit" size="icon-sm" className="absolute right-2 bottom-2 rounded-full" disabled={!body || send.isPending} aria-busy={send.isPending}
        aria-label={send.isPending ? 'Sending message' : 'Send message'} title="Send (Enter)"><ArrowUp className="size-5" strokeWidth={2.5} aria-hidden="true" /></Button>
    </form> : <p className="text-xs text-slate-500">{channel.closed_reason}</p>}
    {send.error && <p role="alert" className="text-xs text-red-700">{send.error.message || 'Message not sent. Try again.'}</p>}
  </div>;
}
