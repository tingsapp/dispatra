import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';

type ContentProps = ComponentProps<typeof PopoverContent>;
type FloatingPanelProps = Pick<ContentProps, 'id' | 'side' | 'align' | 'role' | 'onKeyDown' | 'avoidCollisions'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  label: string;
  children: ReactNode;
  className?: string;
  size?: 'menu' | 'compact' | 'rich' | 'auto';
  focusOnOpen?: boolean;
  autoFocusSelector?: string;
  restoreFocus?: boolean;
  modal?: boolean;
  anchor?: ReactElement;
  dismissible?: boolean;
};

/** Shared positioning, dismissal, focus and motion for menus and rich popovers. */
export function FloatingPanel({ open, onOpenChange, trigger, label, children,
  side = 'bottom', align = 'start', role = 'dialog', className, focusOnOpen = true,
  restoreFocus = true, modal = false, onKeyDown, id, autoFocusSelector, size = 'menu',
  anchor, dismissible = true, avoidCollisions = true }: FloatingPanelProps) {
  return <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    {anchor && <PopoverAnchor asChild>{anchor}</PopoverAnchor>}
    <PopoverContent side={side} align={align} sideOffset={8} collisionPadding={12} avoidCollisions={avoidCollisions}
      {...(id ? { id } : {})} role={role} aria-label={label} aria-hidden={!open} inert={!open}
      data-panel-size={size}
      className={cn('app-floating-panel p-1.5', className)}
      onKeyDown={onKeyDown}
      onInteractOutside={event => { if (!dismissible) event.preventDefault(); }}
      onEscapeKeyDown={event => { if (!dismissible) event.preventDefault(); }}
      onOpenAutoFocus={event => {
        if (!focusOnOpen) event.preventDefault();
        else if (autoFocusSelector && event.target instanceof HTMLElement) {
          const target = event.target.querySelector<HTMLElement>(autoFocusSelector);
          if (target) { event.preventDefault(); target.focus(); }
        }
      }}
      onCloseAutoFocus={event => { if (!restoreFocus) event.preventDefault(); }}>
      <div className="app-floating-panel-scroll">{children}</div>
    </PopoverContent>
  </Popover>;
}
