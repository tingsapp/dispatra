import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/settings', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
window.confirm = () => true;
const { render, screen, cleanup, act, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { Button, ActionButton } = await import('../src/components/ui/button');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { BillingSettingsForm } = await import('../src/components/settings/BillingSettingsForm');
const { WorkspaceAccount } = await import('../src/portal/WorkspaceAccount');
const { api } = await import('../src/portal/api');
const { operations, allOperations } = await import('../src/operations/api');
const { createEmptyRateCard } = await import('../src/lib/pricingStorage');
const { rateFromUi } = await import('../src/operations/pricingAdapters');
const original = { api: { ...api }, operations: { ...operations }, all: { ...allOperations } };
let cache: InstanceType<typeof QueryClient>;
afterEach(() => { cleanup(); cache?.clear(); Object.assign(api, original.api); Object.assign(operations, original.operations); Object.assign(allOperations, original.all); localStorage.clear(); });
after(() => dom.window.close());
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function pending(button: HTMLElement, expected: boolean) {
  assert.equal((button as HTMLButtonElement).disabled, expected);
  assert.equal(button.getAttribute('aria-busy'), expected ? 'true' : null);
  assert.equal(!!button.querySelector('[data-button-spinner]'), expected);
}
for (const Component of [Button, ActionButton]) {
  test(`${Component.name} follows a returned action promise and releases on handled failure`, async () => {
    const request = deferred<void>(); let calls = 0; let failed = false;
    render(<Component onClick={() => { calls++; return request.promise.catch(() => { failed = true; }); }}>Complete</Component>);
    const user = userEvent.setup({ document }); const button = screen.getByRole('button', { name: 'Complete' });
    await user.click(button); pending(button, true);
    await user.click(button); assert.equal(calls, 1);
    await act(async () => request.reject(Error('Try again'))); pending(button, false); assert.equal(failed, true);
  });
}
test('instant dismissal remains immediate and slotted busy links cannot activate', async () => {
  let closed = false, activated = false;
  render(<><Button onClick={() => { closed = true; }}>Cancel</Button><Button asChild loading><a href="#target" onClick={() => { activated = true; }}>Continue</a></Button></>);
  const user = userEvent.setup({ document }); await user.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.equal(closed, true); pending(screen.getByRole('button', { name: 'Cancel' }), false);
  await user.click(screen.getByRole('link', { name: 'Continue' })); assert.equal(activated, false);
});

test('cancelling confirmation restores focus after the initiating button releases its spinner', async () => {
  const { ConfirmDialogHost, confirmDialog } = await import('../src/components/ui/ConfirmDialog');
  render(<><ConfirmDialogHost /><Button onClick={async () => { await confirmDialog({ title: 'Archive card?', message: 'Archive this card.' }); }}>Archive</Button></>);
  const user = userEvent.setup({ document }); const button = screen.getByRole('button', { name: 'Archive' });
  await user.click(button); pending(button, true);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => { pending(button, false); assert.equal(document.activeElement === button, true); });
});

