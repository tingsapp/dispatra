import { CheckCircle2, MapPin } from 'lucide-react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';
import { Select } from '../ui/Select';
import { Detail, OrderDossierSections } from './OrderDossierSections';
import { orderEditable } from '../../domain/validation';
import { orderCompletable } from './useOrderDetails';
import { ProofOfDelivery, proofAvailable } from './ProofOfDelivery';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import type { PricingContext } from '../../lib/pricingEngine';
import type { Driver, Job } from '../../types';

/** The dispatcher's order details dialog, shared by the Orders list and the Monitor. */
export function OrderDetailsDialog({ job, ctx, drivers, onClose, onReassign, onEdit, onLocate, onComplete }: {
  job: Job; ctx: PricingContext; drivers: Driver[]; onClose: () => void;
  onReassign: (job: Job, driverId: string) => void; onEdit?: (job: Job) => void; onLocate?: (job: Job) => void;
  onComplete?: (job: Job) => void;
}) {
  const requested = job.pricingInput?.preferredDriverId;
  const editable = !!onEdit && orderEditable(job);
  const slug = companySlugForCurrentPath();
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={<>
      <span>{job.jobNumber}</span>
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">{job.serviceLevel || job.jobType}</span>
      {job.pricing?.status === 'PRICED' && <span className="text-sm font-normal text-slate-600">${job.pricing.total.toFixed(2)} {job.pricing.currency}</span>}
    </>} />
    {/* One bordered section per New Order form section; inner groups are borderless grey */}
    <DialogBody className="space-y-5">
      <OrderDossierSections job={job} ctx={ctx} dispatch={<section className="rounded-xl border border-slate-200 p-5 space-y-3">
        <h4 className="app-section-title">Dispatch</h4>
        <div>
          <label className="app-label">Assigned driver</label>
          <Select aria-label="Reassign driver" className="w-full" value={job.assignedDriverId || 'unassigned'} onValueChange={(v) => onReassign(job, v)}
            options={[{ value: 'unassigned', label: '— Unassigned (Needs Dispatch) —' },
              ...drivers.map((d) => ({ value: d.id, label: `${d.name} (${d.driverNumber ?? d.id}) · ${d.statusLabel} (${d.vehicle.split(' ')[0]})${d.id === requested ? ' · Requested' : ''}` }))]} />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {requested && <Detail label="Shipper's requested driver" value={drivers.find(d => d.id === requested)?.name ?? 'Driver no longer available'}
            hint={job.assignedDriverId && job.assignedDriverId !== requested ? 'Assigned to a different driver' : null} />}
          <Detail label="Handling instructions" value={job.handlingInstructions} />
        </dl>
      </section>} />
      {slug && proofAvailable(job.lifecycleStatus) && <ProofOfDelivery slug={slug} orderId={job.id} timeZone={ctx.billing.general.timeZone} />}
    </DialogBody>
    <DialogFooter>
      {editable && <Button variant="outline" onClick={() => onEdit!(job)}>Edit order</Button>}
      {onComplete && orderCompletable(job) && <Button variant="outline" onClick={() => onComplete(job)}><CheckCircle2 /> Complete order</Button>}
      {onLocate ? <Button onClick={() => onLocate(job)}><MapPin /> Locate on Monitor</Button> : <Button onClick={onClose}>Close</Button>}
    </DialogFooter>
  </Dialog>;
}
