import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  MessageSquare,
  MoreHorizontal,
  X,
  User,
  RefreshCw,
  Eye,
  Navigation,
  AlertOctagon,
  Maximize2
} from 'lucide-react';
import { Driver } from '../types';

interface DriverPopoverProps {
  driver: Driver;
  onClose: () => void;
  showActions: boolean;
  setShowActions: React.Dispatch<React.SetStateAction<boolean>>;
  onActionNotification: (msg: string) => void;
  onOpenFullProfile?: () => void;
  position?: { x: number; y: number };
}

export const DriverPopover: React.FC<DriverPopoverProps> = ({
  driver,
  onClose,
  showActions,
  setShowActions,
  onActionNotification,
  onOpenFullProfile,
  position
}) => {
  // Compute clamped smooth position anchoring the arrow directly to the driver marker
  const left = position ? Math.max(20, Math.min(window.innerWidth - 380, position.x - 24)) : 260;
  const top = position ? Math.max(70, Math.min(window.innerHeight - 380, position.y + 26)) : 460;

  // Closing parent must also close all children
  const handleParentClose = () => {
    setShowActions(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -6 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute z-40 pointer-events-auto select-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      {/* Directional arrow pointing toward the driver marker (top-left) */}
      <div
        className="absolute -top-2 left-6 w-0 h-0 border-x-[8px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none"
      />

      {/* Main Driver Card */}
      <div className="w-80 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-5 relative">
        {/* Header with avatar, name, status, close button */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img
              src={driver.avatar}
              alt={driver.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">
                  {driver.id}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {driver.name}
                </span>
              </div>
              <div className="mt-1">
                <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                  {driver.statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenFullProfile && (
              <button
                onClick={onOpenFullProfile}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Full Driver Profile"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleParentClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close Driver Details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operational Metrics Grid */}
        <div className="py-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Vehicle</span>
            <span className="font-semibold text-slate-800">{driver.vehicle}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Current Job</span>
            <span className="font-semibold text-slate-800">
              {driver.currentJob || 'None assigned'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Next Stop</span>
            <span className="font-semibold text-slate-800 truncate max-w-[170px]">
              {driver.nextStop}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">ETA</span>
            <span className="font-semibold text-slate-800">{driver.eta}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Last Update</span>
            <span className="font-medium text-slate-500">{driver.lastUpdate}</span>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={() => onActionNotification(`Calling ${driver.name} (${driver.phone || '604-555-0188'})...`)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-xs font-semibold"
          >
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>Call</span>
          </button>

          <button
            onClick={() => onActionNotification(`Opening message dispatch channel for ${driver.name}`)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-xs font-semibold"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Message</span>
          </button>

          {/* Overflow Trigger Button for child menu */}
          <button
            onClick={() => setShowActions((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors ${
              showActions
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Driver Actions (More Options)"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Child Driver Actions Popover with smooth animation - strictly z-50 over parent */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2.5 w-60 bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/10 border border-slate-200 py-2 z-50"
            >
              {/* Directional arrow pointing UP directly to the [...] overflow button */}
              <div className="absolute -top-2 right-4 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-white drop-shadow-[0_-1px_1px_rgba(0,0,0,0.06)] pointer-events-none" />

              {/* Child Header with Close Icon */}
              <div className="flex items-center justify-between px-3 pb-2 border-b border-slate-100 mb-1">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  Driver Actions
                </span>
                <button
                  onClick={() => setShowActions(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  title="Close Actions"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5 px-1.5">
                <button
                  onClick={() => {
                    setShowActions(false);
                    if (onOpenFullProfile) {
                      onOpenFullProfile();
                    } else {
                      onActionNotification(`Viewing full driver profile for ${driver.name}`);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
                >
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-900">View Full Profile</span>
                </button>

                <button
                  onClick={() => {
                    onActionNotification(`Changing dispatch status for ${driver.name}`);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Change Status</span>
                </button>

                <button
                  onClick={() => {
                    onActionNotification(`Focusing active GPS route for ${driver.id}`);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Route</span>
                </button>

                <button
                  onClick={() => {
                    onActionNotification(`Requesting live telemetry ping from ${driver.id}`);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors text-left font-medium"
                >
                  <Navigation className="w-3.5 h-3.5 text-slate-400" />
                  <span>Send Location</span>
                </button>

                <div className="h-px bg-slate-100 my-1 mx-1" />

                <button
                  onClick={() => {
                    onActionNotification(`Reported operational issue for vehicle ${driver.vehicle}`);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left font-semibold"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                  <span>Report an Issue</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
