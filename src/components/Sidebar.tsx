import {
  BarChart2,
  Building2,
  ClipboardList,
  Settings,
  HelpCircle,
  Truck,
  User,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Switch } from './ui/Switch';
import { AccountMenu } from './layout/AccountMenu';
import { SidebarHeader } from './layout/SidebarHeader';
import { useSidebarDrawer } from './layout/useSidebarDrawer';
import { useWorkspaceAccount } from '../portal/WorkspaceAccount';
import { loadUserProfile, USER_PROFILE_UPDATED_EVENT } from '../lib/profileStorage';
import { BILLING_CONFIG_UPDATED_EVENT, loadBillingConfig } from '../lib/billingStorage';
import { SETTINGS_NAVIGATION_EVENT } from './settings/useSettingsGuard';
import { Notice } from '../portal/ui';

interface SidebarProps {
  tmsWorkspace?: boolean;
  loggingOut?: boolean;
  logoutError?: unknown;
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
  dispatchModePending?: boolean;
  dispatchMode: 'AUTO' | 'MANUAL';
  onDispatchModeChange: (mode: 'AUTO' | 'MANUAL') => void;
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tmsWorkspace = false,
  loggingOut = false,
  logoutError,
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
  dispatchModePending = false,
  onDispatchModeChange,
  onOpenProfile,
  onOpenHelp
}) => {
  const { mobile, panelRef } = useSidebarDrawer(isOpen, () => { if (isOpen) onToggle(); });
  const collapsed = !isOpen && !mobile;
  const hidden = !isOpen && mobile;
  const [localProfile, setProfile] = useState(() => loadUserProfile());
  const [localCompany, setLocalCompany] = useState(() => loadBillingConfig().company);

  useEffect(() => {
    const handleSync = () => {
      setProfile(loadUserProfile());
      setLocalCompany(loadBillingConfig().company);
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, handleSync);
    window.addEventListener(BILLING_CONFIG_UPDATED_EVENT, handleSync);
    handleSync();
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener(USER_PROFILE_UPDATED_EVENT, handleSync);
      window.removeEventListener(BILLING_CONFIG_UPDATED_EVENT, handleSync);
    };
  }, [activeTab, showAccountPopover]);

  const workspace = useWorkspaceAccount();
  const name = workspace
    ? workspace.settings.data.contact_name.trim() || workspace.account.display_name.trim() || workspace.account.login_id
    : localProfile.name.trim();
  const firstName = name.split(/\s+/)[0] || 'Account';
  const companyName = workspace
    ? workspace.settings.data.company_name.trim() || workspace.account.organization?.name || ''
    : localCompany.name;
  const companyLogo = workspace ? workspace.settings.data.logo_url : localCompany.logoDataUrl;
  const avatarInitial = companyName.trim().slice(0, 1).toUpperCase() || firstName.slice(0, 1).toUpperCase();

  const logout = () => {
    if (loggingOut) return;
    const proceed = () => { if (onLogout) onLogout(); else onActionNotification('Logged out dispatcher session'); };
    if (window.dispatchEvent(new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed } }))) proceed();
  };

  const navItems = tmsWorkspace ? [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ] : [
    { id: 'jobs', label: 'Orders', icon: ClipboardList },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'customers', label: 'Shippers', icon: Building2 },
    { id: 'reports', label: 'Analytics', icon: BarChart2 },
    { id: 'rate-cards', label: 'Settings', icon: Settings },
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
                    setShowAccountPopover(false);
                    if (item.id === 'profile' && onOpenProfile) onOpenProfile();
                    else if (item.id === 'help' && onOpenHelp) onOpenHelp();
                    else setActiveTab(item.id);
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
          <AccountMenu open={showAccountPopover} onOpenChange={setShowAccountPopover}
            modal={mobile}
            collapsed={collapsed}
            activeTab={activeTab}
            onProfile={() => { setActiveTab('profile'); onOpenProfile?.(); }}
            onPricing={tmsWorkspace ? undefined : () => { if (onOpenPricing) onOpenPricing(); else setActiveTab('rate-cards'); }}
            onSubscription={() => setActiveTab('subscription')}
            onIntegration={() => setActiveTab('integrations')}
            onHelp={() => { setActiveTab('help'); onOpenHelp?.(); }}
            onLogout={logout}
            trigger={
          <button
            type="button"
            aria-expanded={showAccountPopover}
            aria-label="Dispatcher Account"
            className="app-account-card group"
            title="Dispatcher Account"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 overflow-hidden">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={`${companyName} logo`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                avatarInitial
              )}
            </div>
            <div className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>
              <div className="app-account-name text-sm font-medium text-slate-900 leading-snug truncate">
                {firstName}
              </div>
              <div className="text-xs text-slate-500 truncate">{companyName}</div>
            </div>
          </button>
            }
          />

          <Notice error={logoutError} />
          <div className={`mt-1 flex items-center py-3 ${collapsed ? 'justify-center' : 'justify-between px-3'}`} title={collapsed ? `Auto dispatch: ${dispatchMode === 'AUTO' ? 'on' : 'off'}` : undefined}>
            <span className={collapsed ? 'sr-only' : 'text-sm font-normal text-slate-700'}>Auto dispatch</span>
            <Switch
              checked={dispatchMode === 'AUTO'}
              aria-disabled={dispatchModePending}
              aria-busy={dispatchModePending}
              aria-label="Auto dispatch"
              onCheckedChange={checked => {
                if (dispatchModePending) return;
                onDispatchModeChange(checked ? 'AUTO' : 'MANUAL');
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
};
