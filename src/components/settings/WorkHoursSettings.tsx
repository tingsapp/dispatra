import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { cardClass } from './BillingFields';
import { clockLabel, DAY_NAMES, isInvalidWorkDay, type WorkDay } from '../../lib/operatingCalendar';

// Half-hour steps; closing adds 24:00 (stored as 23:59). A saved off-step time stays selectable.
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const timeOptions = (value: string, after?: string) => {
  const times = after === undefined ? HALF_HOURS : [...HALF_HOURS.slice(1), '23:59'];
  return (times.includes(value) ? times : [...times, value].sort()).map(time => ({ value: time, label: clockLabel(time), disabled: !!after && time <= after }));
};

export function WorkHoursSettings({ days, timeZone, onChange }: { days: WorkDay[]; timeZone: string; onChange: (days: WorkDay[]) => void }) {
  const update = (index: number, change: Partial<WorkDay>) => onChange(days.map((day, i) => i === index ? { ...day, ...change } : day));
  return <section className={`${cardClass} app-panel-plain min-w-0`} aria-labelledby="work-hours-heading">
    <h2 id="work-hours-heading" className="app-section-title text-slate-900">Work hours</h2>
    <p className="text-xs text-slate-500 mt-0.5">When pickups can be booked, in {timeZone.replace('America/', '').replaceAll('_', ' ')} time.</p>
    <div className="app-table-shell mt-3"><table className="app-table app-table-plain text-left" aria-label="Work hours by day">
      <thead><tr><th scope="col">Day</th><th scope="col">Open</th><th scope="col">Hours</th></tr></thead>
      <tbody>{days.map((day, index) => {
        const name = DAY_NAMES[day.day];
        const start = day.start ?? '06:00', end = day.end ?? '19:00';
        return <tr key={day.day}>
          <td className="h-[3.25rem] w-36 font-medium text-slate-800">{name}</td>
          <td className="w-20"><Switch checked={day.open} aria-label={`Open on ${name}`} onCheckedChange={open => update(index, { open })} /></td>
          <td>{day.open
            ? <div className="flex items-center gap-2">
              <Select aria-label={`${name} opens`} className="w-24 tabular-nums" value={start} options={timeOptions(start)} onValueChange={value => update(index, { start: value })} />
              <span className="text-slate-400" aria-hidden="true">–</span>
              <Select aria-label={`${name} closes`} className="w-24 tabular-nums" value={end} options={timeOptions(end, start)} onValueChange={value => update(index, { end: value })} />
              {isInvalidWorkDay(day) && <span role="alert" className="text-xs text-red-700">Closes before it opens</span>}
            </div>
            : <span className="text-slate-400">Closed</span>}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