const settings = { id: 'settings', version: 1, created_at: '2026-11-09T00:00:00Z', data: { company_name: 'Acme', contact_name: 'Dispatcher', email: '', phone: '', address: null, logo_url: '', currency: 'CAD', time_zone: 'America/Vancouver', weight_unit: 'lb', dimension_unit: 'in', distance_unit: 'km', tax_registration_number: '', gst_enabled: true, gst_percent: '5', provincial_enabled: false, provincial_percent: '0', fuel_enabled: true, fuel_percent: '20', maximum_active_orders: 3, quote_validity_days: 14, dispatch_mode: 'MANUAL', dispatch_zones: [] } };
const account = { id: 'user', login_id: 'dispatcher@example.com', display_name: 'Dispatcher', role: 'DISPATCHER', organization: { id: 'company', slug: 'acme', name: 'Acme' } };
function mount(page: React.ReactElement) {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  Object.assign(api, { companySettings: async () => settings });
  Object.assign(allOperations, { catalog: async () => [], shippers: async () => [] });
  return render(<QueryClientProvider client={cache}><WorkspaceAccount account={account as never}>{page}</WorkspaceAccount></QueryClientProvider>);
}
function rateFixture() {
  const card = createEmptyRateCard({ id: 'rate-fixed', name: 'Fixed per delivery', pricingMethod: 'FIXED', fixedAmount: 95 });
  return { id: card.id, code: 'FIXED', active: true, is_default: false, version: 1, created_at: '2026-11-09T00:00:00Z', data: rateFromUi(card, []) };
}
test('Rate Card Save spins through the write and refresh, blocks duplicates and retains failed edits', async () => {
  let rate = rateFixture(); let writes = 0; let message = '';
  let request = deferred<typeof rate>(); let refresh = deferred<typeof rate[]>();
  Object.assign(allOperations, { rates: async () => writes ? refresh.promise : [rate] });
  Object.assign(operations, { updateRate: () => { writes++; return request.promise; } });
  mount(<RateCardsPage onNotification={text => { message = text; }} />);
  const user = userEvent.setup({ document }); const amount = await screen.findByLabelText('Fixed Amount per Delivery');
  await user.clear(amount); await user.type(amount, '105'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saving = screen.getByRole('button', { name: 'Saving…' }); pending(saving, true);
  assert.equal((amount as HTMLInputElement).matches(':disabled'), true);
  await user.click(saving); assert.equal(writes, 1);
  rate = { ...rate, version: 2, data: { ...rate.data, fixed_amount: 105 } };
  await act(async () => request.resolve(rate)); pending(saving, true);
  await act(async () => refresh.resolve([rate]));
  pending(await screen.findByRole('button', { name: 'Saved' }), false);
  assert.match(message, /Saved/);
  request = deferred<typeof rate>(); refresh = deferred<typeof rate[]>();
  await user.clear(amount); await user.type(amount, '115'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  pending(screen.getByRole('button', { name: 'Saving…' }), true);
  await act(async () => request.reject(Error('Rate save unavailable')));
  pending(await screen.findByRole('button', { name: 'Save Card' }), false);
  assert.equal((amount as HTMLInputElement).value, '115'); assert.equal(message, 'Rate save unavailable');
});
for (const operation of ['default', 'archive'] as const) {
  test(`rate-card ${operation} has its own spinner until completion`, async () => {
    const rate = rateFixture(); const request = deferred<typeof rate>();
    Object.assign(allOperations, { rates: async () => [rate] });
    Object.assign(operations, { updateRate: () => request.promise, archiveRate: () => request.promise });
    mount(<RateCardsPage />); const user = userEvent.setup({ document });
    const button = await screen.findByRole('button', { name: operation === 'default' ? 'Set as default' : 'Archive' });
    await user.click(button); pending(button, true);
    assert.equal((screen.getByRole('button', { name: 'Save Card' }) as HTMLButtonElement).disabled, true);
    await act(async () => request.resolve(rate)); await waitFor(() => pending(button, false));
  });
}
test('Fuel Surcharge form tracks keyboard submission and releases after failure', async () => {
  const request = deferred<never>(); let calls = 0;
  Object.assign(api, { saveCompanySettings: () => { calls++; return request.promise; } });
  mount(<BillingSettingsForm section="fuel" />); const user = userEvent.setup({ document });
  const input = await screen.findByRole('spinbutton'); await user.clear(input); await user.type(input, '25');
  await user.keyboard('{Enter}'); const button = screen.getByRole('button', { name: 'Save Fuel Surcharge' });
  pending(button, true); await user.click(button); assert.equal(calls, 1);
  await act(async () => request.reject(Error('Fuel save unavailable'))); pending(button, false);
  assert.ok(screen.getByRole('alert').textContent?.includes('Fuel save unavailable'));
  assert.equal((input as HTMLInputElement).value, '25');
});

test('assignment menu keeps the selected action visible and busy until it settles', async () => {
  const { DriverAssignmentMenu } = await import('../src/components/entities/DriverAssignmentMenu');
  const request = deferred<void>(); let calls = 0; let open = true;
  render(<DriverAssignmentMenu open onOpenChange={value => { open = value; }} drivers={[{ id: 'd1', name: 'Driver One', avatar: '', statusLabel: 'Available', driverNumber: 'D01' }]}
    onSelect={() => { calls++; return request.promise; }} />);
  const user = userEvent.setup({ document }); const row = screen.getByRole('menuitem', { name: /Driver One/ });
  await user.click(row); assert.ok(row.querySelector('[data-button-spinner]')); assert.equal(row.getAttribute('aria-busy'), 'true');
  await user.click(row); assert.equal(calls, 1); assert.equal(open, true);
  await act(async () => request.resolve()); assert.equal(open, false);
});

test('logout menu stays visible during the pending request and permits a retry after failure', async () => {
  const { AccountMenu } = await import('../src/components/layout/AccountMenu');
  let calls = 0; let finish!: () => void;
  function Account() {
    const [open, setOpen] = React.useState(false); const [loggingOut, setLoggingOut] = React.useState(false);
    finish = () => setLoggingOut(false);
    return <AccountMenu open={open} onOpenChange={setOpen} activeTab="profile" loggingOut={loggingOut} trigger={<button>Account</button>}
      onProfile={() => {}} onLogout={() => { calls++; setLoggingOut(true); }} />;
  }
  render(<Account />); const user = userEvent.setup({ document }); await user.click(screen.getByRole('button', { name: 'Account' }));
  const logout = screen.getByRole('menuitem', { name: 'Logout' }); await user.click(logout);
  assert.equal(logout.getAttribute('aria-busy'), 'true'); assert.ok(logout.querySelector('[data-button-spinner]'));
  await user.click(logout); assert.equal(calls, 1);
  await act(async () => finish()); assert.equal(logout.querySelector('[data-button-spinner]'), null);
  await user.click(logout); assert.equal(calls, 2);
});
