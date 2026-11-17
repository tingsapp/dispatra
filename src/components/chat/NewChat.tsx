import { ActionButton } from '../ui/button';
import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ADMIN_CHAT, chat } from '../../chat/api';
import type { ChatTarget } from '../../chat/navigation';
import { allOperations } from '../../operations/api';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/button';

/** Contact picker is shared, but platform accounts only query dispatcher contacts and a Shipper picks one of its Orders with a driver. */
export function NewChat({ slug, shipperId, onSelect, onClose }: { slug: string; shipperId?: string; onSelect: (target: ChatTarget) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const admin = slug === ADMIN_CHAT;
  const orders = useQuery({ queryKey: ['shipper-orders', slug], queryFn: () => allOperations.orders(slug), enabled: !!shipperId });
  const dispatchers = useInfiniteQuery({ queryKey: ['chat', slug, 'contacts', search], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => chat.contacts(search, pageParam), getNextPageParam: page => page.next_cursor ?? undefined, enabled: admin });
  const drivers = useQuery({ queryKey: ['operations', slug, 'drivers'], queryFn: () => allOperations.drivers(slug), enabled: !admin && !shipperId });
  const shippers = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug), enabled: !admin && !shipperId });
  const rows: { id: string; name: string; description: string; target: ChatTarget }[] = admin
    ? (dispatchers.data?.pages.flatMap(page => page.items) ?? []).map(row => ({ id: row.id, name: row.name, description: row.company_name, target: { admin: true, dispatcherId: row.id } }))
    : shipperId ? (orders.data ?? []).filter(order => ['ASSIGNED', 'IN_PROGRESS'].includes(order.status))
      .map(order => ({ id: order.id, name: order.number, description: `Driver · ${order.status.replaceAll('_', ' ').toLowerCase()}`, target: { orderId: order.id, kind: 'DRIVER_SHIPPER' } }))
    : [{ id: 'admin', name: 'Dispatra', description: 'Platform administration', target: { admin: true } },
      ...(drivers.data ?? []).map(row => ({ id: row.id, name: row.name, description: 'Driver', target: { driverId: row.id } })),
      ...(shippers.data ?? []).map(row => ({ id: row.id, name: row.company_name || row.name, description: 'Shipper', target: { shipperId: row.id } }))];
  const filtered = admin ? rows : rows.filter(row => `${row.name} ${row.description}`.toLowerCase().includes(search.toLowerCase()));
  const error = admin ? dispatchers.error : shipperId ? orders.error : drivers.error || shippers.error;
  const pending = admin ? dispatchers.isPending : shipperId ? orders.isPending : drivers.isPending || shippers.isPending;
  return <section className="flex h-full min-h-0 flex-col gap-4 p-5" aria-label={shipperId ? 'New driver chat' : 'New chat'}>
    <div className="flex items-center justify-between gap-2"><h2 className="app-section-title">{shipperId ? 'New driver chat' : 'New chat'}</h2><Button variant="ghost" onClick={onClose}>Back</Button></div>
    <SearchInput value={search} onChange={setSearch} aria-label="Find a contact" placeholder={admin ? 'Find a dispatcher or company…' : shipperId ? 'Find an order…' : 'Find a driver or shipper…'} className="shrink-0 grow-0" />
    {pending && <p role="status">{shipperId ? 'Loading orders…' : 'Loading contacts…'}</p>}
    {error && <p role="alert">{shipperId ? 'Orders' : 'Contacts'} could not be loaded. <ActionButton className="underline" onClick={() => admin ? dispatchers.refetch() : shipperId ? orders.refetch() : Promise.all([drivers.refetch(), shippers.refetch()])}>Try again</ActionButton></p>}
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">{filtered.map(row => <li key={row.id}><button type="button" className="w-full rounded-lg p-3 text-left hover:bg-app-hover" onClick={() => onSelect(row.target)}>
      <span className="block text-sm font-medium">{row.name}</span><span className="text-xs text-app-muted">{row.description}</span>
    </button></li>)}{!pending && !error && !filtered.length && <li className="p-4 text-sm text-app-muted">{shipperId ? 'No active orders with a driver.' : 'No contacts found.'}</li>}</ul>
    {admin && dispatchers.hasNextPage && <Button variant="outline" disabled={dispatchers.isFetchingNextPage} onClick={() => dispatchers.fetchNextPage()}>More contacts</Button>}
  </section>;
}
