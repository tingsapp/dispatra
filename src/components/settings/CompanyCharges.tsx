import { Fuel } from 'lucide-react';
import { resolveFuelPercent } from '../../lib/billingEngine';
import { Select } from '../ui/Select';
import { cardClass, checkboxClass, labelClass, NumberField } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

/** Customer-facing line labels are fixed ("Service Fee", "Fuel Surcharge"); only the calculation is configurable. */
export function CompanyCharges({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  const centsAbove = Math.round((config.fuelSurcharge.currentFuelPrice - config.fuelSurcharge.baselineFuelPrice) * 100);
  const peggedPercent = resolveFuelPercent({ ...config, fuelSurcharge: { ...config.fuelSurcharge, enabled: true, mode: 'index_pegged' } });
  return <>
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Service Fee</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Optional customer fee shown as its own "Service Fee" line. Percentages apply to freight, vehicle surcharge and Accessorials, before fuel and tax; this is revenue, not estimated profit.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={config.serviceCharge.enabled}
            onChange={(e) => patch('serviceCharge', { enabled: e.target.checked })}
            className={checkboxClass}
          />
          Enabled
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Charge Method</label>
          <Select
            aria-label="Service charge method"
            className="w-full"
            value={config.serviceCharge.mode}
            onValueChange={(v) => patch('serviceCharge', { mode: v as typeof config.serviceCharge.mode })}
            options={[
              { value: 'percentage', label: 'Percentage' },
              { value: 'flat', label: 'Flat amount per order' }
            ]}
          />
        </div>
        {config.serviceCharge.mode === 'flat' ? <NumberField
          label="Flat Amount"
          value={config.serviceCharge.flatAmount}
          onChange={(v) => patch('serviceCharge', { flatAmount: v })}
          prefix="$"
        /> : <NumberField
          label="Percentage"
          value={config.serviceCharge.percent}
          onChange={(v) => patch('serviceCharge', { percent: v })}
          suffix="%"
          step={0.1}
        />}
        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={config.serviceCharge.taxable}
            onChange={(e) => patch('serviceCharge', { taxable: e.target.checked })}
            className={checkboxClass}
          />
          This charge is taxable
        </label>
      </div>
    </div>

    <div className={cardClass}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-slate-400" />
            Fuel Surcharge
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Shown as its own "Fuel Surcharge" line on every order. Set a fixed percentage, or let it follow the pump price so it adjusts without re-quoting customers.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={config.fuelSurcharge.enabled}
            onChange={(e) => patch('fuelSurcharge', { enabled: e.target.checked })}
            className={checkboxClass}
          />
          Enabled
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Mode</label>
          <Select
            aria-label="Fuel surcharge mode"
            className="w-full"
            value={config.fuelSurcharge.mode}
            onValueChange={(v) => patch('fuelSurcharge', { mode: v as typeof config.fuelSurcharge.mode })}
            options={[
              { value: 'fixed_percent', label: 'Fixed percentage — you set the rate' },
              { value: 'index_pegged', label: 'Follows the pump price — calculated from fuel prices' }
            ]}
          />
        </div>
        {config.fuelSurcharge.mode === 'fixed_percent' ? (
          <NumberField
            label="Default Fuel Surcharge"
            value={config.fuelSurcharge.percent}
            onChange={(v) => patch('fuelSurcharge', { percent: v })}
            suffix="%"
            step={0.1}
            hint="Added to eligible freight, vehicle surcharges and Accessorials on every order."
          />
        ) : (
          <>
            <NumberField
              label="Baseline Fuel Price"
              value={config.fuelSurcharge.baselineFuelPrice}
              onChange={(v) => patch('fuelSurcharge', { baselineFuelPrice: v })}
              prefix="$"
              suffix="/ L"
              hint="The pump price your rates were built on. At or below this price the fuel surcharge is 0%."
            />
            <NumberField
              label="Current Fuel Price"
              value={config.fuelSurcharge.currentFuelPrice}
              onChange={(v) => patch('fuelSurcharge', { currentFuelPrice: v })}
              prefix="$"
              suffix="/ L"
              hint="Today's pump price. Update it when fuel prices move; the surcharge follows automatically."
            />
            <NumberField
              label="Surcharge Increase per 1¢"
              value={config.fuelSurcharge.percentPerCentAboveBaseline}
              onChange={(v) => patch('fuelSurcharge', { percentPerCentAboveBaseline: v })}
              suffix="% per ¢"
              step={0.05}
              hint="Percentage points added to the surcharge for every 1¢ the current price is above the baseline."
            />
            <p className="sm:col-span-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {centsAbove <= 0
                ? `Current price is not above the baseline, so the fuel surcharge is 0%.`
                : `$${config.fuelSurcharge.currentFuelPrice.toFixed(2)} − $${config.fuelSurcharge.baselineFuelPrice.toFixed(2)} = ${centsAbove}¢ above baseline × ${config.fuelSurcharge.percentPerCentAboveBaseline}% = fuel surcharge of ${peggedPercent.toFixed(2)}% today.`}
            </p>
          </>
        )}
        <div className="sm:col-span-2 text-[11px] text-slate-500 space-y-1">
          <p>Fuel applies to eligible freight and service adjustments, plus eligible vehicle surcharges and accessorials. Service fees, tax and fuel itself are excluded.</p>
          <p>The order price breakdown shows the eligible amount and fuel calculation.</p>
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={config.fuelSurcharge.taxable}
            onChange={(e) => patch('fuelSurcharge', { taxable: e.target.checked })}
            className={checkboxClass}
          />
          This charge is taxable
        </label>
      </div>
    </div>
  </>;
}
