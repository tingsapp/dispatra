import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogHeader } from '../ui/Dialog';
import { loadBillingConfig } from '../../lib/billingStorage';
import { fromDisplayDimension, toDisplayDimension, type Units } from '../../lib/units';
import { VehicleType } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import { WeightInput } from './WeightInput';

const DIMENSIONS = [['cargoLengthCm', 'Box length'], ['cargoWidthCm', 'Box width'], ['cargoHeightCm', 'Box height']] as const;

function DimensionInput({ label, value, onChange, units }: { label: string; value?: number; onChange: (cm?: number) => void; units: Units }) {
  return <label className="block"><span className="app-label">{label} ({units.dimensionUnit})</span>
    <input className="app-input w-full" type="number" min="0.000001" step="any" required aria-label={`${label} (${units.dimensionUnit})`}
      value={value == null ? '' : Number(toDisplayDimension(value, units).toFixed(6))}
      onChange={event => onChange(event.target.value === '' ? undefined : fromDisplayDimension(Number(event.target.value), units))} /></label>;
}

/** Name, payload, pallets and inside cargo dimensions. Pricing fields the form does not show are kept as they are. */
export function VehicleTypeModal({ initialVehicle, onSave, onClose }: { initialVehicle: VehicleType | null; onSave: (vehicle: VehicleType) => void; onClose: () => void }) {
  const [units] = useState(() => loadBillingConfig().general);
  useEntityDialog(true, onClose);
  const [draft, setDraft] = useState<Partial<VehicleType>>(() => initialVehicle ?? {});
  const [error, setError] = useState('');
  const patch = (change: Partial<VehicleType>) => { setDraft(current => ({ ...current, ...change })); setError(''); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { name, payloadCapacityKg: payload, palletCapacity: pallets, cargoLengthCm: l, cargoWidthCm: w, cargoHeightCm: h } = draft;
    if (!name?.trim()) return setError('Enter a vehicle type name.');
    if (payload == null || !(payload > 0)) return setError('Enter a max payload greater than 0.');
    if (pallets == null || !Number.isInteger(pallets) || pallets < 0) return setError('Enter a whole number of pallets (0 or more).');
    if ([l, w, h].some(value => value == null || !(value > 0))) return setError('Enter box length, width and height greater than 0.');
    if (!(Number(draft.baseSurcharge ?? 0) >= 0)) return setError('Enter a surcharge of $0 or more.');
    onSave({
      fuelEligible: true, hasLiftgate: false, requiresCommercialLicense: false, active: true,
      ...initialVehicle, id: initialVehicle?.id ?? `veh_${crypto.randomUUID()}`, name: name.trim(),
      baseSurcharge: Math.round(Number(draft.baseSurcharge ?? 0) * 100) / 100, payloadCapacityKg: payload, palletCapacity: pallets, cargoLengthCm: l, cargoWidthCm: w, cargoHeightCm: h,
      cargoBedFeet: l! / 30.48, cargoVolumeCbm: l! * w! * h! / 1e6,
    });
  };
  return <Dialog size="form" onClose={onClose}>
    <DialogHeader onClose={onClose} closeLabel="Close vehicle type form" title={initialVehicle ? 'Edit Vehicle Type' : 'Add Vehicle Type'} description="Capacity and inside box dimensions used when registering vehicles." />
    <form onSubmit={submit} noValidate className="app-dialog-body space-y-4">
      <label className="block"><span className="app-label">Name</span><input className="app-input w-full" aria-label="Name" required value={draft.name ?? ''} onChange={event => patch({ name: event.target.value })} placeholder="e.g. 16ft Cube Truck" /></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="app-label">Max payload ({units.weightUnit})</span><WeightInput value={draft.payloadCapacityKg ?? null} units={units} label="Max payload" labelWithUnit min={0.000001} required className="app-input w-full" onChange={weight => patch({ payloadCapacityKg: weight ?? undefined })} /></label>
        <label className="block"><span className="app-label">Pallet capacity</span><input className="app-input w-full" aria-label="Pallet capacity" type="number" min="0" step="1" required value={draft.palletCapacity ?? ''} onChange={event => patch({ palletCapacity: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {DIMENSIONS.map(([key, label]) => <DimensionInput key={key} label={label} units={units} value={draft[key]} onChange={cm => patch({ [key]: cm })} />)}
      </div>
      <label className="block sm:max-w-xs"><span className="app-label">Surcharge ($)</span><input className="app-input w-full" aria-label="Surcharge ($)" type="number" min="0" step="0.01" value={draft.baseSurcharge ?? 0} onChange={event => patch({ baseSurcharge: event.target.value === '' ? 0 : Number(event.target.value) })} /><span className="mt-1 block text-xs text-slate-500">Added to the quote when an order requires this vehicle type and its rate card applies vehicle surcharges.</span></label>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-2"><Button type="submit">{initialVehicle ? 'Save Changes' : 'Add Vehicle Type'}</Button></div>
    </form>
  </Dialog>;
}
