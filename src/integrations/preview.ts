import type { Booking, FleetSyncResult, TmsInput, TmsView } from '../operations/api';

export type TmsRecord = 'driver' | 'vehicle' | 'order';
/** Dispatra field key → TMS field name or dotted path. */
export type TmsFieldMap = Record<string, string>;
export type TmsFieldGroup = 'order' | 'shipper' | 'stop' | 'item';
export type TmsField = { key: string; label: string; required?: boolean; group?: TmsFieldGroup; placeholder?: string };
const fields = (group: TmsFieldGroup | undefined, prefix: string, rows: [key: string, label: string, required?: boolean][]): TmsField[] =>
  rows.map(([key, label, required]) => ({ key: `${prefix}${key}`, label, required, group }));
const address = (required: boolean): [string, string, boolean][] =>
  [['address', 'Address', required], ['city', 'City', required], ['province', 'Province', required], ['postal_code', 'Postal code', required]];
/** Dispatra fields a TMS record fills, following the API inputs. Required rows have no Dispatra default; `stop.*` and `item.*` rows are read from each list entry. */
export const TMS_FIELDS: Record<TmsRecord, TmsField[]> = {
  driver: fields(undefined, '', [['id', 'TMS driver ID', true], ['name', 'Name', true], ['email', 'Email', true], ['phone', 'Phone', true],
    ...address(true), ['vehicle_unit', 'Truck unit'], ['active', 'Active']]),
  vehicle: fields(undefined, '', [['id', 'TMS vehicle ID', true], ['unit_number', 'Unit number', true], ['name', 'Name'], ['vehicle_type', 'Vehicle type', true],
    ['plate', 'Plate', true], ['province', 'Plate province', true], ['payload', 'Payload'], ['length', 'Length'], ['width', 'Width'], ['height', 'Height'],
    ['pallet_capacity', 'Pallet capacity'], ['make_model', 'Make and model'], ['year', 'Year'], ['vin', 'VIN'], ['active', 'Active']]),
  order: [
    ...fields('order', '', [['id', 'TMS order ID', true], ['scheduled_at', 'Scheduled time', true], ['service', 'Service level', true],
      ['vehicle_type', 'Vehicle type'], ['total', 'Total price', true], ['tax', 'Tax', true], ['notes', 'Notes'], ['status', 'Order status']]),
    { key: 'cancelled_value', label: 'Cancelled value', group: 'order', placeholder: 'CANCELLED' },
    ...fields('shipper', 'shipper.', [['id', 'TMS shipper ID', true], ['name', 'Name', true], ['company_name', 'Company name'], ['email', 'Email', true],
      ['phone', 'Phone'], ...address(false)]),
    ...fields('stop', '', [['stops', 'Stop list', true]]),
    ...fields('stop', 'stop.', [['id', 'Stop ID'], ['type', 'Stop type', true]]),
    { key: 'stop.pickup_value', label: 'Pickup value', required: true, group: 'stop', placeholder: 'PICKUP' },
    { key: 'stop.delivery_value', label: 'Drop-off value', required: true, group: 'stop', placeholder: 'DELIVERY' },
    ...fields('stop', 'stop.', [...address(true), ['window_start', 'Window start'], ['window_end', 'Window end'],
      ['contact', 'Contact'], ['phone', 'Phone'], ['instructions', 'Instructions']]),
    ...fields('item', '', [['items', 'Item list', true]]),
    ...fields('item', 'item.', [['pickup_stop', 'Pickup stop ID'], ['delivery_stop', 'Drop-off stop ID'], ['quantity', 'Quantity'],
      ['weight', 'Weight', true], ['length', 'Length', true], ['width', 'Width', true], ['height', 'Height', true],
      ['pallets', 'Pallets'], ['fragile', 'Fragile'], ['dangerous_goods', 'Dangerous goods'], ['description', 'Description']]),
  ],
};
export const TMS_FIELD_GROUPS: Record<TmsFieldGroup, { title: string; hint: string }> = {
  order: { title: 'Order', hint: 'The TMS order ID becomes the order reference. When Order status equals the Cancelled value, the order is cancelled.' },
  shipper: { title: 'Shipper', hint: 'Matched by TMS shipper ID, then email; otherwise created. Without an address, the first pickup becomes the warehouse.' },
  stop: { title: 'Stops', hint: 'Read from each stop, in TMS order. Enter the values your TMS uses for pickup and drop-off.' },
  item: { title: 'Cargo items', hint: 'Read from each item. Weight and size are per unit. Stop IDs link items to stops and can stay empty for one pickup and one drop-off. Quantity defaults to 1.' },
};
export const TMS_MAP_HINTS: Record<TmsRecord, string> = {
  driver: 'Enter the TMS field for each Dispatra field.',
  vehicle: 'Enter the TMS field for each Dispatra field. Empty name, payload, size and pallet fields use the unit number and vehicle type.',
  order: 'Enter the TMS field for each Dispatra field.',
};
/** Connected TMS form state. Saved values come from the API; credentials and secrets stay outside it. */
export type TmsForm = {
  enabled: boolean;
  baseApiUrl: string;
  authType: 'api_key' | 'bearer';
  credentialConfigured: boolean;
  syncMethod: 'webhook' | 'polling';
  webhookSecretConfigured: boolean;
  ordersEndpoint: string;
  pollIntervalMinutes: 1 | 5 | 15;
  statusEndpoint: string;
  driversEndpoint: string;
  vehiclesEndpoint: string;
  fleetSyncMinutes: 15 | 60 | 360 | 1440;
  fieldMaps: Record<TmsRecord, TmsFieldMap>;
  version: number | null;
};
export const EMPTY_TMS: TmsForm = { enabled: true, baseApiUrl: '', authType: 'api_key', credentialConfigured: false, syncMethod: 'webhook',
  webhookSecretConfigured: false, ordersEndpoint: '/orders', pollIntervalMinutes: 5, statusEndpoint: '/orders/{id}/status',
  driversEndpoint: '/drivers', vehiclesEndpoint: '/vehicles', fleetSyncMinutes: 60, fieldMaps: { driver: {}, vehicle: {}, order: {} }, version: null };
