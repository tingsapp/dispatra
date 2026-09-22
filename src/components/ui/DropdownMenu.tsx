import type { ComponentProps } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { MenuItem } from './Menu';
import { cn } from '../../lib/utils';

export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export const DropdownMenuSub = Dropdown.Sub;

/** Command menus with native submenu hover intent, keyboard navigation and collision handling. */
export function DropdownMenuContent({ className, sideOffset = 8, collisionPadding = 12, size = 'menu', ...props }: ComponentProps<typeof Dropdown.Content> & { size?: 'menu' | 'trigger' }) {
  return <Dropdown.Portal><Dropdown.Content {...props} sideOffset={sideOffset} collisionPadding={collisionPadding}
    data-slot="dropdown-menu-content" data-menu-size={size} className={cn('app-menu-surface app-dropdown-panel p-1.5 space-y-0.5', className)} />
  </Dropdown.Portal>;
}

export function DropdownMenuSubContent({ className, sideOffset = 8, collisionPadding = 12, ...props }: ComponentProps<typeof Dropdown.SubContent>) {
  return <Dropdown.Portal><Dropdown.SubContent {...props} sideOffset={sideOffset} collisionPadding={collisionPadding}
    data-slot="dropdown-menu-content" className={cn('app-menu-surface app-dropdown-panel app-dropdown-submenu p-1.5 space-y-0.5', className)} />
  </Dropdown.Portal>;
}

type RowProps = { icon?: LucideIcon; selected?: boolean };
export function DropdownMenuItem({ icon, selected, children, ...props }: ComponentProps<typeof Dropdown.Item> & RowProps) {
  return <Dropdown.Item {...props} asChild><MenuItem icon={icon} selected={selected}>{children}</MenuItem></Dropdown.Item>;
}

export function DropdownMenuSubTrigger({ icon, selected, children, ...props }: ComponentProps<typeof Dropdown.SubTrigger> & RowProps) {
  return <Dropdown.SubTrigger {...props} asChild>
    <MenuItem icon={icon} selected={selected} trailing={<ChevronRight aria-hidden="true" className="w-4 h-4" />}>{children}</MenuItem>
  </Dropdown.SubTrigger>;
}
