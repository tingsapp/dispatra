import React from 'react';
import { X } from 'lucide-react';
import { Select } from './Select';

const hours = Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }));
const minutes = Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }));

export function TimePicker({ value, onValueChange, 'aria-label': label, disabled = false, clearable = false, minTime }: {
  value: string;
  onValueChange: (value: string) => void;
  'aria-label': string;
  disabled?: boolean;
  clearable?: boolean;
  minTime?: string;
}) {
  const [hour = '', minute = ''] = value.split(':');
  const allowed = (h: string, m: string) => !minTime || `${h}:${m}` >= minTime;
  const hourOptions = hours.map(option => ({ ...option, disabled: !minutes.some(item => allowed(option.value, item.value)) }));
  const minuteOptions = minutes.map(option => ({ ...option, disabled: !!hour && !allowed(hour, option.value) }));
  return <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label={`${label} (24-hour)`}>
    <Select aria-label={`${label} hours`} className="w-full" value={hour} placeholder="HH" disabled={disabled} options={hourOptions} onValueChange={next => { const valid = minutes.filter(item => allowed(next, item.value)); onValueChange(`${next}:${valid.some(item => item.value === minute) ? minute : valid[0]?.value ?? '00'}`); }} />
    <span className="text-slate-400">:</span>
    <Select aria-label={`${label} minutes`} className="w-full" value={minute} placeholder="mm" disabled={disabled || !hour && !!minTime} options={minuteOptions} onValueChange={next => onValueChange(`${hour || '00'}:${next}`)} />
    {clearable && value && <button type="button" aria-label={`Clear ${label}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => onValueChange('')}><X className="h-3.5 w-3.5" /></button>}
  </div>;
}
