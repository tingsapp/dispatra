import type { components } from '../portal/schema';
import type { OrderDateSelection } from '../components/orders/OrderDateFilter';

export type Analytics = components['schemas']['AnalyticsView'];
export type AnalyticsRow = Analytics['rows'][number];

/** Company calendar midnight, including DST, independent of the viewer's timezone. */
export function companyMidnight(date: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const fields = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const local = Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second));
    instant += target - local;
  }
  return new Date(instant).toISOString();
}
const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
export function analyticsBounds(filter: OrderDateSelection, timeZone: string): { start?: string; end?: string } {
  if (filter.kind === 'all') return {};
  return { start: companyMidnight(filter.kind === 'day' ? filter.date : filter.from, timeZone), end: companyMidnight(nextDay(filter.kind === 'day' ? filter.date : filter.to), timeZone) };
}
export const sourceLabels: Record<string, string> = { EMAIL: 'Email', IMPORT: 'TMS', SHIPPER_PORTAL: 'Shipper', DISPATCHER: 'Dispatcher' };
/** Zero-fill days without inventing measurements; limit long histories to weekly/monthly buckets. */
export function chartDays(data: Analytics, filter: OrderDateSelection) {
  const first = filter.kind === 'all' ? data.daily[0]?.date : filter.kind === 'day' ? filter.date : filter.from;
  const last = filter.kind === 'all' ? data.daily.at(-1)?.date : filter.kind === 'day' ? filter.date : filter.to;
  if (!first || !last || !data.orders) return [];
  const span = Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;
  const bucket = span > 180 ? 30 : span > 45 ? 7 : 1;
  const measured = new Map(data.daily.map(day => [day.date, day]));
  return Array.from({ length: Math.ceil(span / bucket) }, (_, index) => {
    const date = new Date(Date.parse(first) + index * bucket * 86400000).toISOString().slice(0, 10);
    const end = new Date(Math.min(Date.parse(last), Date.parse(date) + (bucket - 1) * 86400000)).toISOString().slice(0, 10);
    const sum = { date, end, orders: 0, completed: 0, on_time: 0, late: 0, not_measured: 0 };
    for (let current = date; current <= end; current = nextDay(current)) {
      const day = measured.get(current);
      if (day) for (const key of ['orders', 'completed', 'on_time', 'late', 'not_measured'] as const) sum[key] += day[key];
    }
    return sum;
  });
}
/** Distinct assigned drivers and ordering shippers in each company-calendar bucket. */
export function activityDays(data: Analytics, filter: OrderDateSelection, timeZone: string) {
  const dates = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const rows = data.rows.map(row => ({ ...row, date: dates.format(new Date(row.scheduled_at)) }));
  return chartDays(data, filter).map(day => {
    const orders = rows.filter(row => row.date >= day.date && row.date <= day.end);
    return { date: day.date, end: day.end, orders: day.orders,
      drivers: new Set(orders.flatMap(row => row.driver_id ? [row.driver_id] : [])).size,
      shippers: new Set(orders.map(row => row.shipper_id)).size };
  });
}
