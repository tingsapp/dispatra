import { DriverAvatar } from './DriverAvatar';
import { FloatingPanel } from './ui/FloatingPanel';
import { MenuItem, MenuList, MenuSeparator } from './ui/Menu';
import { useOverlayMotion } from './ui/useOverlayMotion';
import React from 'react';
import { motion } from 'motion/react';
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
import { useMapPopupPlacement } from './monitor/useMapPopupPlacement';

interface DriverPopoverProps {
  driver: Driver;
  live?: boolean;
  onClose: () => void;
  showActions: boolean;
  setShowActions: React.Dispatch<React.SetStateAction<boolean>>;
  onActionNotification: (msg: string) => void;
  onOpenFullProfile?: () => void;
  position?: { x: number; y: number };
}

export const DriverPopover: React.FC<DriverPopoverProps> = ({
  driver,
  live = false,
  onClose,
  showActions,
  setShowActions,
  onActionNotification,
  onOpenFullProfile,
  position
}) => {
  const overlayMotion = useOverlayMotion();
  const { ref, placement } = useMapPopupPlacement(position);

  // Closing parent must also close all children
  const handleParentClose = () => {
    setShowActions(false);
    onClose();
  };

  return (
    <motion.div
      {...overlayMotion}
      ref={ref}
      data-map-detail-overlay="driver"
      className="absolute z-40 pointer-events-auto select-none"
      style={{
        left: `${placement?.x ?? 0}px`,
        top: `${placement?.y ?? 0}px`,
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      {/* Directional arrow pointing toward the driver marker (top-left) */}

      {/* Main Driver Card */}
      <div className="app-menu-surface w-80 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-5 relative">
        {/* Header with avatar, name, status, close button */}
        <div className="flex items-start justify-between pb-4">
          <div className="flex items-center gap-3">
            <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0" referrerPolicy="no-referrer" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 text-base">
                  {driver.driverNumber ?? driver.id}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {driver.name}
                </span>
              </div>
              <div className="mt-1">
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${driver.status === 'offline' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'}`}>
                  {driver.statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenFullProfile && (
              <button
                onClick={onOpenFullProfile}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
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
            <span className="font-medium text-slate-800">{driver.vehicle}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Current Job</span>
            <span className="font-medium text-slate-800">
              {driver.currentJob || 'None assigned'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Next Stop</span>
            <span className="font-medium text-slate-800 truncate max-w-[170px]">
              {driver.nextStop}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">ETA</span>
            <span className="font-medium text-slate-800">{driver.eta}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Last Update</span>
            <span className="font-medium text-slate-500">{driver.lastUpdate}</span>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={() => live ? driver.phone && window.open(`tel:${driver.phone}`, '_self') : onActionNotification(`Calling ${driver.name} (${driver.phone || '604-555-0188'})...`)}
            disabled={live && !driver.phone}
            className="app-action app-secondary flex-1 hover:text-slate-900"
          >
            <Phone className="w-3.5 h-3.5 text-slate-600" />
            <span>Call</span>
          </button>

          <button
            onClick={() => live ? driver.phone && window.open(`sms:${driver.phone}`, '_self') : onActionNotification(`Opening message dispatch channel for ${driver.name}`)}
            disabled={live && !driver.phone}
            className="app-action app-secondary flex-1 hover:text-slate-900"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
            <span>Message</span>
          </button>

          {!live && <FloatingPanel open={showActions} onOpenChange={setShowActions} label="Driver actions" align="end" size="menu" trigger={
            <button type="button" className="app-icon-button" title="Driver Actions (More Options)"><MoreHorizontal size={18} /></button>
          }>
            <MenuList>
              <MenuItem icon={User} onClick={() => { setShowActions(false); if (onOpenFullProfile) onOpenFullProfile(); else onActionNotification(`Viewing full driver profile for ${driver.name}`); }}>View Full Profile</MenuItem>
              <MenuItem icon={RefreshCw} onClick={() => { onActionNotification(`Changing dispatch status for ${driver.name}`); setShowActions(false); }}>Change Status</MenuItem>
              <MenuItem icon={Eye} onClick={() => { onActionNotification(`Focusing active GPS route for ${driver.driverNumber ?? driver.id}`); setShowActions(false); }}>View Route</MenuItem>
              <MenuItem icon={Navigation} onClick={() => { onActionNotification(`Requesting live telemetry ping from ${driver.driverNumber ?? driver.id}`); setShowActions(false); }}>Send Location</MenuItem>
              <MenuSeparator />
              <MenuItem icon={AlertOctagon} onClick={() => { onActionNotification(`Reported operational issue for vehicle ${driver.vehicle}`); setShowActions(false); }}>Report an Issue</MenuItem>
            </MenuList>
          </FloatingPanel>}
        </div>


      </div>
    </motion.div>
  );
};
