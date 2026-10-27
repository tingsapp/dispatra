import { PersonContactActions } from './contact/PersonContactActions';
import { DriverAvatar } from './DriverAvatar';
import { DriverActivity } from './entities/DriverActivity';
import { DriverOrders } from './entities/DriverOrders';
import { Tabs } from './ui/Tabs';
import { SearchInput } from './ui/SearchInput';
import { loadBillingConfig } from '../lib/billingStorage';
import { useOverlayMotion } from './ui/useOverlayMotion';
import { lifecycleLabel } from '../domain/validation';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Sparkles } from 'lucide-react';
import { Job, Driver, NeedsAttentionItem, ModalDialogType } from '../types';
import { formatWhen } from './orders/OrderDossierSections';
import { ReadFields } from './entities/Fields';
import { formatPhone } from '../lib/phone';
import { OrderMapCheckbox, type OrderMapVisibilityProps } from './monitor/OrderMapCheckbox';
import { isActiveMonitorOrder } from './monitor/orderVisibility';
import { MonitorBadge } from './monitor/MonitorBadge';
import { DialogHeader, DialogBody } from './ui/Dialog';
import { useEntityDialog } from './entities/useEntityDialog';

interface DetailModalDialogProps extends OrderMapVisibilityProps {
  isOpen?: boolean;
  type?: ModalDialogType | null;
  data?: any;
  state?: {
    isOpen: boolean;
    type: ModalDialogType | null;
    data?: any;
  };
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
  onSelectDriver?: (driverId: string) => void;
  onApproveAiFix?: () => void;
  onApproveRecommendation?: () => void;
  onActionNotification: (msg: string) => void;
  allJobs?: Job[];
  jobs?: Job[];
  allDrivers?: Driver[];
  drivers?: Driver[];
  allExceptions?: NeedsAttentionItem[];
  needsAttentionItems?: NeedsAttentionItem[];
  /** Company time zone for scheduled times; the prototype falls back to its local settings. */
  timeZone?: string;
  /** Opens the driver on the Drivers page for editing. */
  onMessageDriver?: (driver: Driver) => void;
  onEditDriver?: (driver: Driver) => void;
}

