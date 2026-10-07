import { formatWeight } from '../src/lib/units';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'FileReader']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => { };
window.confirm = () => true;
const { render: rawRender, screen, cleanup, within, waitFor } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const render = (ui: React.ReactElement) => rawRender(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }) }, ui));
const { default: userEvent } = await import('@testing-library/user-event');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { VehiclesPage } = await import('../src/pages/VehiclesPage');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { ProfilePage } = await import('../src/pages/ProfilePage');
const { BillingSettingsForm } = await import('../src/components/settings/BillingSettingsForm');
const TaxesPage = () => React.createElement(BillingSettingsForm, { section: 'taxes' });
const PreferencesPage = () => React.createElement(BillingSettingsForm, { section: 'preferences' });
const { CatalogueSection } = await import('../src/components/settings/CatalogueSection');
const { VehicleTypesSection } = await import('../src/components/settings/VehicleTypesSection');
const { ConfirmDialogHost } = await import('../src/components/ui/ConfirmDialog');
const { loadPricingConfig, savePricingConfig, createEmptyRateCard, rateCardCode, RATE_CARD_BACKGROUND_DEFAULTS } = await import('../src/lib/pricingStorage');
const { loadBillingConfig, saveBillingConfig } = await import('../src/lib/billingStorage');
const { loadSimplePricingConfig, saveSimplePricingConfig } = await import('../src/lib/simplePricingStorage');
const { SETTINGS_NAVIGATION_EVENT } = await import('../src/components/settings/useSettingsGuard');
const noop = () => { };
afterEach(() => { cleanup(); localStorage.clear(); window.confirm = () => true; });
// These established fixtures exercise metric entry; the product defaults are tested separately.
function useMetricCompany() {
  const config = loadBillingConfig();
  Object.assign(config.general, { weightUnit: 'kg', dimensionUnit: 'cm', distanceUnit: 'km' });
  saveBillingConfig(config);
}
function seedCard(overrides: Parameters<typeof createEmptyRateCard>[0] = {}) {
  const card = createEmptyRateCard({ name: 'Contract A', scope: 'ORGANIZATION', ...overrides });
  const config = loadPricingConfig(); config.rateCards = [card];
  if (overrides.pricingMethod === 'ZONE') config.zones = [
    ['van', 'Vancouver'], ['bby', 'Burnaby / New West'], ['rmd', 'Richmond / YVR'],
    ['sry', 'Surrey / Delta'], ['nsh', 'North Shore'], ['tri', 'Tri-Cities']
  ].map(([id, name], i) => ({ id: `zone_${id}`, code: id.toUpperCase(), name, postalCodes: [`1000${i}`] }));
  savePricingConfig(config); return card;
}
async function select(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label })); await user.click(screen.getByRole('option', { name: option }));
}
function assertFieldIssue(label: string, issue: string | null) {
  const input = screen.getByLabelText(label);
  assert.equal(input.getAttribute('aria-invalid'), String(!!issue), label);
  if (issue) {
    const hint = document.getElementById(input.getAttribute('aria-describedby')!)!;
    assert.ok(hint.classList.contains('sr-only'), 'Validation descriptions must not occupy layout space');
    assert.match(hint.textContent!, new RegExp(issue));
  }
}
test('Profile has Company and Security; Taxes and Preferences are separate Pricing tabs', async () => {
  const user = userEvent.setup({ document });
  const page = render(React.createElement(ProfilePage, {}));
  assert.deepEqual(screen.getAllByRole('button', { name: /^(Company|Security|Security & Sessions|Taxes & Preferences|Taxes|Preferences)$/ }).map(button => button.textContent), ['Company', 'Security']);
  assert.ok(screen.getByRole('button', { name: 'Company', pressed: true }));
  for (const label of ['Company name', 'Contact Full Name', 'Email', 'Phone', 'Role', 'Company address']) assert.ok(screen.getByLabelText(label), label);
  assert.ok(screen.getByText('Company Logo'));
  assert.ok(screen.getByRole('button', { name: 'Upload company logo' }));
  assert.equal(screen.queryByRole('textbox', { name: 'GST/HST registration number' }), null);
  await user.click(screen.getByRole('button', { name: 'Security' }));
  for (const label of ['Current Password', 'New Password', 'Confirm New Password']) assert.ok(screen.getByLabelText(label), label);
  page.unmount();
  const pricing = render(React.createElement(RateCardsPage, {}));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Rate Cards', 'Service Level', 'Accessorials', 'Fuel Surcharge', 'Taxes', 'Vehicle Types', 'Preferences']);
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  const taxes = within(screen.getByRole('tabpanel', { name: 'Taxes' }));
  assert.ok(taxes.getByRole('textbox', { name: 'GST/HST registration number' }));
  assert.ok(taxes.getByRole('checkbox', { name: 'Apply GST/HST to taxable charges' }));
  assert.ok(taxes.getByRole('checkbox', { name: 'Apply provincial tax to taxable charges' }));
  for (const label of ['GST/HST rate', 'Provincial tax rate']) assert.ok(taxes.getByRole('spinbutton', { name: label }), label);
  assert.equal(taxes.queryByRole('combobox', { name: 'Weight unit' }), null);
  await user.click(screen.getByRole('tab', { name: 'Preferences' }));
  const preferences = within(screen.getByRole('tabpanel', { name: 'Preferences' }));
  for (const label of ['Currency', 'Organization timezone', 'Distance unit', 'Weight unit', 'Dimension unit']) assert.ok(preferences.getByRole('combobox', { name: label }), label);
  assert.equal(preferences.queryByRole('spinbutton', { name: 'GST/HST rate' }), null);
  pricing.unmount();
  render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  assert.ok(screen.getByRole('button', { name: 'Add card' }));
  const list = within(screen.getByRole('complementary', { name: 'Rate cards' }));
  assert.equal(list.queryByRole('heading', { name: 'Rate cards' }), null);
  assert.ok(list.getByRole('searchbox', { name: 'Search rate cards' }));
});
test('old Company URL opens the Company tab in Profile', () => {
  window.history.replaceState(null, '', '/settings/company');
  try {
    render(React.createElement(ProfilePage, {}));
    assert.ok(screen.getByRole('button', { name: 'Company', pressed: true }));
    assert.ok(screen.getByRole('heading', { name: 'Company Identity' }));
  } finally {
    window.history.replaceState(null, '', '/');
  }
});

test('new cards choose one method, do not persist before Save, and cancelled drafts leave no records', async () => {
  const user = userEvent.setup({ document }); seedCard(); const before = loadPricingConfig();
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  await user.click(screen.getByRole('combobox', { name: 'Filter pricing method' })); assert.ok(screen.getByRole('option', { name: 'Imported price' })); await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  assert.deepEqual(loadPricingConfig(), before);
  await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); assert.ok(screen.getByRole('option', { name: 'Imported price' })); assert.ok(screen.getByRole('option', { name: 'Fixed per delivery' })); await user.keyboard('{Escape}');
  assert.equal(screen.getByLabelText('Minimum Charge').closest('.grid'), screen.getByLabelText('Rate card name').closest('.grid'));
  await select(user, 'Pricing method', 'Fixed per delivery'); assert.ok(screen.getByLabelText('Fixed Amount per Delivery')); assert.equal(screen.queryByLabelText('Base Fee'), null);
  await user.click(screen.getByRole('button', { name: 'Cancel' })); assert.deepEqual(loadPricingConfig(), before);
  await user.click(screen.getByRole('button', { name: 'Add card' })); await select(user, 'Pricing method', 'Fixed per delivery');
  await user.clear(screen.getByLabelText('Rate card name')); await user.type(screen.getByLabelText('Rate card name'), 'Local fixed'); await user.clear(screen.getByLabelText('Fixed Amount per Delivery')); await user.type(screen.getByLabelText('Fixed Amount per Delivery'), '42');
  await user.click(screen.getByRole('button', { name: 'Save Card' })); const saved = loadPricingConfig().rateCards.find(card => card.name === 'Local fixed')!; assert.equal(saved.fixedAmount, 42); assert.equal(saved.pricingMethod, 'FIXED'); assert.equal(saved.version, 1); assert.equal(screen.queryByRole('combobox', { name: 'Pricing method' }), null);
});
test('stored background contract exceptions are normalised on load; editing keeps the discount and unrelated billing data', async () => {
  const original = seedCard({ fuelPercent: 0, waitFreeMinutes: 0, minimumOrderSubtotal: 0, applyAdminFee: false, accessorialRateOverrides: { acc_stairs: 0 }, discount: { type: 'NONE', value: 0, scope: 'SUBTOTAL' } });
  const billing = loadBillingConfig(); saveBillingConfig(billing); const user = userEvent.setup({ document }); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByText('Additional settings'), null); assert.deepEqual([...document.querySelectorAll('details summary')].map(el => el.textContent!.split('Example')[0].trim()), ['How pricing works']); assert.equal(screen.queryByRole('note'), null);
  for (const hidden of ['Code', 'Applies to', 'Customer', 'Service restriction', 'Status', 'Vehicle restriction', 'Priority', 'Effective From', 'Effective To', 'Currency', 'Notes', 'Minimum Freight', 'Included Pieces', 'Wait-Free Allowance']) assert.equal(within(screen.getByRole('region', { name: 'Rate card editor' })).queryByLabelText(hidden), null, hidden);
  assert.equal(within(screen.getByRole('region', { name: 'Rate card editor' })).queryByLabelText('Fuel Surcharge'), null);
  await user.clear(screen.getByLabelText('Base Fee')); await user.type(screen.getByLabelText('Base Fee'), '27'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig().rateCards[0];
  assert.deepEqual({ ...original, ...RATE_CARD_BACKGROUND_DEFAULTS, baseFee: 27, code: 'CONTRACT-A', discount: { ...original.discount, scope: 'TRANSPORT_ONLY' }, version: original.version + 2, updatedAt: saved.updatedAt }, saved);
  assert.equal(saved.discount.type, 'NONE'); assert.equal(saved.minimumOrderSubtotal, 0); assert.deepEqual(loadBillingConfig(), billing);
  assert.equal(rateCardCode(' Pacific Fresh — 2026 '), 'PACIFIC-FRESH-2026'); assert.equal(rateCardCode(''), 'CARD');
});
test('hourly and zone cards show required method terms without exposing other methods', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'HOURLY' }); const page = render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' }));
  const terms = screen.getAllByRole('checkbox', { name: /Billable clock|Includes|Settled/ }); assert.equal(terms.length, 5); assert.ok(terms.every(box => (box as HTMLInputElement).checked && (box as HTMLInputElement).disabled)); assert.ok(screen.getByRole('checkbox', { name: 'Billable clock starts: Arrival at first pickup' })); assert.equal(screen.queryByRole('textbox', { name: /Billable clock/ }), null); assert.equal(terms[0].closest('details'), null); assert.equal(screen.queryByLabelText('Base Fee'), null); page.unmount();
  seedCard({ pricingMethod: 'ZONE', zoneMatrixMode: 'CONTRACT', zoneNoMatchFallback: 'NEEDS_ATTENTION' }); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByRole('combobox', { name: 'Zone prices' }), null); assert.equal(screen.queryByRole('checkbox', { name: /organization rates/ }), null); assert.equal(screen.queryByRole('combobox', { name: 'Pickup zone' }), null); assert.equal(screen.getAllByRole('table').length, 2); assert.ok(screen.getByRole('button', { name: 'Add' })); assert.equal(screen.queryByRole('combobox', { name: 'Zone no-match fallback' }), null); assert.equal(screen.queryByLabelText('Base Fee'), null); assert.equal(screen.queryByLabelText('Hourly Rate'), null);
});
test('hourly cards use Minimum Billable only: Minimum Charge is hidden and saved hourly minimums clear while other methods keep theirs', async () => {
  const config = loadPricingConfig();
  config.rateCards = [createEmptyRateCard({ id: 'hourly-min', name: 'Hourly A', scope: 'ORGANIZATION', pricingMethod: 'HOURLY', minimumBillableMinutes: 120, minimumOrderSubtotal: 150 }), createEmptyRateCard({ id: 'fixed-min', name: 'Fixed A', pricingMethod: 'FIXED', fixedAmount: 55, minimumOrderSubtotal: 40 })];
  savePricingConfig(config);
  const loaded = loadPricingConfig().rateCards;
  assert.equal(loaded.find(card => card.id === 'hourly-min')!.minimumOrderSubtotal, 0);
  assert.equal(loaded.find(card => card.id === 'hourly-min')!.minimumBillableMinutes, 120);
  assert.equal(loaded.find(card => card.id === 'fixed-min')!.minimumOrderSubtotal, 40);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('button', { name: 'Hourly A' }));
  assert.equal(screen.queryByLabelText('Minimum Charge'), null); assert.ok(screen.getByLabelText('Minimum Billable'));
  await user.click(screen.getByRole('button', { name: 'Fixed A' }));
  assert.equal((screen.getByLabelText('Minimum Charge') as HTMLInputElement).value, '40');
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  assert.ok(screen.getByLabelText('Minimum Charge'));
  await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); await user.click(screen.getByRole('option', { name: /Hourly/ }));
  assert.equal(screen.queryByLabelText('Minimum Charge'), null);
});
test('rate cards have Apply fuel and Apply vehicle surcharge checkboxes that save and survive reload; Imported cards have none; new Hourly and Zone cards start without the vehicle surcharge', async () => {
  const config = loadPricingConfig();
  config.rateCards = [createEmptyRateCard({ id: 'fixed-all-in', name: 'All-in fixed', scope: 'ORGANIZATION', pricingMethod: 'FIXED', fixedAmount: 95 }), createEmptyRateCard({ id: 'imported-card', name: 'Imported A', pricingMethod: 'IMPORTED' })];
  savePricingConfig(config);
  const user = userEvent.setup({ document });
  let page = render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('button', { name: 'All-in fixed' }));
  const fuel = screen.getByRole('checkbox', { name: /Apply fuel surcharge/ }) as HTMLInputElement;
  const vehicle = screen.getByRole('checkbox', { name: /Apply vehicle surcharge/ }) as HTMLInputElement;
  assert.equal(fuel.checked, true); assert.equal(vehicle.checked, true);
  assert.equal(fuel.closest('label')!.textContent, 'Apply fuel surcharge'); assert.equal(screen.queryByText(/Untick a surcharge/), null);
  await user.click(fuel); await user.click(vehicle);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  page.unmount(); page = render(React.createElement(RateCardsPage, {}));
  const saved = loadPricingConfig().rateCards.find(card => card.id === 'fixed-all-in')!;
  assert.equal(saved.applyFuelSurcharge, false); assert.equal(saved.applyVehicleSurcharge, false);
  await user.click(screen.getByRole('button', { name: 'All-in fixed' }));
  assert.equal((screen.getByRole('checkbox', { name: /Apply fuel surcharge/ }) as HTMLInputElement).checked, false);
  await user.click(screen.getByRole('button', { name: 'Imported A' }));
  assert.equal(screen.queryByRole('checkbox', { name: /Apply fuel surcharge/ }), null);
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); await user.click(screen.getByRole('option', { name: /Hourly/ }));
  assert.equal((screen.getByRole('checkbox', { name: /Apply vehicle surcharge/ }) as HTMLInputElement).checked, false);
  assert.equal((screen.getByRole('checkbox', { name: /Apply fuel surcharge/ }) as HTMLInputElement).checked, true);
  for (const [method, vehicleOn] of [[/Zone/, false], [/Fixed/, true], [/Distance/, true]] as const) {
    await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); await user.click(screen.getByRole('option', { name: method }));
    assert.equal((screen.getByRole('checkbox', { name: /Apply vehicle surcharge/ }) as HTMLInputElement).checked, vehicleOn, String(method));
    assert.equal((screen.getByRole('checkbox', { name: /Apply fuel surcharge/ }) as HTMLInputElement).checked, true, String(method));
  }
  page.unmount();
});
test('Imported cards sit at the end of the rate card list; the other cards keep their order', () => {
  const config = loadPricingConfig();
  config.rateCards = [createEmptyRateCard({ id: 'imp', name: 'Imported price (TMS)', pricingMethod: 'IMPORTED' }), createEmptyRateCard({ id: 'b', name: 'Zone B', pricingMethod: 'ZONE', scope: 'ORGANIZATION' }), createEmptyRateCard({ id: 'a', name: 'Fixed A', pricingMethod: 'FIXED' })];
  savePricingConfig(config);
  render(React.createElement(RateCardsPage, {}));
  const names = within(screen.getByRole('complementary', { name: 'Rate cards' })).getAllByRole('button').map(button => button.textContent ?? '').filter(text => /Imported price \(TMS\)|Zone B|Fixed A/.test(text));
  assert.deepEqual(names.map(name => name.match(/Imported price \(TMS\)|Zone B|Fixed A/)![0]), ['Zone B', 'Fixed A', 'Imported price (TMS)']);
});
test('unsaved card navigation can be cancelled without losing changes', async () => {
  const user = userEvent.setup({ document }); seedCard(); const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', status: 'ACTIVE', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); await user.type(screen.getByLabelText('Rate card name'), ' edited'); window.confirm = () => false;
  assert.equal(window.dispatchEvent(new Event(SETTINGS_NAVIGATION_EVENT, { cancelable: true })), false); await user.click(screen.getByRole('button', { name: 'Add card' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A');
  await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); window.confirm = () => true; await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Fixed Amount per Delivery') as HTMLInputElement).value, '55'); assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
});
test('driver details have no order limit field and saving keeps an existing individual limit', async () => {
  const { DriverEditor } = await import('../src/components/entities/DriverEditor');
  const { INITIAL_DRIVERS } = await import('../src/data/mockData');
  const { normalizeDriver } = await import('../src/lib/driverStorage');
  const driver = normalizeDriver({ ...INITIAL_DRIVERS[0], maxActiveOrders: 8, address: '100 Main St, Vancouver, BC V6A 2S5', email: 'driver@example.ca' }); let saved: typeof driver | undefined;
  const user = userEvent.setup({ document });
  render(React.createElement(DriverEditor, { driver, drivers: [driver], onSave: (value: typeof driver) => { saved = value; }, onCancel: noop }));
  assert.equal(screen.queryByLabelText('Maximum Active Orders'), null);
  await user.click(screen.getByRole('button', { name: 'Save driver' }));
  assert.equal(saved?.maxActiveOrders, 8);
});

test('Pricing Service Level edits core details while preserving hidden settings and other catalogue sections', async () => {
  const config = loadSimplePricingConfig(); config.services[0].additionalCharge = 0; config.services[0].exclusiveVehicle = true; config.services[0].active = false; saveSimplePricingConfig(config);
  const service = config.services[0]; const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('tab', { name: 'Service Level' }));
  await user.click(screen.getByRole('button', { name: `Edit ${service.name}` }));
  for (const label of ['Booking cutoff', 'Delivery promise', 'Code']) assert.equal(screen.queryByLabelText(label), null);
  assert.equal(screen.queryAllByRole('checkbox').length, 0);
  assert.equal((screen.getByLabelText('Additional charge (CAD)') as HTMLInputElement).value, '0');
  await user.type(screen.getByLabelText('Service name'), ' Updated');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].additionalCharge, 0);
  const savedService = loadSimplePricingConfig().services[0];
  for (const key of ['code', 'bookingCutoffTime', 'estimatedTime', 'exclusiveVehicle', 'active'] as const) assert.equal(savedService[key], service[key], key);
  await user.click(screen.getByRole('button', { name: `Edit ${service.name} Updated` }));
  await user.clear(screen.getByLabelText('Additional charge (CAD)'));
  await user.type(screen.getByLabelText('Additional charge (CAD)'), '1.5');
  const other = loadSimplePricingConfig(); other.accessorials[0].rate = 123; saveSimplePricingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].additionalCharge, 1.5);
  assert.equal(loadSimplePricingConfig().accessorials[0].rate, 123);
  assert.ok(within(screen.getByRole('row', { name: new RegExp(`${service.name} Updated`) })).getByText('$1.50'));
  await user.click(screen.getByRole('button', { name: `Edit ${service.name} Updated` }));
  assert.equal((screen.getByLabelText('Additional charge (CAD)') as HTMLInputElement).value, '1.5');
});
test('new services default to zero and reject blank, negative or fractional-cent charges', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('tab', { name: 'Service Level' }));
  await user.click(screen.getByRole('button', { name: 'Add Service' }));
  for (const label of ['Booking cutoff', 'Delivery promise', 'Code']) assert.equal(screen.queryByLabelText(label), null);
  assert.equal(screen.queryAllByRole('checkbox').length, 0);
  assert.equal((screen.getByLabelText('Additional charge (CAD)') as HTMLInputElement).value, '0');
  await user.type(screen.getByLabelText('Service name'), 'Custom service');
  const before = loadSimplePricingConfig().services.length;
  for (const invalid of ['', '-1', '1.234']) {
    await user.clear(screen.getByLabelText('Additional charge (CAD)'));
    if (invalid) await user.type(screen.getByLabelText('Additional charge (CAD)'), invalid);
    await user.click(screen.getByRole('button', { name: 'Create Service' }));
    assert.equal(loadSimplePricingConfig().services.length, before);
  }
  await user.clear(screen.getByLabelText('Additional charge (CAD)'));
  await user.type(screen.getByLabelText('Additional charge (CAD)'), '1.25');
  await user.click(screen.getByRole('button', { name: 'Create Service' }));
  const created = loadSimplePricingConfig().services.find(service => service.name === 'Custom service')!;
  assert.equal(created.additionalCharge, 1.25);
  assert.equal(created.code, 'CUSTOM_SERVICE');
  assert.equal(created.active, true); assert.equal(created.exclusiveVehicle, false);
  assert.equal(created.bookingCutoffTime, undefined); assert.equal(created.estimatedTime, undefined);
});
test('Accessorial edit keeps only dollar rate and Taxable, preserving other catalogue edits', async () => {
  const config = loadSimplePricingConfig(); const acc = config.accessorials[0];
  const user = userEvent.setup({ document }); render(React.createElement(CatalogueSection, { section: 'accessorials' }));
  await user.click(screen.getByRole('button', { name: `Edit ${acc.name}` }));
  const dialog = document.querySelector('[data-entity-dialog]') as HTMLElement;
  assert.equal(within(dialog).queryByRole('combobox'), null);
  assert.deepEqual(within(dialog).getAllByRole('checkbox').map(el => el.parentElement?.textContent?.trim()), ['Taxable']);
  for (const label of ['Minimum charge', 'Maximum charge', 'Automatic rule', 'Applies at', 'Calculation type', 'Free allowance', 'Billing increment', 'Code']) assert.equal(within(dialog).queryByLabelText(label), null);
  await user.clear(screen.getByLabelText('Accessorial rate')); await user.type(screen.getByLabelText('Accessorial rate'), '12.34');
  await user.click(screen.getByRole('checkbox', { name: 'Taxable' }));
  const other = loadSimplePricingConfig(); other.services[0].description = 'Concurrent service edit'; saveSimplePricingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  const saved = loadSimplePricingConfig(); assert.equal(saved.accessorials[0].rate, 12.34); assert.equal(saved.accessorials[0].taxable, false);
  assert.equal(saved.services[0].description, 'Concurrent service edit');
  await user.click(screen.getByRole('button', { name: 'Add Accessorial' }));
  await user.type(screen.getByLabelText('Accessorial name'), 'Special handling');
  await user.click(screen.getByRole('button', { name: 'Create Accessorial' }));
  const created = loadSimplePricingConfig().accessorials.find(a => a.name === 'Special handling')!;
  assert.deepEqual([created.calculationType, created.appliesAt, created.autoRule, created.minimumCharge, created.maximumCharge, created.taxable], ['FLAT', 'ORDER', 'NONE', null, null, true]);
});
test('imported cards are final-total, editable, cannot be the default and have no minimum or surcharge settings', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'IMPORTED', importedPriceMode: 'FINAL_TOTAL' }); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByRole('combobox', { name: 'Imported amount means' }), null); assert.ok(screen.getByText('The imported amount is the final total, including tax')); assert.equal(screen.queryByRole('button', { name: 'Set as default' }), null); assert.equal(screen.queryByLabelText('Minimum Charge'), null); assert.equal(screen.queryByRole('checkbox', { name: /Apply fuel surcharge/ }), null); await user.type(screen.getByLabelText('Rate card name'), ' renewed'); await user.click(screen.getByRole('button', { name: 'Save Card' })); assert.equal(loadPricingConfig().rateCards[0].importedPriceMode, 'FINAL_TOTAL');
});

