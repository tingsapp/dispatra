import React, { useState, useEffect } from 'react';
import {
  Monitor,
  ClipboardList,
  Users,
  Truck,
  Building2,
  BarChart2,
  User,
  Sliders,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Tag,
  FileText,
  Calculator,
  Receipt,
  PanelLeftClose
} from 'lucide-react';
import { loadUserProfile } from '../lib/profileStorage';

interface SidebarProps {
  activeTab: string;
  isOpen: boolean;
  onToggle: () => void;
  setActiveTab: (tab: string) => void;
  showAccountPopover: boolean;
  setShowAccountPopover: React.Dispatch<React.SetStateAction<boolean>>;
  onActionNotification: (msg: string) => void;
  onOpenPricingServices?: () => void;
  onOpenPricingSimulator?: () => void;
  onOpenBillingSettings?: () => void;
  onOpenRateCards?: () => void;
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
  onOpenPricingServices,
  onOpenPricingSimulator,
  onOpenBillingSettings,
  onOpenRateCards,
  dispatchMode,
  onDispatchModeChange,
  onOpenProfile,
  onOpenHelp
}) => {
  const [showOrgSubmenu, setShowOrgSubmenu] = useState<boolean>(false);
  const [profile, setProfile] = useState(() => loadUserProfile());

  useEffect(() => {
    const handleSync = () => {
      setProfile(loadUserProfile());
    };
    window.addEventListener('storage', handleSync);
    handleSync();
    return () => window.removeEventListener('storage', handleSync);
  }, [activeTab, showAccountPopover]);

  const navItems = [
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'jobs', label: 'Orders', icon: ClipboardList },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'customers', label: 'Customers', icon: Building2 },
    { id: 'reports', label: 'Reports', icon: BarChart2 },
  ];

  return (
    <div
      className={`h-screen shrink-0 transition-[width] duration-300 ease-in-out z-30 ${
        isOpen ? 'w-56' : 'w-0'
      }`}
    >
    <aside
      className={`w-56 h-screen bg-white border-r border-slate-200/80 flex flex-col justify-between select-none relative transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Top brand */}
      <div>
        <div className="h-16 flex items-center pl-6 pr-3 gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-blue-500/20">
            {/* Minimal Dispatra icon symbol */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 5C5 3.89543 5.89543 3 7 3H13C17.4183 3 21 6.58172 21 11C21 15.4183 17.4183 19 13 19H9V21H5V5Z"
                fill="currentColor"
                fillOpacity="0.25"
              />
              <path
                d="M7 6H13C15.7614 6 18 8.23858 18 11C18 13.7614 15.7614 16 13 16H7V6Z"
                fill="white"
              />
              <circle cx="11.5" cy="11" r="2.5" fill="#2563eb" />
            </svg>
          </div>
          <span className="font-semibold text-xl tracking-tight text-slate-900">
            Dispatra
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Hide menu"
            aria-label="Hide menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'monitor') {
                    onActionNotification(`Navigated to ${item.label}`);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 transition-colors ${
                    isActive ? 'text-blue-600 stroke-[2.2]' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Dispatcher Profile & Anchored Account Popover */}
      <div className="p-3 relative">
        {/* Anchored Account Popover displayed to the TOP instead of bottom */}
        {showAccountPopover && (
          <div
            className="absolute bottom-18 mb-2.5 left-3 right-3 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Directional arrow pointing down directly to Sarah K. trigger */}
            <div className="absolute -bottom-2 left-6 w-0 h-0 border-x-[6px] border-x-transparent border-t-8 border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.06)] pointer-events-none" />

            {/* Popover Items */}
            <div className="space-y-0.5 px-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile');
                  onActionNotification('Navigating to My Profile');
                  if (onOpenProfile) {
                    onOpenProfile();
                  }
                  setShowAccountPopover(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left font-medium ${
                  activeTab === 'profile'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </button>

              {/* Organization Settings with Submenu: Pricing and services */}
              <div
                className="relative group"
                onMouseEnter={() => setShowOrgSubmenu(true)}
                onMouseLeave={() => setShowOrgSubmenu(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowOrgSubmenu((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left font-medium ${
                    showOrgSubmenu
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-expanded={showOrgSubmenu}
                  aria-haspopup="true"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    <span>Organization Settings</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                      showOrgSubmenu ? 'rotate-90 sm:rotate-0 sm:translate-x-0.5 text-slate-600' : ''
                    }`}
                  />
                </button>

                {/* Submenu on Organization Settings */}
                {showOrgSubmenu && (
                  <>
                    {/* Desktop/Tablet Flyout Submenu to the right */}
                    <div className="hidden sm:block absolute left-full -top-1 ml-1.5 w-52 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-1 z-50 animate-in fade-in slide-in-from-left-2 duration-150 before:absolute before:-left-2.5 before:top-0 before:bottom-0 before:w-2.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('services-accessorials');
                          onActionNotification('Navigating to Services & Accessorials');
                          if (onOpenPricingServices) {
                            onOpenPricingServices();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-normal"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Services & Accessorials</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('rate-cards');
                          onActionNotification('Navigating to Rate Cards & Zones');
                          onOpenRateCards?.();
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-normal"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Rate Cards & Zones</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('billing-settings');
                          onActionNotification('Navigating to Billing, Tax & Cost');
                          if (onOpenBillingSettings) {
                            onOpenBillingSettings();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-normal"
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Billing, Tax & Cost</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('pricing-simulator');
                          onActionNotification('Navigating to Pricing Simulator');
                          if (onOpenPricingSimulator) {
                            onOpenPricingSimulator();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-normal"
                      >
                        <Calculator className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Pricing Simulator</span>
                      </button>
                    </div>

                    {/* Mobile/Narrow Screen Inline Accordion Submenu */}
                    <div className="sm:hidden pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-slate-200 ml-3 mt-0.5 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('services-accessorials');
                          onActionNotification('Navigating to Services & Accessorials');
                          if (onOpenPricingServices) {
                            onOpenPricingServices();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors text-left font-normal"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Services & Accessorials</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('rate-cards');
                          onActionNotification('Navigating to Rate Cards & Zones');
                          onOpenRateCards?.();
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors text-left font-normal"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Rate Cards & Zones</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('billing-settings');
                          onActionNotification('Navigating to Billing, Tax & Cost');
                          if (onOpenBillingSettings) {
                            onOpenBillingSettings();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors text-left font-normal"
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Billing, Tax & Cost</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('pricing-simulator');
                          onActionNotification('Navigating to Pricing Simulator');
                          if (onOpenPricingSimulator) {
                            onOpenPricingSimulator();
                          }
                          setShowOrgSubmenu(false);
                          setShowAccountPopover(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors text-left font-normal"
                      >
                        <Calculator className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-normal text-slate-700">Pricing Simulator</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => onActionNotification('Viewing Sarah K. notifications')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                  <span>Notifications</span>
                </div>
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                  3
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('help');
                  onActionNotification('Navigating to Help & Support');
                  if (onOpenHelp) {
                    onOpenHelp();
                  }
                  setShowAccountPopover(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left font-medium ${
                  activeTab === 'help'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Help & Support</span>
              </button>

              <div className="h-px bg-slate-100 my-1 mx-1.5" />

              <button
                onClick={() => onActionNotification('Logged out dispatcher session')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left font-semibold"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Dispatcher Account Trigger Card with Dynamic Logo */}
        <button
          onClick={() => setShowAccountPopover((prev) => !prev)}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left group relative ${
            showAccountPopover ? 'bg-slate-100' : 'hover:bg-slate-50'
          }`}
          title="Dispatcher Account"
        >
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 group-hover:bg-slate-300 transition-colors ring-2 ring-white overflow-hidden">
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
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 leading-snug truncate">
              {profile.name || 'Sarah K.'}
            </div>
            <div className="text-xs text-slate-500 truncate">{profile.role || 'Dispatcher'}</div>
          </div>
        </button>

        <div className="mt-2 flex items-center justify-between px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dispatch</span>
            <span className={`text-[11px] font-semibold ${dispatchMode === 'AUTO' ? 'text-blue-700' : 'text-slate-700'}`}>
              {dispatchMode === 'AUTO' ? 'Auto' : 'Manual'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dispatchMode === 'AUTO'}
            aria-label="Toggle automatic dispatch"
            onClick={() => {
              const nextMode = dispatchMode === 'AUTO' ? 'MANUAL' : 'AUTO';
              onDispatchModeChange(nextMode);
              onActionNotification(`Dispatch mode set to ${nextMode === 'AUTO' ? 'Auto' : 'Manual'}`);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              dispatchMode === 'AUTO' ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                dispatchMode === 'AUTO' ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </aside>
    </div>
  );
};
