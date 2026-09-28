import { cardClass, checkboxClass, fieldClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

export function TaxSettings({ editor }: { editor: Pick<BillingEditor, 'config' | 'patch'> }) {
  const { config, patch } = editor;
  const { companyTax } = config;
  return <>
    <section aria-labelledby="company-tax-rate" className={`${cardClass} app-panel-plain`}>
      <h2 id="company-tax-rate" className="app-section-title text-slate-900">GST/HST</h2>
      <p id="company-tax-help" className="text-xs text-slate-500 mt-0.5 mb-4">Applies to new quotes and repriced orders when selected. Saved quotes keep their original tax.</p>
      <label htmlFor="company-tax-enabled" className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input id="company-tax-enabled" type="checkbox" className={checkboxClass} checked={companyTax.enabled}
          onChange={event => patch('companyTax', { enabled: event.target.checked })} />
        Apply GST/HST to taxable charges
      </label>
      <div className="max-w-sm mt-4">
        <label htmlFor="company-tax-percent" className={labelClass}>GST/HST rate</label>
        <div className="flex items-center gap-2">
          <input id="company-tax-percent" type="number" min="0" max="100" step="any" required={companyTax.enabled} disabled={!companyTax.enabled} aria-describedby="company-tax-help" className={fieldClass}
            value={companyTax.ratePercent ?? ''}
            onChange={event => patch('companyTax', { ratePercent: event.target.value === '' ? null : event.target.valueAsNumber })} />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </div>
    </section>
    <section aria-labelledby="provincial-tax-heading" className={`${cardClass} app-panel-plain`}>
      <h2 id="provincial-tax-heading" className="app-section-title text-slate-900">Provincial tax</h2>
      <p id="provincial-tax-help" className="text-xs text-slate-500 mt-0.5 mb-4">Optional company-wide rate for new quotes and repriced orders.</p>
      <label htmlFor="provincial-tax-enabled" className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input id="provincial-tax-enabled" type="checkbox" className={checkboxClass} checked={companyTax.provincialEnabled}
          onChange={event => patch('companyTax', { provincialEnabled: event.target.checked })} />
        Apply provincial tax to taxable charges
      </label>
      <div className="max-w-sm mt-4">
        <label htmlFor="provincial-tax-percent" className={labelClass}>Provincial tax rate</label>
        <div className="flex items-center gap-2">
          <input id="provincial-tax-percent" type="number" min="0" max="100" step="any" required={companyTax.provincialEnabled} disabled={!companyTax.provincialEnabled} aria-describedby="provincial-tax-help" className={fieldClass}
            value={companyTax.provincialRatePercent ?? ''}
            onChange={event => patch('companyTax', { provincialRatePercent: event.target.value === '' ? null : event.target.valueAsNumber })} />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </div>
    </section>
  </>;
}
