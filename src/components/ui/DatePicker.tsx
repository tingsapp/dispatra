import React, { useState } from 'react';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from './calendar';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';
import { formatDateValue, parseDateValue } from '../../lib/dateValues';

interface DatePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  'aria-label': string;
  id?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTomorrow?: boolean;
  today?: string;
}

/** shadcn/ui date picker: a Calendar inside a portalled Radix Popover. */
export function DatePicker({
  value, onValueChange, 'aria-label': label, id, placeholder = 'Pick a date',
  clearable = true, disabled = false, className, align = 'start',
  open: controlledOpen, onOpenChange, showTomorrow = false, today: todayValue,
}: DatePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const selected = parseDateValue(value);
  const today = parseDateValue(todayValue ?? '') ?? new Date();
  const changeOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const selectDate = (date: Date) => {
    onValueChange(formatDateValue(date));
    changeOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`${label}: ${selected ? format(selected, 'PPP') : placeholder}`}
          className={cn('h-9 w-full min-w-0 justify-start rounded-lg border-slate-200 px-3 text-xs font-medium text-slate-800', !selected && 'text-slate-500 font-normal', className)}
        >
          <CalendarIcon className="size-4 shrink-0 text-slate-500" />
          <span className="truncate">{selected ? format(selected, 'MMM d, yyyy') : placeholder}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto max-w-[calc(100vw-1rem)] p-0" aria-label={`${label} calendar`}>
        <Calendar mode="single" selected={selected} defaultMonth={selected ?? today} today={today} onSelect={date => date && selectDate(date)} required autoFocus />
        <div className="flex items-center gap-1 border-t border-slate-100 p-2">
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => selectDate(today)}>Today</Button>
          {showTomorrow && <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            selectDate(tomorrow);
          }}>Tomorrow</Button>}
          {clearable && <Button type="button" variant="ghost" size="sm" disabled={!value} className="ml-auto text-xs text-slate-500" onClick={() => { onValueChange(''); changeOpen(false); }}>Clear</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
