import { cardClass, fieldClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

/** One organization-wide percentage; zero disables the charge. */
export function FuelChargeSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  const percent = config.fuelSurcharge.percent;
  return <section aria-label="Fuel Surcharge" className={`${cardClass} app-panel-plain space-y-4`}>
    <div>
      <h2 className="app-section-title text-slate-900">Fuel Surcharge</h2>
      <p id="fuel-charge-help" className="text-xs text-slate-500 mt-0.5">Applied to eligible delivery charges before tax. Enter 0 to disable. Review the rate monthly.</p>
    </div>
    <div className="max-w-sm">
      <label htmlFor="fuel-charge-percent" className={labelClass}>Fuel surcharge (%)</label>
      <input id="fuel-charge-percent" type="number" min="0" step="any" required
        aria-describedby="fuel-charge-help" className={fieldClass}
        value={Number.isFinite(percent) ? percent : ''}
        onChange={event => patch('fuelSurcharge', { percent: event.target.valueAsNumber, mode: 'fixed_percent', enabled: event.target.valueAsNumber > 0 })} />
    </div>
  </section>;
}
