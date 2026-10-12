/** Unread count beside a navigation label; a dot on the collapsed rail. The item's accessible name carries the count. */
export function NavBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  return collapsed ? <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
    : <span aria-hidden className="ml-auto rounded-full bg-rose-100 px-1.5 text-xs font-medium text-rose-700">{count > 99 ? '99+' : count}</span>;
}
