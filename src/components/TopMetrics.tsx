import { DriverAvatar } from './DriverAvatar';
import { SearchInput } from './ui/SearchInput';
import { MetricTrigger } from './ui/MetricTrigger';
import { FloatingPanel } from './ui/FloatingPanel';
import React, { useState } from 'react';
import {
  Truck,
  UserCheck,
  AlertTriangle,
  ChevronRight,
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
      (d.driverNumber ?? d.id).toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      d.vehicle.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      (d.nextStop && d.nextStop.toLowerCase().includes(driverSearchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (driverFilterTab === 'available') return d.status === 'available';
    return true;
  });

  const changeActiveJobs = (nextState: boolean) => {
    setShowActiveJobsMenu(nextState);
    if (nextState) {
      setShowAvailableDriversMenu(false);
      setShowNeedsAttentionPopover(false);
    }
  };

  const changeAvailableDrivers = (nextState: boolean) => {
    setShowAvailableDriversMenu(nextState);
    if (nextState) {
      setShowActiveJobsMenu(false);
      setShowNeedsAttentionPopover(false);
    }
  };

  const changeNeedsAttention = (nextState: boolean) => {
    setShowNeedsAttentionPopover(nextState);
    if (nextState) {
      setShowActiveJobsMenu(false);
      setShowAvailableDriversMenu(false);
    }
  };

  return (
    <div
      className={`app-map-metrics absolute top-5 flex items-start gap-2 z-30 pointer-events-auto select-none transition-[left] duration-300 ease-in-out ${
        offsetForMenu ? 'left-[4.25rem] sm:left-6' : 'left-6'
      }`}
    >
      {/* 1. ACTIVE JOBS BADGE & MENU */}
      <FloatingPanel open={showActiveJobsMenu} onOpenChange={changeActiveJobs}
        label="Active Orders menu" role="region" size="rich" className="app-map-menu p-3" autoFocusSelector="input"
        trigger={<MetricTrigger icon={Truck} count={activeJobsCount} label="Active Orders" title="Click to view Active Jobs menu" />}>


              {/* Header */}
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Active Orders
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded-full">
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
              <SearchInput value={jobSearchQuery} onChange={setJobSearchQuery} placeholder="Search orders, shippers or addresses..." className="mt-3" />

              {/* Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pb-2.5 text-xs">
                <button
                  onClick={() => setJobFilterTab('all')}
                  aria-pressed={jobFilterTab === 'all'}
                  className={`app-tab ${
                    jobFilterTab === 'all'
                      ? 'bg-app-selected text-app-text'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({jobs.length})
                </button>
                <button
                  onClick={() => setJobFilterTab('at_risk')}
                  aria-pressed={jobFilterTab === 'at_risk'}
                  className={`app-tab ${
                    jobFilterTab === 'at_risk'
                      ? 'bg-app-selected text-app-text'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Needs Action (2)
                </button>
                <button
                  onClick={() => setJobFilterTab('in_progress')}
                  aria-pressed={jobFilterTab === 'in_progress'}
                  className={`app-tab ${
                    jobFilterTab === 'in_progress'
                      ? 'bg-app-selected text-app-text'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  In Progress
                </button>
              </div>

              {/* Job List */}
              <div className="mt-2 max-h-72 overflow-y-auto pr-1">
                {filteredJobs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No matching Orders found
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
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
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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

                      <div className="flex items-center justify-between text-xs text-slate-500">
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
              <div className="mt-3 pt-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-xs">
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
                  className="font-medium text-slate-700 hover:text-slate-950"
                >
                  View full list &rarr;
                </button>
              </div>
      </FloatingPanel>

      {/* 2. AVAILABLE DRIVERS BADGE & MENU */}
      <FloatingPanel open={showAvailableDriversMenu} onOpenChange={changeAvailableDrivers}
        label="Available Drivers menu" role="region" size="rich" className="app-map-menu p-3" autoFocusSelector="input"
        trigger={<MetricTrigger icon={UserCheck} count={availableDriversCount} label="Available Drivers" title="Click to view Available Drivers menu" />}>


              {/* Header */}
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Available Drivers
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded-full">
                    {availableDriversCount}
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
              <SearchInput value={driverSearchQuery} onChange={setDriverSearchQuery} placeholder="Search driver name, ID, vehicle..." className="mt-3" />

              {/* Tabs */}
              <div className="flex items-center gap-1.5 mt-2.5 pb-2.5 text-xs">
                <button
                  onClick={() => setDriverFilterTab('all')}
                  aria-pressed={driverFilterTab === 'all'}
                  className={`app-tab ${
                    driverFilterTab === 'all'
                      ? 'bg-app-selected text-app-text'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({drivers.length})
                </button>
                <button
                  onClick={() => setDriverFilterTab('available')}
                  aria-pressed={driverFilterTab === 'available'}
                  className={`app-tab ${
                    driverFilterTab === 'available'
                      ? 'bg-app-selected text-app-text'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Available ({availableDriversCount})
                </button>
              </div>

              {/* Driver List */}
              <div className="mt-2 max-h-72 overflow-y-auto pr-1">
                {filteredDrivers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No matching drivers found
                  </div>
                ) : (
                  filteredDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                      onClick={() => {
                        onSelectDriver(driver.id);
                        setShowAvailableDriversMenu(false);
                        onActionNotification(`Selected driver ${driver.name} (${driver.driverNumber ?? driver.id})`);
                      }}
                      className="py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100" />
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
                            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {driver.driverNumber ?? driver.id}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
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
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
              <div className="mt-3 pt-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-xs">
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
                  className="font-medium text-slate-700 hover:text-slate-950"
                >
                  Roster & Details &rarr;
                </button>
              </div>
      </FloatingPanel>

      <FloatingPanel open={showNeedsAttentionPopover} onOpenChange={changeNeedsAttention}
        label="Needs Attention menu" role="region" size="rich" className="app-map-menu p-3"
        trigger={<MetricTrigger icon={AlertTriangle} count={needsAttentionCount} label="Needs Attention" title="Click to view Needs Attention items" />}>
              {/* Header with Close Icon */}
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center text-slate-600">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="font-semibold text-slate-900 text-sm">
                    Needs Attention ({needsAttentionItems.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowNeedsAttentionPopover(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Close Needs Attention"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="">
                {needsAttentionItems.map((item) => (
                  <div
                    key={item.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                    onClick={() => {
                      onSelectJob(item.jobNumber);
                      setShowNeedsAttentionPopover(false);
                      onActionNotification(`Selected ${item.jobNumber}: ${item.subtitle}`);
                    }}
                    className="py-2.5 hover:bg-slate-50/80 -mx-2 px-2 rounded-xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">{item.jobNumber}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${item.badgeColor === 'red' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.statusLabel}</span>
                        </div>
                        <p className="text-xs text-slate-700">{item.subtitle}</p>
                        {item.pickupAddress && <p className="text-xs text-slate-500 truncate">Pickup · {item.pickupAddress.split(',')[0]}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-2 pt-2.5 flex items-center justify-end text-xs border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowNeedsAttentionPopover(false);
                    if (onOpenAllExceptions) {
                      onOpenAllExceptions();
                    } else {
                      onActionNotification('Opened full Exceptions & Alerts center');
                    }
                  }}
                  className="font-medium text-slate-700 hover:text-slate-950"
                >
                  View all alerts &rarr;
                </button>
              </div>
      </FloatingPanel>
    </div>
  );
};
