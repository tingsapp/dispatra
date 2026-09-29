import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ReceiptText, Shield } from 'lucide-react';
import { api } from './api';
import { companySettingsKey, useWorkspaceAccount, type SettingsView } from './WorkspaceAccount';
import { Button, Field, Notice, useOperationKey } from './ui';
import { PasswordPage } from './PasswordPage';
import { PageHeader } from '../components/layout/PageHeader';
import { CompanyIdentity } from '../components/settings/CompanyIdentity';
import { TaxSettings } from '../components/settings/TaxSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';
import { useSettingsGuard } from '../components/settings/useSettingsGuard';
import { INITIAL_BILLING_CONFIG } from '../lib/billingStorage';
import { companyAddress, companySettingsBilling } from '../lib/serverCompanySettings';
import type { BillingConfig } from '../types/billing';
import { canadianAddress } from '../operations/adapters';

function useSettingsDraft() {
  const workspace = useWorkspaceAccount()!;
  const { settings, account } = workspace;
  const [baseline, setBaseline] = useState(settings);
  const [data, setData] = useState(settings.data);
  const [error, setError] = useState<unknown>();
  const dirty = JSON.stringify(data) !== JSON.stringify(baseline.data);
  const cache = useQueryClient();
  const key = useOperationKey();
  useSettingsGuard(dirty);
  const reset = (saved: SettingsView) => { setBaseline(saved); setData(saved.data); };
  useEffect(() => { if (!dirty && settings.version !== baseline.version) reset(settings); }, [settings, dirty, baseline.version]);
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { version: baseline.version, data: { ...data,
        gst_percent: !data.gst_enabled && data.gst_percent === '' ? '0' : data.gst_percent,
        provincial_percent: !data.provincial_enabled && data.provincial_percent === '' ? '0' : data.provincial_percent,
      } };
      return api.saveCompanySettings(account.organization!.slug, payload, key(payload));
    },
    onSuccess: saved => {
      reset(saved);
      cache.setQueryData(companySettingsKey(account.organization!.slug), saved);
      void cache.invalidateQueries({ queryKey: ['account'] });
    },
  });
  return { account, data, dirty, pending: mutation.isPending,
    patch: (change: Partial<typeof data>) => { setData(old => ({ ...old, ...change })); setError(undefined); mutation.reset(); },
    save: () => { setError(undefined); mutation.mutate(); },
    error: error || mutation.error,
    saved: mutation.isSuccess && !dirty,
    reload: async () => { try { reset(await workspace.reload()); setError(undefined); mutation.reset(); } catch (e) { setError(e); } },
  };
}

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

function TaxEditor() {
  const editor = useSettingsDraft();
  const { data } = editor;
  const config = companySettingsBilling(data, INITIAL_BILLING_CONFIG);
  // Keep an empty enabled rate visible so the form can validate it before submitting.
  if (data.gst_percent === '') config.companyTax.ratePercent = null;
  if (data.provincial_percent === '') config.companyTax.provincialRatePercent = null;
  const patch = <K extends keyof BillingConfig>(section: K, change: Partial<BillingConfig[K]>) => {
    const next = { ...config, [section]: { ...config[section], ...change } };
    editor.patch({
      gst_enabled: next.companyTax.enabled, gst_percent: next.companyTax.ratePercent == null ? '' : String(next.companyTax.ratePercent),
      provincial_enabled: next.companyTax.provincialEnabled, provincial_percent: next.companyTax.provincialRatePercent == null ? '' : String(next.companyTax.provincialRatePercent),
      time_zone: next.general.timeZone!, distance_unit: next.general.distanceUnit, weight_unit: next.general.weightUnit, dimension_unit: next.general.dimensionUnit,
    });
  };
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); editor.save(); }}>
    <fieldset disabled={editor.pending} className="app-sections">
      <section className="app-panel app-panel-plain space-y-4"><h2 className="app-section-title">Tax Registration</h2>
        <div className="max-w-md"><Field label="GST/HST Registration Number" maxLength={100} value={data.tax_registration_number} onChange={e => editor.patch({ tax_registration_number: e.target.value })} /><p className="mt-1 text-xs text-slate-500">Optional. Printed on invoices.</p></div>
      </section>
      <TaxSettings editor={{ config, patch }} />
      <RegionalSettings editor={{ config, patch }} />
    </fieldset>
    <SaveSettings editor={editor} label="Save Settings" />
  </form>;
}

function SaveSettings({ editor, label }: { editor: ReturnType<typeof useSettingsDraft>; label: string }) {
  return <div className="mt-auto space-y-3">
    <Notice error={editor.error} success={editor.saved ? 'Changes saved.' : undefined} />
    <div className="flex items-center justify-end gap-3">
      {!!editor.error && <Button type="button" variant="outline" disabled={editor.pending} onClick={editor.reload}>Reload saved settings</Button>}
      <Button type="submit" disabled={!editor.dirty || editor.pending} className="app-action app-primary rounded-full px-4 py-2 text-xs">{editor.pending ? 'Saving…' : label}</Button>
    </div>
  </div>;
}

export function CompanyProfilePage({ initialSection = 'company' }: { initialSection?: 'company' | 'security' | 'taxes' }) {
  const [section, setSection] = useState(initialSection);
  return <div className="app-page app-page-profile app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
    <PageHeader title="Profile" description="Company details, account security, taxes and preferences." />
    <div className="page-content h-12 bg-app-canvas flex items-center gap-2 shrink-0 overflow-x-auto">
      {([['company', 'Company', Building2], ['security', 'Security & Sessions', Shield], ['taxes', 'Taxes & Preferences', ReceiptText]] as const).map(([id, label, Icon]) =>
        <button key={id} type="button" aria-pressed={section === id} className="app-tab inline-flex items-center gap-2 whitespace-nowrap" onClick={() => setSection(id)}><Icon className="w-3.5 h-3.5" />{label}</button>)}
    </div>
    <main className="page-content flex-1 overflow-y-auto py-6 space-y-6">
      <div hidden={section !== 'company'} className={section === 'company' ? 'profile-company-content flex flex-1 flex-col' : 'hidden'}><CompanyEditor /></div>
      {section === 'security' && <PasswordPage />}
      <div hidden={section !== 'taxes'} className={section !== 'taxes' ? 'hidden' : ''}><TaxEditor /></div>
    </main>
  </div>;
}
