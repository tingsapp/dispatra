import { Select } from '../ui/Select';
import { cardClass, labelClass } from './BillingFields';
import { BillingEditor } from './useBillingSettings';
export function RegionalSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Currency & Units</h2><p className="text-xs text-slate-500 mt-1">Currency is fixed for existing rates. Display units can be changed without changing prices.</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        How distance, weight, and dimensions are captured and displayed across the organization.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Currency</label>
          <Select
            aria-label="Currency"
            disabled
            className="w-full"
            value={config.invoicing.currency}
            onValueChange={() => { }}
            options={[
              { value: 'CAD', label: 'CAD — Canadian Dollar' },
              { value: 'USD', label: 'USD — US Dollar' }
            ]}
          />
        </div>
        <div>
          <label className={labelClass}>Distance Unit</label>
          <Select
            aria-label="Distance unit"
            className="w-full"
            value={config.general.distanceUnit}
            onValueChange={(v) => patch('general', { distanceUnit: v as 'km' | 'mi' })}
            options={[
              { value: 'km', label: 'km — Kilometres' },
              { value: 'mi', label: 'mi — Miles' }
            ]}
          />
        </div>
        <div>
          <label className={labelClass}>Weight Unit</label>
          <Select
            aria-label="Weight unit"
            className="w-full"
            value={config.general.weightUnit}
            onValueChange={(v) => patch('general', { weightUnit: v as 'kg' | 'lb' })}
            options={[
              { value: 'kg', label: 'kg — Kilograms' },
              { value: 'lb', label: 'lb — Pounds' }
            ]}
          />
        </div>
        <div>
          <label className={labelClass}>Dimension Unit</label>
          <Select
            aria-label="Dimension unit"
            className="w-full"
            value={config.general.dimensionUnit}
            onValueChange={(v) => patch('general', { dimensionUnit: v as 'cm' | 'in' })}
            options={[
              { value: 'cm', label: 'cm — Centimetres' },
              { value: 'in', label: 'in — Inches' }
            ]}
          />
        </div>
      </div>
    </div>

    <div className={cardClass}><label className={labelClass}>Organization timezone</label><Select aria-label="Organization timezone" value={config.general.timeZone ?? 'America/Vancouver'} onValueChange={timeZone => patch('general', { timeZone })} options={['America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Toronto', 'America/Halifax', 'America/St_Johns', 'UTC'].map(value => ({ value, label: value.replace('America/', '').replaceAll('_', ' ') }))} /></div>
  </>;
}
