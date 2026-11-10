import { ActionButton } from '../ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { dateTime } from '../../lib/dateTimeFormat';
import { useChatComposer } from './useChatComposer';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';
import { useMarkRead, useSendMessage, useThread, type ChatChannel, type ChatMessage } from '../../chat/api';

const MAX_LENGTH = 2000;
const time = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function Bubble({ message, timeZone }: { message: ChatMessage; timeZone?: string }) {
  return <li className={`flex flex-col ${message.mine ? 'items-end' : 'items-start'}`}>
    <span className="mb-0.5 max-w-full break-words [overflow-wrap:anywhere] text-[10px] text-slate-400">{message.mine ? 'You' : message.sender_name} · <time dateTime={message.created_at}>{timeZone ? dateTime(message.created_at, timeZone) : time(message.created_at)}</time></span>
    <p className={`max-w-[88%] whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.mine ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800'}`}>{message.body}</p>
  </li>;
}

/** One conversation: its messages (newest at the bottom) and, when the caller may send, a composer. */
export function ChatThread({ slug, orderId, driverId, shipperId, channel, fullHeight = false, timeZone }: { slug: string; orderId?: string; driverId?: string; shipperId?: string; channel: ChatChannel; fullHeight?: boolean; timeZone?: string }) {
  const composerId = useId();
  const thread = useThread(slug, channel.conversation_id);
  const messages = thread.data?.messages;
  const [atBottom, setAtBottom] = useState(true);
  useMarkRead(slug, channel.conversation_id, messages, atBottom);
  const send = useSendMessage(slug, orderId, channel.kind, driverId, shipperId, channel.dispatcher_id ?? undefined, { expected_conversation_id: channel.conversation_id ?? undefined, expected_driver_id: orderId ? channel.driver_id ?? undefined : undefined });
  const cache = useQueryClient();
  const draftKey = ['chat-draft', slug, orderId ?? '', channel.kind, driverId ?? shipperId ?? channel.dispatcher_id ?? channel.conversation_id ?? ''];
  const [draft, updateDraft] = useState(() => { cache.setQueryDefaults(['chat-draft', slug], { gcTime: Infinity }); return cache.getQueryData<string>(draftKey) ?? ''; });
  const setDraft = (value: string) => { updateDraft(value); cache.setQueryData(draftKey, value); };
  // One idempotency key per attempt: retrying the same text never posts it twice.
  const attempt = useRef(cache.getQueryData<string>([...draftKey, 'attempt']) ?? crypto.randomUUID());
  cache.setQueryData([...draftKey, 'attempt'], attempt.current);
  const list = useRef<HTMLOListElement>(null);
  const last = messages?.at(-1)?.seq;
  useEffect(() => { const node = list.current; if (node && atBottom) node.scrollTop = node.scrollHeight; }, [last, channel.conversation_id]);
  const composer = useRef<HTMLTextAreaElement>(null);
  useChatComposer(composer, draft, channel.kind);
  const body = draft.trim();
  const submit = () => {
    if (!body || send.isPending || !channel.can_send) return;
    send.mutate({ body, key: attempt.current }, { onSuccess: () => { setDraft(''); attempt.current = crypto.randomUUID(); cache.setQueryData([...draftKey, 'attempt'], attempt.current); } });
  };
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <ol ref={list} role="log" tabIndex={0} aria-live="polite" aria-label={`Messages with ${channel.title}`} onScroll={event => { const node = event.currentTarget; setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 40); }} className={`chat-message-list ${fullHeight ? 'flex-1' : 'h-[min(42vh,360px)]'} min-h-0 space-y-4 overflow-y-auto overscroll-contain px-1 py-2`}>
      {thread.canShowEarlier && <li className="text-center"><ActionButton type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900" disabled={thread.loadingEarlier} onClick={() => { const node = list.current; const height = node?.scrollHeight ?? 0; const top = node?.scrollTop ?? 0; return thread.showEarlier().then(() => requestAnimationFrame(() => { if (node) node.scrollTop = top + node.scrollHeight - height; })); }}>Show earlier messages</ActionButton></li>}
      {!channel.conversation_id ? <li className="py-10 text-center text-xs text-slate-500">{channel.can_send ? `No messages yet. Write to ${channel.title} below.` : 'No messages.'}</li>
        : thread.isPending ? <li role="status" className="py-10 text-center text-xs text-slate-500">Loading messages…</li>
        : thread.error && !messages ? <li className="py-10 text-center"><p role="alert" className="text-xs text-red-700">Messages could not be loaded.</p><ActionButton type="button" className="mt-2 text-xs underline" onClick={() => thread.refetch()}>Try again</ActionButton></li>
        : messages?.length ? messages.map(message => <Bubble key={message.id} message={message} timeZone={timeZone} />)
        : <li className="py-10 text-center text-xs text-slate-500">No messages.</li>}
    </ol>
    {thread.error && messages && <p role="alert" className="text-xs text-red-700">Messages could not be refreshed. <ActionButton type="button" className="underline" onClick={() => thread.refetch()}>Try again</ActionButton></p>}
    {channel.can_send ? <form className="public-chat-composer app-message-composer" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label className="sr-only" htmlFor={composerId}>Message {channel.title}</label>
      <textarea ref={composer} id={composerId} rows={1} disabled={send.isPending} maxLength={MAX_LENGTH} value={draft} placeholder="Write a message…" className="public-chat-input"
        onChange={event => { setDraft(event.target.value); attempt.current = crypto.randomUUID(); cache.setQueryData([...draftKey, 'attempt'], attempt.current); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
      {/* Keep the send action aligned with the shared composer. */}
      <Button type="submit" size="icon-sm" className="public-chat-send" disabled={!body || send.isPending} aria-busy={send.isPending}
        aria-label={send.isPending ? 'Sending message' : 'Send message'} title="Send (Enter)"><ArrowUp className="size-5" strokeWidth={2.5} aria-hidden="true" /></Button>
    </form> : <p className="text-xs text-slate-500">{channel.closed_reason}</p>}
    {send.error && <p role="alert" className="text-xs text-red-700">{send.error.message || 'Message not sent. Try again.'}</p>}
  </div>;
}