/** API view → form. */
export function tmsForm(view: TmsView | null | undefined): TmsForm {
  if (!view) return structuredClone(EMPTY_TMS);
  const maps = view.field_maps as Partial<Record<TmsRecord, TmsFieldMap>>;
  return { enabled: view.enabled, baseApiUrl: view.base_url, authType: view.auth_type as TmsForm['authType'], credentialConfigured: view.credential_configured,
    syncMethod: view.sync_method as TmsForm['syncMethod'], webhookSecretConfigured: view.webhook_secret_configured, ordersEndpoint: view.orders_endpoint,
    pollIntervalMinutes: view.poll_interval_minutes as TmsForm['pollIntervalMinutes'], statusEndpoint: view.status_endpoint,
    driversEndpoint: view.drivers_endpoint, vehiclesEndpoint: view.vehicles_endpoint, fleetSyncMinutes: view.fleet_sync_minutes as TmsForm['fleetSyncMinutes'],
    fieldMaps: { driver: maps.driver ?? {}, vehicle: maps.vehicle ?? {}, order: maps.order ?? {} }, version: view.version };
}
/** Form → API input. Secrets are sent only when newly entered. */
export function tmsInput(form: TmsForm, credential: string, webhookSecret: string): TmsInput {
  return { enabled: form.enabled, base_url: form.baseApiUrl.trim(), auth_type: form.authType, credential: credential.trim() || null,
    drivers_endpoint: form.driversEndpoint, vehicles_endpoint: form.vehiclesEndpoint, fleet_sync_minutes: form.fleetSyncMinutes, sync_method: form.syncMethod,
    webhook_secret: webhookSecret.trim() || null, orders_endpoint: form.ordersEndpoint, poll_interval_minutes: form.pollIntervalMinutes,
    status_endpoint: form.statusEndpoint, field_maps: form.fieldMaps, version: form.version };
}

