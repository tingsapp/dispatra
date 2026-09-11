import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Phone,
  AlertTriangle,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
  Package,
  UserCheck,
  Maximize2
} from 'lucide-react';
import { Job, EligibleDriver } from '../types';
import { ELIGIBLE_DRIVERS } from '../data/mockData';
import { describePrice } from '../lib/orderPricing';

interface JobDetailPopoverProps {
  job: Job;
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
}

export const JobDetailPopover: React.FC<JobDetailPopoverProps> = ({
  job,
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
  position
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stops' | 'timeline' | 'notes'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverCode, setSelectedDriverCode] = useState<string>('D09');
  const [eligibleDrivers, setEligibleDrivers] = useState<EligibleDriver[]>(ELIGIBLE_DRIVERS);

  // Compute smooth anchored positions
  const baseLeft = position ? Math.max(30, Math.min(window.innerWidth - 680, position.x - 170)) : 690;
  const baseTop = position ? Math.max(70, Math.min(window.innerHeight - 440, position.y + 26)) : 470;

  const assignDriverLeft = baseLeft + 255;
  const assignDriverTop = baseTop + 130;

  const aiRecLeft = Math.min(window.innerWidth - 320, baseLeft + 360);
  const aiRecTop = Math.max(60, baseTop - 50);

  const filteredDrivers = eligibleDrivers.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -6 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute z-40 pointer-events-auto select-none"
        style={{
          left: `${baseLeft}px`,
          top: `${baseTop}px`
        }}
      >
        {/* Directional arrow pointing up toward Job marker on the map */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

        <div className="w-[340px] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-5 relative">
          {/* Header with Job # and status */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-900 text-lg">
                {job.jobNumber}
              </span>
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">
                {job.statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onOpenFullDetails && (
                <button
                  onClick={onOpenFullDetails}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Open Full Job Dossier Dialog"
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

          {/* Segmented Options / Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2.5 mb-3.5 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-1 px-2 transition-colors relative ${
                activeTab === 'overview'
                  ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-[11px]'
                  : 'hover:text-slate-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab('stops');
                onActionNotification('Viewing route stops');
              }}
              className={`pb-1 px-2 transition-colors relative ${
                activeTab === 'stops'
                  ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-[11px]'
                  : 'hover:text-slate-800'
              }`}
            >
              Stops (2)
            </button>
            <button
              onClick={() => {
                setActiveTab('timeline');
                onActionNotification('Viewing dispatch timeline');
              }}
              className={`pb-1 px-2 transition-colors relative ${
                activeTab === 'timeline'
                  ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-[11px]'
                  : 'hover:text-slate-800'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => {
                setActiveTab('notes');
                onActionNotification('Viewing special handling notes');
              }}
              className={`pb-1 px-2 transition-colors relative ${
                activeTab === 'notes'
                  ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-[11px]'
                  : 'hover:text-slate-800'
              }`}
            >
              Notes
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-3.5 text-xs">
              {/* Customer */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer</span>
                <span className="font-semibold text-slate-900">{job.customerName}</span>
              </div>

              {/* Service Level */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Service Level</span>
                <span className="font-semibold text-slate-800">{job.serviceLevel || job.jobType}</span>
              </div>

              {/* Customer price — from the frozen snapshot, never recomputed here */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Customer Price</span>
                {(() => {
                  const price = describePrice(job);
                  return (
                    <span className={`font-semibold ${price.tone === 'warn' ? 'text-amber-700' : price.tone === 'muted' ? 'text-slate-400' : 'text-slate-900'}`}>
                      {price.text}
                    </span>
                  );
                })()}
              </div>

              {/* Route Waypoints */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Pickup</div>
                    <div className="font-medium text-slate-800 truncate">{job.pickupAddress}</div>
                  </div>
                </div>

                <div className="border-l-2 border-dashed border-slate-200 ml-1 h-2" />

                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Delivery</div>
                    <div className="font-medium text-slate-800 truncate">{job.dropoffAddress}</div>
                  </div>
                </div>
              </div>

              {/* Assigned Driver Row */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Driver</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">{job.assignedDriverId || 'Unassigned'}</span>
                  <span className="text-slate-500">• {job.driverName || 'None'}</span>
                </div>
              </div>

              {/* Risk Banner with on-demand AI Fix trigger */}
              <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 flex items-center justify-between text-rose-600 font-semibold">
                <span className="text-[11px] truncate max-w-[170px]">{job.riskText}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowAiRecommendation((prev) => !prev)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-xs transition-colors"
                    title="Toggle AI Recommendation Fix"
                  >
                    <Sparkles className="w-3 h-3 fill-white" />
                    <span>AI Fix</span>
                  </button>
                  <span className="flex items-center gap-0.5 text-[10px] bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-700">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 stroke-[2.5]" />
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stops' && (
            <div className="space-y-2 py-1 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-semibold text-slate-900">Stop 1: Pickup</div>
                <div className="text-slate-600 mt-0.5">{job.pickupAddress}</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">Status: Arriving in 18 min</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-semibold text-slate-900">Stop 2: Final Drop-off</div>
                <div className="text-slate-600 mt-0.5">{job.dropoffAddress}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">Pending driver confirmation</div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-2 py-1 text-xs">
              <div className="flex gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                <div>
                  <div className="font-semibold text-slate-800">09:30 AM — Order Dispatched</div>
                  <div className="text-slate-500 text-[11px]">System assigned to D14</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                <div>
                  <div className="font-semibold text-rose-600">10:14 AM — Traffic Delay Detected</div>
                  <div className="text-slate-500 text-[11px]">Granville St Bridge congestion (+22 min)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="py-2 text-xs text-slate-600">
              <p className="italic bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/50 text-amber-900">
                "Customer requested loading dock entry via Bay 4. Contact dispatch if security gate is locked."
              </p>
            </div>
          )}

          {/* View Full Dossier Button */}
          {onOpenFullDetails && (
            <button
              onClick={onOpenFullDetails}
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors text-xs font-semibold"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Open Complete Job Dossier Dialog</span>
            </button>
          )}

          {/* Primary Action Button: "Find Driver" (Only toggles child on-demand, does NOT force grandchild) */}
          <div className="pt-3.5 mt-2 border-t border-slate-100 flex items-center gap-1.5 relative">
            <button
              onClick={() => setShowAssignDriver((prev) => !prev)}
              className={`flex-1 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 ${
                showAssignDriver
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-600/20'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{showAssignDriver ? 'Hide Drivers' : 'Find Driver'}</span>
            </button>
            <button
              onClick={() => setShowAssignDriver((prev) => !prev)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showAssignDriver
                  ? 'bg-slate-100 border-slate-300 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
              title="Toggle Assign Driver Menu"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAssignDriver ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. ASSIGN DRIVER CHILD MENU - Displayed on demand with smooth animation - strictly z-50 over parent */}
      <AnimatePresence>
        {showAssignDriver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 pointer-events-auto select-none"
            style={{
              left: `${assignDriverLeft}px`,
              top: `${assignDriverTop}px`
            }}
          >
            {/* Directional arrow pointing left toward the Find Driver button */}
            <div className="absolute top-8 -left-2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px] border-r-white drop-shadow-[-1px_0_1px_rgba(0,0,0,0.06)] pointer-events-none" />

            <div className="w-[280px] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 border border-slate-200 p-4">
              {/* Header with Title and Close Icon */}
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <span>Assign Driver</span>
                  <span className="text-[10px] text-slate-400 font-normal">({filteredDrivers.length})</span>
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
              <div
                onClick={() => setShowAiRecommendation((prev) => !prev)}
                className={`mb-2.5 p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  showAiRecommendation
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-indigo-50/60 border-indigo-200/80 hover:bg-indigo-50'
                }`}
                title="Click to view AI recommendation details"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">AI Recommendation</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200 group-hover:border-indigo-400">
                  {showAiRecommendation ? 'Open' : 'View'} &rarr;
                </span>
              </div>

              {/* Search field + filter icon */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="flex-1 relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search drivers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                  />
                </div>
                <button
                  onClick={() => onActionNotification('Filter eligible drivers')}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ranked eligible drivers list */}
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                {filteredDrivers.map((driver) => {
                  const isSelected = selectedDriverCode === driver.code;
                  return (
                    <div
                      key={driver.id}
                      onClick={() => {
                        setSelectedDriverCode(driver.code);
                        onActionNotification(`Selected ${driver.name} (${driver.code})`);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={driver.avatar}
                          alt={driver.name}
                          className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-slate-900">
                              {driver.code}
                            </span>
                            <span className="text-[11px] text-slate-700 font-medium truncate max-w-[85px]">
                              {driver.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-slate-400">{driver.distance}</span>
                            <span
                              className={`font-semibold ${
                                driver.status === 'available'
                                  ? 'text-emerald-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              {driver.status === 'available' ? 'Available' : 'On route'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Radio control */}
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer View full list link */}
              <div className="pt-2 text-center border-t border-slate-100 mt-2">
                <button
                  onClick={() => {
                    if (onOpenAllDrivers) {
                      onOpenAllDrivers();
                    } else {
                      onActionNotification('Showing full roster of eligible fleet drivers');
                    }
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
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
        {showAiRecommendation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-[60] pointer-events-auto select-none"
            style={{
              left: `${aiRecLeft}px`,
              top: `${aiRecTop}px`
            }}
          >
            {/* Grand-child Card with strong elevation above child & parent */}
            <div className="w-[310px] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 border border-slate-200 p-4 relative">
              {/* Header with Job #, ETA, and CLOSE BUTTON */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{job.jobNumber}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">
                    At Risk
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-rose-600">
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
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                  <Sparkles className="w-3.5 h-3.5 fill-indigo-600" />
                  <span>AI Recommendation</span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/70">
                  Save 14m
                </span>
              </div>

              {/* Recommendation Title */}
              <div className="text-xs font-bold text-slate-900 mt-1 mb-2">
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
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    onApproveRecommendation();
                    setShowAiRecommendation(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors shadow-sm shadow-blue-600/25"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    onKeepCurrent();
                    setShowAiRecommendation(false);
                  }}
                  className="flex-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs border border-slate-200 transition-colors"
                >
                  Keep Current
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
