import React, { useState } from 'react';
import { VehicleAsset, normalizeVehicle, syncVehicle } from '../../lib/vehicleStorage';
import { loadSimplePricingConfig } from '../../lib/simplePricingStorage';
import { validateVehicle } from '../../domain/validation';
import { Button } from '../ui/button';
import { Choice, TextField, NumberField, TagsField, DateField, OptionalFields, ReadFields } from './Fields';
export function VehicleEditor({ vehicle, vehicles, onSave, onCancel }: { vehicle?: VehicleAsset; vehicles: VehicleAsset[]; onSave: (v: VehicleAsset) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<VehicleAsset>(() => normalizeVehicle(vehicle ?? { id: crypto.randomUUID(), unitNumber: '', plateNumber: '', vin: '', category: '1 Tonne Van', vehicleTypeId: '', makeModel: '', year: new Date().getFullYear(), status: 'available', statusLabel: 'Available', payloadCapacityKg: 0, palletCapacity: 0, hasLiftgate: false, hasReefer: false, fuelType: 'Diesel', fuelBatteryPercent: 0, odometerKm: 0, lastInspectionDate: '', nextServiceKm: 0, createdAt: new Date().toISOString() }));
  const [errors, setErrors] = useState<string[]>([]);
  const [types] = useState(() => loadSimplePricingConfig().vehicles);
  const patch = (p: Partial<VehicleAsset>) => setDraft({ ...draft, ...p });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const next = syncVehicle(draft); const problems = validateVehicle(next, vehicles); setErrors(problems); if (!problems.length) onSave(next); }}>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TextField label="Unit number" value={draft.unitNumber} required onChange={unitNumber => patch({ unitNumber })} />
      <TextField label="Licence plate" value={draft.plateNumber} required onChange={plateNumber => patch({ plateNumber })} />
      <TextField label="Plate province" value={draft.plateProvince} onChange={plateProvince => patch({ plateProvince })} />
      <Choice label="Vehicle type" value={draft.vehicleTypeId ?? ''} options={[{ value: '', label: 'Choose type' }, ...types.filter(t => t.active || t.id === draft.vehicleTypeId).map(t => ({ value: t.id, label: t.name }))]} onChange={vehicleTypeId => patch({ vehicleTypeId })} />
      <TextField label="Make and model" value={draft.makeModel} onChange={makeModel => patch({ makeModel })} />
      <NumberField label="Year" step="1" value={draft.year} onChange={year => patch({ year: year ?? 0 })} />
      <Choice label="Record status" value={draft.recordStatus} options={['ACTIVE','INACTIVE']} onChange={v => patch({ recordStatus: v as VehicleAsset['recordStatus'] })} />
      <Choice label="Availability" value={draft.availability} options={['AVAILABLE','IN_USE','UNAVAILABLE']} onChange={v => patch({ availability: v as VehicleAsset['availability'] })} />
      <NumberField label="Payload capacity (kg)" value={draft.payloadCapacityKg} onChange={v => patch({ payloadCapacityKg: v ?? 0 })} />
      <NumberField label="Cargo volume (m³)" value={draft.cargoVolumeM3} onChange={cargoVolumeM3 => patch({ cargoVolumeM3 })} />
      <NumberField label="Cargo length (cm)" value={draft.cargoLengthCm} onChange={cargoLengthCm => patch({ cargoLengthCm })} />
      <NumberField label="Cargo width (cm)" value={draft.cargoWidthCm} onChange={cargoWidthCm => patch({ cargoWidthCm })} />
      <NumberField label="Cargo height (cm)" value={draft.cargoHeightCm} onChange={cargoHeightCm => patch({ cargoHeightCm })} />
      <NumberField label="Pallet capacity" step="1" value={draft.palletCapacity} onChange={v => patch({ palletCapacity: v ?? 0 })} />
      <TagsField label="Equipment" value={draft.equipment} onChange={equipment => patch({ equipment })} />
      <TagsField label="Service areas" value={draft.serviceAreaIds} onChange={serviceAreaIds => patch({ serviceAreaIds })} />
    </div>
    {draft.availability === 'UNAVAILABLE' && <div className="grid sm:grid-cols-2 gap-3"><TextField label="Unavailable reason" value={draft.unavailableReason} required onChange={unavailableReason => patch({ unavailableReason })} /><DateField label="Unavailable from" value={draft.unavailableFrom} onChange={unavailableFrom => patch({ unavailableFrom })} /><DateField label="Unavailable until" value={draft.unavailableUntil} onChange={unavailableUntil => patch({ unavailableUntil })} /></div>}
    <OptionalFields title="Depot & notes"><TextField label="Home depot" value={draft.homeDepotId} onChange={homeDepotId => patch({ homeDepotId })} /><TextField label="External reference" value={draft.externalReference} onChange={externalReference => patch({ externalReference })} /><TextField label="Operational notes" value={draft.notes} onChange={notes => patch({ notes })} /></OptionalFields>
    {vehicle && <ReadFields values={{ 'Current driver': vehicle.currentDriverName, 'Current route': vehicle.currentRouteId, 'Last location': vehicle.currentLocation }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Save vehicle</Button></div>
  </form>;
}
