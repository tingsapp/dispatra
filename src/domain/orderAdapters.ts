import { Driver, Order } from '../types';
import type { VehicleAsset } from '../lib/vehicleStorage';
import { PricingOrderInput } from '../types/pricing';
import { Customer } from '../lib/customerStorage';

/** New-order estimates use the selected driver's attached asset, never a guessed type. */
export function applyDriverVehicle(input: PricingOrderInput, driver: Driver | undefined, fleet: VehicleAsset[]): PricingOrderInput {
  return { ...input, vehicleId: fleet.find(vehicle => vehicle.id === driver?.currentVehicleId)?.vehicleTypeId ?? null };
}
/** Enrich only unambiguous legacy links; never guess a multi-stop shipment split. */
export function normalizeOrderInput(input: PricingOrderInput): PricingOrderInput {
  const pickups = input.stops.filter(s => s.type === 'PICKUP');
  const drops = input.stops.filter(s => s.type === 'DROPOFF');
  return { ...input, stops: input.stops.map(s => ({ ...s, ...(s.type === 'DROPOFF' && s.pickupIds == null && pickups.length === 1 ? { pickupIds: [pickups[0].id] } : {}) })),
    packages: input.packages.map(p => ({ ...p, ...(pickups.length === 1 && drops.length === 1 ? { pickupStopId: p.pickupStopId ?? pickups[0].id, deliveryStopId: p.deliveryStopId ?? drops[0].id } : {}) })) };
}
export const snapshotCustomer = (c?: Customer): Order['customerSnapshot'] => c ? { id: c.id, name: c.name, phone: c.phone, email: c.email, billingEmail: c.email, legalName: c.legalName, address: c.address, paymentTerms: c.paymentTerms } : undefined;
export function applyCustomerDefaults(input: PricingOrderInput, c?: Customer): PricingOrderInput {
  if (!c) return { ...input, customerId: null };
  return { ...input, customerId: c.id, serviceId: c.defaultServiceId || input.serviceId,
    rateCardOverrideId: null,
    scheduledAt: input.scheduledAt && c.defaultWindowStart ? `${input.scheduledAt.slice(0,10)}T${c.defaultWindowStart}` : input.scheduledAt,
    scheduledEndAt: input.scheduledAt && c.defaultWindowEnd ? `${input.scheduledAt.slice(0,10)}T${c.defaultWindowEnd}` : input.scheduledEndAt,
    stops: input.stops.map(s => ({ ...s, instructions: s.instructions || c.instructions })) };
}
export function removeOrderStop(input: PricingOrderInput, id: string): PricingOrderInput {
  return { ...input, stops: input.stops.filter(s => s.id !== id).map(s => ({ ...s, pickupIds: s.pickupIds?.filter(p => p !== id) })),
    packages: input.packages.map(p => ({ ...p, pickupStopId: p.pickupStopId === id ? undefined : p.pickupStopId, deliveryStopId: p.deliveryStopId === id ? undefined : p.deliveryStopId })) };
}
