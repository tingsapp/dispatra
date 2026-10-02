import React, { useState } from 'react';
import { VehicleAsset, normalizeVehicle, syncVehicle, type VehicleProfile } from '../../lib/vehicleStorage';
import type { VehicleType } from '../../types/simplePricing';
import { loadSimplePricingConfig } from '../../lib/simplePricingStorage';
import { validateVehicle } from '../../domain/validation';
import { loadBillingConfig } from '../../lib/billingStorage';
import { fromDisplayDimension, toDisplayDimension } from '../../lib/units';
import { WeightInput } from '../pricing/WeightInput';
import { Button } from '../ui/button';
import { Choice, TextField, NumberField, DateField, ReadFields, FormSection } from './Fields';
import { listedVehicleTypes } from '../../lib/vehicleTypes';

const equipmentOptions = ['Liftgate', 'Open deck', 'Dolly', 'Tie-down rails'];
/** Refrigeration comes from the vehicle type, not a checkbox; kept on the record so assignment can match reefer types. */
const TYPE_EQUIPMENT = ['refrigeration'];
const isTypeEquipment = (name: string) => TYPE_EQUIPMENT.includes(name.toLowerCase());
const categoryByTypeId: Record<string, VehicleAsset['category']> = { veh_1_ton: '1 Tonne Van', veh_2_ton: '2 Tonne Cube', veh_3_ton: '3 Tonne Box', veh_5_ton: '5 Tonne Freight', veh_reefer_van: 'Refrigerated Reefer', veh_reefer_truck: 'Refrigerated Reefer', veh_reefer_trailer: 'Refrigerated Reefer', veh_flatbed_truck: 'Flatbed', veh_flatbed_trailer: 'Flatbed' };

function CargoDimension({ label, value, onChange, unit }: { label: string; value?: number; onChange: (value?: number) => void; unit: 'cm' | 'in' }) {
  const units = { distanceUnit: 'km' as const, weightUnit: 'kg' as const, dimensionUnit: unit };
  return <label className="block"><span className="app-label">{label} ({unit})</span><input className="app-input w-full" type="number" min="0.000001" step="any" required
    value={value == null ? '' : Number(toDisplayDimension(value, units).toFixed(6))}
    onChange={event => onChange(event.target.value === '' ? undefined : fromDisplayDimension(Number(event.target.value), units))} /></label>;
}

