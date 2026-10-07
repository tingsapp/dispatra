import { useState } from 'react';
import { Building2, Shield } from 'lucide-react';
import { Field } from './ui';
import { PasswordPage } from './PasswordPage';
import { PageHeader } from '../components/layout/PageHeader';
import { CompanyIdentity } from '../components/settings/CompanyIdentity';
import { companyAddress } from '../lib/serverCompanySettings';
import { canadianAddress } from '../operations/adapters';
import { SaveSettings } from './CompanySettingsEditors';
import { useSettingsDraft } from './useSettingsDraft';

function CompanyEditor() {
  const editor = useSettingsDraft();
  const { data, account } = editor;
  return <form className="profile-company-content flex flex-1 flex-col gap-6" onSubmit={e => { e.preventDefault(); editor.save(); }}>
    <fieldset disabled={editor.pending} className="contents">
      <CompanyIdentity value={{ name: data.company_name, address: companyAddress(data), logoDataUrl: data.logo_url }} onChange={change => editor.patch({
        ...(change.name !== undefined ? { company_name: change.name } : {}),
        ...(change.address !== undefined ? { address: change.selectedAddress ? canadianAddress(change.address, undefined, change.selectedAddress) : change.address || null } : {}),
        ...(change.logoDataUrl !== undefined ? { logo_url: change.logoDataUrl } : {}),
      })}>
        <div><h4 className="app-section-title text-slate-900 mb-4">Contact Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Contact Full Name" maxLength={160} value={data.contact_name} onChange={e => editor.patch({ contact_name: e.target.value })} />
            <Field label="Email" readOnly value={account.login_id} autoComplete="username" />
            <Field label="Phone" type="tel" maxLength={50} value={data.phone} onChange={e => editor.patch({ phone: e.target.value })} />
            <Field label="Role" readOnly value="Dispatcher" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Email and role belong to your sign-in account.</p>
        </div>
      </CompanyIdentity>
    </fieldset>
    <SaveSettings editor={editor} label="Save Company" />
  </form>;
}

export function CompanyProfilePage({ initialSection = 'company' }: { initialSection?: 'company' | 'security' }) {
  const [section, setSection] = useState<'company' | 'security'>(initialSection);
  return <div className="app-page app-page-profile app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
    <PageHeader title="Profile" description="Company details and account security." />
    <div className="page-content h-12 bg-app-canvas flex items-center gap-2 shrink-0 overflow-x-auto">
      {([['company', 'Company', Building2], ['security', 'Security', Shield]] as const).map(([id, label, Icon]) =>
        <button key={id} type="button" aria-pressed={section === id} className="app-tab inline-flex items-center gap-2 whitespace-nowrap" onClick={() => setSection(id)}><Icon className="w-3.5 h-3.5" />{label}</button>)}
    </div>
    <main className="page-content flex-1 overflow-y-auto py-6 space-y-6">
      <div hidden={section !== 'company'} className={section === 'company' ? 'profile-company-content flex flex-1 flex-col' : 'hidden'}><CompanyEditor /></div>
      {section === 'security' && <PasswordPage plain />}
    </main>
  </div>;
}
