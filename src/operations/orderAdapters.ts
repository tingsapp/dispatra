import type { Job } from '../types';
import type { PricingOrderInput, PricingSnapshot, ChargeLine } from '../types/pricing';
import type { Order, Shipper, RateCard, CatalogItem, Booking } from './api';
import { canadianAddress } from './adapters';
import { bookingInstant } from './time';

const amount = (value: number | string | null | undefined) => Number(value ?? 0);
const validStatus = (status: string): Job['lifecycleStatus'] =>
  ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED'].includes(status) ? status as Job['lifecycleStatus'] : 'NEW';

export function orderToInput(order: Order): PricingOrderInput {
  const facts = order.facts;
  return {
    customerId: order.shipper_id, billingCustomerId: order.billing_shipper_id,
    serviceId: order.service_id, vehicleId: facts.vehicle_type_id ?? null,
    scheduledAt: order.scheduled_at, scheduledEndAt: null,
    stops: facts.stops.map(stop => ({
      id: stop.id, type: stop.kind, label: stop.address.text, zoneId: null, residential: false, waitMinutes: 0,
      contactName: stop.contact_name, contactPhone: stop.phone, instructions: stop.instructions,
      windowStart: stop.window_start ?? undefined, windowEnd: stop.window_end ?? undefined,
      latitude: stop.address.latitude, longitude: stop.address.longitude, city: stop.address.city, countryCode: stop.address.country, provinceCode: stop.address.province,
      postalCode: stop.address.postal_code,
      pickupIds: stop.kind === 'DROPOFF' ? [...new Set(facts.items.filter(item => item.delivery_id === stop.id).map(item => item.pickup_id))] : undefined,
    })),
    routeKm: facts.distance_km == null ? null : Number(facts.distance_km), estimatedMinutes: facts.estimated_minutes ?? null,
    actualMinutes: null,
    packages: facts.items.map(item => ({ id: item.id, quantity: item.quantity, weightKg: Number(item.weight_kg),
      lengthCm: Number(item.length_cm), widthCm: Number(item.width_cm), heightCm: Number(item.height_cm),
      declaredValue: 0, description: item.description, fragile: item.fragile, pickupStopId: item.pickup_id, deliveryStopId: item.delivery_id,
      handlingTags: item.dangerous_goods ? ['DANGEROUS_GOODS'] : [],
    })),
    accessorials: facts.accessorials.map(a => ({ accessorialId: a.id, quantity: Number(a.quantity) })),
    source: order.source === 'SHIPPER_PORTAL' || order.source === 'SHIPPER_PORTAL' ? 'SHIPPER_PORTAL' : order.source === 'IMPORT' ? 'IMPORT' : 'DISPATCHER',
    importedPrice: facts.imported_total == null ? null : Number(facts.imported_total), importedTaxAmount: facts.imported_tax == null ? null : Number(facts.imported_tax),
    externalSource: null, externalReference: facts.external_reference, adjustments: facts.adjustments.map((a, i) => ({ id: String(i), amount: Number(a.amount), reason: a.reason, taxable: a.taxable })),
    rateCardOverrideId: facts.rate_card_id ?? null, preferredDriverId: facts.preferred_driver_id ?? null, stage: order.pricing.stage,
  };
}

