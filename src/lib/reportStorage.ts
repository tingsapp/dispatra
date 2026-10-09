import type { Analytics } from '../operations/analyticsAdapters';

/** Explicit prototype fixture; authenticated company pages always read the API. */
export const DEMO_ANALYTICS: Analytics = {
  orders: 7, completed_orders: 7, open_issues: 0, statuses: { COMPLETED: 7 },
  pod_verified_orders: 7, on_time_orders: 5, sla_known_orders: 7, on_time_percent: 71.4,
  source_counts: { EMAIL: 3, DISPATCHER: 2, SHIPPER_PORTAL: 1, IMPORT: 1 },
  daily: [{ date: '2026-09-09', orders: 7, completed: 7, on_time: 5, late: 2, not_measured: 0 }],
  rows: ['Pacific Fresh Logistics', 'Nordic Bio Health Supplies', 'Metro Retailers Group', 'Apex Precision Engineering', 'Granville Island Artisans', 'Pacific Coast Health Clinics', 'Urban Builders Supply Hub'].map((name, index) => ({
    id: `demo-analytics-${index}`, number: `#${458 - index * 3}`, shipper_name: name, shipper_id: `demo-shipper-${index}`, driver_id: `demo-driver-${index % 3}`,
    scheduled_at: `2026-09-09T${String(9 + index).padStart(2, '0')}:00:00-07:00`, status: 'COMPLETED',
    source: ['EMAIL', 'DISPATCHER', 'SHIPPER_PORTAL', 'IMPORT', 'EMAIL', 'EMAIL', 'DISPATCHER'][index],
    driver_name: ['Arles Morgan', 'Marcus Vance', 'Maria Garcia'][index % 3], driver_number: `D${14 + index}`, vehicle_unit: `V${12 + index}`,
    service_name: 'Same-Day Standard', delivered_at: `2026-09-09T${String(10 + index).padStart(2, '0')}:15:00-07:00`,
    delivery_outcome: index === 1 || index === 5 ? 'LATE' : 'ON_TIME', pod_verified: true, open_issues: 0,
  })),
};
export function prototypeAnalytics(start?: string, end?: string): Analytics {
  const rows = DEMO_ANALYTICS.rows.filter(row => (!start || Date.parse(row.scheduled_at) >= Date.parse(start)) && (!end || Date.parse(row.scheduled_at) < Date.parse(end)));
  return rows.length ? DEMO_ANALYTICS : { ...DEMO_ANALYTICS, orders: 0, completed_orders: 0, on_time_orders: 0, sla_known_orders: 0,
    on_time_percent: null, pod_verified_orders: 0, daily: [], rows: [], statuses: {}, source_counts: {} };
}