export const DetailModalDialog: React.FC<DetailModalDialogProps> = (props) => {
  const overlayMotion = useOverlayMotion();
  const {
    isOpen,
    type,
    data,
    state,
    onClose,
    onSelectJob,
    onSelectDriver,
    onApproveAiFix,
    onApproveRecommendation,
    onActionNotification,
    allJobs,
    jobs,
    hiddenOrderIds,
    onOrderVisibilityChange,
    allDrivers,
    drivers,
    allExceptions,
    needsAttentionItems,
    timeZone,
    onEditDriver,
    onMessageDriver
  } = props;

  const effectiveIsOpen = isOpen ?? state?.isOpen ?? false;
  const effectiveType = type ?? state?.type ?? null;
  const effectiveData = data ?? state?.data;
  const effectiveJobs = allJobs ?? jobs ?? [];
  const effectiveDrivers = allDrivers ?? drivers ?? [];
  const effectiveExceptions = allExceptions ?? needsAttentionItems ?? [];
  const effectiveApproveAi = onApproveAiFix ?? onApproveRecommendation;

  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobFilter, setJobFilter] = useState<'all' | 'at_risk' | 'on_time'>('all');
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<'all' | 'available' | 'on_route'>('all');

  const dialogLabel = effectiveType === 'all_drivers' ? 'Drivers' : effectiveType === 'all_jobs' ? 'Active Orders'
    : effectiveType === 'all_exceptions' ? 'Needs Attention' : (effectiveData as Driver | undefined)?.name ?? 'Driver details';
  useEntityDialog(effectiveIsOpen, onClose, dialogLabel);
  useEffect(() => {
    if (!effectiveIsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [effectiveIsOpen]);

  if (!effectiveIsOpen || !effectiveType) return null;

  // Render content according to modal type
  return (
    <AnimatePresence>
      <div
        className="app-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
        onClick={onClose}
        data-entity-dialog
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
      >
        <motion.div
          {...overlayMotion}
          onClick={(e) => e.stopPropagation()}
          className="app-dialog-surface app-monitor-dialog relative w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* ========================================================= */}
          {/* VIEW 2: FULL DRIVER PROFILE & FLEET TELEMETRY             */}
          {/* ========================================================= */}
          {effectiveType === 'driver_detail' && (
            <DriverDetailView
              driver={effectiveData as Driver}
              jobs={effectiveJobs}
              onClose={onClose}
              timeZone={timeZone ?? loadBillingConfig().general.timeZone}
              onSelectJob={onSelectJob}
              onEditDriver={onEditDriver}
              onMessageDriver={onMessageDriver}
            />
          )}

          {/* ========================================================= */}
          {/* VIEW 3: ALL ACTIVE DISPATCH JOBS ROSTER                   */}
          {/* ========================================================= */}
          {effectiveType === 'all_jobs' && (
            <AllJobsRosterView
              jobs={effectiveJobs.filter(isActiveMonitorOrder)}
              hiddenOrderIds={hiddenOrderIds}
              onOrderVisibilityChange={onOrderVisibilityChange}
              drivers={effectiveDrivers}
              timeZone={timeZone ?? loadBillingConfig().general.timeZone}
              searchQuery={jobSearchQuery}
              setSearchQuery={setJobSearchQuery}
              filter={jobFilter}
              setFilter={setJobFilter}
              onClose={onClose}
              onSelectJob={onSelectJob}
            />
          )}

          {/* ========================================================= */}
          {/* VIEW 4: ALL FLEET DRIVERS ROSTER                          */}
          {/* ========================================================= */}
          {effectiveType === 'all_drivers' && (
            <AllDriversRosterView
              drivers={effectiveDrivers}
              searchQuery={driverSearchQuery}
              setSearchQuery={setDriverSearchQuery}
              filter={driverFilter}
              setFilter={setDriverFilter}
              onClose={onClose}
              onSelectDriver={onSelectDriver}
              onActionNotification={onActionNotification}
            />
          )}

          {/* ========================================================= */}
          {/* VIEW 5: OPERATIONAL EXCEPTIONS & NEEDS ATTENTION          */}
          {/* ========================================================= */}
          {effectiveType === 'all_exceptions' && (
            <AllExceptionsView
              exceptions={effectiveExceptions}
              onClose={onClose}
              onSelectJob={onSelectJob}
              onApproveAiFix={effectiveApproveAi}
              onActionNotification={onActionNotification}
            />
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 2: DRIVER FULL PROFILE & TELEMETRY                                */
/* -------------------------------------------------------------------------- */
const DriverDetailView: React.FC<{
  driver: Driver;
  jobs: Job[];
  timeZone: string;
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
  onMessageDriver?: (driver: Driver) => void;
  onEditDriver?: (driver: Driver) => void;
}> = ({ driver, jobs, timeZone, onClose, onSelectJob, onEditDriver, onMessageDriver }) => {
  const active = jobs.filter(job => job.assignedDriverId === driver.id && ['ASSIGNED', 'IN_PROGRESS'].includes(job.lifecycleStatus ?? ''));
  const phone = formatPhone(driver.phone);
  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="app-section-title text-slate-900">{driver.name}</h2>
              <span className="text-xs text-slate-500">{driver.driverNumber ?? driver.id}</span>
              <MonitorBadge tone={driver.status === 'available' ? 'success' : driver.status === 'on_route' ? 'info' : 'neutral'}>{driver.statusLabel}</MonitorBadge>
            </div>
            {phone && <p className="text-xs text-slate-500 mt-0.5">{phone}</p>}
          </div>
        </div>
        <button onClick={onClose} className="app-dialog-close" aria-label="Close dialog" title="Close dialog (Esc)"><X className="w-5 h-5" /></button>
      </div>

      <div className="px-6 pb-6 overflow-y-auto space-y-6 flex-1">
        <Tabs label="Driver details tabs" items={[
          { id: 'details', label: 'Details', content: <>
        <section aria-label="Driver profile" className="space-y-3">
          <h3 className="app-section-title">Profile</h3>
          <ReadFields values={{
            Phone: phone, Email: driver.email, Address: driver.address,
            Account: driver.accountStatus === 'INACTIVE' ? 'Inactive' : driver.accountStatus ? 'Active' : undefined,
            Duty: driver.dutyStatus === 'ON_DUTY' ? 'On duty' : driver.dutyStatus ? 'Off duty' : undefined,
            'Attached vehicle': driver.vehicle,
          }} />
        </section>

        <section aria-label="Active orders" className="space-y-3">
          <h3 className="app-section-title">Active orders</h3>
          {active.length ? <ul className="space-y-2">{active.map(job => <li key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs">
            <div className="min-w-0"><div className="font-medium text-slate-900">{job.jobNumber} · {lifecycleLabel(job)}</div><div className="text-slate-500 truncate">{job.pickupAddress.split(',')[0]} → {job.dropoffAddress.split(',')[0]}</div></div>
            {onSelectJob && <button type="button" onClick={() => { onSelectJob(job.jobNumber); onClose(); }} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium">Track &rarr;</button>}
          </li>)}</ul> : <p className="text-xs text-slate-500">No assigned orders.</p>}
        </section>

        <DriverActivity driver={driver} jobs={jobs} />
          </> },
          { id: 'orders', label: 'Orders', content: <DriverOrders driver={driver} jobs={jobs} timeZone={timeZone} onSelectJob={onSelectJob && (jobNumber => { onSelectJob(jobNumber); onClose(); })} /> },
        ]} />
      </div>

      <div className="px-6 py-4 flex items-center justify-between gap-2 shrink-0 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <PersonContactActions name={driver.name} phone={driver.phone} onMessage={onMessageDriver && (() => onMessageDriver(driver))} labelled />
        </div>
        {onEditDriver && <button type="button" onClick={() => onEditDriver(driver)} className="app-action app-primary text-white">Edit driver</button>}
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 3: ALL ACTIVE DISPATCH JOBS ROSTER                                */
/* -------------------------------------------------------------------------- */
const AllJobsRosterView: React.FC<OrderMapVisibilityProps & {
  jobs: Job[];
  drivers: Driver[];
  timeZone: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: 'all' | 'at_risk' | 'on_time';
  setFilter: (f: 'all' | 'at_risk' | 'on_time') => void;
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
}> = ({ jobs, drivers, timeZone, searchQuery, setSearchQuery, filter, setFilter, onClose, onSelectJob, hiddenOrderIds, onOrderVisibilityChange }) => {
  const q = searchQuery.toLowerCase().trim();
  const atRisk = (j: Job) => j.status === 'at_risk' || j.status === 'late_start';
  const filtered = jobs.filter((j) => {
    const text = [j.jobNumber, j.customerName, j.pickupAddress, j.dropoffAddress].join(' ').toLowerCase();
    if (q && !text.includes(q)) return false;
    if (filter === 'at_risk') return atRisk(j);
    if (filter === 'on_time') return j.status === 'on_time';
    return true;
  });
  const street = (address: string) => address.split(',')[0].trim();
  const tab = (value: typeof filter, label: string) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`app-tab ${filter === value ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>;

  return (
    <>
      <DialogHeader title="Active Orders" description={filtered.length === jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'order' : 'orders'}` : `${filtered.length} of ${jobs.length} orders`} onClose={onClose} />

      <div className="px-6 pb-3 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
        <SearchInput className="flex-1 w-full" value={searchQuery} onChange={setSearchQuery} placeholder="Search orders, shippers or addresses..." />
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs">
          {tab('all', `All (${jobs.length})`)}{tab('at_risk', 'At Risk')}{tab('on_time', 'On Time')}
        </div>
      </div>

      <ul aria-label="Active orders" className="app-dialog-body divide-y divide-slate-100">
        {filtered.length === 0 && <li className="py-10 text-center text-sm text-slate-500">{jobs.length ? 'No orders match your search or filter.' : 'No active orders.'}</li>}
        {filtered.map((j) => {
          const driver = drivers.find(d => d.id === j.assignedDriverId);
          return <li key={j.id} className="flex items-start gap-1 py-1 first:pt-0 last:pb-0">
            <div className="shrink-0 pt-1.5"><OrderMapCheckbox job={j} hiddenOrderIds={hiddenOrderIds} onOrderVisibilityChange={onOrderVisibilityChange} /></div>
            <button type="button" onClick={() => { onSelectJob?.(j.jobNumber); onClose(); }}
              className="min-w-0 flex-1 rounded-lg px-2 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-app-accent transition-colors grid grid-cols-1 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-[13px] leading-5">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-slate-900">{j.jobNumber}</span>
                  <MonitorBadge tone={atRisk(j) ? 'danger' : 'neutral'}>{atRisk(j) ? 'At risk' : lifecycleLabel(j)}</MonitorBadge>
                </span>
                <span className="mt-1 block truncate text-slate-500" title={j.customerName}>{j.customerName}</span>
              </span>
              <span className="grid min-w-0 gap-1 text-slate-600">
                <span className="flex min-w-0 items-center gap-2" title={j.pickupAddress}>
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-slate-400 bg-white" />
                  <span className="sr-only">Pickup: </span><span className="truncate">{street(j.pickupAddress)}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2" title={j.dropoffAddress}>
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-slate-600" />
                  <span className="sr-only">Drop-off: </span><span className="truncate">{street(j.dropoffAddress)}</span>
                </span>
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:block sm:text-right">
                <span className={`min-w-0 truncate sm:block font-medium ${driver ? 'text-slate-800' : 'text-amber-700'}`} title={driver?.name}>{driver ? driver.name : 'Unassigned'}</span>
                <span className="text-xs text-slate-500 sm:mt-1 sm:block">{formatWhen(j.pricingInput?.scheduledAt ?? j.scheduledTime, timeZone)}</span>
              </span>
            </button>
          </li>;
        })}
      </ul>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 4: ALL FLEET DRIVERS ROSTER                                       */
/* -------------------------------------------------------------------------- */
const AllDriversRosterView: React.FC<{
  drivers: Driver[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: 'all' | 'available' | 'on_route';
  setFilter: (f: 'all' | 'available' | 'on_route') => void;
  onClose: () => void;
  onSelectDriver?: (driverId: string) => void;
  onActionNotification: (msg: string) => void;
}> = ({ drivers, searchQuery, setSearchQuery, filter, setFilter, onClose, onSelectDriver }) => {
  const filtered = drivers.filter(driver => {
    const query = searchQuery.toLowerCase().trim();
    const matches = [driver.name, driver.driverNumber ?? driver.id, driver.vehicle].some(value => value.toLowerCase().includes(query));
    return matches && (filter === 'all' || driver.status === filter);
  });
  const description = filtered.length === drivers.length
    ? `${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'}` : `${filtered.length} of ${drivers.length} drivers`;
  const tab = (value: typeof filter, label: string) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className="app-tab">{label}</button>;
  return <>
    <DialogHeader title="Drivers" description={description} onClose={onClose} />
    <div className="px-6 pb-4 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
      <SearchInput className="flex-1 w-full" value={searchQuery} onChange={setSearchQuery} placeholder="Search by driver name, ID, vehicle..." />
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-auto">
        {tab('all', `All (${drivers.length})`)}{tab('available', 'Available')}{tab('on_route', 'On route')}
      </div>
    </div>
    <DialogBody>
      <ul aria-label="Drivers" className="divide-y divide-slate-100">
        {filtered.length === 0 && <li className="py-8 text-center text-sm text-slate-500">{drivers.length ? 'No drivers match your search or filter.' : 'No drivers yet.'}</li>}
        {filtered.map(driver => <li key={driver.id} className="py-1 first:pt-0 last:pb-0">
          <button type="button" aria-label={`${driver.driverNumber ?? driver.id} ${driver.name}`}
            onClick={() => { onSelectDriver?.(driver.id); onClose(); }}
            className="flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-3 text-left text-[13px] leading-5 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-app-accent">
            <DriverAvatar name={driver.name} avatar={driver.avatar} alt="" className="size-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
            <span className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <span className="min-w-0">
                <span className="block font-medium text-slate-900 [overflow-wrap:anywhere]">{driver.name}</span>
                <span className="mt-1 block text-slate-500 [overflow-wrap:anywhere]">{driver.driverNumber ?? driver.id}</span>
              </span>
              <span className="order-3 min-w-0 text-slate-500 sm:order-2">
                <span className="block truncate" title={driver.vehicle}>{driver.vehicle}</span>
                {driver.nextStop && driver.nextStop !== 'Not set' && <span className="mt-1 block truncate" title={driver.nextStop}>Next: {driver.nextStop}</span>}
                {driver.eta && driver.eta !== '-' && <span className="mt-1 block [overflow-wrap:anywhere]">{driver.eta}</span>}
              </span>
              <span className="order-2 sm:order-3 sm:text-right">
                <MonitorBadge tone={driver.status === 'available' ? 'success' : driver.status === 'on_route' ? 'info' : 'neutral'}>{driver.statusLabel}</MonitorBadge>
              </span>
            </span>
          </button>
        </li>)}
      </ul>
    </DialogBody>
  </>;
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 5: ALL OPERATIONAL EXCEPTIONS (NEEDS ATTENTION)                    */
/* -------------------------------------------------------------------------- */
const AllExceptionsView: React.FC<{
  exceptions: NeedsAttentionItem[];
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
  onApproveAiFix?: () => void;
  onActionNotification: (msg: string) => void;
}> = ({
  exceptions,
  onClose,
  onSelectJob,
  onApproveAiFix,
  onActionNotification
}) => {
  return (
    <>
      <DialogHeader title="Needs Attention" description={`${exceptions.length} ${exceptions.length === 1 ? 'alert' : 'alerts'}`} onClose={onClose} />

      <DialogBody>
        <ul aria-label="Alerts requiring attention" className="divide-y divide-slate-100">
          {exceptions.length === 0 && <li className="py-8 text-center text-sm text-slate-500">No alerts requiring attention.</li>}
          {exceptions.map(item => <li key={item.id} className="flex flex-col gap-3 px-2 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-start sm:gap-6 text-[13px] leading-5">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900 [overflow-wrap:anywhere]">{item.jobNumber}</span>
                <MonitorBadge tone={item.badgeColor === 'red' ? 'danger' : 'warning'}>{item.statusLabel}</MonitorBadge>
              </div>
              <p className="text-slate-700 whitespace-pre-line [overflow-wrap:anywhere]">{item.subtitle}</p>
              <div className="flex items-start gap-1.5 text-slate-500">
                <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{item.pickupAddress}</span>
              </div>
            </div>
            {(onSelectJob || (item.jobNumber === '#461' && onApproveAiFix)) && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
              {item.jobNumber === '#461' && onApproveAiFix && <button type="button"
                onClick={() => { onApproveAiFix(); onClose(); }}
                className="app-action app-primary app-action-compact max-w-full whitespace-normal text-xs">
                <Sparkles aria-hidden="true" className="size-3.5 shrink-0 fill-white" />
                <span>Execute AI Remedy (Maria D09)</span>
              </button>}
              {onSelectJob && <button type="button"
                onClick={() => { onSelectJob(item.jobNumber); onClose(); }}
                className="rounded-md py-1 font-medium text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent">
                Inspect on Map &rarr;
              </button>}
            </div>}
          </li>)}
        </ul>
      </DialogBody>

    </>
  );
};
