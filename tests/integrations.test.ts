import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import type { ApiWebhookInput, ApiWebhookView, RateCard, TmsInboxItem, TmsInput, TmsView } from '../src/operations/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/integrations', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, fireEvent, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { IntegrationsPage } = await import('../src/pages/IntegrationsPage');
const { Sidebar } = await import('../src/components/Sidebar');
const { ConfirmDialogHost } = await import('../src/components/ui/ConfirmDialog');
const { SETTINGS_NAVIGATION_EVENT } = await import('../src/components/settings/useSettingsGuard');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
/** In-memory stand-in for the TMS connection endpoints: secrets arrive in requests but never appear in views. */
const server = { apiKey: null as null | { prefix: string; created_at: string }, created: [] as string[], view: null as TmsView | null, inputs: [] as TmsInput[], tests: 0, inbox: [] as TmsInboxItem[], retried: [] as string[],
  webhook: null as ApiWebhookView | null, webhookInputs: [] as ApiWebhookInput[] };
Object.assign(operations, {
  tms: async () => server.view,
  saveTms: async (_slug: string, input: TmsInput) => {
    server.inputs.push(input);
    const { credential, webhook_secret, version: _version, ...rest } = input;
    server.view = { ...rest, credential_configured: !!credential || !!server.view?.credential_configured,
      webhook_secret_configured: !!webhook_secret || !!server.view?.webhook_secret_configured, missing_fields: {}, last_fleet_sync_at: null,
      last_fleet_result: null, last_order_poll_at: null, last_error: null, version: (server.view?.version ?? 0) + 1 } as TmsView;
    return server.view;
  },
  testTms: async () => { server.tests++; return { ok: true, message: 'Connected.' }; },
  tmsInbox: async () => server.inbox,
  apiKey: async () => ({ configured: !!server.apiKey, prefix: server.apiKey?.prefix ?? null, created_at: server.apiKey?.created_at ?? null, last_used_at: null }),
  createApiKey: async () => {
    const key = `dsp_${String(server.created.length).repeat(64)}`; server.created.push(key);
    server.apiKey = { prefix: key.slice(0, 12), created_at: '2026-10-10T18:00:00Z' };
    return { configured: true, prefix: server.apiKey.prefix, created_at: server.apiKey.created_at, last_used_at: null, key };
  },
  apiWebhook: async () => server.webhook,
  saveApiWebhook: async (_slug: string, input: ApiWebhookInput) => {
    server.webhookInputs.push(input);
    server.webhook = { url: input.url, enabled: true, secret_configured: true, last_delivery_at: null, last_error: null, version: (server.webhook?.version ?? 0) + 1 };
    return server.webhook;
  },
  retryTmsOrder: async (_slug: string, id: string) => { server.retried.push(id); server.inbox = server.inbox.filter(row => row.id !== id); return {}; },
  dismissTmsOrder: async (_slug: string, id: string) => { server.inbox = server.inbox.filter(row => row.id !== id); return {}; },
  syncTms: async () => {
    const result = { drivers: { created: 2, updated: 0, unchanged: 0, skipped: 1, archived: 0 }, vehicles: { created: 1, updated: 0, unchanged: 0, skipped: 0, archived: 0 },
      issues: [{ kind: 'driver', id: 'DRV-3', reason: 'Home address is incomplete or not a Canadian address' }], error: null };
    server.view = { ...server.view!, last_fleet_sync_at: '2026-10-10T18:00:00Z', last_fleet_result: result };
    return result;
  },
});
const originalFetch = globalThis.fetch;
const rates = [
  { id: 'rc-distance', version: 1, created_at: '', code: 'STD', active: true, is_default: true, data: { name: 'Distance based', method: 'BASE_PLUS_DISTANCE' } },
  { id: 'rc-imported', version: 1, created_at: '', code: 'TMS', active: true, is_default: false, data: { name: 'Imported price (TMS)', method: 'IMPORTED' } },
] as unknown as RateCard[];
function Preview({ withRates = true }: { withRates?: boolean }) {
  return React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost),
    React.createElement(IntegrationsPage, withRates ? { rates } : {}));
}
const mount = async (withRates = true) => {
  render(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }) }, React.createElement(Preview, { withRates })));
  await screen.findByLabelText('Base API URL');
  return userEvent.setup({ document });
};
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const connect = () => {
  fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'https://api.example.com' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-only-credential' } });
};
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; Object.assign(server, { view: null, inputs: [], tests: 0, inbox: [], retried: [], webhook: null, webhookInputs: [], apiKey: null, created: [] }); });

