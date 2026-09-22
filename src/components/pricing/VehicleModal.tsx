import { WeightInput } from './WeightInput';
import { Button } from '../ui/button';
import { Dialog, DialogHeader } from '../ui/Dialog';
import React, { useEffect, useState } from 'react';
import { loadBillingConfig } from '../../lib/billingStorage';
import { fromDisplayDistanceRate, toDisplayDistanceRate } from '../../lib/units';
import { VehicleType } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `costPerKm` is the internal running cost in km; null means the organization default. */
  onSave: (vehicle: VehicleType, costPerKm: number | null) => void;
  initialVehicle?: VehicleType | null;
  initialCostPerKm?: number | null;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialVehicle,
  initialCostPerKm = null
}) => {
  const units = loadBillingConfig().general;
  useEntityDialog(isOpen, onClose);
  const [name, setName] = useState('');
  const [payloadCapacityKg, setPayloadCapacityKg] = useState<number>(1000);
  const [palletCapacity, setPalletCapacity] = useState<number>(2);
  const [cargoBedFeet, setCargoBedFeet] = useState<number>(12);
  const [baseSurcharge, setBaseSurcharge] = useState<number>(0);
  const [costPerKm, setCostPerKm] = useState<string>('');
  const [fuelEligible, setFuelEligible] = useState(true);
  const [hasLiftgate, setHasLiftgate] = useState(false);
  const [requiresCommercialLicense, setRequiresCommercialLicense] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (initialVehicle) {
      setName(initialVehicle.name);
      setPayloadCapacityKg(initialVehicle.payloadCapacityKg);
      setPalletCapacity(initialVehicle.palletCapacity);
      setCargoBedFeet(initialVehicle.cargoBedFeet || 12);
      setBaseSurcharge(initialVehicle.baseSurcharge);
      setCostPerKm(initialCostPerKm == null ? '' : String(toDisplayDistanceRate(initialCostPerKm, units)));
      setFuelEligible(initialVehicle.fuelEligible ?? true);
      setHasLiftgate(initialVehicle.hasLiftgate);
      setRequiresCommercialLicense(initialVehicle.requiresCommercialLicense);
      setDescription(initialVehicle.description || '');
    } else {
      setName('');
      setPayloadCapacityKg(1000);
      setPalletCapacity(2);
      setCargoBedFeet(12);
      setBaseSurcharge(0);
      setCostPerKm('');
      setFuelEligible(true);
      setHasLiftgate(false);
      setRequiresCommercialLicense(false);
      setDescription('');
    }
  }, [initialVehicle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const vehicle: VehicleType = {
      cargoVolumeCbm: initialVehicle?.cargoVolumeCbm,
      id: initialVehicle?.id || `veh_${Date.now()}`,
      name: name.trim(),
      payloadCapacityKg: Math.max(100, Number(payloadCapacityKg) || 1000),
      palletCapacity: Math.max(1, Number(palletCapacity) || 1),
      cargoBedFeet: cargoBedFeet > 0 ? Number(cargoBedFeet) : undefined,
      baseSurcharge: Math.max(0, Number(baseSurcharge) || 0),
      fuelEligible,
      hasLiftgate,
      requiresCommercialLicense,
      description: description.trim() || undefined,
      active: initialVehicle?.active ?? true
    };

    onSave(vehicle, costPerKm.trim() === '' ? null : fromDisplayDistanceRate(Math.max(0, Number(costPerKm) || 0), units));
    onClose();
  };

  return (
    <Dialog size="form" onClose={onClose}>
      <DialogHeader onClose={onClose} closeLabel="Close vehicle type form" title={initialVehicle ? 'Edit Vehicle Type' : 'Add New Vehicle Type'} description="Set payload weight limit, pallet capacity, and vehicle rate surcharge." />
        <form onSubmit={handleSubmit} className="app-dialog-body space-y-4">
          <div>
            <label className="app-label">
              Vehicle Name / Class <span className="text-rose-500">*</span>
            </label>
            <input aria-label="Vehicle type name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2 Tonne (16ft Cube Van)"
              className="app-input w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="app-label">
                Max Payload ({units.weightUnit}) <span className="text-rose-500">*</span>
              </label>
              <WeightInput value={payloadCapacityKg} units={units} label="Max Payload" min={100} required
                onChange={weight => setPayloadCapacityKg(weight ?? 0)} />
              <span className="text-xs text-slate-400 mt-0.5 block">
                ≈ {(payloadCapacityKg / 1000).toFixed(1)} Tonnes
              </span>
            </div>

            <div>
              <label className="app-label">
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
                  className="app-input w-full pl-3 pr-10"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-medium">skids</span>
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">
                40″ × 48″ pallets
              </span>
            </div>

            <div>
              <label className="app-label">
                Bed Length
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="6"
                  value={cargoBedFeet}
                  onChange={(e) => setCargoBedFeet(parseFloat(e.target.value) || 0)}
                  className="app-input w-full pl-3 pr-7"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-medium">ft</span>
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Cargo floor length
              </span>
            </div>
          </div>

          <div>
            <label className="app-label">
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
                className="app-input w-full pl-6 pr-3"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Additional base fee added to orders requiring this vehicle size (e.g. $25 for 2-Ton, $50 for 3-Ton).
            </p>
          </div>

          <div>
            <label htmlFor="vehicleCostPerKm" className="app-label">
              Running cost / {units.distanceUnit} (internal)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
              <input
                id="vehicleCostPerKm"
                type="number"
                step="0.01"
                min="0"
                value={costPerKm}
                onChange={(e) => setCostPerKm(e.target.value)}
                placeholder="Organization default"
                className="app-input w-full pl-6 pr-3"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fuel, tyres, maintenance and depreciation for cost estimates only. Never changes the shipper price; blank uses the stored default cost.
            </p>
          </div>

          {/* SUGGESTED LOGISTICS ATTRIBUTES */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
            <span className="text-xs font-medium text-slate-700 block">
              Vehicle Equipment & Compliance
            </span>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vehicleFuelEligible"
                checked={fuelEligible}
                onChange={(e) => setFuelEligible(e.target.checked)}
                className="app-checkbox"
              />
              <label htmlFor="vehicleFuelEligible" className="text-xs text-slate-700 cursor-pointer select-none">
                <strong>Surcharge is fuel-eligible</strong>
                <span className="block text-xs text-slate-500">
                  Include the vehicle surcharge in the base the fuel surcharge is calculated on
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="hasLiftgate"
                checked={hasLiftgate}
                onChange={(e) => setHasLiftgate(e.target.checked)}
                className="app-checkbox"
              />
              <label htmlFor="hasLiftgate" className="text-xs text-slate-700 cursor-pointer select-none">
                <strong>Equipped with Hydraulic Tail-Lift (Power Liftgate)</strong>
                <span className="block text-xs text-slate-500">
                  Enables loading heavy pallets where no freight dock is available
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="requiresCommercialLicense"
                checked={requiresCommercialLicense}
                onChange={(e) => setRequiresCommercialLicense(e.target.checked)}
                className="app-checkbox"
              />
              <label htmlFor="requiresCommercialLicense" className="text-xs text-slate-700 cursor-pointer select-none">
                <strong>Requires Commercial Driver License (CDL / Air Brakes)</strong>
                <span className="block text-xs text-slate-500">
                  Dispatches only certified commercial drivers for this truck class
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="app-label">
              Description
            </label>
            <textarea aria-label="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Best for residential moves, commercial dock delivery, multi-pallet freight..."
              className="app-input w-full resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="submit">{initialVehicle ? 'Save Changes' : 'Create Vehicle Type'}</Button>
          </div>
        </form>
    </Dialog>
  );
};
