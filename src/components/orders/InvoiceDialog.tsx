import { useState } from 'react';
import { Send } from 'lucide-react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';
import { Detail } from './OrderDossierSections';
import { PriceBreakdown } from '../pricing/PriceBreakdown';
import type { Job } from '../../types';

/** Invoice a completed order: review the bill-to and price, then Send creates the invoice for the shipper and emails it. */
export function InvoiceDialog({ job, onClose, onSend }: {
  job: Job; onClose: () => void; onSend: (job: Job, actualMinutes: number | null) => Promise<boolean>;
}) {
  const hourly = job.pricing?.method === 'HOURLY';
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const actual = minutes.trim() ? Number(minutes) : null;
  const invalid = actual !== null && (!Number.isInteger(actual) || actual < 1 || actual > 10080);
  const send = async () => { setBusy(true); try { if (await onSend(job, actual)) onClose(); } finally { setBusy(false); } };
  return <Dialog size="md" onClose={onClose}>
    <DialogHeader onClose={onClose} title={`Invoice ${job.jobNumber}`} description="Review the invoice. Send issues it to the shipper's Invoices page and emails their billing contact." />
    <DialogBody className="space-y-5">
      <section className="rounded-xl border border-slate-200 p-5 space-y-3">
        <h4 className="app-section-title">Bill to</h4>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Detail label="Shipper" value={job.customerName} />
          <Detail label="Email" value={job.customerEmail} />
          <Detail label="Order" value={job.jobNumber} />
          <Detail label="Service" value={job.serviceLevel || job.jobType} />
        </dl>
      </section>
      {hourly && <section className="rounded-xl border border-slate-200 p-5 space-y-2">
        <h4 className="app-section-title">Billable time</h4>
        <label className="block"><span className="app-label">Actual billable minutes</span>
          <input type="number" min={1} max={10080} step={1} inputMode="numeric" className="app-input w-full" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="From driver arrival and delivery times" /></label>
        <p className="text-xs text-slate-500">Leave empty to use the times recorded by the driver.</p>
        {invalid && <p role="alert" className="text-xs text-red-700">Enter whole minutes between 1 and 10080.</p>}
      </section>}
      {job.pricing && <PriceBreakdown snapshot={job.pricing} variant="inline" title={hourly ? 'Price (final total is settled on Send)' : 'Invoice total'} />}
    </DialogBody>
    <DialogFooter>
      <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={send} disabled={busy || invalid}><Send /> {busy ? 'Sending…' : 'Send'}</Button>
    </DialogFooter>
  </Dialog>;
}