test('defaults to webhooks in three expandable cards with real integration wording', async () => {
  await mount();
  assert.equal(screen.getByRole('tab', { name: 'Connected TMS' }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.queryByText('Interface preview.'), null);
  const tms = within(screen.getByRole('tabpanel', { name: 'Connected TMS' }));
  assert.equal(tms.queryByText(/test value|example|preview|mock/i), null);
  assert.equal(screen.queryByLabelText('Integration name'), null);
  const cards = [...screen.getByRole('tabpanel', { name: 'Connected TMS' }).querySelectorAll<HTMLDetailsElement>('details.app-disclosure')].map(card => [card.querySelector('summary .app-section-title')!.textContent, card.open]);
  assert.deepEqual(cards, [['Connection', false], ['Driver & Vehicle APIs', false], ['Order webhook/polling', false]]);
  assert.equal((screen.getByRole('radio', { name: /^Webhoook/ }) as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText('Webhook URL') as HTMLInputElement).value, 'http://localhost/api/v1/companies/acme/integrations/tms/events');
  assert.ok(screen.getByLabelText('Base API URL'));
  assert.equal((screen.getByLabelText('Drivers endpoint') as HTMLInputElement).value, '/drivers');
  assert.equal((screen.getByLabelText('Vehicles endpoint') as HTMLInputElement).value, '/vehicles');
  assert.match(screen.getByRole('combobox', { name: 'Sync interval' }).textContent!, /Every 1 hour/);
  assert.equal(screen.queryByRole('switch', { name: 'Send order status to TMS' }), null);
  assert.equal(screen.queryByRole('switch', { name: 'Import drivers and vehicles' }), null);
  assert.equal(screen.queryByRole('list', { name: 'Configuration requirements' }), null);
  assert.ok(screen.getByText(/Order status is sent back to your TMS at this endpoint.*Orders use the Imported price \(TMS\) rate card\./));
  for (const label of ['Status', 'Last sync']) assert.equal(screen.queryByText(label), null);
  const enable = screen.getByRole('switch', { name: 'Enable TMS integration' });
  assert.equal(enable.getAttribute('aria-checked'), 'true'); assert.equal(enable.closest('label')!.textContent, 'Enabled');
  assert.equal(enable.closest('label')!.parentElement, button('Test connection').parentElement);
  assert.equal(button('Save changes').disabled, true); assert.equal(button('Sync now').disabled, true);
});

test('saving sends secrets once and keeps them out of form state; test checks the saved connection', async () => {
  const user = await mount(); let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('Network must go through the API layer'); }) as typeof fetch;
  assert.equal(button('Test connection').disabled, true);
  connect();
  await user.click(button('Generate secret'));
  const secret = screen.getByLabelText('Webhook secret') as HTMLInputElement;
  const value = secret.value; assert.match(value, /^whsec_[0-9a-f]{64}$/); assert.equal(secret.type, 'password');
  await user.click(button('Show webhook secret')); assert.equal(secret.type, 'text');
  assert.equal(button('Hide webhook secret').getAttribute('aria-pressed'), 'true');
  await user.click(button('Hide webhook secret')); assert.equal(secret.type, 'password');
  await user.click(button('Save changes'));
  await screen.findByText('Saved.');
  assert.equal(secret.value, ''); assert.equal(server.inputs[0].credential, 'test-only-credential'); assert.equal(server.inputs[0].webhook_secret, value);
  assert.equal(server.inputs[0].version, null); assert.equal(server.inputs[0].status_endpoint, '/orders/{id}/status');
  for (const text of [value, 'test-only-credential']) assert.equal(JSON.stringify(server.view).includes(text), false);
  assert.equal(button('Copy webhook secret').disabled, true);
  assert.equal(screen.getByRole('status').textContent, 'Saved.'); assert.equal(secret.placeholder, 'Saved');
  await user.click(button('Test connection'));
  assert.equal((await screen.findByRole('status')).textContent, 'Connected.'); assert.equal(server.tests, 1); assert.equal(button('Save changes').disabled, true);
  fireEvent.change(screen.getByLabelText('Status endpoint'), { target: { value: '/orders/status' } });
  assert.equal(button('Save changes').disabled, true); assert.equal(button('Test connection').disabled, true);
  fireEvent.change(screen.getByLabelText('Status endpoint'), { target: { value: '/orders/{id}/status' } });
  await user.click(button('Sync now'));
  assert.equal((await screen.findByRole('status')).textContent, '2 drivers and 1 vehicle added, 1 skipped.');
  assert.match((await screen.findByText(/^Last sync/)).textContent!, /2 drivers and 1 vehicle added, 1 skipped\./);
  assert.equal(within(screen.getByRole('list', { name: 'Sync issues' })).getByRole('listitem').textContent, 'Driver DRV-3: Home address is incomplete or not a Canadian address');
  assert.equal(calls, 0); assert.equal(localStorage.length, 0);
  // A second save omits the unchanged secrets and sends the saved version.
  fireEvent.change(screen.getByLabelText('Drivers endpoint'), { target: { value: '/fleet/drivers' } });
  await user.click(button('Save changes')); await screen.findByText('Saved.');
  assert.deepEqual([server.inputs[1].credential, server.inputs[1].webhook_secret, server.inputs[1].version], [null, null, 1]);
  fireEvent.change(screen.getByLabelText('Drivers endpoint'), { target: { value: 'drivers' } });
  assert.equal(button('Sync now').disabled, true); assert.equal(button('Save changes').disabled, true);
});

