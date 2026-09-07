import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

interface DateControlProps {
  showCalendarPopover: boolean;
  setShowCalendarPopover: React.Dispatch<React.SetStateAction<boolean>>;
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

export const DateControl: React.FC<DateControlProps> = ({
  showCalendarPopover,
  setShowCalendarPopover,
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

  const [selectedDay, setSelectedDay] = useState<number>(3);
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
  const daysInDecember = 31;
  const days = Array.from({ length: daysInDecember }, (_, i) => i + 1);

  const toggleSearch = () => {
    const next = !isSearchOpen;
    setIsSearchOpen(next);
    if (next) {
      setIsNotificationOpen(false);
      setShowCalendarPopover(false);
    }
  };

  const toggleNotification = () => {
    const next = !isNotificationOpen;
    setIsNotificationOpen(next);
    if (next) {
      setIsSearchOpen(false);
      setShowCalendarPopover(false);
    }
  };

  const toggleCalendar = () => {
    const next = !showCalendarPopover;
    setShowCalendarPopover(next);
    if (next) {
      setIsSearchOpen(false);
      setIsNotificationOpen(false);
    }
  };

  const markAllAlertsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })));
    onActionNotification('Marked all alerts as read');
  };

  // Search filtered results
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
      <div className="relative">
        <button
          onClick={toggleSearch}
          className={`h-11 w-11 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all ${
            isSearchOpen
              ? 'border-blue-500 ring-2 ring-blue-100 text-blue-600'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Search jobs, drivers, or Vancouver addresses"
        >
          <Search className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* SEARCH POPOVER */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2.5 w-84 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              <div className="absolute -top-2 right-4 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="font-semibold text-xs text-slate-900">
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

              <div className="mt-2.5 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search job #, driver, Vancouver address..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Results */}
              <div className="mt-2.5 max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                {searchQuery.trim() === '' ? (
                  <div className="py-3 px-1 text-slate-500 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          Driver D14 (Arles Morgan)
                        </span>
                        <span className="text-[10px] text-slate-400">On route</span>
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
                        <span className="text-[10px] text-rose-500 font-medium">At risk</span>
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
                        <span className="text-[10px] text-slate-400">Zone</span>
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
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pb-1">
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
                              <span className="font-bold text-slate-900">{job.jobNumber}</span>{' '}
                              <span className="text-slate-600">• {job.customerName}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{job.statusLabel}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {filteredDrivers.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pb-1">
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
                              <img
                                src={driver.avatar}
                                alt={driver.name}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                              <div>
                                <span className="font-semibold text-slate-800">{driver.name}</span>{' '}
                                <span className="text-[10px] text-slate-400">({driver.id})</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600">
                              {driver.statusLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. NOTIFICATION ICON BUTTON */}
      <div className="relative">
        <button
          onClick={toggleNotification}
          className={`h-11 w-11 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all relative ${
            isNotificationOpen
              ? 'border-blue-500 ring-2 ring-blue-100 text-blue-600'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Dispatch alerts and notifications"
        >
          <Bell className="w-4 h-4 stroke-[2.2]" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>

        {/* NOTIFICATION POPOVER */}
        <AnimatePresence>
          {isNotificationOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2.5 w-84 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              <div className="absolute -top-2 right-4 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-900">
                    Dispatch Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={markAllAlertsRead}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
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

              <div className="mt-2.5 divide-y divide-slate-100 max-h-64 overflow-y-auto">
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
                          <span className="font-semibold text-slate-800 text-xs truncate">
                            {alt.title}
                          </span>
                          <span className="text-[10px] text-slate-400">{alt.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {alt.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. DATE SELECTOR CONTROL & CALENDAR POPOVER */}
      <div className="relative">
        <button
          onClick={toggleCalendar}
          className={`h-11 px-4 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center gap-2.5 transition-all text-left group ${
            showCalendarPopover
              ? 'border-blue-500 ring-2 ring-blue-100'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Select dispatch date"
        >
          <CalendarIcon className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors shrink-0" />
          <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
            Dec {selectedDay}, 2024
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
              showCalendarPopover ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>

        {/* CALENDAR POPOVER */}
        <AnimatePresence>
          {showCalendarPopover && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2.5 w-72 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              {/* Directional arrow pointing up directly to date pill */}
              <div className="absolute -top-2 right-6 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              {/* Month & Nav & Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2.5">
                <button
                  onClick={() => onActionNotification('Previous month')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-xs text-slate-900">
                  December 2024
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onActionNotification('Next month')}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowCalendarPopover(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                    title="Close Calendar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-1">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {days.map((day) => {
                  const isSelected = day === selectedDay;
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setShowCalendarPopover(false);
                        onActionNotification(`Filtered schedule for Dec ${day}, 2024`);
                      }}
                      className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/30'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Shortcut links */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setSelectedDay(3);
                    setShowCalendarPopover(false);
                    onActionNotification('Set to Today (Dec 3)');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    setSelectedDay(4);
                    setShowCalendarPopover(false);
                    onActionNotification('Set to Tomorrow (Dec 4)');
                  }}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Tomorrow
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
