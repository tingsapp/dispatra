import type { components } from '../portal/schema';
import { client, unwrap } from '../portal/api';

export type Address = components['schemas']['Address'];
export type Shipper = components['schemas']['ShipperView'];
export type Driver = components['schemas']['DriverView'];
export type Vehicle = components['schemas']['VehicleView'];
export type CatalogItem = components['schemas']['CatalogView'];
export type RateCard = components['schemas']['RateView'];
export type Order = components['schemas']['OrderView'];
export type Quote = components['schemas']['QuoteView'];
export type Invoice = components['schemas']['InvoiceView'];
export type ShipperInput = components['schemas']['ShipperData'];
export type DriverInput = components['schemas']['DriverData'];
export type VehicleInput = components['schemas']['VehicleData-Input'];
export type RateInput = components['schemas']['RateData-Input'];
export type CatalogInput = components['schemas']['CatalogData-Input'];
export type Booking = components['schemas']['Booking-Input'];
export type SyncView = components['schemas']['SyncView'];
export type SyncChange = components['schemas']['SyncChange'];
export type AppNotification = components['schemas']['NotificationView'];

const key = () => crypto.randomUUID();
const company = (slug: string) => ({ slug });
const entity = (slug: string, identity: string) => ({ slug, identity });
const mutation = () => ({ 'Idempotency-Key': key() });