test('Taxes and Preferences save independently', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(React.Fragment, null, React.createElement(TaxesPage), React.createElement(PreferencesPage)));
  assert.deepEqual(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent), ['Tax Registration', 'GST/HST', 'Provincial tax', 'Regional Preferences']);
  for (const label of ['Company phone', 'Company email']) assert.equal(screen.queryByLabelText(label), null);
  await select(user, 'Organization timezone', 'Toronto');
  await user.clear(screen.getByRole('spinbutton', { name: 'GST/HST rate' }));
  await user.type(screen.getByRole('spinbutton', { name: 'GST/HST rate' }), '12');
  assert.equal(loadBillingConfig().companyTax.ratePercent, 5);
  await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
  assert.equal(loadBillingConfig().companyTax.ratePercent, 12);
  assert.notEqual(loadBillingConfig().general.timeZone, 'America/Toronto');
  await user.click(screen.getByRole('button', { name: 'Save Preferences' }));
  const saved = loadBillingConfig();
  assert.equal(saved.general.timeZone, 'America/Toronto');
  assert.equal(saved.companyTax.ratePercent, 12);
  assert.equal(saved.invoicing.taxRegistrationNumber, '');
});

test('customer payment terms create, reload and edit independently of company settings', async () => {
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { loadCustomers } = await import('../src/lib/customerStorage');
  const user = userEvent.setup({ document });
  const billing = loadBillingConfig(); billing.invoicing.defaultPaymentTerms = 'NET15'; saveBillingConfig(billing);
  const page = render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Shipper' }));
  assert.match(screen.getByRole('combobox', { name: 'Default payment terms' }).textContent!, /Net 15 days/);
  await user.click(screen.getByRole('combobox', { name: 'Default payment terms' }));
  assert.deepEqual(screen.getAllByRole('option').map(option => option.textContent), ['COD — Due on delivery', 'Net 15 days', 'Net 30 days', 'Net 45 days']);
  await user.click(screen.getByRole('option', { name: 'Net 45 days' }));
  await user.type(screen.getByRole('textbox', { name: 'Shipper name' }), 'Terms Shipper');
  await user.type(screen.getByRole('textbox', { name: 'Company name' }), 'Terms Logistics');
  await user.type(screen.getByRole('textbox', { name: /^Email / }), 'terms@example.ca');
  await user.click(screen.getByRole('button', { name: 'Create Shipper' }));
  assert.equal(loadCustomers().find(customer => customer.name === 'Terms Shipper')?.paymentTerms, 'NET45');
  page.unmount();
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(within(screen.getByRole('row', { name: /Terms Shipper/ })).getByTitle('Edit shipper account'));
  assert.match(screen.getByRole('combobox', { name: 'Default payment terms' }).textContent!, /Net 45 days/);
  await select(user, 'Default payment terms', 'COD — Due on delivery');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadCustomers().find(customer => customer.name === 'Terms Shipper')?.paymentTerms, 'COD');
  assert.deepEqual(loadBillingConfig(), billing);
});

test('editing older customers displays inherited and legacy payment terms without losing them', async () => {
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { loadCustomers, saveCustomers } = await import('../src/lib/customerStorage');
  const user = userEvent.setup({ document });
  const billing = loadBillingConfig(); billing.invoicing.defaultPaymentTerms = 'NET45'; saveBillingConfig(billing);
  const customers = loadCustomers(); customers[0].paymentTerms = 'INHERIT'; customers[1].paymentTerms = 'NET7'; saveCustomers(customers);
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getAllByTitle('Edit shipper account')[0]);
  assert.match(screen.getByRole('combobox', { name: 'Default payment terms' }).textContent!, /Net 45 days/);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadCustomers()[0].paymentTerms, 'NET45');
  await user.click(screen.getAllByTitle('Edit shipper account')[1]);
  assert.match(screen.getByRole('combobox', { name: 'Default payment terms' }).textContent!, /Net 7 days/);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadCustomers()[1].paymentTerms, 'NET7');
});

test('Preferences save while preserving stored contact details and internal costs', async () => {
  const user = userEvent.setup({ document });
  const initial = loadBillingConfig();
  initial.company.phone = '604-555-0100';
  initial.company.email = 'billing@pacific.test';
  initial.invoicing.taxRegistrationNumber = 'REG-OLD';
  saveBillingConfig(initial);
  const company = render(React.createElement(PreferencesPage, {}));
  assert.equal(screen.queryByLabelText('Company phone'), null);
  assert.equal(screen.queryByLabelText('Company email'), null);
  await select(user, 'Organization timezone', 'Toronto');
  const other = loadBillingConfig(); other.invoicing.quoteValidityDays = 21; saveBillingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save Preferences' }));
  const saved = loadBillingConfig();
  assert.equal(saved.general.timeZone, 'America/Toronto');
  assert.equal(saved.invoicing.quoteValidityDays, 21);
  assert.deepEqual(saved.company, initial.company);
  assert.equal(saved.invoicing.taxRegistrationNumber, 'REG-OLD');
  company.unmount();
  assert.deepEqual(loadBillingConfig().operatingCost, other.operatingCost);
});

test('GST/HST rate drafts save decimals and zero, survive reload and validate on the Taxes tab', async () => {
  const user = userEvent.setup({ document });
  let view = render(React.createElement(TaxesPage, {}));
  for (const rate of ['12.75', '0']) {
    const previous = loadBillingConfig().companyTax.ratePercent;
    await user.clear(screen.getByRole('spinbutton', { name: 'GST/HST rate' }));
    await user.type(screen.getByRole('spinbutton', { name: 'GST/HST rate' }), rate);
    assert.equal(loadBillingConfig().companyTax.ratePercent, previous);
    await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
    assert.equal(loadBillingConfig().companyTax.ratePercent, Number(rate));
    view.unmount(); view = render(React.createElement(TaxesPage, {}));
    assert.equal((screen.getByRole('spinbutton', { name: 'GST/HST rate' }) as HTMLInputElement).value, rate);
  }
  for (const invalid of ['', '-1', '101']) {
    await user.clear(screen.getByRole('spinbutton', { name: 'GST/HST rate' }));
    if (invalid) await user.type(screen.getByRole('spinbutton', { name: 'GST/HST rate' }), invalid);
    await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
    assert.match(screen.getByRole('alert').textContent!, /0 to 100%/);
    assert.equal(loadBillingConfig().companyTax.ratePercent, 0);
  }
});

