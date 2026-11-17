import type { components } from '../portal/schema';

/** Company work hours and holidays, mirroring the API settings contract. */
export type WorkDay = components['schemas']['WorkDay'];
export type Holiday = components['schemas']['Holiday'];

export const DAY_NAMES: Record<WorkDay['day'], string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

/** Hours of a company that has not saved its own, matching the API default; 23:59 means midnight. */
export const DEFAULT_WORK_HOURS: WorkDay[] = (Object.keys(DAY_NAMES) as WorkDay['day'][])
  .map(day => ({ day, open: true, start: '06:00', end: '19:00' }));

export const clockLabel = (time: string) => time === '23:59' ? '24:00' : time;

export const isInvalidWorkDay = (day: WorkDay) => day.open && (day.end ?? '19:00') <= (day.start ?? '06:00');

export function workHoursError(days: WorkDay[]): string | undefined {
  const invalid = days.find(isInvalidWorkDay);
  return invalid && `${DAY_NAMES[invalid.day]} hours must end after they start.`;
}

export const sortHolidays = (holidays: Holiday[]) => [...holidays].sort((a, b) => a.date.localeCompare(b.date));

/** Today's calendar date (YYYY-MM-DD) in the company time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Company wall-clock parts of a booking time: form values are wall times (YYYY-MM-DDTHH:mm), saved ones are instants. */
function wallParts(at: string | Date, timeZone: string) {
  const wall = typeof at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(at);
  const instant = wall ? new Date(`${(at as string).slice(0, 10)}T12:00:00Z`) : new Date(at);
  if (Number.isNaN(instant.getTime())) return undefined;
  const zone = wall ? 'UTC' : timeZone;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(instant).map(part => [part.type, part.value]));
  return { date: todayIn(zone, instant), weekday: WEEKDAYS[parts.weekday], label: `${parts.month} ${parts.day}`,
    clock: wall ? (at as string).slice(11, 16) : `${parts.hour}:${parts.minute}` };
}

/** Why a pickup at `at` is outside company hours, or undefined when open. Mirrors the API's `closed_reason`, which stays authoritative. */
export function closedReason(at: string | Date, timeZone: string, workHours: WorkDay[] = DEFAULT_WORK_HOURS, holidays: Holiday[] = []): string | undefined {
  const local = wallParts(at, timeZone);
  if (!local || workHours.length !== 7) return undefined;
  const holiday = holidays.find(item => item.date === local.date);
  if (holiday) return `Closed on ${holiday.name} (${local.label}).`;
  const day = workHours[local.weekday];
  const name = DAY_NAMES[day.day];
  if (!day.open) return `Closed on ${name}s.`;
  const start = day.start ?? '06:00', end = clockLabel(day.end ?? '19:00');
  return start <= local.clock && local.clock < end ? undefined : `${name} pickups are ${start}–${end}.`;
}