const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
export function httpsUrlError(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error();
  } catch { return 'Enter a complete HTTPS URL without embedded credentials or a fragment.'; }
}
const pathError = (path: string) => !path.startsWith('/') || path.startsWith('//') || /[\s#?]/.test(path);
/** The TMS API connection is always required: it reads drivers and vehicles and receives status updates. */
/** One sentence for the last fleet sync, e.g. "2 drivers and 1 vehicle added, 1 skipped." */
export function fleetSummary(result: FleetSyncResult): string {
  if (result.error || !result.drivers || !result.vehicles) return 'The last sync could not reach the TMS.';
  const total = (key: 'created' | 'updated' | 'skipped' | 'archived') => result.drivers![key] + result.vehicles![key];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  const added = [result.drivers.created && count(result.drivers.created, 'driver'), result.vehicles.created && count(result.vehicles.created, 'vehicle')].filter(Boolean).join(' and ');
  const parts = [added && `${added} added`, total('updated') && `${total('updated')} updated`, total('archived') && `${total('archived')} archived`, total('skipped') && `${total('skipped')} skipped`].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.`.replace(/^./, c => c.toUpperCase()) : 'No changes.';
}
/** Mirrors the API's TmsInput checks so Save is enabled only for a request the API accepts. */
export function tmsErrors(settings: TmsForm, credential = '', webhookSecret = ''): string[] {
  const errors: string[] = [];
  const urlError = httpsUrlError(settings.baseApiUrl.trim()) ?? (new URL(settings.baseApiUrl.trim()).search ? 'Remove the query from the TMS address.' : undefined);
  if (urlError) errors.push(urlError);
  if (!credential.trim() && !settings.credentialConfigured) errors.push('Enter the TMS API key or token.');
  if (settings.syncMethod === 'webhook') {
    if (!webhookSecret.trim() && !settings.webhookSecretConfigured) errors.push('Generate a webhook secret.');
  } else if (pathError(settings.ordersEndpoint)) errors.push('Enter an orders path starting with /, such as /orders.');
  if (pathError(settings.statusEndpoint) || !settings.statusEndpoint.includes('{id}')) errors.push('Enter a status path with {id}, such as /orders/{id}/status.');
  if (pathError(settings.driversEndpoint)) errors.push('Enter a drivers path starting with /, such as /drivers.');
  if (pathError(settings.vehiclesEndpoint)) errors.push('Enter a vehicles path starting with /, such as /vehicles.');
  return errors;
}
/** Order events exactly as Dispatra records them in its event log. */
export const ORDER_EVENTS = [
  { event: 'order.created', label: 'Order created' }, { event: 'order.updated', label: 'Order changed' }, { event: 'order.cancelled', label: 'Order cancelled' },
  { event: 'order.assigned', label: 'Driver assigned' }, { event: 'order.unassigned', label: 'Driver removed' }, { event: 'order.started', label: 'Driver started the route' },
  { event: 'stop.arrived', label: 'Driver arrived at a stop' }, { event: 'stop.completed', label: 'Stop completed' },
  { event: 'evidence.accepted', label: 'Proof of delivery added' },
  { event: 'issue.reported', label: 'Issue reported' }, { event: 'issue.resolved', label: 'Issue resolved' },
  { event: 'order.completion_held', label: 'Completion held for an issue' }, { event: 'order.completed', label: 'Order completed' },
] as const;
export type ApiEndpoint = { method: 'GET' | 'POST' | 'PUT'; path: string; label: string };
export type ApiResource = { id: string; title: string; description: string; endpoints: ApiEndpoint[] };
const crud = (base: string, name: string): ApiEndpoint[] => [
  { method: 'GET', path: base, label: `List ${name}s` }, { method: 'POST', path: base, label: `Create a ${name}` },
  { method: 'GET', path: `${base}/{id}`, label: `Get a ${name}` }, { method: 'PUT', path: `${base}/{id}`, label: `Update a ${name}` },
  { method: 'POST', path: `${base}/{id}/archive`, label: `Archive a ${name}` },
];
/** Existing company-scoped API endpoints offered to external systems. Services are read-only because they set pricing. */
export function apiResources(slug: string): ApiResource[] {
  const base = `/api/v1/companies/${encodeURIComponent(slug)}`;
  return [
    { id: 'orders', title: 'Orders API', description: 'Create, update, cancel and track orders.', endpoints: [
      { method: 'GET', path: `${base}/orders`, label: 'List orders' }, { method: 'POST', path: `${base}/orders`, label: 'Create an order' },
      { method: 'GET', path: `${base}/orders/{id}`, label: 'Get an order' }, { method: 'PUT', path: `${base}/orders/{id}`, label: 'Update an order' },
      { method: 'POST', path: `${base}/orders/{id}/cancel`, label: 'Cancel an order' }, { method: 'GET', path: `${base}/orders/{id}/tracking`, label: 'Track an order' },
      { method: 'GET', path: `${base}/orders/{id}/delivery-proof`, label: 'Get proof of delivery' }] },
    { id: 'shippers', title: 'Shippers API', description: 'Manage shippers.', endpoints: crud(`${base}/shippers`, 'shipper') },
    { id: 'drivers', title: 'Drivers API', description: 'Manage drivers.', endpoints: crud(`${base}/drivers`, 'driver') },
    { id: 'vehicles', title: 'Vehicles API', description: 'Manage vehicles.', endpoints: crud(`${base}/vehicles`, 'vehicle') },
    { id: 'catalog', title: 'Services & vehicle types API', description: 'Read services, accessorials and vehicle types.', endpoints: [
      { method: 'GET', path: `${base}/catalog`, label: 'List services, accessorials and vehicle types' }] },
  ];
}
/** The company's TMS webhook address on this Dispatra origin (the API is served under `/api`). */
export const tmsWebhookUrl = (origin: string, slug: string) => `${origin}/api/v1/companies/${encodeURIComponent(slug)}/integrations/tms/events`;
/** 256-bit webhook signing secret shown in the form; it is never written to saved settings or browser storage. */
export const webhookSecret = () => `whsec_${randomHex(32)}`;

/** Typed against the existing Booking schema; catalogue and Shipper IDs are example UUIDs to replace. */
export const exampleBooking = {
  shipper_id: '00000000-0000-4000-8000-000000000001', service_id: '00000000-0000-4000-8000-000000000002',
  vehicle_type_id: '00000000-0000-4000-8000-000000000003', scheduled_at: '2026-10-08T09:00:00-07:00', external_reference: 'PO-29384',
  stops: [
    { id: '00000000-0000-4000-8000-000000000004', kind: 'PICKUP', address: { text: '123 Main Street, Vancouver, BC V6A 2S5', city: 'Vancouver', province: 'BC', postal_code: 'V6A 2S5', country: 'CA' }, window_start: '2026-10-08T09:00:00-07:00', window_end: '2026-10-08T10:00:00-07:00', instructions: 'Call on arrival', contact_name: '', phone: '', service_minutes: 10, unattended_allowed: false, photo_required: false },
    { id: '00000000-0000-4000-8000-000000000005', kind: 'DROPOFF', address: { text: '456 Oak Street, Burnaby, BC V5H 2A9', city: 'Burnaby', province: 'BC', postal_code: 'V5H 2A9', country: 'CA' }, window_start: '2026-10-08T10:30:00-07:00', window_end: '2026-10-08T12:00:00-07:00', instructions: '', contact_name: '', phone: '', service_minutes: 10, unattended_allowed: false, photo_required: false },
  ],
  items: [{ id: '00000000-0000-4000-8000-000000000006', pickup_id: '00000000-0000-4000-8000-000000000004', delivery_id: '00000000-0000-4000-8000-000000000005', quantity: 1, weight_kg: 650, length_cm: 100, width_cm: 80, height_cm: 100, pallets: 1, description: 'Pallet', fragile: false, dangerous_goods: false }],
  accessorials: [], adjustments: [], internal_notes: '',
} satisfies Booking;