test('tax checkboxes control optional rates and preserve them after reload', async () => {
  const user = userEvent.setup({ document });
  let page = render(React.createElement(TaxesPage, {}));
  const gst = screen.getByRole('checkbox', { name: 'Apply GST/HST to taxable charges' }) as HTMLInputElement;
  const provincial = screen.getByRole('checkbox', { name: 'Apply provincial tax to taxable charges' }) as HTMLInputElement;
  assert.equal(gst.checked, true);
  assert.equal(provincial.checked, false);
  assert.equal((screen.getByRole('spinbutton', { name: 'Provincial tax rate' }) as HTMLInputElement).disabled, true);
  await user.click(gst);
  await user.click(provincial);
  assert.equal((screen.getByRole('spinbutton', { name: 'GST/HST rate' }) as HTMLInputElement).disabled, true);
  const provincialRate = screen.getByRole('spinbutton', { name: 'Provincial tax rate' });
  await user.clear(provincialRate);
  await user.type(provincialRate, '7.5');
  await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
  assert.deepEqual(loadBillingConfig().companyTax, { enabled: false, ratePercent: 5, provincialEnabled: true, provincialRatePercent: 7.5 });
  page.unmount(); page = render(React.createElement(TaxesPage, {}));
  assert.equal((screen.getByRole('checkbox', { name: 'Apply GST/HST to taxable charges' }) as HTMLInputElement).checked, false);
  assert.equal((screen.getByRole('checkbox', { name: 'Apply provincial tax to taxable charges' }) as HTMLInputElement).checked, true);
  assert.equal((screen.getByRole('spinbutton', { name: 'Provincial tax rate' }) as HTMLInputElement).value, '7.5');
  await user.clear(screen.getByRole('spinbutton', { name: 'Provincial tax rate' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Provincial tax rate' }), '101');
  await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
  assert.match(screen.getByRole('alert').textContent!, /provincial tax rate from 0 to 100%/);
  assert.equal(loadBillingConfig().companyTax.provincialRatePercent, 7.5);
  await user.click(screen.getByRole('checkbox', { name: 'Apply provincial tax to taxable charges' }));
  await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
  assert.equal(loadBillingConfig().companyTax.provincialEnabled, false);
});

test('Operating Costs drops retired margin targets while preserving costs', async () => {
  const saved = loadBillingConfig();
  Object.assign(saved.operatingCost, { targetGrossMarginPercent: 60, driverCostPerHour: 42 });
  saveBillingConfig(saved);
  const restored = loadBillingConfig();
  assert.equal('targetGrossMarginPercent' in restored.operatingCost, false);
  assert.equal(restored.operatingCost.driverCostPerHour, 42);
  render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.queryByRole('tab', { name: 'Vehicle & Labour Costs' }), null);
  assert.equal(screen.queryByLabelText('Driver Cost / hour'), null);
});

test('pricing-method filter sits in the editor header and still filters the card list', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig();
  config.rateCards.push(createEmptyRateCard({ name: 'Fixed contract', status: 'ACTIVE', pricingMethod: 'FIXED' })); savePricingConfig(config);
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  const editor = within(screen.getByRole('region', { name: 'Rate card editor' }));
  assert.ok(editor.getByRole('combobox', { name: 'Filter pricing method' }));
  assert.equal(within(screen.getByRole('complementary', { name: 'Rate cards' })).queryByRole('combobox', { name: 'Filter pricing method' }), null);
  await select(user, 'Filter pricing method', 'Fixed per delivery');
  assert.equal(screen.queryByRole('button', { name: 'Contract A' }), null);
  assert.ok(screen.getByRole('button', { name: 'Fixed contract' }));
  await select(user, 'Filter pricing method', 'All pricing methods');
  assert.ok(screen.getByRole('button', { name: 'Contract A' }));
});

test('Pricing tabs show one section, support keyboard navigation and preserve independent drafts', async () => {
  const user = userEvent.setup({ document }); seedCard();
  render(React.createElement(RateCardsPage, {  }));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Rate Cards', 'Service Level', 'Accessorials', 'Fuel Surcharge', 'Taxes', 'Vehicle Types', 'Preferences']);
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  await user.type(screen.getByLabelText('Rate card name'), ' draft');
  await user.click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
  assert.equal(screen.queryByRole('button', { name: 'Save Card' }), null);
  const fuel = screen.getByLabelText('Fuel surcharge (%)');
  await user.clear(fuel); await user.type(fuel, '17');
  await user.click(screen.getByRole('tab', { name: 'Accessorials' }));
  assert.ok(screen.getByRole('heading', { name: 'Accessorials' }));
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  await user.keyboard('{End}');
  assert.equal(screen.getByRole('tab', { name: 'Preferences' }).getAttribute('aria-selected'), 'true');
  await user.keyboard('{Home}');
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A draft');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A draft');
  await user.click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
  assert.equal((screen.getByLabelText('Fuel surcharge (%)') as HTMLInputElement).value, '17');
  await user.click(screen.getByRole('button', { name: 'Save Fuel Surcharge' }));
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 17);
  assert.equal(screen.queryByRole('spinbutton', { name: 'Dimensional Divisor' }), null); assert.equal(screen.queryByRole('spinbutton', { name: 'Extra Stop Charge' }), null);
  assert.equal(screen.queryByRole('tab', { name: 'Vehicle Pricing' }), null); assert.equal(screen.queryByRole('tab', { name: 'Surcharges' }), null); assert.equal(screen.queryByRole('tab', { name: 'Stops & Weight' }), null);
  assert.equal(screen.queryByRole('tab', { name: 'Zones' }), null);
});

test('customer groups are absent from Pricing tabs and the customer form attaches any active card', async () => {
  const user = userEvent.setup({ document }); seedCard();
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  assert.equal(screen.queryByRole('tab', { name: 'Customer Groups' }), null);
  assert.equal(screen.queryByRole('combobox', { name: 'Applies to' }), null);
  cleanup();
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { normalizeCustomer, DEFAULT_SHIPPERS } = await import('../src/lib/customerStorage');
  assert.equal(normalizeCustomer({ ...DEFAULT_SHIPPERS[0], customerGroupId: 'old-group' }).customerGroupId, undefined);
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Shipper' }));
  assert.equal(screen.queryByRole('combobox', { name: 'Customer group' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Shipper rate card' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['Contract A (Default)']); assert.equal(screen.queryByRole('option', { name: /^Default \(/ }), null);
});

test('Fuel Surcharge omits retired rounding and minimum controls', async () => {
  const config = loadBillingConfig();
  Object.assign(config.rules, { moneyRounding: 'nearest_1', distanceRoundingKm: 1, minimumBillableKm: 3 });
  saveBillingConfig(config);
  assert.deepEqual(loadBillingConfig().rules, { minimumChargePerJob: config.rules.minimumChargePerJob, minimumBillableKm: 0 });
  render(React.createElement(RateCardsPage, {  }));
  await userEvent.setup({ document }).click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
  assert.equal(screen.queryByRole('combobox', { name: /rounding/i }), null);
  assert.equal(screen.queryByLabelText('Minimum Billable Distance'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Minimums' }), null);
});

test('rate cards expose a saved minimum charge with zero to disable it', async () => {
  const user = userEvent.setup({ document });
  seedCard({ minimumOrderSubtotal: 25 });
  render(React.createElement(RateCardsPage, {  }));
  await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  const minimum = screen.getByLabelText('Minimum Charge');
  assert.equal((minimum as HTMLInputElement).value, '25');
  assert.equal(minimum.closest('details'), null);
  await user.clear(minimum); await user.type(minimum, '40');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.equal(loadPricingConfig().rateCards[0].minimumOrderSubtotal, 40);
  await user.clear(minimum); await user.type(minimum, '0');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.equal(loadPricingConfig().rateCards[0].minimumOrderSubtotal, 0);
});

test('legacy inherited minimums migrate to cards without overriding explicit values or waivers', () => {
  const billing = loadBillingConfig(); billing.rules.minimumChargePerJob = 42; saveBillingConfig(billing);
  const config = loadPricingConfig();
  config.rateCards = [
    createEmptyRateCard({ id: 'inherited', minimumOrderSubtotal: null }),
    createEmptyRateCard({ id: 'explicit', minimumOrderSubtotal: 17 }),
    createEmptyRateCard({ id: 'waived', minimumOrderSubtotal: null, applyOrderMinimum: false }),
  ];
  localStorage.setItem('dispatra_pricing_v1', JSON.stringify({ ...config, schemaVersion: 4 }));
  const migrated = loadPricingConfig();
  assert.deepEqual(migrated.rateCards.map(card => card.minimumOrderSubtotal), [42, 17, 0]);
  billing.rules.minimumChargePerJob = 99; saveBillingConfig(billing);
  assert.deepEqual(loadPricingConfig(), migrated);
  assert.equal(createEmptyRateCard().minimumOrderSubtotal, 0);
});

test('Medical & Pharma demo card stays archived for fresh and previously saved settings', () => {
  const fresh = loadPricingConfig();
  assert.equal(fresh.rateCards.find(card => card.id === 'rc_medical_group')!.status, 'ARCHIVED');
  const old = fresh.rateCards.find(card => card.id === 'rc_medical_group')!;
  Object.assign(old, { name: 'Medical & Pharma Group', status: 'ACTIVE', scope: 'ORGANIZATION', version: 4 });
  fresh.rateCards.find(card => card.id === 'rc_org_standard')!.scope = 'ORDER';
  fresh.rateCards.push(createEmptyRateCard({ id: 'custom-medical', name: 'Medical & Pharma Group' }));
  localStorage.setItem('dispatra_pricing_v1', JSON.stringify({ ...fresh, schemaVersion: 7 }));
  const migrated = loadPricingConfig();
  const archived = migrated.rateCards.find(card => card.id === old.id)!;
  assert.equal(archived.status, 'ARCHIVED'); assert.equal(archived.version, 5);
  assert.equal(archived.baseFee, old.baseFee); assert.equal(archived.kmRate, old.kmRate);
  assert.equal(migrated.rateCards.find(card => card.id === 'custom-medical')!.status, 'ACTIVE');
  assert.deepEqual(migrated.rateCards.filter(card => card.status === 'ACTIVE' && card.scope === 'ORGANIZATION').map(card => card.id), ['rc_org_standard']);
  assert.deepEqual(loadPricingConfig(), migrated);
  render(React.createElement(RateCardsPage, {}));
  const list = within(screen.getByRole('complementary', { name: 'Rate cards' }));
  assert.equal(list.getAllByRole('button', { name: 'Medical & Pharma Group' }).length, 1); // Only the unrelated custom card remains.
  assert.equal(JSON.parse(localStorage.getItem('dispatra_pricing_v1')!).rateCards.find((card: { id: string }) => card.id === old.id).status, 'ARCHIVED');
});

test('selecting another rate card focuses its editor without scrolling the page', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config);
  const original = HTMLElement.prototype.scrollIntoView;
  let scrolls = 0;
  HTMLElement.prototype.scrollIntoView = () => { scrolls++; };
  try {
    render(React.createElement(RateCardsPage, {}));
    await user.click(within(screen.getByRole('complementary', { name: 'Rate cards' })).getByRole('button', { name: 'Contract B' }));
    const editor = screen.getByRole('region', { name: 'Rate card editor' });
    assert.equal(document.activeElement, editor);
    assert.ok(within(editor).getByRole('heading', { name: 'Contract B' }));
    assert.equal(scrolls, 0);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test('rate cards show a Default badge, can be re-defaulted and archived from the footer, and the Default cannot be archived', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config);
  const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onNotification: message => notices.push(message) }));
  assert.equal(screen.queryByLabelText('Show archived'), null);
  const list = within(screen.getByRole('complementary', { name: 'Rate cards' }));
  assert.match(list.getByRole('button', { name: 'Contract A' }).textContent!, /Default/); assert.doesNotMatch(list.getByRole('button', { name: 'Contract B' }).textContent!, /Default/);
  assert.equal(screen.queryByRole('button', { name: 'Archive' }), null); assert.equal(screen.queryByRole('button', { name: 'Set as default' }), null);
  assert.equal(screen.getAllByRole('button', { name: 'Save Card' }).length, 1);
  await user.click(list.getByRole('button', { name: 'Contract B' }));
  await user.click(screen.getByRole('button', { name: 'Set as default' }));
  assert.match(list.getByRole('button', { name: 'Contract B' }).textContent!, /Default/); assert.doesNotMatch(list.getByRole('button', { name: 'Contract A' }).textContent!, /Default/);
  assert.deepEqual(loadPricingConfig().rateCards.map(card => card.scope), ['ORDER', 'ORGANIZATION']);
  await user.click(list.getByRole('button', { name: 'Contract A' }));
  const archive = screen.getByRole('button', { name: 'Archive' }); assert.ok(archive.compareDocumentPosition(screen.getByLabelText('Minimum Charge')) & Node.DOCUMENT_POSITION_PRECEDING);
  let confirmText = ''; window.confirm = message => { confirmText = String(message); return true; };
  await user.click(archive);
  assert.match(confirmText, /already priced.*unchanged.*No shippers are attached/);
  assert.equal(list.queryByRole('button', { name: 'Contract A' }), null); assert.equal(loadPricingConfig().rateCards[0].status, 'ARCHIVED');
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract B');
  assert.equal(screen.queryByRole('button', { name: 'Archive' }), null);
  assert.match(notices.join(' '), /now the Default/); assert.match(notices.join(' '), /Archived "Contract A"/);
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  await user.type(screen.getByLabelText('Rate card name'), ' C'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const created = loadPricingConfig().rateCards.find(card => card.name === 'New Rate Card C')!;
  assert.equal(created.status, 'ACTIVE'); assert.equal(created.scope, 'ORDER'); assert.equal(created.serviceId, null); assert.equal(created.applyServiceMultiplier, true);
});

test('zone card shows one central-pickup table and retains older directional records', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'ZONE', zoneRates: [
    { id: 'ab', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 45 },
    { id: 'ba', originZoneId: 'zone_bby', destinationZoneId: 'zone_van', serviceId: null, amount: 70 },
  ] });
  render(React.createElement(RateCardsPage, {}));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(screen.getAllByRole('table').length, 2);
  assert.equal(within(matrix).getAllByRole('columnheader').length, 9);
  assert.equal((screen.getByLabelText('Burnaby / New West price') as HTMLInputElement).value, '45');
  await user.type(screen.getByLabelText('Weight to (kg)'), '500');
  await user.type(screen.getByLabelText('Richmond / YVR price'), '52');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const rates = loadPricingConfig().rateCards[0].zoneRates!;
  assert.equal(rates.find(rate => rate.id === 'ab')!.amount, 45);
  assert.equal(rates.find(rate => rate.id === 'ba')!.amount, 70);
  assert.equal(rates.find(rate => rate.originZoneId === '__central_pickup__' && rate.destinationZoneId === 'zone_rmd')!.weightBands![0].amount, 52);
});

test('preset card names migrate once without changing rates or custom names', () => {
  const config = loadPricingConfig();
  assert.deepEqual(config.rateCards.filter(card => card.status === 'ACTIVE').map(card => card.name), ['Distance based', 'Zone to zone', 'Fixed per delivery', 'Hourly']);
  const previous = ['Standard', 'Pacific Fresh Contract', 'Nordic Bio — Direct Fixed', 'West Coast Cold — Dedicated Hourly'];
  const active = config.rateCards.filter(card => card.status === 'ACTIVE');
  active.forEach((card, i) => { card.name = previous[i]; card.version = 7; });
  localStorage.setItem('dispatra_pricing_v1', JSON.stringify({ ...config, schemaVersion: 7 }));
  const migrated = loadPricingConfig();
  migrated.rateCards.filter(card => card.status === 'ACTIVE').forEach((card, i) => {
    assert.equal(card.version, i === 1 ? 9 : 8);
    assert.deepEqual({ ...card, name: active[i].name, version: 7, updatedAt: active[i].updatedAt }, active[i]);
  });
  assert.deepEqual(loadPricingConfig(), migrated);
  migrated.rateCards[0].name = 'Negotiated distance'; savePricingConfig(migrated);
  assert.equal(loadPricingConfig().rateCards[0].name, 'Negotiated distance');
});

test('adding a destination zone expands the single matrix without changing another card', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  const ab = { id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 45 };
  const ba = { id: 'ba', originZoneId: 'b', destinationZoneId: 'a', serviceId: null, amount: 70 };
  seedCard({ pricingMethod: 'ZONE', zoneRates: [ab, ba] });
  const config = loadPricingConfig();
  config.zones = [{ id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['001'] }, { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['002'] }];
  config.rateCards.push(createEmptyRateCard({ id: 'other-zone', name: 'Other zone card', pricingMethod: 'ZONE', zoneRates: [ab] }));
  savePricingConfig(config);
  const beforeOther = loadPricingConfig().rateCards[1];
  render(React.createElement(RateCardsPage, {}));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.deepEqual(within(matrix).getAllByRole('columnheader').map(header => header.textContent), ['From (kg)', 'To (kg)', 'Zone 1', 'Zone 2', 'Action']);
  await user.click(screen.getByRole('button', { name: 'Add' }));
  const name = screen.getAllByLabelText('Zone name: New Zone')[0];
  await user.clear(name); await user.type(name, 'Airport');
  await user.type(screen.getByRole('textbox', { name: 'ZIP / postal codes for Airport' }), '003');
  assert.equal(within(matrix).getAllByRole('columnheader').length, 6);
  assert.equal((screen.getByLabelText('Airport price') as HTMLInputElement).value, '');
  await user.type(screen.getByLabelText('Airport price'), '50');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig();
  assert.equal(saved.rateCards[0].zoneRates!.find(rate => rate.originZoneId === '__central_pickup__' && rate.destinationZoneId === saved.zones.at(-1)!.id)!.amount, 50);
  assert.deepEqual(saved.rateCards[1], beforeOther);
});

