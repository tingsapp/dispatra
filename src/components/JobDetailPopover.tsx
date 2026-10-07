import { DriverAvatar } from './DriverAvatar';
import { useOverlayMotion } from './ui/useOverlayMotion';
import { lifecycleLabel, orderAttention } from '../domain/validation';
import { formatWhen } from './orders/OrderDossierSections';
import type { PricingStopInput } from '../types/pricing';
import { formatPhone } from '../lib/phone';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Phone,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Maximize2,
  MessageSquare
} from 'lucide-react';
import { Job, Driver, EligibleDriver } from '../types';
import { ELIGIBLE_DRIVERS } from '../data/mockData';
import { describePrice } from '../lib/orderPricing';
import { useMapPopupPlacement } from './monitor/useMapPopupPlacement';

const visitLabel = (status?: string) => status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ') : 'Not started';

/** Name and contact details with call / text actions when a phone number exists. */
function ContactCard({ label, name, phone, email }: { label: string; name: string; phone?: string; email?: string }) {
  const action = 'p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50';
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 flex items-center justify-between gap-2">
    <div className="min-w-0">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 truncate">{name}</div>
      <div className="text-slate-500 truncate">{[formatPhone(phone), email].filter(Boolean).join(' · ') || 'No contact details'}</div>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {phone && <a href={`tel:${phone}`} className={action} aria-label={`Call ${name}`} title="Call"><Phone className="w-3.5 h-3.5" /></a>}
      {phone && <a href={`sms:${phone}`} className={action} aria-label={`Text ${name}`} title="Text"><MessageSquare className="w-3.5 h-3.5" /></a>}
    </div>
  </div>;
}

interface JobDetailPopoverProps {
  job: Job;
  live?: boolean;
  drivers?: Driver[];
  stopStatuses?: Record<string, string>;
  onAssignDriver?: (driverId: string) => void;
  onClose: () => void;
  showAssignDriver: boolean;
  setShowAssignDriver: React.Dispatch<React.SetStateAction<boolean>>;
  showAiRecommendation: boolean;
  setShowAiRecommendation: React.Dispatch<React.SetStateAction<boolean>>;
  onApproveRecommendation: () => void;
  onKeepCurrent: () => void;
  onActionNotification: (msg: string) => void;
  onOpenFullDetails?: () => void;
  onOpenAllDrivers?: () => void;
  position?: { x: number; y: number };
  /** Company time zone for scheduled times. */
  timeZone?: string;
  /** Live Dispatch agent panel for an unassigned Order; replaces the prototype recommendation. */
  recommendation?: React.ReactNode;
}

