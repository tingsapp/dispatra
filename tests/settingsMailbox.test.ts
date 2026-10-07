import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/settings', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { api } = await import('../src/portal/api');
const { operations, allOperations } = await import('../src/operations/api');
const { WorkspaceAccount } = await import('../src/portal/WorkspaceAccount');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { CompanyProfilePage } = await import('../src/portal/CompanyProfilePage');
afterEach(() => cleanup());

const settings = { id: 's1', version: 1, created_at: '2026-10-06T00:00:00Z', data: { company_name: 'Acme', contact_name: '', email: '', phone: '', address: null, logo_url: '', currency: 'CAD',
  time_zone: 'America/Vancouver', weight_unit: 'lb', dimension_unit: 'in', distance_unit: 'km', tax_registration_number: '', gst_enabled: true, gst_percent: '5', provincial_enabled: false,
  provincial_percent: '0', fuel_enabled: true, fuel_percent: '28.5', maximum_active_orders: 3, quote_validity_days: 14, dispatch_mode: 'MANUAL' } };
const account = { id: 'u1', login_id: 'dispatcher@example.com', display_name: 'Dispatcher', role: 'DISPATCHER', driver_id: null, shipper_id: null,
  organization: { id: 'o1', slug: 'acme', name: 'Acme', active: true, version: 1, created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' } };
Object.assign(api, { companySettings: async () => settings });
Object.assign(allOperations, { rates: async () => [], catalog: async () => [], shippers: async () => [] });
Object.assign(operations, { mailbox: async () => null });
const mount = (page: React.ReactElement) => render(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }) },
  React.createElement(WorkspaceAccount, { account: account as never, children: page })));

test('company Settings has a Mailbox tab and Profile no longer does', async () => {
  const user = userEvent.setup({ document });
  const page = mount(React.createElement(RateCardsPage, {}));
  const tab = await screen.findByRole('tab', { name: 'Mailbox' });
  assert.deepEqual(screen.getAllByRole('tab').map(item => item.textContent).slice(-2), ['Preferences', 'Mailbox']);
  await user.click(tab);
  assert.equal(tab.getAttribute('aria-selected'), 'true');
  assert.ok(await screen.findByText('App password'));
  page.unmount();
  mount(React.createElement(CompanyProfilePage, {}));
  assert.deepEqual((await screen.findAllByRole('button', { pressed: true })).map(item => item.textContent), ['Company']);
  assert.equal(screen.queryByRole('button', { name: 'Mailbox' }), null);
  assert.ok(screen.getByRole('button', { name: 'Security' }));
});

test('the default service is chosen in Service Level, not in Mailbox', async () => {
  const user = userEvent.setup({ document });
  const service = (id: string, code: string, name: string, created_at: string) => ({ id, kind: 'SERVICE', code, active: true, version: 1, created_at, updated_at: created_at,
    data: { name, description: '', amount: '0', taxable: true, fuel_eligible: true, exclusive_vehicle: false, payload_kg: null, volume_m3: null, length_cm: null, width_cm: null, height_cm: null,
      pallet_capacity: 0, equipment: [], required_equipment: [], required_crew: 1 } });
  const saved: unknown[] = [];
  const current = { ...settings, data: { ...settings.data, default_service_id: 'svc_b' } };
  Object.assign(api, { companySettings: async () => current, saveCompanySettings: async (_slug: string, body: { version: number; data: typeof current.data }) => { saved.push(body.data); return { ...current, version: 2, data: body.data }; } });
  Object.assign(allOperations, { catalog: async () => [service('svc_a', 'SAME_DAY', 'Same-Day Standard', '2026-10-01T00:00:00Z'), service('svc_b', 'NEXT_DAY', 'Scheduled Economy', '2026-10-02T00:00:00Z')] });
  try {
    mount(React.createElement(RateCardsPage, {}));
    await user.click(await screen.findByRole('tab', { name: 'Mailbox' }));
    await screen.findByText('App password');
    assert.equal(screen.queryByText("Service when the email doesn't say"), null);
    await user.click(screen.getByRole('tab', { name: 'Service Level' }));
    const economy = (await screen.findByText('Scheduled Economy')).closest('tr')!;
    assert.ok(economy.textContent!.includes('Default'));
    assert.equal(screen.queryByRole('button', { name: 'Set Scheduled Economy as default' }), null);
    await user.click(screen.getByRole('button', { name: 'Set Same-Day Standard as default' }));
    assert.equal((saved[0] as { default_service_id: string }).default_service_id, 'svc_a');
    assert.ok((await screen.findByText('Same-Day Standard')).closest('tr')!.textContent!.includes('Default'));
  } finally {
    Object.assign(api, { companySettings: async () => settings });
    Object.assign(allOperations, { catalog: async () => [] });
  }
});

test('a provider fills the mail servers; Other shows them and SMTP follows IMAP until edited', async () => {
  const user = userEvent.setup({ document });
  const saved: Record<string, unknown>[] = [], tested: Record<string, unknown>[] = [];
  Object.assign(operations, { saveMailbox: async (_slug: string, body: Record<string, unknown>) => { saved.push(body); return body; }, testMailbox: async (_slug: string, body: Record<string, unknown>) => { tested.push(body); return { ok: true }; } });
  mount(React.createElement(RateCardsPage, {}));
  await user.click(await screen.findByRole('tab', { name: 'Mailbox' }));
  assert.ok(await screen.findByText(/Dispatra also sends your invoices and notifications from this address\./));
  const provider = screen.getByRole('combobox', { name: 'Email provider' });
  assert.match(provider.textContent!, /Gmail/);
  assert.equal(screen.queryByLabelText('IMAP server'), null);
  await user.type(screen.getByLabelText('Email address / username'), 'orders@icloud.com');
  await user.type(screen.getByLabelText(/^App password/), 'secret');
  await user.click(provider); await user.click(screen.getByRole('option', { name: 'iCloud' }));
  assert.ok(screen.getByText('For iCloud, create an app-specific password in your Apple Account.'));
  await user.click(screen.getByRole('button', { name: 'Test connection' }));
  assert.deepEqual([tested[0].host, tested[0].port, tested[0].smtp_host, tested[0].smtp_port], ['imap.mail.me.com', 993, 'smtp.mail.me.com', 587]);
  assert.ok(await screen.findByText('Connected. Dispatra can read and send from this mailbox.'));
  await user.click(provider); await user.click(screen.getByRole('option', { name: 'Other' }));
  const imap = screen.getByLabelText('IMAP server') as HTMLInputElement, smtp = screen.getByLabelText('SMTP server') as HTMLInputElement;
  await user.clear(imap); await user.type(imap, 'imap.example.com');
  assert.equal(smtp.value, 'smtp.example.com');
  await user.clear(smtp); await user.type(smtp, 'mail.example.com');
  await user.clear(imap); await user.type(imap, 'imap.other.com');
  assert.equal(smtp.value, 'mail.example.com');
  await user.click(screen.getByRole('button', { name: 'Connect mailbox' }));
  assert.deepEqual([saved[0].host, saved[0].smtp_host, saved[0].smtp_port], ['imap.other.com', 'mail.example.com', 587]);
});
