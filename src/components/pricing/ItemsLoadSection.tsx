import React from 'react';
import {
  Package,
  Layers,
  AlertTriangle,
  Scale,
  Maximize2,
  ShieldAlert
} from 'lucide-react';
import { OrganizationPricingSettings } from '../../types/pricing';

interface ItemsLoadSectionProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const ItemsLoadSection: React.FC<ItemsLoadSectionProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const updateItemsLoad = (field: string, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      itemsAndLoad: {
        ...prev.itemsAndLoad,
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          Items, Cargo Load & Volumetric Divisors
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure dimensional-weight calculations, oversize thresholds, fragile handling surcharges, and safety limits that trigger mandatory manual reviews.
        </p>
      </div>

      {/* Volumetric / Dimensional Weight Rules */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Dimensional (Volumetric) Weight Pricing Rule
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard IATA metric formula: (L × W × H in cm) / Divisor = Volumetric kg. Engine uses the greater of actual vs dimensional weight.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
            Greater of Actual or Dim
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">Volumetric Divisor</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.itemsAndLoad.dimWeightDivisor}
                onChange={(e) => updateItemsLoad('dimWeightDivisor', parseInt(e.target.value) || 5000)}
                className="w-24 px-2.5 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded-md bg-white text-slate-900"
              />
              <span className="text-slate-500 text-xs">cm³ / kg</span>
            </div>
            <p className="text-[10px] text-slate-400">Standard air/ground freight is 5,000</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">Unit Convention</span>
            <select
              value={settings.itemsAndLoad.dimWeightUnit}
              onChange={(e) => updateItemsLoad('dimWeightUnit', e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-900"
            >
              <option value="metric_cm_kg">Metric (Centimetres & Kilograms)</option>
              <option value="imperial_in_lb">Imperial (Inches & Pounds)</option>
            </select>
            <p className="text-[10px] text-slate-400">Default for all calculation inputs</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">Divisor Application Policy</span>
            <select
              value={settings.itemsAndLoad.dimWeightRule}
              onChange={(e) => updateItemsLoad('dimWeightRule', e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-900"
            >
              <option value="greater_of_actual_or_dim">Greater of Actual or Dim (Recommended)</option>
              <option value="actual_only">Actual Scale Weight Only</option>
              <option value="dim_only">Dimensional Weight Only</option>
            </select>
            <p className="text-[10px] text-slate-400">Never double charges actual + volumetric</p>
          </div>
        </div>
      </div>

      {/* Accessorial Extras: Oversize, Fragile, Pallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
            Cargo Dimensions & Surcharges
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Oversized Threshold (Length/Width/Height)</span>
                <span className="text-slate-500 text-[11px]">Items with any single dimension exceeding this length</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={settings.itemsAndLoad.oversizedDimensionThresholdCm}
                  onChange={(e) => updateItemsLoad('oversizedDimensionThresholdCm', parseInt(e.target.value) || 200)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
                <span className="text-slate-500 text-xs">cm</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Oversize Cargo Fee (per item)</span>
                <span className="text-slate-500 text-[11px]">Handling charge for awkward cargo footprint</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.itemsAndLoad.oversizedItemFee}
                  onChange={(e) => updateItemsLoad('oversizedItemFee', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Fragile & Blanket Wrap</span>
                <span className="text-slate-500 text-[11px]">Includes moving blankets, padded tie-downs, top-load placement</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="1.00"
                  value={settings.itemsAndLoad.fragileHandlingFee}
                  onChange={(e) => updateItemsLoad('fragileHandlingFee', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Safety Limits & Manual Review Triggers */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Safety Limits & "Cannot Quote" Rules
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            When cargo exceeds these safety boundaries, the quote engine will flag the booking as <strong>"Manual Review Required"</strong> rather than returning an invalid or hazardous rate.
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-amber-900 block">Single Piece Max Weight Limit</span>
                  <span className="text-amber-700 text-[11px]">Above this limit, specialist rigging or 4-person crew review is mandatory</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={settings.itemsAndLoad.maxSingleItemWeightKg}
                    onChange={(e) => updateItemsLoad('maxSingleItemWeightKg', parseFloat(e.target.value) || 150)}
                    className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-amber-300 rounded bg-white text-amber-900"
                  />
                  <span className="text-amber-800 text-xs">kg</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-800 block text-xs">Automated Payload & Volume Guard</span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                If the combined weight or volume of cargo exceeds the assigned vehicle’s rated capacity, the engine refuses automated quoting and requires vehicle class upgrade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
