import { useId, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { TMS_FIELDS, TMS_FIELD_GROUPS, TMS_MAP_HINTS, type TmsFieldGroup, type TmsFieldMap, type TmsRecord } from '../../integrations/preview';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';

const TITLES: Record<TmsRecord, string> = { driver: 'Driver fields', vehicle: 'Vehicle fields', order: 'Order fields' };

/** Left: the TMS field name or path (for example `customer.name`). Right: the fixed Dispatra field it fills. */
function FieldMapDialog({ record, value, onApply, onClose }: { record: TmsRecord; value: TmsFieldMap; onApply: (map: TmsFieldMap) => void; onClose: () => void }) {
  const [map, setMap] = useState(value);
  const fields = TMS_FIELDS[record];
  const groups = record === 'order' ? (Object.keys(TMS_FIELD_GROUPS) as TmsFieldGroup[]).map(key => ({ key, ...TMS_FIELD_GROUPS[key], fields: fields.filter(field => field.group === key) }))
    : [{ key: 'all', title: '', hint: '', fields }];
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader title={TITLES[record]} description={TMS_MAP_HINTS[record]} onClose={onClose} />
    <DialogBody>
      <table aria-label={TITLES[record]} className="w-full table-fixed text-left text-sm">
        <thead><tr className="text-xs text-app-muted"><th scope="col" className="pb-2 pr-2 font-normal">TMS field</th><th scope="col" className="w-10" /><th scope="col" className="pb-2 pl-2 font-normal">Dispatra field</th></tr></thead>
        {groups.map(group => <tbody key={group.key}>
          {group.title && <tr><th scope="rowgroup" colSpan={3} className="pb-1 pt-4 text-left font-medium">{group.title}{group.hint && <p className="mt-0.5 text-xs font-normal text-app-muted">{group.hint}</p>}</th></tr>}
          {group.fields.map(field => <tr key={field.key}>
            <td className="py-1.5 pr-2"><input autoFocus={field === fields[0]} aria-label={`TMS field for ${group.title ? `${group.title} ` : ''}${field.label}`} value={map[field.key] ?? ''} placeholder={field.placeholder ?? (field.required ? 'Required' : 'Optional')} spellCheck={false} autoComplete="off"
              onChange={event => setMap(current => ({ ...current, [field.key]: event.target.value }))} className="app-input w-full font-mono text-xs" /></td>
            <td aria-hidden="true" className="text-center text-app-muted">→</td>
            <td className="py-1.5 pl-2"><input aria-label={`Dispatra field ${group.title ? `${group.title} ` : ''}${field.label}`} value={field.label} disabled className="app-input w-full" /></td>
          </tr>)}
        </tbody>)}
      </table>
    </DialogBody>
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      <Button type="button" onClick={() => { onApply(Object.fromEntries(Object.entries(map).map(([key, name]) => [key, name.trim()]).filter(([, name]) => name))); onClose(); }}>Apply</Button>
    </DialogFooter>
  </Dialog>;
}

/** Icon button beside a label that opens the record's field map. */
export function FieldMapButton({ record, map, onMap }: { record: TmsRecord; map: TmsFieldMap; onMap: (map: TmsFieldMap) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label={`Map ${TITLES[record].toLowerCase()}`} title={`Map ${TITLES[record].toLowerCase()}`} onClick={() => setOpen(true)} className="app-icon-button h-7 w-7">
      <ArrowLeftRight className="h-4 w-4" aria-hidden="true" /></button>
    {open && <FieldMapDialog record={record} value={map} onApply={onMap} onClose={() => setOpen(false)} />}
  </>;
}

/** Endpoint input whose label carries the field map button. */
export function EndpointField({ label, record, value, map, placeholder, onChange, onMap }: {
  label: string; record: TmsRecord; value: string; map: TmsFieldMap; placeholder: string; onChange: (value: string) => void; onMap: (map: TmsFieldMap) => void;
}) {
  const id = useId();
  return <div className="grid gap-1.5 text-sm text-slate-700">
    <div className="flex h-5 items-center gap-1"><label htmlFor={id}>{label}</label><FieldMapButton record={record} map={map} onMap={onMap} /></div>
    <input id={id} value={value} placeholder={placeholder} spellCheck={false} onChange={event => onChange(event.target.value)} className="app-input font-normal" />
  </div>;
}
