import type { Booking } from '../operations/api';

export type TmsPreview = {
  id: string;
  name: string;
  tmsName: string;
  enabled: boolean;
  syncMethod: 'webhook' | 'polling';
  baseApiUrl: string;
  ordersEndpoint: string;
  authType: 'api_key' | 'bearer';
  pollIntervalMinutes: 1 | 5 | 15;
  importNewOrders: boolean;
  importOrderUpdates: boolean;
  importOrderCancellations: boolean;
  credentialConfigured: boolean;
  webhookSecretConfigured: boolean;
  status: 'not_configured' | 'connected' | 'error' | 'disabled';
};
export type OutboundPreview = { url: string; secretConfigured: boolean; saved: boolean };
export type IntegrationsPreview = { tms: TmsPreview; outbound: OutboundPreview; apiKey: string };

/** Obviously non-production values; only mock API keys are retained in workspace memory. */
export const testSecret = (kind: 'api' | 'webhook') => `dsp_test_${kind}_preview_${crypto.randomUUID().replaceAll('-', '')}`;
export function createIntegrationsPreview(): IntegrationsPreview {
  return {
    tms: { id: `preview-${crypto.randomUUID()}`, name: '', tmsName: '', enabled: true, syncMethod: 'webhook',
      baseApiUrl: '', ordersEndpoint: '/orders', authType: 'api_key', pollIntervalMinutes: 5,
      importNewOrders: true, importOrderUpdates: true, importOrderCancellations: true,
      credentialConfigured: false, webhookSecretConfigured: false, status: 'not_configured' },
    outbound: { url: '', secretConfigured: false, saved: false }, apiKey: testSecret('api'),
  };
}
export function httpsUrlError(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error();
  } catch { return 'Enter a complete HTTPS URL without embedded credentials or a fragment.'; }
}
export function tmsErrors(settings: TmsPreview, credential = '', webhookSecret = ''): string[] {
  if (!settings.enabled) return [];
  const errors: string[] = [];
  if (!settings.name.trim()) errors.push('Enter an integration name.');
  if (!settings.tmsName.trim()) errors.push('Enter the TMS name.');
  if (settings.syncMethod === 'webhook') {
    if (!webhookSecret.trim() && !settings.webhookSecretConfigured) errors.push('Generate a test webhook secret.');
  } else {
    const urlError = httpsUrlError(settings.baseApiUrl.trim());
    if (urlError) errors.push(urlError);
    if (!settings.ordersEndpoint.startsWith('/') || settings.ordersEndpoint.startsWith('//') || /[\s#]/.test(settings.ordersEndpoint)) errors.push('Enter an orders path starting with /, such as /orders.');
    if (!credential.trim() && !settings.credentialConfigured) errors.push('Enter a test credential.');
    if (!(settings.importNewOrders || settings.importOrderUpdates || settings.importOrderCancellations)) errors.push('Select at least one import option.');
  }
  return errors;
}
export const inboundEvents = ['order.created', 'order.updated', 'order.cancelled'];
/** Proposed external names, not a claim that the internal event log already emits these names. */
export const outboundEvents = ['order.accepted', 'order.rejected', 'order.updated', 'order.cancelled', 'dispatch.assigned',
  'driver.en_route', 'driver.arrived', 'stop.completed', 'order.completed', 'order.failed', 'exception.created', 'pod.created'];
export const previewWebhookUrl = (slug: string, identity: string) => `https://api.example.invalid/api/v1/companies/${encodeURIComponent(slug)}/integrations/${identity}/events`;

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
