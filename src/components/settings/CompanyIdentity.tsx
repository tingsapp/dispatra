import { type ReactNode } from 'react';
import { LogoUpload } from './LogoUpload';
import { fieldClass, labelClass } from './BillingFields';
import { AddressAutocomplete, type SelectedAddress } from '../ui/AddressAutocomplete';

export interface CompanyIdentityValue {
  name: string;
  address: string;
  logoDataUrl: string;
}

export type CompanyIdentityChange = Partial<CompanyIdentityValue> & { selectedAddress?: SelectedAddress };

export function CompanyIdentity({ value, onChange, children }: { value: CompanyIdentityValue; onChange: (change: CompanyIdentityChange) => void; children?: ReactNode }) {
  return <section className="app-panel app-panel-plain space-y-5" aria-labelledby="company-identity-heading">
    <div>
      <h3 id="company-identity-heading" className="app-section-title text-slate-900">Company Identity</h3>
      <p className="text-xs text-slate-500 mt-0.5">Manage your company identity and primary contact.</p>
    </div>
    <LogoUpload value={value.logoDataUrl} onChange={logoDataUrl => onChange({ logoDataUrl })} />
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
