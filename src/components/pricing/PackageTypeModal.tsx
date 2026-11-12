import { usePendingAction } from '../ui/usePendingAction';
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogHeader } from '../ui/Dialog';
import { loadBillingConfig } from '../../lib/billingStorage';
import { fromDisplayDimension, toDisplayDimension } from '../../lib/units';
import { PackageType } from '../../types/simplePricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import { WeightInput } from './WeightInput';

const DIMENSIONS = [['lengthCm', 'Length'], ['widthCm', 'Width'], ['heightCm', 'Height']] as const;

/** Name, description and optional per-piece defaults that prefill a package on the order form. */
export function PackageTypeModal({ initialType, onSave, onClose }: { initialType: PackageType | null; onSave: (type: PackageType) => void | Promise<void>; onClose: () => void }) {
  const [units] = useState(() => loadBillingConfig().general);
  useEntityDialog(true, onClose);
  const [draft, setDraft] = useState<Partial<PackageType>>(() => ({ ...initialType }));
  const [error, setError] = useState('');
  const patch = (change: Partial<PackageType>) => { setDraft(current => ({ ...current, ...change })); setError(''); };
  const saveAction = usePendingAction();
  const submit = () => {
    const { name, defaultWeightKg, lengthCm, widthCm, heightCm } = draft;
    if (!name?.trim()) return setError('Enter a package type name.');
    const size = [lengthCm, widthCm, heightCm];
    if (size.some(value => value != null) && size.some(value => value == null || !(value > 0))) return setError('Enter length, width and height greater than 0, or leave all three blank.');
    if (defaultWeightKg != null && !(defaultWeightKg > 0)) return setError('Enter a weight greater than 0, or leave it blank.');
    return onSave({ active: true, ...initialType, id: initialType?.id ?? `pkg_${crypto.randomUUID()}`, code: initialType?.code ?? '', name: name.trim(), description: draft.description?.trim() ?? '',
      defaultWeightKg: defaultWeightKg ?? null, lengthCm: lengthCm ?? null, widthCm: widthCm ?? null, heightCm: heightCm ?? null });
  };
  return <Dialog size="form" onClose={onClose}>
    <DialogHeader onClose={onClose} closeLabel="Close package type form" title={initialType ? 'Edit Package Type' : 'Add Package Type'} description="What is being sent. It does not change the price." />
    <form onSubmit={event => { event.preventDefault(); void saveAction.run(async () => submit()); }} noValidate className="app-dialog-body space-y-4">
      <label className="block"><span className="app-label">Name</span><input className="app-input w-full" aria-label="Name" required value={draft.name ?? ''} onChange={event => patch({ name: event.target.value })} placeholder="e.g. Envelope" /></label>
      <label className="block"><span className="app-label">Description</span><input className="app-input w-full" aria-label="Description" value={draft.description ?? ''} onChange={event => patch({ description: event.target.value })} placeholder="e.g. Letters and documents" /></label>
      <div><p className="app-label">Default size and weight (optional)</p><p className="text-xs text-slate-500">Filled in when this type is chosen for a package. The booker can still change them.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="block"><span className="app-label">Weight ({units.weightUnit})</span><WeightInput value={draft.defaultWeightKg ?? null} units={units} label="Default weight" labelWithUnit min={0.000001} className="app-input w-full" onChange={weight => patch({ defaultWeightKg: weight })} /></label>
        {DIMENSIONS.map(([key, label]) => <label key={key} className="block"><span className="app-label">{label} ({units.dimensionUnit})</span>
          <input className="app-input w-full" type="number" min="0.000001" step="any" aria-label={`Default ${label.toLowerCase()} (${units.dimensionUnit})`}
            value={draft[key] == null ? '' : Number(toDisplayDimension(draft[key]!, units).toFixed(2))}
            onChange={event => patch({ [key]: event.target.value === '' ? null : fromDisplayDimension(Number(event.target.value), units) })} /></label>)}
      </div>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div data-popup-actions className="flex flex-wrap items-center justify-end gap-2 pt-2"><Button loading={saveAction.pending} type="submit">{initialType ? 'Save Changes' : 'Add Package Type'}</Button></div>
    </form>
  </Dialog>;
}
