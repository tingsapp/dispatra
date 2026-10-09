import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allOperations } from '../operations/api';
import { ORDER_LIFECYCLE_LABELS, normalizeLifecycle } from '../domain/operations';
import { SearchInput } from '../components/ui/SearchInput';
import { Popover, PopoverAnchor, PopoverContent } from '../components/ui/popover';

/** The session-scoped Shipper feed is the sole source, including historical orders. */
export function ShipperOrderSearch({ slug, onSelect }: { slug: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const outside = useRef(false);
  const id = useId();
  const orders = useQuery({ queryKey: ['shipper-orders', slug], queryFn: () => allOperations.orders(slug) });
  const term = search.trim().toLowerCase();
  const matches = (orders.data ?? []).filter(order => [order.number, order.facts.external_reference,
    ...order.facts.stops.map(stop => stop.address.text)].some(text => text?.toLowerCase().includes(term)));
  const choose = (identity: string) => { setOpen(false); setSearch(''); onSelect(identity); };
  return <Popover open={open && !!term} onOpenChange={setOpen}>
    <PopoverAnchor asChild>
      <div ref={anchor} className="shipper-order-search">
        <SearchInput value={search} onChange={value => { setSearch(value); setOpen(true); }} placeholder="Search your orders" aria-label="Search your orders" className="w-full"
          inputProps={{ onClick: () => setOpen(true), 'aria-expanded': open && !!term, 'aria-controls': open && term ? id : undefined,
            onKeyDown: event => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'ArrowDown' && open && term) { event.preventDefault(); panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
              if (event.key === 'Enter' && term && matches.length === 1) { event.preventDefault(); choose(matches[0].id); }
            } }} />
      </div>
    </PopoverAnchor>
    <PopoverContent ref={panel} id={id} align="end" sideOffset={8} collisionPadding={12} aria-label="Your order search results"
      className="app-floating-panel w-96 max-w-[calc(100vw-24px)] p-1.5"
      onOpenAutoFocus={event => { event.preventDefault(); outside.current = false; }}
      onCloseAutoFocus={event => { event.preventDefault(); if (!outside.current) anchor.current?.querySelector('input')?.focus(); }}
      onInteractOutside={event => { if (anchor.current?.contains(event.target as Node)) event.preventDefault(); else outside.current = true; }}>
      {orders.isPending ? <p role="status" className="p-3 text-sm text-app-muted">Loading orders…</p>
        : orders.error ? <div className="p-3 text-sm"><p role="alert">Unable to search your orders.</p><button className="app-action app-secondary mt-2" onClick={() => void orders.refetch()}>Try again</button></div>
        : !matches.length ? <p role="status" className="p-3 text-sm text-app-muted">No matching orders.</p>
        : <div className="max-h-80 overflow-y-auto" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }}>
          {matches.map(order => <button key={order.id} type="button" className="app-menu-item flex w-full flex-col items-start gap-1 text-left" onClick={() => choose(order.id)}>
            <span className="flex w-full items-center justify-between gap-3"><span>{order.number}</span><span className="text-xs text-app-muted">{ORDER_LIFECYCLE_LABELS[normalizeLifecycle(order.status) ?? 'NEW']}</span></span>
            <span className="max-w-full truncate text-xs text-app-muted">{order.facts.stops.map(stop => stop.address.text).join(' → ')}</span>
          </button>)}
        </div>}
    </PopoverContent>
  </Popover>;
}
