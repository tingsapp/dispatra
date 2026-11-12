import { shipperAssignment } from './shipperAssignment';
import type { Job } from '../types';
import type { PricingOrderInput, PricingSnapshot, ChargeLine, PricingPackageInput, Zone } from '../types/pricing';
import type { Order, Shipper, RateCard, CatalogItem, Booking, EmailIntake, DraftBooking, DraftShipment } from './api';
import { canadianAddress } from './adapters';
import { bookingInstant } from './time';
import { fromDisplayDimension, fromDisplayWeight, type Units } from '../lib/units';
import { zoneForAddress } from '../lib/zoneAddress';

const amount = (value: number | string | null | undefined) => Number(value ?? 0);
const validStatus = (status: string): Job['lifecycleStatus'] =>
  status === 'INVOICED' ? 'COMPLETED' : ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status) ? status as Job['lifecycleStatus'] : 'NEW';

/** Email drafts already carry verified postal codes; initialize their zone match before the first edit. */
export function withMatchedZones(input: PricingOrderInput, zones: Zone[]): PricingOrderInput {
  return { ...input, stops: input.stops.map(stop => ({ ...stop, zoneId: zoneForAddress(stop.label ?? '', zones) })) };
}

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
    packages: facts.items.map(item => ({ id: item.id, quantity: item.quantity, weightKg: Number(item.weight_kg),
      lengthCm: Number(item.length_cm), widthCm: Number(item.width_cm), heightCm: Number(item.height_cm),
      declaredValue: 0, description: item.description, fragile: item.fragile, pickupStopId: item.pickup_id, deliveryStopId: item.delivery_id, packageTypeId: item.package_type_id ?? null,
      handlingUnit: item.pallets > 0 ? 'PALLET' : undefined, palletsPerUnit: item.pallets,
      handlingTags: item.dangerous_goods ? ['DANGEROUS_GOODS'] : [],
    })),
    accessorials: facts.accessorials.map(a => ({ accessorialId: a.id, quantity: Number(a.quantity) })),
    source: order.source === 'SHIPPER_PORTAL' || order.source === 'EMAIL' || order.source === 'IMPORT' ? order.source : 'DISPATCHER',
    importedPrice: facts.imported_total == null ? null : Number(facts.imported_total), importedTaxAmount: facts.imported_tax == null ? null : Number(facts.imported_tax),
    externalSource: null, externalReference: facts.external_reference, adjustments: facts.adjustments.map((a, i) => ({ id: String(i), amount: Number(a.amount), reason: a.reason, taxable: a.taxable })),
    requiredDriverId: shipperAssignment(order)?.id ?? null, requiredDriverName: shipperAssignment(order)?.name ?? null,
    rateCardOverrideId: facts.rate_card_id ?? null, preferredDriverId: facts.preferred_driver_id ?? null, stage: order.pricing.stage,
  };
}

