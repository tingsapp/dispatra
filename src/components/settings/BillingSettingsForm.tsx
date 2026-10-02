import { Button } from '../ui/button';
import { RegionalSettings } from './RegionalSettings';
import { cardClass, fieldClass, labelClass } from './BillingFields';
import { TaxSettings } from './TaxSettings';
import { FuelChargeSettings } from './FuelChargeSettings';
import { useBillingSettings } from './useBillingSettings';

const SAVE_LABELS = { taxes: 'Taxes', preferences: 'Preferences', fuel: 'Fuel Surcharge' } as const;
export function BillingSettingsForm({ section, onNotification }: { section: keyof typeof SAVE_LABELS; onNotification?: (message: string) => void }) {
  const editor = useBillingSettings(onNotification);
  return <form noValidate={section === 'taxes'} onSubmit={event => { event.preventDefault(); editor.handleSave(); }} className={`space-y-5 ${section === 'fuel' ? 'w-full max-w-2xl' : ''}`}>
    {section === 'taxes' && <div className="app-sections">
      <section className={`${cardClass} app-panel-plain`} aria-labelledby="tax-registration-heading">
        <h2 id="tax-registration-heading" className="app-section-title text-slate-900">Tax Registration</h2>
        <div className="mt-4 max-w-md">
          <label htmlFor="tax-registration" className={labelClass}>GST/HST Registration Number</label>
          <input id="tax-registration" type="text" aria-label="GST/HST registration number" className={fieldClass}
            value={editor.config.invoicing.taxRegistrationNumber} placeholder="123456789 RT0001"
            onChange={event => editor.patch('invoicing', { taxRegistrationNumber: event.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Optional. Printed on invoices.</p>
        </div>
      </section>
      <TaxSettings editor={editor} />
    </div>}
    {section === 'preferences' && <div className="app-sections"><RegionalSettings editor={editor} /></div>}
    {section === 'fuel' && <FuelChargeSettings editor={editor} />}
    {editor.saveError && <p role="alert" className="text-sm text-red-600">{editor.saveError}</p>}
    <div className={`flex items-center justify-end gap-3 ${section === 'fuel' ? 'flex-row-reverse flex-wrap' : ''}`}>
      <span role="status" className="text-xs text-slate-500">{editor.isSaved && !editor.dirty ? 'Settings saved' : ''}</span>
      <Button type="submit" disabled={!editor.dirty} className="app-action app-primary rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">Save {SAVE_LABELS[section]}</Button>
    </div>
  </form>;
}
