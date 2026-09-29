import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { fieldClass, labelClass } from './BillingFields';
import { AddressAutocomplete, type SelectedAddress } from '../ui/AddressAutocomplete';

export interface CompanyIdentityValue {
  name: string;
  address: string;
  logoDataUrl: string;
}

export type CompanyIdentityChange = Partial<CompanyIdentityValue> & { selectedAddress?: SelectedAddress };

const MAX_LOGO_BYTES = 200 * 1024;

export function CompanyIdentity({ value, onChange, children }: { value: CompanyIdentityValue; onChange: (change: CompanyIdentityChange) => void; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const readLogo = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setLogoError('Choose a PNG or JPEG image.'); return; }
    if (file.size > MAX_LOGO_BYTES) { setLogoError('Choose an image up to 200 KB.'); return; }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => onChange({ logoDataUrl: String(reader.result ?? '') });
    reader.readAsDataURL(file);
  };

  return <section className="app-panel app-panel-plain space-y-5" aria-labelledby="company-identity-heading">
    <div>
      <h3 id="company-identity-heading" className="app-section-title text-slate-900">Company Identity</h3>
      <p className="text-xs text-slate-500 mt-0.5">Manage your company identity and primary contact.</p>
    </div>
    <div>
      <p className={labelClass}>Company Logo</p>
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" className="app-company-logo size-16 overflow-hidden bg-slate-100 p-0 hover:bg-slate-200"
          aria-label={value.logoDataUrl ? 'Change company logo' : 'Upload company logo'}
          title={value.logoDataUrl ? 'Change company logo' : 'Upload company logo'}
          onClick={() => input.current?.click()}>
          {value.logoDataUrl ? <img src={value.logoDataUrl} alt="Company logo" className="w-full h-full object-contain" /> : <ImagePlus aria-hidden="true" className="size-5 text-slate-400" />}
        </Button>
        <input ref={input} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={event => { readLogo(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="min-w-0 space-y-2">
          {value.logoDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ logoDataUrl: '' })} aria-label="Remove company logo"><X aria-hidden="true" />Remove</Button>}
          <p className="text-xs text-slate-500">PNG or JPEG, up to 200 KB.</p>
          {logoError && <p role="alert" className="text-xs text-rose-700">{logoError}</p>}
        </div>
      </div>
    </div>
    <div>
      <label htmlFor="company-name" className={labelClass}>Company Name</label>
      <input id="company-name" aria-label="Company name" className={fieldClass} value={value.name} onChange={event => onChange({ name: event.target.value })} />
    </div>
    {children}
    <div>
      <label htmlFor="company-address" className={labelClass}>Company Address</label>
      <AddressAutocomplete id="company-address" aria-label="Company address" className={fieldClass} value={value.address} includeCoordinates placeholder="Street, city, province, postal code" onChange={(address, selectedAddress) => onChange({ address, selectedAddress })} />
    </div>
  </section>;
}
