import { cardClass, fieldClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

export function TaxSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <div className="space-y-5">
    <section aria-labelledby="company-tax-rate" className={`${cardClass} app-panel-plain`}>
      <h2 id="company-tax-rate" className="app-section-title text-slate-900">Tax / GST</h2>
      <p id="company-tax-help" className="text-xs text-slate-500 mt-0.5 mb-4">One rate applies to all new quotes and repriced orders. Saved quotes keep their original tax.</p>
      <div className="max-w-sm">
        <label htmlFor="company-tax-percent" className={labelClass}>Tax / GST rate</label>
        <div className="flex items-center gap-2">
          <input id="company-tax-percent" type="number" min="0" max="100" step="any" required aria-describedby="company-tax-help" className={fieldClass}
            value={config.companyTax.ratePercent ?? ''}
            onChange={event => patch('companyTax', { ratePercent: event.target.value === '' ? null : event.target.valueAsNumber })} />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </div>
    </section>
    <section aria-labelledby="tax-registration-heading" className={`${cardClass} app-panel-plain`}>
      <h2 id="tax-registration-heading" className="app-section-title text-slate-900">Tax Registration</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">Optional. Printed on invoices with your company tax details.</p>
      <div className="max-w-sm">
        <label htmlFor="tax-registration" className={labelClass}>Company GST number</label>
        <input id="tax-registration" aria-label="Tax Registration Number" className={fieldClass} value={config.invoicing.taxRegistrationNumber} placeholder="123456789 RT0001" onChange={event => patch('invoicing', { taxRegistrationNumber: event.target.value })} />
      </div>
    </section>
  </div>;
}
