import React, { useState } from 'react';
import { Driver } from '../../types';
import { loadSimplePricingConfig } from '../../lib/simplePricingStorage';
import { loadVehicles } from '../../lib/vehicleStorage';
import { normalizeDriver, syncDriver, connectivity } from '../../lib/driverStorage';
import { validateDriver } from '../../domain/validation';
import { Button } from '../ui/button';
import { Choice, TextField, NumberField, TagsField, DateField, OptionalFields, ReadFields } from './Fields';
export function DriverEditor({ driver, drivers, onSave, onCancel }: { driver?: Driver; drivers: Driver[]; onSave: (d: Driver) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Driver>(() => normalizeDriver(driver ?? { id: crypto.randomUUID(), name: '', avatar: '', status: 'offline', statusLabel: 'Off duty', vehicle: 'Unassigned', nextStop: '', eta: '', distance: '', lastUpdate: 'No GPS sample', lat: 49.2827, lng: -123.1207, driverNumber: '', phone: '', dutyStatus: 'OFF_DUTY', createdAt: new Date().toISOString() }));
  const [errors, setErrors] = useState<string[]>([]);
  const [vehicles] = useState(loadVehicles);
  const [types] = useState(() => loadSimplePricingConfig().vehicles);
  const patch = (p: Partial<Driver>) => setDraft({ ...draft, ...p });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const next = syncDriver(draft); const problems = validateDriver(next, drivers); setErrors(problems); if (!problems.length) { try { onSave(next); } catch (error) { setErrors([error instanceof Error ? error.message : 'Driver could not be saved.']); } } }}>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TextField label="Driver name" value={draft.name} onChange={name => patch({ name })} required />
      <TextField label="Driver number" value={draft.driverNumber} onChange={driverNumber => patch({ driverNumber })} required />
      <TextField label="Phone" type="tel" value={draft.phone} onChange={phone => patch({ phone })} required />
      <TextField label="Email" type="email" value={draft.email} onChange={email => patch({ email })} />
      <Choice label="Account" value={draft.accountStatus} options={['ACTIVE','INACTIVE']} onChange={v => patch({ accountStatus: v as Driver['accountStatus'] })} />
      <Choice label="Duty" value={draft.dutyStatus} options={['ON_DUTY','OFF_DUTY']} onChange={v => patch({ dutyStatus: v as Driver['dutyStatus'] })} />
      <Choice label="Work" value={draft.workStatus} options={['AVAILABLE','BUSY','ON_BREAK']} onChange={v => patch({ workStatus: v as Driver['workStatus'] })} />
      <Choice label="Current vehicle" value={draft.currentVehicleId ?? ''} options={[{ value: '', label: 'Unassigned' }, ...vehicles.map(v => ({ value: v.id, label: `${v.unitNumber} · ${v.plateNumber}` }))]} onChange={id => { const v = vehicles.find(v => v.id === id); patch({ currentVehicleId: id || null, vehicle: v ? `${v.unitNumber} (${v.plateNumber})` : 'Unassigned' }); }} />
      <TagsField label="Skills" value={draft.skills} onChange={skills => patch({ skills })} />
      <TagsField label="Service areas" value={draft.serviceAreaIds} onChange={serviceAreaIds => patch({ serviceAreaIds })} />
      <DateField label="Shift starts" value={draft.shiftStart?.includes('T') ? draft.shiftStart : ''} onChange={shiftStart => patch({ shiftStart })} />
      <DateField label="Shift ends" value={draft.shiftEnd} onChange={shiftEnd => patch({ shiftEnd })} />
    </div>
    <OptionalFields title="Qualifications, availability & notes">
      <Choice label="Employment" value={draft.employmentType ?? 'CONTRACTOR'} options={['EMPLOYEE','CONTRACTOR','TEMPORARY']} onChange={v => patch({ employmentType: v as Driver['employmentType'] })} />
      <TextField label="Licence class" value={draft.licenseClass} onChange={licenseClass => patch({ licenseClass })} />
      <fieldset className="space-y-2"><legend className="text-xs text-slate-600">Qualified vehicle types</legend>{types.map(t => <label key={t.id} className="flex gap-2 text-xs"><input type="checkbox" checked={draft.vehicleTypeQualifications?.includes(t.id) ?? false} onChange={e => patch({ vehicleTypeQualifications: e.target.checked ? [...(draft.vehicleTypeQualifications ?? []), t.id] : draft.vehicleTypeQualifications?.filter(id => id !== t.id) })} />{t.name}</label>)}</fieldset>
      <NumberField label="Maximum work minutes" value={draft.maximumWorkMinutes} step="1" onChange={maximumWorkMinutes => patch({ maximumWorkMinutes })} />
      <TextField label="Home depot" value={draft.homeDepotId} onChange={homeDepotId => patch({ homeDepotId })} />
      <TextField label="Preferred start location" value={draft.preferredStartLocation} onChange={preferredStartLocation => patch({ preferredStartLocation })} />
      <TextField label="External reference" value={draft.externalReference} onChange={externalReference => patch({ externalReference })} />
      <TextField label="Operational notes" value={draft.notes} onChange={notes => patch({ notes })} />
      <div className="sm:col-span-2 space-y-3">{draft.availabilitySchedule?.map((a, i) => { const update = (p: Partial<typeof a>) => patch({ availabilitySchedule: draft.availabilitySchedule!.map(x => x.id === a.id ? { ...x, ...p } : x) }); return <fieldset key={a.id} className="border rounded-lg p-3 space-y-2"><legend className="text-xs">Availability {i + 1}</legend><Choice label="Availability" value={a.available ? 'AVAILABLE' : 'UNAVAILABLE'} options={['AVAILABLE','UNAVAILABLE']} onChange={v => update({ available: v === 'AVAILABLE' })} /><DateField label="Period starts" value={a.start} onChange={start => update({ start })} /><DateField label="Period ends" value={a.end} onChange={end => update({ end })} /><Button type="button" size="sm" variant="ghost" onClick={() => patch({ availabilitySchedule: draft.availabilitySchedule!.filter(x => x.id !== a.id) })}>Remove period</Button></fieldset>; })}<Button type="button" size="sm" variant="outline" onClick={() => patch({ availabilitySchedule: [...(draft.availabilitySchedule ?? []), { id: crypto.randomUUID(), start: '', end: '', available: false }] })}>Add availability period</Button></div>
    </OptionalFields>
    {driver && <ReadFields values={{ 'App connectivity': connectivity(driver.appLastSeenAt), 'App last seen': driver.appLastSeenAt, 'GPS captured': driver.locationCapturedAt, 'Location permission': driver.locationPermissionStatus, 'Current route': driver.routeId }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Save driver</Button></div>
  </form>;
}
