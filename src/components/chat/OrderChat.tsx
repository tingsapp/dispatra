import { useRef, useState, type ReactNode } from 'react';
import { MessageSquare, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/button';
import { ChatPopup } from './ChatPopup';
import { useChatInbox, useOrderChannels, type ChatChannel, type ChatKind } from '../../chat/api';
import { ChatThread } from './ChatThread';

const channelKey = (channel: ChatChannel) => `${channel.kind}:${channel.driver_id ?? ''}`;

/** Contact entry points stay on that conversation; general Order messages can browse authorized chats. */
export function OrderChat({ slug, orderId, initialKind, initialConversation, expectedDriverId, orderNumber, orderPicker, driverOnly = false, onClose }: {
  slug: string; orderId: string; initialKind?: ChatKind; initialConversation?: string; expectedDriverId?: string; orderNumber?: string; orderPicker?: ReactNode; driverOnly?: boolean; onClose?: () => void;
}) {
  const channels = useOrderChannels(slug, orderId);
  const [selected, setSelected] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const available = (channels.data ?? []).filter(row => !driverOnly || row.kind === 'DRIVER_SHIPPER');
  const requested = available.find(row => initialConversation ? row.conversation_id === initialConversation
    : row.kind === initialKind && (!expectedDriverId || row.driver_id === expectedDriverId));
  const rows = initialKind || initialConversation ? (requested ? [requested] : []) : available;
  const current = rows.find(row => channelKey(row) === selected) ?? requested
    ?? (initialKind || initialConversation ? undefined : rows[0]);
  const select = (index: number) => { setSelected(channelKey(rows[index])); tabs.current[index]?.focus(); };
  const content = channels.isPending ? <p role="status" className="py-6 text-center text-xs text-slate-500">Loading chats…</p>
    : channels.error ? <div className="py-6 text-center"><p role="alert" className="text-sm text-red-700">Chats could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void channels.refetch()}>Try again</Button></div>
    : !current ? <p className="py-6 text-center text-xs text-slate-500">{driverOnly && rows.length === 0 ? 'Driver chat opens when a driver is assigned to this order.' : 'This conversation is unavailable. Reopen the order to view its current chats.'}</p>
    : <div className="flex min-h-0 flex-1 flex-col gap-3">
    {rows.length > 1 && <div role="tablist" aria-label="Chats" className="flex shrink-0 gap-1 overflow-x-auto py-1" style={{scrollbarWidth:'none'}}>
      {rows.map((row, index) => {
        const active = channelKey(row) === channelKey(current);
        return <button key={channelKey(row)} ref={node => { tabs.current[index] = node; }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
          className="app-tab inline-flex shrink-0 items-center gap-1.5" onClick={() => setSelected(channelKey(row))}
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
    <div className="flex min-h-0 flex-1 flex-col" role={rows.length > 1 ? 'tabpanel' : undefined}><ChatThread key={channelKey(current)} slug={slug} orderId={orderId} channel={current} /></div>
  </div>;
  return onClose ? <ChatPopup slug={slug} channel={!channels.isPending && !channels.error ? current : undefined} orderNumber={orderNumber} onClose={onClose}>{orderPicker}{content}</ChatPopup> : content;
}

/** Every order details view launches the same conversation popup. */
export function OrderChatSection({ slug, orderId, driverOnly = false }: { slug: string; orderId: string; driverOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const inbox = useChatInbox(slug, driverOnly);
  const unread = inbox.data?.find(row => row.order_id === orderId && row.kind === 'DRIVER_SHIPPER')?.unread ?? 0;
  return <section aria-label="Messages" className="rounded-xl border border-slate-200 p-4">
    <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-app-accent" aria-label={driverOnly ? "Open driver chat" : "Open order messages"}>
      <MessageSquare className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{driverOnly ? 'Chat with driver' : 'Messages'}{driverOnly && unread > 0 && <span className="ml-2 rounded-full bg-rose-100 px-1.5 text-xs text-rose-700" aria-label={`${unread} unread driver messages`}>{unread}</span>}</span><span className="mt-0.5 block text-xs text-slate-500">{driverOnly ? 'Talk with the driver assigned to this order.' : 'Talk with the people on this order.'}</span></span>
      <ArrowUpRight className="size-4 text-slate-400" aria-hidden="true" />
    </button>
    {open && <ChatDialog slug={slug} orderId={orderId} driverOnly={driverOnly} onClose={() => setOpen(false)} />}
  </section>;
}

/** One shared popup for order contacts, tracking, profiles and the inbox. */
export function ChatDialog({ slug, orderId, orderNumber, initialKind, initialConversation, expectedDriverId, orderPicker, driverOnly, onClose }: {
  slug: string; orderId: string; orderNumber?: string; initialKind?: ChatKind; initialConversation?: string; expectedDriverId?: string; orderPicker?: ReactNode; driverOnly?: boolean; onClose: () => void;
}) {
  return <OrderChat key={`${orderId}:${initialKind ?? initialConversation ?? ''}:${expectedDriverId ?? ''}`} slug={slug} orderId={orderId} initialKind={initialKind} initialConversation={initialConversation} expectedDriverId={expectedDriverId} orderNumber={orderNumber} orderPicker={orderPicker} driverOnly={driverOnly} onClose={onClose} />;
}
