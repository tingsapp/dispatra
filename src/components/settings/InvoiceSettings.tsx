import { Select } from '../ui/Select';
import { cardClass, labelClass, NumberField } from './BillingFields';
import { BillingEditor } from './useBillingSettings';
export function InvoiceSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Invoicing Basics</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Default payment terms and quote validity.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Default Payment Terms</label>
          <Select
            aria-label="Default payment terms"
            className="w-full"
            value={config.invoicing.defaultPaymentTerms}
            onValueChange={(v) => patch('invoicing', { defaultPaymentTerms: v as any })}
            options={[
              { value: 'COD', label: 'COD — Due on delivery' },
              { value: 'NET15', label: 'Net 15 days' },
              { value: 'NET30', label: 'Net 30 days' },
              { value: 'NET45', label: 'Net 45 days' }
            ]}
          />
        </div>

        <NumberField
          label="Quote Validity"
          value={config.invoicing.quoteValidityDays}
          onChange={(v) => patch('invoicing', { quoteValidityDays: v })}
          suffix="days"
          step={1}
          hint="Saved quotes expire after this period. Expired unassigned quotes require repricing."
        />

      </div>
    </div>

  </>;
}
