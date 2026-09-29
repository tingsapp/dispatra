import type { components } from '../portal/schema';
import { operations } from './api';

type Order = components['schemas']['OrderView'];
type Route = components['schemas']['RouteView'];

/** A route is the assignment unit. Release its planned route before moving an order. */
export async function changeAssignment(slug: string, order: Order, driverId: string | null, vehicleId: string | null, route?: Route) {
  if (driverId && !vehicleId) throw new Error('The driver needs an attached vehicle.');
  if (!driverId && !route) throw new Error('This order is already unassigned.');
  if (route && driverId === route.driver_id) return;
  if (route) await operations.releaseRoute(slug, route);
  if (driverId && vehicleId) {
    const current = route ? await operations.getOrder(slug, order.id) : order;
    await operations.assignOrder(slug, current, driverId, vehicleId);
  }
}
