import { fromDisplayDivisor, toDisplayDivisor } from '../../lib/units';
import { cardClass, checkboxClass, NumberField } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

/** Extra Stops and Dimensional Weight: charges applied on top of every rate card's price. */
export function PricingDefaults({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Extra Stops</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Every order includes a number of stops in its price. Each stop beyond that adds an "Extra Stops" line.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Included Stops"
          value={config.general.defaultIncludedStops}
          onChange={(v) => patch('general', { defaultIncludedStops: v })}
          suffix="stops"
          step={1}
          hint="Typically 2 — one pickup and one drop-off."
        />
        <NumberField
          label="Extra Stop Charge"
          value={config.general.defaultExtraStopRate}
          onChange={(v) => patch('general', { defaultExtraStopRate: v })}
          prefix="$"
          suffix="/ stop"
          hint="Charged to the customer for each stop beyond the included count."
        />
      </div>
    </div>

    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Dimensional Weight</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Bulky, light packages take truck space out of proportion to their weight. Dimensional weight converts package size into a weight so they are not under-charged.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Dimensional Divisor"
          value={toDisplayDivisor(config.general.dimensionalDivisor, config.general)}
          onChange={(v) => patch('general', { dimensionalDivisor: fromDisplayDivisor(v, config.general) })}
          suffix={`${config.general.dimensionUnit}³/${config.general.weightUnit}`}
          step={1}
          hint="Length × width × height ÷ divisor = dimensional weight. Use the divisor your rates were agreed on; 5000 cm³/kg is common for domestic freight."
        />
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer sm:mt-6">
          <input
            type="checkbox"
            checked={config.general.dimensionalPricingEnabled}
            onChange={(e) => patch('general', { dimensionalPricingEnabled: e.target.checked })}
            className={checkboxClass}
          />
          Charge on the greater of actual or dimensional weight
        </label>
      </div>
    </div>
  </>;
}
