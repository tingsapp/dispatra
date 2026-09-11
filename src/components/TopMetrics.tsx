import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  X
} from 'lucide-react';
import { Driver, Job, NeedsAttentionItem } from '../types';

interface TopMetricsProps {
  /** Shift right to make room for the floating menu button when the sidebar is hidden. */
  offsetForMenu?: boolean;
  drivers: Driver[];
  jobs: Job[];
  activeJobsCount: number;
  availableDriversCount: number;
  needsAttentionCount: number;
  needsAttentionItems: NeedsAttentionItem[];
  showActiveJobsMenu: boolean;
  setShowActiveJobsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showAvailableDriversMenu: boolean;
  setShowAvailableDriversMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showNeedsAttentionPopover: boolean;
  setShowNeedsAttentionPopover: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectJob: (jobNumber: string) => void;
  onSelectDriver: (driverId: string) => void;
  onActionNotification: (msg: string) => void;
  onOpenAllJobs?: () => void;
  onOpenAllDrivers?: () => void;
  onOpenAllExceptions?: () => void;
}

export const TopMetrics: React.FC<TopMetricsProps> = ({
  offsetForMenu = false,
  drivers,
  jobs,
  activeJobsCount,
  availableDriversCount,
  needsAttentionCount,
  needsAttentionItems,
  showActiveJobsMenu,
  setShowActiveJobsMenu,
  showAvailableDriversMenu,
  setShowAvailableDriversMenu,
  showNeedsAttentionPopover,
  setShowNeedsAttentionPopover,
  onSelectJob,
  onSelectDriver,
  onActionNotification,
  onOpenAllJobs,
  onOpenAllDrivers,
  onOpenAllExceptions
}) => {
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobFilterTab, setJobFilterTab] = useState<'all' | 'at_risk' | 'in_progress'>('all');

  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverFilterTab, setDriverFilterTab] = useState<'available' | 'all'>('available');

  // Filtered jobs for menu
  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.jobNumber.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
      j.customerName.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
      j.pickupAddress.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
      j.dropoffAddress.toLowerCase().includes(jobSearchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (jobFilterTab === 'at_risk') return j.status === 'at_risk' || j.status === 'late_start';
    if (jobFilterTab === 'in_progress') return j.status === 'on_time' || j.assignedDriverId;
    return true;
  });

  // Filtered drivers for menu
  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      d.vehicle.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      (d.nextStop && d.nextStop.toLowerCase().includes(driverSearchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (driverFilterTab === 'available') return d.status === 'available';
    return true;
  });

  const toggleActiveJobs = () => {
    const nextState = !showActiveJobsMenu;
    setShowActiveJobsMenu(nextState);
    if (nextState) {
      setShowAvailableDriversMenu(false);
      setShowNeedsAttentionPopover(false);
    }
  };

  const toggleAvailableDrivers = () => {
    const nextState = !showAvailableDriversMenu;
    setShowAvailableDriversMenu(nextState);
    if (nextState) {
      setShowActiveJobsMenu(false);
      setShowNeedsAttentionPopover(false);
    }
  };

  const toggleNeedsAttention = () => {
    const nextState = !showNeedsAttentionPopover;
    setShowNeedsAttentionPopover(nextState);
    if (nextState) {
      setShowActiveJobsMenu(false);
      setShowAvailableDriversMenu(false);
    }
  };

  return (
    <div
      className={`absolute top-5 flex items-start gap-3 z-30 pointer-events-auto select-none transition-[left] duration-300 ease-in-out ${
        offsetForMenu ? 'left-[4.25rem]' : 'left-6'
      }`}
    >
      {/* 1. ACTIVE JOBS BADGE & MENU */}
      <div className="relative">
        <button
          onClick={toggleActiveJobs}
          className={`h-11 px-3.5 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center gap-2.5 transition-all text-left group ${
            showActiveJobsMenu
              ? 'border-blue-500 ring-2 ring-blue-100'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Click to view Active Jobs menu"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Truck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 leading-none">
              {activeJobsCount}
            </span>
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Active Orders
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
              showActiveJobsMenu ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>

        {/* ACTIVE JOBS DROPDOWN MENU */}
        <AnimatePresence>
          {showActiveJobsMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-full mt-2.5 w-96 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              {/* Directional arrow pointing up directly to badge */}
              <div className="absolute -top-2 left-6 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Active Dispatch Orders
                  </h3>
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                    {jobs.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowActiveJobsMenu(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Close Active Jobs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Input */}
              <div className="mt-3 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={jobSearchQuery}
                  onChange={(e) => setJobSearchQuery(e.target.value)}
                  placeholder="Search job #, customer, address..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pb-2.5 border-b border-slate-100 text-xs">
                <button
                  onClick={() => setJobFilterTab('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    jobFilterTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({jobs.length})
                </button>
                <button
                  onClick={() => setJobFilterTab('at_risk')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    jobFilterTab === 'at_risk'
                      ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Needs Action (2)
                </button>
                <button
                  onClick={() => setJobFilterTab('in_progress')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    jobFilterTab === 'in_progress'
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  In Progress
                </button>
              </div>

              {/* Job List */}
              <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {filteredJobs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No matching Orders found
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => {
                        onSelectJob(job.jobNumber);
                        setShowActiveJobsMenu(false);
                        onActionNotification(`Selected ${job.jobNumber} - ${job.customerName}`);
                      }}
                      className="py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {job.jobNumber}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-32.5">
                            {job.customerName}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            job.status === 'at_risk'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                              : job.status === 'late_start'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : job.status === 'no_driver'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          }`}
                        >
                          {job.statusLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="truncate pr-2">
                          <span className="font-medium text-slate-600">To:</span> {job.dropoffAddress}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Click any job to focus on map
                </span>
                <button
                  onClick={() => {
                    setShowActiveJobsMenu(false);
                    if (onOpenAllJobs) {
                      onOpenAllJobs();
                    } else {
                      onActionNotification('Opened full Orders Management table');
                    }
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  View full list &rarr;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. AVAILABLE DRIVERS BADGE & MENU */}
      <div className="relative">
        <button
          onClick={toggleAvailableDrivers}
          className={`h-11 px-3.5 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center gap-2.5 transition-all text-left group ${
            showAvailableDriversMenu
              ? 'border-emerald-500 ring-2 ring-emerald-100'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Click to view Available Drivers menu"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
            <UserCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 leading-none">
              {availableDriversCount}
            </span>
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Available Drivers
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
              showAvailableDriversMenu ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </button>

        {/* AVAILABLE DRIVERS DROPDOWN MENU */}
        <AnimatePresence>
          {showAvailableDriversMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-full mt-2.5 w-96 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              {/* Directional arrow pointing up directly to badge */}
              <div className="absolute -top-2 left-6 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Vancouver Fleet Drivers
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                    {drivers.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowAvailableDriversMenu(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Close Available Drivers"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Input */}
              <div className="mt-3 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                  placeholder="Search driver name, ID, vehicle..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pb-2.5 border-b border-slate-100 text-xs">
                <button
                  onClick={() => setDriverFilterTab('available')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    driverFilterTab === 'available'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Available ({availableDriversCount})
                </button>
                <button
                  onClick={() => setDriverFilterTab('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    driverFilterTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Fleet ({drivers.length})
                </button>
              </div>

              {/* Driver List */}
              <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {filteredDrivers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No matching drivers found
                  </div>
                ) : (
                  filteredDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      onClick={() => {
                        onSelectDriver(driver.id);
                        setShowAvailableDriversMenu(false);
                        onActionNotification(`Selected driver ${driver.name} (${driver.id})`);
                      }}
                      className="py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={driver.avatar}
                            alt={driver.name}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100"
                          />
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              driver.status === 'available'
                                ? 'bg-emerald-500'
                                : 'bg-blue-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {driver.name}
                            </span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {driver.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{driver.vehicle}</span>
                            {driver.distance && (
                              <>
                                <span>•</span>
                                <span className="text-slate-600 font-medium">{driver.distance}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            driver.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {driver.statusLabel}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Click driver to center on map
                </span>
                <button
                  onClick={() => {
                    setShowAvailableDriversMenu(false);
                    if (onOpenAllDrivers) {
                      onOpenAllDrivers();
                    } else {
                      onActionNotification('Opened Driver Roster & Schedules');
                    }
                  }}
                  className="font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Roster & Details &rarr;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. NEEDS ATTENTION BADGE & MENU */}
      <div className="relative">
        <button
          onClick={toggleNeedsAttention}
          className={`h-11 px-3.5 bg-white rounded-xl shadow-sm shadow-slate-900/5 border flex items-center gap-2.5 transition-all text-left group ${
            showNeedsAttentionPopover
              ? 'border-rose-500 ring-2 ring-rose-100'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
          title="Click to view Needs Attention items"
        >
          <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center text-white shadow-sm shadow-rose-500/20 group-hover:scale-105 transition-transform shrink-0">
            <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 leading-none">
              {needsAttentionCount}
            </span>
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Needs Attention
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
              showNeedsAttentionPopover ? 'rotate-180 text-rose-600' : ''
            }`}
          />
        </button>

        {/* NEEDS ATTENTION DROPDOWN MENU */}
        <AnimatePresence>
          {showNeedsAttentionPopover && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-full mt-2.5 w-84 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-4 z-50"
            >
              {/* Directional arrow pointing up directly to badge */}
              <div className="absolute -top-2 left-6 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              {/* Header with Close Icon */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="font-semibold text-slate-900 text-sm">
                    Needs Attention ({needsAttentionItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowNeedsAttentionPopover(false);
                      onActionNotification('Viewing all operational exceptions');
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View all
                  </button>
                  <button
                    onClick={() => setShowNeedsAttentionPopover(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Close Needs Attention"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {needsAttentionItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectJob(item.jobNumber);
                      setShowNeedsAttentionPopover(false);
                      onActionNotification(`Selected ${item.jobNumber}: ${item.subtitle}`);
                    }}
                    className="py-3 hover:bg-slate-50/80 -mx-2 px-2 rounded-xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.jobNumber}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            item.badgeColor === 'red'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-rose-600">
                        {item.subtitle}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.bulletColor === 'green'
                              ? 'bg-emerald-500'
                              : item.bulletColor === 'red'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        <span className="truncate">
                          <strong className="font-medium text-slate-700">Pickup</strong>{' '}
                          {item.pickupAddress}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Priority dispatch actions
                </span>
                <button
                  onClick={() => {
                    setShowNeedsAttentionPopover(false);
                    if (onOpenAllExceptions) {
                      onOpenAllExceptions();
                    } else {
                      onActionNotification('Opened full Exceptions & Alerts center');
                    }
                  }}
                  className="font-semibold text-rose-600 hover:text-rose-700"
                >
                  View all alerts &rarr;
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