/** An Order agent draft (possibly incomplete) as order-form input; missing values stay blank for the dispatcher to fill. */
export function draftToInput(draft: Record<string, unknown>, extraction?: Record<string, unknown> | null, units?: Units): PricingOrderInput {
  const facts = draft as unknown as Partial<DraftBooking>;
  const blank = { text: '', city: '', province: '', postal_code: '', country: 'CA' as const };
  const extractedStops = extraction?.stops as Array<{ address?: { street?: string; city?: string; province?: string; postal_code?: string } }> | undefined;
  const stops = (facts.stops ?? []).map((stop, index) => {
    const original = extractedStops?.[index]?.address;
    const recovered = !stop.address && original ? { text: [original.street, original.city, original.province, original.postal_code].filter(Boolean).join(', '), city: original.city ?? '', province: original.province ?? '', postal_code: original.postal_code ?? '' } : {};
    return { ...stop, id: stop.id || crypto.randomUUID(), address: { ...blank, ...recovered, ...stop.address }, contact_name: stop.contact_name ?? '', phone: stop.phone ?? '', instructions: stop.instructions ?? '' };
  });
  for (const kind of ['PICKUP', 'DROPOFF'] as const) {
    if (!stops.some(stop => stop.kind === kind)) stops.push({ id: crypto.randomUUID(), kind, address: blank, contact_name: '', phone: '', instructions: '', service_minutes: 10, unattended_allowed: false, photo_required: false });
  }
  const extractedItems = extraction?.items as Array<Record<string, unknown>> | undefined;
  const rawItems = (facts.items?.length ? facts.items : [{ id: crypto.randomUUID() }]).map((item, index) => {
    // Older agent drafts omitted stated numbers when their units were missing. Recover only
    // before the first manual save, which always stores internal_notes (including an empty value).
    const original = !('internal_notes' in draft) ? extractedItems?.[index] : undefined;
    if (!original || !units) return item;
    const recovered = { ...item };
    const measurementUnits: Units = { ...units, weightUnit: original.weight_unit === 'kg' || original.weight_unit === 'lb' ? original.weight_unit : units.weightUnit,
      dimensionUnit: original.dimension_unit === 'cm' || original.dimension_unit === 'in' ? original.dimension_unit : units.dimensionUnit };
    for (const [field, source, convert] of [['weight_kg', 'weight_each', fromDisplayWeight], ['length_cm', 'length', fromDisplayDimension], ['width_cm', 'width', fromDisplayDimension], ['height_cm', 'height', fromDisplayDimension]] as const) {
      const number = original[source];
      if (recovered[field] == null && typeof number === 'number' && number > 0) recovered[field] = Number(convert(number, measurementUnits).toFixed(2));
    }
    if (recovered.quantity == null && typeof original.quantity === 'number' && original.quantity > 0) recovered.quantity = original.quantity;
    return recovered;
  });
  const fields = { quantity: 'quantity', weightKg: 'weight_kg', lengthCm: 'length_cm', widthCm: 'width_cm', heightCm: 'height_cm' } as const;
  const items = rawItems.map(item => ({ ...item, quantity: item.quantity ?? 0, weight_kg: item.weight_kg ?? 0, length_cm: item.length_cm ?? 0, width_cm: item.width_cm ?? 0, height_cm: item.height_cm ?? 0 }));
  const order = { booking: {}, facts: { accessorials: [], adjustments: [], external_reference: '', ...facts, stops, items }, shipper_id: facts.shipper_id ?? null, billing_shipper_id: facts.billing_shipper_id ?? facts.shipper_id ?? null,
    service_id: facts.service_id ?? '', scheduled_at: facts.scheduled_at ?? '', source: 'EMAIL', pricing: { stage: 'ESTIMATE' } } as unknown as Order;
  const input = orderToInput(order);
  input.stops = input.stops.map(stop => stop.type === 'PICKUP' && !stop.windowStart && input.scheduledAt && stop.id === input.stops.find(s => s.type === 'PICKUP')?.id ? { ...stop, windowStart: input.scheduledAt } : stop);
  input.packages = input.packages.map((item, index) => ({ ...item, missingFields: (Object.keys(fields) as Array<keyof typeof fields>).filter(field => rawItems[index][fields[field]] == null) }));
  return input;
}