export const JobDetailPopover: React.FC<JobDetailPopoverProps> = ({
  job,
  live = false,
  drivers = [],
  stopStatuses = {},
  onAssignDriver,
  onClose,
  showAssignDriver,
  setShowAssignDriver,
  showAiRecommendation,
  setShowAiRecommendation,
  onApproveRecommendation,
  onKeepCurrent,
  onActionNotification,
  onOpenFullDetails,
  onOpenAllDrivers,
  position,
  timeZone = 'America/Vancouver',
  recommendation
}) => {
  const overlayMotion = useOverlayMotion();
  const [activeTab, setActiveTab] = useState<'overview' | 'stops' | 'notes'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const assigned = drivers.find(row => row.id === job.assignedDriverId);
  const assignedCode = assigned ? assigned.driverNumber ?? assigned.id.slice(0, 8) : '';
  const [selectedDriverCode, setSelectedDriverCode] = useState<string>(live ? assignedCode : 'D09');
  // Start each order from its current driver so re-assigning the same driver is never offered.
  useEffect(() => { if (live) setSelectedDriverCode(assignedCode); }, [job.id, assignedCode]);
  const canAssign = !live || job.lifecycleStatus === 'NEW' || job.lifecycleStatus === 'ASSIGNED';
  const eligibleDrivers: (EligibleDriver & { unavailableReason?: string })[] = live ? drivers.map(driver => ({
    id: driver.id, code: driver.driverNumber ?? driver.id.slice(0, 8), name: driver.name,
    avatar: driver.avatar, distance: driver.distance || '—', eta: driver.eta,
    status: driver.status === 'on_route' ? 'on_route' as const : 'available' as const,
    unavailableReason: driver.accountStatus === 'INACTIVE' ? 'Inactive account'
      : [driver.dutyStatus !== 'ON_DUTY' ? 'Off duty' : '', !driver.currentVehicleId ? 'No vehicle attached' : '', driver.status === 'on_route' ? 'On route' : ''].filter(Boolean).join(' ') || undefined,
  })) : ELIGIBLE_DRIVERS;

  const { ref, placement } = useMapPopupPlacement(position);
  const baseLeft = placement?.x ?? 0;
  const baseTop = placement?.y ?? 0;

  const assignDriverLeft = Math.max(12, Math.min((placement?.width ?? 0) - 280 - 12, baseLeft + 255));
  const assignDriverTop = Math.max(12, Math.min((placement?.height ?? 0) - 12, baseTop + 130));

  const aiRecLeft = Math.max(12, Math.min((placement?.width ?? 0) - 310 - 12, baseLeft + 360));
  const aiRecTop = Math.max(12, Math.min((placement?.height ?? 0) - 12, baseTop - 50));

  const filteredDrivers = eligibleDrivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const when = (iso?: string | null) => formatWhen(iso, timeZone) || 'Not set';
  const street = (address: string) => address.split(',')[0].trim();
  const stops: PricingStopInput[] = job.pricingInput?.stops ?? [
    { id: 'pickup', type: 'PICKUP', label: job.pickupAddress, zoneId: null, residential: false, waitMinutes: 0 },
    { id: 'dropoff', type: 'DROPOFF', label: job.dropoffAddress, zoneId: null, residential: false, waitMinutes: 0 }];
  const pickup = stops.find(stop => stop.type === 'PICKUP');
  const drops = stops.filter(stop => stop.type === 'DROPOFF');
  const drop = [...drops].sort((a, b) => (b.windowEnd ?? '').localeCompare(a.windowEnd ?? ''))[0] ?? drops[0];
  const dropCount = drops.length;
  const price = describePrice(job);
  const driver = drivers.find(row => row.id === job.assignedDriverId);
  const requested = drivers.find(row => row.id === job.pricingInput?.preferredDriverId);
  const attention = orderAttention(job);
  const notes = [
    ...(job.handlingInstructions?.trim() ? [{ label: 'Handling instructions', text: job.handlingInstructions.trim() }] : []),
    ...stops.flatMap((stop, index) => stop.instructions?.trim() ? [{ label: `${index + 1}. ${stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'} instructions`, text: stop.instructions.trim() }] : []),
  ];

  // Closing parent menu closes children and grand-child
  const handleParentClose = () => {
    setShowAssignDriver(false);
    setShowAiRecommendation(false);
    onClose();
  };

  // Closing child menu closes itself and grand-child, parent stays open
  const handleChildClose = () => {
    setShowAssignDriver(false);
    setShowAiRecommendation(false);
  };

  // Closing grand-child closes only itself
  const handleGrandChildClose = () => {
    setShowAiRecommendation(false);
  };

  return (
    <>
      {/* 1. MAIN JOB DETAIL POPOVER - Anchored with arrow pointing toward Job marker */}
      <motion.div
        {...overlayMotion}
        ref={ref}
        data-map-detail-overlay="job"
        className="absolute z-40 pointer-events-auto select-none"
        style={{
          left: `${baseLeft}px`,
          top: `${baseTop}px`,
          visibility: placement ? 'visible' : 'hidden'
        }}
      >
        {/* Directional arrow pointing up toward Job marker on the map */}

        <div className="app-menu-surface w-[340px] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-5 relative">
          {/* Header with Job # and status */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-medium text-slate-900 text-lg">
                {job.jobNumber}
              </span>
              <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${attention.length ? 'bg-rose-50 text-rose-600 border-rose-200/60' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {lifecycleLabel(job)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onOpenFullDetails && (
                <button
                  onClick={onOpenFullDetails}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="View order details"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleParentClose}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close Job Details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="monitor-order-tabs grid grid-cols-3 gap-1 mb-3.5 text-slate-500" role="tablist" aria-label="Order details tabs">
            {([['overview', 'Overview'], ['stops', `Stops (${stops.length})`], ['notes', 'Notes']] as const).map(([id, label]) =>
              <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`app-tab ${activeTab === id ? 'bg-app-selected text-app-text' : 'hover:text-slate-800'}`}>{label}</button>)}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800 truncate">{job.serviceLevel || job.jobType}</span>
                <span className={`font-semibold shrink-0 ${price.tone === 'warn' ? 'text-amber-700' : price.tone === 'muted' ? 'text-slate-400' : 'text-slate-900'}`}>{price.text}</span>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
                <dt className="text-slate-500">Pickup</dt><dd className="min-w-0" title={pickup?.label ?? job.pickupAddress}><div className="text-slate-800">{when(pickup?.windowStart ?? job.pricingInput?.scheduledAt ?? job.scheduledTime)}</div><div className="text-slate-500 truncate">{street(pickup?.label ?? job.pickupAddress)}</div></dd>
                <dt className="text-slate-500">Deliver by</dt><dd className="min-w-0" title={drop?.label ?? job.dropoffAddress}>{drop?.windowEnd && <div className="text-slate-800">{when(drop.windowEnd)}</div>}<div className="text-slate-500 truncate">{street(drop?.label ?? job.dropoffAddress)}{dropCount > 1 ? ` +${dropCount - 1}` : ''}</div></dd>
              </dl>
              <ContactCard label="Shipper" name={job.customerName} phone={job.customerPhone} email={job.customerEmail} />
              {driver
                ? <ContactCard label="Driver" name={`${driver.name}${driver.driverNumber ? ` · ${driver.driverNumber}` : ''}`} phone={driver.phone} email={driver.email} />
                : <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"><div className="text-slate-500">Driver</div><div className="font-medium text-amber-700">Unassigned</div>{requested && <div className="text-slate-500 mt-0.5">Shipper requested {requested.name}</div>}</div>}
              {attention.map(item => <p key={item.flag} className="flex items-start gap-1.5 text-amber-800"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{item.detail}</p>)}

              {/* Prototype-only AI fix demonstration */}
              {!live && <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 flex items-center justify-between text-rose-600 font-medium">
                <span className="text-xs truncate max-w-[170px]">{job.riskText}</span>
                <button data-map-detail-toggle="recommendation" onClick={() => setShowAiRecommendation((prev) => !prev)} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-colors" title="Toggle AI Recommendation Fix">
                  <Sparkles className="w-3 h-3 fill-white" /><span>AI Fix</span>
                </button>
              </div>}
            </div>
          )}

          {activeTab === 'stops' && (
            <ol className="space-y-2 text-xs max-h-72 overflow-y-auto">
              {stops.map((stop, index) => <li key={stop.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{index + 1}. {stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'}</span>
                  <span className="text-slate-500">{visitLabel(stopStatuses[stop.id])}</span>
                </div>
                <div className="text-slate-700">{stop.label || '—'}</div>
                {(stop.type === 'PICKUP' ? stop.windowStart : stop.windowEnd) && <div className="text-slate-500">{stop.type === 'PICKUP' ? 'Ready at' : 'Deliver by'} {when(stop.type === 'PICKUP' ? stop.windowStart : stop.windowEnd)}</div>}
                {(stop.contactName || stop.contactPhone) && <div className="flex items-center justify-between gap-2 text-slate-600">
                  <span className="truncate">{[stop.contactName, formatPhone(stop.contactPhone)].filter(Boolean).join(' · ')}</span>
                  {stop.contactPhone && <a href={`tel:${stop.contactPhone}`} className="p-1 rounded-md text-slate-500 hover:bg-white hover:text-slate-900" aria-label={`Call ${stop.contactName || 'stop contact'}`} title="Call"><Phone className="w-3.5 h-3.5" /></a>}
                </div>}
              </li>)}
            </ol>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-2 text-xs">
              {notes.length ? notes.map(note => <div key={note.label} className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/50 text-amber-900"><div className="font-medium">{note.label}</div><p className="mt-0.5 whitespace-pre-line">{note.text}</p></div>)
                : <p className="p-2.5 rounded-xl bg-slate-50 text-slate-500">No handling or stop instructions.</p>}
            </div>
          )}

          {/* Primary Action Button: "Find Driver" (Only toggles child on-demand, does NOT force grandchild) */}
          <div className="pt-3.5 mt-2 flex items-center gap-1.5 relative">
            <button
              data-map-detail-toggle="assignment"
              onClick={() => canAssign && setShowAssignDriver((prev) => !prev)}
              disabled={!canAssign}
              className={`flex-1 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 ${
                showAssignDriver
                  ? 'bg-slate-900 text-white'
                  : 'app-action app-primary text-white shadow-sm shadow-blue-600/20'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{showAssignDriver ? 'Hide Drivers' : !canAssign ? 'Assignment closed' : driver ? 'Change Driver' : 'Find Driver'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. ASSIGN DRIVER CHILD MENU - Displayed on demand with smooth animation - strictly z-50 over parent */}
      <AnimatePresence>
        {showAssignDriver && canAssign && (
          <motion.div
            {...overlayMotion}
            data-map-detail-overlay="assignment"
            className="absolute z-50 pointer-events-auto select-none"
            style={{
              left: `${assignDriverLeft}px`,
              top: `${assignDriverTop}px`
            }}
          >
            {/* Directional arrow pointing left toward the Find Driver button */}

            <div className="app-menu-surface w-[280px] ring-1 ring-slate-900/10 p-4">
              {/* Header with Title and Close Icon */}
              <div className="flex items-center justify-between pb-2 mb-2.5">
                <div className="flex items-center gap-1.5 font-medium text-slate-900 text-xs">
                  <span>Assign Driver</span>
                  <span className="text-xs text-slate-400 font-normal">({filteredDrivers.length})</span>
                </div>
                <button
                  onClick={handleChildClose}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  title="Close Assign Driver"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* On-Demand AI Smart Recommendation trigger banner */}
              {(!live || recommendation) && <div
                data-map-detail-toggle="recommendation"
                onClick={() => setShowAiRecommendation((prev) => !prev)}
                className={`mb-2.5 p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  showAiRecommendation
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-indigo-50/60 border-indigo-200/80 hover:bg-indigo-50'
                }`}
                title="Click to view AI recommendation details"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span className="text-xs font-medium text-indigo-950">AI Recommendation</span>
                </div>
                <span className="text-xs font-medium text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200 group-hover:border-indigo-400">
                  {showAiRecommendation ? 'Open' : 'View'} &rarr;
                </span>
              </div>}

              {/* Search field + filter icon */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="flex-1 relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search drivers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="app-input w-full pl-8 pr-2 focus:bg-white transition-all placeholder-slate-400"
                  />
                </div>
                {!live && <button
                  onClick={() => onActionNotification('Filter eligible drivers')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>}
              </div>

              {/* Registered drivers remain visible with their availability reason. */}
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                {filteredDrivers.map((driver) => {
                  const isCurrent = live && driver.id === job.assignedDriverId;
                  const isSelected = selectedDriverCode === driver.code && (isCurrent || !driver.unavailableReason);
                  return (
                    <button
                      type="button"
                      disabled={isCurrent || !!driver.unavailableReason}
                      aria-pressed={isSelected}
                      key={driver.id}
                      onClick={() => {
                        setSelectedDriverCode(driver.code);
                        if (!live) onActionNotification(`Selected ${driver.name} (${driver.code})`);
                      }}
                      className={`w-full text-left flex items-center justify-between gap-2 p-2 rounded-xl border transition-all cursor-pointer disabled:cursor-not-allowed ${isCurrent ? '' : 'disabled:opacity-60'} ${
                        isSelected
                          ? 'border-slate-300 bg-slate-100'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-slate-900">
                              {driver.code}
                            </span>
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[85px]">
                              {driver.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400">{driver.distance}</span>
                            <span
                              className={`font-semibold ${
                                isCurrent ? 'text-slate-700' : driver.unavailableReason ? 'text-slate-500' : driver.status === 'available'
                                  ? 'text-emerald-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              {isCurrent ? 'Assigned' : driver.unavailableReason || (driver.status === 'available' ? 'Available' : 'On route')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Radio control */}
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
                {!filteredDrivers.length && <p className="py-3 text-xs text-slate-500">{drivers.length || !live ? 'No drivers match your search.' : 'No drivers registered yet.'}</p>}
              </div>

              {live && <button type="button" disabled={selectedDriverCode === assignedCode || !eligibleDrivers.some(driver => driver.code === selectedDriverCode && !driver.unavailableReason)} onClick={() => { const selected = eligibleDrivers.find(driver => driver.code === selectedDriverCode && !driver.unavailableReason); if (selected) onAssignDriver?.(selected.id); }} className="app-action app-primary mt-2 w-full text-white">Assign selected driver</button>}
              {/* Footer View full list link */}
              <div className="pt-2 text-center mt-2">
                <button
                  onClick={() => {
                    if (onOpenAllDrivers) {
                      onOpenAllDrivers();
                    } else {
                      onActionNotification('Showing full roster of eligible fleet drivers');
                    }
                  }}
                  className="text-xs font-medium text-slate-700 hover:text-slate-700 transition-colors"
                >
                  View full list &rarr;
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. AI RECOMMENDATION GRAND-CHILD MENU - Displayed on demand with its own close icon - strictly z-[60] over parent & child */}
      <AnimatePresence>
        {showAiRecommendation && (!live || recommendation) && (
          <motion.div
            {...overlayMotion}
            data-map-detail-overlay="recommendation"
            className="absolute z-[60] pointer-events-auto select-none"
            style={{
              left: `${aiRecLeft}px`,
              top: `${aiRecTop}px`
            }}
          >
            {live ? recommendation : <>
            {/* Grand-child Card with strong elevation above child & parent */}
            <div className="app-menu-surface w-[310px] ring-1 ring-slate-900/10 p-4 relative">
              {/* Header with Job #, ETA, and CLOSE BUTTON */}
              <div className="flex items-center justify-between pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 text-sm">{job.jobNumber}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">
                    At Risk
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-rose-600">
                    ETA: +22m
                  </span>
                  <button
                    onClick={handleGrandChildClose}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="Close AI Recommendation"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* AI Recommendation Banner */}
              <div className="flex items-center justify-between pt-2.5 pb-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                  <Sparkles className="w-3.5 h-3.5 fill-indigo-600" />
                  <span>AI Recommendation</span>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/70">
                  Save 14m
                </span>
              </div>

              {/* Recommendation Title */}
              <div className="text-xs font-medium text-slate-900 mt-1 mb-2">
                Reassign to Maria (D09)
              </div>

              {/* Reasons List with Checkmarks */}
              <div className="space-y-1.5 mb-4 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Maria is 6.2 km away and available.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>No schedule or route conflict.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Improves ETA by 14 minutes.</span>
                </div>
              </div>

              {/* Action Buttons: [Approve] & [Keep Current] */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    onApproveRecommendation();
                    setShowAiRecommendation(false);
                  }}
                  className="flex-1 app-action app-primary text-white font-medium py-2 px-3 rounded-xl text-xs transition-colors shadow-sm shadow-blue-600/25"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    onKeepCurrent();
                    setShowAiRecommendation(false);
                  }}
                  className="app-action app-secondary flex-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium py-2 px-3 rounded-xl text-xs border border-slate-200 transition-colors"
                >
                  Keep Current
                </button>
              </div>
            </div>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
