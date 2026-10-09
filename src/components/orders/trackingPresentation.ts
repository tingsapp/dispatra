import type { components } from '../../portal/schema';
import { formatWhen } from './OrderDossierSections';

export type Tracking = components['schemas']['TrackingView'];
export const STEPS = ['Booked', 'Driver assigned', 'Picked up', 'On the way', 'Delivered'];
export const STEP_INDEX: Record<Tracking['stage'], number> = { BOOKED: 0, ASSIGNED: 1, TO_PICKUP: 1, IN_TRANSIT: 3, OUT_FOR_DELIVERY: 3, DELIVERED: 4, CANCELLED: -1 };
export { clockTime as time } from '../../lib/dateTimeFormat';
export const ago = (iso: string, now: number) => { const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000)); return minutes < 1 ? 'just now' : `${minutes} min ago`; };

/** A live ETA exists only once the driver has started the route; before that the plan is shown instead. */
export const trackingMoving = (t: Tracking) => ['TO_PICKUP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(t.stage);

/** One-line state of the shipment, as a carrier tracking page would phrase it. */
export function trackingHeadline(t: Tracking, timeZone: string): string {
  const name = t.driver?.first_name;
  switch (t.stage) {
    case 'BOOKED': return 'Booked – waiting for a driver';
    case 'ASSIGNED': { const pickup = t.stops.find(s => s.kind === 'PICKUP')?.planned_at; return `${name ? `${name} is` : 'A driver is'} assigned${pickup ? ` · pickup planned ${formatWhen(pickup, timeZone)}` : ''}`; }
    case 'TO_PICKUP': return t.stops_before_next ? `Driver is on the route · ${t.stops_before_next} ${t.stops_before_next === 1 ? 'stop' : 'stops'} before your pickup` : `${name ?? 'The driver'} is heading to your pickup`;
    case 'IN_TRANSIT': return `Picked up · ${t.stops_before_next ?? 0} ${t.stops_before_next === 1 ? 'stop' : 'stops'} before your delivery`;
    case 'OUT_FOR_DELIVERY': return 'Out for delivery – your stop is next';
    case 'DELIVERED': { const last = [...t.stops].reverse().find(s => s.kind === 'DROPOFF'); return `Delivered${last?.completed_at ? ` ${formatWhen(last.completed_at, timeZone)}` : ''}`; }
    case 'CANCELLED': return 'Order cancelled';
  }
}

/** Orders worth tracking from the dispatcher's list: a driver is on them and they are not finished. */
export const trackable = (status?: string) => status === 'ASSIGNED' || status === 'IN_PROGRESS';