/** An Order agent draft as an Orders-list row: the same columns as an Order, blank wherever the email left a fact out. */
export function emailDraftRow(intake: EmailIntake, shippers: Shipper[], catalog: CatalogItem[]) {
  const draft = (intake.draft ?? {}) as { shipper_id?: string | null; service_id?: string | null; scheduled_at?: string | null; external_reference?: string; stops?: Array<{ kind: string; address?: { text?: string } | null }> };
  const stops = draft.stops ?? [];
  const shipper = shippers.find(row => row.id === (draft.shipper_id ?? intake.shipper_id));
  return {
    id: intake.id, shipper: shipper?.name ?? '', phone: shipper?.phone ?? '', from: intake.from_address,
    pickup: stops.find(stop => stop.kind === 'PICKUP')?.address?.text ?? '', dropoff: [...stops].reverse().find(stop => stop.kind === 'DROPOFF')?.address?.text ?? '',
    scheduledAt: draft.scheduled_at ?? '', stops: stops.length, service: catalog.find(row => row.id === draft.service_id)?.data.name ?? '', reference: draft.external_reference ?? '',
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
  const visualStatus = status === 'COMPLETED' ? 'completed' : status === 'NEW' ? 'no_driver' : 'on_time';
  return {
    id: order.id, version: order.version, jobNumber: order.number, lifecycleStatus: status,
    creationSource: order.source, externalReference: order.facts.external_reference,
    status: visualStatus, statusLabel: status === 'NEW' ? 'No Driver' : status === 'COMPLETED' ? 'Completed' : 'On Time',
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
  const missing = input.packages.flatMap((item, index) => (item.missingFields ?? []).map(field => `Package ${index + 1}: ${field === 'weightKg' ? 'weight' : field.replace('Cm', '')}`));
  if (missing.length) throw new Error(`Complete the missing details: ${missing.join(', ')}.`);
  return serializeBooking(input, notes, timeZone, false) as Booking;
}

export function inputToDraftBooking(input: PricingOrderInput, notes = '', timeZone = 'America/Vancouver'): DraftBooking {
  return serializeBooking(input, notes, timeZone, true) as DraftBooking;
}

function serializeBooking(input: PricingOrderInput, notes: string, timeZone: string, partial: boolean) {
  const instant = (value: string | null | undefined) => value ? bookingInstant(value, timeZone) : null;
  const packageValue = (item: PricingPackageInput, key: NonNullable<PricingPackageInput['missingFields']>[number]) => partial && item.missingFields?.includes(key) ? null : item[key];
  const stopIds = new Map(input.stops.map(stop => [stop.id, /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(stop.id) ? stop.id : crypto.randomUUID()]));
  const pickups = input.stops.filter(stop => stop.type === 'PICKUP');
  const drops = input.stops.filter(stop => stop.type === 'DROPOFF');
  return {
    shipper_id: input.customerId, billing_shipper_id: input.billingCustomerId ?? input.customerId,
    rate_card_id: input.rateCardOverrideId, service_id: input.serviceId || null, vehicle_type_id: input.vehicleId, preferred_driver_id: input.preferredDriverId ?? null,
    scheduled_at: instant(input.scheduledAt),
    stops: input.stops.map(stop => ({ id: stopIds.get(stop.id)!, kind: stop.type, address: partial ? { text: stop.label ?? '', city: stop.city ?? '', province: stop.provinceCode ?? '', postal_code: stop.postalCode ?? '', country: 'CA' as const, latitude: stop.latitude ?? null, longitude: stop.longitude ?? null } : canadianAddress(stop.label ?? '', undefined, { latitude: stop.latitude ?? null, longitude: stop.longitude ?? null, city: stop.city, province: stop.provinceCode, postalCode: stop.postalCode, country: stop.countryCode }),
      contact_name: stop.contactName ?? '', phone: stop.contactPhone ?? '', instructions: stop.instructions ?? '',
      window_start: stop.windowStart ? bookingInstant(stop.windowStart, timeZone) : null, window_end: stop.windowEnd ? bookingInstant(stop.windowEnd, timeZone) : null,
      service_minutes: stop.handlingMinutes ?? 10, unattended_allowed: false, photo_required: stop.podRequirement === 'PHOTO' || stop.podRequirement === 'PHOTO_AND_SIGNATURE' })),
    items: input.packages.map(item => ({ id: /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(item.id) ? item.id : crypto.randomUUID(),
      pickup_id: stopIds.get(item.pickupStopId ?? (pickups.length === 1 ? pickups[0].id : '')) ?? null, delivery_id: stopIds.get(item.deliveryStopId ?? (drops.length === 1 ? drops[0].id : '')) ?? null,
      quantity: packageValue(item, 'quantity'), weight_kg: packageValue(item, 'weightKg'), length_cm: packageValue(item, 'lengthCm'), width_cm: packageValue(item, 'widthCm'), height_cm: packageValue(item, 'heightCm'),
      pallets: item.palletsPerUnit ?? (item.handlingUnit === 'PALLET' ? 1 : 0), fragile: item.fragile ?? false,
      dangerous_goods: item.handlingTags?.includes('DANGEROUS_GOODS') ?? false, description: item.description ?? '', package_type_id: item.packageTypeId ?? null })),
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

/** Shippers may submit shipment facts, never dispatcher commercial settings or internal notes. */
export function inputToDraftShipment(input: PricingOrderInput, timeZone: string): DraftShipment {
  const { service_id, vehicle_type_id, preferred_driver_id, scheduled_at, stops, items, accessorials, external_reference } = inputToDraftBooking(input, '', timeZone);
  return { service_id, vehicle_type_id, preferred_driver_id, scheduled_at, stops, items, accessorials, external_reference };
}
