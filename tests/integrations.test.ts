import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useState } from 'react';
import { createIntegrationsPreview, type IntegrationsPreview } from '../src/integrations/preview';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/integrations', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, fireEvent, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { IntegrationsPage } = await import('../src/pages/IntegrationsPage');
const { Sidebar } = await import('../src/components/Sidebar');
const { ConfirmDialogHost } = await import('../src/components/ui/ConfirmDialog');
const { SETTINGS_NAVIGATION_EVENT } = await import('../src/components/settings/useSettingsGuard');
const originalFetch = globalThis.fetch;
let latest: IntegrationsPreview;
function Preview() {
  const [value, setValue] = useState(createIntegrationsPreview);
  latest = value;
  return React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(IntegrationsPage, { preview: value, onChange: setValue }));
}
const mount = () => { render(React.createElement(Preview)); return userEvent.setup({ document }); };
const fillNames = () => {
  fireEvent.change(screen.getByLabelText('Integration name'), { target: { value: 'Acme TMS' } });
  fireEvent.change(screen.getByLabelText('TMS name'), { target: { value: 'Acme Transportation Management System' } });
};
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });

test('preview defaults to inbound webhooks and never presents an active production connection', () => {
  mount();
  assert.equal(screen.getByRole('tab', { name: 'Connected TMS' }).getAttribute('aria-selected'), 'true');
  assert.ok(screen.getByText('Interface preview.'));
  assert.equal((screen.getByRole('radio', { name: /Events \/ Webhooks/ }) as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText('Dispatra webhook URL (example)') as HTMLInputElement).value.startsWith('https://api.example.invalid/'), true);
  assert.ok(screen.getByText('Not configured')); assert.ok(screen.getByText('Never'));
  assert.equal((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled, true);
  assert.equal(screen.queryByLabelText('Base API URL'), null);
});

test('mock testing sends no network request; saving clears secrets and stores only configuration', async () => {
  const user = mount(); let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('Network must not be used by preview'); }) as typeof fetch;
  fillNames(); await user.click(screen.getByRole('button', { name: 'Generate test secret' }));
  const secret = screen.getByLabelText('Inbound webhook secret') as HTMLInputElement;
  const value = secret.value; assert.match(value, /^dsp_test_webhook_preview_/); assert.equal(secret.type, 'password');
  await user.click(screen.getByRole('button', { name: 'Show inbound webhook secret' })); assert.equal(secret.type, 'text');
  await user.click(screen.getByRole('button', { name: 'Test connection' }));
  assert.ok(screen.getByText('Connected (mock)')); assert.ok(screen.getByText('Never')); assert.equal(calls, 0);
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  assert.equal(secret.value, ''); assert.equal(latest.tms.webhookSecretConfigured, true);
  assert.equal(JSON.stringify(latest).includes(value), false);
  assert.equal((screen.getByRole('button', { name: 'Copy inbound webhook secret' }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByRole('status').textContent!, /No synchronization is active/);
  assert.equal(localStorage.length, 0);
});

test('polling validates HTTPS, credentials and import choices, then discards the credential on save', async () => {
  const user = mount(); fillNames();
  await user.click(screen.getByRole('radio', { name: /API Polling/ }));
  assert.equal(screen.queryByLabelText('Dispatra webhook URL (example)'), null);
  assert.match(screen.getByRole('combobox', { name: 'Poll interval' }).textContent!, /Every 5 minutes/);
  assert.ok(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).checked));
  fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'http://api.example.com' } });
  fireEvent.change(screen.getByLabelText('Credential'), { target: { value: 'test-only-credential' } });
  const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
  assert.equal(save.disabled, true);
  fireEvent.change(screen.getByLabelText('Base API URL'), { target: { value: 'https://api.example.com' } });
  for (const input of screen.getAllByRole('checkbox')) await user.click(input);
  assert.equal(save.disabled, true); assert.ok(screen.getByText('Select at least one import option.'));
  await user.click(screen.getByRole('checkbox', { name: 'New orders' })); assert.equal(save.disabled, false);
  await user.click(save);
  assert.equal((screen.getByLabelText('Credential') as HTMLInputElement).value, '');
  assert.equal(latest.tms.credentialConfigured, true); assert.equal(JSON.stringify(latest).includes('test-only-credential'), false);
  assert.equal(localStorage.length, 0);
});

test('API documentation matches company-scoped operations and keeps proposed outbound events separate', async () => {
  const user = mount(); await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  const panel = within(screen.getByRole('tabpanel'));
  assert.equal(panel.getAllByText('/api/v1/companies/acme/orders/{id}').length, 2);
  assert.ok(panel.getByText('PUT')); assert.equal(panel.queryByText('PATCH'), null);
  assert.ok(panel.getByText('Proposed outbound events')); assert.ok(panel.getByText('pod.created'));
  assert.equal(panel.queryByText('order.created'), null);
  fireEvent.click(panel.getByText('Create an order.').closest('summary')!);
  const booking = JSON.parse(panel.getByLabelText('Example create-order request').textContent!);
  assert.equal(booking.stops.length, 2); assert.equal(booking.items[0].pickup_id, booking.stops[0].id); assert.equal(booking.items[0].delivery_id, booking.stops[1].id);
});

test('regenerating a test API key requires confirmation; clipboard success and failure are visible', async () => {
  const user = mount(); await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  const before = latest.apiKey;
  await user.click(screen.getByRole('button', { name: 'Regenerate' })); await user.click(screen.getByRole('button', { name: 'Cancel' })); assert.equal(latest.apiKey, before);
  await user.click(screen.getByRole('button', { name: 'Regenerate' })); await user.click(screen.getByRole('button', { name: 'Regenerate test key' })); assert.notEqual(latest.apiKey, before);
  let copied = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
  await user.click(screen.getByRole('button', { name: 'Copy test API key' })); assert.equal(copied, latest.apiKey); assert.ok(screen.getByText('test API key copied.'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  await user.click(screen.getByRole('button', { name: 'Copy test API key' })); assert.match(screen.getByRole('alert').textContent!, /Clipboard unavailable/);
});

test('outbound preview saving clears the secret and tab changes preserve unsaved drafts', async () => {
  const user = mount(); fillNames(); await user.click(screen.getByRole('tab', { name: 'Dispatra API' }));
  fireEvent.change(screen.getByLabelText('Destination webhook URL'), { target: { value: 'https://customer.example.com/hooks' } });
  fireEvent.change(screen.getByLabelText('Outbound webhook secret'), { target: { value: 'outbound-test-only' } });
  await user.click(screen.getByRole('button', { name: 'Save webhook changes' }));
  assert.equal((screen.getByLabelText('Outbound webhook secret') as HTMLInputElement).value, ''); assert.equal(latest.outbound.secretConfigured, true);
  assert.equal(JSON.stringify(latest).includes('outbound-test-only'), false);
  await user.click(screen.getByRole('tab', { name: 'Connected TMS' })); assert.equal((screen.getByLabelText('Integration name') as HTMLInputElement).value, 'Acme TMS');
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
