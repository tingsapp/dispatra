import type { Order } from './api';

/** Explicitly decode the server-owned snapshot from the historical free-form booking object. */
export function shipperAssignment(order: Pick<Order, 'booking'>): { id: string; name: string } | null {
  const value = order.booking.assigned_driver;
  if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)) return null;
  return typeof value.id === 'string' && typeof value.name === 'string' ? { id: value.id, name: value.name } : null;
}
