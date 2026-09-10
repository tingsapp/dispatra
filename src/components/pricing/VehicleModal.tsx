import React, { useState, useEffect } from 'react';
import { X, Truck, DollarSign, Weight, Package, Ruler, ShieldAlert } from 'lucide-react';
import { VehicleType } from '../../types/simplePricing';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicle: VehicleType) => void;
  initialVehicle?: VehicleType | null;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialVehicle
}) => {
  const [name, setName] = useState('');
  const [payloadCapacityKg, setPayloadCapacityKg] = useState<number>(1000);
  const [palletCapacity, setPalletCapacity] = useState<number>(2);
  const [cargoBedFeet, setCargoBedFeet] = useState<number>(12);
  const [baseSurcharge, setBaseSurcharge] = useState<number>(0);
  const [hasLiftgate, setHasLiftgate] = useState(false);
  const [requiresCommercialLicense, setRequiresCommercialLicense] = useState(false);
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialVehicle) {
      setName(initialVehicle.name);
      setPayloadCapacityKg(initialVehicle.payloadCapacityKg);
      setPalletCapacity(initialVehicle.palletCapacity);
      setCargoBedFeet(initialVehicle.cargoBedFeet || 12);
      setBaseSurcharge(initialVehicle.baseSurcharge);
      setHasLiftgate(initialVehicle.hasLiftgate);
      setRequiresCommercialLicense(initialVehicle.requiresCommercialLicense);
      setDescription(initialVehicle.description || '');
      setActive(initialVehicle.active);
    } else {
      setName('');
      setPayloadCapacityKg(1000);
      setPalletCapacity(2);
      setCargoBedFeet(12);
      setBaseSurcharge(0);
      setHasLiftgate(false);
      setRequiresCommercialLicense(false);
      setDescription('');
      setActive(true);
    }
  }, [initialVehicle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const vehicle: VehicleType = {
      id: initialVehicle?.id || `veh_${Date.now()}`,
      name: name.trim(),
      payloadCapacityKg: Math.max(100, Number(payloadCapacityKg) || 1000),
      palletCapacity: Math.max(1, Number(palletCapacity) || 1),
      cargoBedFeet: cargoBedFeet > 0 ? Number(cargoBedFeet) : undefined,
      baseSurcharge: Math.max(0, Number(baseSurcharge) || 0),
      hasLiftgate,
      requiresCommercialLicense,
      description: description.trim() || undefined,
      active
    };

    onSave(vehicle);
    onClose();
  };

  // Helper quick preset for tones
  const applyPreset = (tonnes: number, pallets: number, bedFt: number, surcharge: number, liftgate: boolean, cdl: boolean) => {
    setName(`${tonnes} Tonne (${bedFt}ft Truck)`);
    setPayloadCapacityKg(tonnes * 1000);
    setPalletCapacity(pallets);
    setCargoBedFeet(bedFt);
    setBaseSurcharge(surcharge);
    setHasLiftgate(liftgate);
    setRequiresCommercialLicense(cdl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialVehicle ? 'Edit Vehicle Type' : 'Add New Vehicle Type'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set payload weight limit, pallet capacity, and vehicle rate surcharge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QUICK PRESET BUTTONS (WHEN ADDING) */}
        {!initialVehicle && (
          <div className="px-6 pt-3 pb-1 border-b border-slate-50 bg-slate-50/50 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Quick Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset(1, 2, 10, 0, false, false)}
              className="px-2 py-1 text-[11px] rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
            >
              1 Tonne
            </button>
            <button
              type="button"
              onClick={() => applyPreset(2, 4, 16, 25, false, false)}
              className="px-2 py-1 text-[11px] rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
            >
              2 Tonne
            </button>
            <button
              type="button"
              onClick={() => applyPreset(3, 8, 20, 50, true, true)}
              className="px-2 py-1 text-[11px] rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
            >
              3 Tonne
            </button>
            <button
              type="button"
              onClick={() => applyPreset(5, 12, 26, 90, true, true)}
              className="px-2 py-1 text-[11px] rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
            >
              5 Tonne
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vehicle Name / Class <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2 Tonne (16ft Cube Van)"
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Max Payload <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="100"
                  min="100"
                  required
                  value={payloadCapacityKg}
                  onChange={(e) => setPayloadCapacityKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-2.5 top-2.5 text-[11px] text-slate-400 font-medium">kg</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                ≈ {(payloadCapacityKg / 1000).toFixed(1)} Tonnes
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pallet Capacity <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={palletCapacity}
                  onChange={(e) => setPalletCapacity(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-sm pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-2.5 top-2.5 text-[11px] text-slate-400 font-medium">skids</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                40″ × 48″ pallets
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bed Length
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="6"
                  value={cargoBedFeet}
                  onChange={(e) => setCargoBedFeet(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm pl-3 pr-7 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-2.5 top-2.5 text-[11px] text-slate-400 font-medium">ft</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Cargo floor length
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vehicle Upgrade Surcharge ($)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
              <input
                type="number"
                step="5.00"
                min="0"
                value={baseSurcharge}
                onChange={(e) => setBaseSurcharge(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full text-sm pl-6 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Additional base fee added to orders requiring this vehicle size (e.g. $25 for 2-Ton, $50 for 3-Ton).
            </p>
          </div>

          {/* SUGGESTED LOGISTICS ATTRIBUTES */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
              Vehicle Equipment & Compliance
            </span>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasLiftgate"
                checked={hasLiftgate}
                onChange={(e) => setHasLiftgate(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer"
              />
              <label htmlFor="hasLiftgate" className="text-xs text-slate-700 cursor-pointer select-none">
                <strong>Equipped with Hydraulic Tail-Lift (Power Liftgate)</strong>
                <span className="block text-[11px] text-slate-500">
                  Enables loading heavy pallets where no freight dock is available
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
              <input
                type="checkbox"
                id="requiresCommercialLicense"
                checked={requiresCommercialLicense}
                onChange={(e) => setRequiresCommercialLicense(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer"
              />
              <label htmlFor="requiresCommercialLicense" className="text-xs text-slate-700 cursor-pointer select-none">
                <strong>Requires Commercial Driver License (CDL / Air Brakes)</strong>
                <span className="block text-[11px] text-slate-500">
                  Dispatches only certified commercial drivers for this truck class
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Best for residential moves, commercial dock delivery, multi-pallet freight..."
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="vehicleActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer"
            />
            <label htmlFor="vehicleActive" className="text-xs font-medium text-slate-700 cursor-pointer">
              Vehicle type is active and selectable in dispatch
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              {initialVehicle ? 'Save Changes' : 'Create Vehicle Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
