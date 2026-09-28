import { DriverAvatar } from './DriverAvatar';
import { SearchInput } from './ui/SearchInput';
import { FloatingPanel } from './ui/FloatingPanel';
import React, { useState } from 'react';
import {
  Search,
  Bell,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Truck,
  User,
  MapPin
} from 'lucide-react';
import { Driver, Job } from '../types';

interface MonitorActionsProps {
  showSearchPopover?: boolean;
  setShowSearchPopover?: React.Dispatch<React.SetStateAction<boolean>>;
  showNotificationPopover?: boolean;
  setShowNotificationPopover?: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectJob?: (jobNumber: string) => void;
  onSelectDriver?: (driverId: string) => void;
  onActionNotification: (msg: string) => void;
  drivers?: Driver[];
  jobs?: Job[];
}

interface DispatchAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export const MonitorActions: React.FC<MonitorActionsProps> = ({
  showSearchPopover: externalShowSearch,
  setShowSearchPopover: externalSetShowSearch,
  showNotificationPopover: externalShowNotification,
  setShowNotificationPopover: externalSetShowNotification,
  onSelectJob,
  onSelectDriver,
  onActionNotification,
  drivers = [],
  jobs = []
}) => {
  // Local states if not passed
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const [internalNotificationOpen, setInternalNotificationOpen] = useState(false);

  const isSearchOpen = externalShowSearch !== undefined ? externalShowSearch : internalSearchOpen;
  const setIsSearchOpen = externalSetShowSearch || setInternalSearchOpen;

  const isNotificationOpen = externalShowNotification !== undefined ? externalShowNotification : internalNotificationOpen;
  const setIsNotificationOpen = externalSetShowNotification || setInternalNotificationOpen;

  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState<DispatchAlert[]>([
    {
      id: 'alt-1',
      type: 'critical',
      title: 'Job #461 Delay Detected',
      message: 'Traffic slowdown on Granville Bridge corridor (+22 min delay).',
      time: '4m ago',
      unread: true
    },
    {
      id: 'alt-2',
      type: 'warning',
      title: 'Unassigned Load #439',
      message: 'Medical Supplies at 1055 W Georgia St awaits driver dispatch.',
      time: '12m ago',
      unread: true
    },
    {
      id: 'alt-3',
      type: 'info',
      title: 'Vehicle D14 Telemetry Active',
      message: 'Arles Morgan heading inbound to Vancouver Gastown corridor.',
      time: '18m ago',
      unread: true
    }
  ]);

  const unreadCount = alerts.filter((a) => a.unread).length;

  const changeSearch = (next: boolean) => {
    setIsSearchOpen(next);
    if (next) {
      setIsNotificationOpen(false);
    }
  };

  const changeNotification = (next: boolean) => {
    setIsNotificationOpen(next);
    if (next) {
      setIsSearchOpen(false);
    }
  };

  const markAllAlertsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })));
    onActionNotification('Marked all alerts as read');
  };

  // Search filtered results updated.
  const filteredJobs = searchQuery.trim()
    ? jobs.filter(
        (j) =>
          j.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const filteredDrivers = searchQuery.trim()
    ? drivers.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.vehicle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="absolute top-5 right-6 z-30 pointer-events-auto flex items-center gap-2.5 select-none">
      {/* 1. SEARCH ICON BUTTON */}
      <FloatingPanel open={isSearchOpen} onOpenChange={changeSearch} label="Search"
        align="end" size="rich" className="app-map-menu p-3" autoFocusSelector="input" trigger={
        <button
          aria-expanded={isSearchOpen}
          className="app-metric app-map-icon relative"
          title="Search jobs, drivers, or Vancouver addresses"
        >
          <Search className="w-4 h-4 stroke-[2.2]" />
        </button>
        }>


              <div className="flex items-center justify-between pb-2.5">
                <span className="font-medium text-sm text-slate-900">
                  Quick Search
                </span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                  title="Close Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search job #, driver, Vancouver address..." className="mt-3" />

              {/* Results */}
              <div className="mt-2.5 max-h-64 overflow-y-auto text-xs">
                {searchQuery.trim() === '' ? (
                  <div className="py-3 px-1 text-slate-500 space-y-2">
                    <div className="text-xs font-medium text-slate-400">
                      Quick shortcuts
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setSearchQuery('D14');
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-slate-600" />
                          Driver D14 (Arles Morgan)
                        </span>
                        <span className="text-xs text-slate-400">On route</span>
                      </button>
                      <button
                        onClick={() => {
                          setSearchQuery('#461');
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          Job #461 (Vancouver Gastown)
                        </span>
                        <span className="text-xs text-rose-500 font-medium">At risk</span>
                      </button>
                      <button
                        onClick={() => {
                          setSearchQuery('Robson');
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          Robson Street corridor
                        </span>
                        <span className="text-xs text-slate-400">Zone</span>
                      </button>
                    </div>
                  </div>
                ) : filteredJobs.length === 0 && filteredDrivers.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No results for "{searchQuery}"
                  </div>
                ) : (
                  <div className="space-y-3 py-1">
                    {filteredJobs.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 px-1 pb-1">
                          Jobs ({filteredJobs.length})
                        </div>
                        {filteredJobs.map((job) => (
                          <div
                            key={job.id}
                            onClick={() => {
                              if (onSelectJob) onSelectJob(job.jobNumber);
                              setIsSearchOpen(false);
                            }}
                            className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <span className="font-medium text-slate-900">{job.jobNumber}</span>{' '}
                              <span className="text-slate-600">• {job.customerName}</span>
                            </div>
                            <span className="text-xs text-slate-500">{job.statusLabel}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {filteredDrivers.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 px-1 pb-1">
                          Drivers ({filteredDrivers.length})
                        </div>
                        {filteredDrivers.map((driver) => (
                          <div
                            key={driver.id}
                            onClick={() => {
                              if (onSelectDriver) onSelectDriver(driver.id);
                              setIsSearchOpen(false);
                            }}
                            className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-5 h-5 rounded-full object-cover" />
                              <div>
                                <span className="font-medium text-slate-800">{driver.name}</span>{' '}
                                <span className="text-xs text-slate-400">({driver.id})</span>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-emerald-600">
                              {driver.statusLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
      </FloatingPanel>

      {/* 2. NOTIFICATION ICON BUTTON */}
      <FloatingPanel open={isNotificationOpen} onOpenChange={changeNotification} label="Notifications"
        align="end" size="rich" className="app-map-menu p-3" autoFocusSelector="input" trigger={
        <button
          aria-expanded={isNotificationOpen}
          className="app-metric app-map-icon relative"
          title="Dispatch alerts and notifications"
        >
          <Bell className="w-4 h-4 stroke-[2.2]" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>
        }>


              <div className="flex items-center justify-between pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-900">
                    Dispatch Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium text-xs">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={markAllAlertsRead}
                    className="text-xs font-medium text-slate-700 hover:text-slate-700 transition-colors"
                  >
                    Mark read
                  </button>
                  <button
                    onClick={() => setIsNotificationOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                    title="Close Notifications"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 max-h-64 overflow-y-auto">
                {alerts.map((alt) => (
                  <div
                    key={alt.id}
                    onClick={() => {
                      setAlerts((prev) =>
                        prev.map((a) => (a.id === alt.id ? { ...a, unread: false } : a))
                      );
                      onActionNotification(`Alert: ${alt.title}`);
                    }}
                    className={`py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors ${
                      alt.unread ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {alt.type === 'critical' ? (
                          <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <AlertTriangle className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        ) : alt.type === 'warning' ? (
                          <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800 text-xs truncate">
                            {alt.title}
                          </span>
                          <span className="text-xs text-slate-400">{alt.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {alt.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
      </FloatingPanel>
    </div>
  );
};
