import { Lock, Plus, Trash2 } from 'lucide-react';
import type { components } from '../../portal/schema';
import { Select } from '../ui/Select';
import { cardClass, fieldClass } from './BillingFields';

export type ReasonPolicy = components['schemas']['ReasonPolicy'];

// Built-ins that hold Order completion until dispatch resolves them (api stop_reasons REASONS); companies cannot change it.
const HOLDS_COMPLETION = new Set(['RECIPIENT_UNAVAILABLE', 'WRONG_ADDRESS', 'MISSING_ITEMS', 'DAMAGED_ITEM', 'VEHICLE_PROBLEM', 'WRONG_EQUIPMENT', 'UNSAFE', 'OTHER']);
const STOPS = [{ value: 'BOTH', label: 'Pickup and drop-off' }, { value: 'PICKUP', label: 'Pickup only' }, { value: 'DROPOFF', label: 'Drop-off only' }];
const SIDES = [{ value: 'SHIPPER', label: 'Shipper' }, { value: 'CARRIER', label: 'Carrier (us)' }, { value: 'UNDECIDED', label: 'Decide per order' }];
const CHARGES = [{ value: 'AUTO', label: 'Charge automatically' }, { value: 'REVIEW', label: 'Review first' }, { value: 'NEVER', label: 'Don’t charge' }];
const isCustom = (row: ReasonPolicy) => row.code.startsWith('CUSTOM_');

export function stopReasonsError(rows: ReasonPolicy[]) {
  // An empty list is the built-in defaults (the API fills it on read).
  if (!rows.length) return null;
  if (rows.some(row => row.label.trim().length < 2)) return 'Name every reason (2 characters or more).';
  const names = rows.map(row => row.label.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Reason names must be unique.';
  return null;
}

const GRID = 'lg:grid-cols-[minmax(13rem,1.6fr)_repeat(3,minmax(10rem,1fr))_2rem]';

/** The company's complete stop reason list, in Dispatra's fixed order: name, where it shows, who is responsible and how
 * Extra time is charged. Deleting a reason removes it for drivers; custom reasons sit on a built-in meaning. */
export function StopReasonSettings({ rows, onChange }: { rows: ReasonPolicy[]; onChange: (rows: ReasonPolicy[]) => void }) {
  const builtIns = rows.filter(row => !isCustom(row));
  const update = (index: number, change: Partial<ReasonPolicy>) => onChange(rows.map((row, i) => i === index ? { ...row, ...change } : row));
  // A new reason goes before Another issue, which stays last; the API keeps the fixed order on save.
  const add = () => {
    const at = rows.findIndex(row => row.code === 'OTHER');
    const next = [...rows];
    next.splice(at < 0 ? rows.length : at, 0, { code: `CUSTOM_${Date.now().toString(36).toUpperCase()}`, base: 'OTHER', label: '', stops: 'BOTH', responsibility: 'UNDECIDED', charge: 'REVIEW' });
    onChange(next);
  };
  return <section aria-label="Delay reasons" className={`${cardClass} app-panel-plain space-y-4`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl"><h2 className="app-section-title text-slate-900">Delay reasons</h2>
        <p className="text-xs text-slate-500 mt-0.5">What drivers choose when they report a problem or answer a progress question. Who is responsible and the Extra time rule decide each stop’s charge when the order completes.</p></div>
      <button type="button" className="app-button inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={add}><Plus className="h-3.5 w-3.5" />Add reason</button>
    </div>
    <div>
      <div className={`hidden gap-3 border-b border-slate-200 pb-2 text-xs font-medium text-slate-500 lg:grid ${GRID}`} aria-hidden>
        <span>Reason</span><span>Shown at</span><span>Responsible</span><span>Extra time</span><span />
      </div>
      <ul className="pt-1.5" aria-label="Delay reasons">
        {rows.map((row, index) => {
          const carrier = row.responsibility === 'CARRIER';
          const name = row.label.trim() || 'New reason';
          return <li key={row.code} className={`grid grid-cols-1 gap-3 py-1.5 lg:items-start ${GRID}`}>
            <div className="space-y-1.5">
              <input aria-label="Reason name" maxLength={60} className={fieldClass} value={row.label} placeholder="Reason name" onChange={event => update(index, { label: event.target.value })} />
              {isCustom(row)
                ? <div className="flex items-center gap-2"><span className="shrink-0 text-xs text-slate-500">Treated as</span>
                    <Select aria-label={`What ${name} means`} className="w-full" value={row.base ?? 'OTHER'} onValueChange={base => update(index, { base: base as ReasonPolicy['base'] })} options={builtIns.map(b => ({ value: b.code, label: b.label }))} /></div>
                : HOLDS_COMPLETION.has(row.code) && <p className="flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3 w-3" aria-hidden />Holds order completion until resolved</p>}
            </div>
            <Select className="w-full" aria-label={`Where ${name} shows`} value={row.stops} onValueChange={stops => update(index, { stops: stops as ReasonPolicy['stops'] })} options={STOPS} />
            <Select className="w-full" aria-label={`Who is responsible for ${name}`} value={row.responsibility} onValueChange={side => update(index, { responsibility: side as ReasonPolicy['responsibility'], ...(side === 'CARRIER' && { charge: 'NEVER' }) })} options={SIDES} />
            <div className="space-y-1">
              <Select className="w-full" aria-label={`Extra time for ${name}`} disabled={carrier} value={carrier ? 'NEVER' : row.charge} onValueChange={charge => update(index, { charge: charge as ReasonPolicy['charge'] })} options={CHARGES} />
              {carrier && <p className="text-xs text-slate-500">Carrier reasons are never charged.</p>}
            </div>
            <button type="button" aria-label={`Delete ${name}`} title="Delete reason" disabled={rows.length === 1}
              className="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent lg:mt-0.5"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button>
          </li>;
        })}
      </ul>
    </div>
    <p className="text-xs text-slate-500">A custom reason files and holds completion like the reason it is treated as. Reports already filed keep their reason name, even after it is deleted.</p>
  </section>;
}
