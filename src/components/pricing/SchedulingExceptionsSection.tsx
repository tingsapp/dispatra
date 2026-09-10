import React from 'react';
import {
  CalendarClock,
  Moon,
  Sun,
  AlertOctagon,
  RotateCcw,
  Ban,
  DollarSign
} from 'lucide-react';
import { OrganizationPricingSettings } from '../../types/pricing';

interface SchedulingExceptionsProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const SchedulingExceptionsSection: React.FC<SchedulingExceptionsProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const updateExceptions = (field: string, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      schedulingExceptions: {
        ...prev.schedulingExceptions,
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          Scheduling, Expenses & Post-Dispatch Exceptions
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Define quotation surcharges known in advance (after-hours, narrow windows) and operational exception fees applied when actual route events occur (failed attempts, redelivery, cancellation).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quotation Surcharges (Known at booking) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Moon className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Quotation Surcharges (Booking Time)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">After-Hours Surcharge (20:00 - 06:00)</span>
                <span className="text-slate-500 text-[11px]">Percentage added to base & distance transport</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={settings.schedulingExceptions.afterHoursFeePercent}
                  onChange={(e) => updateExceptions('afterHoursFeePercent', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Weekend Operations (+%)</span>
                <span className="text-slate-500 text-[11px]">Saturday and Sunday dispatch surcharge</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={settings.schedulingExceptions.weekendFeePercent}
                  onChange={(e) => updateExceptions('weekendFeePercent', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Narrow Delivery Window (≤ 1 hr)</span>
                <span className="text-slate-500 text-[11px]">Flat fee for precise appointment lock</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.narrowWindowFee}
                  onChange={(e) => updateExceptions('narrowWindowFee', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Remote Zone Flat Surcharge</span>
                <span className="text-slate-500 text-[11px]">Outside core metro transit radius</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.remoteAreaSurcharge}
                  onChange={(e) => updateExceptions('remoteAreaSurcharge', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Exception Fees (Event-based post-dispatch) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <AlertOctagon className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Operational Exception Adjustments
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Failed Delivery Attempt</span>
                <span className="text-slate-500 text-[11px]">Consignee unavailable after wait period with photo evidence</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.failedAttemptFee}
                  onChange={(e) => updateExceptions('failedAttemptFee', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Re-delivery Surcharge</span>
                <span className="text-slate-500 text-[11px]">Second scheduled dispatch after prior attempt failure</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.redeliveryFee}
                  onChange={(e) => updateExceptions('redeliveryFee', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Return to Origin / Shipper</span>
                <span className="text-slate-500 text-[11px]">Custody return to dispatch depot or shipper dock</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.returnToSenderFee}
                  onChange={(e) => updateExceptions('returnToSenderFee', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Late Cancellation Fee</span>
                <span className="text-slate-500 text-[11px]">
                  Cancellation within {settings.schedulingExceptions.cancellationFreeNoticeHours}h of scheduled pickup
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.schedulingExceptions.lateCancellationFee}
                  onChange={(e) => updateExceptions('lateCancellationFee', parseFloat(e.target.value) || 0)}
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
