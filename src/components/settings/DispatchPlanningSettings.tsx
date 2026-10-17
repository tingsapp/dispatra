import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../portal/api';
import { companySettingsKey, useWorkspaceAccount } from '../../portal/WorkspaceAccount';
import { useSettingsGuard } from './useSettingsGuard';
import { Button } from '../ui/button';
import type { components } from '../../portal/schema';

type Zone = components['schemas']['DispatchZone'];
export function DispatchPlanningSettings() {
  const workspace = useWorkspaceAccount();
  return workspace ? <SavedDispatchPlanningSettings workspace={workspace} /> : null;
}

function SavedDispatchPlanningSettings({ workspace }: { workspace: NonNullable<ReturnType<typeof useWorkspaceAccount>> }) {
  const cache = useQueryClient();
  const [zones, setZones] = useState<Zone[]>(workspace?.settings.data.dispatch_zones ?? []);
  const [maximum, setMaximum] = useState(workspace?.settings.data.maximum_active_orders ?? 3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const key = useRef(crypto.randomUUID());
  const dirty = JSON.stringify(zones) !== JSON.stringify(workspace?.settings.data.dispatch_zones ?? []) || maximum !== workspace?.settings.data.maximum_active_orders;
  useSettingsGuard(dirty);
  useEffect(() => { if (!dirty) { setZones(workspace?.settings.data.dispatch_zones ?? []); setMaximum(workspace?.settings.data.maximum_active_orders ?? 3); } }, [workspace?.settings.version]);
  const edit = (value: Zone[]) => { setZones(value); key.current = crypto.randomUUID(); setMessage(''); };
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const slug = workspace.account.organization!.slug;
      const result = await api.saveCompanySettings(slug, { version: workspace.settings.version, data: { ...workspace.settings.data, dispatch_zones: zones, maximum_active_orders: maximum } }, key.current);
      cache.setQueryData(companySettingsKey(slug), result);
      await cache.invalidateQueries({ queryKey: ['operations', slug] });
      setZones(result.data.dispatch_zones); setMaximum(result.data.maximum_active_orders); setMessage('Dispatch planning saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save dispatch planning.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 mt-8" aria-labelledby="dispatch-planning-heading">
    <h2 id="dispatch-planning-heading" className="app-section-title">Dispatch planning</h2>
    <p className="text-sm text-slate-500">Orders are grouped by geography and balanced by work completed and remaining. Shared warehouses, different Shipper pickups and mixed routes are supported.</p>
    <label className="block text-sm">Maximum active Orders per driver<input aria-label="Maximum active Orders per driver" className="app-input block mt-1 max-w-40" type="number" min={1} max={100} value={maximum} disabled={busy} onChange={e => {setMaximum(Number(e.target.value)); key.current=crypto.randomUUID();}} /></label>
    <p className="text-xs text-slate-500">Capacity and deadlines always apply. Increase this saved limit when planning larger morning batches.</p>
    <p className="text-sm text-slate-500">Optional dispatch zones use Canadian postal prefixes, such as V5Y. Unmatched addresses are grouped automatically. These zones do not change pricing.</p>
    {zones.map((zone,index) => <fieldset key={index} disabled={busy} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <input aria-label={`Zone ${index+1} name`} className="app-input" placeholder="Zone name" value={zone.name} onChange={e=>edit(zones.map((z,i)=>i===index?{...z,name:e.target.value}:z))} />
      <input aria-label={`Zone ${index+1} postal prefixes`} className="app-input" placeholder="V5Y, V5Z" value={zone.postal_codes.join(', ')} onChange={e=>edit(zones.map((z,i)=>i===index?{...z,postal_codes:e.target.value.split(',').map(v=>v.trim().toUpperCase())}:z))} />
      <Button type="button" variant="outline" onClick={()=>edit(zones.filter((_,i)=>i!==index))}>Remove zone</Button>
    </fieldset>)}
    <div className="flex gap-3 flex-wrap"><Button type="button" variant="outline" disabled={busy || zones.length>=100} onClick={()=>edit([...zones,{name:'',postal_codes:[]}])}>Add dispatch zone</Button><Button type="button" disabled={busy || !dirty} onClick={save}>{busy?'Saving…':'Save dispatch planning'}</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
