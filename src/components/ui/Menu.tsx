import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/** A command row, distinct from a select option or a navigation tab. */
export function MenuItem({ icon: Icon, trailing, selected, className, children, ...props }:
  ComponentProps<'button'> & { icon?: LucideIcon; trailing?: ReactNode; selected?: boolean }) {
  return <button {...props} type="button" data-menu-item data-active={selected || undefined}
    className={cn('app-menu-item disabled:opacity-50', className)}>
    {Icon && <Icon aria-hidden="true" />}
    <span className="min-w-0 flex-1">{children}</span>
    {trailing}
  </button>;
}

export function MenuSeparator() {
  return <div role="separator" className="h-2" />;
}

/** Arrow/Home/End navigation without making nested controls fake ARIA menuitems. */
export function MenuList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-0.5', className)} onKeyDown={event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-menu-item]:not(:disabled)'))
      .filter(item => !item.closest('[hidden], [inert], [aria-hidden="true"]'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || !items.length) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }}>{children}</div>;
}
