import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/button';
import { useMarkRead, useSendMessage, useThread, type ChatChannel, type ChatMessage } from '../../chat/api';

const MAX_LENGTH = 2000;
const time = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function Bubble({ message }: { message: ChatMessage }) {
  return <li className={`flex flex-col ${message.mine ? 'items-end' : 'items-start'}`}>
    <span className="mb-0.5 text-xs text-slate-500">{message.mine ? 'You' : message.sender_name} · <time dateTime={message.created_at}>{time(message.created_at)}</time></span>
    <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${message.mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>{message.body}</p>
  </li>;
}

/** One conversation: its messages (newest at the bottom) and, when the caller may send, a composer. */
export function ChatThread({ slug, orderId, channel }: { slug: string; orderId: string; channel: ChatChannel }) {
  const thread = useThread(slug, channel.conversation_id);
  const messages = thread.data?.messages;
  useMarkRead(slug, channel.conversation_id, messages, true);
  const send = useSendMessage(slug, orderId, channel.kind);
  const [draft, setDraft] = useState('');
  // One idempotency key per attempt: retrying the same text never posts it twice.
  const attempt = useRef(crypto.randomUUID());
  const list = useRef<HTMLOListElement>(null);
  const last = messages?.at(-1)?.seq;
  useEffect(() => { const node = list.current; if (node) node.scrollTop = node.scrollHeight; }, [last, channel.conversation_id]);
  const body = draft.trim();
  const submit = () => {
    if (!body || send.isPending) return;
    send.mutate({ body, key: attempt.current }, { onSuccess: () => { setDraft(''); attempt.current = crypto.randomUUID(); } });
  };
  return <div className="flex min-h-0 flex-col gap-3">
    <ol ref={list} role="log" aria-live="polite" aria-label={`Messages with ${channel.title}`} className="h-72 space-y-3 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-slate-200">
      {thread.canShowEarlier && <li className="text-center"><button type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900" onClick={thread.showEarlier}>Show earlier messages</button></li>}
      {!channel.conversation_id ? <li className="py-10 text-center text-xs text-slate-500">{channel.can_send ? `No messages yet. Write to ${channel.title} below.` : 'No messages.'}</li>
        : thread.isPending ? <li role="status" className="py-10 text-center text-xs text-slate-500">Loading messages…</li>
        : thread.error && !messages ? <li role="alert" className="py-10 text-center text-xs text-red-700">Messages could not be loaded.</li>
        : messages?.length ? messages.map(message => <Bubble key={message.id} message={message} />)
        : <li className="py-10 text-center text-xs text-slate-500">No messages.</li>}
    </ol>
    {channel.can_send ? <form className="relative" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label className="sr-only" htmlFor={`chat-${orderId}-${channel.kind}`}>Message {channel.title}</label>
      <textarea id={`chat-${orderId}-${channel.kind}`} rows={2} maxLength={MAX_LENGTH} value={draft} placeholder={`Message ${channel.title}`} className="app-input block min-h-10 w-full resize-none! py-2 pr-12"
        onChange={event => { setDraft(event.target.value); attempt.current = crypto.randomUUID(); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
      {/* Icon-only send inside the field's bottom-right corner. */}
      <Button type="submit" size="icon-sm" className="absolute right-2 bottom-2 rounded-full" disabled={!body || send.isPending} aria-busy={send.isPending}
        aria-label={send.isPending ? 'Sending message' : 'Send message'} title="Send (Enter)"><Send aria-hidden="true" /></Button>
    </form> : <p className="text-xs text-slate-500">{channel.closed_reason}</p>}
    {send.error && <p role="alert" className="text-xs text-red-700">{send.error.message || 'Message not sent. Try again.'}</p>}
  </div>;
}