test('each endpoint and the webhook URL open field maps with editable TMS fields beside fixed Dispatra fields', async () => {
  const user = await mount();
  await user.click(button('Map driver fields'));
  const dialog = within(screen.getByRole('table', { name: 'Driver fields' }));
  const dispatra = dialog.getByLabelText('Dispatra field Name') as HTMLInputElement;
  for (const label of ['TMS driver ID', 'Name', 'Email', 'Phone', 'Address', 'City', 'Province', 'Postal code']) assert.equal((dialog.getByLabelText(`TMS field for ${label}`) as HTMLInputElement).placeholder, 'Required');
  assert.equal((dialog.getByLabelText('TMS field for Truck unit') as HTMLInputElement).placeholder, 'Optional');
  assert.equal(dispatra.disabled, true); assert.equal(dispatra.value, 'Name');
  const tmsName = dialog.getByLabelText('TMS field for Name') as HTMLInputElement;
  assert.equal(tmsName.compareDocumentPosition(dispatra) & Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING);
  fireEvent.change(tmsName, { target: { value: ' driver.fullName ' } });
  await user.click(button('Cancel')); assert.equal(screen.queryByRole('table', { name: 'Driver fields' }), null); assert.equal(button('Save changes').disabled, true);
  await user.click(button('Map driver fields'));
  fireEvent.change(screen.getByLabelText('TMS field for Name'), { target: { value: ' driver.fullName ' } });
  fireEvent.change(screen.getByLabelText('TMS field for Email'), { target: { value: '' } });
  await user.click(button('Apply'));
  assert.equal(screen.queryByRole('table', { name: 'Driver fields' }), null);
  assert.ok(button('Map vehicle fields'));
  await user.click(button('Map order fields'));
  const orderMap = within(screen.getByRole('table', { name: 'Order fields' }));
  assert.deepEqual(orderMap.getAllByRole('rowheader').map(row => row.firstChild!.textContent), ['Order', 'Shipper', 'Stops', 'Cargo items']);
  assert.equal(orderMap.queryByLabelText('Dispatra field Order Pickup address'), null);
  assert.equal(orderMap.queryByLabelText(/Customer|\(kg\)|\(cm\)/), null); assert.equal(orderMap.queryByLabelText('Dispatra field Stops Weight'), null);
  assert.equal(orderMap.queryByLabelText('Dispatra field Order Reference'), null);
  for (const label of ['Order Scheduled time', 'Order Tax', 'Shipper TMS shipper ID', 'Shipper Name', 'Shipper Postal code', 'Stops Stop list', 'Stops City', 'Stops Postal code', 'Stops Stop type', 'Stops Pickup value', 'Stops Drop-off value', 'Cargo items Pickup stop ID', 'Cargo items Drop-off stop ID',
    'Cargo items Weight', 'Cargo items Length', 'Cargo items Width', 'Cargo items Height', 'Cargo items Dangerous goods'])
    assert.equal((orderMap.getByLabelText(`Dispatra field ${label}`) as HTMLInputElement).disabled, true);
  assert.equal((orderMap.getByLabelText('TMS field for Stops Pickup value') as HTMLInputElement).placeholder, 'PICKUP');
  const placeholder = (label: string) => (orderMap.getByLabelText(`TMS field for ${label}`) as HTMLInputElement).placeholder;
  assert.deepEqual(['Order Scheduled time', 'Order Vehicle type', 'Shipper Address', 'Stops Address', 'Cargo items Quantity', 'Cargo items Height'].map(placeholder), ['Required', 'Optional', 'Optional', 'Required', 'Optional', 'Required']);
  fireEvent.change(orderMap.getByLabelText('TMS field for Shipper Name'), { target: { value: 'customer.name' } });
  fireEvent.change(orderMap.getByLabelText('TMS field for Stops Stop list'), { target: { value: 'stops' } });
  fireEvent.change(orderMap.getByLabelText('TMS field for Cargo items Pickup stop ID'), { target: { value: 'from' } });
  await user.click(button('Apply'));
  await user.click(screen.getByRole('radio', { name: /API Polling/ }));
  await user.click(button('Map order fields'));
  assert.equal((screen.getByLabelText('TMS field for Shipper Name') as HTMLInputElement).value, 'customer.name');
  await user.click(button('Cancel'));
  connect(); fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'https://api.example.com' } });
  await user.click(button('Save changes'));
  await screen.findByText('Saved.');
  assert.deepEqual(server.inputs[0].field_maps.driver, { name: 'driver.fullName' });
  assert.deepEqual(server.inputs[0].field_maps.order, { 'shipper.name': 'customer.name', stops: 'stops', 'item.pickup_stop': 'from' });
});

