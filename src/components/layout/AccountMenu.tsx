import type { ReactElement } from 'react';
import { CreditCard, HelpCircle, LogOut, Plug, Settings, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

export function AccountMenu({ open, onOpenChange, trigger, activeTab, modal = false, collapsed = false,
  onProfile, onPricing, onSubscription, onIntegration, onHelp, onLogout }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactElement;
  activeTab: string;
  modal?: boolean;
  collapsed?: boolean;
  onProfile: () => void; onPricing?: () => void;
  onSubscription?: () => void; onIntegration?: () => void;
  onHelp?: () => void; onLogout: () => void;
}) {
  return <DropdownMenu open={open} onOpenChange={onOpenChange} modal={modal}>
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
    <DropdownMenuContent side={collapsed ? 'right' : 'top'} sideOffset={collapsed ? 16 : 8} align={collapsed ? 'end' : 'start'} size={collapsed ? 'menu' : 'trigger'} collisionPadding={8} aria-label="Account menu" aria-labelledby={undefined}>
      <DropdownMenuItem icon={User} selected={activeTab === 'profile'} onSelect={onProfile}>Profile</DropdownMenuItem>
      {onPricing && <DropdownMenuItem icon={Settings} selected={activeTab === 'rate-cards'} onSelect={onPricing}>Settings</DropdownMenuItem>}
      {onSubscription && <DropdownMenuItem icon={CreditCard} selected={activeTab === 'subscription'} onSelect={onSubscription}>Subscription</DropdownMenuItem>}
      {onIntegration && <DropdownMenuItem icon={Plug} selected={activeTab === 'integrations'} onSelect={onIntegration}>Integration</DropdownMenuItem>}
      {onHelp && <DropdownMenuItem icon={HelpCircle} selected={activeTab === 'help'} onSelect={onHelp}>Help</DropdownMenuItem>}
      <DropdownMenuItem icon={LogOut} onSelect={onLogout}>Logout</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
