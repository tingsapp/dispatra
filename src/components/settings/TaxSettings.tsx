import { DESTINATION_TAX_RATES } from '../../lib/destinationTaxRates';
import { CANADIAN_PROVINCES } from '../../lib/taxAddress';
import { cardClass, fieldClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

export function TaxSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <div className="space-y-6">
    <section aria-labelledby="default-tax-rates" className={`${cardClass} space-y-3`}>
      <div><h2 id="default-tax-rates" className="text-sm font-semibold text-slate-900">Tax rates by province</h2><p className="text-xs text-slate-500 mt-1">GST/HST is added to the subtotal based on the delivery province. Edit the default rates used for new quotes, then save billing. HST already includes GST. Incomplete locations and special tax cases are flagged for review before invoicing; saved quotes keep their original tax calculation. Your GST/HST number is under Company.</p></div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table aria-label="Default destination tax rates" className="w-full text-left text-xs border-t border-slate-100">
          <thead className="bg-slate-50 text-slate-600"><tr><th scope="col" className="px-3 py-2.5 font-medium">Province / territory</th><th scope="col" className="px-3 py-2.5 font-medium">Tax</th><th scope="col" className="px-3 py-2.5 font-medium text-right">Default rate</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {Object.entries(DESTINATION_TAX_RATES).map(([province, rate]) => <tr key={province}>
              <td className="px-3 py-3">{CANADIAN_PROVINCES[province as keyof typeof CANADIAN_PROVINCES]}</td>
              <td className="px-3 py-3 whitespace-nowrap">{rate?.name ?? 'GST + QST'}</td>
              <td className={`px-3 py-3 text-right font-medium tabular-nums ${rate ? '' : 'text-amber-700'}`}>{rate ? <div className="flex items-center justify-end gap-2"><input
                type="number" min="0" max="100" step="any" required
                aria-label={`${CANADIAN_PROVINCES[province as keyof typeof CANADIAN_PROVINCES]} tax rate`}
                className={`${fieldClass} max-w-24 text-right tabular-nums`}
                value={config.destinationTaxRates[province as keyof typeof CANADIAN_PROVINCES] === undefined ? rate.ratePercent : config.destinationTaxRates[province as keyof typeof CANADIAN_PROVINCES] ?? ''}
                onChange={event => patch('destinationTaxRates', { [province]: event.target.value === '' ? null : event.target.valueAsNumber })}
              /><span>%</span></div> : 'Review required'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Quebec tax calculation is not yet supported. <a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html" target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2">View CRA rates</a></p>
    </section>
  </div>;
}
