/** Display saved legacy clock text in 24-hour form without changing the saved value. */
export function clockText(value: string): string {
  return value.replace(/\b(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])\.?m\.?(?!\w)/gi, (_, hour: string, minute: string | undefined, period: string) =>
    `${String(Number(hour) % 12 + (period.toLowerCase() === 'p' ? 12 : 0)).padStart(2, '0')}:${minute ?? '00'}`);
}

/** UI timestamps always use 00–23 hours; time zones remain chosen by the caller. */
export function dateTime(value?: string | null, timeZone?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clockText(value);
  return date.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone });
}

export function clockTime(value?: string | null, timeZone?: string): string {
  return value ? new Date(value).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }) : '';
}
