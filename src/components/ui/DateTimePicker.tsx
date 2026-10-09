import React from 'react';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { organizationTime } from '../../lib/organizationWorkflows';
import { combineDateAndTime } from '../../lib/dateValues';

const nextMinute = (date: Date) => new Date((Math.floor(date.getTime() / 60000) + 1) * 60000);
const nextWallMinute = (day: string, clock: string) => new Date(Date.parse(`${day}T${clock}:00Z`) + 60000).toISOString().slice(0, 16);
export function DateTimePicker({ value, onValueChange, timeZone, 'aria-label': label, datePlaceholder, futureOnly = false, after, currentTime }: {
  value: string;
  onValueChange: (value: string) => void;
  timeZone: string;
  'aria-label': string;
  datePlaceholder?: string;
  futureOnly?: boolean;
  /** Earliest preceding event; this picker must select a later minute. */
  after?: string;
  currentTime?: Date;
}) {
  const [clockNow, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!futureOnly || currentTime) return;
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [futureOnly, currentTime]);
  const now = currentTime ?? clockNow;
  const parts = value ? organizationTime(value, timeZone) : null;
  const today = organizationTime(now, timeZone);
  const future = futureOnly ? organizationTime(nextMinute(now), timeZone) : null;
  const preceding = after ? organizationTime(after, timeZone) : null;
  const minimum = [future && `${future.day}T${future.clock}`, preceding && nextWallMinute(preceding.day, preceding.clock)]
    .filter((part): part is string => !!part).sort().at(-1);
  const minDay = minimum?.slice(0, 10);
  const minClock = (day: string) => minDay === day ? minimum!.slice(11) : '00:00';
  const selectedDay = parts?.day ?? '';
  const selectDay = (day: string) => {
    if (!day) { onValueChange(''); return; }
    const minimum = minClock(day);
    const preferred = parts?.clock ?? minimum;
    onValueChange(combineDateAndTime(day, preferred < minimum ? minimum : preferred));
  };
  return <div className="flex flex-wrap items-center gap-2">
    <div className="min-w-0 flex-1 basis-40">
      <DatePicker today={today?.day} minDate={minDay} aria-label={`${label} date`} placeholder={datePlaceholder} value={selectedDay} onValueChange={selectDay} />
    </div>
    <div className="w-44 shrink-0"><TimePicker aria-label={`${label} time`} value={parts?.clock ?? ''} disabled={!selectedDay} minTime={selectedDay && minimum ? minClock(selectedDay) : undefined} onValueChange={clock => onValueChange(combineDateAndTime(selectedDay, clock))} /></div>
  </div>;
}
