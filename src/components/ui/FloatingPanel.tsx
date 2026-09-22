import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';

type ContentProps = ComponentProps<typeof PopoverContent>;
type FloatingPanelProps = Pick<ContentProps, 'id' | 'side' | 'align' | 'role' | 'onKeyDown'> & {
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
};

/** Shared positioning, dismissal, focus and motion for menus and rich popovers. */
export function FloatingPanel({ open, onOpenChange, trigger, label, children,
  side = 'bottom', align = 'start', role = 'dialog', className, focusOnOpen = true,
  restoreFocus = true, modal = false, onKeyDown, id, autoFocusSelector, size = 'menu' }: FloatingPanelProps) {
  return <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent side={side} align={align} sideOffset={8} collisionPadding={12}
      {...(id ? { id } : {})} role={role} aria-label={label} aria-hidden={!open} inert={!open}
      data-panel-size={size}
      className={cn('app-floating-panel p-1.5', className)}
      onKeyDown={onKeyDown}
      onOpenAutoFocus={event => {
        if (!focusOnOpen) event.preventDefault();
        else if (autoFocusSelector && event.target instanceof HTMLElement) {
          const target = event.target.querySelector<HTMLElement>(autoFocusSelector);
          if (target) { event.preventDefault(); target.focus(); }
        }
      }}
      onCloseAutoFocus={event => { if (!restoreFocus) event.preventDefault(); }}>
      {children}
    </PopoverContent>
  </Popover>;
}
