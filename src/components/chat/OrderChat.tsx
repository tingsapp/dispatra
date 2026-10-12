import { useRef, useState } from 'react';
import { useOrderChannels, type ChatChannel, type ChatKind } from '../../chat/api';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { useEntityDialog } from '../entities/useEntityDialog';
import { ChatThread } from './ChatThread';

const channelKey = (channel: ChatChannel) => `${channel.kind}:${channel.driver_id ?? ''}`;

/** An Order's chats for the signed-in account: one tab per counterpart (the API decides which exist and which are read-only). */
export function OrderChat({ slug, orderId, initialKind, initialConversation }: { slug: string; orderId: string; initialKind?: ChatKind; initialConversation?: string }) {
  const channels = useOrderChannels(slug, orderId);
  const [selected, setSelected] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const rows = channels.data ?? [];
  const current = rows.find(row => channelKey(row) === selected) ?? rows.find(row => initialConversation && row.conversation_id === initialConversation)
    ?? rows.find(row => row.kind === initialKind) ?? rows[0];
  if (channels.isPending) return <p role="status" className="py-6 text-center text-xs text-slate-500">Loading chats…</p>;
  if (channels.error) return <p role="alert" className="py-6 text-center text-xs text-red-700">Chats could not be loaded.</p>;
  if (!current) return <p className="py-6 text-center text-xs text-slate-500">No chats are available for this order.</p>;
  const select = (index: number) => { setSelected(channelKey(rows[index])); tabs.current[index]?.focus(); };
  return <div className="space-y-3">
    {rows.length > 1 && <div role="tablist" aria-label="Chats" className="flex flex-wrap gap-1">
      {rows.map((row, index) => {
        const active = channelKey(row) === channelKey(current);
        return <button key={channelKey(row)} ref={node => { tabs.current[index] = node; }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
          className="app-tab inline-flex items-center gap-1.5" onClick={() => setSelected(channelKey(row))}
          aria-label={`${row.title}${row.unread ? `, ${row.unread} unread` : ''}${row.can_send ? '' : ', read-only'}`}
          onKeyDown={event => {
            const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: rows.length - 1 }[event.key];
            if (next === undefined) return;
            event.preventDefault(); select((next + rows.length) % rows.length);
          }}>
          <span>{row.title}</span>
          {row.unread > 0 && <span aria-hidden className="rounded-full bg-rose-100 px-1.5 text-xs font-medium text-rose-700">{row.unread}</span>}
        </button>;
      })}
    </div>}
    <div role={rows.length > 1 ? 'tabpanel' : undefined}><ChatThread key={channelKey(current)} slug={slug} orderId={orderId} channel={current} /></div>
  </div>;
}

/** Order details section; chat history stays with the order. */
export function OrderChatSection({ slug, orderId }: { slug: string; orderId: string }) {
  return <section aria-label="Messages" className="rounded-xl border border-slate-200 p-5 space-y-3">
    <h4 className="app-section-title">Messages</h4>
    <OrderChat slug={slug} orderId={orderId} />
  </section>;
}

/** Stand-alone chat for one order, opened from tracking or the Messages inbox. */
export function ChatDialog({ slug, orderId, orderNumber, initialKind, onClose }: { slug: string; orderId: string; orderNumber?: string; initialKind?: ChatKind; onClose: () => void }) {
  useEntityDialog(true, onClose);
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={orderNumber ? `Messages · ${orderNumber}` : 'Messages'} description="Chats stay with this order and become read-only once it is completed." />
    <DialogBody><OrderChat slug={slug} orderId={orderId} initialKind={initialKind} /></DialogBody>
  </Dialog>;
}
