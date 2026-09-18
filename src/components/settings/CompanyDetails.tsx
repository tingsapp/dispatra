import { ImagePlus, X } from 'lucide-react';
import { useRef } from 'react';
import { cardClass, fieldClass, hintClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

const MAX_LOGO_BYTES = 200 * 1024;

/** Company identity shown on invoices and customer communication, plus the tax registration number. */
export function CompanyDetails({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  const { company } = config;
  const input = useRef<HTMLInputElement>(null);
  const readLogo = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/') || file.size > MAX_LOGO_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => patch('company', { logoDataUrl: String(reader.result ?? '') });
    reader.readAsDataURL(file);
  };
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Company Details</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">Printed on invoices and quotes, and shown to customers in their portal.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
        <div>
          <span className={labelClass}>Logo</span>
          <button type="button" onClick={() => input.current?.click()} aria-label="Upload company logo" className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-slate-400 flex items-center justify-center overflow-hidden">
            {company.logoDataUrl ? <img src={company.logoDataUrl} alt="Company logo" className="w-full h-full object-contain" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={event => { readLogo(event.target.files?.[0]); event.target.value = ''; }} />
          {company.logoDataUrl && <button type="button" onClick={() => patch('company', { logoDataUrl: '' })} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600"><X className="w-3 h-3" />Remove</button>}
          <p className={hintClass}>PNG or SVG, up to 200 KB.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="company-name" className={labelClass}>Company Name</label>
            <input id="company-name" aria-label="Company name" className={fieldClass} value={company.name} onChange={event => patch('company', { name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="company-phone" className={labelClass}>Company Phone</label>
            <input id="company-phone" aria-label="Company phone" type="tel" className={fieldClass} value={company.phone} placeholder="Main office line" onChange={event => patch('company', { phone: event.target.value })} />
            <p className={hintClass}>Printed on invoices for customers to call. Your own number is on My Profile.</p>
          </div>
          <div>
            <label htmlFor="company-email" className={labelClass}>Billing Email</label>
            <input id="company-email" aria-label="Company email" type="email" className={fieldClass} value={company.email} placeholder="billing@yourcompany.com" onChange={event => patch('company', { email: event.target.value })} />
            <p className={hintClass}>Printed on invoices and used as the sender for invoice emails.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="company-address" className={labelClass}>Address</label>
            <textarea id="company-address" aria-label="Company address" rows={2} className={fieldClass} value={company.address} placeholder="Street, city, province, postal code" onChange={event => patch('company', { address: event.target.value })} />
          </div>
        </div>
      </div>
    </div>

    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Tax Registration</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">Optional. Printed on invoices next to the GST/HST line; the tax itself is calculated from the delivery province under Billing → Taxes.</p>
      <div className="max-w-sm">
        <label htmlFor="tax-registration" className={labelClass}>Company GST/HST number</label>
        <input id="tax-registration" aria-label="Tax Registration Number" className={fieldClass} value={config.invoicing.taxRegistrationNumber} placeholder="123456789 RT0001" onChange={event => patch('invoicing', { taxRegistrationNumber: event.target.value })} />
      </div>
    </div>
  </>;
}
