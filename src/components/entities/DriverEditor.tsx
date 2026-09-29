import { loadBillingConfig } from '../../lib/billingStorage';
import React, { useEffect, useState } from 'react';
import { Driver } from '../../types';
import { loadVehicles, type VehicleAsset } from '../../lib/vehicleStorage';
import { normalizeDriver, syncDriver, driverOrderLimit, nextDriverNumber } from '../../lib/driverStorage';
import { validateDriver } from '../../domain/validation';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { ChevronDown, Plus } from 'lucide-react';
import { Choice, TextField, FormSection } from './Fields';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
function PercentField({ label, value, onChange, hint }: { label: string; value?: number; onChange: (v: number | undefined) => void; hint: string }) {
  return <label className="block"><span className="app-label">{label}</span><div className="relative"><input className="app-input w-full pr-8" type="number" min={0} max={100} step="any" required value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span></div><span className="mt-1 block text-xs text-slate-500">{hint}</span></label>;
}
export function DriverEditor({ driver, drivers, onSave, onCancel, onRegisterVehicle, createdVehicle, formId, hideActions = false, vehicleOptions, onAddressBlockedChange }: { driver?: Driver; drivers: Driver[]; onSave: (d: Driver) => void; onCancel: () => void; onRegisterVehicle?: () => void; createdVehicle?: VehicleAsset | null; formId?: string; hideActions?: boolean; vehicleOptions?: VehicleAsset[]; onAddressBlockedChange?: (blocked: boolean) => void }) {
  const isEditing = !!driver;
  const [draft, setDraft] = useState<Driver>(() => normalizeDriver(driver ?? { id: crypto.randomUUID(), name: '', avatar: '', status: 'offline', statusLabel: 'Off duty', vehicle: 'Unassigned', nextStop: '', eta: '', distance: '', lastUpdate: 'No GPS sample', lat: 49.2827, lng: -123.1207, driverNumber: '', phone: '', accountStatus: 'ACTIVE', dutyStatus: 'OFF_DUTY', createdAt: new Date().toISOString() }));
  const [addressState, setAddressState] = useState<'idle' | 'resolving' | 'failed'>('idle');
  const [orderLimit, setOrderLimit] = useState<number | undefined>(() => driver ? driverOrderLimit(driver, loadBillingConfig().dispatch.maxActiveOrdersPerDriver) : undefined);
  const [errors, setErrors] = useState<string[]>([]);
  const [localVehicles, setVehicles] = useState(loadVehicles);
  const vehicles = vehicleOptions ?? localVehicles;
  useEffect(() => {
    if (!createdVehicle) return;
    setVehicles(loadVehicles());
    setDraft(current => ({ ...current, currentVehicleId: createdVehicle.id, vehicle: `${createdVehicle.unitNumber} · ${createdVehicle.plateNumber}` }));
  }, [createdVehicle]);
  useEffect(() => () => onAddressBlockedChange?.(false), [onAddressBlockedChange]);
  const patch = (p: Partial<Driver>) => setDraft(current => ({ ...current, ...p }));
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === draft.currentVehicleId);
  return <form id={formId} className="space-y-6" onSubmit={e => { e.preventDefault(); if (addressState !== 'idle') { setErrors([addressState === 'resolving' ? 'Wait for the selected address details to load.' : 'Edit the address and select a suggestion again.']); return; } if (isEditing && orderLimit == null) { setErrors(['Enter the maximum active orders for this driver.']); return; } if (isEditing && (!draft.accountStatus || !draft.dutyStatus)) { setErrors(['Account and duty are required when editing a driver.']); return; } const number = isEditing ? draft.driverNumber : nextDriverNumber(drivers); const next = syncDriver({ ...draft, id: isEditing ? draft.id : number!, driverNumber: number, maxActiveOrders: isEditing ? orderLimit : undefined }); const problems = validateDriver(next, drivers); setErrors(problems); if (!problems.length) { try { onSave(next); } catch (error) { setErrors([error instanceof Error ? error.message : 'Driver could not be saved.']); } } }}>
    <FormSection title="Contact">
      <TextField className="sm:col-span-2" label="Driver name" value={draft.name} onChange={name => patch({ name })} required placeholder="Full name" />
      <TextField label="Phone" type="tel" value={draft.phone} onChange={phone => patch({ phone })} required placeholder="(604) 555-0100" />
      <TextField label="Email" type="email" required value={draft.email} onChange={email => patch({ email })} placeholder="driver@company.com" />
      <div className="sm:col-span-2">
        <label htmlFor="driver-address" className="app-label">Address <span aria-hidden="true">*</span></label>
        <AddressAutocomplete id="driver-address" aria-label="Address" value={draft.address ?? ''} includeCoordinates onSelectionStateChange={state => { setAddressState(state); onAddressBlockedChange?.(state !== 'idle'); }} onChange={(address, selected) => patch({ address, addressCoordinates: selected })} required placeholder="Street, city, province, postal code" className="app-input w-full" />
        <span className="mt-1 block text-xs text-slate-500">The city in this address defines the driver’s service area.</span>
      </div>
    </FormSection>
    {isEditing && <FormSection title="Status">
      <Choice label="Account" value={draft.accountStatus} required options={['ACTIVE','INACTIVE']} onChange={v => patch({ accountStatus: v as Driver['accountStatus'] })} />
      <Choice label="Duty" value={draft.dutyStatus} required options={['ON_DUTY','OFF_DUTY']} onChange={v => patch({ dutyStatus: v as Driver['dutyStatus'] })} />
    </FormSection>}
    <FormSection title="Assignment">
      <Choice className="sm:col-span-2" label="Employment" value={draft.employmentType === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE'} options={[{ value: 'EMPLOYEE', label: 'Employee — drives a company vehicle' }, { value: 'CONTRACTOR', label: 'Owner-operator — drives their own vehicle' }]} onChange={v => patch({ employmentType: v as Driver['employmentType'], ...(v === 'CONTRACTOR' ? { revenueSharePercent: draft.revenueSharePercent ?? 70, fuelSurchargeSharePercent: draft.fuelSurchargeSharePercent ?? 100 } : {}) })} />
      <div>
        <span className="app-label">Attached vehicle</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Attached vehicle" className="app-combobox flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap px-3 text-slate-800">
              <span className="truncate">{selectedVehicle ? `${selectedVehicle.vehicleNumber ?? selectedVehicle.unitNumber} · ${selectedVehicle.plateNumber}` : 'None yet'}</span>
              <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" size="trigger">
            {onRegisterVehicle && <DropdownMenuItem icon={Plus} onSelect={onRegisterVehicle}>Register new vehicle</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => patch({ currentVehicleId: null, vehicle: 'Unassigned' })}>None yet</DropdownMenuItem>
            {vehicles.map(v => <DropdownMenuItem key={v.id} onSelect={() => patch({ currentVehicleId: v.id, vehicle: `${v.vehicleNumber ?? v.unitNumber} · ${v.plateNumber}` })}>{v.unitNumber} · {v.plateNumber}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mt-1 block text-xs text-slate-500">Owner-operator trucks are registered under Vehicles too.</span>
      </div>
      {isEditing && <label className="block">
        <span className="app-label">Maximum Active Orders</span>
        <input className="app-input w-full" type="number" aria-label="Maximum Active Orders" min={1} step={1} required value={orderLimit ?? ''}
          onChange={event => setOrderLimit(event.target.value === '' ? undefined : Number(event.target.value))} />
        <span className="mt-1 block text-xs text-slate-500">Applies in Manual and Auto dispatch.</span>
      </label>}
    </FormSection>
    {draft.employmentType === 'CONTRACTOR' && <FormSection title="Payout terms">
      <PercentField label="Driver share of order price" value={draft.revenueSharePercent} onChange={revenueSharePercent => patch({ revenueSharePercent })} hint="Of the priced freight and service amount, before fuel, discounts and tax." />
      <PercentField label="Driver share of fuel surcharge" value={draft.fuelSurchargeSharePercent} onChange={fuelSurchargeSharePercent => patch({ fuelSurchargeSharePercent })} hint="Usually 100% when the driver buys the fuel." />
    </FormSection>}
    {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
    {!hideActions && <div className="flex justify-end gap-2"><Button type="submit" disabled={addressState !== 'idle'}>Save driver</Button></div>}
  </form>;
}
