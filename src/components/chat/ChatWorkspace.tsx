import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, MessageSquare, Plus } from 'lucide-react';
import { ADMIN_CHAT, chat, useChatPages, type ChatChannel, type ChatInboxItem, type ChatKind } from '../../chat/api';
import type { ChatTarget } from '../../chat/navigation';
import { dateTime } from '../../lib/dateTimeFormat';
import { Button } from '../ui/button';
import { SearchInput } from '../ui/SearchInput';
import { ChatThread } from './ChatThread';
import { NewChat } from './NewChat';

const labels: Record<ChatKind, string> = { DISPATCH_DRIVER: 'Driver', DISPATCH_SHIPPER: 'Shipper', DRIVER_SHIPPER: 'Driver–Shipper · Read-only', ADMIN_DISPATCHER: 'Admin' };
type Selected = ChatChannel & Partial<Pick<ChatInboxItem, 'order_id' | 'order_number' | 'order_status'>>;
async function selection(slug: string, target: ChatTarget): Promise<Selected> {
  if ('conversationId' in target) { const row = await chat.detail(slug, target.conversationId); return { ...row, driver_id: row.driver_id ?? null, closed_reason: row.closed_reason ?? null }; }
  if ('orderId' in target) {
    const channels = await chat.channels(slug, target.orderId);
    const channel = channels.find(row => row.kind === target.kind && (!target.driverId || row.driver_id === target.driverId));
    if (!channel) throw new Error('This conversation is no longer available.');
    return { ...channel, order_id: target.orderId };
  }
  if ('admin' in target) return chat.support(slug, target.dispatcherId);
  return 'driverId' in target ? chat.companyChannel(slug, target.driverId) : chat.shipperCompanyChannel(slug, target.shipperId);
}

