import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { formatDateValue, parseDateValue } from '../../lib/dateValues';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export type OrderDateSelection =
  | { kind: 'all' }
  | { kind: 'day'; date: string }
  | { kind: 'range'; from: string; to: string };

interface OrderDateFilterProps {
  value: OrderDateSelection;
  onValueChange: (value: OrderDateSelection) => void;
  today?: string;
}

export function OrderDateFilter({ value, onValueChange, today: todayValue }: OrderDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = parseDateValue(todayValue ?? '') ?? new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = formatDateValue(today);
  const tomorrowKey = formatDateValue(tomorrow);
  const label = value.kind === 'all' ? 'All dates'
    : value.kind === 'day' ? value.date === todayKey ? 'Today' : value.date === tomorrowKey ? 'Tomorrow' : format(parseDateValue(value.date)!, 'MMM d, yyyy')
    : `${format(parseDateValue(value.from)!, 'MMM d, yyyy')} – ${format(parseDateValue(value.to)!, 'MMM d, yyyy')}`;

  const select = (next: OrderDateSelection) => {
    onValueChange(next);
    setOpen(false);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setShowRange(value.kind === 'range');
      setDraft(value.kind === 'range' ? { from: parseDateValue(value.from), to: parseDateValue(value.to) } : undefined);
    }
  };

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" aria-label={`Filter orders by date: ${label}`} className="app-field-trigger w-auto min-w-0 justify-start gap-2 px-3 font-normal text-slate-800">
        <CalendarDays className="size-4 shrink-0 text-slate-500" />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-auto max-w-[calc(100vw-1rem)] p-2" aria-label="Order date filter">
      <div className="grid grid-cols-2 gap-1">
        <Button type="button" variant="ghost" size="sm" aria-pressed={value.kind === 'day' && value.date === todayKey} onClick={() => select({ kind: 'day', date: todayKey })}>Today</Button>
        <Button type="button" variant="ghost" size="sm" aria-pressed={value.kind === 'day' && value.date === tomorrowKey} onClick={() => select({ kind: 'day', date: tomorrowKey })}>Tomorrow</Button>
        <Button type="button" variant="ghost" size="sm" aria-pressed={value.kind === 'all'} onClick={() => select({ kind: 'all' })}>All dates</Button>
        <Button type="button" variant="ghost" size="sm" aria-pressed={showRange} onClick={() => setShowRange(true)}>Date range</Button>
      </div>
      {showRange && <>
        <Calendar mode="range" selected={draft} onSelect={setDraft} defaultMonth={draft?.from ?? today} today={today} />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <span className="text-xs text-slate-500">Select start and end dates</span>
          <Button type="button" size="sm" disabled={!draft?.from || !draft?.to} onClick={() => {
            if (draft?.from && draft.to) select({ kind: 'range', from: formatDateValue(draft.from), to: formatDateValue(draft.to) });
          }}>Apply range</Button>
        </div>
      </>}
    </PopoverContent>
  </Popover>;
}
