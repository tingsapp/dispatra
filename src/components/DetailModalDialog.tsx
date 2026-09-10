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
  Search,
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
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/50 backdrop-blur-sm select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl shadow-slate-950/25 border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
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

          {/* ========================================================= */}
          {/* VIEW 6: ORGANIZATION SETTINGS - PRICING AND SERVICES     */}
          {/* ========================================================= */}
          {effectiveType === 'pricing_services' && (
            <PricingAndServicesView
              onClose={onClose}
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
  const isAtRisk = job.status === 'at_risk' || job.status === 'late_start';

  return (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Job Dossier {job.jobNumber}
              </h2>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isAtRisk
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {job.statusLabel}
              </span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                • {job.jobType || 'Scheduled Dispatch'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-700">{job.customerName}</span> | Scheduled Window: {job.scheduledTime}
            </p>
          </div>
        </div>

        {/* Top Right Close Button */}
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 px-6 border-b border-slate-200 bg-white text-xs font-semibold text-slate-500 shrink-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-2 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Route & SLA Overview
        </button>
        <button
          onClick={() => setActiveTab('cargo')}
          className={`py-3 px-2 border-b-2 transition-colors ${
            activeTab === 'cargo'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Cargo & Manifest
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          className={`py-3 px-2 border-b-2 transition-colors ${
            activeTab === 'customer'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Customer & Billing
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-2 border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600 font-bold'
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
                <div className="font-bold text-rose-900 text-xs">
                  Operational Delay: {job.riskText || '+22 min ETA delay'}
                </div>
                <div className="text-rose-700 text-[11px] mt-0.5">
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
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
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
            {/* Waypoint Sequence Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Pickup Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Stop 1: Origin / Pickup
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm mb-1">{job.pickupAddress}</div>
                <div className="text-slate-500 text-[11px] space-y-0.5">
                  <div>Scheduled Window: 09:30 AM – 10:30 AM</div>
                  <div>Loading Bay: Dock 4 (Rear Entrance)</div>
                  <div>Gate Code: #4829</div>
                </div>
              </div>

              {/* Delivery Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Stop 2: Destination / Delivery
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm mb-1">{job.dropoffAddress}</div>
                <div className="text-slate-500 text-[11px] space-y-0.5">
                  <div>Estimated Arrival: 11:22 AM</div>
                  <div>Contact on Arrival: Reception Desk (Level 2)</div>
                  <div>Signature Required: Yes (Digital POD)</div>
                </div>
              </div>
            </div>

            {/* Operational Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Service Level</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{job.serviceLevel || 'Priority Express'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Route Distance</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">14.8 km</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Fleet</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{job.assignedDriverId || 'Unassigned'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">POD Status</span>
                <p className="text-xs font-bold text-emerald-600 mt-0.5">Pending Drop-off</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cargo & Manifest */}
        {activeTab === 'cargo' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" />
                  <span className="font-bold text-slate-900 text-xs">Shipment Cargo Manifest</span>
                </div>
                <span className="text-xs font-semibold text-slate-600">BOL #BOL-2026-0461</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Cargo Description</span>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">
                    {job.cargoDescription || 'Commercial Espresso Equipment & Roaster Parts'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Total Weight</span>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">{job.cargoWeight || '385 kg (848 lbs)'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Pallet Count</span>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">{job.palletCount || 2} Standard Wooden Pallets</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Special Handling Instructions</span>
                <p className="text-xs text-slate-700 italic mt-0.5">
                  {job.handlingInstructions || 'Fragile electronics calibration. Do not double-stack pallets. Keep upright.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Customer & Billing */}
        {activeTab === 'customer' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Customer Contact</span>
                <div className="font-bold text-slate-900 text-sm">{job.customerName}</div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>{job.customerPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{job.customerEmail || 'dispatch.contact@client.com'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Billing & Invoicing</span>
                <div className="font-bold text-slate-900 text-sm">{job.billingAmount || '$340.00 CAD'}</div>
                <div className="text-xs text-slate-600">Payment Status: <span className="font-semibold text-emerald-600">Authorized</span></div>
                <div className="text-xs text-slate-500">Corporate Account: BC-EXP-9082</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Dispatch Timeline */}
        {activeTab === 'audit' && (
          <div className="space-y-3 py-1">
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
              <div>
                <span className="font-bold text-slate-800">09:15 AM — Job Order Created</span>
                <p className="text-slate-500 text-[11px]">Automated API dispatch ingest from logistics TMS.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <span className="font-bold text-slate-800">09:30 AM — Assigned to Driver {job.assignedDriverId || 'D14'}</span>
                <p className="text-slate-500 text-[11px]">Dispatched to driver mobile terminal; route accepted.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-rose-500 mt-1" />
              <div>
                <span className="font-bold text-rose-600">10:14 AM — Delay Detected</span>
                <p className="text-slate-500 text-[11px]">Granville corridor slowdown reported via GPS telemetry.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer with Actions and Close Button */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {job.assignedDriverId && onSelectDriver && (
            <button
              onClick={() => {
                onSelectDriver(job.assignedDriverId!);
                onClose();
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Driver {job.assignedDriverId}</span>
            </button>
          )}
          <button
            onClick={() => onActionNotification(`Exported manifest for Job ${job.jobNumber}`)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Manifest</span>
          </button>
        </div>

        {/* High-Contrast, Prominent Close Button */}
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          Close
        </button>
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={driver.avatar}
            alt={driver.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {driver.name}
              </h2>
              <span className="font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                {driver.id}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {driver.statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vehicle: <span className="font-semibold text-slate-700">{driver.vehicle}</span> | Phone: {driver.phone || '(604) 555-0188'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
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
            <span className="text-[10px] text-slate-400 uppercase font-bold">Speed & Heading</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>{driver.speed || 52} km/h (S)</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Remaining ETA</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{driver.eta}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold">HOS Remaining</span>
            <div className="font-bold text-emerald-600 text-sm mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>5h 48m on-duty</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Rating & Score</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>4.9 / 5.0 (98.4%)</span>
            </div>
          </div>
        </div>

        {/* Active Route & Assigned Job */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Active Assignment</span>
            <span className="text-xs text-slate-500">Updated {driver.lastUpdate}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="font-bold text-slate-900 text-sm">{driver.currentJob || 'No active job assigned'}</div>
              <div className="text-slate-600 text-xs mt-0.5">Next Stop: {driver.nextStop}</div>
            </div>
            {driver.currentJob && onSelectJob && (
              <button
                onClick={() => {
                  const jobMatch = driver.currentJob?.match(/#\d+/)?.[0];
                  if (jobMatch) onSelectJob(jobMatch);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors"
              >
                Track Job &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Daily Shift Details */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Shift & Vehicle Specs</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-slate-400 text-[10px]">Shift Started</span>
              <div className="font-semibold text-slate-800">07:30 AM (PST)</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">Completed Drops</span>
              <div className="font-semibold text-slate-800">3 of 4 Deliveries</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">License Class</span>
              <div className="font-semibold text-slate-800">Class 3 Commercial (BC)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onActionNotification(`Initiating direct voice call to ${driver.name}`)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>Call Driver</span>
          </button>
          <button
            onClick={() => onActionNotification(`Opening message dispatch channel for ${driver.name}`)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Send Message</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          Close
        </button>
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Active Dispatch Jobs Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filtered.length} of {jobs.length} total scheduled runs
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters bar */}
      <div className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-2.5 bg-white shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job #, customer, address..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('at_risk')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'at_risk'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            At Risk
          </button>
          <button
            onClick={() => setFilter('on_time')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
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
            className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  {j.jobNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    j.status === 'at_risk' || j.status === 'late_start'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {j.statusLabel}
                </span>
                <span className="text-slate-500 font-medium">• {j.customerName}</span>
              </div>
              <div className="text-slate-500 text-[11px] truncate max-w-xl">
                {j.pickupAddress} &rarr; {j.dropoffAddress}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right text-[11px]">
                <div className="font-semibold text-slate-800">
                  {j.assignedDriverId ? `Driver ${j.assignedDriverId}` : 'Unassigned'}
                </div>
                <div className="text-slate-400">{j.scheduledTime}</div>
              </div>
              <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                &rarr;
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          Close
        </button>
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Fleet Drivers Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtered.length} active operators in Metro Vancouver region
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters bar */}
      <div className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-2.5 bg-white shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by driver name, ID, vehicle..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({drivers.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'available'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setFilter('on_route')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'on_route'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
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
            className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs group"
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
                  <span className="font-bold text-slate-900 text-xs group-hover:text-blue-600">
                    {d.id}
                  </span>
                  <span className="font-semibold text-slate-700">{d.name}</span>
                </div>
                <div className="text-slate-500 text-[11px]">{d.vehicle}</div>
                <div className="text-slate-400 text-[10px] mt-0.5">Next: {d.nextStop}</div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  d.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {d.statusLabel}
              </span>
              <div className="text-[10px] text-slate-500 font-medium mt-1">{d.eta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          Close
        </button>
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Operational Exceptions & Alerts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {exceptions.length} dispatch exceptions requiring operator resolution
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
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
                <span className="font-bold text-slate-900 text-sm">{item.jobNumber}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {item.statusLabel}
                </span>
              </div>
              {item.jobNumber === '#461' && onApproveAiFix && (
                <button
                  onClick={() => {
                    onApproveAiFix();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                  <span>Execute AI Remedy (Maria D09)</span>
                </button>
              )}
            </div>

            <p className="text-slate-700 text-xs">{item.subtitle}</p>
            <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.pickupAddress}</span>
            </div>

            <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium">Impact: Delivery ETA +22m SLA breach risk</span>
              {onSelectJob && (
                <button
                  onClick={() => {
                    onSelectJob(item.jobNumber);
                    onClose();
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Inspect on Map &rarr;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
        >
          Close
        </button>
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-VIEW 6: ORGANIZATION SETTINGS - PRICING AND SERVICES                   */
/* -------------------------------------------------------------------------- */
interface ServiceTier {
  id: string;
  name: string;
  code: string;
  description: string;
  slaWindow: string;
  baseFare: number;
  perKmRate: number;
  minCharge: number;
  active: boolean;
  handling: string;
}

const INITIAL_SERVICE_TIERS: ServiceTier[] = [
  {
    id: 's1',
    name: 'Same-Day Express',
    code: 'EXP-SAME',
    description: 'High-priority direct vehicle dispatch with guaranteed 2-hour delivery window.',
    slaWindow: '2-hour SLA',
    baseFare: 28.00,
    perKmRate: 2.15,
    minCharge: 35.00,
    active: true,
    handling: 'Direct route • Signature required • SMS ETA tracking'
  },
  {
    id: 's2',
    name: 'Standard Next-Day',
    code: 'STD-NEXT',
    description: 'Consolidated commercial distribution across Greater Vancouver metro area.',
    slaWindow: 'Next day by 17:00',
    baseFare: 16.50,
    perKmRate: 1.45,
    minCharge: 22.00,
    active: true,
    handling: 'Batch route • Photo safe-drop allowed • Regular stops'
  },
  {
    id: 's3',
    name: 'Scheduled LTL Freight',
    code: 'FRT-SCHED',
    description: 'Heavy palletized freight shipments requiring tailgate lift and pallet jack equipment.',
    slaWindow: 'Scheduled appointment',
    baseFare: 65.00,
    perKmRate: 3.25,
    minCharge: 95.00,
    active: true,
    handling: 'Dock-to-dock • Hydraulic liftgate • Up to 4,000 lbs'
  },
  {
    id: 's4',
    name: 'White Glove & Sensitive',
    code: 'WHT-GLOVE',
    description: 'Inside delivery, room-of-choice placement, inspection, and debris unpack removal.',
    slaWindow: 'Scheduled 1-hour slot',
    baseFare: 85.00,
    perKmRate: 3.80,
    minCharge: 120.00,
    active: true,
    handling: '2-person team • Padded blankets • Recipient verified ID'
  }
];

const PricingAndServicesView: React.FC<{
  onClose: () => void;
  onActionNotification: (msg: string) => void;
}> = ({ onClose, onActionNotification }) => {
  const [activeTab, setActiveTab] = useState<'services' | 'calculator' | 'accessorials' | 'zones'>('services');
  const [services, setServices] = useState<ServiceTier[]>(INITIAL_SERVICE_TIERS);
  const [isSaved, setIsSaved] = useState(false);

  // Rate calculator test state
  const [calcTierId, setCalcTierId] = useState<string>('s1');
  const [calcDistance, setCalcDistance] = useState<number>(18.5);
  const [calcStops, setCalcStops] = useState<number>(1);
  const [calcLiftgate, setCalcLiftgate] = useState<boolean>(false);

  const selectedCalcTier = services.find((s) => s.id === calcTierId) || services[0];
  const fuelSurchargePct = 0.114; // 11.4% fuel surcharge
  const mileageCost = calcDistance * selectedCalcTier.perKmRate;
  const extraStopsCost = Math.max(0, calcStops - 1) * 8.50;
  const liftgateCost = calcLiftgate ? 25.00 : 0;
  const subtotalBeforeMin = selectedCalcTier.baseFare + mileageCost + extraStopsCost + liftgateCost;
  const applicableSubtotal = Math.max(subtotalBeforeMin, selectedCalcTier.minCharge);
  const fuelSurcharge = applicableSubtotal * fuelSurchargePct;
  const totalCalculatedFare = applicableSubtotal + fuelSurcharge;

  const handleToggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
    setIsSaved(false);
  };

  const handleUpdateFare = (id: string, field: 'baseFare' | 'perKmRate' | 'minCharge', val: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
    setIsSaved(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    onActionNotification('Pricing and services configuration saved successfully');
    setTimeout(() => {
      setIsSaved(false);
    }, 3500);
  };

  return (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Tag className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Organization Settings
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-bold text-blue-600">Pricing and services</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Service Levels & Dispatch Rate Cards
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          title="Close dialog (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('services')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'services'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Service Levels</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
            {services.filter((s) => s.active).length} Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'calculator'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Rate Calculator</span>
        </button>

        <button
          onClick={() => setActiveTab('accessorials')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'accessorials'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BadgePercent className="w-3.5 h-3.5" />
          <span>Surcharges & Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('zones')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'zones'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Coverage Zones</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
        {/* TAB 1: SERVICE LEVELS */}
        {activeTab === 'services' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Active Fleet Service Offerings</h3>
                <p className="text-slate-500 text-xs">
                  Configure the service catalog available to dispatchers and automated job routing.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                Currency: CAD ($)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {services.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-4 rounded-xl border transition-all ${
                    tier.active
                      ? 'bg-white border-slate-200 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-slate-900">{tier.name}</span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {tier.code}
                        </span>
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {tier.slaWindow}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs">{tier.description}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{tier.handling}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleToggleService(tier.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          tier.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {tier.active ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>

                  {/* Pricing Inputs */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Base Fare
                      </label>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          step="0.5"
                          value={tier.baseFare}
                          onChange={(e) =>
                            handleUpdateFare(tier.id, 'baseFare', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Per KM Rate
                      </label>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          step="0.05"
                          value={tier.perKmRate}
                          onChange={(e) =>
                            handleUpdateFare(tier.id, 'perKmRate', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold">/km</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Minimum Charge
                      </label>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 font-bold">$</span>
                        <input
                          type="number"
                          step="1.0"
                          value={tier.minCharge}
                          onChange={(e) =>
                            handleUpdateFare(tier.id, 'minCharge', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: RATE CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">Fare Simulation Parameters</h3>
              <p className="text-slate-500 text-xs">
                Test how rate cards evaluate customer quotes against real dispatch routes.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Service Level
                </label>
                <Select
                  aria-label="Select service level"
                  className="w-full"
                  value={calcTierId}
                  onValueChange={setCalcTierId}
                  options={services.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.code}) · Base $${s.baseFare.toFixed(2)}`
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Total Travel Distance (KM)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="0.5"
                    value={calcDistance}
                    onChange={(e) => setCalcDistance(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="font-mono font-bold text-sm text-slate-900 w-16 text-right">
                    {calcDistance.toFixed(1)} km
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Waypoints / Stops Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={calcStops}
                  onChange={(e) => setCalcStops(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={calcLiftgate}
                    onChange={(e) => setCalcLiftgate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Require Hydraulic Liftgate (+$25.00)
                  </span>
                </label>
              </div>
            </div>

            {/* Calculated Breakdown Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-sm text-slate-900">Fare Calculation Result</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    Live Rate Engine
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Base Dispatch Fee</span>
                    <span className="font-semibold text-slate-900">
                      ${selectedCalcTier.baseFare.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      Mileage ({calcDistance.toFixed(1)} km @ ${selectedCalcTier.perKmRate.toFixed(2)}/km)
                    </span>
                    <span className="font-semibold text-slate-900">
                      ${mileageCost.toFixed(2)}
                    </span>
                  </div>

                  {extraStopsCost > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Additional Stops ({calcStops - 1} extra)</span>
                      <span className="font-semibold text-slate-900">
                        ${extraStopsCost.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {liftgateCost > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Accessorial: Liftgate Required</span>
                      <span className="font-semibold text-slate-900">
                        ${liftgateCost.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600 pt-2 border-t border-slate-100">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900">
                      ${applicableSubtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Variable Fuel Surcharge (11.4%)</span>
                    <span className="font-semibold text-slate-900">
                      ${fuelSurcharge.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      Total Projected Fare
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      ${totalCalculatedFare.toFixed(2)} CAD
                    </div>
                  </div>
                  <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-lg">
                    SLA: {selectedCalcTier.slaWindow}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACCESSORIALS & RULES */}
        {activeTab === 'accessorials' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Accessorial & Billing Surcharges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Fuel Surcharge Index</span>
                  <span className="font-bold text-xs text-blue-600">11.4%</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Applied automatically to all active haul routes based on weekly diesel index.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Detention / Wait Time</span>
                  <span className="font-bold text-xs text-slate-900">$45.00 / hr</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  15 minutes grace period allowed per waypoint before automated detention accrual.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">After-Hours Dispatch</span>
                  <span className="font-bold text-xs text-slate-900">+25% Base Rate</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Applies to pickups scheduled between 20:00 and 06:00 local time.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">Inside Delivery / Stairs</span>
                  <span className="font-bold text-xs text-slate-900">+$35.00 Flat</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Added when consignee lacks loading dock and freight exceeds threshold weight.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: COVERAGE ZONES */}
        {activeTab === 'zones' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Vancouver Regional Dispatch Zones</h3>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="font-bold text-slate-900">Zone 1: Metro Vancouver Core</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Downtown, Kitsilano, Mount Pleasant, Burnaby, Richmond Core.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  Standard Rates (0% Surcharge)
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="font-bold text-slate-900">Zone 2: Greater Metro & Fraser Valley</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Surrey, Langley, Coquitlam, Maple Ridge, Delta, Abbotsford.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  +15% Inter-zone Mileage
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    <span className="font-bold text-slate-900">Zone 3: Port & Airport Intermodal</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Port of Vancouver (Centerm/Vanterm/Deltaport) & YVR Cargo Terminal.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  +$40.00 Security Gate Pass
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <span className="text-xs text-slate-500">
          Organization ID: <span className="font-mono text-slate-700 font-semibold">org_dispatra_van_01</span>
        </span>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-sm ${
              isSaved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Changes Saved</span>
              </>
            ) : (
              <span>Save & Apply Changes</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};
