import { loadBillingConfig } from '../../lib/billingStorage';
import React, { useState } from 'react';
import { Driver } from '../../types';
import { loadVehicles } from '../../lib/vehicleStorage';
import { normalizeDriver, syncDriver, connectivity, driverOrderLimit, nextDriverNumber } from '../../lib/driverStorage';
import { validateDriver } from '../../domain/validation';
import { Button } from '../ui/button';
import { Choice, TextField, TagsField, ReadFields, FormSection } from './Fields';
function PercentField({ label, value, onChange, hint }: { label: string; value?: number; onChange: (v: number | undefined) => void; hint: string }) {
  return <label className="block"><span className="app-label">{label}</span><div className="relative"><input className="app-input w-full pr-8" type="number" min={0} max={100} step="any" required value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span></div><span className="mt-1 block text-xs text-slate-500">{hint}</span></label>;
}
export function DriverEditor({ driver, drivers, onSave, onCancel, formId, hideActions = false }: { driver?: Driver; drivers: Driver[]; onSave: (d: Driver) => void; onCancel: () => void; formId?: string; hideActions?: boolean }) {
  const isEditing = !!driver;
  const [draft, setDraft] = useState<Driver>(() => normalizeDriver(driver ?? { id: crypto.randomUUID(), name: '', avatar: '', status: 'offline', statusLabel: 'Off duty', vehicle: 'Unassigned', nextStop: '', eta: '', distance: '', lastUpdate: 'No GPS sample', lat: 49.2827, lng: -123.1207, driverNumber: '', phone: '', accountStatus: 'ACTIVE', dutyStatus: 'OFF_DUTY', createdAt: new Date().toISOString() }));
  const [orderLimit, setOrderLimit] = useState<number | undefined>(() => driverOrderLimit(driver ?? {}, loadBillingConfig().dispatch.maxActiveOrdersPerDriver));
  const [errors, setErrors] = useState<string[]>([]);
  const [vehicles] = useState(loadVehicles);
  const patch = (p: Partial<Driver>) => setDraft({ ...draft, ...p });
  return <form id={formId} className="space-y-6" onSubmit={e => { e.preventDefault(); if (orderLimit == null) { setErrors(['Enter the maximum active orders for this driver.']); return; } if (isEditing && (!draft.accountStatus || !draft.dutyStatus)) { setErrors(['Account and duty are required when editing a driver.']); return; } const number = isEditing ? draft.driverNumber : nextDriverNumber(drivers); const next = syncDriver({ ...draft, id: isEditing ? draft.id : number!, driverNumber: number, maxActiveOrders: orderLimit }); const problems = validateDriver(next, drivers); setErrors(problems); if (!problems.length) { try { onSave(next); } catch (error) { setErrors([error instanceof Error ? error.message : 'Driver could not be saved.']); } } }}>
    <FormSection title="Contact">
      <TextField className="sm:col-span-2" label="Driver name" value={draft.name} onChange={name => patch({ name })} required placeholder="Full name" />
      <TextField label="Phone" type="tel" value={draft.phone} onChange={phone => patch({ phone })} required placeholder="(604) 555-0100" />
      <TextField label="Email" type="email" value={draft.email} onChange={email => patch({ email })} placeholder="driver@company.com" />
    </FormSection>
    {isEditing && <FormSection title="Status">
      <Choice label="Account" value={draft.accountStatus} required options={['ACTIVE','INACTIVE']} onChange={v => patch({ accountStatus: v as Driver['accountStatus'] })} />
      <Choice label="Duty" value={draft.dutyStatus} required options={['ON_DUTY','OFF_DUTY']} onChange={v => patch({ dutyStatus: v as Driver['dutyStatus'] })} />
    </FormSection>}
    <FormSection title="Assignment">
      <Choice className="sm:col-span-2" label="Employment" value={draft.employmentType === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE'} options={[{ value: 'EMPLOYEE', label: 'Employee — drives a company vehicle' }, { value: 'CONTRACTOR', label: 'Owner-operator — drives their own vehicle' }]} onChange={v => patch({ employmentType: v as Driver['employmentType'], ...(v === 'CONTRACTOR' ? { revenueSharePercent: draft.revenueSharePercent ?? 70, fuelSurchargeSharePercent: draft.fuelSurchargeSharePercent ?? 100 } : {}) })} />
      {draft.employmentType === 'CONTRACTOR' && <>
        <PercentField label="Driver share of order price" value={draft.revenueSharePercent} onChange={revenueSharePercent => patch({ revenueSharePercent })} hint="Of the freight and service price, before fuel and tax." />
        <PercentField label="Driver share of fuel surcharge" value={draft.fuelSurchargeSharePercent} onChange={fuelSurchargeSharePercent => patch({ fuelSurchargeSharePercent })} hint="Usually 100% when the driver buys the fuel." />
      </>}
      <Choice label="Attached vehicle" value={draft.currentVehicleId ?? ''} options={[{ value: '', label: 'None yet' }, ...vehicles.map(v => ({ value: v.id, label: `${v.unitNumber} · ${v.plateNumber}` }))]} onChange={id => { const v = vehicles.find(v => v.id === id); patch({ currentVehicleId: id || null, vehicle: v ? `${v.unitNumber} · ${v.plateNumber}` : 'Unassigned' }); }} hint="Owner-operator trucks are registered under Vehicles too." />
      <label className="block">
        <span className="app-label">Maximum Active Orders</span>
        <input className="app-input w-full" type="number" aria-label="Maximum Active Orders" min={1} step={1} required value={orderLimit ?? ''}
          onChange={event => setOrderLimit(event.target.value === '' ? undefined : Number(event.target.value))} />
        <span className="mt-1 block text-xs text-slate-500">Applies in Manual and Auto dispatch.</span>
      </label>
      <TagsField className="sm:col-span-2" label="Service areas" value={draft.serviceAreaIds} onChange={serviceAreaIds => patch({ serviceAreaIds })} placeholder="Vancouver, Burnaby, Surrey" />
    </FormSection>
    {driver && <ReadFields values={{ 'App connectivity': connectivity(driver.appLastSeenAt), 'App last seen': driver.appLastSeenAt, 'GPS captured': driver.locationCapturedAt, 'Location permission': driver.locationPermissionStatus, 'Current route': driver.routeId }} />}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    {!hideActions && <div className="flex justify-end gap-2"><Button type="submit">Save driver</Button></div>}
  </form>;
}
