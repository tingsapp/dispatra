import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { cardClass, fieldClass, hintClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

const MAX_LOGO_BYTES = 200 * 1024;

/** Company identity shown on invoices and shipper communication. */
export function CompanyDetails({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  const { company } = config;
  const input = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const readLogo = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setLogoError('Choose a PNG or JPEG image.'); return; }
    if (file.size > MAX_LOGO_BYTES) { setLogoError('Choose an image up to 200 KB.'); return; }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => patch('company', { logoDataUrl: String(reader.result ?? '') });
    reader.readAsDataURL(file);
  };
  return <section className={`${cardClass} app-panel-plain`} aria-labelledby="company-details-heading">
    <h2 id="company-details-heading" className="app-section-title text-slate-900">Company Details</h2>
    <p className="text-xs text-slate-500 mt-0.5 mb-4">Printed on invoices and quotes, and shown to shippers in their portal.</p>
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" className="app-company-logo size-16 overflow-hidden bg-slate-100 p-0 hover:bg-slate-200"
          aria-label={company.logoDataUrl ? 'Change company logo' : 'Upload company logo'}
          title={company.logoDataUrl ? 'Change company logo' : 'Upload company logo'}
          onClick={() => input.current?.click()}>
          {company.logoDataUrl ? <img src={company.logoDataUrl} alt="Company logo" className="w-full h-full object-contain" /> : <ImagePlus aria-hidden="true" className="size-5 text-slate-400" />}
        </Button>
        <input ref={input} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={event => { readLogo(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {company.logoDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => patch('company', { logoDataUrl: '' })} aria-label="Remove company logo"><X aria-hidden="true" />Remove</Button>}
          </div>
          <p className="text-xs text-slate-500">PNG or JPEG, up to 200 KB.</p>
          {logoError && <p role="alert" className="text-xs text-rose-700">{logoError}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="company-name" className={labelClass}>Company Name</label>
          <input id="company-name" aria-label="Company name" className={fieldClass} value={company.name} onChange={event => patch('company', { name: event.target.value })} />
        </div>
        <div>
          <label htmlFor="company-phone" className={labelClass}>Company Phone</label>
          <input id="company-phone" aria-label="Company phone" aria-describedby="company-phone-hint" type="tel" className={fieldClass} value={company.phone} placeholder="Main office line" onChange={event => patch('company', { phone: event.target.value })} />
          <p id="company-phone-hint" className={hintClass}>Shown on invoices. Manage your own number in Profile.</p>
        </div>
        <div>
          <label htmlFor="company-email" className={labelClass}>Billing Email</label>
          <input id="company-email" aria-label="Company email" aria-describedby="company-email-hint" type="email" className={fieldClass} value={company.email} placeholder="billing@yourcompany.com" onChange={event => patch('company', { email: event.target.value })} />
          <p id="company-email-hint" className={hintClass}>Shown on invoices and used to send invoice emails.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="company-address" className={labelClass}>Address</label>
          <textarea id="company-address" aria-label="Company address" rows={2} className={fieldClass} value={company.address} placeholder="Street, city, province, postal code" onChange={event => patch('company', { address: event.target.value })} />
        </div>
      </div>
    </div>
  </section>;
}
