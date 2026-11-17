import { ActionButton } from '../ui/button';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, MessageSquare, Plus } from 'lucide-react';
import { ADMIN_CHAT, useChatPages, type ChatInboxItem, type ChatKind } from '../../chat/api';
import type { ChatTarget } from '../../chat/navigation';
import { resolveChatTarget } from '../../chat/selection';
import { dateTime } from '../../lib/dateTimeFormat';
import { Button } from '../ui/button';
import { SearchInput } from '../ui/SearchInput';
import { ChatThread } from './ChatThread';
import { NewChat } from './NewChat';

const dispatchLabels: Record<ChatKind, string> = { DISPATCH_DRIVER: 'Driver', DISPATCH_SHIPPER: 'Shipper', DRIVER_SHIPPER: 'Driver–Shipper · Read-only', ADMIN_DISPATCHER: 'Dispatra' };
const shipperLabels: Record<ChatKind, string> = { ...dispatchLabels, DISPATCH_SHIPPER: 'Dispatch', DRIVER_SHIPPER: 'Driver' };
const wide = () => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches;

function ConversationButton({ title, unread, label, detail, last, at, current, timeZone, onClick }: { title: string; unread: number; label: string; detail: string; last?: ChatInboxItem['last_message']; at?: string | null; current: boolean; timeZone?: string; onClick: () => void }) {
  return <li><button type="button" aria-current={current ? 'true' : undefined} aria-label={label}
    className={`w-full border-b border-app-border p-4 text-left hover:bg-app-hover ${current ? 'bg-slate-100' : ''}`} onClick={onClick}>
    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{title}</span>{unread > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-xs text-rose-700">{unread}</span>}</span>
    <span className="mt-1 block truncate text-xs text-app-muted">{detail}</span>
    {last && <span className="mt-2 block truncate text-xs text-slate-600">{last.body}</span>}
    {at && <time title={timeZone} className="mt-1 block text-[10px] text-app-muted">{dateTime(at, timeZone)}</time>}
  </button></li>;
}

/** The same inbox layout serves dispatch, admin and a Shipper (`shipperId`); the API enforces their distinct audiences.
 *  The first tab's conversation is always open and pinned: Dispatra for a dispatcher, dispatch for a Shipper,
 *  whose driver chats are one per Order. Platform administration keeps All/Unread. */
export function ChatWorkspace({ slug, initialTarget, timeZone, onOpenOrder, shipperId }: {
  slug: string; initialTarget?: ChatTarget | null; timeZone?: string; onOpenOrder?: (id: string) => void; shipperId?: string;
}) {
  const admin = slug === ADMIN_CHAT;
  const labels = shipperId ? shipperLabels : dispatchLabels;
  const pin: { kind: ChatKind; target: ChatTarget } | null = admin ? null : shipperId ? { kind: 'DISPATCH_SHIPPER', target: { shipperId } } : { kind: 'ADMIN_DISPATCHER', target: { admin: true } };
  const pinnedChannel = useQuery({ queryKey: ['chat', slug, 'pinned', pin?.kind], queryFn: () => resolveChatTarget(slug, pin!.target), enabled: !!pin });
  const filters = admin ? [['all', 'All'], ['unread', 'Unread']]
    : shipperId ? [['DISPATCH_SHIPPER', 'Dispatch'], ['DRIVER_SHIPPER', 'Drivers']]
    : [['ADMIN_DISPATCHER', 'Dispatra'], ['DISPATCH_SHIPPER', 'Shipper'], ['DISPATCH_DRIVER', 'Driver']];
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(filters[0][0]);
  const [target, setTarget] = useState<ChatTarget | null>(() => initialTarget ?? (pin && wide() ? pin.target : null));
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (initialTarget) { setTarget(initialTarget); setCreating(false); } }, [initialTarget]);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const inbox = useChatPages(slug, { search: query, unread_only: filter === 'unread', kind: filter === 'all' || filter === 'unread' ? undefined : filter as ChatKind });
  const found = [...new Map((inbox.data?.pages.flatMap(page => page.items) ?? []).map(row => [row.conversation_id, row])).values()];
  const pinRow = pin && found.find(row => row.kind === pin.kind);
  const rows = found.filter(row => row !== pinRow);
  const pinned = !!pin && filter === pin.kind && (!query || !!pinRow);
  const current = useQuery({ queryKey: ['chat', slug, 'detail', target], queryFn: () => resolveChatTarget(slug, target!), enabled: !!target,
    refetchInterval: admin ? 4_000 : false });
  const channel = current.data;
  const select = (next: ChatTarget) => { setTarget(next); setCreating(false); };
  const selected = channel?.conversation_id;
  const pinOpen = !!target && ('shipperId' in target || 'admin' in target) || !!selected && selected === pinnedChannel.data?.conversation_id;
  const pinTitle = pinnedChannel.data?.title ?? (pin ? labels[pin.kind] : '');
  useEffect(() => {
    const url = new URL(location.href);
    if (selected && target) url.searchParams.set('conversation', selected); else url.searchParams.delete('conversation');
    history.replaceState(history.state, '', url);
  }, [selected, target]);
  return <div className="flex h-full min-h-[440px] min-w-0 overflow-hidden rounded-xl border border-app-border bg-white" aria-label={admin ? 'Dispatcher chats' : 'All conversations'}>
    <aside className={`${target || creating ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-app-border md:w-80`} aria-label="Conversations">
      <div className="space-y-3 border-b border-app-border p-4">
        <div className="flex items-center justify-between"><h2 className="app-section-title">Conversations</h2><Button variant="ghost" size="icon-sm" aria-label={shipperId ? 'New driver chat' : 'New chat'} title={shipperId ? 'New driver chat' : 'New chat'} onClick={() => setCreating(true)}><Plus className="size-4" /></Button></div>
        <SearchInput aria-label="Search conversations" value={search} onChange={setSearch} placeholder={admin ? 'Search dispatchers, companies, messages…' : shipperId ? 'Search drivers, orders, messages…' : 'Search people, orders, messages…'} />
        <div className="flex flex-nowrap gap-1 overflow-x-auto" aria-label="Filter conversations">{filters.map(([value, label]) => <button key={value} type="button" className="app-tab shrink-0 whitespace-nowrap px-2 py-1 text-xs" aria-label={value === 'DRIVER_SHIPPER' && !shipperId ? 'Driver–Shipper' : undefined} title={value === 'DRIVER_SHIPPER' && !shipperId ? 'Driver–Shipper' : undefined} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inbox.isPending && <p role="status" className="p-5 text-sm text-app-muted">Loading conversations…</p>}
        {inbox.error && <p role="alert" className="p-4 text-sm text-red-700">Conversations could not be loaded. <ActionButton className="underline" onClick={() => inbox.refetch()}>Try again</ActionButton></p>}
        {!inbox.isPending && !inbox.error && !rows.length && !pinned && <p className="p-5 text-sm text-app-muted">{query || admin && filter !== 'all' ? 'No matching conversations.' : shipperId ? 'No driver chats yet. Use + to message the driver of an order.' : 'No conversations yet. Start a new chat.'}</p>}
        <ul>
          {pinned && <ConversationButton title={pinTitle} unread={pinnedChannel.data?.unread ?? 0} label={`${pinTitle}, always open${pinnedChannel.data?.unread ? `, ${pinnedChannel.data.unread} unread` : ''}`}
            detail="Always open" last={pinRow?.last_message} at={pinRow?.last_message_at} current={pinOpen} timeZone={timeZone} onClick={() => select(pin.target)} />}
          {rows.map(row => <ConversationButton key={row.conversation_id} title={row.title} unread={row.unread} current={selected === row.conversation_id} timeZone={timeZone}
            label={`${row.title}${row.unread ? `, ${row.unread} unread` : ''}${row.can_send ? '' : ', read-only'}`}
            detail={`${admin ? row.company_name : labels[row.kind]}${row.order_number ? ` · ${row.order_number}` : ''}${row.order_status ? ` · ${row.order_status.replaceAll('_',' ').toLowerCase()}` : ''}`}
            last={row.last_message} at={row.last_message_at} onClick={() => select({ conversationId: row.conversation_id })} />)}
        </ul>
        {inbox.hasNextPage && <div className="p-3"><Button variant="outline" className="w-full" disabled={inbox.isFetchingNextPage} onClick={() => inbox.fetchNextPage()}>Older conversations</Button></div>}
      </div>
    </aside>
    <section className={`${target || creating ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`} aria-label="Selected conversation">
      {creating ? <NewChat slug={slug} shipperId={shipperId} onSelect={select} onClose={() => setCreating(false)} /> : !target ? <div className="m-auto p-6 text-center text-app-muted"><MessageSquare className="mx-auto mb-3 size-8" /><p>Select a conversation to see its history.</p><Button className="mt-4" onClick={() => shipperId ? select({ shipperId }) : setCreating(true)}>{shipperId ? 'Message dispatch' : 'New chat'}</Button></div>
        : <>
          <header className="flex items-center gap-3 border-b border-app-border p-4">
            <Button size="icon-sm" variant="ghost" aria-label="Back to conversations" onClick={() => setTarget(null)}><ArrowLeft className="size-4" /></Button>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{channel?.title ?? 'Conversation'}</h2><p className="text-xs text-app-muted">{channel ? admin ? channel.company_name : labels[channel.kind] : ''}{channel?.order_number ? ` · ${channel.order_number}` : ''}</p></div>
            {channel?.order_id && onOpenOrder && <Button variant="outline" size="sm" onClick={() => onOpenOrder(channel.order_id!)}>Open order<ArrowUpRight className="size-4" /></Button>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
            {current.isPending ? <p role="status">Loading conversation…</p> : current.error ? <p role="alert" className="text-sm text-red-700">This conversation could not be opened. <ActionButton type="button" className="underline" onClick={() => current.refetch()}>Try again</ActionButton></p> : channel &&
              <ChatThread key={JSON.stringify(target)} slug={slug} orderId={channel.order_id ?? undefined} driverId={channel.driver_id ?? undefined} shipperId={channel.shipper_id ?? undefined} channel={channel} fullHeight page={!!shipperId} timeZone={timeZone} />}
          </div>
        </>}
    </section>
  </div>;
}
