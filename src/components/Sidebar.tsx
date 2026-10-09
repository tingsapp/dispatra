import {
  BarChart2,
  Building2,
  ClipboardList,
  Plug,
  Truck,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Switch } from './ui/Switch';
import { AccountMenu } from './layout/AccountMenu';
import { SidebarHeader } from './layout/SidebarHeader';
import { useSidebarDrawer } from './layout/useSidebarDrawer';
import { useWorkspaceAccount } from '../portal/WorkspaceAccount';
import { loadUserProfile } from '../lib/profileStorage';

interface SidebarProps {
  activeTab: string;
  isOpen: boolean;
  onToggle: () => void;
  setActiveTab: (tab: string) => void;
  showAccountPopover: boolean;
  setShowAccountPopover: React.Dispatch<React.SetStateAction<boolean>>;
  onActionNotification: (msg: string) => void;
  /** Ends the dispatcher session and returns to the login page. */
  onLogout?: () => void;
  onOpenPricing?: () => void;
  dispatchMode: 'AUTO' | 'MANUAL';
  onDispatchModeChange: (mode: 'AUTO' | 'MANUAL') => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  isOpen,
  onToggle,
  setActiveTab,
  showAccountPopover,
  setShowAccountPopover,
  onActionNotification,
  onLogout,
  onOpenPricing,
  dispatchMode,
  onDispatchModeChange,
  onOpenProfile,
  onOpenHelp
}) => {
  const { mobile, panelRef } = useSidebarDrawer(isOpen, () => { if (isOpen) onToggle(); });
  const collapsed = !isOpen && !mobile;
  const hidden = !isOpen && mobile;
  const [localProfile, setProfile] = useState(() => loadUserProfile());

  useEffect(() => {
    const handleSync = () => {
      setProfile(loadUserProfile());
    };
    window.addEventListener('storage', handleSync);
    handleSync();
    return () => window.removeEventListener('storage', handleSync);
  }, [activeTab, showAccountPopover]);

  const workspace = useWorkspaceAccount();
  const name = workspace?.settings.data.contact_name || workspace?.account.login_id || '';
  const profile = workspace ? { name, role: 'Dispatcher', avatarInitials: name.slice(0, 1).toUpperCase(), avatarUrl: '' } : localProfile;

  const navItems = [
    { id: 'jobs', label: 'Orders', icon: ClipboardList },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'customers', label: 'Shippers', icon: Building2 },
    { id: 'reports', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <div
      className={`h-dvh shrink-0 transition-[width] duration-300 ease-in-out z-30 max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:z-50 ${isOpen ? 'w-sidebar' : collapsed ? 'w-sidebar-rail' : 'w-0'
        }`}
    >
      <aside
        ref={panelRef}
        role={mobile && isOpen ? 'dialog' : undefined}
        aria-modal={mobile && isOpen ? true : undefined}
        aria-label="Main navigation"
        aria-hidden={hidden}
        inert={hidden}
        data-collapsed={collapsed}
        className={`${collapsed ? 'app-sidebar-rail w-sidebar-rail' : 'w-sidebar'} h-dvh bg-app-sidebar border-r border-app-border flex flex-col justify-between select-none relative transition-[width,transform] duration-300 ease-in-out ${hidden ? '-translate-x-full' : 'translate-x-0'
          }`}
      >
        {/* Top brand */}
        <div>
          <SidebarHeader collapsed={collapsed} mobile={mobile} label="Dispatra — Monitor" current={activeTab === 'monitor'} onToggle={onToggle} onHome={() => {
              setShowAccountPopover(false);
              setActiveTab('monitor');
              if (mobile) onToggle();
            }} />

          {/* Navigation list */}
          <nav className="px-2 py-1 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onActionNotification(`Navigated to ${item.label}`);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                  className="app-nav-item"
                >
                  <Icon className="w-4.5 h-4.5 shrink-0 text-slate-700" strokeWidth={1.75} />
                  <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Dispatcher Profile & Anchored Account Popover */}
        <div className="p-2">
          <button type="button" aria-label="Integrations" title={collapsed ? 'Integrations' : undefined}
            aria-current={activeTab === 'integrations' ? 'page' : undefined} className="app-nav-item mb-1"
            onClick={() => { setShowAccountPopover(false); setActiveTab('integrations'); }}>
            <Plug className="w-4.5 h-4.5 shrink-0 text-slate-700" strokeWidth={1.75} />
            <span className={collapsed ? 'sr-only' : undefined}>Integrations</span>
          </button>
          <AccountMenu open={showAccountPopover} onOpenChange={setShowAccountPopover}
            modal={mobile}
            collapsed={collapsed}
            activeTab={activeTab}
            onProfile={() => { setActiveTab('profile'); onOpenProfile?.(); }}
            onPricing={() => { onOpenPricing?.(); }}
            onHelp={() => { setActiveTab('help'); onOpenHelp?.(); }}
            onLogout={() => { if (onLogout) onLogout(); else onActionNotification('Logged out dispatcher session'); }}
            trigger={
          <button
            type="button"
            aria-expanded={showAccountPopover}
            aria-label="Dispatcher Account"
            className="app-account-card group"
            title="Dispatcher Account"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 overflow-hidden">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                profile.avatarInitials || 'SK'
              )}
            </div>
            <div className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>
              <div className="app-account-name text-sm font-medium text-slate-900 leading-snug truncate">
                {(profile.name || 'Sarah').trim().split(/\s+/)[0]}
              </div>
              <div className="text-xs text-slate-500 truncate">{profile.role || 'Dispatcher'}</div>
            </div>
          </button>
            }
          />

          <div className={`mt-1 flex items-center py-3 ${collapsed ? 'justify-center' : 'justify-between px-3'}`} title={collapsed ? `Auto dispatch: ${dispatchMode === 'AUTO' ? 'on' : 'off'}` : undefined}>
            <span className={collapsed ? 'sr-only' : 'text-sm font-normal text-slate-700'}>Auto dispatch</span>
            <Switch
              checked={dispatchMode === 'AUTO'}
              aria-label="Auto dispatch"
              onCheckedChange={checked => {
                onDispatchModeChange(checked ? 'AUTO' : 'MANUAL');
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
};
