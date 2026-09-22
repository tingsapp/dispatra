import { SearchInput } from './ui/SearchInput';
import { loadBillingConfig } from '../lib/billingStorage';
import { formatWeight } from '../lib/units';
import { Button } from './ui/button';
import { useOverlayMotion } from './ui/useOverlayMotion';
import { OrderDetails } from './entities/OrderFields';
import { StopDetails } from './entities/StopItemFields';
import { lifecycleLabel } from '../domain/validation';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Truck,
  User,
  Clock,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Package,
  FileText,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Navigation,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Zap,
  DollarSign,
  Tag,
  BadgePercent,
  Check,
  Layers
} from 'lucide-react';
import { Job, Driver, NeedsAttentionItem, ModalDialogType } from '../types';
import { Select } from './ui/Select';
import { PriceBreakdown } from './pricing/PriceBreakdown';
import { describePrice } from '../lib/orderPricing';

interface DetailModalDialogProps {
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
    allDrivers,
    drivers,
    allExceptions,
    needsAttentionItems
  } = props;

  const effectiveIsOpen = isOpen ?? state?.isOpen ?? false;
  const effectiveType = type ?? state?.type ?? null;
  const effectiveData = data ?? state?.data;
  const effectiveJobs = allJobs ?? jobs ?? [];
  const effectiveDrivers = allDrivers ?? drivers ?? [];
  const effectiveExceptions = allExceptions ?? needsAttentionItems ?? [];
  const effectiveApproveAi = onApproveAiFix ?? onApproveRecommendation;

  const [activeJobTab, setActiveJobTab] = useState<'overview' | 'cargo' | 'customer' | 'audit'>('overview');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobFilter, setJobFilter] = useState<'all' | 'at_risk' | 'on_time'>('all');
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<'all' | 'available' | 'on_route'>('all');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && effectiveIsOpen) {
        onClose();
      }
    };
    if (effectiveIsOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [effectiveIsOpen, onClose]);

  if (!effectiveIsOpen || !effectiveType) return null;

  // Render content according to modal type
  return (
    <AnimatePresence>
      <div
        className="app-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          {...overlayMotion}
          onClick={(e) => e.stopPropagation()}
          className="app-dialog-surface relative w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* ========================================================= */}
          {/* VIEW 1: FULL JOB DOSSIER & DETAILS                        */}
          {/* ========================================================= */}
          {effectiveType === 'job_detail' && (
            <JobDetailView
              job={effectiveData as Job}
              activeTab={activeJobTab}
              setActiveTab={setActiveJobTab}
              onClose={onClose}
              onSelectDriver={onSelectDriver}
              onApproveAiFix={effectiveApproveAi}
              onActionNotification={onActionNotification}
            />
          )}

          {/* ========================================================= */}
          {/* VIEW 2: FULL DRIVER PROFILE & FLEET TELEMETRY             */}
          {/* ========================================================= */}
          {effectiveType === 'driver_detail' && (
            <DriverDetailView
              driver={effectiveData as Driver}
              onClose={onClose}
              onSelectJob={onSelectJob}
              onActionNotification={onActionNotification}
            />
          )}

          {/* ========================================================= */}
          {/* VIEW 3: ALL ACTIVE DISPATCH JOBS ROSTER                   */}
          {/* ========================================================= */}
          {effectiveType === 'all_jobs' && (
            <AllJobsRosterView
              jobs={effectiveJobs}
              searchQuery={jobSearchQuery}
              setSearchQuery={setJobSearchQuery}
              filter={jobFilter}
              setFilter={setJobFilter}
              onClose={onClose}
              onSelectJob={onSelectJob}
              onActionNotification={onActionNotification}
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
/* SUB-VIEW 1: SINGLE JOB FULL DETAIL VIEW                                    */
/* -------------------------------------------------------------------------- */
const JobDetailView: React.FC<{
  job: Job;
  activeTab: 'overview' | 'cargo' | 'customer' | 'audit';
  setActiveTab: (t: 'overview' | 'cargo' | 'customer' | 'audit') => void;
  onClose: () => void;
  onSelectDriver?: (driverId: string) => void;
  onApproveAiFix?: () => void;
  onActionNotification: (msg: string) => void;
}> = ({
  job,
  activeTab,
  setActiveTab,
  onClose,
  onSelectDriver,
  onApproveAiFix,
  onActionNotification
}) => {
  const units = loadBillingConfig().general;
  const isAtRisk = job.status === 'at_risk' || job.status === 'late_start';

  return (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="app-section-title text-slate-900 tracking-tight">
                Job Dossier {job.jobNumber}
              </h2>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isAtRisk
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {lifecycleLabel(job)}
              </span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                • {job.jobType || 'Scheduled Dispatch'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Shipper: <span className="font-medium text-slate-700">{job.customerName}</span> | Scheduled Window: {job.scheduledTime}
            </p>
          </div>
        </div>

        {/* Top Right Close Button */}
        <button
          onClick={onClose}
          className="app-dialog-close"
          aria-label="Close dialog"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 overflow-x-auto bg-white text-sm text-slate-500 shrink-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`app-tab ${
            activeTab === 'overview'
              ? 'bg-app-selected text-app-text'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Route & SLA Overview
        </button>
        <button
          onClick={() => setActiveTab('cargo')}
          className={`app-tab ${
            activeTab === 'cargo'
              ? 'bg-app-selected text-app-text'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Cargo & Manifest
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          className={`app-tab ${
            activeTab === 'customer'
              ? 'bg-app-selected text-app-text'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Shipper & Billing
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`app-tab ${
            activeTab === 'audit'
              ? 'bg-app-selected text-app-text'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Dispatch Timeline
        </button>
      </div>

      {/* Scrollable Body Content */}
      <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
        {/* Risk / Notice Alert Banner */}
        {isAtRisk && (
          <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-rose-900 text-xs">
                  Operational Delay: {job.riskText || '+22 min ETA delay'}
                </div>
                <div className="text-rose-700 text-xs mt-0.5">
                  Severe bridge traffic bottleneck detected along Granville St corridor. AI recommendation available.
                </div>
              </div>
            </div>
            {onApproveAiFix && (
              <button
                onClick={() => {
                  onApproveAiFix();
                  onClose();
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 fill-white" />
                <span>Apply AI Fix (D09)</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <OrderDetails order={job} />
            <div className="space-y-3">{job.pricingInput?.stops.map((stop, i) => <div key={stop.id} className="p-4 border rounded-xl"><h4 className="app-section-title">{i + 1}. {stop.type} · {stop.label}</h4><StopDetails stop={stop} /></div>)}</div>
            {/* Operational Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Service Level</span>
                <p className="text-xs font-medium text-slate-900 mt-0.5">{job.serviceLevel || job.jobType}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Priced Distance</span>
                <p className="text-xs font-medium text-slate-900 mt-0.5">
                  {job.pricingInput?.routeKm != null ? `${job.pricingInput.routeKm} km` : '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Assigned Fleet</span>
                <p className="text-xs font-medium text-slate-900 mt-0.5">{job.assignedDriverId || 'Unassigned'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">POD Status</span>
                <p className="text-xs font-medium text-emerald-600 mt-0.5">Pending Drop-off</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cargo & Manifest */}
        {activeTab === 'cargo' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" />
                  <span className="font-medium text-slate-900 text-xs">Shipment Cargo Manifest</span>
                </div>
                <span className="text-xs font-medium text-slate-600">BOL #BOL-2026-0461</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 text-xs font-medium">Cargo Description</span>
                  <div className="font-medium text-slate-800 text-xs mt-0.5">
                    {job.cargoDescription || 'Commercial Espresso Equipment & Roaster Parts'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs font-medium">Total Weight</span>
                  <div className="font-medium text-slate-800 text-xs mt-0.5">
                    {job.pricing
                      ? `${formatWeight(job.pricing.inputs.actualWeightKg, units)} actual · ${formatWeight(job.pricing.inputs.chargeableWeightKg, units)} chargeable`
                      : job.cargoWeight || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs font-medium">Pallet Count</span>
                  <div className="font-medium text-slate-800 text-xs mt-0.5">{job.pricing?.inputs.pieces ?? job.palletCount ?? '—'} pieces</div>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-slate-400 text-xs font-medium">Special Handling Instructions</span>
                <p className="text-xs text-slate-700 italic mt-0.5">
                  {job.handlingInstructions || 'Fragile electronics calibration. Do not double-stack pallets. Keep upright.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Shipper & Billing */}
        {activeTab === 'customer' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Shipper Contact</span>
                <div className="font-medium text-slate-900 text-sm">{job.customerName}</div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>{job.customerPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                  <span>{job.customerEmail || 'dispatch.contact@client.com'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs text-slate-400 font-medium">Billing & Invoicing</span>
                <div className="font-medium text-slate-900 text-sm">{describePrice(job).text}</div>
                <div className="text-xs text-slate-600">
                  {job.pricing?.rateCard ? (
                    <>
                      Rate Card: <span className="font-medium text-slate-800">{job.pricing.rateCard.name}</span> ·{' '}
                      {job.pricing.rateCard.source.replace(/_/g, ' ').toLowerCase()}
                    </>
                  ) : (
                    'No pricing snapshot'
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {job.pricing?.stage === 'FINAL'
                    ? 'Price finalized — invoice lines come from these charge lines.'
                    : 'Estimate; settled on completion.'}
                </div>
              </div>
            </div>

            {job.pricing && (
              <div className="app-panel">
                <PriceBreakdown snapshot={job.pricing} variant="inline" showMargin={false} />
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Dispatch Timeline */}
        {activeTab === 'audit' && (
          <div className="space-y-3 py-1">
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
              <div>
                <span className="font-medium text-slate-800">09:15 AM — Job Order Created</span>
                <p className="text-slate-500 text-xs">Automated API dispatch ingest from logistics TMS.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <span className="font-medium text-slate-800">09:30 AM — Assigned to Driver {job.assignedDriverId || 'D14'}</span>
                <p className="text-slate-500 text-xs">Dispatched to driver mobile terminal; route accepted.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-rose-500 mt-1" />
              <div>
                <span className="font-medium text-rose-600">10:14 AM — Delay Detected</span>
                <p className="text-slate-500 text-xs">Granville corridor slowdown reported via GPS telemetry.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {job.assignedDriverId && onSelectDriver && (
            <button
              onClick={() => {
                onSelectDriver(job.assignedDriverId!);
                onClose();
              }}
              className="app-action app-secondary"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Driver {job.assignedDriverId}</span>
            </button>
          )}
          <button
            onClick={() => onActionNotification(`Exported manifest for Job ${job.jobNumber}`)}
            className="app-action app-secondary"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Manifest</span>
          </button>
        </div>

      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 2: DRIVER FULL PROFILE & TELEMETRY                                */
/* -------------------------------------------------------------------------- */
const DriverDetailView: React.FC<{
  driver: Driver;
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
  onActionNotification: (msg: string) => void;
}> = ({ driver, onClose, onSelectJob, onActionNotification }) => {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={driver.avatar}
            alt={driver.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="app-section-title text-slate-900 tracking-tight">
                {driver.name}
              </h2>
              <span className="font-medium text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                {driver.id}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {driver.statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vehicle: <span className="font-medium text-slate-700">{driver.vehicle}</span> | Phone: {driver.phone || '(604) 555-0188'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="app-dialog-close"
          aria-label="Close dialog"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
        {/* Telemetry & Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-400 font-medium">Speed & Heading</span>
            <div className="font-medium text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>{driver.speed || 52} km/h (S)</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-400 font-medium">Remaining ETA</span>
            <div className="font-medium text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{driver.eta}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-400 font-medium">HOS Remaining</span>
            <div className="font-medium text-emerald-600 text-sm mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>5h 48m on-duty</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-400 font-medium">Rating & Score</span>
            <div className="font-medium text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>4.9 / 5.0 (98.4%)</span>
            </div>
          </div>
        </div>

        {/* Active Route & Assigned Job */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Assignment</span>
            <span className="text-xs text-slate-500">Updated {driver.lastUpdate}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="font-medium text-slate-900 text-sm">{driver.currentJob || 'No active job assigned'}</div>
              <div className="text-slate-600 text-xs mt-0.5">Next Stop: {driver.nextStop}</div>
            </div>
            {driver.currentJob && onSelectJob && (
              <button
                onClick={() => {
                  const jobMatch = driver.currentJob?.match(/#\d+/)?.[0];
                  if (jobMatch) onSelectJob(jobMatch);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-xs transition-colors"
              >
                Track Job &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Daily Shift Details */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <span className="text-xs text-slate-400 font-medium">Shift & Vehicle Specs</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-slate-400 text-xs">Shift Started</span>
              <div className="font-medium text-slate-800">07:30 AM (PST)</div>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Completed Drops</span>
              <div className="font-medium text-slate-800">3 of 4 Deliveries</div>
            </div>
            <div>
              <span className="text-slate-400 text-xs">License Class</span>
              <div className="font-medium text-slate-800">Class 3 Commercial (BC)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onActionNotification(`Initiating direct voice call to ${driver.name}`)}
            className="app-action app-secondary"
          >
            <Phone className="w-3.5 h-3.5 text-slate-600" />
            <span>Call Driver</span>
          </button>
          <button
            onClick={() => onActionNotification(`Opening message dispatch channel for ${driver.name}`)}
            className="app-action app-secondary"
          >
            <Mail className="w-3.5 h-3.5 text-slate-600" />
            <span>Send Message</span>
          </button>
        </div>

      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 3: ALL ACTIVE DISPATCH JOBS ROSTER                                */
/* -------------------------------------------------------------------------- */
const AllJobsRosterView: React.FC<{
  jobs: Job[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: 'all' | 'at_risk' | 'on_time';
  setFilter: (f: 'all' | 'at_risk' | 'on_time') => void;
  onClose: () => void;
  onSelectJob?: (jobNumber: string) => void;
  onActionNotification: (msg: string) => void;
}> = ({
  jobs,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  onClose,
  onSelectJob,
  onActionNotification
}) => {
  const filtered = jobs.filter((j) => {
    const matchesSearch =
      j.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'at_risk') return j.status === 'at_risk' || j.status === 'late_start';
    if (filter === 'on_time') return j.status === 'on_time';
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="app-section-title text-slate-900 tracking-tight">
              Active Dispatch Jobs Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filtered.length} of {jobs.length} total scheduled runs
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="app-dialog-close"
          aria-label="Close dialog"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters bar */}
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center gap-2.5 bg-white shrink-0">
        <SearchInput className="flex-1 w-full" value={searchQuery} onChange={setSearchQuery} placeholder="Search by job #, shipper, address..." />
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`app-tab ${
              filter === 'all' ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('at_risk')}
            className={`app-tab ${
              filter === 'at_risk'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            At Risk
          </button>
          <button
            onClick={() => setFilter('on_time')}
            className={`app-tab ${
              filter === 'on_time'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            On Time
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="overflow-y-auto p-6 space-y-2 flex-1">
        {filtered.map((j) => (
          <div
            key={j.id}
            onClick={() => {
              if (onSelectJob) onSelectJob(j.jobNumber);
              onClose();
            }}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 text-sm group-hover:text-slate-950 transition-colors">
                  {j.jobNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    j.status === 'at_risk' || j.status === 'late_start'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {lifecycleLabel(j)}
                </span>
                <span className="text-slate-500 font-medium">• {j.customerName}</span>
              </div>
              <div className="text-slate-500 text-xs truncate max-w-xl">
                {j.pickupAddress} &rarr; {j.dropoffAddress}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right text-xs">
                <div className="font-medium text-slate-800">
                  {j.assignedDriverId ? `Driver ${j.assignedDriverId}` : 'Unassigned'}
                </div>
                <div className="text-slate-400">{j.scheduledTime}</div>
              </div>
              <span className="text-slate-700 font-medium group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </div>
          </div>
        ))}
      </div>

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
}> = ({
  drivers,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  onClose,
  onSelectDriver,
  onActionNotification
}) => {
  const filtered = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vehicle.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'available') return d.status === 'available';
    if (filter === 'on_route') return d.status === 'on_route';
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="app-section-title text-slate-900 tracking-tight">
              Fleet Drivers Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length} active operators in Metro Vancouver region
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="app-dialog-close"
          aria-label="Close dialog"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters bar */}
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center gap-2.5 bg-white shrink-0">
        <SearchInput className="flex-1 w-full" value={searchQuery} onChange={setSearchQuery} placeholder="Search by driver name, ID, vehicle..." />
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`app-tab ${
              filter === 'all' ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({drivers.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`app-tab ${
              filter === 'available'
                ? 'bg-app-selected text-app-text'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setFilter('on_route')}
            className={`app-tab ${
              filter === 'on_route'
                ? 'bg-app-selected text-app-text'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            On Route
          </button>
        </div>
      </div>

      {/* Grid of drivers */}
      <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        {filtered.map((d) => (
          <div
            key={d.id}
            onClick={() => {
              if (onSelectDriver) onSelectDriver(d.id);
              onClose();
            }}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs group"
          >
            <div className="flex items-center gap-3">
              <img
                src={d.avatar}
                alt={d.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-900 text-xs group-hover:text-slate-950">
                    {d.id}
                  </span>
                  <span className="font-medium text-slate-700">{d.name}</span>
                </div>
                <div className="text-slate-500 text-xs">{d.vehicle}</div>
                <div className="text-slate-400 text-xs mt-0.5">Next: {d.nextStop}</div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                  d.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {d.statusLabel}
              </span>
              <div className="text-xs text-slate-500 font-medium mt-1">{d.eta}</div>
            </div>
          </div>
        ))}
      </div>

    </>
  );
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
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="app-section-title text-slate-900 tracking-tight">
              Operational Exceptions & Alerts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {exceptions.length} dispatch exceptions requiring operator resolution
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="app-dialog-close"
          aria-label="Close dialog"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
        {exceptions.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 text-sm">{item.jobNumber}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200">
                  {item.statusLabel}
                </span>
              </div>
              {item.jobNumber === '#461' && onApproveAiFix && (
                <button
                  onClick={() => {
                    onApproveAiFix();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                  <span>Execute AI Remedy (Maria D09)</span>
                </button>
              )}
            </div>

            <p className="text-slate-700 text-xs">{item.subtitle}</p>
            <div className="text-slate-500 text-xs flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.pickupAddress}</span>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Impact: Delivery ETA +22m SLA breach risk</span>
              {onSelectJob && (
                <button
                  onClick={() => {
                    onSelectJob(item.jobNumber);
                    onClose();
                  }}
                  className="font-medium text-slate-700 hover:text-slate-700 transition-colors"
                >
                  Inspect on Map &rarr;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </>
  );
};
