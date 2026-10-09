import type { ReactNode } from 'react';
import { Building2, MapPin, Package, Tag } from 'lucide-react';
import { PriceBreakdown } from '../pricing/PriceBreakdown';
import { formatDimension, formatWeight } from '../../lib/units';
import type { PricingContext } from '../../lib/pricingEngine';
import type { Job } from '../../types';
import type { PricingStopInput } from '../../types/pricing';
import { orderOrigin } from '../../domain/orderOrigin';
import { dateTime as formatWhen } from '../../lib/dateTimeFormat';

const priorityLabel = (p: Job['priority'] | undefined) => ({ NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' } as Record<string, string>)[p ?? 'NORMAL'] ?? 'Normal';
const trimUnit = (s: string) => s.replace(/\s\S+$/, '');
export { formatWhen };
const dossierStops = (job: Job): PricingStopInput[] => job.pricingInput?.stops ?? [
  { id: 'pu', type: 'PICKUP', label: job.pickupAddress, zoneId: null, residential: false, waitMinutes: 0 },
  { id: 'do', type: 'DROPOFF', label: job.dropoffAddress, zoneId: null, residential: false, waitMinutes: 0 }
];
const dossierAccessorials = (job: Job, ctx: PricingContext) => (job.pricingInput?.accessorials ?? []).flatMap(a => { const item = ctx.catalogue.accessorials.find(c => c.id === a.accessorialId); return item ? [item] : []; });
/** Read-only field styled like the form's label + value pairs. */
export function Detail({ label, value, hint, className = '' }: { label: string; value?: string | null; hint?: string | null; className?: string }) {
  return <div className={className}><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm text-slate-900 break-words">{value?.trim() ? value : '—'}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</dd></div>;
}

/** Order details laid out like the order form: one bordered section per form section. `dispatch` renders before the price. */
export function OrderDossierSections({ job, ctx, dispatch, showShipper = true, showMargin = true }: { job: Job; ctx: PricingContext; dispatch?: ReactNode; showShipper?: boolean; showMargin?: boolean }) {
  const units = ctx.billing.general;
  const accessorials = dossierAccessorials(job, ctx);
  const origin = orderOrigin(job);
  return <>
    <section className="rounded-xl border border-slate-200 p-5">
      <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Building2 className="w-3.5 h-3.5 text-slate-700" /><span>{showShipper ? 'Shipper & Service' : 'Service'}</span></h4>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
        {showShipper && <Detail label="Shipper" value={job.customerName} hint={job.customerPhone} />}
        <Detail label="Service" value={job.serviceLevel || job.jobType} />
        <Detail label="Priority" value={priorityLabel(job.priority)} />
        <Detail label="Order source" value={origin.label} />
        {origin.tmsReference !== null && <Detail label="TMS reference number" value={origin.tmsReference} />}
      </dl>
    </section>

    <section className="rounded-xl border border-slate-200 p-5">
      <h4 className="app-section-title flex items-center gap-1.5 mb-3"><MapPin className="w-3.5 h-3.5 text-slate-700" /><span>Stops</span></h4>
      <div className="space-y-3">
        {dossierStops(job).map((stop, i) => <div key={stop.id} className="rounded-lg bg-slate-50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{i + 1} · {stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'}</span>
            {stop.residential && <span className="text-xs text-slate-500">Residential</span>}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
            <Detail label={stop.type === 'PICKUP' ? 'Pickup address' : 'Delivery address'} value={stop.label} className={stop.zoneId ? 'sm:col-span-2' : 'sm:col-span-3'} />
            {stop.zoneId && <Detail label="Zone" value={ctx.pricing.zones.find(z => z.id === stop.zoneId)?.name ?? '—'} />}
            <Detail label="Contact name" value={stop.contactName} />
            <Detail label="Phone" value={stop.contactPhone} />
            <Detail label={stop.type === 'PICKUP' ? 'Ready at' : 'Deliver by'} value={formatWhen(stop.type === 'PICKUP' ? stop.windowStart : stop.windowEnd, units.timeZone)} />
          </dl>
        </div>)}
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 p-5">
      <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Package className="w-3.5 h-3.5 text-slate-700" /><span>Packages</span></h4>
      {job.pricingInput?.packages.length ? <div className="rounded-lg bg-slate-50 p-4 overflow-x-auto"><table aria-label="Order packages" className="app-table app-table-plain w-full">
        <thead><tr><th scope="col" className="text-left">Qty</th><th scope="col" className="text-left">Weight ({units.weightUnit})</th><th scope="col" className="text-left">L × W × H ({units.dimensionUnit})</th><th scope="col" className="text-left">Fragile</th><th scope="col" className="text-left">DG</th></tr></thead>
        <tbody>{job.pricingInput.packages.map(p => <tr key={p.id}><td>{p.quantity}</td><td>{trimUnit(formatWeight(p.weightKg, units))}</td><td>{[p.lengthCm, p.widthCm, p.heightCm].map(cm => trimUnit(formatDimension(cm, units))).join(' × ')}</td><td>{p.fragile ? 'Yes' : '—'}</td><td>{p.handlingTags?.includes('DANGEROUS_GOODS') ? 'Yes' : '—'}</td></tr>)}</tbody>
      </table></div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{job.cargoWeight ? `Cargo ${job.cargoWeight}` : 'No package details recorded.'}</p>}
    </section>

    <section className="rounded-xl border border-slate-200 p-5">
      <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Tag className="w-3.5 h-3.5 text-slate-700" /><span>Accessorials</span></h4>
      {accessorials.length ? <dl className="rounded-lg bg-slate-50 p-4 space-y-2">{accessorials.map(a => <div key={a.id} className="flex items-center justify-between gap-3 text-sm"><dt className="text-slate-800">{a.name}</dt><dd className="text-slate-500 tabular-nums">${a.rate.toFixed(2)}</dd></div>)}</dl> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No extra charges added.</p>}
    </section>

    {dispatch}

    <section className="rounded-xl border border-slate-200 p-5">
      <h4 className="app-section-title mb-3">Price</h4>
      {job.pricing
        ? <PriceBreakdown snapshot={job.pricing} variant="inline" showMargin={showMargin} title={job.pricing.stage === 'FINAL' ? 'Final price' : 'Quoted estimate'} />
        : <p className="text-sm text-slate-500">This order predates the pricing model and has no snapshot.</p>}
    </section>
  </>;
}
