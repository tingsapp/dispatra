import { useState } from 'react';
import { useChatInbox, type ChatInboxItem } from '../../chat/api';
import { notificationAge } from '../../portal/Notifications';
import { ChatDialog } from './OrderChat';

function InboxRow({ item, current, onSelect }: { item: ChatInboxItem; current: boolean; onSelect: () => void }) {
  const preview = item.last_message ? `${item.last_message.mine ? 'You: ' : ''}${item.last_message.body}` : '';
  return <li><button type="button" onClick={onSelect} aria-current={current || undefined}
    aria-label={`${item.unread ? `${item.unread} unread. ` : ''}${item.title}, order ${item.order_number}. ${preview}`}
    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${current ? 'bg-slate-100' : item.unread ? 'bg-app-accent-soft/40' : ''}`}>
    <span className="flex items-center justify-between gap-2">
      <span className={`truncate text-sm text-slate-900 ${item.unread ? 'font-medium' : ''}`}>{item.title}</span>
      {item.last_message_at && <span className="shrink-0 text-xs text-slate-400">{notificationAge(item.last_message_at)}</span>}
    </span>
    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
      <span className="shrink-0 font-medium text-slate-600">{item.order_number}</span>
      <span className="min-w-0 flex-1 truncate">{preview}</span>
      {item.unread > 0 && <span aria-hidden className="shrink-0 rounded-full bg-rose-100 px-1.5 font-medium text-rose-700">{item.unread}</span>}
      {!item.can_send && <span className="shrink-0 text-slate-400">Read-only</span>}
    </span>
  </button></li>;
}

/** Shipper and driver inboxes use the same conversation popup as order contacts. */
export function MessagesInbox({ slug }: { slug: string }) {
  const inbox = useChatInbox(slug);
  const [selected, setSelected] = useState<ChatInboxItem | null>(null);
  const rows = inbox.data ?? [];
  const current = selected && (inbox.data ?? []).find(item => item.conversation_id === selected.conversation_id) || selected;
  return <div className="min-w-0 space-y-3">
    {inbox.isPending ? <p role="status" className="py-10 text-center text-sm text-slate-500">Loading messages…</p>
      : inbox.error ? <p role="alert" className="py-10 text-center text-sm text-red-700">Messages could not be loaded.</p>
      : rows.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No messages yet. Chats start from an order’s details.</p>
      : <ul className="mx-auto max-w-2xl space-y-0.5">{rows.map(item => <InboxRow key={item.conversation_id} item={item} current={item.conversation_id === current?.conversation_id} onSelect={() => setSelected(item)} />)}</ul>}
    {current && <ChatDialog slug={slug} orderId={current.order_id} orderNumber={current.order_number} initialConversation={current.conversation_id} onClose={() => setSelected(null)} />}
  </div>;
}
