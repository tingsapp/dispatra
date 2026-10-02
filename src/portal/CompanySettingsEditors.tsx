import { Button, Field, Notice } from './ui';
import { useSettingsDraft } from './useSettingsDraft';
import { TaxSettings } from '../components/settings/TaxSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';
import { INITIAL_BILLING_CONFIG } from '../lib/billingStorage';
import { companySettingsBilling } from '../lib/serverCompanySettings';
import type { BillingConfig } from '../types/billing';

/** Live company-settings editors for the Settings Taxes and Preferences tabs. */
function useBillingDraft(editor: ReturnType<typeof useSettingsDraft>) {
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
  return { config, patch };
}

export function TaxEditor() {
  const editor = useSettingsDraft();
  const { data } = editor;
  const { config, patch } = useBillingDraft(editor);
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); editor.save(); }}>
    <fieldset disabled={editor.pending} className="app-sections">
      <section className="app-panel app-panel-plain space-y-4"><h2 className="app-section-title">Tax Registration</h2>
        <div className="max-w-md"><Field label="GST/HST Registration Number" maxLength={100} value={data.tax_registration_number} onChange={e => editor.patch({ tax_registration_number: e.target.value })} /><p className="mt-1 text-xs text-slate-500">Optional. Printed on invoices.</p></div>
      </section>
      <TaxSettings editor={{ config, patch }} />
    </fieldset>
    <SaveSettings editor={editor} label="Save Taxes" />
  </form>;
}

export function SaveSettings({ editor, label }: { editor: ReturnType<typeof useSettingsDraft>; label: string }) {
  return <div className="mt-auto space-y-3">
    <Notice error={editor.error} success={editor.saved ? 'Changes saved.' : undefined} />
    <div className="flex items-center justify-end gap-3">
      {!!editor.error && <Button type="button" variant="outline" disabled={editor.pending} onClick={editor.reload}>Reload saved settings</Button>}
      <Button type="submit" disabled={!editor.dirty || editor.pending} className="app-action app-primary rounded-full px-4 py-2 text-xs">{editor.pending ? 'Saving…' : label}</Button>
    </div>
  </div>;
}

export function PreferencesEditor() {
  const editor = useSettingsDraft();
  const { config, patch } = useBillingDraft(editor);
  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); editor.save(); }}>
    <fieldset disabled={editor.pending} className="app-sections"><RegionalSettings editor={{ config, patch }} /></fieldset>
    <SaveSettings editor={editor} label="Save Preferences" />
  </form>;
}
