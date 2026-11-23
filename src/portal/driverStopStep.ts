import type { DriverDayStop, DriverOrder, DriverRoute, DriverVisit } from './driverDayPlan';

// Same thresholds as the driver app's arrival detection.
const ARRIVAL_RADIUS_M = 100;
const ARRIVAL_ACCURACY_M = 75;
const ARRIVAL_FIX_AGE_MS = 30_000;
export const ARRIVAL_LOCATION_ERROR = 'A fresh, accurate location within 100 metres of this stop is required. Check location sharing and try again.';

export type DriverStepKind = 'start' | 'navigate' | 'arrive' | 'pickup' | 'finish' | 'sync';
export interface DriverStep { kind: DriverStepKind; title: string; disabled?: boolean; visit?: DriverVisit }
export type DriverFix = Pick<GeolocationPosition, 'timestamp'> & { coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'accuracy'> };

export const nextVisit = (route?: DriverRoute) => route?.stops.find(visit => visit.status !== 'COMPLETED');
export const needsRouteSync = (route: DriverRoute) => route.status === 'IN_PROGRESS' && (!!route.plan?.requires_acknowledgement || !route.plan?.live_updates_supported);

function visitName(route: DriverRoute, visit: DriverVisit) {
  const ordered = [...route.stops].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex(row => row.id === visit.id);
  if (index <= 0 && visit.stop.kind === 'PICKUP') return 'pickup';
  if (index === ordered.length - 1 && visit.stop.kind === 'DROPOFF') return 'destination';
  return `stop ${Math.max(index + 1, 1)}`;
}

function metres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** A fresh, accurate browser fix within 100 m of the route's current visit. */
export function isCurrentStopNearby(route: DriverRoute, fix?: DriverFix | null, now = Date.now()) {
  const visit = nextVisit(route);
  const { latitude, longitude } = visit?.stop.address ?? {};
  if (!fix || latitude == null || longitude == null) return false;
  const age = now - fix.timestamp;
  return age >= 0 && age < ARRIVAL_FIX_AGE_MS && fix.coords.accuracy <= ARRIVAL_ACCURACY_M && metres(fix.coords, { latitude, longitude }) <= ARRIVAL_RADIUS_M;
}

/** The route's single next step, exactly as the driver app derives it. */
export function driverRouteStep(route?: DriverRoute, fix?: DriverFix | null, now = Date.now()): DriverStep | undefined {
  if (!route) return undefined;
  if (route.status === 'PLANNED') return { kind: 'start', title: 'Start' };
  if (route.status !== 'IN_PROGRESS') return undefined;
  if (needsRouteSync(route)) return { kind: 'sync', title: 'Acknowledge updated route' };
  const visit = nextVisit(route);
  if (!visit) {
    const last = route.stops[route.stops.length - 1];
    return last?.stop.kind === 'DROPOFF' && !!last.arrived_at ? { kind: 'finish', title: 'Complete' } : undefined;
  }
  if (!visit.arrived_at) return isCurrentStopNearby(route, fix, now)
    ? { kind: 'arrive', title: `Confirm ${visitName(route, visit)} arrival`, visit }
    : { kind: 'navigate', title: `Navigate to ${visitName(route, visit)}`, visit };
  const following = route.stops.find(row => row.status !== 'COMPLETED' && row.id !== visit.id);
  if (visit.stop.kind === 'PICKUP') return { kind: 'pickup', title: following ? `Navigate to ${visitName(route, following)}` : 'Next stop unavailable', disabled: !following, visit };
  // A delivery stays current until its own POD and item quantities are accepted.
  return following ? { kind: 'navigate', title: `Navigate to ${visitName(route, following)}`, disabled: true, visit } : { kind: 'finish', title: 'Complete', disabled: true, visit };
}

/** The stop the route step belongs on: its visit, the last visit for Complete, otherwise the next visit. */
export function stepHere(step: DriverStep | undefined, route: DriverRoute | undefined, visit: DriverVisit | undefined) {
  if (!step || !route || !visit) return false;
  if (step.visit) return step.visit.id === visit.id;
  return step.kind === 'finish' ? route.stops[route.stops.length - 1]?.id === visit.id : nextVisit(route)?.id === visit.id;
}

/** Upload POD: a drop-off visit the driver has arrived at, and the route's next visit. */
export const podReady = (route: DriverRoute | undefined, visit: DriverVisit | undefined) =>
  !!route && !!visit && visit.status !== 'COMPLETED' && !!visit.arrived_at && nextVisit(route)?.id === visit.id;

/** Report: an executing route, at the order's first unfinished visit. */
export function issueReady(route: DriverRoute | undefined, visit: DriverVisit | undefined, order: Pick<DriverOrder, 'stops'>) {
  if (!route || !visit || route.status !== 'IN_PROGRESS') return false;
  return route.stops.find(row => row.status !== 'COMPLETED' && order.stops.some(stop => stop.id === row.stop_id))?.id === visit.id;
}

export const pickupQuantities = (route: DriverRoute, visit: DriverVisit) =>
  Object.fromEntries((route.items ?? []).filter(item => item.pickup_id === visit.stop_id).map(item => [item.id, item.quantity]));

const destination = (visit: DriverVisit) => {
  const { text, latitude, longitude } = visit.stop.address;
  return text?.trim() || (latitude != null && longitude != null ? `${latitude},${longitude}` : '');
};

/** Google Maps directions through the remaining visits, as the driver app opens them. */
export function googleDirections(visits: DriverVisit[]) {
  const stops = visits.map(destination).filter(Boolean);
  if (!stops.length) throw new Error('No stop addresses are available for navigation.');
  const waypoints = stops.slice(0, -1);
  return 'https://www.google.com/maps/dir/?api=1' + `&destination=${encodeURIComponent(stops[stops.length - 1])}`
    + (waypoints.length ? `&waypoints=${waypoints.map(encodeURIComponent).join('%7C')}` : '') + '&travelmode=driving' + (waypoints.length ? '' : '&dir_action=navigate');
}

export const stopRoute = (row: DriverDayStop, routes: DriverRoute[]) => row.visit ? routes.find(route => route.id === row.visit!.route_id) : undefined;
