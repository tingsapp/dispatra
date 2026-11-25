import { cardClass, fieldClass, hintClass, labelClass } from './BillingFields';

export const extraTimeError = (minutes: number, amount: string) =>
  !Number.isInteger(minutes) || minutes < 5 || minutes > 480 ? 'Enter whole minutes from 5 to 480.'
    : amount.trim() === '' || !(Number(amount) >= 0) ? 'Enter a charge of $0 or more.' : null;

/** Waiting at a stop: the first `minutes` are free, then each started `minutes` adds `amount`; $0 turns it off. */
export function ExtraTimeSettings({ minutes, amount, onChange }: { minutes: number; amount: string; onChange: (change: { minutes?: number; amount?: string }) => void }) {
  const valid = !extraTimeError(minutes, amount);
  const charge = Number(amount);
  return <section aria-label="Extra time" className={`${cardClass} app-panel-plain space-y-4`}>
    <div>
      <h2 className="app-section-title text-slate-900">Extra time</h2>
      <p id="extra-time-help" className="text-xs text-slate-500 mt-0.5">Charge for time a driver spends at a pickup or drop-off, from arrival until the stop is completed. The charge is added to the Order when it is completed.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="extra-time-minutes" className={labelClass}>Charge every (minutes)</label>
        <input id="extra-time-minutes" type="number" min="5" max="480" step="1" required aria-describedby="extra-time-help" className={fieldClass}
          value={Number.isFinite(minutes) ? minutes : ''} onChange={event => onChange({ minutes: event.target.valueAsNumber })} />
        <p className={hintClass}>The first block at each stop is free.</p>
      </div>
      <div>
        <label htmlFor="extra-time-amount" className={labelClass}>Charge per block ($)</label>
        <input id="extra-time-amount" type="number" min="0" step="0.01" required aria-describedby="extra-time-help" className={fieldClass}
          value={amount} onChange={event => onChange({ amount: event.target.value })} />
        <p className={hintClass}>Enter 0 to turn off Extra time.</p>
      </div>
    </div>
    {valid && <p role="note" className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{charge > 0
      ? `No charge for the first ${minutes} minutes at a stop, then $${charge.toFixed(2)} for each started ${minutes} minutes. Example: a ${minutes * 2.5}-minute stop costs $${(charge * 2).toFixed(2)}.`
      : 'Extra time is off. Orders are not charged for time at stops.'}</p>}
  </section>;
}
