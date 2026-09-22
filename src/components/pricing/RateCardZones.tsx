import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { zoneCode } from '../../lib/pricingStorage';
import { parseZonePostalCodes } from '../../lib/zonePostalCodes';
import { Zone } from '../../types/pricing';
import { Button } from '../ui/button';
import { cardClass } from './RateCardFields';

export interface ZoneActions {
  addZone: () => string;
  patchZone: (id: string, changes: Partial<Zone>) => void;
  deleteZone: (id: string) => Promise<boolean>;
}

function ZonePostalCodesField({ zone, patchZone }: { zone: Zone; patchZone: ZoneActions['patchZone'] }) {
  const id = useId();
  // Keep separators and unfinished codes intact while typing; normalize the display on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const update = (text: string) => {
    setDraft(text);
    patchZone(zone.id, { postalCodes: parseZonePostalCodes(text) });
  };
  const missing = !zone.postalCodes?.length;
  return <>
    <input type="text" className="app-table-input w-full" aria-label={`ZIP / postal codes for ${zone.name || 'Unnamed zone'}`}
      aria-invalid={missing} aria-describedby={`${id}-hint`} placeholder="ZIP / postal codes, separated by commas"
      value={draft ?? (zone.postalCodes ?? []).join(', ')} onChange={event => update(event.target.value)}
      onBlur={() => setDraft(null)} onPaste={event => {
        const pasted = event.clipboardData.getData('text');
        if (!/[\r\n]/.test(pasted)) return;
        // A single-line input would otherwise remove line breaks and merge adjacent codes.
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const text = pasted.replace(/[\r\n]+/g, ', ');
        update(input.value.slice(0, start) + text + input.value.slice(end));
        window.requestAnimationFrame(() => input.setSelectionRange(start + text.length, start + text.length));
      }} />
    <span id={`${id}-hint`} className="sr-only">
      {missing ? 'Postal codes required. ' : ''}Separate codes with commas.
    </span>
  </>;
}

/** Shared zone directory; card-owned prices are edited separately in the matrix. */
export function RateCardZones({ zones, addZone, patchZone, deleteZone }: { zones: Zone[] } & ZoneActions) {
  const nameErrorId = useId();
  const [newZoneId, setNewZoneId] = useState<string>();
  const root = useRef<HTMLElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!newZoneId) return;
    const input = Array.from(root.current?.querySelectorAll<HTMLInputElement>('[data-zone-name]') ?? [])
      .find(field => field.dataset.zoneName === newZoneId);
    if (input) { input.focus(); input.select(); setNewZoneId(undefined); }
  }, [newZoneId, zones]);
  const remove = async (id: string) => {
    if (await deleteZone(id)) window.requestAnimationFrame(() => addButton.current?.focus());
  };
  return <section ref={root} aria-label="Zones" className={`${cardClass} app-zone-panel min-w-0 space-y-4`}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="app-section-title app-zone-section-title">Zones</h3>
        <p className="mt-0.5 text-xs text-slate-500">Zone names and postal codes save automatically across cards. Use Save Card for prices.</p>
      </div>
      <Button ref={addButton} type="button" size="sm" className="app-zone-add" onClick={() => setNewZoneId(addZone())}><Plus aria-hidden="true" />Add</Button>
    </div>
    <span id={nameErrorId} className="sr-only">Zone name required</span>
    <div className="app-table-shell max-w-full overflow-x-auto">
      <table className="app-table app-table-editable app-zone-table app-zone-directory min-w-[380px]" aria-label="Zones">
        <colgroup><col style={{ width: '32%' }} /><col /><col style={{ width: '2.5rem' }} /></colgroup>
        <thead className="sr-only"><tr><th scope="col" className="text-left">Zone name</th><th scope="col" className="text-left">ZIP / postal codes</th><th scope="col" className="text-right">Actions</th></tr></thead>
        <tbody>{zones.map(zone => <tr key={zone.id}>
          <td><input aria-label={`Zone name: ${zone.name || 'Unnamed zone'}`} className="app-table-input w-full" data-zone-name={zone.id}
            aria-invalid={!zone.name.trim()} aria-describedby={!zone.name.trim() ? nameErrorId : undefined}
            value={zone.name} onChange={event => patchZone(zone.id, { name: event.target.value, code: zoneCode(event.target.value) })} />
          </td>
          <td><ZonePostalCodesField zone={zone} patchZone={patchZone} /></td>
          <td className="text-right"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove zone ${zone.name || 'Unnamed zone'}`}
            title="Delete zone" onClick={() => { void remove(zone.id); }}><Trash2 aria-hidden="true" /></Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!zones.length && <p className="text-sm text-slate-500">Add your first zone.</p>}
  </section>;
}
