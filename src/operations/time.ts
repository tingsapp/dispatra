/** Convert a workspace wall time to a UTC instant for the API. Existing ISO instants pass through. */
export function bookingInstant(value: string, timeZone: string): string {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) throw new Error('Choose a valid date and time.');
    return instant.toISOString();
  }
  const parts = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(value);
  if (!parts) throw new Error('Choose a valid date and time.');
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const wall = (timestamp: number) => {
    const fields = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, Number(part.value)]));
    return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute);
  };
  let instant = target;
  for (let count = 0; count < 3; count++) instant += target - wall(instant);
  if (wall(instant) !== target) throw new Error('That time does not exist in the company time zone. Choose another time.');
  return new Date(instant).toISOString();
}
