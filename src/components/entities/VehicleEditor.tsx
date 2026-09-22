import React, { useState } from 'react';
import { VehicleAsset, normalizeVehicle, syncVehicle } from '../../lib/vehicleStorage';
import { loadSimplePricingConfig } from '../../lib/simplePricingStorage';
import { validateVehicle } from '../../domain/validation';
import { loadBillingConfig } from '../../lib/billingStorage';
import { formatWeight } from '../../lib/units';
import { Button } from '../ui/button';
import { Choice, TextField, NumberField, TagsField, DateField, ReadFields, FormSection } from './Fields';
export function VehicleEditor({ vehicle, vehicles, onSave, onCancel, formId, hideActions = false }: { vehicle?: VehicleAsset; vehicles: VehicleAsset[]; onSave: (v: VehicleAsset) => void; onCancel: () => void; formId?: string; hideActions?: boolean }) {
  const [draft, setDraft] = useState<VehicleAsset>(() => normalizeVehicle(vehicle ?? { id: crypto.randomUUID(), unitNumber: '', plateNumber: '', vin: '', category: '1 Tonne Van', vehicleTypeId: '', makeModel: '', year: new Date().getFullYear(), status: 'available', statusLabel: 'Available', payloadCapacityKg: 0, palletCapacity: 0, hasLiftgate: false, hasReefer: false, fuelType: 'Diesel', fuelBatteryPercent: 0, odometerKm: 0, lastInspectionDate: '', nextServiceKm: 0, createdAt: new Date().toISOString() }));
  const [units] = useState(() => loadBillingConfig().general);
  const [errors, setErrors] = useState<string[]>([]);
  const [types] = useState(() => loadSimplePricingConfig().vehicles);
  const patch = (p: Partial<VehicleAsset>) => setDraft({ ...draft, ...p });
  const isEditing = !!vehicle;
  const selectedType = types.find(t => t.id === draft.vehicleTypeId);
  return <form id={formId} className="space-y-6" onSubmit={e => { e.preventDefault(); const type = types.find(t => t.id === draft.vehicleTypeId);
    // Capacity comes from the vehicle type; the asset keeps a copy so assignment checks work on the record alone.
    const next = syncVehicle(type ? { ...draft, payloadCapacityKg: type.payloadCapacityKg, palletCapacity: type.palletCapacity, cargoVolumeM3: type.cargoVolumeCbm ?? draft.cargoVolumeM3 } : draft);
    const problems = validateVehicle(next, vehicles); setErrors(problems); if (!problems.length) onSave(next); }}>
    <FormSection title="Vehicle">
      <TextField label="Unit number" value={draft.unitNumber} required onChange={unitNumber => patch({ unitNumber })} placeholder="e.g. V12" />
      <Choice label="Vehicle type" required value={draft.vehicleTypeId ?? ''} options={[{ value: '', label: 'Choose type' }, ...types.filter(t => t.active || t.id === draft.vehicleTypeId).map(t => ({ value: t.id, label: t.name }))]} onChange={vehicleTypeId => patch({ vehicleTypeId })}
        hint={selectedType ? `${formatWeight(selectedType.payloadCapacityKg, units)} payload · ${selectedType.palletCapacity} pallets${selectedType.cargoVolumeCbm != null ? ` · ${selectedType.cargoVolumeCbm} m³` : ''}` : 'Capacity and surcharge come from the type.'} />
      <TextField label="Make and model" value={draft.makeModel} onChange={makeModel => patch({ makeModel })} placeholder="e.g. Ford Transit 350" />
      <NumberField label="Year" step="1" value={draft.year} onChange={year => patch({ year: year ?? 0 })} />
      <TextField label="Licence plate" value={draft.plateNumber} required onChange={plateNumber => patch({ plateNumber })} placeholder="e.g. CVK 421" />
      <TextField label="Plate province" value={draft.plateProvince} onChange={plateProvince => patch({ plateProvince })} />
    </FormSection>
    {isEditing && <FormSection title="Status">
      <Choice label="Record status" value={draft.recordStatus} options={['ACTIVE','INACTIVE']} onChange={v => patch({ recordStatus: v as VehicleAsset['recordStatus'] })} />
      <Choice label="Availability" value={draft.availability} options={['AVAILABLE','IN_USE','UNAVAILABLE']} onChange={v => patch({ availability: v as VehicleAsset['availability'] })} />
      {draft.availability === 'UNAVAILABLE' && <><TextField label="Unavailable reason" value={draft.unavailableReason} required onChange={unavailableReason => patch({ unavailableReason })} /><div /><DateField label="Unavailable from" value={draft.unavailableFrom} onChange={unavailableFrom => patch({ unavailableFrom })} /><DateField label="Unavailable until" value={draft.unavailableUntil} onChange={unavailableUntil => patch({ unavailableUntil })} /></>}
    </FormSection>}
    <FormSection title="Equipment">
      <TagsField className="sm:col-span-2" label="Equipment" value={draft.equipment} onChange={equipment => patch({ equipment })} placeholder="Liftgate, Refrigeration, Tie-down rails" />
      <label className="block sm:col-span-2"><span className="app-label">Description</span><textarea id="vehicle-description" rows={2} value={draft.notes ?? ''} onChange={e => patch({ notes: e.target.value })} placeholder="Licence requirements, quirks, anything dispatch should know…" className="app-input w-full" /></label>
    </FormSection>
    {vehicle && <ReadFields values={{ 'Current driver': vehicle.currentDriverName, 'Current route': vehicle.currentRouteId, 'Last location': vehicle.currentLocation }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    {!hideActions && <div className="flex justify-end gap-2"><Button type="submit">Save vehicle</Button></div>}
  </form>;
}