test('sidebar brand replaces Monitor navigation and supports logo, wordmark and keyboard activation', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = userEvent.setup({ document });
  const visited: string[] = []; let hidden = 0;
  const props = { activeTab: 'customers', isOpen: true, onToggle: () => { hidden += 1; },
    setActiveTab: (tab: string) => visited.push(tab), showAccountPopover: false, setShowAccountPopover: noop,
    onActionNotification: noop, dispatchMode: 'AUTO' as const, onDispatchModeChange: noop };
  const view = render(React.createElement(Sidebar, props));
  const navigation = within(screen.getByRole('navigation'));
  assert.deepEqual(navigation.getAllByRole('button').map(button => button.textContent), ['Orders', 'Drivers', 'Vehicles', 'Shippers', 'Analytics']);
  await user.click(navigation.getByRole('button', { name: 'Shippers' }));
  await user.click(navigation.getByRole('button', { name: 'Analytics' }));
  assert.deepEqual(visited.splice(0), ['customers', 'reports']);
  const brand = screen.getByRole('button', { name: 'Dispatra — Monitor' });
  assert.equal(brand.getAttribute('aria-current'), null);
  await user.click(brand.querySelector('img')!);
  await user.click(within(brand).getByText('Dispatra'));
  brand.focus(); await user.keyboard('{Enter}'); await user.keyboard(' ');
  assert.deepEqual(visited, ['monitor', 'monitor', 'monitor', 'monitor']);
  assert.equal(hidden, 0);
  await user.click(screen.getByRole('button', { name: 'Collapse menu' }));
  assert.equal(hidden, 1); assert.equal(visited.length, 4);
  view.rerender(React.createElement(Sidebar, { ...props, activeTab: 'monitor' }));
  assert.equal(screen.getByRole('button', { name: 'Dispatra — Monitor' }).getAttribute('aria-current'), 'page');
  view.rerender(React.createElement(Sidebar, { ...props, isOpen: false }));
  assert.equal(screen.getByRole('complementary', { name: 'Main navigation' }).getAttribute('data-collapsed'), 'true');
  const collapsedLogo = screen.getByRole('button', { name: 'Expand menu' });
  assert.ok(collapsedLogo.querySelector('img'));
  assert.equal(collapsedLogo.querySelector('svg'), null);
  assert.equal(screen.getByRole('button', { name: 'Drivers' }).title, 'Drivers');
  await user.click(screen.getByRole('button', { name: 'Drivers' }));
  assert.equal(visited.at(-1), 'drivers');
  assert.ok(screen.getByRole('button', { name: 'Dispatcher Account' }));
  assert.equal(screen.getByRole('switch', { name: 'Auto dispatch' }).getAttribute('aria-checked'), 'true');
  await user.click(screen.getByRole('button', { name: 'Expand menu' }));
  assert.equal(hidden, 2);
  assert.equal(visited.at(-1), 'drivers', 'Expanding from the logo preserves the active page');
});

test('account menu offers direct Profile and Settings destinations and dismisses correctly', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = userEvent.setup({ document });
  const visited: string[] = [];
  function Example() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(React.Fragment, null,
      React.createElement(Sidebar, { activeTab: 'rate-cards', isOpen: true, onToggle: noop, setActiveTab: page => visited.push(page),
        showAccountPopover: open, setShowAccountPopover: setOpen, onActionNotification: noop,
        onOpenPricing: () => visited.push('rate-cards'), dispatchMode: 'AUTO', onDispatchModeChange: noop }),
      React.createElement('button', null, 'Outside content'));
  }
  render(React.createElement(Example));
  const trigger = screen.getByTitle('Dispatcher Account');
  await user.click(trigger);
  const menu = screen.getByRole('menu', { name: 'Account menu' });
  assert.deepEqual(within(menu).getAllByRole('menuitem').map(item => item.textContent), ['Profile', 'Settings', 'Help', 'Logout']);
  await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
  assert.deepEqual(visited, ['rate-cards']);
  assert.equal(screen.queryByRole('menu'), null);
  await user.click(trigger); await user.click(screen.getByRole('button', { name: 'Outside content' }));
  assert.equal(screen.queryByRole('menu'), null);
  await user.click(trigger); await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('menu'), null);
  assert.equal(document.activeElement, trigger);
});

test('Vehicle Types tab adds, edits and deletes types with payload, pallets and cargo size in company units', async () => {
  const user = userEvent.setup({ document }); const notes: string[] = [];
  render(React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(VehicleTypesSection, { onNotification: (m: string) => notes.push(m) })));
  const section = within(screen.getByRole('region', { name: 'Vehicle types' }));
  for (const name of ['Name', 'Max payload (lb)', 'Pallet capacity', 'Cargo L × W × H (in)', 'Surcharge', 'Action']) assert.ok(section.getByRole('columnheader', { name }), name);
  assert.deepEqual(section.getAllByRole('row').slice(1).map(row => (row as HTMLTableRowElement).cells[0].textContent), ['Box Truck', 'Cargo Van', 'Cube Van', 'Dry Van Trailer', 'Flatbed Trailer', 'Flatbed Truck', 'Refrigerated Trailer', 'Refrigerated Truck', 'Refrigerated Van']);
  assert.equal(section.queryByText(/Tonne|retired/), null);
  assert.match(section.getByText('Cube Van').closest('tr')!.textContent!, /4,300.*8.*192 × 91 × 78/);
  assert.equal(section.queryByText(/^fleet_/), null);
  await user.click(section.getByRole('button', { name: 'Add Vehicle Type' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByLabelText('Name'), 'Reefer Van');
  await user.type(dialog.getByLabelText('Max payload (lb)'), '2200');
  await user.type(dialog.getByLabelText('Pallet capacity'), '3');
  await user.click(dialog.getByRole('button', { name: 'Add Vehicle Type' }));
  assert.match(dialog.getByRole('alert').textContent!, /length, width and height/);
  for (const [label, value] of [['Box length (in)', '144'], ['Box width (in)', '70'], ['Box height (in)', '72']]) await user.type(dialog.getByLabelText(label), value);
  await user.clear(dialog.getByLabelText('Surcharge ($)')); await user.type(dialog.getByLabelText('Surcharge ($)'), '15');
  await user.click(dialog.getByRole('button', { name: 'Add Vehicle Type' }));
  let saved = loadSimplePricingConfig().vehicles.find(type => type.name === 'Reefer Van')!;
  assert.ok(Math.abs(saved.payloadCapacityKg - 2200 * 0.45359237) < 1e-6); assert.equal(saved.palletCapacity, 3);
  assert.ok(Math.abs(saved.cargoLengthCm! - 365.76) < 1e-6); assert.ok(Math.abs(saved.cargoHeightCm! - 182.88) < 1e-6);
  assert.match(section.getByText('Reefer Van').closest('tr')!.textContent!, /2,200.*3.*144 × 70 × 72\$15\.00/);
  assert.equal(saved.baseSurcharge, 15);
  await user.click(section.getByRole('button', { name: 'Edit Reefer Van' }));
  const edit = within(screen.getByRole('dialog'));
  assert.equal((edit.getByLabelText('Box width (in)') as HTMLInputElement).value, '70');
  await user.clear(edit.getByLabelText('Pallet capacity')); await user.type(edit.getByLabelText('Pallet capacity'), '4');
  await user.click(edit.getByRole('button', { name: 'Save Changes' }));
  saved = loadSimplePricingConfig().vehicles.find(type => type.id === saved.id)!; assert.equal(saved.palletCapacity, 4);
  await user.click(section.getByRole('button', { name: 'Delete Reefer Van' }));
  await user.click(await screen.findByRole('button', { name: 'Delete vehicle type' }));
  assert.equal(section.queryByText('Reefer Van'), null);
  assert.equal(loadSimplePricingConfig().vehicles.find(type => type.id === saved.id)!.active, false);
  assert.deepEqual(notes, ['Vehicle type saved.', 'Vehicle type saved.', 'Reefer Van deleted.']);
});

test('Vehicles tab shows type pricing columns and retains search and registration', async () => {
  const user = userEvent.setup({ document });
  const asset = loadVehicles().find(vehicle => vehicle.vehicleTypeId)!;
  const type = loadSimplePricingConfig().vehicles.find(item => item.id === asset.vehicleTypeId)!;
  const billing = loadBillingConfig(); billing.operatingCost.costPerKmByVehicleId[type.id] = 1.25; saveBillingConfig(billing);
  const before = loadSimplePricingConfig();
  render(React.createElement(VehiclesPage, { drivers: [], onNotification: noop }));
  assert.equal(screen.queryByRole('tab', { name: 'Vehicle Types' }), null);
  const table = within(screen.getByRole('table', { name: 'Vehicles' }));
  for (const name of ['Surcharge', 'Type limits', 'Cost / km', 'Capacity']) assert.ok(table.getByRole('columnheader', { name }));
  await user.type(screen.getByRole('searchbox'), asset.unitNumber);
  const row = screen.getByRole('button', { name: `Details for ${asset.unitNumber}` }).closest('tr')!;
  assert.ok(within(row).getByText(`${formatWeight(type.payloadCapacityKg, loadBillingConfig().general)} · ${type.palletCapacity} pallets`));
  assert.ok(within(row).getByText('$1.25'));
  await select(user, 'Filter by vehicle category', type.name);
  await user.click(screen.getByRole('button', { name: 'Register Vehicle' }));
  await user.click(screen.getByRole('combobox', { name: 'Vehicle type' }));
  assert.ok(screen.getByRole('option', { name: type.name }));
  await user.keyboard('{Escape}'); await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  assert.equal((screen.getByRole('searchbox') as HTMLInputElement).value, asset.unitNumber);
  assert.deepEqual(loadSimplePricingConfig(), before);
});

test('registering a vehicle saves equipment and running cost without changing the starting type', async () => {
  const user = userEvent.setup({ document });
  const seed = loadSimplePricingConfig().vehicles[0];
  render(React.createElement(VehiclesPage, { drivers: [], onNotification: noop }));
  await user.click(screen.getByRole('button', { name: 'Register Vehicle' }));
  await user.type(screen.getByLabelText('Unit number'), 'V99'); await user.type(screen.getByLabelText('Licence plate'), 'TEST-99');
  await select(user, 'Vehicle type', seed.name);
  for (const [label, value] of [['Box length (in)', '100'], ['Box width (in)', '60'], ['Box height (in)', '55']]) await user.type(screen.getByLabelText(label), value);
  assert.equal(screen.queryByLabelText('Vehicle upgrade surcharge ($)'), null);
  assert.equal(screen.queryByLabelText('Running cost / km (internal)'), null);
  await user.click(screen.getByRole('checkbox', { name: 'Liftgate' }));
  await user.click(screen.getByRole('button', { name: 'Save vehicle' }));
  const asset = loadVehicles().find(vehicle => vehicle.unitNumber === 'V99')!;
  const config = loadSimplePricingConfig(); const profile = config.vehicles.find(type => type.id === asset.vehicleTypeId)!;
  assert.equal(profile.baseSurcharge, seed.baseSurcharge); assert.equal(profile.hasLiftgate, true);
  assert.equal(config.vehicles.find(type => type.id === seed.id)?.baseSurcharge, seed.baseSurcharge);
  assert.ok(asset.cargoLengthCm && asset.cargoWidthCm && asset.cargoHeightCm);
  const row = screen.getByRole('button', { name: 'Details for V99' }).closest('tr')!;
  await user.click(screen.getByRole('button', { name: 'Details for V99' }));
  assert.equal(screen.queryByLabelText('Vehicle upgrade surcharge ($)'), null);
  await user.click(screen.getByRole('button', { name: 'Save vehicle' }));
  assert.equal(loadVehicles().find(vehicle => vehicle.unitNumber === 'V99')?.vehicleTypeId, profile.id);
  assert.equal(loadSimplePricingConfig().vehicles.find(type => type.id === profile.id)?.baseSurcharge, seed.baseSurcharge);
  assert.equal(loadSimplePricingConfig().vehicles.find(type => type.id === seed.id)?.baseSurcharge, seed.baseSurcharge);
});

test('vehicle type columns follow company units and preserve zero and default cost semantics', async () => {
  const { VehicleTable } = await import('../src/components/entities/VehicleTable');
  const asset = loadVehicles().find(vehicle => vehicle.vehicleTypeId)!;
  const type = { ...loadSimplePricingConfig().vehicles.find(item => item.id === asset.vehicleTypeId)!, payloadCapacityKg: 45.359237, baseSurcharge: 0 };
  const billing = loadBillingConfig(); Object.assign(billing.general, { weightUnit: 'lb', distanceUnit: 'mi' });
  billing.operatingCost.costPerKmByVehicleId[type.id] = 1; saveBillingConfig(billing);
  const props = { vehicles: [asset], drivers: [], vehicleTypes: [type], onDetails: noop };
  const view = render(React.createElement(VehicleTable, props));
  assert.ok(screen.getByRole('columnheader', { name: 'Cost / mi' }));
  assert.ok(screen.getByText(`100 lb · ${type.palletCapacity} pallets`));
  assert.ok(screen.getByText('$1.61'));
  billing.operatingCost.costPerKmByVehicleId[type.id] = 0; saveBillingConfig(billing);
  view.rerender(React.createElement(VehicleTable, props)); assert.equal(screen.getAllByText('$0.00').length, 2);
  delete billing.operatingCost.costPerKmByVehicleId[type.id]; saveBillingConfig(billing);
  view.rerender(React.createElement(VehicleTable, props)); assert.ok(screen.getByText('default'));
  view.rerender(React.createElement(VehicleTable, { ...props, vehicleTypes: [] })); assert.equal(screen.getAllByText('—').length, 3);
});


test('surcharge customer labels are fixed; calculation controls remain', async () => {
  const stored = loadBillingConfig(); stored.serviceCharge.label = 'Admin'; stored.serviceCharge.basis = 'transport_only'; stored.serviceCharge.mode = 'greater_of'; stored.fuelSurcharge.label = 'Diesel'; saveBillingConfig(stored);
  assert.deepEqual([loadBillingConfig().serviceCharge.label, loadBillingConfig().serviceCharge.basis, loadBillingConfig().serviceCharge.mode, loadBillingConfig().fuelSurcharge.label], ['Service Fee', 'transport_and_accessorials', 'percentage', 'Fuel Surcharge']);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
  assert.equal(screen.queryByLabelText('Label Shown to Customer'), null); assert.equal(screen.queryByRole('combobox', { name: 'Service charge basis' }), null);
  assert.equal(screen.queryByRole('combobox', { name: 'Service charge method' }), null);
  assert.equal(screen.queryByRole('heading', { name: 'Service Fee' }), null);
  assert.equal(screen.queryByRole('combobox', { name: 'Fuel surcharge mode' }), null); assert.ok(screen.getByLabelText('Fuel surcharge (%)'));
});

test('service fee and extra-stop charges are retired from active billing', () => {
  assert.equal(loadBillingConfig().serviceCharge.enabled, false); assert.equal(loadBillingConfig().general.defaultExtraStopRate, 0);
  const old = loadBillingConfig(); old.serviceCharge.enabled = true; old.general.defaultExtraStopRate = 10; saveBillingConfig(old);
  assert.equal(loadBillingConfig().serviceCharge.enabled, false); assert.equal(loadBillingConfig().general.defaultExtraStopRate, 0);
});

test('waiting uses selected fixed charges and retired settings stay hidden', async () => {
  const seeded = loadSimplePricingConfig().accessorials.find(a => a.code === 'WAIT')!;
  assert.deepEqual([seeded.calculationType, seeded.autoRule, seeded.freeAllowance, seeded.incrementMinutes], ['FLAT', 'NONE', null, null]);
  assert.equal('defaultWaitFreeMinutes' in loadBillingConfig().general, false);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
  assert.equal(screen.queryByLabelText('Default Wait-Free Allowance'), null); assert.equal(screen.queryByLabelText('Default Wait Increment'), null);
  assert.equal(screen.queryByRole('spinbutton', { name: 'Dimensional Divisor' }), null);
  await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  assert.equal(screen.queryByRole('checkbox', { name: /higher of actual or dimensional/ }), null);
  assert.equal(screen.queryByRole('spinbutton', { name: 'Dimensional Divisor' }), null);
  assert.equal(screen.queryByLabelText('Included Stops'), null); assert.equal(screen.queryByLabelText('Extra Stop Charge'), null);
});

test('Vehicle & Labour Costs tab is removed while stored costs remain available to estimates', () => {
  const stored = loadBillingConfig(); stored.operatingCost.fixedCostPerStop = 2.4; stored.operatingCost.driverCostPerHour = 44; saveBillingConfig(stored);
  assert.equal(loadBillingConfig().operatingCost.fixedCostPerStop, 0);
  render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.queryByRole('tab', { name: 'Vehicle & Labour Costs' }), null);
  for (const label of ['Default Cost / km', 'Driver Cost / hour', 'Driver Time per Stop', 'Overhead Share']) assert.equal(screen.queryByLabelText(label), null);
  assert.equal(loadBillingConfig().operatingCost.driverCostPerHour, 44);
});

