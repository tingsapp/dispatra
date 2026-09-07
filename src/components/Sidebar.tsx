import React from 'react';
import {
  Monitor,
  ClipboardList,
  Users,
  Truck,
  BarChart2,
  User,
  Sliders,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showAccountPopover: boolean;
  setShowAccountPopover: React.Dispatch<React.SetStateAction<boolean>>;
  onActionNotification: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  showAccountPopover,
  setShowAccountPopover,
  onActionNotification
}) => {
  const navItems = [
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'jobs', label: 'Jobs', icon: ClipboardList },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'reports', label: 'Reports', icon: BarChart2 },
  ];

  return (
    <aside className="w-56 h-screen bg-white border-r border-slate-200/80 flex flex-col justify-between z-30 select-none shrink-0 relative">
      {/* Top brand */}
      <div>
        <div className="h-16 flex items-center px-6 gap-3">
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
                  className={`w-[18px] h-[18px] transition-colors ${
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
            className="absolute bottom-full mb-2.5 left-3 right-3 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {/* Directional arrow pointing down directly to Sarah K. trigger */}
            <div className="absolute -bottom-2 left-6 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.06)] pointer-events-none" />

            {/* Popover Items */}
            <div className="space-y-0.5 px-1">
              <button
                onClick={() => onActionNotification('Opening Sarah K. profile')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => onActionNotification('Opening Organization Settings')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Organization Settings</span>
              </button>

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
                onClick={() => onActionNotification('Opening Help & Support')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
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

        {/* Sarah K. Trigger Card */}
        <button
          onClick={() => setShowAccountPopover((prev) => !prev)}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left group relative ${
            showAccountPopover ? 'bg-slate-100' : 'hover:bg-slate-50'
          }`}
          title="Dispatcher Account"
        >
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 group-hover:bg-slate-300 transition-colors ring-2 ring-white">
            SK
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 leading-snug truncate">
              Sarah K.
            </div>
            <div className="text-xs text-slate-500 truncate">Dispatcher</div>
          </div>
        </button>
      </div>
    </aside>
  );
};
