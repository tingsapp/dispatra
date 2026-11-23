import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { operations, type EmailIntakeDetail } from '../../operations/api';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { useEntityDialog } from '../entities/useEntityDialog';
import { dateTime } from '../../lib/dateTimeFormat';
import { reviewMessages } from '../../lib/emailDraftReview';

export function EmailDraftSection({ email, timeZone, actions, showMissing = true }: { email: EmailIntakeDetail; timeZone: string; actions?: ReactNode; showMissing?: boolean }) {
  const missing = reviewMessages(email.missing, email.shipper_id);
  return <div className="mt-5">
    <section className="app-panel space-y-3" aria-label="Draft review">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Draft</span>
        {email.sender_verified ? <span className="inline-flex items-center gap-1 text-slate-600"><ShieldCheck className="size-4" />Sender verified</span>
          : !email.shipper_id && <span className="inline-flex items-center gap-1 text-amber-700"><ShieldAlert className="size-4" />Sender not verified</span>}
      </div>
      {email.summary && <p className="text-sm text-slate-700">{email.summary}</p>}
      {showMissing && !!missing.length && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <h4 className="font-medium">Needed before this can become an order</h4>
        <ul className="mt-1 list-disc pl-5">{missing.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {email.completion_submitted_at && <p className="text-xs text-slate-600">The shipper has submitted their details for your review.</p>}
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </section>
  </div>;
}

/** The source email belongs beside the decision panel, not below the order form. */
export function OriginalEmail({ email, timeZone }: { email: EmailIntakeDetail; timeZone: string }) {
  return <details className="group/email rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
      <span className="app-section-title flex items-center gap-2"><Mail className="size-4" />Original email</span>
      <ChevronDown className="size-4 text-slate-400 transition-transform group-open/email:rotate-180" />
    </summary>
    <EmailMessage email={email} timeZone={timeZone} className="mt-4" bodyClassName="max-h-80 overflow-y-auto" />
  </details>;
}

function EmailMessage({ email, timeZone, className = '', bodyClassName = '' }: { email: EmailIntakeDetail; timeZone: string; className?: string; bodyClassName?: string }) {
  return <div className={`space-y-3 text-sm ${className}`}>
    <dl className="space-y-1 text-xs text-slate-600">
      <div><dt className="inline font-medium">From: </dt><dd className="inline break-words">{email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}</dd></div>
      <div><dt className="inline font-medium">Subject: </dt><dd className="inline break-words">{email.subject}</dd></div>
      <div><dt className="inline font-medium">Received: </dt><dd className="inline">{dateTime(email.received_at, timeZone)}</dd></div>
    </dl>
    <div className={`whitespace-pre-wrap break-words text-slate-700 ${bodyClassName}`}>{email.body || 'No email body.'}</div>
  </div>;
}

/** The email an order was created from, opened from the order's "Order source" link above the order details. */
export function SourceEmailDialog({ slug, orderId, orderNumber, timeZone, onClose }: { slug: string; orderId: string; orderNumber?: string; timeZone: string; onClose: () => void }) {
  const email = useQuery({ queryKey: ['operations', slug, 'order-email', orderId], queryFn: () => operations.orderEmail(slug, orderId) });
  useEntityDialog(true, onClose, `Source email${orderNumber ? ` · ${orderNumber}` : ''}`);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(<Dialog size="md" zIndex="z-[160]" onClose={onClose}>
    <DialogHeader onClose={onClose} title={<span className="flex items-center gap-2"><Mail className="size-4" />Source email</span>} description={orderNumber} />
    <DialogBody>
      {email.isPending && <p role="status" className="text-sm text-slate-500">Loading email…</p>}
      {email.error && <p role="alert" className="text-sm text-red-700">{email.error instanceof Error ? email.error.message : 'Could not load the email.'}</p>}
      {email.data && <EmailMessage email={email.data} timeZone={timeZone} />}
    </DialogBody>
  </Dialog>, document.body);
}
