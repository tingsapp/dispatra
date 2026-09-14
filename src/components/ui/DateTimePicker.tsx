import React from 'react';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { organizationTime } from '../../lib/organizationWorkflows';
import { combineDateAndTime } from '../../lib/dateValues';

export function DateTimePicker({ value, onValueChange, timeZone, 'aria-label': label }: {
  value: string;
  onValueChange: (value: string) => void;
  timeZone: string;
  'aria-label': string;
}) {
  const parts = value ? organizationTime(value, timeZone) : null;
  return <div className="flex flex-wrap items-center gap-2">
    <div className="min-w-0 flex-1 basis-40">
      <DatePicker today={organizationTime(new Date(), timeZone)?.day} aria-label={`${label} date`} value={parts?.day ?? ''} onValueChange={day => onValueChange(combineDateAndTime(day, parts?.clock ?? '00:00'))} />
    </div>
    <TimePicker aria-label={`${label} time`} value={parts?.clock ?? ''} disabled={!parts?.day} onValueChange={clock => onValueChange(combineDateAndTime(parts?.day ?? '', clock))} />
  </div>;
}