test('discount moves from every card to shipper creation and editing, and persists after reload', async () => {
  const user = userEvent.setup({ document }); seedCard();
  render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.queryByRole('combobox', { name: 'Discount type' }), null);
  cleanup();
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { loadCustomers } = await import('../src/lib/customerStorage');
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Shipper' }));
  await user.type(screen.getByRole('textbox', { name: 'Shipper name' }), 'Discount Shipper');
  await user.type(screen.getByRole('textbox', { name: 'Company name' }), 'Discount Logistics');
  await user.type(screen.getByRole('textbox', { name: /^Email / }), 'discount@example.ca');
  assert.equal(screen.queryByRole('combobox', { name: 'Discount scope' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Discount type' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['No discount', 'Percentage', 'Fixed amount']);
  await user.click(screen.getByRole('option', { name: 'Percentage' }));
  await user.clear(screen.getByRole('spinbutton', { name: 'Percentage' })); await user.type(screen.getByRole('spinbutton', { name: 'Percentage' }), '12.5');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create Shipper' }));
  assert.deepEqual(loadCustomers().find(c => c.name === 'Discount Shipper')!.discount, { type: 'PERCENT', value: 12.5, scope: 'TRANSPORT_ONLY' });
  await user.click(screen.getAllByTitle('Edit shipper account')[0]);
  assert.equal((screen.getByRole('spinbutton', { name: 'Percentage' }) as HTMLInputElement).value, '12.5');
  await select(user, 'Discount type', 'Fixed amount');
  await user.clear(screen.getByRole('spinbutton', { name: 'Amount (excludes tax)' })); await user.type(screen.getByRole('spinbutton', { name: 'Amount (excludes tax)' }), '8');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Save/ }));
  assert.deepEqual(loadCustomers().find(c => c.name === 'Discount Shipper')!.discount, { type: 'FIXED', value: 8, scope: 'TRANSPORT_ONLY' });
});

test('Company saves logo, contact and address while Taxes saves registration independently', async () => {
  const { loadUserProfile, PROFILE_STORAGE_KEY } = await import('../src/lib/profileStorage');
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Sam', organization: 'Old Org', hub: 'Old Hub', timezone: 'America/Toronto', orgLogoUrl: 'data:image/png;base64,x', avatarUrl: 'data:image/png;base64,YXZhdGFy' }));
  const initialBilling = loadBillingConfig();
  initialBilling.invoicing.taxRegistrationNumber = 'REG-OLD';
  initialBilling.companyTax.enabled = false;
  saveBillingConfig(initialBilling);
  const user = userEvent.setup({ document });
  const page = render(React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(ProfilePage, {})));
  assert.ok(screen.getByRole('heading', { name: 'Company Identity' }));
  assert.equal(screen.queryByRole('img', { name: 'Sam' }), null);
  assert.equal(page.container.querySelectorAll('input[type="file"]').length, 1);
  const address = screen.getByRole('combobox', { name: 'Company address' }) as HTMLInputElement;
  assert.equal(address.tagName, 'INPUT');
  assert.equal(address.type, 'text');
  await user.clear(screen.getByRole('textbox', { name: 'Company name' }));
  await user.type(screen.getByRole('textbox', { name: 'Company name' }), 'Pacific Couriers');
  await user.type(address, '100 Main St, Vancouver');
  await user.clear(screen.getByRole('textbox', { name: 'Contact Full Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Contact Full Name' }), 'Alex Morgan');
  await user.click(screen.getByRole('button', { name: 'Security' }));
  assert.equal(screen.queryByRole('textbox', { name: 'Company address' }), null);
  assert.equal(loadBillingConfig().company.name, initialBilling.company.name);
  await user.click(screen.getByRole('button', { name: 'Company' }));
  assert.equal((screen.getByRole('combobox', { name: 'Company address' }) as HTMLInputElement).value, '100 Main St, Vancouver');
  assert.equal((screen.getByRole('textbox', { name: 'Contact Full Name' }) as HTMLInputElement).value, 'Alex Morgan');
  assert.equal(window.dispatchEvent(new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed: noop } })), false);
  await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
  const concurrent = loadBillingConfig();
  concurrent.company.phone = '604-555-0100';
  concurrent.invoicing.quoteValidityDays = 21;
  saveBillingConfig(concurrent);
  await user.click(screen.getByRole('button', { name: 'Save Company' }));
  assert.equal(loadBillingConfig().company.name, 'Pacific Couriers');
  assert.equal(loadBillingConfig().company.address, '100 Main St, Vancouver');
  assert.equal(loadBillingConfig().company.phone, '604-555-0100');
  assert.equal(loadUserProfile().name, 'Alex Morgan');
  assert.equal(loadBillingConfig().invoicing.taxRegistrationNumber, 'REG-OLD');
  page.unmount();
  const taxes = render(React.createElement(TaxesPage));
  const registration = screen.getByRole('textbox', { name: 'GST/HST registration number' }) as HTMLInputElement;
  assert.equal(registration.value, 'REG-OLD');
  await user.clear(registration); await user.type(registration, 'REG-123');
  await user.click(screen.getByRole('button', { name: 'Save Taxes' }));
  assert.equal(loadBillingConfig().invoicing.taxRegistrationNumber, 'REG-123');
  assert.equal(loadBillingConfig().invoicing.quoteValidityDays, 21);
  assert.equal(loadBillingConfig().companyTax.enabled, false);
  assert.equal(loadBillingConfig().company.name, 'Pacific Couriers');
  taxes.unmount();
  render(React.createElement(ProfilePage, {}));
  assert.equal((screen.getByRole('combobox', { name: 'Company address' }) as HTMLInputElement).value, '100 Main St, Vancouver');
});
test('How pricing works shows an engine-calculated example in plain language without prose formulas', async () => {
  useMetricCompany();
  seedCard({ baseFee: 20, includedKm: 5, kmRate: 1.5, minimumOrderSubtotal: 35 });
  render(React.createElement(RateCardsPage, {}));
  const section = screen.getByText('How pricing works').closest('details')!;
  assert.equal(section.open, false);
  assert.match(section.textContent!, /Example: 12 km, 3 stops · \$[\d.]+/);
  const headings = [...section.querySelectorAll('h4')].map(heading => heading.textContent);
  assert.deepEqual(headings, ['Example values']);
  assert.doesNotMatch(section.textContent!, /Freight|freight|max\(/);
  const values = screen.getByLabelText('Pricing values');
  const rows = Object.fromEntries([...values.querySelectorAll('dt')].map(term => [term.textContent, term.nextElementSibling!.textContent]));
  assert.equal(rows['Distance'], '12 km billable; 5 km included');
  assert.equal(rows['Delivery charge'], '$20.00 + 7 km × $1.50/km = $30.50');
  assert.equal(rows['Service charge'], 'Same-Day Standard: $0.00');
  assert.equal(rows['Vehicle surcharge'], undefined);
  assert.match(rows['Fuel surcharge']!, /28\.5% of \$[\d.]+ = \$[\d.]+/);
  assert.ok(rows['Accessorials']);
  assert.equal(rows['Minimum charge'], undefined);
  const calculation = screen.getByLabelText('Example calculation').textContent!;
  assert.match(calculation, /Charges = \$30\.50 \+ \$40\.75 \+ \$[\d.]+ = \$[\d.]+/);
  assert.match(calculation, /Subtotal = \$35\.00 minimum < \$([\d.]+) = \$\1/);
  assert.doesNotMatch(calculation, /The minimum charge is/);
  assert.doesNotMatch(calculation, /freight|max\(/i);
  assert.match(calculation, /Tax = \$[\d.]+ × 5% = \$[\d.]+/);
  assert.match(calculation, /Total = \$[\d.]+ \+ \$[\d.]+ = \$[\d.]+/);
  assert.equal(section.querySelector('pre'), null);

  for (const method of ['FIXED', 'HOURLY', 'IMPORTED', 'ZONE'] as const) {
    cleanup(); localStorage.clear(); seedCard({ pricingMethod: method });
    render(React.createElement(RateCardsPage, {}));
    const details = screen.getByText('How pricing works').closest('details')!;
    assert.doesNotMatch(details.textContent!, /Freight|freight|max\(|Formula/);
    if (method === 'FIXED') assert.match(details.querySelector('summary')!.textContent!, /fixed/);
    if (method === 'HOURLY') assert.match(details.querySelector('summary')!.textContent!, /billable min/);
    if (method === 'IMPORTED') assert.match(details.querySelector('summary')!.textContent!, /imported/);
    if (method === 'ZONE') {
      assert.equal(screen.queryByText('Pricing terms'), null);
      assert.match(screen.getByRole('status').textContent!, /zone/i);
      assert.match(details.textContent!, /Sample only, not saved: 0–99 lb to Vancouver at \$20\.00/);
      assert.match(screen.getByLabelText('Example calculation').textContent!, /Charges = zone rates \+ other charges − discountsSubtotal = minimum compared with charges = the larger amountTax = taxable charges × applicable tax rateTotal = subtotal \+ tax/);
    } else {
      const values = within(details as HTMLElement).getByLabelText('Pricing values');
      if (method === 'HOURLY') assert.match(values.textContent!, /150 min entered; 120 min minimum; 30 min increments/);
      assert.match(values.textContent!, method === 'IMPORTED' ? /Final total\$100\.00/ : /Delivery charge/);
    }
  }
  cleanup(); localStorage.clear();
  seedCard({ pricingMethod: 'ZONE', zoneRates: [{ id: 'example-zone', originZoneId: '__central_pickup__', destinationZoneId: 'zone_van', serviceId: null, amount: 25,
    weightBands: [{ id: 'example-band', maxWeightKg: 100, amount: 25 }] }] });
  render(React.createElement(RateCardsPage, {}));
  const zoneValues = screen.getByLabelText('Pricing values').textContent!;
  assert.doesNotMatch(zoneValues, /Delivery 1|Delivery 2/);
  assert.match(zoneValues, /Delivery chargePickup → Vancouver = \$25\.00/);
  assert.match(screen.getByText('How pricing works').closest('details')!.querySelector('summary')!.textContent!, /Example: pickup to Vancouver/);

  cleanup(); localStorage.clear();
  seedCard({ pricingMethod: 'IMPORTED', importedPriceMode: 'FINAL_TOTAL' });
  render(React.createElement(RateCardsPage, {}));
  const importedDetails = screen.getByText('How pricing works').closest('details')!;
  assert.equal(importedDetails.textContent!.includes('minimum charge'), false);
  assert.match(screen.getByLabelText('Pricing values').textContent!, /Final total\$100\.00/);
  assert.match(screen.getByLabelText('Example calculation').textContent!, /Subtotal = \$100\.00 agreed amountTax = \$100\.00 × 0% \(exempt\) = \$0\.00Total = \$100\.00 \+ \$0\.00 = \$100\.00/);
});

test('subtotal and tax equations show an applied minimum and both configured tax rates', () => {
  const billing = loadBillingConfig();
  billing.companyTax = { enabled: true, ratePercent: 5, provincialEnabled: true, provincialRatePercent: 7 };
  saveBillingConfig(billing);
  seedCard({ pricingMethod: 'FIXED', fixedAmount: 10, minimumOrderSubtotal: 500 });
  render(React.createElement(RateCardsPage, {}));
  const calculation = screen.getByLabelText('Example calculation').textContent!;
  assert.match(calculation, /Charges = .*\$([\d.]+)Subtotal = \$500\.00 minimum > \$\1 = \$500\.00/);
  assert.match(calculation, /Tax = GST\/HST: \$[\d.]+ × 5% \+ Provincial tax: \$[\d.]+ × 7% = \$[\d.]+/);
  assert.match(calculation, /Total = \$500\.00 \+ \$[\d.]+ = \$[\d.]+/);
});

test('Zone cards start with a 0–99 Zone 1 price of $20 and migrate empty active cards once', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const config = loadPricingConfig();
  assert.deepEqual(config.zones.map(z => [z.name, z.postalCodes]), [['Zone 1', ['V5Y 1V4']], ['Zone 2', ['V5G 1M2']], ['Zone 3', ['V3T 1V8']]]);
  assert.deepEqual(config.zoneRates, []);
  const starter = config.rateCards.find(card => card.pricingMethod === 'ZONE')!.zoneRates!;
  assert.equal(starter.length, 1);
  assert.equal(starter[0].destinationZoneId, 'zone_1');
  assert.equal(starter[0].amount, 20);
  assert.equal(starter[0].weightBands![0].amount, 20);
  assert.ok(Math.abs(starter[0].weightBands![0].maxWeightKg! - 99 * 0.45359237) < 1e-8);

  const oldPrice = { id: 'old-price', originZoneId: '__central_pickup__', destinationZoneId: 'zone_1', serviceId: null, amount: 99,
    weightBands: [{ id: 'old-band', maxWeightKg: 500, amount: 99 }] };
  const active = { ...config.rateCards.find(card => card.pricingMethod === 'ZONE')!, zoneRates: [oldPrice] };
  const archived = { ...active, id: 'archived-zone', status: 'ARCHIVED' as const, zoneRates: [oldPrice] };
  const custom = { id: 'zone_custom', code: 'CUSTOM', name: 'Custom', postalCodes: ['V6B 1A1'] };
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, zones: [...config.zones, custom], zoneRates: [oldPrice],
    rateCards: [config.rateCards[0], active, archived], schemaVersion: 12 }));
  const migrated = loadPricingConfig();
  assert.deepEqual(migrated.zones.map(zone => zone.id), ['zone_1', 'zone_2', 'zone_3', 'zone_custom']);
  assert.deepEqual(migrated.zoneRates, []);
  const migratedRates = migrated.rateCards.find(card => card.id === active.id)!.zoneRates!;
  assert.equal(migratedRates.length, 1);
  assert.equal(migratedRates[0].amount, 20);
  assert.deepEqual(migrated.rateCards.find(card => card.id === archived.id)!.zoneRates, [oldPrice]);
  assert.equal(migrated.rateCards.find(card => card.id === active.id)!.version, active.version + 1);
  const saved = localStorage.getItem(PRICING_STORAGE_KEY)!;
  assert.equal(JSON.parse(saved).schemaVersion, 14);
  assert.deepEqual(loadPricingConfig(), migrated);
  assert.equal(localStorage.getItem(PRICING_STORAGE_KEY), saved);

  render(React.createElement(RateCardsPage, {}));
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole('button', { name: 'Zone to zone' }));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(matrix.querySelectorAll('tbody tr').length, 1);
  assert.equal((screen.getByLabelText('Weight from (lb)') as HTMLInputElement).value, '0');
  assert.equal((screen.getByLabelText('Weight to (lb)') as HTMLInputElement).value, '99');
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '20');
  for (const label of ['Zone 2 price', 'Zone 3 price', 'Custom price']) assert.equal((screen.getByLabelText(label) as HTMLInputElement).value, '');
  assert.equal((screen.getByRole('button', { name: 'Add weight range' }) as HTMLButtonElement).disabled, false);
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  await select(user, 'Pricing method', 'Zone to zone');
  assert.equal((screen.getByLabelText('Weight from (lb)') as HTMLInputElement).value, '0');
  assert.equal((screen.getByLabelText('Weight to (lb)') as HTMLInputElement).value, '99');
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '20');
  assert.equal((screen.getByLabelText('Zone 2 price') as HTMLInputElement).value, '');
});

