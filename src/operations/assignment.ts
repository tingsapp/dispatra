import type { components } from '../portal/schema';
import { allOperations, operations } from './api';

type Order = components['schemas']['OrderView'];
type Route = components['schemas']['RouteView'];

/** A driver and vehicle can each have only one planned or in-progress Route. */
export function assignableRoute(routes: Route[], driverId: string, vehicleId: string): Route | undefined {
  const active = routes.find(route => ['PLANNED', 'IN_PROGRESS'].includes(route.status) &&
    (route.driver_id === driverId || route.vehicle_id === vehicleId));
  if (!active) return undefined;
  if (active.driver_id !== driverId || active.vehicle_id !== vehicleId)
    throw new Error('The driver or vehicle already belongs to another active route.');
  if (active.status !== 'PLANNED' || active.locked)
    throw new Error('This driver already has a locked or in-progress route. Finish it before assigning another order.');
  return active;
}

export async function assignToDriver(slug: string, order: Order, driverId: string, vehicleId: string) {
  const route = assignableRoute(await allOperations.routes(slug), driverId, vehicleId);
  return operations.assignOrder(slug, order, driverId, vehicleId, route);
}

/** A route is the assignment unit. Release its planned route before moving an order. */
export async function changeAssignment(slug: string, order: Order, driverId: string | null, vehicleId: string | null, route?: Route) {
  if (driverId && !vehicleId) throw new Error('The driver needs an attached vehicle.');
  if (!driverId && !route) throw new Error('This order is already unassigned.');
  if (route && driverId === route.driver_id) return;
  if (route) await operations.releaseRoute(slug, route);
  if (driverId && vehicleId) {
    const current = route ? await operations.getOrder(slug, order.id) : order;
    await assignToDriver(slug, current, driverId, vehicleId);
  }
}
