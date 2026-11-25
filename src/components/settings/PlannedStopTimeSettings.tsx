import { cardClass, fieldClass, hintClass, labelClass } from './BillingFields';

export type StopMinutesKey = 'stop_minutes_small_parcel' | 'stop_minutes_ltl' | 'stop_minutes_ftl';
const FIELDS: [StopMinutesKey, string][] = [['stop_minutes_small_parcel', 'Small parcel'], ['stop_minutes_ltl', 'LTL'], ['stop_minutes_ftl', 'Full truckload (FTL)']];
export const stopMinutesInvalid = (values: Record<StopMinutesKey, number>) => FIELDS.some(([key]) => !Number.isInteger(values[key]) || values[key] < 0 || values[key] > 480);

/** Planned time at each pickup and drop-off by load size: routes, Hourly prices and stop progress questions use it. */
export function PlannedStopTimeSettings({ values, onChange }: { values: Record<StopMinutesKey, number>; onChange: (change: Partial<Record<StopMinutesKey, number>>) => void }) {
  return <section className={`${cardClass} app-panel-plain`} aria-labelledby="planned-stop-time-heading">
    <h2 id="planned-stop-time-heading" className="app-section-title text-slate-900">Planned stop time</h2>
    <p className="text-xs text-slate-500 mt-0.5 mb-4">Minutes a driver is expected to spend at each pickup and drop-off. Routes and Hourly prices include it, and the driver is asked for a progress update once a stop runs longer. Applies to new and edited orders.</p>
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
      {FIELDS.map(([key, label]) => <div key={key}>
        <label htmlFor={key} className={labelClass}>{label} (minutes)</label>
        <input id={key} type="number" min="0" max="480" step="1" required className={fieldClass}
          value={Number.isFinite(values[key]) ? values[key] : ''} onChange={event => onChange({ [key]: event.target.valueAsNumber })} />
      </div>)}
    </div>
    {stopMinutesInvalid(values) && <p role="alert" className={`${hintClass} text-red-600`}>Enter whole minutes from 0 to 480.</p>}
  </section>;
}