export function priceToUi(price: Order['pricing'], facts: Booking, createdAt: string, rate?: RateCard): PricingSnapshot {
  const lines: ChargeLine[] = price.lines.map((line, index) => ({
    key: `${line.group}-${index}`, group: line.group as ChargeLine['group'],
    ...(line.group === 'VEHICLE' ? { label: 'Vehicle Surcharge', detail: line.label } : { label: line.label }),
    amount: amount(line.amount), fuelEligible: line.fuel_eligible, taxable: line.taxable,
  }));
  const group = (name: string) => lines.filter(line => line.group === name).reduce((sum, line) => sum + line.amount, 0);
  const totalWeight = facts.items.reduce((sum, item) => sum + item.quantity * Number(item.weight_kg), 0);
  return {
    engineVersion: 'api', pricedAt: createdAt, stage: price.stage, status: price.status,
    errors: price.review_reason ? [{ code: 'INVALID_ORDER', message: price.review_reason }] : [], warnings: [],
    currency: price.currency === 'USD' ? 'USD' : 'CAD',
    rateCard: rate ? { id: rate.id, name: rate.data.name, version: rate.version, scope: rate.is_default ? 'ORGANIZATION' : 'ORDER', source: 'OVERRIDE', pricingMethod: rate.data.method } : null,
    candidates: [], method: price.method as PricingSnapshot['method'] ?? null, taxProfile: null, taxExempt: false,
    // Road distance/minutes the API measured for pricing live in its context (dispatcher views only; shippers receive no context).
    inputs: { routeKm: facts.distance_km != null ? Number(facts.distance_km) : price.context?.distance_km != null ? Number(price.context.distance_km) : null, billableKm: 0,
      estimatedMinutes: facts.estimated_minutes ?? (typeof price.context?.estimated_minutes === 'number' ? price.context.estimated_minutes : null), billableMinutes: 0, actualWeightKg: totalWeight,
      volumeCm3: 0, dimensionalWeightKg: 0, chargeableWeightKg: totalWeight,
      pieces: facts.items.reduce((sum, item) => sum + item.quantity, 0), stopCount: facts.stops.length,
      serviceMultiplier: 1, fuelPercent: 0, fuelBase: 0, dimensionalDivisor: 5000, dimensionalPricingEnabled: false,
      waitFreeMinutes: 0, waitIncrementMinutes: 0, declaredValue: 0 },
    lines: lines.filter(line => line.group !== 'TAX'), freight: group('FREIGHT'), serviceFreight: group('FREIGHT') + group('SERVICE'),
    vehicleSurcharge: group('VEHICLE'), fuelSurcharge: group('FUEL'), companyCharge: group('COMPANY_CHARGE'),
    accessorialsTotal: group('ACCESSORIAL'), minimumAdjustment: group('MINIMUM'), discount: group('DISCOUNT'),
    adjustmentsTotal: group('ADJUSTMENT'), subtotal: amount(price.subtotal), taxLines: lines.filter(line => line.group === 'TAX'),
    taxTotal: amount(price.tax), total: amount(price.total), cost: null,
  };
}

export function orderToUi(order: Order, shippers: Shipper[], catalog: CatalogItem[], rates: RateCard[], assignment?: { driver_id: string }): Job {
  const shipper = shippers.find(row => row.id === order.shipper_id);
  const service = catalog.find(row => row.id === order.service_id);
  const pickup = order.facts.stops.find(stop => stop.kind === 'PICKUP');
  const drop = [...order.facts.stops].reverse().find(stop => stop.kind === 'DROPOFF');
  const status = validStatus(order.status);
  const visualStatus = status === 'COMPLETED' || status === 'INVOICED' ? 'completed' : status === 'NEW' ? 'no_driver' : 'on_time';
  return {
    id: order.id, version: order.version, jobNumber: order.number, lifecycleStatus: status,
    status: visualStatus, statusLabel: status === 'NEW' ? 'No Driver' : status === 'COMPLETED' ? 'Completed' : status === 'INVOICED' ? 'Invoiced' : 'On Time',
    riskText: order.pricing.review_reason ?? undefined,
    customerName: shipper?.name ?? 'Unknown shipper', customerPhone: shipper?.phone ?? '', customerEmail: shipper?.email,
    pickupAddress: pickup?.address.text ?? '', dropoffAddress: drop?.address.text ?? '',
    scheduledTime: order.scheduled_at, jobType: service?.data.name ?? 'Delivery', serviceLevel: service?.data.name,
    assignedDriverId: assignment?.driver_id, serviceId: order.service_id, customerId: order.shipper_id,
    vehicleId: order.facts.vehicle_type_id ?? null, routeId: order.route_id ?? undefined,
    cargoWeight: `${order.facts.items.reduce((sum, item) => sum + item.quantity * Number(item.weight_kg), 0).toFixed(1)} kg`,
    stopsCount: order.facts.stops.length, handlingInstructions: order.facts.internal_notes,
    lat: drop?.address.latitude ?? NaN, lng: drop?.address.longitude ?? NaN,
    pricingInput: orderToInput(order), pricing: priceToUi(order.pricing, order.facts, order.created_at, rates.find(rate => rate.id === order.pricing.rate_card_id)),
    createdAt: order.created_at, completedAt: order.completed_at ?? undefined,
  };
}

