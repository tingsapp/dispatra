import { cardClass, fieldClass, hintClass, labelClass, NumberField } from './BillingFields';
import { BillingEditor } from './useBillingSettings';
export function DispatchSettings({ editor }: { editor: BillingEditor }) {
  const { config, patch } = editor;
  return <>
    <div className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-900">Dispatch</h2><p className="text-xs text-slate-500 mt-1">This limit applies in both Manual and Auto modes. Choose the dispatch mode on the Monitor.</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Assignment policy. Applies to new eligible assignments only and never changes the customer price.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label="Maximum Active Orders per Driver"
          value={config.dispatch.maxActiveOrdersPerDriver}
          onChange={(v) => patch('dispatch', { maxActiveOrdersPerDriver: v })}
          suffix="orders"
          step={1}
          min={1}
          hint="Drivers at this limit cannot receive another active order."
        />
        <div>
          <label htmlFor="dispatch-hub" className={labelClass}>Dispatch Hub</label>
          <input id="dispatch-hub" aria-label="Dispatch hub" className={fieldClass} value={config.dispatch.hubAddress} placeholder="Depot address routes start from" onChange={event => patch('dispatch', { hubAddress: event.target.value })} />
          <p className={hintClass}>V1 runs a single origin hub: routes start from and return to this address.</p>
        </div>
      </div>
    </div>
  </>;
}
