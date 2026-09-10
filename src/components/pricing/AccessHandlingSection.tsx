import React from 'react';
import {
  Building2,
  Clock,
  ArrowUpDown,
  Navigation,
  Warehouse,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { OrganizationPricingSettings } from '../../types/pricing';

interface AccessHandlingSectionProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const AccessHandlingSection: React.FC<AccessHandlingSectionProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const updateAccess = (field: string, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      accessHandling: {
        ...prev.accessHandling,
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          Pickup & Drop-off Access and Handling
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Define stair carry rates, free allowances, elevator overflow logic, loading dock discounts, and waiting detention thresholds applied on a per-stop basis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stairs & Walk-up Policies */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ArrowUpDown className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Stair Flights & Walk-Up Handling
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Rate per Flight of Stairs</span>
                <span className="text-slate-500 text-[11px]">Applied to actual stairs walked per affected stop</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="0.50"
                  value={settings.accessHandling.stairFlightRate}
                  onChange={(e) => updateAccess('stairFlightRate', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Free Flight Allowance</span>
                <span className="text-slate-500 text-[11px]">Flights included before stair surcharges begin</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min="0"
                  value={settings.accessHandling.stairFreeFlightAllowance}
                  onChange={(e) => updateAccess('stairFreeFlightAllowance', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">flights</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1">
              <span className="font-semibold text-blue-900 block text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Elevator Clearance Fallback Rule
              </span>
              <p className="text-blue-800/80 text-[11px] leading-relaxed">
                If a building has an elevator but the customer cargo does not fit inside the cab, the calculation engine automatically switches to stair carry rates for the reported flights without requiring a manual recalculation.
              </p>
            </div>
          </div>
        </div>

        {/* Loading Docks, Carry Distance & Detention */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Time Allowances & Site Access
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Free Wait Time Allowance</span>
                <span className="text-slate-500 text-[11px]">On-site loading/unloading buffer before detention charges</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={settings.accessHandling.freeWaitTimeMinutes}
                  onChange={(e) => updateAccess('freeWaitTimeMinutes', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">min</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Detention Waiting Rate</span>
                <span className="text-slate-500 text-[11px]">Hourly rate billed after free allowance expires</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="2.00"
                  value={settings.accessHandling.detentionRatePerHour}
                  onChange={(e) => updateAccess('detentionRatePerHour', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">/hr</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Long Carry Distance Threshold</span>
                <span className="text-slate-500 text-[11px]">Distance from vehicle to entrance trigger</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={settings.accessHandling.longCarryDistanceThresholdMeters}
                  onChange={(e) => updateAccess('longCarryDistanceThresholdMeters', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">m</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Loading Dock Credit / Allowance</span>
                <span className="text-slate-500 text-[11px]">Discount applied when stop has dedicated truck dock</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">-$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.accessHandling.dockAccessDiscount}
                  onChange={(e) => updateAccess('dockAccessDiscount', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