/** The same inbox layout serves dispatch and admin; the API enforces their distinct audiences. */
export function ChatWorkspace({ slug, initialTarget, timeZone, onOpenOrder }: {
  slug: string; initialTarget?: ChatTarget | null; timeZone?: string; onOpenOrder?: (id: string) => void;
}) {
  const admin = slug === ADMIN_CHAT;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [target, setTarget] = useState<ChatTarget | null>(initialTarget ?? null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (initialTarget) { setTarget(initialTarget); setCreating(false); } }, [initialTarget]);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const inbox = useChatPages(slug, { search: query, unread_only: filter === 'unread', kind: filter === 'all' || filter === 'unread' ? undefined : filter as ChatKind });
  const rows = [...new Map((inbox.data?.pages.flatMap(page => page.items) ?? []).map(row => [row.conversation_id, row])).values()];
  const current = useQuery({ queryKey: ['chat', slug, 'detail', target], queryFn: () => selection(slug, target!), enabled: !!target,
    refetchInterval: admin ? 4_000 : false });
  const channel = current.data;
  const select = (next: ChatTarget) => { setTarget(next); setCreating(false); };
  const selected = channel?.conversation_id;
  useEffect(() => {
    const url = new URL(location.href);
    if (selected && target) url.searchParams.set('conversation', selected); else url.searchParams.delete('conversation');
    history.replaceState(history.state, '', url);
  }, [selected, target]);
  return <div className="flex h-full min-h-[440px] min-w-0 overflow-hidden rounded-xl border border-app-border bg-white" aria-label={admin ? 'Dispatcher chats' : 'All conversations'}>
    <aside className={`${target || creating ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-app-border md:w-80`} aria-label="Conversations">
      <div className="space-y-3 border-b border-app-border p-4">
        <div className="flex items-center justify-between"><h2 className="app-section-title">Conversations</h2><Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={() => setCreating(true)}><Plus className="size-4" /></Button></div>
        <SearchInput aria-label="Search conversations" value={search} onChange={setSearch} placeholder={admin ? 'Search dispatchers, companies, messages…' : 'Search people, orders, messages…'} />
        <div className="flex flex-wrap gap-1" aria-label="Filter conversations">{[
          ['all', 'All'], ['unread', 'Unread'], ...(!admin ? [['DISPATCH_DRIVER', 'Drivers'], ['DISPATCH_SHIPPER', 'Shippers'], ['DRIVER_SHIPPER', 'Driver–Shipper'], ['ADMIN_DISPATCHER', 'Admin']] : []),
        ].map(([value, label]) => <button key={value} type="button" className="app-tab px-2 py-1 text-xs" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {inbox.isPending && <p role="status" className="p-5 text-sm text-app-muted">Loading conversations…</p>}
        {inbox.error && <p role="alert" className="p-4 text-sm text-red-700">Conversations could not be loaded. <button className="underline" onClick={() => void inbox.refetch()}>Try again</button></p>}
        {!inbox.isPending && !inbox.error && !rows.length && <p className="p-5 text-sm text-app-muted">{query || filter !== 'all' ? 'No matching conversations.' : 'No conversations yet. Start a new chat.'}</p>}
        <ul>{rows.map(row => <li key={row.conversation_id}><button type="button" aria-current={selected === row.conversation_id ? 'true' : undefined}
          aria-label={`${row.title}${row.unread ? `, ${row.unread} unread` : ''}${row.can_send ? '' : ', read-only'}`}
          className={`w-full border-b border-app-border p-4 text-left hover:bg-app-hover ${selected === row.conversation_id ? 'bg-slate-100' : ''}`}
          onClick={() => select({ conversationId: row.conversation_id })}>
          <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{row.title}</span>{row.unread > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-xs text-rose-700">{row.unread}</span>}</span>
          <span className="mt-1 block truncate text-xs text-app-muted">{admin ? row.company_name : labels[row.kind]}{row.order_number ? ` · ${row.order_number}` : ''}{row.order_status ? ` · ${row.order_status.replaceAll('_',' ').toLowerCase()}` : ''}</span>
          <span className="mt-2 block truncate text-xs text-slate-600">{row.last_message?.body}</span>
          <time title={timeZone} className="mt-1 block text-[10px] text-app-muted">{dateTime(row.last_message_at, timeZone)}</time>
        </button></li>)}</ul>
        {inbox.hasNextPage && <div className="p-3"><Button variant="outline" className="w-full" disabled={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>Older conversations</Button></div>}
      </div>
    </aside>
    <section className={`${target || creating ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`} aria-label="Selected conversation">
      {creating ? <NewChat slug={slug} onSelect={select} onClose={() => setCreating(false)} /> : !target ? <div className="m-auto p-6 text-center text-app-muted"><MessageSquare className="mx-auto mb-3 size-8" /><p>Select a conversation to see its history.</p><Button className="mt-4" onClick={() => setCreating(true)}>New chat</Button></div>
        : <>
          <header className="flex items-center gap-3 border-b border-app-border p-4">
            <Button size="icon-sm" variant="ghost" aria-label="Back to conversations" onClick={() => setTarget(null)}><ArrowLeft className="size-4" /></Button>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{channel?.title ?? 'Conversation'}</h2><p className="text-xs text-app-muted">{channel ? admin ? channel.company_name : labels[channel.kind] : ''}{channel?.order_number ? ` · ${channel.order_number}` : ''}</p></div>
            {channel?.order_id && onOpenOrder && <Button variant="outline" size="sm" onClick={() => onOpenOrder(channel.order_id!)}>Open order<ArrowUpRight className="size-4" /></Button>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
            {current.isPending ? <p role="status">Loading conversation…</p> : current.error ? <p role="alert" className="text-sm text-red-700">This conversation could not be opened. <button type="button" className="underline" onClick={() => void current.refetch()}>Try again</button></p> : channel &&
              <ChatThread key={JSON.stringify(target)} slug={slug} orderId={channel.order_id ?? undefined} driverId={channel.driver_id ?? undefined} shipperId={channel.shipper_id ?? undefined} channel={channel} fullHeight timeZone={timeZone} />}
          </div>
        </>}
    </section>
  </div>;
}
