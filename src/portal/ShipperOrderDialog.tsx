import { useState } from 'react';
import { Dialog, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/Select';
import { companyRateRows } from '../lib/companyTax';
import { OrderPricingForm } from '../components/pricing/OrderPricingForm';
import { PriceBreakdown } from '../components/pricing/PriceBreakdown';
import { useOrderPreview } from '../components/orders/useOrderPreview';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { operations, type Order } from '../operations/api';
import { inputToShipperBooking } from '../operations/orderAdapters';
import type { PricingContext } from '../lib/pricingEngine';
import type { PricingOrderInput } from '../types/pricing';

type BookingDriver = { id: string; name: string };

/** The dispatcher's order form for the signed-in shipper: no shipper, rate card choice, vehicle, assignment or internal notes.
 *  The shipper may name an optional preferred driver; their own rate card prices the order and is named in the live estimate. */
export function ShipperOrderDialog({ slug, ctx, initial, editing, drivers, rateCardName, onClose, onSaved }: {
  slug: string; ctx: PricingContext; initial: PricingOrderInput; editing?: Order; drivers: BookingDriver[]; rateCardName: string | null;
  onClose: () => void; onSaved: (order: Order, created: boolean) => void;
}) {
  const [input, setInput] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const timeZone = ctx.billing.general.timeZone;
  const snapshot = useOrderPreview({ slug, input, ctx, enabled: true, toBooking: value => inputToShipperBooking(value, timeZone), rateCardName });
  const close = () => { if (!busy) onClose(); };
  const requested = input.preferredDriverId ?? '';
  const driverOptions = [{ value: '', label: 'No preference' }, ...drivers.map(d => ({ value: d.id, label: d.name })),
    ...(requested && !drivers.some(d => d.id === requested) ? [{ value: requested, label: 'Previously requested driver (unavailable)' }] : [])];
  const serviceExtras = <div>
      <label className="app-label">Want specific driver?</label>
      <Select aria-label="Want specific driver?" className="w-full" value={requested} onValueChange={v => setInput({ ...input, preferredDriverId: v || null })} options={driverOptions} />
      <span className="mt-1 block text-xs text-slate-500">Optional. Dispatch uses this driver when they are available.</span>
    </div>;
  useEntityDialog(true, close);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setErrors([]); setBusy(true);
    try {
      const booking = inputToShipperBooking(input, timeZone);
      const saved = editing ? await operations.updateOrder(slug, editing, booking) : await operations.createOrder(slug, booking);
      onSaved(saved, !editing);
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Could not save order.']); }
    finally { setBusy(false); }
  };
  return <Dialog size="xl" onClose={close}>
    <DialogHeader onClose={close} title={editing ? 'Edit Order' : 'New Order'} description="Enter the order details on the left to see its live price estimate on the right." />
    <form id="shipper-order-form" onSubmit={submit} className="app-dialog-body bg-slate-50 pt-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-5 text-xs">
          {!!errors.length && <p role="alert" className="text-xs text-rose-700">{errors.join(' ')}</p>}
          <OrderPricingForm customerMode="self" showVehicleSelection={false} showStopAddresses startIndex={1} value={input} onChange={setInput} ctx={ctx} snapshot={snapshot} serviceExtras={serviceExtras} />
        </div>
        <div className="lg:col-span-5 lg:sticky lg:top-0">
          <PriceBreakdown snapshot={snapshot} title="Live estimate" showMargin={false} showPricingDetail={false} rateRows={companyRateRows(ctx.billing)} />
        </div>
      </div>
    </form>
    <DialogFooter note={snapshot.status === 'PRICED' ? 'The estimate is frozen on the order as a Pricing Snapshot.' : 'The order can be created, but it will need a pricing review before dispatch.'}>
      <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button>
      <Button type="submit" form="shipper-order-form" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Order' : 'Create Order'}</Button>
    </DialogFooter>
  </Dialog>;
}