test('TMS orders needing review show their reasons and can be retried or dismissed', async () => {
  server.view = { enabled: true, base_url: 'https://api.example.com', auth_type: 'api_key', drivers_endpoint: '/drivers', vehicles_endpoint: '/vehicles',
    fleet_sync_minutes: 60, sync_method: 'webhook', orders_endpoint: '/orders', poll_interval_minutes: 5, status_endpoint: '/orders/{id}/status', field_maps: {},
    credential_configured: true, webhook_secret_configured: true, missing_fields: {}, last_fleet_sync_at: null, last_fleet_result: null, last_order_poll_at: null, last_error: null, version: 1 } as TmsView;
  const row = (id: string, external: string, missing: string[]) => ({ id, external_id: external, received_via: 'WEBHOOK', received_at: '2026-10-10T18:00:00Z',
    status: 'NEEDS_REVIEW', missing, error_code: null, order_id: null, order_number: null, version: 1 });
  server.inbox = [row('a', 'TMS-1', ["Service level 'WHITE GLOVE' does not match a Dispatra service"]), row('b', 'TMS-2', ['Tax'])];
  const user = await mount();
  const review = within(await screen.findByRole('region', { name: 'Orders needing review' }));
  assert.ok(review.getByText("Service level 'WHITE GLOVE' does not match a Dispatra service"));
  await user.click(review.getByRole('button', { name: 'Retry TMS order TMS-1' }));
  assert.deepEqual(server.retried, ['a']);
  await user.click(await screen.findByRole('button', { name: 'Dismiss TMS order TMS-2' }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(screen.queryByRole('region', { name: 'Orders needing review' }), null);
  assert.match(screen.getByText(/signs each request with HMAC-SHA256/).textContent!, /X-Signature/);
});

test('polling validates HTTPS, the credential and the orders path, then discards the credential on save', async () => {
  const user = await mount();
  await user.click(screen.getByRole('radio', { name: /API Polling/ }));
  assert.equal(screen.queryByLabelText('Webhook URL'), null);
  assert.match(screen.getByRole('combobox', { name: 'Poll interval' }).textContent!, /Every 5 minutes/);
  fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'http://api.example.com' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-only-credential' } });
  fireEvent.change(screen.getByLabelText('Orders endpoint'), { target: { value: 'orders' } });
  assert.equal(button('Save changes').disabled, true);
  fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'https://api.example.com' } });
  fireEvent.change(screen.getByLabelText('Orders endpoint'), { target: { value: '/orders' } });
  assert.equal(button('Save changes').disabled, false);
  await user.click(button('Save changes'));
  await screen.findByText('Saved.');
  assert.equal((screen.getByLabelText('API key') as HTMLInputElement).value, '');
  assert.equal(server.inputs[0].sync_method, 'polling'); assert.equal(server.inputs[0].webhook_secret, null);
  assert.equal(JSON.stringify(server.view).includes('test-only-credential'), false);
  assert.equal(localStorage.length, 0);
});