test('Zone starter uses company units, preserves existing prices, and restores an empty saved card', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  useMetricCompany();
  const fresh = loadPricingConfig();
  assert.equal(fresh.rateCards.find(card => card.pricingMethod === 'ZONE')!.zoneRates![0].weightBands![0].maxWeightKg, 99);
  const card = fresh.rateCards.find(item => item.pricingMethod === 'ZONE')!;
  const own = { id: 'own-rate', originZoneId: '__central_pickup__', destinationZoneId: 'zone_2', serviceId: null, amount: 38,
    weightBands: [{ id: 'own-band', maxWeightKg: 200, amount: 38 }] };
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...fresh,
    rateCards: fresh.rateCards.map(item => item.id === card.id ? { ...item, zoneRates: [own] } : item), schemaVersion: 13 }));
  const migrated = loadPricingConfig();
  assert.deepEqual(migrated.rateCards.find(item => item.id === card.id)!.zoneRates, [own]);
  assert.equal(JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY)!).schemaVersion, 14);
  const cleared = { ...migrated, rateCards: migrated.rateCards.map(item => item.id === card.id ? { ...item, zoneRates: [] } : item) };
  savePricingConfig(cleared);
  const restored = loadPricingConfig().rateCards.find(item => item.id === card.id)!.zoneRates!;
  assert.equal(restored.length, 1);
  assert.equal(restored[0].destinationZoneId, 'zone_1');
  assert.equal(restored[0].weightBands![0].maxWeightKg, 99);
  assert.equal(restored[0].weightBands![0].amount, 20);
});

test('a current-schema empty Zone to zone card shows the starter fields and formula', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const config = loadPricingConfig();
  const zoneCard = config.rateCards.find(card => card.name === 'Zone to zone')!;
  savePricingConfig({ ...config, rateCards: config.rateCards.map(card => card.id === zoneCard.id ? { ...card, zoneRates: [] } : card) });
  assert.deepEqual(JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY)!).rateCards.find((card: { id: string }) => card.id === zoneCard.id).zoneRates, []);
  render(React.createElement(RateCardsPage, {}));
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole('button', { name: 'Zone to zone' }));
  assert.equal((screen.getByLabelText('Weight from (lb)') as HTMLInputElement).value, '0');
  assert.equal((screen.getByLabelText('Weight to (lb)') as HTMLInputElement).value, '99');
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '20');
  assert.match(screen.getByLabelText('Pricing values').textContent!, /\$20\.00/);
  assert.match(screen.getByLabelText('Example calculation').textContent!, /\$20\.00/);
  assert.equal(loadPricingConfig().rateCards.find(card => card.id === zoneCard.id)!.zoneRates![0].amount, 20);
});

test('customer create form is flat and minimal; status appears only on edit and the code is assigned in the background', async () => {
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { loadCustomers } = await import('../src/lib/customerStorage');
  const user = userEvent.setup({ document }); const notices: string[] = [];
  render(React.createElement(CustomersPage, { onBackToMonitor: noop, onNotification: (m: string) => notices.push(m) }));
  await user.click(screen.getByRole('button', { name: 'New Shipper' }));
  const dialog = screen.getByRole('dialog');
  assert.equal(dialog.querySelector('details'), null);
  for (const gone of ['Account / Code', 'Account Tier', 'Status', 'Default Accessorials / Requirements', 'Legal name', 'Saved locations & delivery defaults', 'Communication preferences']) assert.equal(within(dialog).queryByText(gone), null, gone);
  assert.equal(within(dialog).queryByRole('checkbox', { name: /tax exemption/ }), null); assert.equal(within(dialog).queryByRole('combobox', { name: 'Shipper status' }), null);
  assert.ok(within(dialog).getByRole('combobox', { name: 'Shipper type' })); assert.ok(within(dialog).getByRole('textbox', { name: 'Company name' })); assert.equal(within(dialog).queryByRole('textbox', { name: 'Contact name' }), null); assert.ok(within(dialog).getByText('Dispatch & Receiving Instructions'));
  await user.type(within(dialog).getByRole('textbox', { name: 'Shipper name' }), 'Mo Lee'); await user.type(within(dialog).getByRole('textbox', { name: 'Company name' }), 'Harbour Bakery'); await user.type(within(dialog).getByRole('textbox', { name: /^Email / }), 'mo@example.ca');
  await user.click(within(dialog).getByRole('button', { name: 'Create Shipper' }));
  const created = loadCustomers().find(c => c.name === 'Mo Lee')!;
  assert.match(created.code, /^CUST-\d{4}$/); assert.equal(created.name, 'Mo Lee'); assert.equal(created.legalName, 'Harbour Bakery'); assert.equal(created.contactName, 'Mo Lee'); assert.equal(created.customerType, 'BUSINESS'); assert.equal(created.status, 'Active');
  await user.click(screen.getAllByTitle('Edit shipper account')[0]);
  const edit = screen.getByRole('dialog'); assert.ok(within(edit).getByRole('combobox', { name: 'Shipper status' })); assert.equal((within(edit).getByRole('textbox', { name: 'Company name' }) as HTMLInputElement).value, 'Harbour Bakery'); assert.equal(within(edit).queryByRole('textbox', { name: 'Contact name' }), null); assert.equal(within(edit).queryByText('Account / Code'), null);
});

test('custom confirm dialog replaces the browser confirm: archive, discard-changes guard, Escape and cancel', async () => {
  const { confirmDialog } = await import('../src/components/ui/ConfirmDialog');
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config);
  window.confirm = () => { throw new Error('native confirm must not be used while the host is mounted'); };
  render(React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(RateCardsPage, {  })));
  await user.click(screen.getByRole('button', { name: 'Contract B' }));
  await user.click(screen.getByRole('button', { name: 'Archive' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Archive "Contract B"?' });
  assert.match(dialog.textContent!, /orders already priced with it are unchanged/); assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Cancel' }));
  await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('alertdialog'), null); assert.equal(loadPricingConfig().rateCards[1].status, 'ACTIVE');
  await user.click(screen.getByRole('button', { name: 'Archive' })); await user.click(screen.getByRole('button', { name: 'Archive card' }));
  assert.equal(loadPricingConfig().rateCards[1].status, 'ARCHIVED'); assert.equal(screen.queryByRole('alertdialog'), null);
  await user.type(screen.getByLabelText('Rate card name'), ' edited');
  let proceeded = false; const event = new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed: () => { proceeded = true; } } });
  assert.equal(window.dispatchEvent(event), false);
  const guard = await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' });
  await user.click(within(guard).getByRole('button', { name: 'Keep editing' })); assert.equal(proceeded, false);
  window.dispatchEvent(new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed: () => { proceeded = true; } } }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard changes' })); assert.equal(proceeded, true);
  const pending = confirmDialog({ title: 'Plain?', message: 'A non-destructive question.' });
  assert.ok(await screen.findByRole('alertdialog', { name: 'Plain?' })); await user.click(screen.getByRole('button', { name: 'Confirm' })); assert.equal(await pending, true);
});

test('zone postal-code lists replace descriptions, preserve zeros and spaces, and survive remounts', async () => {
  useMetricCompany();
  const starter = loadPricingConfig(); savePricingConfig({ ...starter, zones: [], zoneRates: [], rateCards: starter.rateCards.map(c => ({ ...c, zoneRates: [] })) });
  const user = userEvent.setup({ document }); const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onNotification: message => notices.push(message) }));
  await user.click(screen.getByRole('button', { name: 'Zone to zone' }));
  assert.equal(screen.queryByLabelText('Zone name'), null);
  await user.click(screen.getByRole('button', { name: 'Add' }));
  assert.equal(screen.queryByLabelText('Zone description'), null);
  const nameField = screen.getByLabelText('Zone name: New Zone');
  assert.equal(document.activeElement, nameField);
  await user.clear(nameField);
  assertFieldIssue('Zone name: Unnamed zone', 'Zone name required');
  await user.type(nameField, 'Zone 1');
  assertFieldIssue('Zone name: Zone 1', null);
  assertFieldIssue('ZIP / postal codes for Zone 1', 'Postal codes required');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.match(notices.at(-1)!, /at least one ZIP/);
  const codes = screen.getByRole('textbox', { name: 'ZIP / postal codes for Zone 1' });
  await user.type(codes, '00501, 10001, v6b 1a1; V6B1A1, 00501');
  await user.tab();
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, ['00501', '10001', 'V6B 1A1']);
  await user.clear(screen.getByRole('spinbutton', { name: 'Weight to (kg)' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Weight to (kg)' }), '500');
  await user.type(screen.getByRole('spinbutton', { name: 'Zone 1 price' }), '25');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  cleanup(); render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('button', { name: 'Zone to zone' }));
  const reopened = screen.getByRole('textbox', { name: 'ZIP / postal codes for Zone 1' });
  assert.equal((reopened as HTMLInputElement).value, '00501, 10001, V6B 1A1');
  await user.clear(reopened); await user.type(reopened, '10002');
  await user.keyboard('{Escape}');
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, ['10002']);
  assert.equal((screen.getByRole('spinbutton', { name: 'Zone 1 price' }) as HTMLInputElement).value, '25');
});

test('untouched legacy preset zones retire while active cards receive the starter and archives survive', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const config = loadPricingConfig();
  config.zones = [
    { id: 'zone_van', code: 'VAN', name: 'Vancouver', description: 'City of Vancouver & UBC' },
    { id: 'zone_bby', code: 'BBY', name: 'My Zone', description: 'Burnaby and New Westminster' },
    { id: 'mine', code: 'MINE', name: 'Mine', postalCodes: ['00501'] }
  ];
  const oldPrice = { id: 'old', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 45 };
  const ownPrice = { ...oldPrice, id: 'own', originZoneId: 'mine', amount: 22 };
  const card = config.rateCards.find(c => c.pricingMethod === 'ZONE')!;
  card.zoneRates = [oldPrice, ownPrice];
  config.rateCards.push({ ...card, id: 'historical', status: 'ARCHIVED' });
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, schemaVersion: 7 }));
  const migrated = loadPricingConfig();
  assert.deepEqual(migrated.zones.map(z => z.id), ['zone_bby', 'mine', 'zone_1', 'zone_2', 'zone_3']);
  const migratedRates = migrated.rateCards.find(c => c.id === card.id)!.zoneRates!;
  assert.equal(migratedRates.length, 1);
  assert.equal(migratedRates[0].destinationZoneId, 'zone_1');
  assert.equal(migratedRates[0].amount, 20);
  assert.deepEqual(migrated.rateCards.find(c => c.id === 'historical')!.zoneRates, [oldPrice, ownPrice]);
  assert.deepEqual(loadPricingConfig(), migrated);
});

test('existing effective card discounts migrate to shippers once, including Default, without altering the card history', async () => {
  const { SHIPPERS_STORAGE_KEY, DEFAULT_SHIPPERS, loadCustomers, saveCustomers } = await import('../src/lib/customerStorage');
  const card = seedCard({ discount: { type: 'PERCENT', value: 12.5, scope: 'TRANSPORT_ONLY' } });
  const old = structuredClone(DEFAULT_SHIPPERS.slice(0, 2));
  old[0].rateCardId = card.id; old[1].rateCardId = null;
  localStorage.setItem(SHIPPERS_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, customers: old }));
  const migrated = loadCustomers();
  assert.ok(migrated.every(c => c.discount.type === 'PERCENT' && c.discount.value === 12.5));
  assert.deepEqual(loadPricingConfig().rateCards[0].discount, card.discount);
  migrated[0].discount = { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' }; saveCustomers(migrated);
  assert.deepEqual(loadCustomers(), migrated);
  assert.equal(JSON.parse(localStorage.getItem(SHIPPERS_STORAGE_KEY)!).schemaVersion, 3);
});

test('Zone retains editable dimensional divisors and validation', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document }); const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onNotification: message => notices.push(message) }));
  for (const [index, name] of ['Zone to zone'].entries()) {
    await user.click(screen.getByRole('button', { name }));
    assert.ok(screen.getByRole('region', { name: 'Dimensional Weight' }));
    const divisor = screen.getByLabelText('Dimensional Divisor');
    await user.clear(divisor); await user.type(divisor, String(4000 + index * 1000));
    await user.click(screen.getByRole('tab', { name: 'Fuel Surcharge' }));
    assert.equal(screen.queryByRole('spinbutton', { name: 'Dimensional Divisor' }), null);
    await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
    assert.equal((screen.getByLabelText('Dimensional Divisor') as HTMLInputElement).value, String(4000 + index * 1000));
    await user.click(screen.getByRole('button', { name: /Save Card|Saved/ }));
    assert.equal(loadPricingConfig().rateCards.find(c => c.name === name)!.dimensionalDivisor, 4000 + index * 1000);
  }
  await user.clear(screen.getByLabelText('Dimensional Divisor'));
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.match(notices.at(-1)!, /divisor greater than zero/);
  assert.equal(loadPricingConfig().rateCards.find(c => c.name === 'Zone to zone')!.dimensionalDivisor, 4000);
});

test('Distance, Fixed and Hourly have no dimensional setting or formula and save with an unused zero divisor', async () => {
  const user = userEvent.setup({ document });
  for (const pricingMethod of ['BASE_PLUS_DISTANCE', 'FIXED', 'HOURLY'] as const) {
    seedCard({ pricingMethod, dimensionalDivisor: 0 });
    render(React.createElement(RateCardsPage, {}));
    assert.equal(screen.queryByRole('region', { name: 'Dimensional Weight' }), null);
    assert.equal(screen.queryByLabelText('Dimensional Divisor'), null);
    assert.doesNotMatch(screen.getByLabelText('Pricing values').textContent!, /dimensional|divisor/i);
    const name = screen.getByLabelText('Rate card name');
    await user.clear(name); await user.type(name, `${pricingMethod} updated`);
    await user.click(screen.getByRole('button', { name: 'Save Card' }));
    assert.equal(loadPricingConfig().rateCards[0].name, `${pricingMethod} updated`);
    cleanup(); localStorage.clear();
  }
});

test('active cards enable maximum weight once while preserving divisors and archived opt-outs', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const billing = loadBillingConfig(); billing.general.dimensionalDivisor = 6000; billing.general.dimensionalPricingEnabled = false; saveBillingConfig(billing);
  const inherited = createEmptyRateCard({ id: 'inherited', scope: 'ORGANIZATION', dimensionalDivisor: null, dimensionalPricingEnabled: null });
  const explicit = createEmptyRateCard({ id: 'explicit', dimensionalDivisor: 4000, dimensionalPricingEnabled: true });
  const disabled = createEmptyRateCard({ id: 'disabled', dimensionalDivisor: 4500, dimensionalPricingEnabled: false });
  const archived = createEmptyRateCard({ id: 'archived', status: 'ARCHIVED', dimensionalDivisor: 3500, dimensionalPricingEnabled: false });
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...loadPricingConfig(), rateCards: [inherited, explicit, disabled, archived], schemaVersion: 8 }));
  const migrated = loadPricingConfig();
  assert.deepEqual(migrated.rateCards.map(c => [c.dimensionalPricingEnabled, c.dimensionalDivisor]), [[true, 6000], [true, 4000], [true, 4500], [false, 3500]]);
  assert.equal(migrated.rateCards[0].version, inherited.version + 1);
  assert.equal(migrated.rateCards[2].version, disabled.version + 1);
  assert.deepEqual(loadPricingConfig(), migrated);
  billing.general.dimensionalDivisor = 9000; saveBillingConfig(billing);
  assert.deepEqual(loadPricingConfig().rateCards.map(c => c.dimensionalDivisor), [6000, 4000, 4500, 3500]);
});


