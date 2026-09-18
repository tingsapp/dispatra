import React, { useState } from 'react';
import { Driver } from '../../types';
import { loadVehicles } from '../../lib/vehicleStorage';
import { normalizeDriver, syncDriver, connectivity } from '../../lib/driverStorage';
import { validateDriver } from '../../domain/validation';
import { Button } from '../ui/button';
import { Choice, TextField, TagsField, ReadFields } from './Fields';
export function DriverEditor({ driver, drivers, onSave, onCancel }: { driver?: Driver; drivers: Driver[]; onSave: (d: Driver) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Driver>(() => normalizeDriver(driver ?? { id: crypto.randomUUID(), name: '', avatar: '', status: 'offline', statusLabel: 'Off duty', vehicle: 'Unassigned', nextStop: '', eta: '', distance: '', lastUpdate: 'No GPS sample', lat: 49.2827, lng: -123.1207, driverNumber: '', phone: '', dutyStatus: 'OFF_DUTY', createdAt: new Date().toISOString() }));
  const [errors, setErrors] = useState<string[]>([]);
  const [vehicles] = useState(loadVehicles);
  const patch = (p: Partial<Driver>) => setDraft({ ...draft, ...p });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const next = syncDriver(draft); const problems = validateDriver(next, drivers); setErrors(problems); if (!problems.length) { try { onSave(next); } catch (error) { setErrors([error instanceof Error ? error.message : 'Driver could not be saved.']); } } }}>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TextField label="Driver name" value={draft.name} onChange={name => patch({ name })} required />
      <TextField label="Driver number" value={draft.driverNumber} onChange={driverNumber => patch({ driverNumber })} required />
      <TextField label="Phone" type="tel" value={draft.phone} onChange={phone => patch({ phone })} required />
      <TextField label="Email" type="email" value={draft.email} onChange={email => patch({ email })} />
      <Choice label="Account" value={draft.accountStatus} options={['ACTIVE','INACTIVE']} onChange={v => patch({ accountStatus: v as Driver['accountStatus'] })} />
      <Choice label="Duty" value={draft.dutyStatus} options={['ON_DUTY','OFF_DUTY']} onChange={v => patch({ dutyStatus: v as Driver['dutyStatus'] })} />
      <Choice label="Employment" value={draft.employmentType === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE'} options={[{ value: 'EMPLOYEE', label: 'Employee — drives a company vehicle' }, { value: 'CONTRACTOR', label: 'Owner-operator — drives their own vehicle' }]} onChange={v => patch({ employmentType: v as Driver['employmentType'] })} />
      <Choice label="Attached vehicle" value={draft.currentVehicleId ?? ''} options={[{ value: '', label: 'None yet' }, ...vehicles.map(v => ({ value: v.id, label: `${v.unitNumber} · ${v.plateNumber}` }))]} onChange={id => { const v = vehicles.find(v => v.id === id); patch({ currentVehicleId: id || null, vehicle: v ? `${v.unitNumber} · ${v.plateNumber}` : 'Unassigned' }); }} />
      <TagsField label="Service areas" value={draft.serviceAreaIds} onChange={serviceAreaIds => patch({ serviceAreaIds })} />
    </div>
    <p className="text-xs text-slate-500">An owner-operator's truck is still registered under Vehicles; attach it here so dispatch can plan with its capacity. Pricing never depends on the driver or vehicle.</p>
    {driver && <ReadFields values={{ 'App connectivity': connectivity(driver.appLastSeenAt), 'App last seen': driver.appLastSeenAt, 'GPS captured': driver.locationCapturedAt, 'Location permission': driver.locationPermissionStatus, 'Current route': driver.routeId }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Save driver</Button></div>
  </form>;
}
