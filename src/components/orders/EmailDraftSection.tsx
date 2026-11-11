import type { ReactNode } from 'react';
import { ChevronDown, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { EmailIntakeDetail } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';

export function EmailDraftSection({ email, timeZone, actions }: { email: EmailIntakeDetail; timeZone: string; actions?: ReactNode }) {
  return <div className="mt-5 space-y-4">
    <section className="app-panel space-y-3" aria-label="Draft review">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Draft</span>
        {email.sender_verified ? <span className="inline-flex items-center gap-1 text-slate-600"><ShieldCheck className="size-4" />Sender verified</span>
          : !email.shipper_id && <span className="inline-flex items-center gap-1 text-amber-700"><ShieldAlert className="size-4" />Sender not verified</span>}
      </div>
      {email.summary && <p className="text-sm text-slate-700">{email.summary}</p>}
      {!!email.missing.length && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <h4 className="font-medium">Needed before this can become an order</h4>
        <ul className="mt-1 list-disc pl-5">{email.missing.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {email.completion_submitted_at && <p className="text-xs text-slate-600">The shipper has submitted their details for your review.</p>}
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </section>
    <details className="app-panel group/email">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
      <span className="app-section-title flex items-center gap-2"><Mail className="size-4" />Original email</span>
      <ChevronDown className="size-4 text-slate-400 transition-transform group-open/email:rotate-180" />
    </summary>
    <div className="mt-4 space-y-3 text-sm">
      <dl className="space-y-1 text-xs text-slate-600">
        <div><dt className="inline font-medium">From: </dt><dd className="inline break-words">{email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}</dd></div>
        <div><dt className="inline font-medium">Subject: </dt><dd className="inline break-words">{email.subject}</dd></div>
        <div><dt className="inline font-medium">Received: </dt><dd className="inline">{dateTime(email.received_at, timeZone)}</dd></div>
      </dl>
      <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-slate-700">{email.body || 'No email body.'}</div>
    </div>
    </details>
  </div>;
}