test('legacy catalogue settings normalize without changing names, dollar values, tax or status', async () => {
  const { LEGACY_ACCESSORIALS } = await import('./fixtures/legacyAccessorials');
  const config = loadSimplePricingConfig();
  const legacy = structuredClone(LEGACY_ACCESSORIALS);
  legacy[0].name = 'Custom handling'; legacy[0].description = 'Custom conditions'; legacy[0].active = false;
  localStorage.setItem('dispatra_simple_pricing_v4', JSON.stringify({ ...config, accessorials: legacy, schemaVersion: 2 }));
  const loaded = loadSimplePricingConfig();
  for (let i = 0; i < legacy.length; i++) {
    const item = loaded.accessorials[i];
    assert.deepEqual([item.id, item.name, item.rate, item.taxable, item.active], [legacy[i].id, legacy[i].name, legacy[i].rate, legacy[i].taxable, legacy[i].active]);
    assert.deepEqual([item.calculationType, item.appliesAt, item.autoRule, item.fuelEligible, item.minimumCharge, item.maximumCharge, item.freeAllowance, item.incrementMinutes], ['FLAT', 'ORDER', 'NONE', false, null, null, null, null]);
  }
  assert.equal(loaded.accessorials[0].description, 'Custom conditions');
  saveSimplePricingConfig(loaded);
  assert.deepEqual(loadSimplePricingConfig(), loaded);
});

test('single matrix shows saved weight ranges in saved order without a blank row', async () => {
  useMetricCompany();
  seedCard({ pricingMethod: 'ZONE', zoneRates: [{ id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 40,
    weightBands: [{ id: 'large', maxWeightKg: 500, amount: 40 }, { id: 'small', maxWeightKg: 200, amount: 25 }] }] });
  const config = loadPricingConfig(); config.zones = [
    { id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['001'] },
    { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['002'] },
  ]; savePricingConfig(config);
  render(React.createElement(RateCardsPage, {}));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(matrix.querySelectorAll('tbody tr').length, 2);
  assert.deepEqual(within(matrix).getAllByRole('columnheader').map(header => header.textContent), ['From (kg)', 'To (kg)', 'Zone 1', 'Zone 2', 'Action']);
  // Rows are not re-sorted; each From is still the next lower limit.
  assert.equal((screen.getByLabelText('Weight from (kg)') as HTMLInputElement).value, '200');
  assert.equal((screen.getByLabelText('Weight range 2 from (kg)') as HTMLInputElement).value, '0');
  assert.equal((screen.getByLabelText('Zone 2 price') as HTMLInputElement).value, '40');
  assert.equal((screen.getByLabelText('Zone 2 range 2 price') as HTMLInputElement).value, '25');
  assert.ok(screen.getByRole('button', { name: 'Add weight range' }));
});

test('Add weight range creates an empty row with a trailing delete icon', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'ZONE', zoneRates: [
    { id: 'c1', originZoneId: '__central_pickup__', destinationZoneId: 'a', serviceId: null, amount: 20,
      weightBands: [{ id: 'a99', maxWeightKg: 99, amount: 20 }] },
    { id: 'c2', originZoneId: '__central_pickup__', destinationZoneId: 'b', serviceId: null, amount: 25,
      weightBands: [{ id: 'b99', maxWeightKg: 99, amount: 25 }] },
  ] });
  const config = loadPricingConfig(); config.zones = [
    { id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['001'] },
    { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['002'] },
  ]; savePricingConfig(config);
  render(React.createElement(RateCardsPage, {}));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(matrix.querySelectorAll('tbody tr').length, 1);
  await user.click(screen.getByRole('button', { name: 'Add weight range' }));
  assert.equal(matrix.querySelectorAll('tbody tr').length, 2);
  assert.equal((screen.getByLabelText('Weight range 2 from (lb)') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Weight range 2 to (lb)') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Zone 1 range 2 price') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Zone 2 range 2 price') as HTMLInputElement).value, '');
  const lastCell = matrix.querySelector('tbody tr:last-child td:last-child')!;
  await user.click(within(lastCell as HTMLElement).getByRole('button', { name: 'Delete weight row 2' }));
  assert.equal(matrix.querySelectorAll('tbody tr').length, 1);
  await user.click(screen.getByRole('button', { name: 'Add weight range' }));
  assert.equal((screen.getByLabelText('Weight range 2 from (lb)') as HTMLInputElement).value, '');
  await user.type(screen.getByLabelText('Weight range 2 to (lb)'), '440');
  await user.type(screen.getByLabelText('Zone 1 range 2 price'), '24');
  await user.type(screen.getByLabelText('Zone 2 range 2 price'), '28');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const rates = loadPricingConfig().rateCards[0].zoneRates!.filter(rate => rate.originZoneId === '__central_pickup__');
  assert.deepEqual(rates.map(rate => rate.weightBands!.map(band => band.amount)), [[20, 24], [25, 28]]);
});

test('ten destination zones appear as columns in one matrix', () => {
  seedCard({ pricingMethod: 'ZONE' });
  const config = loadPricingConfig();
  config.zones = Array.from({ length: 10 }, (_, index) => ({ id: `z${index}`, code: `Z${index}`, name: `Area ${index + 1}`, postalCodes: [`00${index}`] }));
  config.rateCards[0].zoneRates = config.zones.map((destination, index) => ({ id: `c${index}`, originZoneId: '__central_pickup__', destinationZoneId: destination.id,
    serviceId: null, amount: index, weightBands: [{ id: `b${index}`, maxWeightKg: 500, amount: index }] }));
  savePricingConfig(config);
  render(React.createElement(RateCardsPage, {}));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(screen.getAllByRole('table').length, 2);
  assert.equal(within(matrix).getAllByRole('columnheader').length, 13);
  assert.equal(matrix.querySelectorAll('tbody tr').length, 1);
  for (let index = 0; index < 10; index++) assert.equal((screen.getByLabelText(`Area ${index + 1} price`) as HTMLInputElement).value, String(index));
});

test('postal fields edit directly with keyboard, retain separators and parse multiline paste', async () => {
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE' });
  const config = loadPricingConfig();
  config.zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['001'] }]; savePricingConfig(config);
  render(React.createElement(RateCardsPage, {}));
  screen.getByLabelText('Zone name: Central').focus();
  await user.tab();
  const codes = screen.getByRole('textbox', { name: 'ZIP / postal codes for Central' }) as HTMLInputElement;
  assert.equal(document.activeElement, codes);
  assert.equal(screen.queryByRole('button', { name: /ZIP \/ postal codes/ }), null);
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(screen.getByRole('table', { name: 'Zones' }).querySelector('.lucide-map-pin'), null);
  await user.clear(codes); await user.type(codes, '00501, ');
  assert.equal(codes.value, '00501, ', 'Typing must preserve the delimiter for the next code');
  await user.type(codes, 'v6b 1a1, V6B1A1; 00501');
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, ['00501', 'V6B 1A1']);
  await user.tab();
  assert.equal(codes.value, '00501, V6B 1A1');
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Remove zone Central' }));
  await user.clear(codes);
  await user.paste('00501\nv6b 1a1\r\nV6B1A1; 00501\n10001');
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, ['00501', 'V6B 1A1', '10001']);
  await user.tab();
  assert.equal(codes.value, '00501, V6B 1A1, 10001');
  await user.clear(codes);
  assertFieldIssue('ZIP / postal codes for Central', 'Postal codes required');
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, []);
  assert.equal(loadPricingConfig().zones.length, 1);
});

test('band fields validate positive weights and nonnegative prices', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE', zoneRates: [] });
  const config = loadPricingConfig(); config.zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['001'] }]; savePricingConfig(config);
  const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onNotification: message => notices.push(message) }));
  await user.clear(screen.getByLabelText('Weight to (kg)'));
  await user.type(screen.getByLabelText('Weight to (kg)'), '0');
  assertFieldIssue('Weight to (kg)', 'Enter a weight limit greater than zero');
  await user.clear(screen.getByLabelText('Weight to (kg)'));
  await user.type(screen.getByLabelText('Weight to (kg)'), '500');
  await user.type(screen.getByLabelText('Central price'), '-1');
  assertFieldIssue('Weight to (kg)', null);
  assertFieldIssue('Central price', 'Enter a price of zero or more');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.match(notices.at(-1)!, /Enter a price of zero or more/);
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, []);
  await user.clear(screen.getByLabelText('Central price')); await user.type(screen.getByLabelText('Central price'), '50');
  assertFieldIssue('Central price', null);
  assert.ok(screen.getByRole('button', { name: 'Add weight range' }));
  assert.equal(loadPricingConfig().zones[0].id, 'a');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates![0].weightBands!.map(band => [band.maxWeightKg, band.amount]), [[500, 50]]);
});

test('zone postal fields update shared codes and preserve directional prices after reload', async () => {
  const user = userEvent.setup({ document });
  const rates = [
    { id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 45 },
    { id: 'ba', originZoneId: 'b', destinationZoneId: 'a', serviceId: null, amount: 70 },
  ];
  seedCard({ pricingMethod: 'ZONE', zoneRates: rates });
  const config = loadPricingConfig();
  config.zones = [{ id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['001'] }, { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['002'] }];
  savePricingConfig(config);
  const page = render(React.createElement(RateCardsPage, {}));
  for (const [name, value] of [['Zone 1', '00501\nv6b 1a1, V6B1A1'], ['Zone 2', '00990, 00990\nx0a 1b2']]) {
    const codes = screen.getByRole('textbox', { name: `ZIP / postal codes for ${name}` });
    await user.clear(codes); await user.paste(value);
    await user.tab();
  }
  assert.deepEqual(loadPricingConfig().zones.map(zone => zone.postalCodes), [['00501', 'V6B 1A1'], ['00990', 'X0A 1B2']]);
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, rates);
  page.unmount(); render(React.createElement(RateCardsPage, {}));
  for (const [name, value] of [['Zone 1', '00501\nV6B 1A1'], ['Zone 2', '00990\nX0A 1B2']]) {
    const codes = screen.getByRole('textbox', { name: `ZIP / postal codes for ${name}` });
    assert.equal((codes as HTMLInputElement).value, value.replaceAll('\n', ', '));
  }
  assert.equal((screen.getByLabelText('Zone 2 price') as HTMLInputElement).value, '45');
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '70');
});

test('removing a shared zone confirms, shrinks both matrix axes and preserves drafts and archived rates', async () => {
  const user = userEvent.setup({ document });
  const rates = [
    { id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 45 },
    { id: 'ba', originZoneId: 'b', destinationZoneId: 'a', serviceId: null, amount: 70 },
    { id: 'aa', originZoneId: 'a', destinationZoneId: 'a', serviceId: null, amount: 10 },
  ];
  seedCard({ pricingMethod: 'ZONE', zoneRates: rates });
  const config = loadPricingConfig();
  config.zones = ['a', 'b', 'c'].map((id, i) => ({ id, code: id.toUpperCase(), name: `Zone ${i + 1}`, postalCodes: [`00${i}`] }));
  config.zoneRates = rates;
  config.rateCards.push(createEmptyRateCard({ id: 'other', name: 'Other', pricingMethod: 'ZONE', zoneRates: rates }));
  config.rateCards.push(createEmptyRateCard({ id: 'archived', name: 'Archived', status: 'ARCHIVED', pricingMethod: 'ZONE', zoneRates: rates }));
  savePricingConfig(config);
  const before = loadPricingConfig();
  const page = render(React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(RateCardsPage, {})));
  await user.type(screen.getByLabelText('Rate card name'), ' edited');
  await user.clear(screen.getByLabelText('Zone 1 price'));
  await user.type(screen.getByLabelText('Zone 1 price'), '22');
  const remove = screen.getByRole('button', { name: 'Remove zone Zone 2' });
  await user.click(remove);
  let dialog = screen.getByRole('alertdialog', { name: 'Remove zone "Zone 2"?' });
  assert.match(dialog.textContent!, /Previously priced orders stay unchanged/);
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  assert.deepEqual(loadPricingConfig(), before);
  await waitFor(() => assert.equal(document.activeElement, remove));
  await user.click(remove);
  dialog = screen.getByRole('alertdialog', { name: 'Remove zone "Zone 2"?' });
  await user.click(within(dialog).getByRole('button', { name: 'Remove zone' }));
  await waitFor(() => assert.equal(document.activeElement, screen.getByRole('button', { name: 'Add' })));
  const matrix = screen.getByRole('table', { name: 'Zone prices by weight' });
  assert.equal(within(matrix).getAllByRole('columnheader').length, 5);
  assert.equal(matrix.querySelectorAll('tbody td').length - matrix.querySelectorAll('tbody tr').length * 3, 2);
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited');
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '22');
  const removed = loadPricingConfig();
  assert.deepEqual(removed.zones.map(zone => zone.id), ['a', 'c']);
  assert.deepEqual(removed.zoneRates, [rates[2]]);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(removed.rateCards[i].zoneRates, [rates[2]]);
    assert.equal(removed.rateCards[i].version, before.rateCards[i].version + 1);
  }
  assert.deepEqual(removed.rateCards[2], before.rateCards[2]);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, [rates[2], { ...rates[2], id: 'aa_central', originZoneId: '__central_pickup__', amount: 22 }]);
  page.unmount(); render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.getByRole('table', { name: 'Zone prices by weight' }).querySelectorAll('tbody td').length - 3, 2);
  assert.equal((screen.getByLabelText('Zone 1 price') as HTMLInputElement).value, '22');
});


test('company weight setting controls matrix entry and reload without changing saved prices', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  assert.equal(loadBillingConfig().general.weightUnit, 'kg');
  seedCard({ pricingMethod: 'ZONE', zoneRates: [] });
  const config = loadPricingConfig(); config.zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['001'] }]; savePricingConfig(config);
  let company = render(React.createElement(PreferencesPage, {}));
  await select(user, 'Weight unit', 'lb — Pounds');
  await user.click(screen.getByRole('button', { name: 'Save Preferences' }));
  assert.equal(loadBillingConfig().general.weightUnit, 'lb');
  company.unmount();
  let page = render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.queryByRole('combobox', { name: /weight.*unit/i }), null);
  const weight = screen.getByLabelText('Weight to (lb)');
  assert.equal((weight as HTMLInputElement).value, '');
  await user.clear(weight);
  await user.type(weight, '100');
  await user.type(screen.getByLabelText('Central price'), '0');
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, []);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig();
  assert.ok(Math.abs(saved.rateCards[0].zoneRates![0].weightBands![0].maxWeightKg! - 45.359237) < 1e-8);
  page.unmount(); page = render(React.createElement(RateCardsPage, {}));
  assert.equal((screen.getByLabelText('Weight to (lb)') as HTMLInputElement).value, '100');
  page.unmount();
  company = render(React.createElement(PreferencesPage, {}));
  await select(user, 'Weight unit', 'kg — Kilograms');
  await user.click(screen.getByRole('button', { name: 'Save Preferences' })); company.unmount();
  render(React.createElement(RateCardsPage, {}));
  assert.equal((screen.getByLabelText('Weight to (kg)') as HTMLInputElement).value, '45.359237');
  assert.equal((screen.getByLabelText('Central price') as HTMLInputElement).value, '0');
  assert.deepEqual(loadPricingConfig(), saved);
});

test('Distance omits weight controls in either company unit and preserves retired values on unrelated saves', async () => {
  const user = userEvent.setup({ document });
  for (const weightUnit of ['kg', 'lb'] as const) {
    const billing = loadBillingConfig(); billing.general.weightUnit = weightUnit; saveBillingConfig(billing);
    seedCard({ includedWeightKg: 10, weightRatePerKg: 2, dimensionalDivisor: 0 });
    const page = render(React.createElement(RateCardsPage, {}));
    for (const label of ['Included Weight', 'Weight Rate', 'Dimensional Divisor']) assert.equal(screen.queryByLabelText(label), null);
    await user.clear(screen.getByLabelText('Base Fee')); await user.type(screen.getByLabelText('Base Fee'), '35');
    await user.click(screen.getByRole('button', { name: 'Save Card' }));
    const saved = loadPricingConfig().rateCards[0];
    assert.equal(saved.baseFee, 35); assert.equal(saved.includedWeightKg, 10); assert.equal(saved.weightRatePerKg, 2);
    page.unmount();
  }
});


