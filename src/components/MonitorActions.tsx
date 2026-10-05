import { DriverAvatar } from './DriverAvatar';
import { SearchInput } from './ui/SearchInput';
import { FloatingPanel } from './ui/FloatingPanel';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allOperations } from '../operations/api';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { loadVehicles } from '../lib/vehicleStorage';
import { formatPhone } from '../lib/phone';
import { NotificationPanel, useUnreadNotifications } from '../portal/Notifications';
import { lifecycleLabel } from '../domain/validation';
import {
  Search,
  Bell,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
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
  /** Order agent notifications open Orders, where emails needing details are listed as drafts. */
  onOpenEmailDrafts?: () => void;
  onActionNotification: (msg: string) => void;
  drivers?: Driver[];
  jobs?: Job[];
}

function SearchGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section aria-label={title}><h4 className="text-xs font-medium text-slate-400 px-1 pb-1">{title} ({count})</h4>{children}</section>;
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
  onOpenEmailDrafts,
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
  const slug = companySlugForCurrentPath();
  const vehicleQuery = useQuery({ queryKey: ['operations', slug, 'vehicles'], queryFn: () => allOperations.vehicles(slug!), enabled: !!slug && isSearchOpen });
  const vehicles = useMemo(() => slug
    ? (vehicleQuery.data ?? []).filter(row => row.active).map(row => ({ id: row.id, number: row.number, plate: row.plate, detail: [row.data.unit_number, row.data.make_model].filter(Boolean).join(' · ') }))
    : loadVehicles().map(row => ({ id: row.id, number: row.vehicleNumber ?? row.unitNumber, plate: row.plateNumber, detail: [row.unitNumber, row.makeModel].filter(Boolean).join(' · ') })),
    [slug, vehicleQuery.data]);
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

  // Company workspaces read the API inbox; /prototype keeps its static sample alerts.
  const apiUnread = useUnreadNotifications(slug ?? '');
  const unreadCount = slug ? apiUnread : alerts.filter((a) => a.unread).length;

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

  // One query across orders, drivers, vehicles and stop addresses.
  const q = searchQuery.toLowerCase().trim();
  const has = (...values: (string | undefined | null)[]) => values.some(value => value?.toLowerCase().includes(q));
  const digits = q.replace(/\D/g, '');
  const phoneHas = (phone?: string) => digits.length >= 3 && !!phone && phone.replace(/\D/g, '').includes(digits);
  const street = (address: string) => address.split(',')[0].trim();
  const stopsOf = (job: Job) => job.pricingInput?.stops ?? [];
  const filteredJobs = q ? jobs.filter(j => has(j.jobNumber, j.customerName, j.pickupAddress, j.dropoffAddress, ...stopsOf(j).flatMap(stop => [stop.label, stop.contactName]))) : [];
  const filteredDrivers = q ? drivers.filter(d => has(d.name, d.driverNumber ?? d.id, d.email) || phoneHas(d.phone)) : [];
  const filteredVehicles = q ? vehicles.filter(v => has(v.number, v.plate, v.detail)) : [];
  const filteredAddresses = q ? [...jobs.flatMap(job => (stopsOf(job).length ? stopsOf(job).map(stop => stop.label ?? '') : [job.pickupAddress, job.dropoffAddress]).filter(text => text && has(text)).map(text => ({ text, job })))
    .reduce((map, { text, job }) => map.set(text, [...(map.get(text) ?? []), job].filter((row, i, all) => all.indexOf(row) === i)), new Map<string, Job[]>())]
    .map(([text, rows]) => ({ text, jobs: rows })) : [];
  const resultCount = filteredJobs.length + filteredDrivers.length + filteredVehicles.length + filteredAddresses.length;
  const pick = (select: () => void) => { select(); setIsSearchOpen(false); };

  return (
    <div className="absolute top-5 right-6 z-30 pointer-events-auto flex items-center gap-2.5 select-none">
      {/* 1. SEARCH ICON BUTTON */}
      <FloatingPanel open={isSearchOpen} onOpenChange={changeSearch} label="Search"
        align="end" size="rich" className="app-map-menu p-3" autoFocusSelector="input" trigger={
        <button
          aria-expanded={isSearchOpen}
          className="app-metric app-map-icon relative"
          title="Search orders, drivers, vehicles or addresses"
        >
          <Search className="w-4 h-4 stroke-[2.2]" />
        </button>
        }>


              <div className="flex items-center justify-between pb-2.5">
                <span className="font-medium text-sm text-slate-900">
                  Search
                </span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                  title="Close Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search orders, drivers, vehicles or addresses..." className="mt-3" />

              <div className="mt-2.5 max-h-72 overflow-y-auto text-xs">
                {!q ? <p className="py-3 px-1 text-slate-500">Search by order number, shipper, driver name or phone, vehicle number or plate, or any pickup or delivery address.</p>
                : !resultCount ? <p className="py-6 text-center text-slate-400">No results for "{searchQuery}"</p>
                : <div className="space-y-3 py-1">
                  {filteredJobs.length > 0 && <SearchGroup title="Orders" count={filteredJobs.length}>{filteredJobs.map(job => <button type="button" key={job.id} onClick={() => pick(() => onSelectJob?.(job.jobNumber))} className="w-full text-left p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-3">
                    <span className="min-w-0"><span className="font-medium text-slate-900">{job.jobNumber}</span> <span className="text-slate-600">· {job.customerName}</span><span className="block text-slate-500 truncate">{street(job.pickupAddress)} → {street(job.dropoffAddress)}</span></span>
                    <span className="text-slate-500 shrink-0">{lifecycleLabel(job)}</span>
                  </button>)}</SearchGroup>}
                  {filteredDrivers.length > 0 && <SearchGroup title="Drivers" count={filteredDrivers.length}>{filteredDrivers.map(driver => <button type="button" key={driver.id} onClick={() => pick(() => onSelectDriver?.(driver.id))} className="w-full text-left p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0"><DriverAvatar name={driver.name} avatar={driver.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" /><span className="min-w-0"><span className="font-medium text-slate-800">{driver.name}</span> <span className="text-slate-400">{driver.driverNumber ?? driver.id}</span>{driver.phone && <span className="block text-slate-500">{formatPhone(driver.phone)}</span>}</span></span>
                    <span className={`shrink-0 font-medium ${driver.status === 'available' ? 'text-emerald-600' : 'text-slate-500'}`}>{driver.statusLabel}</span>
                  </button>)}</SearchGroup>}
                  {filteredVehicles.length > 0 && <SearchGroup title="Vehicles" count={filteredVehicles.length}>{filteredVehicles.map(vehicle => { const driver = drivers.find(row => row.currentVehicleId === vehicle.id); return <button type="button" key={vehicle.id} onClick={() => pick(() => driver ? onSelectDriver?.(driver.id) : onActionNotification(`${vehicle.number} is not attached to a driver.`))} className="w-full text-left p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-3">
                    <span className="min-w-0"><span className="font-medium text-slate-900">{vehicle.number}</span> <span className="text-slate-600">· {vehicle.plate}</span>{vehicle.detail && <span className="block text-slate-500 truncate">{vehicle.detail}</span>}</span>
                    <span className="text-slate-500 shrink-0">{driver ? driver.name : 'No driver'}</span>
                  </button>; })}</SearchGroup>}
                  {filteredAddresses.length > 0 && <SearchGroup title="Addresses" count={filteredAddresses.length}>{filteredAddresses.map(address => <button type="button" key={address.text} onClick={() => pick(() => onSelectJob?.(address.jobs[0].jobNumber))} className="w-full text-left p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-3">
                    <span className="flex items-start gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 mt-px text-slate-400 shrink-0" /><span className="min-w-0 truncate text-slate-800">{address.text}</span></span>
                    <span className="text-slate-500 shrink-0">{address.jobs.map(job => job.jobNumber).join(', ')}</span>
                  </button>)}</SearchGroup>}
                </div>}
              </div>
      </FloatingPanel>

      {/* 2. NOTIFICATION ICON BUTTON */}
      <FloatingPanel open={isNotificationOpen} onOpenChange={changeNotification} label="Notifications"
        align="end" size="rich" className="app-map-menu p-3" autoFocusSelector="input" trigger={
        <button
          aria-expanded={isNotificationOpen}
          className="app-metric app-map-icon relative"
          title="Dispatch alerts and notifications"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="w-4 h-4 stroke-[2.2]" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>
        }>
        {slug ? isNotificationOpen && <NotificationPanel slug={slug} onOpen={row => {
          const job = jobs.find(item => item.id === row.order_id);
          if (/^(intake|mailbox)\./.test(row.kind)) onOpenEmailDrafts?.();
          else if (job) onSelectJob?.(job.jobNumber);
          setIsNotificationOpen(false);
        }} /> : <>


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
        </>}
      </FloatingPanel>
    </div>
  );
};
