import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { operations, type DispatchDecision, type Order } from '../../operations/api';
import { Button } from '../ui/button';
import { useEntityDialog } from '../entities/useEntityDialog';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';

export function FleetPlan({slug, orders}: {slug: string; orders: Order[]}) {
  const cache = useQueryClient();
  const [open,setOpen] = useState(false);
  const [rows,setRows] = useState<DispatchDecision[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const approved = useRef(new Set<string>());
  useEntityDialog(open, () => { if (!busy) setOpen(false); });
  const plan = async () => {
    setOpen(true); setBusy(true); setError('');
    try {setRows(await operations.fleetPlan(slug)); approved.current.clear();}
    catch(e) {setError(e instanceof Error?e.message:'Could not prepare the fleet plan.');}
    finally {setBusy(false);}
  };
  const assign = async (row: DispatchDecision) => {
    setBusy(true); setError('');
    try {
      await operations.approveDispatch(slug,row,row.candidates[0].driver_id);
      approved.current.add(row.id); setRows(current=>[...current]);
      await cache.invalidateQueries({queryKey:['operations',slug]});
    } catch(e) {setError(e instanceof Error?e.message:'Could not assign this Order. Recalculate the plan.');}
    finally {setBusy(false);}
  };
  return <><Button type="button" variant="outline" onClick={plan}>Plan dispatch</Button>{open && <Dialog size="lg" className="bg-app-surface" onClose={()=>{if(!busy)setOpen(false);}}>
    <DialogHeader title="Fleet dispatch plan" description="Geographic groups and balanced workloads. Up to 100 ready Orders within the dispatch horizon; every approval rechecks the current route." onClose={()=>{if(!busy)setOpen(false);}} />
    <DialogBody className="space-y-4">
      {busy && <p role="status">Checking fleet assignments…</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {!busy && !rows.length && !error && <p>No priced, unassigned Orders are ready for planning.</p>}
      {rows.map(row=>{const best=row.candidates[0];return <section key={row.id} className="space-y-2 border-b border-slate-100 pb-4">
        <h3 className="font-medium">{orders.find(o=>o.id===row.order_id)?.number ?? 'Order'}</h3>
        {best ? <><p>{best.driver_name} · {best.vehicle_name}</p><ul className="text-sm text-slate-600 space-y-1">{best.facts.map(f=><li key={f}>{f}</li>)}</ul><Button type="button" disabled={busy || approved.current.has(row.id) || best.metrics?.awaiting_duty} onClick={()=>assign(row)}>{approved.current.has(row.id)?'Assigned':best.metrics?.awaiting_duty?'Awaiting On Duty':'Approve assignment'}</Button></>:<p className="text-sm text-amber-800">{row.excluded[0]?.reason ?? 'No eligible driver.'}</p>}
      </section>})}
      <Button type="button" variant="outline" disabled={busy} onClick={plan}>Recalculate plan</Button>
    </DialogBody>
  </Dialog>}</>;
}
