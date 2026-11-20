import type { components } from './schema';
import { addressPoint } from '../components/orders/shipperMapLocation';

export type DriverOrder = components['schemas']['DriverOrderView'];
export type DriverRoute = components['schemas']['DriverRouteView'];
export type DriverVisit = components['schemas']['RouteVisitView'];
export const driverDate = (value: string, timeZone: string) => new Date(value).toLocaleDateString('en-CA', { timeZone });

export interface DriverDayStop {
  id: string;
  order: DriverOrder;
  stop: DriverOrder['stops'][number];
  visit?: DriverVisit;
  point: ReturnType<typeof addressPoint>;
  next: boolean;
}

export function driverRouteSequence(route: DriverRoute, stops: DriverDayStop[]) {
  const visible = new Map(stops.map(row => [row.stop.id, row]));
  const visits = [...route.stops]
    .filter(visit => visible.has(visit.stop_id) && (route.status !== 'IN_PROGRESS' || visit.status !== 'COMPLETED'))
    .sort((a, b) => a.position - b.position);
  const points = visits.flatMap(visit => {
    const point = visible.get(visit.stop_id)?.point;
    return point ? [point] : [];
  });
  const origin = route.status === 'PLANNED' || route.status === 'IN_PROGRESS'
    ? route.map_origin && { lat: route.map_origin.latitude, lng: route.map_origin.longitude }
    : null;
  return { origin, points: [...(origin ? [origin] : []), ...points] };
}

/** Today's assigned orders, with each route's authoritative visit sequence preserved. */
export function driverDayPlan(orders: DriverOrder[], routes: DriverRoute[], timeZone: string, now: string) {
  const day = driverDate(now, timeZone);
  const today = orders.filter(order => order.status !== 'CANCELLED' && driverDate(order.scheduled_at, timeZone) === day);
  const stops: DriverDayStop[] = [];
  const seen = new Set<string>();
  const add = (order: DriverOrder, stop: DriverDayStop['stop'], visit?: DriverVisit, next = false) => {
    const id = `${order.id}:${stop.id}`;
    if (seen.has(id)) return;
    seen.add(id);
    stops.push({ id, order, stop, visit, next, point: addressPoint(stop.address) });
  };
  const orderedRoutes = [...routes].sort((a, b) => Date.parse(a.planned_at) - Date.parse(b.planned_at) || a.id.localeCompare(b.id));
  for (const route of orderedRoutes) {
    const visits = [...route.stops].sort((a, b) => a.position - b.position);
    const nextVisit = visits.find(visit => visit.status !== 'COMPLETED');
    for (const visit of visits) {
      const order = today.find(row => row.route_id === route.id && row.stops.some(stop => stop.id === visit.stop_id));
      const stop = order?.stops.find(stop => stop.id === visit.stop_id);
      if (order && stop) add(order, stop, visit, order.status !== 'COMPLETED' && visit.id === nextVisit?.id);
    }
  }
  // Keep orders visible while their route is loading or unavailable; never invent a route sequence.
  for (const order of [...today].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at) || a.id.localeCompare(b.id))) {
    for (const stop of order.stops) add(order, stop);
  }
  return { orders: today, stops };
}

export const driverStopStatus = (row: DriverDayStop) => row.visit?.status === 'COMPLETED' || row.order.status === 'COMPLETED'
  ? 'Completed' : row.visit?.arrived_at ? 'Arrived' : row.next ? 'Next stop' : 'Upcoming';
