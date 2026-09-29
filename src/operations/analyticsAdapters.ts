import type { components } from '../portal/schema';
import type { AuditLogItem } from '../lib/reportStorage';
import type { OrderDateSelection } from '../components/orders/OrderDateFilter';

type Analytics = components['schemas']['AnalyticsView'];

/** Resolve a company calendar midnight without assuming the viewer's computer uses the company time zone. */
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
export function analyticsBounds(filter: OrderDateSelection, timeZone: string): { start?: string; end?: string } {
  if (filter.kind === 'all') return {};
  const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return { start: companyMidnight(filter.kind === 'day' ? filter.date : filter.from, timeZone), end: companyMidnight(nextDay(filter.kind === 'day' ? filter.date : filter.to), timeZone) };
}

export function analyticsDisplay(data: Analytics) {
  const hourlyVolumes = data.hourly_completed.map(item => ({ hour: `${String(item.hour).padStart(2, '0')}:00`, volume: item.orders, peak: item.orders > 0 && item.orders === Math.max(...data.hourly_completed.map(row => row.orders)) }));
  const counts = { liftgate: 0, reefer: 0, inside: 0, waiting: 0 };
  for (const [name, count] of Object.entries(data.accessorial_counts)) {
    if (/liftgate/i.test(name)) counts.liftgate += count;
    if (/reefer|temperature/i.test(name)) counts.reefer += count;
    if (/inside|white glove/i.test(name)) counts.inside += count;
    if (/wait|demurrage/i.test(name)) counts.waiting += count;
  }
  return {
    total: data.completed_orders, slaKnown: data.sla_known_orders, onTime: data.on_time_orders, onTimePercent: data.on_time_percent,
    revenue: Number(data.completed_revenue_before_tax), podVerified: data.pod_verified_orders,
    averageVariance: data.average_arrival_variance_minutes,
    accessorialCounts: counts, hourlyVolumes, peakHour: hourlyVolumes.find(item => item.peak),
    dailyPerformance: data.daily.map(day => ({ day: day.date, totalJobs: day.sla_known, onTimeJobs: day.on_time,
      lateJobs: day.late, exceptionJobs: 0, revenue: Number(day.revenue) })),
  };
}

export function analyticsRows(data: Analytics): AuditLogItem[] {
  return data.rows.map(row => ({
    id: row.id, timestamp: row.scheduled_at.replace('T', ' ').slice(0, 16), jobNumber: row.number,
    customerName: row.shipper_name || '—', driverName: row.driver_name || '—', driverCode: row.driver_number || '—',
    vehicleUnit: row.vehicle_unit || '—', serviceType: row.service_name || '—',
    scheduledTime: row.window_start && row.window_end ? `${new Date(row.window_start).toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit'})} – ${new Date(row.window_end).toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit'})}` : new Date(row.scheduled_at).toLocaleString('en-CA', { dateStyle:'medium',timeStyle:'short' }),
    actualArrival: row.actual_arrival ? new Date(row.actual_arrival).toLocaleString('en-CA', { dateStyle:'medium', timeStyle:'short' }) : '—',
    slaStatus: row.sla_status === 'ON_TIME' ? 'on_time' : row.sla_status === 'AHEAD' ? 'ahead' : row.sla_status === 'LATE' ? 'late' : 'exception',
    varianceMinutes: row.variance_minutes ?? 0, totalBilled: row.total == null ? NaN : Number(row.total),
    accessorialsCharged: row.accessorials, podVerified: row.pod_verified, signatureReceived: false,
  }));
}