export function VehicleEditor({ vehicle, vehicles, onSave, onCancel, formId, hideActions = false, vehicleTypes, live = false }: { vehicle?: VehicleAsset; vehicles: VehicleAsset[]; onSave: (v: VehicleAsset, profile: VehicleProfile) => void; onCancel: () => void; formId?: string; hideActions?: boolean; vehicleTypes?: VehicleType[]; live?: boolean }) {
  const [localTypes] = useState(() => loadSimplePricingConfig().vehicles);
  const types = vehicleTypes ?? localTypes;
  const [units] = useState(() => loadBillingConfig().general);
  const [draft, setDraft] = useState<VehicleAsset>(() => normalizeVehicle(vehicle ?? { id: crypto.randomUUID(), unitNumber: '', plateNumber: '', vin: '', category: '1 Tonne Van', vehicleTypeId: '', makeModel: '', year: new Date().getFullYear(), status: 'available', statusLabel: 'Available', payloadCapacityKg: 0, palletCapacity: 0, hasLiftgate: false, hasReefer: false, fuelType: 'Diesel', fuelBatteryPercent: 0, odometerKm: 0, lastInspectionDate: '', nextServiceKm: 0, createdAt: new Date().toISOString() }));
  const originalType = types.find(type => type.id === vehicle?.vehicleTypeId);
  const [payloadCapacityKg, setPayloadCapacityKg] = useState<number | null>(originalType?.payloadCapacityKg ?? null);
  const [palletCapacity, setPalletCapacity] = useState<number | undefined>(originalType?.palletCapacity);
  const [errors, setErrors] = useState<string[]>([]);
  const patch = (changes: Partial<VehicleAsset>) => setDraft(current => ({ ...current, ...changes }));
  const isEditing = !!vehicle;
  const selectedType = types.find(type => type.id === draft.vehicleTypeId);
  const selectedEquipment = draft.equipment ?? [];
  const choices = [...new Set([...equipmentOptions, ...selectedEquipment])].filter(name => !isTypeEquipment(name));
  const toggleEquipment = (name: string, enabled: boolean) => patch({ equipment: enabled ? [...selectedEquipment, name] : selectedEquipment.filter(item => item !== name) });
  const chooseType = (id: string) => {
    const type = types.find(item => item.id === id);
    patch({ vehicleTypeId: id, category: categoryByTypeId[id] ?? draft.category });
    if (!type) return;
    setPayloadCapacityKg(type.payloadCapacityKg); setPalletCapacity(type.palletCapacity);
    if (type.cargoLengthCm && type.cargoWidthCm && type.cargoHeightCm) patch({ cargoLengthCm: type.cargoLengthCm, cargoWidthCm: type.cargoWidthCm, cargoHeightCm: type.cargoHeightCm });
    const kept = selectedEquipment.filter(name => !isTypeEquipment(name));
    const defaults = (type.equipment ?? []).filter(name => !kept.some(item => item.toLowerCase() === name.toLowerCase()));
    patch({ equipment: [...kept, ...defaults] });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedType?.name.trim() || payloadCapacityKg == null || payloadCapacityKg <= 0 || palletCapacity == null || palletCapacity < 1 || !Number.isInteger(palletCapacity)) {
      setErrors(['Choose a vehicle type and enter positive payload and pallet capacity.']); return;
    }
    const { cargoLengthCm: length, cargoWidthCm: width, cargoHeightCm: height } = draft;
    if ([length, width, height].some(value => value == null || !Number.isFinite(value) || value <= 0)) {
      setErrors(['Enter positive box length, width and height.']); return;
    }
    const typeId = live ? selectedType.id : vehicle?.vehicleTypeId?.startsWith('fleet_') ? vehicle.vehicleTypeId : `fleet_${draft.id}`;
    const volume = length! * width! * height! / 1e6;
    const next = syncVehicle({ ...draft, vehicleTypeId: typeId, payloadCapacityKg, palletCapacity, cargoVolumeM3: volume });
    const problems = validateVehicle(next, vehicles);
    setErrors(problems);
    if (problems.length) return;
    onSave(next, { type: {
      ...selectedType, id: typeId, payloadCapacityKg, palletCapacity,
      cargoBedFeet: length! / 30.48, cargoVolumeCbm: volume,
      hasLiftgate: next.hasLiftgate,
      active: selectedType?.active ?? true
    }, costPerKm: (() => { const costs = loadBillingConfig().operatingCost.costPerKmByVehicleId; return (vehicle?.vehicleTypeId ? costs[vehicle.vehicleTypeId] : undefined) ?? costs[selectedType.id] ?? null; })() });
  };
  return <form id={formId} className="space-y-6" onSubmit={submit}>
    <FormSection title="Vehicle">
      <TextField label="Unit number" value={draft.unitNumber} required onChange={unitNumber => patch({ unitNumber })} placeholder="e.g. V12" />
      <Choice label="Vehicle type" required value={draft.vehicleTypeId ?? ''} options={[{ value: '', label: 'Choose a vehicle type' }, ...[...listedVehicleTypes(types), ...types.filter(type => type.id === draft.vehicleTypeId && !listedVehicleTypes(types).includes(type))].map(type => ({ value: type.id, label: type.name }))]} onChange={chooseType} hint="Fills capacity and box size from the type. Edits affect this vehicle only." />
      <TextField label="Make and model" value={draft.makeModel} onChange={makeModel => patch({ makeModel })} placeholder="e.g. Ford Transit 350" />
      <NumberField label="Year" step="1" value={draft.year} onChange={year => patch({ year: year ?? 0 })} />
      <TextField label="Licence plate" value={draft.plateNumber} required onChange={plateNumber => patch({ plateNumber })} placeholder="e.g. CVK 421" />
      <TextField label="Plate province" value={draft.plateProvince} onChange={plateProvince => patch({ plateProvince })} />
    </FormSection>
    <FormSection title="Capacity">
      <label className="block"><span className="app-label">Max payload ({units.weightUnit})</span><WeightInput value={payloadCapacityKg} units={units} label="Max payload" min={0.000001} required onChange={setPayloadCapacityKg} /></label>
      <label className="block"><span className="app-label">Pallet capacity</span><input className="app-input w-full" aria-label="Pallet capacity" type="number" min="1" step="1" required value={palletCapacity ?? ''} onChange={event => setPalletCapacity(event.target.value === '' ? undefined : Number(event.target.value))} /></label>
      <CargoDimension label="Box length" value={draft.cargoLengthCm} onChange={cargoLengthCm => patch({ cargoLengthCm })} unit={units.dimensionUnit} />
      <CargoDimension label="Box width" value={draft.cargoWidthCm} onChange={cargoWidthCm => patch({ cargoWidthCm })} unit={units.dimensionUnit} />
      <CargoDimension label="Box height" value={draft.cargoHeightCm} onChange={cargoHeightCm => patch({ cargoHeightCm })} unit={units.dimensionUnit} />
      <label className="block"><span className="app-label">Maximum stops</span><input className="app-input w-full" aria-label="Maximum stops" type="number" min="1" step="1" placeholder="No limit" value={draft.maxStops ?? ''} onChange={event => patch({ maxStops: event.target.value === '' ? undefined : Number(event.target.value) })} /><span className="mt-1 block text-xs text-slate-500">Leave blank for no vehicle-specific limit.</span></label>
    </FormSection>
    {isEditing && <FormSection title="Status">
      <Choice label="Record status" value={draft.recordStatus} options={['ACTIVE','INACTIVE']} onChange={value => patch({ recordStatus: value as VehicleAsset['recordStatus'] })} />
      <Choice label="Availability" value={draft.availability} options={['AVAILABLE','IN_USE','UNAVAILABLE']} onChange={value => patch({ availability: value as VehicleAsset['availability'] })} />
      {draft.availability === 'UNAVAILABLE' && <><TextField label="Unavailable reason" value={draft.unavailableReason} required onChange={unavailableReason => patch({ unavailableReason })} /><div /><DateField label="Unavailable from" value={draft.unavailableFrom} onChange={unavailableFrom => patch({ unavailableFrom })} /><DateField label="Unavailable until" value={draft.unavailableUntil} onChange={unavailableUntil => patch({ unavailableUntil })} /></>}
    </FormSection>}
    <FormSection title="Equipment">
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {choices.map(name => <label key={name} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="app-checkbox" checked={selectedEquipment.includes(name)} onChange={event => toggleEquipment(name, event.target.checked)} />{name}</label>)}
      </div>
      <label className="block sm:col-span-2"><span className="app-label">Description</span><textarea rows={2} value={draft.notes ?? ''} onChange={event => patch({ notes: event.target.value })} placeholder="Licence requirements, quirks, anything dispatch should know…" className="app-input w-full" /></label>
    </FormSection>
    {vehicle && <ReadFields values={{ 'Current driver': vehicle.currentDriverName, 'Current route': vehicle.currentRouteId, 'Last location': vehicle.currentLocation }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    {!hideActions && <div className="flex justify-end gap-2"><Button type="submit">Save vehicle</Button></div>}
  </form>;
}