test('without an Imported price rate card the tab explains how imported orders keep the TMS price', async () => {
  await mount(false);
  assert.ok(screen.getByText(/Add an Imported price rate card to keep TMS prices\./));
});

test('API tab lists collapsed cards for the key, each resource and webhooks with real Dispatra events', async () => {
  const user = await mount(); await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  const panel = screen.getByRole('tabpanel', { name: 'Dispatra API' });
  const cards = [...panel.querySelectorAll<HTMLDetailsElement>('details.app-disclosure')].map(card => [card.querySelector('summary .app-section-title')!.textContent, card.open]);
  assert.deepEqual(cards, ['API key', 'Orders API', 'Shippers API', 'Drivers API', 'Vehicles API', 'Services & vehicle types API', 'Webhooks'].map(title => [title, false]));
  const view = within(panel);
  const orders = within(view.getByRole('table', { name: 'Orders API' }));
  assert.equal(orders.getAllByText('/api/v1/companies/acme/orders/{id}').length, 2);
  for (const label of ['Create an order', 'Cancel an order', 'Track an order', 'Get proof of delivery']) assert.ok(orders.getByText(label));
  for (const name of ['Shippers', 'Drivers', 'Vehicles']) assert.ok(within(view.getByRole('table', { name: `${name} API` })).getByText(`/api/v1/companies/acme/${name.toLowerCase()}/{id}/archive`));
  const catalog = within(view.getByRole('table', { name: 'Services & vehicle types API' }));
  assert.equal(catalog.getAllByRole('row').length, 1); assert.equal(catalog.queryByText('POST'), null);
  assert.equal(view.queryByText('PATCH'), null);
  const events = within(view.getByRole('table', { name: 'Order events' })).getAllByRole('row').slice(1).map(row => row.querySelector('code')!.textContent);
  assert.deepEqual(events, ['order.created', 'order.updated', 'order.cancelled', 'order.assigned', 'order.unassigned', 'order.started', 'stop.arrived', 'stop.completed',
    'evidence.accepted', 'issue.reported', 'issue.resolved', 'order.completion_held', 'order.completed']);
  for (const removed of ['order.accepted', 'order.rejected', 'pod.created', 'driver.en_route', 'stop.completed_by_dispatcher', 'order.completed_by_dispatcher']) assert.equal(view.queryByText(removed), null);
  assert.equal(view.queryByText(/test value|preview only|proposed/i), null);
  const booking = JSON.parse(view.getByLabelText('Example create-order request').textContent!);
  assert.equal(booking.stops.length, 2); assert.equal(booking.items[0].pickup_id, booking.stops[0].id); assert.equal(booking.items[0].delivery_id, booking.stops[1].id);
});

