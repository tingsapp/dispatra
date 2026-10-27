import React from 'react';
import type { TruckRoutingMeasurements } from '../../domain/operations';
import { fromDisplayDimension, toDisplayDimension } from '../../lib/units';
import { WeightInput } from '../pricing/WeightInput';
import { FormSection } from './Fields';

type Units = { weightUnit: 'kg' | 'lb'; dimensionUnit: 'cm' | 'in'; distanceUnit: 'km' | 'mi' };

export function TruckRoutingFields({ value, onChange, units }: {
  value: TruckRoutingMeasurements; onChange: (value: TruckRoutingMeasurements) => void; units: Units;
}) {
  const patch = (changes: Partial<TruckRoutingMeasurements>) => onChange({ ...value, ...changes });
  return <FormSection title="Outside dimensions & weight">
    <p className="col-span-full text-xs text-slate-500">Use the truck’s full outside dimensions and total loaded weight, including any trailer and load. Shared by all vehicles of this type. All fields are required except axle weight.</p>
    <div className="col-span-full grid grid-cols-2 items-end gap-3">
      <label className="block min-w-0"><span className="app-label">Loaded gross weight ({units.weightUnit})</span>
        <WeightInput label="Loaded gross weight" value={value.grossWeightKg || null} units={units} required min={1} className="app-input min-w-0 w-full"
          onChange={grossWeightKg => patch({ grossWeightKg: grossWeightKg ?? 0 })} />
      </label>
      <label className="block min-w-0"><span className="app-label">Max axle weight ({units.weightUnit}, optional)</span>
        <WeightInput label="Max axle weight" value={value.axleWeightKg ?? null} units={units} min={1} className="app-input min-w-0 w-full"
          onChange={axleWeightKg => patch({ axleWeightKg: axleWeightKg ?? undefined })} />
      </label>
    </div>
    <div className="col-span-full grid grid-cols-3 gap-3">
      {(['lengthM', 'widthM', 'heightM'] as const).map((field, index) => <label key={field} className="block min-w-0">
        <span className="app-label">{['Length', 'Width', 'Height'][index]} ({units.dimensionUnit})</span>
        <input className="app-input min-w-0 w-full" type="number" min="0.000001" step="any" required
          value={value[field] ? Number(toDisplayDimension(value[field] * 100, units).toFixed(2)) : ''}
          onChange={event => patch({ [field]: fromDisplayDimension(Number(event.target.value), units) / 100 })} />
      </label>)}
    </div>
  </FormSection>;
}

export function truckRoutingError(value?: TruckRoutingMeasurements): string | null {
  if (!value) return 'Enter outside dimensions and loaded gross weight for truck routing.';
  if (![value.lengthM, value.widthM, value.heightM, value.grossWeightKg].every(n => Number.isFinite(n) && n > 0)
    || value.lengthM > 50 || value.widthM > 10 || value.heightM > 10 || value.grossWeightKg > 200000)
    return 'Enter valid outside dimensions and loaded gross weight for truck routing.';
  if (value.axleWeightKg != null && (!Number.isFinite(value.axleWeightKg) || value.axleWeightKg <= 0
    || value.axleWeightKg > 100000 || value.axleWeightKg > value.grossWeightKg))
    return 'Max axle weight must be positive and no greater than loaded gross weight.';
  return null;
}
