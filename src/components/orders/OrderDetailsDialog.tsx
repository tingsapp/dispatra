import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, MessageSquare, Truck } from 'lucide-react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';
import { usePendingAction } from '../ui/usePendingAction';
import { Select } from '../ui/Select';
import { Detail, OrderDossierSections } from './OrderDossierSections';
import { orderAssignable, orderEditable, orderLifecycle } from '../../domain/validation';
import { orderCompletable } from './useOrderDetails';
import { ProofOfDelivery, proofAvailable } from './ProofOfDelivery';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { openDispatcherChat } from '../../chat/navigation';
import type { PricingContext } from '../../lib/pricingEngine';
import type { Driver, Job } from '../../types';

/** The dispatcher's order details dialog, shared by the Orders list and the Monitor. */
export function OrderDetailsDialog({ job, ctx, drivers, onClose, onReassign, onEdit, onLocate, onComplete }: {
  job: Job; ctx: PricingContext; drivers: Driver[]; onClose: () => void;
  onReassign: (job: Job, driverId: string) => void | Promise<void>; onEdit?: (job: Job) => void; onLocate?: (job: Job) => void;
  onComplete?: (job: Job) => void | Promise<void>;
}) {
  const savedDriver = job.assignedDriverId || 'unassigned';
  const [selectedDriver, setSelectedDriver] = useState(savedDriver);
  const [saving, setSaving] = useState(false);
  const completion = usePendingAction();
  useEffect(() => { setSelectedDriver(savedDriver); }, [job.id, savedDriver]);
  const assignable = orderAssignable(job);
  const changed = selectedDriver !== savedDriver;
  const confirmAssignment = async () => {
    if (!assignable || !changed || saving) return;
    setSaving(true);
    try { await onReassign(job, selectedDriver); }
    finally { setSaving(false); }
  };
  const requested = job.pricingInput?.preferredDriverId;
  const required = job.pricingInput?.requiredDriverId;
  const editable = !!onEdit && orderEditable(job);
  const completable = !!onComplete && orderCompletable(job);
  const locatable = !!onLocate && orderLifecycle(job) !== 'COMPLETED';
  const slug = companySlugForCurrentPath();
  return <Dialog size="lg" onClose={onClose}>
    <DialogHeader onClose={onClose} title={<>
      <span>{job.jobNumber}</span>
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-app-accent-soft text-app-accent border border-app-accent/20">{job.serviceLevel || job.jobType}</span>
      {job.pricing?.status === 'PRICED' && <span className="text-sm font-normal text-slate-600">${job.pricing.total.toFixed(2)} {job.pricing.currency}</span>}
    </>} />
    {/* One bordered section per New Order form section; inner groups are borderless grey */}
    <DialogBody className="space-y-5">
      <OrderDossierSections job={job} ctx={ctx} dispatch={<section className="rounded-xl border border-slate-200 p-5 space-y-3">
        <h4 className="app-section-title flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Dispatch</h4>
        <div>
          <label className="app-label">Assigned driver</label>
          {assignable ? <>
          <Select aria-label="Reassign driver" className="w-full" value={selectedDriver} disabled={saving} onValueChange={setSelectedDriver}
            options={[{ value: 'unassigned', label: 'Unassigned (needs dispatch)' },
              ...drivers.map((d) => ({ value: d.id, disabled: !!required && d.id !== required, label: `${d.name} (${d.driverNumber ?? d.id}) · ${d.statusLabel} (${d.vehicle.split(' ')[0]})${d.id === requested ? ' · Requested' : ''}` }))]} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500" role="status">{changed ? 'Driver change ready to confirm.' : 'Select a driver, then confirm to save.'}</p>
            <Button loading={saving} size="sm" disabled={!changed || saving} onClick={confirmAssignment}>{saving ? 'Confirming…' : 'Confirm'}</Button>
          </div>
          </> : <p className="text-sm text-slate-700">{drivers.find(driver => driver.id === job.assignedDriverId)?.name ?? job.driverName ?? (job.assignedDriverId ? 'Saved driver unavailable' : 'Unassigned')}<span className="mt-1 block text-xs text-slate-500">Driver changes are unavailable after an order starts or closes.</span></p>}
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {required && <Detail label="Shipper's assigned driver" value={job.pricingInput?.requiredDriverName ?? drivers.find(d => d.id === required)?.name ?? 'Saved driver (unavailable)'} hint="This order requires this driver." />}
          {!required && requested && <Detail label="Shipper's requested driver" value={drivers.find(d => d.id === requested)?.name ?? 'Driver no longer available'}
            hint={job.assignedDriverId && job.assignedDriverId !== requested ? 'Assigned to a different driver' : null} />}
          <Detail label="Handling instructions" value={job.handlingInstructions} />
        </dl>
      </section>} />
      {slug && proofAvailable(job.lifecycleStatus) && <ProofOfDelivery slug={slug} orderId={job.id} timeZone={ctx.billing.general.timeZone} />}
      {slug && <section aria-label="Messages" className="rounded-xl border border-slate-200 p-4">
        <h4 className="app-section-title flex items-center gap-2"><MessageSquare className="size-4" />Messages</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openDispatcherChat(job.customerId ? { shipperId: job.customerId } : { orderId: job.id, kind: 'DISPATCH_SHIPPER' })}>Chat with shipper</Button>
          {job.assignedDriverId && <Button variant="outline" onClick={() => openDispatcherChat({ orderId: job.id, kind: 'DISPATCH_DRIVER', driverId: job.assignedDriverId })}>Chat with driver</Button>}
        </div>
        {!job.assignedDriverId && <p className="mt-2 text-xs text-app-muted">Driver chat is available once a driver is assigned.</p>}
      </section>}
    </DialogBody>
    {(editable || completable || locatable) && <DialogFooter>
      {editable && <Button variant="outline" onClick={() => onEdit!(job)}>Edit order</Button>}
      {completable && <Button loading={completion.pending} variant="outline" onClick={() => completion.run(() => onComplete!(job))}><CheckCircle2 /> Complete order</Button>}
      {locatable && <Button onClick={() => onLocate!(job)}><MapPin /> Locate on Monitor</Button>}
    </DialogFooter>}
  </Dialog>;
}