/** Preserve all stop and item links when the form is submitted to the API. */
export function inputToBooking(input: PricingOrderInput, notes = '', timeZone = 'America/Vancouver'): Booking {
  if (!input.scheduledAt || Number.isNaN(new Date(input.scheduledAt).getTime())) throw new Error('Choose a valid pickup date and time.');
  if (!input.serviceId) throw new Error('Choose a service level.');
  if (input.stops.filter(stop => stop.type === 'PICKUP').length === 0 || input.stops.filter(stop => stop.type === 'DROPOFF').length === 0) throw new Error('Add a pickup and delivery stop.');
  const stopIds = new Map(input.stops.map(stop => [stop.id, /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(stop.id) ? stop.id : crypto.randomUUID()]));
  const pickups = input.stops.filter(stop => stop.type === 'PICKUP');
  const drops = input.stops.filter(stop => stop.type === 'DROPOFF');
  return {
    shipper_id: input.customerId, billing_shipper_id: input.billingCustomerId ?? input.customerId,
    rate_card_id: input.rateCardOverrideId, service_id: input.serviceId, vehicle_type_id: input.vehicleId, preferred_driver_id: input.preferredDriverId ?? null,
    scheduled_at: bookingInstant(input.scheduledAt, timeZone),
    stops: input.stops.map(stop => ({ id: stopIds.get(stop.id)!, kind: stop.type, address: canadianAddress(stop.label ?? '', undefined, { latitude: stop.latitude ?? null, longitude: stop.longitude ?? null, city: stop.city, province: stop.provinceCode, postalCode: stop.postalCode, country: stop.countryCode }),
      contact_name: stop.contactName ?? '', phone: stop.contactPhone ?? '', instructions: stop.instructions ?? '',
      window_start: stop.windowStart ? bookingInstant(stop.windowStart, timeZone) : null, window_end: stop.windowEnd ? bookingInstant(stop.windowEnd, timeZone) : null,
      service_minutes: stop.handlingMinutes ?? 10, unattended_allowed: false, photo_required: stop.podRequirement === 'PHOTO' || stop.podRequirement === 'PHOTO_AND_SIGNATURE' })),
    items: input.packages.map(item => ({ id: /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(item.id) ? item.id : crypto.randomUUID(),
      pickup_id: stopIds.get(item.pickupStopId ?? pickups[0]?.id)!, delivery_id: stopIds.get(item.deliveryStopId ?? drops[0]?.id)!,
      quantity: item.quantity, weight_kg: item.weightKg, length_cm: item.lengthCm, width_cm: item.widthCm, height_cm: item.heightCm,
      pallets: item.handlingUnit === 'PALLET' ? item.quantity : 0, fragile: item.fragile ?? false,
      dangerous_goods: item.handlingTags?.includes('DANGEROUS_GOODS') ?? false, description: item.description ?? '' })),
    accessorials: input.accessorials.map(a => ({ id: a.accessorialId, quantity: a.quantity })),
    distance_km: input.routeKm, estimated_minutes: input.estimatedMinutes,
    adjustments: input.adjustments.map(a => ({ amount: a.amount, reason: a.reason, taxable: a.taxable })),
    internal_notes: notes, imported_total: input.importedPrice, imported_tax: input.importedTaxAmount,
    external_reference: input.externalReference ?? '',
  };
}

/** Shipper bookings omit dispatcher-only commercial fields; the API binds shipper and billing account from the session. */
export function inputToShipperBooking(input: PricingOrderInput, timeZone: string): Booking {
  return { ...inputToBooking({ ...input, customerId: null, billingCustomerId: null, rateCardOverrideId: null, adjustments: [], routeKm: null, importedPrice: null, importedTaxAmount: null }, '', timeZone),
    shipper_id: null, billing_shipper_id: null };
}
