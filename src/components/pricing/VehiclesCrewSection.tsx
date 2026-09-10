import React from 'react';
import {
  Truck,
  Users,
  Wrench,
  Scale,
  Box,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { OrganizationPricingSettings } from '../../types/pricing';

interface VehiclesCrewSectionProps {
  settings: OrganizationPricingSettings;
  onUpdateSettings: (updater: (prev: OrganizationPricingSettings) => OrganizationPricingSettings) => void;
  onNotification: (msg: string) => void;
}

export const VehiclesCrewSection: React.FC<VehiclesCrewSectionProps> = ({
  settings,
  onUpdateSettings,
  onNotification
}) => {
  const updateVehicle = (vehicleId: string, field: string, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.map((v) =>
        v.vehicleId === vehicleId ? { ...v, [field]: value } : v
      )
    }));
  };

  const updateCrewEquipment = (field: string, value: any) => {
    onUpdateSettings((prev) => ({
      ...prev,
      crewEquipment: {
        ...prev.crewEquipment,
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-600" />
          Vehicles, Crew & Equipment
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage vehicle capacity envelopes, base rate multipliers, 2-person crew fees, and liftgate equipment surcharges. Capacity constraints are tracked separately from vehicle charges to avoid duplicate fees.
        </p>
      </div>

      {/* Vehicle Types Fleet Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fleet Vehicle Classes & Capacity Envelopes
          </h3>
          <span className="text-xs text-slate-400">
            Base Multiplier scales transport fare
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settings.vehicleTypes.map((veh) => (
            <div
              key={veh.vehicleId}
              className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4 hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{veh.name}</h4>
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {veh.category}
                  </span>
                </div>
                {veh.requiresCommercialLicense && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded">
                    Commercial Class 3/5 Required
                  </span>
                )}
              </div>

              {/* Capacities */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Scale className="w-3 h-3 text-slate-400" /> Max Payload
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={veh.maxPayloadKg}
                      onChange={(e) =>
                        updateVehicle(veh.vehicleId, 'maxPayloadKg', parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-1.5 py-0.5 text-xs text-right font-mono font-semibold border border-slate-200 rounded bg-white"
                    />
                    <span className="text-slate-500">kg</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Box className="w-3 h-3 text-slate-400" /> Max Volume
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="0.5"
                      value={veh.maxVolumeCbm}
                      onChange={(e) =>
                        updateVehicle(veh.vehicleId, 'maxVolumeCbm', parseFloat(e.target.value) || 0)
                      }
                      className="w-16 px-1.5 py-0.5 text-xs text-right font-mono font-semibold border border-slate-200 rounded bg-white"
                    />
                    <span className="text-slate-500">m³</span>
                  </div>
                </div>
              </div>

              {/* Rate Multiplier & Flat Fee */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Rate Multiplier</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="5.0"
                      value={veh.baseRateMultiplier}
                      onChange={(e) =>
                        updateVehicle(veh.vehicleId, 'baseRateMultiplier', parseFloat(e.target.value) || 1)
                      }
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-right font-mono font-semibold"
                    />
                    <span className="text-slate-500 text-xs">x</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Class Surcharge ($)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      step="5.00"
                      min="0"
                      value={veh.flatFeeAdjustment}
                      onChange={(e) =>
                        updateVehicle(veh.vehicleId, 'flatFeeAdjustment', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-right font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crew & Specialized Equipment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Crew Options */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Crew Options & Helper Labor
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Two-Person Delivery Crew</span>
                <span className="text-slate-500 text-[11px]">Required for bulky pieces, white-glove, or heavy residential stairs</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="5.00"
                  value={settings.crewEquipment.twoPersonCrew.flatFee}
                  onChange={(e) =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      crewEquipment: {
                        ...prev.crewEquipment,
                        twoPersonCrew: {
                          ...prev.crewEquipment.twoPersonCrew,
                          flatFee: parseFloat(e.target.value) || 0
                        }
                      }
                    }))
                  }
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Additional Helper (per person)</span>
                <span className="text-slate-500 text-[11px]">3rd or 4th crew member for multi-flight oversized freight</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="5.00"
                  value={settings.crewEquipment.extraHelperRate}
                  onChange={(e) => updateCrewEquipment('extraHelperRate', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Surcharges */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Wrench className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Specialized Handling Equipment
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Hydraulic Power Liftgate</span>
                <span className="text-slate-500 text-[11px]">For ground-level pallet loading without an elevated freight dock</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="2.50"
                  value={settings.crewEquipment.tailLiftSurcharge}
                  onChange={(e) => updateCrewEquipment('tailLiftSurcharge', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 block">Pallet Jack Equipment</span>
                <span className="text-slate-500 text-[11px]">Manual pump truck onboard for dock-to-dock or tailgate movement</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="2.50"
                  value={settings.crewEquipment.palletJackSurcharge}
                  onChange={(e) => updateCrewEquipment('palletJackSurcharge', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
