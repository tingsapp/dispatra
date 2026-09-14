/** Date-only fields are calendar dates, never UTC instants. */
export function parseDateValue(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

export function formatDateValue(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function combineDateAndTime(day: string, clock: string): string {
  if (!parseDateValue(day)) return '';
  return `${day}T${/^([01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : '00:00'}`;
}