test('the API key is created on the server, shown once and regenerated only after confirmation', async () => {
  const user = await mount(); await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  assert.ok(await screen.findByText('No API key yet.'));
  await user.click(screen.getByRole('button', { name: 'Create API key' }));
  const first = server.created[0];
  assert.equal((await screen.findByLabelText('Dispatra API key') as HTMLInputElement).value, first);
  assert.equal(screen.getByRole('status').textContent, 'New API key created. Copy it now; it will not be shown again.');
  let copied = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
  await user.click(screen.getByRole('button', { name: 'Copy Dispatra API key' })); assert.equal(copied, first); assert.ok(screen.getByText('Dispatra API key copied.'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  await user.click(screen.getByRole('button', { name: 'Copy Dispatra API key' })); assert.match(screen.getByRole('alert').textContent!, /Clipboard unavailable/);
  await user.click(screen.getByRole('button', { name: 'Regenerate' })); await user.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.equal(server.created.length, 1);
  await user.click(screen.getByRole('button', { name: 'Regenerate' })); await user.click(screen.getByRole('button', { name: 'Regenerate key' }));
  assert.equal((await screen.findByLabelText('Dispatra API key') as HTMLInputElement).value, server.created[1]);
  assert.equal(localStorage.length, 0);
});

test('saving webhooks clears the secret and tab changes preserve unsaved drafts', async () => {
  const user = await mount(); await user.click(screen.getByRole('switch', { name: 'Enable TMS integration' }));
  await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  const save = await screen.findByRole('button', { name: 'Save webhook' }) as HTMLButtonElement;
  fireEvent.change(screen.getByLabelText('Destination URL'), { target: { value: 'http://customer.example.com/hooks' } });
  fireEvent.change(screen.getByLabelText('Signing secret'), { target: { value: 'outbound-secret' } });
  assert.equal(save.disabled, true);
  fireEvent.change(screen.getByLabelText('Destination URL'), { target: { value: 'https://customer.example.com/hooks' } });
  await user.click(save);
  await screen.findByText('Saved.');
  assert.equal((screen.getByLabelText('Signing secret') as HTMLInputElement).value, '');
  assert.deepEqual(server.webhookInputs[0], { url: 'https://customer.example.com/hooks', secret: 'outbound-secret', enabled: true, version: null });
  assert.equal(JSON.stringify(server.webhook).includes('outbound-secret'), false); assert.equal(localStorage.length, 0);
  assert.ok(screen.getByText(/signed with HMAC-SHA256 of the body in the X-Signature header/));
  await user.click(screen.getByRole('tab', { name: 'Connected TMS' })); assert.equal(screen.getByRole('switch', { name: 'Enable TMS integration' }).getAttribute('aria-checked'), 'false');
  const event = new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed: () => {} } });
  fireEvent(window, event); assert.equal(event.defaultPrevented, true); assert.ok(screen.getByRole('alertdialog'));
});

test('sidebar places Integrations immediately before the account card and supports the collapsed rail', async () => {
  const user = userEvent.setup({ document }); let destination = '';
  const props = { activeTab: 'integrations', isOpen: true, onToggle: () => {}, setActiveTab: (page: string) => { destination = page; }, showAccountPopover: false,
    setShowAccountPopover: () => {}, onActionNotification: () => {}, dispatchMode: 'MANUAL' as const, onDispatchModeChange: () => {} };
  const view = render(React.createElement(Sidebar, props));
  const integration = screen.getByRole('button', { name: 'Integrations' }); const account = screen.getByRole('button', { name: 'Dispatcher Account' });
  assert.equal(integration.nextElementSibling, account); assert.equal(integration.getAttribute('aria-current'), 'page');
  assert.ok(screen.getByRole('switch', { name: 'Auto dispatch' }));
  await user.click(integration); assert.equal(destination, 'integrations');
  view.rerender(React.createElement(Sidebar, { ...props, isOpen: false }));
  assert.equal(screen.getByRole('button', { name: 'Integrations' }).getAttribute('title'), 'Integrations');
});
