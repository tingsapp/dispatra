import type { ReactElement } from 'react';
import { FileText, HelpCircle, LogOut, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

export function AccountMenu({ open, onOpenChange, trigger, activeTab, modal = false, collapsed = false,
  onProfile, onPricing, onHelp, onLogout }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactElement;
  activeTab: string;
  modal?: boolean;
  collapsed?: boolean;
  onProfile: () => void; onPricing: () => void;
  onHelp: () => void; onLogout: () => void;
}) {
  return <DropdownMenu open={open} onOpenChange={onOpenChange} modal={modal}>
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
    <DropdownMenuContent side={collapsed ? 'right' : 'top'} sideOffset={collapsed ? 16 : 8} align={collapsed ? 'end' : 'start'} size={collapsed ? 'menu' : 'trigger'} collisionPadding={8} aria-label="Account menu" aria-labelledby={undefined}>
      <DropdownMenuItem icon={User} selected={activeTab === 'profile'} onSelect={onProfile}>Profile</DropdownMenuItem>
      <DropdownMenuItem icon={FileText} selected={activeTab === 'rate-cards'} onSelect={onPricing}>Pricing</DropdownMenuItem>
      <DropdownMenuItem icon={HelpCircle} selected={activeTab === 'help'} onSelect={onHelp}>Help</DropdownMenuItem>
      <DropdownMenuItem icon={LogOut} onSelect={onLogout}>Logout</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
