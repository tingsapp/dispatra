import type { ReactElement } from 'react';
import { HelpCircle, LogOut, Settings, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { SETTINGS_AREAS, type SettingsArea } from '../settings/SettingsLayout';

export function AccountMenu({ open, onOpenChange, trigger, activeTab, activeSettingsArea, modal = false, collapsed = false,
  onProfile, onSettings, onHelp, onLogout }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactElement;
  activeTab: string; activeSettingsArea?: SettingsArea;
  modal?: boolean;
  collapsed?: boolean;
  onProfile: () => void; onSettings: (area: SettingsArea) => void;
  onHelp: () => void; onLogout: () => void;
}) {
  return <DropdownMenu open={open} onOpenChange={onOpenChange} modal={modal}>
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
    <DropdownMenuContent side={collapsed ? 'right' : 'top'} sideOffset={collapsed ? 16 : 8} align={collapsed ? 'end' : 'start'} size={collapsed ? 'menu' : 'trigger'} collisionPadding={8} aria-label="Account menu" aria-labelledby={undefined}>
      <DropdownMenuItem icon={User} selected={activeTab === 'profile'} onSelect={onProfile}>Profile</DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={Settings} selected={!!activeSettingsArea}>Settings</DropdownMenuSubTrigger>
        <DropdownMenuSubContent aria-label="Settings">
          {SETTINGS_AREAS.map(area => <DropdownMenuItem key={area.id} icon={area.icon}
            aria-current={activeSettingsArea === area.id ? 'page' : undefined}
            onSelect={() => onSettings(area.id)}>{area.label}</DropdownMenuItem>)}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem icon={HelpCircle} selected={activeTab === 'help'} onSelect={onHelp}>Help</DropdownMenuItem>
      <DropdownMenuItem icon={LogOut} onSelect={onLogout}>Logout</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