/** Operational records are always read from the tenant API. A page can request subsequent UUID pages without local fixtures. */
export const operations = {
  sync: async (slug: string, cursor?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/sync', { params: { path: company(slug), query: { cursor } } })),
  notifications: async (slug: string, before?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/notifications', { params: { path: company(slug), query: { limit: 50, before } } })),
  readNotification: async (slug: string, row: AppNotification) => unwrap(await client.POST('/api/v1/companies/{slug}/notifications/{identity}/read', { body: { version: row.version }, params: { path: entity(slug, row.id), header: mutation() } })),
  readAllNotifications: async (slug: string) => unwrap(await client.POST('/api/v1/companies/{slug}/notifications/read-all', { params: { path: company(slug), header: mutation() } })),
  driverProfile: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/driver/profile', { params: { path: company(slug) } })),
  updateDriverProfile: async (slug: string, version: number, phone: string) => unwrap(await client.PATCH('/api/v1/companies/{slug}/driver/profile', { body: { version, phone }, params: { path: company(slug), header: mutation() } })),
  driverOrders: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/driver/orders', { params: { path: company(slug) } })),
  driverRoutes: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/driver/routes', { params: { path: company(slug), query: { limit: 100, after } } })),
  startDuty: async (slug: string) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/duty', { body: {}, params: { path: company(slug), header: mutation() } })),
  endDuty: async (slug: string, duty: components['schemas']['DutyView']) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/duty/{identity}/end', { body: { version: duty.version, ended_at: new Date().toISOString() }, params: { path: entity(slug, duty.id), header: mutation() } })),
  driverLocation: async (slug: string, dutyId: string, position: GeolocationPosition) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/location', { body: { duty_id: dutyId, captured_at: new Date(position.timestamp).toISOString(), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_m: Math.max(position.coords.accuracy, 0.1), location_permission: 'GRANTED' }, params: { path: company(slug), header: mutation() } })),
  startRoute: async (slug: string, route: components['schemas']['RouteView']) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/routes/{identity}/start', { body: { version: route.version, generation: route.generation }, params: { path: entity(slug, route.id), header: mutation() } })),
  arriveStop: async (slug: string, route: components['schemas']['RouteView'], visitId: string) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/routes/{identity}/stops/{visit_id}/arrive', { body: { version: route.version, generation: route.generation, captured_at: new Date().toISOString() }, params: { path: { slug, identity: route.id, visit_id: visitId }, header: mutation() } })),
  completeStop: async (slug: string, route: components['schemas']['RouteView'], visitId: string, body: Pick<components['schemas']['StopCommand'], 'quantities' | 'recipient_name' | 'unattended' | 'safe_placement' | 'evidence_ids'>) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/routes/{identity}/stops/{visit_id}/complete', { body: { ...body, version: route.version, generation: route.generation, captured_at: new Date().toISOString() }, params: { path: { slug, identity: route.id, visit_id: visitId }, header: mutation() } })),
  finishRoute: async (slug: string, route: components['schemas']['RouteView']) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/routes/{identity}/finish', { body: { version: route.version, generation: route.generation }, params: { path: entity(slug, route.id), header: mutation() } })),
  stopEvidence: async (slug: string, stopId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/driver/stops/{identity}/evidence', { params: { path: entity(slug, stopId) } })),
  reportStopIssue: async (slug: string, stopId: string, kind: components['schemas']['IssueInput']['kind'], description: string) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/stops/{identity}/issue', { body: { kind, description }, params: { path: entity(slug, stopId), header: mutation() } })),
  uploadEvidence: async (slug: string, stopId: string, kind: 'PHOTO' | 'SIGNATURE', content: string, mediaType: 'image/png' | 'image/jpeg') => unwrap(await client.POST('/api/v1/companies/{slug}/driver/stops/{identity}/evidence', { body: { kind, captured_at: new Date().toISOString(), content_base64: content, media_type: mediaType }, params: { path: entity(slug, stopId), header: mutation() } })),
  updateOwnShipper: async (slug: string, data: components['schemas']['ShipperProfileUpdate']) => unwrap(await client.PATCH('/api/v1/companies/{slug}/shipper/profile', { body: data, params: { path: company(slug), header: mutation() } })),
  ownShipper: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/shipper/profile', { params: { path: company(slug) } })),
  bookingPreferences: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/booking-preferences', { params: { path: company(slug) } })),
  bookingDrivers: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/booking-drivers', { params: { path: company(slug) } })),
  bookingOptions: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/booking-options', { params: { path: company(slug) } })),
  shippers: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/shippers', { params: { path: company(slug), query: { limit: 200, after } } })),
  createShipper: async (slug: string, data: ShipperInput) => unwrap(await client.POST('/api/v1/companies/{slug}/shippers', { body: data, params: { path: company(slug), header: mutation() } })),
  updateShipper: async (slug: string, shipper: Shipper, data: ShipperInput, status?: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE') => unwrap(await client.PUT('/api/v1/companies/{slug}/shippers/{identity}', { body: { version: shipper.version, data, status }, params: { path: entity(slug, shipper.id), header: mutation() } })),
  archiveShipper: async (slug: string, shipper: Shipper) => unwrap(await client.POST('/api/v1/companies/{slug}/shippers/{identity}/archive', { body: { version: shipper.version }, params: { path: entity(slug, shipper.id), header: mutation() } })),
  drivers: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/drivers', { params: { path: company(slug), query: { limit: 200, after } } })),
  createDriver: async (slug: string, data: DriverInput) => unwrap(await client.POST('/api/v1/companies/{slug}/drivers', { body: data, params: { path: company(slug), header: mutation() } })),
  updateDriver: async (slug: string, driver: Driver, data: DriverInput, dutyStatus?: 'ON_DUTY' | 'OFF_DUTY') => unwrap(await client.PUT('/api/v1/companies/{slug}/drivers/{identity}', { body: { version: driver.version, data, duty_status: dutyStatus, expected_on_duty: dutyStatus ? driver.on_duty : undefined }, params: { path: entity(slug, driver.id), header: mutation() } })),
  archiveDriver: async (slug: string, driver: Driver) => unwrap(await client.POST('/api/v1/companies/{slug}/drivers/{identity}/archive', { body: { version: driver.version }, params: { path: entity(slug, driver.id), header: mutation() } })),
  vehicles: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/vehicles', { params: { path: company(slug), query: { limit: 200, after } } })),
  createVehicle: async (slug: string, data: VehicleInput) => unwrap(await client.POST('/api/v1/companies/{slug}/vehicles', { body: data, params: { path: company(slug), header: mutation() } })),
  updateVehicle: async (slug: string, vehicle: Vehicle, data: VehicleInput) => unwrap(await client.PUT('/api/v1/companies/{slug}/vehicles/{identity}', { body: { version: vehicle.version, data }, params: { path: entity(slug, vehicle.id), header: mutation() } })),
  archiveVehicle: async (slug: string, vehicle: Vehicle) => unwrap(await client.POST('/api/v1/companies/{slug}/vehicles/{identity}/archive', { body: { version: vehicle.version }, params: { path: entity(slug, vehicle.id), header: mutation() } })),
  catalog: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/catalog', { params: { path: company(slug), query: { limit: 200, after } } })),
  createCatalog: async (slug: string, kind: 'SERVICE' | 'ACCESSORIAL' | 'VEHICLE_TYPE', code: string, data: CatalogInput) => unwrap(await client.POST('/api/v1/companies/{slug}/catalog', { body: { kind, code, data }, params: { path: company(slug), header: mutation() } })),
  updateCatalog: async (slug: string, item: CatalogItem, data: CatalogInput) => unwrap(await client.PUT('/api/v1/companies/{slug}/catalog/{identity}', { body: { version: item.version, data }, params: { path: entity(slug, item.id), header: mutation() } })),
  deleteCatalog: async (slug: string, item: CatalogItem) => unwrap(await client.DELETE('/api/v1/companies/{slug}/catalog/{identity}', { body: { version: item.version }, params: { path: entity(slug, item.id), header: mutation() } })),
  rates: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/rate-cards', { params: { path: company(slug), query: { limit: 200, after } } })),
  createRate: async (slug: string, code: string, data: RateInput, isDefault: boolean) => unwrap(await client.POST('/api/v1/companies/{slug}/rate-cards', { body: { code, data, is_default: isDefault }, params: { path: company(slug), header: mutation() } })),
  updateRate: async (slug: string, rate: RateCard, data: RateInput, isDefault: boolean, active = true) => unwrap(await client.PUT('/api/v1/companies/{slug}/rate-cards/{identity}', { body: { version: rate.version, data, is_default: isDefault, active }, params: { path: entity(slug, rate.id), header: mutation() } })),
  archiveRate: async (slug: string, rate: RateCard) => unwrap(await client.POST('/api/v1/companies/{slug}/rate-cards/{identity}/archive', { body: { version: rate.version }, params: { path: entity(slug, rate.id), header: mutation() } })),
  routes: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/routes', { params: { path: company(slug), query: { limit: 100, after } } })),
  preview: async (slug: string, booking: Booking) => unwrap(await client.POST('/api/v1/companies/{slug}/pricing/preview', { body: booking, params: { path: company(slug) } })),
  createQuote: async (slug: string, booking: Booking) => unwrap(await client.POST('/api/v1/companies/{slug}/quotes', { body: booking, params: { path: company(slug), header: mutation() } })),
  sendQuote: async (slug: string, quote: Quote, recipient: string) => unwrap(await client.POST('/api/v1/companies/{slug}/quotes/{identity}/send', { body: { version: quote.version, recipient }, params: { path: entity(slug, quote.id), header: mutation() } })),
  orderTracking: async (slug: string, identity: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{identity}/tracking', { params: { path: entity(slug, identity) } })),
  deliveryProof: async (slug: string, identity: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{identity}/delivery-proof', { params: { path: entity(slug, identity) } })),
  orderRoadPath: async (slug: string, identity: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{identity}/road-path', { params: { path: entity(slug, identity) } })),
  getOrder: async (slug: string, identity: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{identity}', { params: { path: entity(slug, identity) } })),
  createOrder: async (slug: string, booking: Booking) => unwrap(await client.POST('/api/v1/companies/{slug}/orders', { body: booking, params: { path: company(slug), header: mutation() } })),
  updateOrder: async (slug: string, order: Order, booking: Booking) => unwrap(await client.PUT('/api/v1/companies/{slug}/orders/{identity}', { body: { version: order.version, booking }, params: { path: entity(slug, order.id), header: mutation() } })),
  assignOrder: async (slug: string, order: Order, driverId: string, vehicleId: string, route?: components['schemas']['RouteView']) => unwrap(await client.POST('/api/v1/companies/{slug}/orders/{identity}/assign', { body: { version: order.version, driver_id: driverId, vehicle_id: vehicleId, planned_at: route?.planned_at ?? order.scheduled_at, route_id: route?.id ?? null, route_version: route?.version ?? null }, params: { path: entity(slug, order.id), header: mutation() } })),
  completeOrder: async (slug: string, order: Order) => unwrap(await client.POST('/api/v1/companies/{slug}/orders/{identity}/complete', { body: { version: order.version }, params: { path: entity(slug, order.id), header: mutation() } })),
  releaseRoute: async (slug: string, route: components['schemas']['RouteView']) => unwrap(await client.POST('/api/v1/companies/{slug}/routes/{identity}/release', { body: { version: route.version, generation: route.generation }, params: { path: entity(slug, route.id), header: mutation() } })),
  createInvoice: async (slug: string, order: Order, actualMinutes: number | null = null) => unwrap(await client.POST('/api/v1/companies/{slug}/orders/{identity}/invoice', { body: { version: order.version, actual_minutes: actualMinutes }, params: { path: entity(slug, order.id), header: mutation() } })),
  sendInvoice: async (slug: string, invoice: Invoice) => unwrap(await client.POST('/api/v1/companies/{slug}/invoices/{identity}/send', { body: { version: invoice.version }, params: { path: entity(slug, invoice.id), header: mutation() } })),
  orders: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders', { params: { path: company(slug), query: { limit: 200, after } } })),
  quotes: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/quotes', { params: { path: company(slug), query: { limit: 200, after } } })),
  invoices: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/invoices', { params: { path: company(slug), query: { limit: 100, after } } })),
  driverActivity: async (slug: string, identity: string) => unwrap(await client.GET('/api/v1/companies/{slug}/drivers/{identity}/activity', { params: { path: entity(slug, identity) } })),
  monitor: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/monitor', { params: { path: company(slug) } })),
  analytics: async (slug: string, start?: string, end?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/analytics', { params: { path: company(slug), query: { date_from: start, date_to: end } } })),
};

async function allPages<T extends { id: string }>(page: (after?: string) => Promise<T[]>, pageSize = 200): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    const batch = await page(after);
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    const next = batch[batch.length - 1].id;
    if (next === after) throw new Error('The API did not advance to the next page.');
    after = next;
  }
}
export const allOperations = {
  driverRoutes: (slug: string) => allPages(after => operations.driverRoutes(slug, after), 100),
  shippers: (slug: string) => allPages(after => operations.shippers(slug, after)),
  drivers: (slug: string) => allPages(after => operations.drivers(slug, after)),
  vehicles: (slug: string) => allPages(after => operations.vehicles(slug, after)),
  catalog: (slug: string) => allPages(after => operations.catalog(slug, after)),
  rates: (slug: string) => allPages(after => operations.rates(slug, after)),
  routes: (slug: string) => allPages(after => operations.routes(slug, after), 100),
  orders: (slug: string) => allPages(after => operations.orders(slug, after)),
  quotes: (slug: string) => allPages(after => operations.quotes(slug, after)),
  invoices: (slug: string) => allPages(after => operations.invoices(slug, after), 100),
};
