import { useId, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { DatePicker } from '../ui/DatePicker';
import { parseDateValue } from '../../lib/dateValues';
import { cardClass, labelClass } from './BillingFields';
import { sortHolidays, todayIn, type Holiday } from '../../lib/operatingCalendar';

export function HolidaySettings({ holidays, timeZone, onChange }: { holidays: Holiday[]; timeZone: string; onChange: (holidays: Holiday[]) => void }) {
  const dateId = useId(), nameId = useId();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const today = todayIn(timeZone);
  const duplicate = holidays.some(holiday => holiday.date === date);
  const canAdd = !!date && !!name.trim() && !duplicate && holidays.length < 100;
  const upcoming = holidays.filter(holiday => holiday.date >= today).length;
  const add = () => {
    if (!canAdd) return;
    onChange(sortHolidays([...holidays, { date, name: name.trim() }]));
    setDate(''); setName('');
  };
  return <section className={`${cardClass} app-panel-plain min-w-0`} aria-labelledby="holidays-heading">
    <h2 id="holidays-heading" className="app-section-title text-slate-900">Holidays</h2>
    <p className="text-xs text-slate-500 mt-0.5">Days you're closed.{upcoming > 0 && ` ${upcoming} upcoming.`}</p>
    <div className="mt-4 grid items-end gap-3 sm:grid-cols-[11rem_1fr_auto]">
      <div>
        <label htmlFor={dateId} className={labelClass}>Date</label>
        <DatePicker id={dateId} aria-label="Holiday date" value={date} today={today} clearable={false} className="h-10 min-h-10" onValueChange={setDate} />
      </div>
      <div>
        <label htmlFor={nameId} className={labelClass}>Name</label>
        <input id={nameId} className="app-input" maxLength={160} placeholder="e.g. Christmas Day" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      </div>
      <Button type="button" variant="outline" className="h-10" disabled={!canAdd} onClick={add}><Plus aria-hidden="true" />Add</Button>
    </div>
    {duplicate && <p className="mt-2 text-xs text-slate-500">That date is already a holiday.</p>}
    {holidays.length > 0 && <div className="app-table-shell mt-4"><table className="app-table text-left" aria-label="Holidays">
      <thead><tr><th scope="col">Date</th><th scope="col">Holiday</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{holidays.map(holiday => {
        const past = holiday.date < today;
        const day = parseDateValue(holiday.date);
        return <tr key={holiday.date} className={past ? 'text-slate-400' : undefined}>
          <td className="w-48 whitespace-nowrap tabular-nums">{day ? format(day, 'EEE, MMM d, yyyy') : holiday.date}</td>
          <td>{holiday.name}{past && <span className="ml-2 text-xs">Past</span>}</td>
          <td className="w-12 text-right">
            <button type="button" aria-label={`Remove ${holiday.name}`} title={`Remove ${holiday.name}`} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => onChange(holidays.filter(item => item.date !== holiday.date))}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
          </td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}
