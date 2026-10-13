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
import { OrderMapCheckbox, type OrderMapVisibilityProps } from './monitor/OrderMapCheckbox';
import { MonitorBadge } from './monitor/MonitorBadge';

interface TopMetricsProps extends OrderMapVisibilityProps {
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
  hiddenOrderIds,
  onOrderVisibilityChange,
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
                  <h3 className="font-medium text-slate-900 text-sm">
                    Active Orders
                  </h3>
                  <MonitorBadge>{jobs.length}</MonitorBadge>
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
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pb-2.5 text-xs">
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
                    <div key={job.id} className="flex items-start rounded-xl hover:bg-slate-50">
                      <OrderMapCheckbox job={job} hiddenOrderIds={hiddenOrderIds} onOrderVisibilityChange={onOrderVisibilityChange} />
                      <button
                        type="button"
                        onClick={() => {
                          onSelectJob(job.jobNumber);
                          setShowActiveJobsMenu(false);
                          onActionNotification(`Selected ${job.jobNumber} - ${job.customerName}`);
                        }}
                        className="min-w-0 flex-1 text-left py-2.5 px-2 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-2 mb-1">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="shrink-0 font-medium text-slate-900 text-xs">
                              {job.jobNumber}
                            </span>
                            <span className="shrink-0 text-slate-400">•</span>
                            <span className="min-w-0 text-xs text-slate-500 truncate max-w-32.5">
                              {job.customerName}
                            </span>
                          </div>
                          <MonitorBadge tone={job.status === 'at_risk' ? 'danger' : job.status === 'late_start' ? 'warning' : job.status === 'no_driver' ? 'neutral' : 'success'}>
                            {job.statusLabel}
                          </MonitorBadge>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="truncate pr-2">
                            <span className="font-medium text-slate-600">To:</span> {job.dropoffAddress}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-xs">
                  Check orders to show on map
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
                  className="shrink-0 whitespace-nowrap font-medium text-slate-700 hover:text-slate-950"
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
                  <h3 className="font-medium text-slate-900 text-sm">
                    Available Drivers
                  </h3>
                  <MonitorBadge>{availableDriversCount}</MonitorBadge>
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
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pb-2.5 text-xs">
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
                      className="py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group flex items-center gap-2.5"
                    >
                      <div className="relative shrink-0">
                        <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="size-8 rounded-full object-cover" />
                        <span className={`absolute bottom-0 right-0 size-2 rounded-full ring-2 ring-white ${driver.status === 'available' ? 'bg-emerald-500' : driver.status === 'on_route' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <span className="min-w-0 max-w-full truncate font-medium text-slate-900 text-xs" title={driver.name}>{driver.name}</span>
                          <MonitorBadge tone={driver.status === 'available' ? 'success' : driver.status === 'on_route' ? 'info' : 'neutral'}>{driver.statusLabel}</MonitorBadge>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500" title={`${driver.driverNumber ?? driver.id} · ${driver.vehicle}`}>
                          {driver.driverNumber ?? driver.id} · {driver.vehicle}
                        </p>
                        {driver.distance && driver.distance !== '—' && <p className="mt-0.5 text-xs text-slate-400">{driver.distance}</p>}
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-700" />
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 flex items-center justify-between gap-3 text-xs">
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
                  className="shrink-0 whitespace-nowrap font-medium text-slate-700 hover:text-slate-950"
                >
                  View more &rarr;
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
                  <span className="font-medium text-slate-900 text-sm">Needs Attention</span>
                  <MonitorBadge>{needsAttentionItems.length}</MonitorBadge>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900 text-xs whitespace-nowrap">{item.jobNumber}</span>
                          <MonitorBadge tone={item.badgeColor === 'red' ? 'danger' : 'warning'}>{item.statusLabel}</MonitorBadge>
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
                  className="shrink-0 whitespace-nowrap font-medium text-slate-700 hover:text-slate-950"
                >
                  View all alerts &rarr;
                </button>
              </div>
      </FloatingPanel>
    </div>
  );
};
