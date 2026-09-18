import { fromDisplayDistanceRate, toDisplayDistanceRate } from '../../lib/units';
import { cardClass, NumberField } from './BillingFields';
import { BillingEditor } from './useBillingSettings';

/** Internal cost estimate = vehicle km + driver time, plus an optional overhead share. Never part of the customer price. */
export function OperatingCosts({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  const unit = config.general.distanceUnit;
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Vehicle Running Cost</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        What it costs you to drive one {unit === 'mi' ? 'mile' : 'kilometre'}: fuel, tyres, maintenance and depreciation combined.
        A vehicle type can carry its own figure under Services & Dispatch → Vehicle types; this default is used for any type without one.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label={`Default Cost / ${unit}`}
          value={toDisplayDistanceRate(config.operatingCost.defaultCostPerKm, config.general)}
          onChange={(v) => patch('operatingCost', { defaultCostPerKm: fromDisplayDistanceRate(v, config.general) })}
          prefix="$"
          suffix={`/ ${unit}`}
          hint={`Multiplied by the route distance of each order. Typical van: $0.50–0.80 / ${unit}.`}
        />
      </div>
    </div>

    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Driver Cost</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Driver time is usually the largest cost on a short urban job. It is estimated as driving time plus handling time at each stop plus recorded waiting.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Driver Cost / hour"
          value={config.operatingCost.driverCostPerHour}
          onChange={(v) => patch('operatingCost', { driverCostPerHour: v })}
          prefix="$"
          suffix="/ h"
          hint="What an hour of driver time costs you: wage plus payroll taxes and benefits, not just the hourly wage."
        />
        <NumberField
          label="Driver Time per Stop"
          value={config.operatingCost.averageMinutesPerStop}
          onChange={(v) => patch('operatingCost', { averageMinutesPerStop: v })}
          suffix="min"
          step={1}
          hint="Typical minutes spent at a stop loading, unloading and getting a signature. Used when an order has no recorded handling time."
        />
      </div>
    </div>

    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Overhead</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Optional. Costs that are not tied to a single order — office, insurance, software, admin salaries — spread across jobs as a percentage of the vehicle and driver cost above.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Overhead Share"
          value={config.operatingCost.overheadPercent}
          onChange={(v) => patch('operatingCost', { overheadPercent: v })}
          suffix="%"
          step={0.5}
          hint="Leave at 0 to see margin after direct costs only. To see margin after overhead, use last year's overhead ÷ direct costs (e.g. $70k ÷ $500k = 14%)."
        />
      </div>
    </div>
  </>;
}