test('Distance formula ignores retired weight prices and clamps included distance', async () => {
  const user = userEvent.setup({ document });
  seedCard({ baseFee: 20, includedKm: 20, kmRate: 1, includedWeightKg: 30, weightRatePerKg: 99, dimensionalDivisor: 0 });
  render(React.createElement(RateCardsPage, {}));
  const values = () => Object.fromEntries([...screen.getByLabelText('Pricing values').querySelectorAll('dt')].map(term => [term.textContent!, term.nextElementSibling!.textContent!]));
  assert.equal(values()['Distance'], '12 km billable; 20 km included');
  assert.equal(values()['Delivery charge'], '$20.00 + 0 km × $1.00/km = $20.00');
  assert.equal(values()['Weight charge'], undefined);
  assert.doesNotMatch(screen.getByLabelText('Pricing values').textContent!, /dimensional|divisor|Weight charge/i);
  await user.clear(screen.getByLabelText('Included Distance')); await user.type(screen.getByLabelText('Included Distance'), '5');
  assert.equal(values()['Distance'], '12 km billable; 5 km included');
  assert.equal(values()['Delivery charge'], '$20.00 + 7 km × $1.00/km = $27.00');
});


test('Distance example uses selected distance and actual-weight display units', () => {
  const billing = loadBillingConfig(); Object.assign(billing.general, { distanceUnit: 'mi', weightUnit: 'lb', dimensionUnit: 'in' }); saveBillingConfig(billing);
  seedCard({ baseFee: 20, includedKm: 0, kmRate: 1, dimensionalDivisor: 5000 });
  render(React.createElement(RateCardsPage, {}));
  const values = screen.getByLabelText('Pricing values').textContent!;
  assert.match(values, /Distance12 mi billable; 0 mi included/);
  assert.match(values, /= \$39.31/);
  assert.doesNotMatch(values, /in³|chargeable|dimensional/i);
  assert.doesNotMatch(values, /actual 88.2 lb/);
});


test('Zone formula selects prices automatically using dimensional movement weight', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE', dimensionalDivisor: 5000, zoneRates: [{ id: 'ab', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 999, weightBands: [{ id: 'light', maxWeightKg: 25, amount: 30 }, { id: 'bulky', maxWeightKg: 50, amount: 60 }] }] });
  render(React.createElement(RateCardsPage, {}));
  const baseFreight = () => [...screen.getByLabelText('Pricing values').querySelectorAll('dt')].find(dt => dt.textContent === 'Delivery charge')!.nextElementSibling!.textContent;
  assert.match(baseFreight()!, /= \$30.00/); // One 24 kg movement at $30.
  await user.clear(screen.getByLabelText('Dimensional Divisor')); await user.type(screen.getByLabelText('Dimensional Divisor'), '2500');
  assert.match(baseFreight()!, /= \$60.00/); // The movement is now 48 kg and uses the $60 band.
  assert.match(screen.getByRole('region', { name: 'Zone prices' }).textContent!, /use the greater of actual and dimensional weight/);
});


test('Service Level lives in Settings, preserves rate drafts and reloads saved services', async () => {
  const user = userEvent.setup({ document });
  seedCard();
  const page = render(React.createElement(RateCardsPage, {}));
  await user.type(screen.getByLabelText('Rate card name'), ' draft');
  const tab = screen.getByRole('tab', { name: 'Rate Cards' }); tab.focus();
  await user.keyboard('{ArrowRight}');
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'Service Level', selected: true }));
  assert.ok(screen.getByRole('region', { name: 'Services' }));
  const service = loadSimplePricingConfig().services[0];
  await user.click(screen.getByRole('button', { name: `Edit ${service.name}` }));
  await user.clear(screen.getByLabelText('Service name')); await user.type(screen.getByLabelText('Service name'), 'Saved service level');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].name, 'Saved service level');
  await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A draft');
  assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A');
  page.unmount();
  render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('tab', { name: 'Service Level' }));
  assert.ok(screen.getByRole('button', { name: 'Edit Saved service level' }));
});

test('legacy service migration applies approved built-in charges and preserves explicit amounts and custom rules', async () => {
  const { SIMPLE_PRICING_STORAGE_KEY } = await import('../src/lib/simplePricingStorage');
  const stored = structuredClone(loadSimplePricingConfig());
  for (const service of stored.services) delete service.additionalCharge;
  stored.services.push({ ...stored.services[1], id: 'custom', code: 'CUSTOM', name: 'Custom rush' });
  stored.services.push({ ...stored.services[1], id: 'explicit', additionalCharge: 0 });
  localStorage.setItem(SIMPLE_PRICING_STORAGE_KEY, JSON.stringify(stored));
  const raw = localStorage.getItem(SIMPLE_PRICING_STORAGE_KEY);
  const migrated = loadSimplePricingConfig();
  assert.deepEqual(migrated.services.map(s => s.additionalCharge), [0, 20, 35, 0, null, 0]);
  assert.deepEqual(migrated.services.map(s => s.defaultMultiplier), stored.services.map(s => s.defaultMultiplier));
  assert.equal(localStorage.getItem(SIMPLE_PRICING_STORAGE_KEY), raw, 'Reading does not rewrite stored quotes or catalogue');
  saveSimplePricingConfig(migrated);
  assert.deepEqual(loadSimplePricingConfig(), migrated);
  migrated.services[1].additionalCharge = 12.75; saveSimplePricingConfig(migrated);
  assert.equal(loadSimplePricingConfig().services[1].additionalCharge, 12.75);
});

test('custom legacy service shows Set charge and accepts a company-currency fixed amount', async () => {
  const config = structuredClone(loadSimplePricingConfig());
  config.services = [{ ...config.services[0], id: 'custom', name: 'Custom legacy', defaultMultiplier: 1.6, additionalCharge: null }];
  saveSimplePricingConfig(config);
  const billing = loadBillingConfig(); billing.invoicing.currency = 'USD'; saveBillingConfig(billing);
  const user = userEvent.setup({ document });
  render(React.createElement(CatalogueSection, { section: 'services' }));
  assert.ok(screen.getByText('Set charge')); assert.equal(screen.queryByText('Price multiplier'), null);
  await user.click(screen.getByRole('button', { name: 'Edit Custom legacy' }));
  const charge = screen.getByLabelText('Additional charge (USD)');
  assert.equal((charge as HTMLInputElement).value, '');
  assert.match(screen.getByRole('status').textContent!, /Set a fixed amount/);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].additionalCharge, null);
  await user.type(charge, '15.25'); await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].additionalCharge, 15.25);
  assert.ok(screen.getByText('$15.25'));
});


test('company logo itself opens upload with mouse and keyboard and supports replace, save and reload', async () => {
  const user = userEvent.setup({ document });
  const { ProfilePage } = await import('../src/pages/ProfilePage');
  const page = render(React.createElement(ProfilePage, {}));
  const logo = screen.getByRole('button', { name: 'Upload company logo' });
  assert.equal(screen.queryByText('Upload logo'), null);
  assert.ok(logo.querySelector('svg'));
  const input = page.container.querySelector('input[accept=".png,.jpg,.jpeg,image/png,image/jpeg"]') as HTMLInputElement;
  let opened = 0; input.addEventListener('click', () => { opened++; });
  await user.click(logo); logo.focus(); await user.keyboard('{Enter}'); await user.keyboard(' ');
  assert.equal(opened, 3);
  const first = new dom.window.File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'logo.png', { type: 'image/png' });
  await user.upload(input, first);
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Change company logo' }).querySelector('img')));
  const firstUrl = screen.getByRole('img', { name: 'Company logo' }).getAttribute('src');
  assert.equal(loadBillingConfig().company.logoDataUrl, '');
  const second = new dom.window.File([new Uint8Array([255, 216, 255, 217])], 'replacement.jpeg', { type: 'image/jpeg' });
  await user.click(screen.getByRole('button', { name: 'Change company logo' }));
  await user.upload(input, second);
  await waitFor(() => assert.notEqual(screen.getByRole('img', { name: 'Company logo' }).getAttribute('src'), firstUrl));
  const replacementUrl = screen.getByRole('img', { name: 'Company logo' }).getAttribute('src');
  await user.click(screen.getByRole('button', { name: 'Save Company' }));
  assert.equal(loadBillingConfig().company.logoDataUrl, replacementUrl);
  page.unmount(); render(React.createElement(ProfilePage, {}));
  assert.equal(screen.getByRole('img', { name: 'Company logo' }).getAttribute('src'), replacementUrl);
  assert.ok(screen.getByRole('button', { name: 'Change company logo' }).contains(screen.getByRole('img', { name: 'Company logo' })));
  assert.equal(screen.queryByText('Change logo'), null);
  await user.click(screen.getByRole('button', { name: 'Remove company logo' }));
  assert.ok(screen.getByRole('button', { name: 'Upload company logo' }));
});


test('company logo accepts only PNG and JPEG uploads and preserves its draft after invalid files', async () => {
  const user = userEvent.setup({ document, applyAccept: false });
  const billing = loadBillingConfig(); billing.company.logoDataUrl = 'data:image/png;base64,c2F2ZWQ='; saveBillingConfig(billing);
  const { ProfilePage } = await import('../src/pages/ProfilePage');
  const page = render(React.createElement(ProfilePage, {}));
  const input = page.container.querySelector('input[accept=".png,.jpg,.jpeg,image/png,image/jpeg"]') as HTMLInputElement;
  assert.equal(input.accept, '.png,.jpg,.jpeg,image/png,image/jpeg');
  assert.ok(screen.getByText('PNG or JPEG, up to 200 KB.'));
  for (const type of ['image/svg+xml', 'image/gif', 'image/webp', 'text/plain']) {
    await user.upload(input, new dom.window.File(['invalid'], 'wrong.png', { type }));
    assert.equal(screen.getByRole('alert').textContent, 'Choose a PNG or JPEG image.');
    assert.equal(screen.getByRole('img', { name: 'Company logo' }).getAttribute('src'), billing.company.logoDataUrl);
  }
  await user.upload(input, new dom.window.File([new Uint8Array(200 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  assert.equal(screen.getByRole('alert').textContent, 'Choose an image up to 200 KB.');
  await user.upload(input, new dom.window.File([new Uint8Array([255, 216, 255, 217])], 'valid.jpg', { type: 'image/jpeg' }));
  await waitFor(() => assert.match(screen.getByRole('img', { name: 'Company logo' }).getAttribute('src')!, /^data:image\/jpeg;base64,/));
  assert.equal(screen.queryByRole('alert'), null);
  assert.equal(loadBillingConfig().company.logoDataUrl, billing.company.logoDataUrl);
});

for (const [section, singular] of [['services', 'service'], ['accessorials', 'accessorial']] as const) {
  test(`${singular} Delete asks for confirmation and removes only the chosen catalogue record`, async () => {
      const before = loadSimplePricingConfig();
    // The first service (Same-Day Standard) is the Default and cannot be deleted; delete the next one.
    const index = section === 'services' ? 1 : 0, item = before[section][index];
    const notifications: string[] = [];
    let changes = 0;
    const user = userEvent.setup({ document });
    window.confirm = () => { throw new Error('native confirmation should not be used'); };
    render(React.createElement(React.Fragment, null,
      React.createElement(ConfirmDialogHost),
      React.createElement(CatalogueSection, { section, onNotification: message => notifications.push(message), onChanged: () => { changes++; } })));
    assert.equal(screen.queryByRole('button', { name: `${item.name}: deactivate` }), null);
    assert.ok(screen.getByRole('columnheader', { name: 'Action' }));
    const remove = screen.getByRole('button', { name: `Delete ${item.name}` });
    assert.equal(remove.closest('td')?.cellIndex, section === 'services' ? 4 : 3);
    assert.equal(remove.closest('td'), screen.getByRole('button', { name: `Edit ${item.name}` }).closest('td'));
    assert.equal(remove.textContent?.trim(), '');
    assert.ok(remove.querySelector('svg'));
    if (section === 'services') {
      await user.click(screen.getByRole('button', { name: `Delete ${before.services[0].name}` }));
      assert.equal(screen.queryByRole('alertdialog'), null);
      assert.deepEqual(notifications.splice(0), ['Set another service as Default before deleting this one.']);
    }
    await user.click(remove);
    let dialog = screen.getByRole('alertdialog', { name: `Delete ${singular} “${item.name}”?` });
    assert.match(dialog.textContent!, /Saved order prices stay unchanged/);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    assert.deepEqual(loadSimplePricingConfig()[section], before[section]);
    assert.equal(changes, 0);
    await user.click(remove);
    dialog = screen.getByRole('alertdialog', { name: `Delete ${singular} “${item.name}”?` });
    await user.click(within(dialog).getByRole('button', { name: `Delete ${singular}` }));
    assert.equal(screen.queryByRole('button', { name: `Delete ${item.name}` }), null);
    assert.deepEqual(loadSimplePricingConfig()[section].map(record => record.id), before[section].filter((_, i) => i !== index).map(record => record.id));
    assert.deepEqual(loadSimplePricingConfig()[section === 'services' ? 'accessorials' : 'services'], before[section === 'services' ? 'accessorials' : 'services']);
    assert.equal(changes, 1);
    assert.deepEqual(notifications, [`${item.name} deleted.`]);
  });
}

test('saved tonne-named preset vehicle types migrate to Canadian classes while custom names and surcharges are kept', () => {
  const config = loadSimplePricingConfig();
  config.vehicles = [{ ...config.vehicles.find(type => type.id === 'veh_2_ton')!, name: '2 Tonne (16ft Cube Truck)', baseSurcharge: 31, payloadCapacityKg: 2000 }, { ...config.vehicles.find(type => type.id === 'veh_3_ton')!, name: 'My box truck', payloadCapacityKg: 3500 }];
  saveSimplePricingConfig(config);
  const [migrated, custom] = loadSimplePricingConfig().vehicles;
  assert.equal(migrated.name, 'Cube Van'); assert.equal(migrated.baseSurcharge, 31); assert.equal(migrated.palletCapacity, 8);
  assert.ok(Math.abs(migrated.payloadCapacityKg - 4300 * 0.45359237) < 1e-4);
  assert.equal(custom.name, 'My box truck'); assert.equal(custom.payloadCapacityKg, 3500);
});

test('vehicle registration offers active vehicle types and fills capacity and cargo size from the chosen type', async () => {
  const { VehicleEditor } = await import('../src/components/entities/VehicleEditor');
  const config = loadSimplePricingConfig(); config.vehicles = config.vehicles.map(type => type.id === 'veh_flatbed_truck' ? { ...type, active: false } : type); saveSimplePricingConfig(config);
  const user = userEvent.setup({ document });
  render(React.createElement(VehicleEditor, { vehicles: [], onSave: noop, onCancel: noop }));
  await user.click(screen.getByRole('combobox', { name: 'Vehicle type' }));
  const options = screen.getAllByRole('option').map(option => option.textContent);
  assert.ok(options.includes('Refrigerated Truck')); assert.ok(!options.includes('Flatbed Truck')); assert.ok(!options.some(name => /retired/.test(name!)));
  await user.click(screen.getByRole('option', { name: 'Refrigerated Truck' }));
  assert.equal((screen.getByLabelText('Pallet capacity') as HTMLInputElement).value, '8');
  assert.equal((screen.getByLabelText('Box length (in)') as HTMLInputElement).value, '192');
  assert.equal((screen.getByLabelText('Box width (in)') as HTMLInputElement).value, '87');
  assert.equal(screen.queryByRole('checkbox', { name: 'Refrigeration' }), null);
  assert.equal((screen.getByRole('checkbox', { name: 'Liftgate' }) as HTMLInputElement).checked, false);
});
