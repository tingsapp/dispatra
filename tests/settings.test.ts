import { formatWeight } from '../src/lib/units';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'FileReader']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => { };
window.confirm = () => true;
const { render, screen, cleanup, within, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { VehiclesPage } = await import('../src/pages/VehiclesPage');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { CompanySettingsPage } = await import('../src/pages/CompanySettingsPage');
const { BillingSettingsForm } = await import('../src/components/settings/BillingSettingsForm');
const { CatalogueSection } = await import('../src/components/settings/CatalogueSection');
const { loadPricingConfig, savePricingConfig, createEmptyRateCard, rateCardCode, RATE_CARD_BACKGROUND_DEFAULTS } = await import('../src/lib/pricingStorage');
const { loadBillingConfig, saveBillingConfig } = await import('../src/lib/billingStorage');
const { loadSimplePricingConfig, saveSimplePricingConfig } = await import('../src/lib/simplePricingStorage');
const { SETTINGS_AREAS } = await import('../src/components/settings/SettingsLayout');
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
test('two settings destinations keep company and pricing in their intended homes', async () => {
  const props = { onNavigateSettings: noop };
  assert.deepEqual(SETTINGS_AREAS.map(area => area.label), ['Company', 'Pricing']);
  const company = render(React.createElement(CompanySettingsPage, props)); assert.ok(screen.getByRole('tab', { name: 'General', selected: true })); assert.equal(screen.queryByLabelText('Tax Registration Number'), null); assert.ok(screen.getByRole('combobox', { name: 'Organization timezone' })); assert.equal(screen.queryByLabelText('Driver Cost / hour'), null); assert.equal(screen.queryByLabelText('Quote Validity'), null); company.unmount();
  render(React.createElement(RateCardsPage, props)); await userEvent.setup({ document }).click(screen.getByRole('tab', { name: 'Rate Cards' })); assert.equal(screen.queryByRole('button', { name: 'Duplicate' }), null); assert.equal(screen.queryByRole('button', { name: 'Archive' }), null); assert.equal(screen.queryByRole('navigation'), null); assert.equal(screen.queryByRole('heading', { name: 'Accessorials' }), null); assert.ok(screen.getByRole('tab', { name: 'Accessorials' })); assert.ok(screen.getByRole('button', { name: 'Add card' })); assert.ok(screen.getByRole('complementary', { name: 'Rate cards' })); assert.ok(screen.getByRole('region', { name: 'Rate card editor' }));
});
test('new cards choose one method, do not persist before Save, and cancelled drafts leave no records', async () => {
  const user = userEvent.setup({ document }); seedCard(); const before = loadPricingConfig();
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  await user.click(screen.getByRole('combobox', { name: 'Filter pricing method' })); assert.equal(screen.queryByRole('option', { name: 'Imported price' }), null); await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  assert.deepEqual(loadPricingConfig(), before);
  await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); assert.equal(screen.queryByRole('option', { name: 'Imported price' }), null); assert.ok(screen.getByRole('option', { name: 'Fixed per delivery' })); await user.keyboard('{Escape}');
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
  await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByText('Additional settings'), null); assert.deepEqual([...document.querySelectorAll('details summary')].map(el => el.textContent!.split('Example')[0].trim()), ['Pricing formula']); assert.equal(screen.queryByRole('note'), null);
  for (const hidden of ['Code', 'Applies to', 'Customer', 'Service restriction', 'Status', 'Vehicle restriction', 'Priority', 'Effective From', 'Effective To', 'Currency', 'Notes', 'Minimum Freight', 'Fuel Surcharge', 'Included Pieces', 'Wait-Free Allowance']) assert.equal(screen.queryByLabelText(hidden), null, hidden);
  await user.clear(screen.getByLabelText('Base Fee')); await user.type(screen.getByLabelText('Base Fee'), '27'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig().rateCards[0];
  assert.deepEqual({ ...original, ...RATE_CARD_BACKGROUND_DEFAULTS, baseFee: 27, code: 'CONTRACT-A', discount: { ...original.discount, scope: 'TRANSPORT_ONLY' }, version: original.version + 2, updatedAt: saved.updatedAt }, saved);
  assert.equal(saved.discount.type, 'NONE'); assert.equal(saved.minimumOrderSubtotal, 0); assert.deepEqual(loadBillingConfig(), billing);
  assert.equal(rateCardCode(' Pacific Fresh — 2026 '), 'PACIFIC-FRESH-2026'); assert.equal(rateCardCode(''), 'CARD');
});
test('hourly and zone cards show required method terms without exposing other methods', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'HOURLY' }); const page = render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' }));
  const terms = screen.getAllByRole('checkbox', { name: /Billable clock|Includes|Settled/ }); assert.equal(terms.length, 5); assert.ok(terms.every(box => (box as HTMLInputElement).checked && (box as HTMLInputElement).disabled)); assert.ok(screen.getByRole('checkbox', { name: 'Billable clock starts: Arrival at first pickup' })); assert.equal(screen.queryByRole('textbox', { name: /Billable clock/ }), null); assert.equal(terms[0].closest('details'), null); assert.equal(screen.queryByLabelText('Base Fee'), null); page.unmount();
  seedCard({ pricingMethod: 'ZONE', zoneMatrixMode: 'CONTRACT', zoneNoMatchFallback: 'NEEDS_ATTENTION' }); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByRole('combobox', { name: 'Zone prices' }), null); assert.equal(screen.queryByRole('checkbox', { name: /organization rates/ }), null); assert.equal(screen.queryByRole('combobox', { name: 'Pickup zone' }), null); assert.equal(screen.getAllByRole('rowgroup').length, 4); assert.ok(screen.getByRole('button', { name: 'Add' })); assert.equal(screen.queryByRole('combobox', { name: 'Zone no-match fallback' }), null); assert.equal(screen.queryByLabelText('Base Fee'), null); assert.equal(screen.queryByLabelText('Hourly Rate'), null);
});
test('unsaved card navigation can be cancelled without losing changes', async () => {
  const user = userEvent.setup({ document }); seedCard(); const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', status: 'ACTIVE', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); await user.type(screen.getByLabelText('Rate card name'), ' edited'); window.confirm = () => false;
  assert.equal(window.dispatchEvent(new Event(SETTINGS_NAVIGATION_EVENT, { cancelable: true })), false); await user.click(screen.getByRole('button', { name: 'Add card' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A');
  await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); window.confirm = () => true; await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Fixed Amount per Delivery') as HTMLInputElement).value, '55'); assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
});
test('driver details save an individual limit without changing company defaults or other drivers', async () => {
  const { DriverEditor } = await import('../src/components/entities/DriverEditor');
  const { INITIAL_DRIVERS } = await import('../src/data/mockData');
  const { normalizeDriver, saveDrivers, loadDrivers } = await import('../src/lib/driverStorage');
  const billing = loadBillingConfig(); billing.dispatch.maxActiveOrdersPerDriver = 6; saveBillingConfig(billing);
  const driver = normalizeDriver(INITIAL_DRIVERS[0]); const other = normalizeDriver(INITIAL_DRIVERS[1]);
  const beforeOther = structuredClone(other); let saved = driver;
  const user = userEvent.setup({ document });
  const props = { driver, drivers: [driver, other], onSave: (value: typeof driver) => { saved = value; saveDrivers([value, other]); }, onCancel: noop };
  const page = render(React.createElement(DriverEditor, props));
  const limit = screen.getByLabelText('Maximum Active Orders') as HTMLInputElement;
  assert.equal(limit.value, '6');
  for (const invalid of ['', '0', '-1', '1.5']) {
    await user.clear(limit); if (invalid) await user.type(limit, invalid);
    assert.equal(limit.checkValidity(), false);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));
    assert.equal(saved.maxActiveOrders, undefined);
  }
  await user.clear(limit); await user.type(limit, '8');
  const changedBilling = loadBillingConfig(); changedBilling.fuelSurcharge.percent = 17; saveBillingConfig(changedBilling);
  await user.click(screen.getByRole('button', { name: 'Save driver' }));
  assert.equal(saved.maxActiveOrders, 8);
  assert.deepEqual(loadBillingConfig(), changedBilling);
  assert.deepEqual(loadDrivers([])[1], beforeOther);
  page.unmount();
  render(React.createElement(DriverEditor, { ...props, driver: loadDrivers([])[0] }));
  assert.equal((screen.getByLabelText('Maximum Active Orders') as HTMLInputElement).value, '8');
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
test('existing imported cards remain editable with their agreed-total treatment', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'IMPORTED', importedPriceMode: 'FINAL_TOTAL' }); render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.ok(screen.getByRole('combobox', { name: 'Imported amount means' })); assert.equal(screen.getByRole('combobox', { name: 'Imported amount means' }).closest('details'), null); await user.type(screen.getByLabelText('Rate card name'), ' renewed'); await user.click(screen.getByRole('button', { name: 'Save Card' })); assert.equal(loadPricingConfig().rateCards[0].importedPriceMode, 'FINAL_TOTAL');
});

test('company tabs keep edits across panels, support keyboard navigation, and save together', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(CompanySettingsPage, {  }));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['General', 'Taxes']);
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.equal(screen.queryByLabelText('Tax Registration Number'), null);
  assert.equal(screen.queryByRole('table'), null);
  await user.clear(screen.getByLabelText('Company name')); await user.type(screen.getByLabelText('Company name'), 'Pacific Couriers');
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  assert.equal(screen.queryByLabelText('Company name'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Company tax details' }), null); assert.equal(screen.queryByRole('button', { name: 'Add Profile' }), null);
  assert.ok(screen.getByRole('heading', { name: 'Tax Registration' }));
  await user.type(screen.getByLabelText('Tax Registration Number'), 'REG-123');
  assert.equal(screen.queryByRole('table'), null);
  assert.equal(screen.getAllByRole('spinbutton').length, 1);
  assert.equal((screen.getByRole('spinbutton', { name: 'Tax / GST rate' }) as HTMLInputElement).value, '5');
  await user.clear(screen.getByRole('spinbutton', { name: 'Tax / GST rate' })); await user.type(screen.getByRole('spinbutton', { name: 'Tax / GST rate' }), '12');
  await user.click(screen.getByRole('tab', { name: 'General' }));
  assert.equal((screen.getByLabelText('Company name') as HTMLInputElement).value, 'Pacific Couriers');
  await user.keyboard('{ArrowRight}'); assert.equal(screen.getByRole('tab', { name: 'Taxes' }).getAttribute('aria-selected'), 'true');
  assert.equal((screen.getByRole('spinbutton', { name: 'Tax / GST rate' }) as HTMLInputElement).value, '12');
  await user.keyboard('{Home}'); assert.ok(screen.getByRole('tab', { name: 'General', selected: true }));
  await user.keyboard('{End}'); assert.ok(screen.getByRole('tab', { name: 'Taxes', selected: true }));
  assert.equal((screen.getByLabelText('Tax Registration Number') as HTMLInputElement).value, 'REG-123');
  await user.click(screen.getByRole('button', { name: 'Save Settings' }));
  const saved = loadBillingConfig(); assert.equal(saved.company.name, 'Pacific Couriers'); assert.equal(saved.invoicing.taxRegistrationNumber, 'REG-123'); assert.equal(saved.companyTax.ratePercent, 12);
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
  await user.type(screen.getByPlaceholderText('e.g. Pacific Fresh Logistics'), 'Terms Shipper');
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

test('Company saves details, tax number and time zone while preserving internal costs', async () => {
  const user = userEvent.setup({ document });
  const company = render(React.createElement(CompanySettingsPage, {  }));
  await user.clear(screen.getByLabelText('Company name')); await user.type(screen.getByLabelText('Company name'), 'Pacific Couriers');
  await user.type(screen.getByLabelText('Company address'), '100 Main St, Vancouver'); await user.type(screen.getByLabelText('Company phone'), '604-555-0100'); await user.type(screen.getByLabelText('Company email'), 'billing@pacific.test');
  await select(user, 'Organization timezone', 'Toronto');
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  await user.type(screen.getByLabelText('Tax Registration Number'), 'REG-123');
  await user.click(screen.getByRole('tab', { name: 'General' }));
  const other = loadBillingConfig(); other.invoicing.quoteValidityDays = 21; saveBillingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save Settings' }));
  let saved = loadBillingConfig(); assert.equal(saved.general.timeZone, 'America/Toronto'); assert.equal(saved.invoicing.quoteValidityDays, 21);
  assert.deepEqual(saved.company, { name: 'Pacific Couriers', address: '100 Main St, Vancouver', phone: '604-555-0100', email: 'billing@pacific.test', logoDataUrl: '' }); assert.equal(saved.invoicing.taxRegistrationNumber, 'REG-123');
  assert.ok(screen.getByRole('button', { name: 'Upload company logo' })); company.unmount();
  assert.deepEqual(loadBillingConfig().operatingCost, other.operatingCost);
});

test('company rate drafts save decimals and zero, survive reload and validate across tabs', async () => {
  const user = userEvent.setup({ document });
  let view = render(React.createElement(CompanySettingsPage, {}));
  for (const rate of ['12.75', '0']) {
    await user.click(screen.getByRole('tab', { name: 'Taxes' }));
    const previous = loadBillingConfig().companyTax.ratePercent;
    await user.clear(screen.getByRole('spinbutton', { name: 'Tax / GST rate' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Tax / GST rate' }), rate);
    assert.equal(loadBillingConfig().companyTax.ratePercent, previous);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));
    assert.equal(loadBillingConfig().companyTax.ratePercent, Number(rate));
    view.unmount(); view = render(React.createElement(CompanySettingsPage, {}));
    await user.click(screen.getByRole('tab', { name: 'Taxes' }));
    assert.equal((screen.getByRole('spinbutton', { name: 'Tax / GST rate' }) as HTMLInputElement).value, rate);
  }
  for (const invalid of ['', '-1', '101']) {
    await user.clear(screen.getByRole('spinbutton', { name: 'Tax / GST rate' }));
    if (invalid) await user.type(screen.getByRole('spinbutton', { name: 'Tax / GST rate' }), invalid);
    await user.click(screen.getByRole('tab', { name: 'General' }));
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));
    assert.match(screen.getByRole('alert').textContent!, /0 to 100%/);
    assert.equal(loadBillingConfig().companyTax.ratePercent, 0);
    await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  }
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
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Rate Cards', 'Fuel Charge', 'Service Level', 'Accessorials']);
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  await user.type(screen.getByLabelText('Rate card name'), ' draft');
  await user.click(screen.getByRole('tab', { name: 'Fuel Charge' }));
  assert.equal(screen.queryByRole('button', { name: 'Save Card' }), null);
  const fuel = screen.getByLabelText('Fuel surcharge (%)');
  await user.clear(fuel); await user.type(fuel, '17');
  await user.click(screen.getByRole('tab', { name: 'Accessorials' }));
  assert.ok(screen.getByRole('heading', { name: 'Accessorials' }));
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  await user.keyboard('{End}');
  assert.equal(screen.getByRole('tab', { name: 'Accessorials' }).getAttribute('aria-selected'), 'true');
  await user.keyboard('{Home}');
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A draft');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A draft');
  await user.click(screen.getByRole('tab', { name: 'Fuel Charge' }));
  assert.equal((screen.getByLabelText('Fuel surcharge (%)') as HTMLInputElement).value, '17');
  await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
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
  const { normalizeCustomer, DEFAULT_CUSTOMERS } = await import('../src/lib/customerStorage');
  assert.equal(normalizeCustomer({ ...DEFAULT_CUSTOMERS[0], customerGroupId: 'old-group' }).customerGroupId, undefined);
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Shipper' }));
  assert.equal(screen.queryByRole('combobox', { name: 'Customer group' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Shipper rate card' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['Contract A (Default)']); assert.equal(screen.queryByRole('option', { name: /^Default \(/ }), null);
});

test('Fuel Charge omits retired rounding and minimum controls', async () => {
  const config = loadBillingConfig();
  Object.assign(config.rules, { moneyRounding: 'nearest_1', distanceRoundingKm: 1, minimumBillableKm: 3 });
  saveBillingConfig(config);
  assert.deepEqual(loadBillingConfig().rules, { minimumChargePerJob: config.rules.minimumChargePerJob, minimumBillableKm: 0 });
  render(React.createElement(RateCardsPage, {  }));
  await userEvent.setup({ document }).click(screen.getByRole('tab', { name: 'Fuel Charge' }));
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
  assert.match(confirmText, /already priced.*unchanged.*No customers are attached/);
  assert.equal(list.queryByRole('button', { name: 'Contract A' }), null); assert.equal(loadPricingConfig().rateCards[0].status, 'ARCHIVED');
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract B');
  assert.equal(screen.queryByRole('button', { name: 'Archive' }), null);
  assert.match(notices.join(' '), /now the Default/); assert.match(notices.join(' '), /Archived "Contract A"/);
  await user.click(screen.getByRole('button', { name: 'Add card' }));
  await user.type(screen.getByLabelText('Rate card name'), ' C'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const created = loadPricingConfig().rateCards.find(card => card.name === 'New Rate Card C')!;
  assert.equal(created.status, 'ACTIVE'); assert.equal(created.scope, 'ORDER'); assert.equal(created.serviceId, null); assert.equal(created.applyServiceMultiplier, true);
});

test('zone card routes preserve legacy prices and save weight bands with the card', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'ZONE' });
  const config = loadPricingConfig();
  config.zoneRates = [{ id: 'a', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: 'srv_rush', amount: 80 }, { id: 'b', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 45 }, { id: 'c', originZoneId: 'zone_bby', destinationZoneId: 'zone_van', serviceId: 'srv_rush', amount: 70 }];
  config.rateCards[0].zoneRates = config.zoneRates;
  savePricingConfig(config);
  assert.deepEqual(loadPricingConfig().zoneRates.map(rate => [rate.originZoneId, rate.destinationZoneId, rate.serviceId, rate.amount]), [['zone_van', 'zone_bby', null, 45], ['zone_bby', 'zone_van', null, 70]]);
  render(React.createElement(RateCardsPage, {  })); assert.equal(screen.queryByRole('tab', { name: 'Zones' }), null);
  assert.equal(screen.queryByLabelText('Zone code'), null); assert.equal(screen.queryByRole('combobox', { name: 'Pickup zone' }), null); assert.equal(screen.queryByRole('button', { name: 'Add zone price' }), null);
  const grid = within(screen.getByRole('region', { name: 'Zone prices' }));
  assert.equal(grid.getAllByRole('spinbutton').length, 72);
  assert.equal((grid.getByRole('spinbutton', { name: 'Vancouver to Burnaby / New West price' }) as HTMLInputElement).value, '45');
  assert.equal((grid.getByRole('spinbutton', { name: 'Vancouver to Richmond / YVR price' }) as HTMLInputElement).value, '');
  assert.equal(grid.getAllByRole('spinbutton').filter(input => (input as HTMLInputElement).value !== '').length, 2);
  await user.type(grid.getByRole('spinbutton', { name: 'Vancouver to Richmond / YVR weight limit (kg)' }), '500');
  await user.type(grid.getByRole('spinbutton', { name: 'Vancouver to Richmond / YVR price' }), '52');
  await user.clear(grid.getByRole('spinbutton', { name: 'Burnaby / New West to Vancouver price' }));
  assert.equal(loadPricingConfig().rateCards[0].zoneRates!.some(rate => rate.destinationZoneId === 'zone_rmd'), false);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig().rateCards[0].zoneRates!.map(rate => [rate.originZoneId, rate.destinationZoneId, rate.weightBands?.[0]?.amount ?? rate.amount]);
  assert.deepEqual(saved.filter(([o, d]) => o === 'zone_van' && d === 'zone_rmd'), [['zone_van', 'zone_rmd', 52]]); assert.equal(saved.some(([o, d]) => o === 'zone_bby' && d === 'zone_van'), false);
  await user.type(screen.getAllByLabelText('Zone name: Vancouver')[0], ' East');
  assert.equal(loadPricingConfig().zones[0].code, 'VANCOU'); assert.ok(grid.getByRole('spinbutton', { name: 'Vancouver East to Burnaby / New West price' }));
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
    assert.equal(card.version, 8);
    assert.deepEqual({ ...card, name: active[i].name, version: 7, updatedAt: active[i].updatedAt }, active[i]);
  });
  assert.deepEqual(loadPricingConfig(), migrated);
  migrated.rateCards[0].name = 'Negotiated distance'; savePricingConfig(migrated);
  assert.equal(loadPricingConfig().rateCards[0].name, 'Negotiated distance');
});

test('two-zone matrix expands to nine combinations and clearing a rate preserves shared zones and other cards', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  const ab = { id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 45 };
  const ba = { id: 'ba', originZoneId: 'b', destinationZoneId: 'a', serviceId: null, amount: 70 };
  seedCard({ pricingMethod: 'ZONE', zoneRates: [ab, ba] });
  const config = loadPricingConfig();
  config.zones = [{ id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['001'] }, { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['002'] }];
  config.rateCards.push(createEmptyRateCard({ id: 'other-zone', name: 'Other zone card', pricingMethod: 'ZONE', zoneRates: [ab] }));
  config.rateCards.push(createEmptyRateCard({ id: 'archived-zone', name: 'Historical card', status: 'ARCHIVED', pricingMethod: 'ZONE', zoneRates: [ab] }));
  savePricingConfig(config);
  const before = loadPricingConfig();
  const page = render(React.createElement(RateCardsPage, {}));
  const table = screen.getByRole('table', { name: 'Zone-to-zone prices' });
  const pairs = () => Array.from(table.querySelectorAll('tbody td')).map(cell => cell.getAttribute('aria-label')!.split(' to '));
  assert.equal(table.querySelectorAll('tbody tr').length, 2);
  assert.equal(within(table).getAllByRole('columnheader').length, 3);
  assert.deepEqual(pairs(), [['Zone 1', 'Zone 1'], ['Zone 1', 'Zone 2'], ['Zone 2', 'Zone 1'], ['Zone 2', 'Zone 2']]);
  assert.equal(within(screen.getByRole('table', { name: 'Zones' })).getAllByRole('textbox', { name: /ZIP \/ postal codes/ }).length, 2);
  assert.equal(screen.queryByRole('combobox', { name: 'Pickup zone' }), null);
  await user.click(screen.getByRole('button', { name: 'Add' }));
  const addedId = loadPricingConfig().zones.at(-1)!.id;
  const name = screen.getAllByLabelText('Zone name: New Zone')[0];
  assert.equal(document.activeElement, name);
  await user.clear(name); await user.type(name, 'Airport');
  assert.equal(loadPricingConfig().zones.at(-1)!.id, addedId);
  assert.equal(pairs().length, 9);
  assert.deepEqual(pairs(), [['Zone 1', 'Zone 1'], ['Zone 1', 'Zone 2'], ['Zone 1', 'Airport'], ['Zone 2', 'Zone 1'], ['Zone 2', 'Zone 2'], ['Zone 2', 'Airport'], ['Airport', 'Zone 1'], ['Airport', 'Zone 2'], ['Airport', 'Airport']]);
  for (const route of ['Zone 1 to Airport', 'Zone 2 to Airport', 'Airport to Zone 1', 'Airport to Zone 2', 'Airport to Airport']) {
    assert.equal((screen.getByLabelText(`${route} price`) as HTMLInputElement).value, '');
    assert.equal((screen.getByLabelText(`${route} weight limit (kg)`) as HTMLInputElement).value, '');
  }
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, [ab, ba]);
  await user.type(screen.getByRole('textbox', { name: 'ZIP / postal codes for Airport' }), '003');
  await user.clear(screen.getByLabelText('Zone 1 to Zone 2 price'));
  assert.equal(pairs().length, 9);
  assert.equal((screen.getByLabelText('Zone 1 to Zone 2 price') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Zone 2 to Zone 1 price') as HTMLInputElement).value, '70');
  assert.equal(loadPricingConfig().zones.length, 3);
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, [ab, ba]);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig();
  assert.deepEqual(saved.rateCards[0].zoneRates, [ba]);
  assert.deepEqual(saved.rateCards.slice(1), before.rateCards.slice(1));
  page.unmount(); render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.getByRole('table', { name: 'Zone-to-zone prices' }).querySelectorAll('tbody td').length, 9);
  assert.equal((screen.getByLabelText('Zone 1 to Zone 2 price') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Zone 2 to Zone 1 price') as HTMLInputElement).value, '70');
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

test('account menu opens its submenu separately and dismisses outside or with Escape', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = userEvent.setup({ document });
  function AccountMenuExample() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(React.Fragment, null,
      React.createElement(Sidebar, { activeTab: 'monitor', isOpen: true, onToggle: noop, setActiveTab: noop,
        showAccountPopover: open, setShowAccountPopover: setOpen, onActionNotification: noop,
        dispatchMode: 'AUTO', onDispatchModeChange: noop }),
      React.createElement('button', null, 'Outside content'));
  }
  render(React.createElement(AccountMenuExample));
  const trigger = screen.getByTitle('Dispatcher Account');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  await user.click(trigger);
  const menu = screen.getByRole('menu', { name: 'Account menu' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(trigger.getAttribute('aria-controls'), menu.id);
  assert.deepEqual(within(menu).getAllByRole('menuitem').map(item => item.textContent), ['Profile', 'Settings', 'Help', 'Logout']);
  await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
  const submenu = screen.getByRole('menu', { name: 'Settings' });
  assert.equal(menu.contains(submenu), false);
  assert.ok(within(submenu).getByRole('menuitem', { name: 'Company' }));
  await user.click(screen.getByRole('button', { name: 'Outside content' }));
  assert.equal(screen.queryByRole('menu'), null);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  await user.click(trigger); await user.click(trigger);
  assert.equal(screen.queryByRole('menu'), null);
  await user.click(trigger);
  await user.click(screen.getByRole('switch', { name: 'Auto dispatch' }));
  assert.equal(screen.queryByRole('menu'), null);
  await user.click(trigger);
  screen.getByRole('menuitem', { name: 'Profile' }).focus();
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('menu'), null);
  assert.equal(document.activeElement, trigger);
});

test('Settings flyout supports keyboard navigation, current destination and closing after selection', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = userEvent.setup({ document }); const visited: string[] = [];
  function Example() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(Sidebar, { isOpen: true, onToggle: noop, setActiveTab: noop, showAccountPopover: open, setShowAccountPopover: setOpen,
      onActionNotification: noop, dispatchMode: 'AUTO', onDispatchModeChange: noop, onNavigateSettings: (area: string) => visited.push(area), activeTab: 'rate-cards', activeSettingsArea: 'pricing' });
  }
  render(React.createElement(Example));
  await user.click(screen.getByTitle('Dispatcher Account'));
  const trigger = screen.getByRole('menuitem', { name: 'Settings' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(screen.queryByRole('menuitem', { name: 'Pricing' }), null);
  trigger.focus(); await user.keyboard('{ArrowRight}');
  const submenu = await screen.findByRole('menu', { name: 'Settings' });
  assert.deepEqual(within(submenu).getAllByRole('menuitem').map(item => item.textContent), ['Company', 'Pricing']);
  assert.equal(document.activeElement, screen.getByRole('menuitem', { name: 'Company' }));
  assert.equal(screen.getByRole('menuitem', { name: 'Pricing' }).getAttribute('aria-current'), 'page');
  await user.keyboard('{ArrowLeft}');
  assert.equal(document.activeElement, trigger); assert.equal(screen.queryByRole('menu', { name: 'Settings' }), null);
  await user.keyboard('{ArrowRight}{End}{Enter}');
  assert.deepEqual(visited, ['pricing']); assert.equal(screen.queryByRole('menu'), null);
});

test('vehicle types carry their internal running cost, stored with operating costs and never in the customer price', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(CatalogueSection, { section: 'vehicles', onNotification: noop }));
  const section = within(screen.getByRole('region', { name: 'Vehicle types' }));
  assert.ok(section.getByRole('columnheader', { name: 'Cost / km' }));
  const before = loadBillingConfig(); const vehicle = loadSimplePricingConfig().vehicles[0];
  await user.click(section.getByRole('button', { name: `Edit ${vehicle.name}` }));
  const cost = screen.getByLabelText('Running cost / km (internal)') as HTMLInputElement;
  assert.equal(cost.value, before.operatingCost.costPerKmByVehicleId[vehicle.id] == null ? '' : String(before.operatingCost.costPerKmByVehicleId[vehicle.id]));
  await user.clear(cost); await user.type(cost, '1.25');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadBillingConfig().operatingCost.costPerKmByVehicleId[vehicle.id], 1.25);
  assert.deepEqual(loadSimplePricingConfig().vehicles[0].baseSurcharge, vehicle.baseSurcharge);
  assert.match(section.getByText(vehicle.name).closest('tr')!.textContent!, /\$1\.25/);
  await user.click(section.getByRole('button', { name: `Edit ${vehicle.name}` }));
  await user.clear(screen.getByLabelText('Running cost / km (internal)')); await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(vehicle.id in loadBillingConfig().operatingCost.costPerKmByVehicleId, false);
});

test('Vehicles tab shows type pricing columns and retains search and registration', async () => {
  const user = userEvent.setup({ document });
  const asset = loadVehicles().find(vehicle => vehicle.vehicleTypeId)!;
  const type = loadSimplePricingConfig().vehicles.find(item => item.id === asset.vehicleTypeId)!;
  const billing = loadBillingConfig(); billing.operatingCost.costPerKmByVehicleId[type.id] = 1.25; saveBillingConfig(billing);
  const before = loadSimplePricingConfig();
  render(React.createElement(VehiclesPage, { drivers: [], onNotification: noop }));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Vehicles', 'Vehicle Types']);
  assert.equal(screen.getByRole('tab', { name: 'Vehicles' }).getAttribute('aria-selected'), 'true');
  const table = within(screen.getByRole('table', { name: 'Vehicles' }));
  for (const name of ['Surcharge', 'Type limits', 'Cost / km', 'Capacity']) assert.ok(table.getByRole('columnheader', { name }));
  await user.type(screen.getByRole('searchbox'), asset.unitNumber);
  const row = screen.getByRole('button', { name: `Details for ${asset.unitNumber}` }).closest('tr')!;
  assert.ok(within(row).getByText(`$${type.baseSurcharge.toFixed(2)}`));
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

test('Vehicle Types tab manages the type catalogue from the Vehicles page', async () => {
  const { VehiclesPage } = await import('../src/pages/VehiclesPage');
  const user = userEvent.setup({ document });
  render(React.createElement(VehiclesPage, { drivers: [], onNotification: noop }));
  await user.click(screen.getByRole('tab', { name: 'Vehicle Types' }));
  const region = within(screen.getByRole('region', { name: 'Vehicle types' }));
  assert.ok(region.getByRole('button', { name: 'Add Vehicle type' }));
  const first = loadSimplePricingConfig().vehicles[0];
  await user.click(region.getByRole('button', { name: `Edit ${first.name}` }));
  assert.ok(screen.getByRole('heading', { name: 'Edit Vehicle Type' }));
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('heading', { name: 'Edit Vehicle Type' }), null);
  assert.ok(screen.getByRole('tab', { name: 'Vehicle Types' }), 'Escape closes only the type form');
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
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Fuel Charge' }));
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
  render(React.createElement(RateCardsPage, {  })); await user.click(screen.getByRole('tab', { name: 'Fuel Charge' }));
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
  await user.type(screen.getByPlaceholderText('e.g. Pacific Fresh Logistics'), 'Discount Shipper');
  assert.equal(screen.queryByRole('combobox', { name: 'Discount scope' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Discount type' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['No discount', 'Percentage', 'Fixed amount']);
  await user.click(screen.getByRole('option', { name: 'Percentage' }));
  await user.clear(screen.getByRole('spinbutton', { name: 'Percentage' })); await user.type(screen.getByRole('spinbutton', { name: 'Percentage' }), '12.5');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Create|Save|Add/ }));
  assert.deepEqual(loadCustomers().find(c => c.name === 'Discount Shipper')!.discount, { type: 'PERCENT', value: 12.5, scope: 'TRANSPORT_ONLY' });
  await user.click(screen.getAllByTitle('Edit shipper account')[0]);
  assert.equal((screen.getByRole('spinbutton', { name: 'Percentage' }) as HTMLInputElement).value, '12.5');
  await select(user, 'Discount type', 'Fixed amount');
  await user.clear(screen.getByRole('spinbutton', { name: 'Amount (excludes tax)' })); await user.type(screen.getByRole('spinbutton', { name: 'Amount (excludes tax)' }), '8');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Save/ }));
  assert.deepEqual(loadCustomers().find(c => c.name === 'Discount Shipper')!.discount, { type: 'FIXED', value: 8, scope: 'TRANSPORT_ONLY' });
});

test('Profile holds personal fields without obsolete organization and dispatch controls', async () => {
  const { ProfilePage } = await import('../src/pages/ProfilePage');
  const { loadUserProfile, PROFILE_STORAGE_KEY } = await import('../src/lib/profileStorage');
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Sam', organization: 'Old Org', hub: 'Old Hub', timezone: 'America/Toronto', orgLogoUrl: 'data:image/png;base64,x' }));
  const profile = loadUserProfile() as unknown as Record<string, unknown>;
  assert.equal(profile.name, 'Sam'); for (const gone of ['organization', 'hub', 'timezone', 'orgLogoUrl', 'organizationId']) assert.equal(gone in profile, false, gone);
  const user = userEvent.setup({ document });
  const page = render(React.createElement(ProfilePage, {  }));
  assert.ok(screen.getByRole('heading', { name: 'Contact Information' }));
  for (const gone of ['Organization', 'Timezone', 'Active Operating Origin / Dispatch Hub', 'Organization & Hub Logo']) assert.equal(screen.queryByText(gone), null, gone);
  page.unmount();

});

test('every rate card ends with a worked pricing example computed by the engine; zone cards have no Pricing terms', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document }); seedCard({ baseFee: 20, includedKm: 5, kmRate: 1.5, minimumOrderSubtotal: 35, discount: { type: 'PERCENT', value: 10, scope: 'TRANSPORT_ONLY' } });
  render(React.createElement(RateCardsPage, {  }));
  const values = () => Object.fromEntries([...screen.getByLabelText('Pricing values').querySelectorAll('dt')].map(term => [term.textContent!.replace(/ =$/, ''), term.nextElementSibling!.firstElementChild!.textContent!]));
  const section = screen.getByText('Pricing formula').closest('details')!; assert.equal(section.open, false); assert.match(section.textContent!, /Example: 12 km, 3 stops · \$[\d.]+/);
  let v = values();
  assert.match(screen.getByLabelText('Pricing values').textContent!, /Base fee covers the first 5 km/); assert.match(screen.getByLabelText('Pricing values').textContent!, /Set discounts on the Shipper form/);
  assert.equal(v['Base freight'], '$20.00 + max(0, 12 − 5) km × $1.50 = $30.50'); assert.equal(v['Service charge'], 'Rush Expedited (2-Hour) +$20.00');
  assert.equal(v['Extra stops'], undefined); assert.match(v['Vehicle surcharge'], /2 Tonne.*= \$25\.00/); assert.match(v['Accessorials'], /^Stair Carry \$5\.00 \+ .* = \$/);
  assert.match(v['Fuel surcharge'], /^28\.5% × \$[\d.]+ = \$[\d.]+$/); assert.equal(v['Service fee'], undefined); assert.equal(v['Discount'], 'none'); assert.equal(v['Minimum charge'], '$35.00'); assert.match(v['Tax'], /Tax \/ GST 5%/);
  const formula = screen.getByLabelText('Pricing formula').textContent!;
  assert.match(formula, /Freight\s+= \$30\.50 \+ \$20\.00 = \$50\.50/); assert.equal(v['Packages'], '2 packages · actual 40.0 kg'); assert.equal(v['Weight charge'], undefined); assert.match(formula, /Subtotal\s+= greater of/); const total = formula.match(/Total\s+= .* = (\$[\d.]+)$/m)![1];
  assert.match(screen.getByText(/Example total:/).textContent!, new RegExp(total.replace('$', '\\$').replace('.', '\\.')));
  assert.equal(screen.queryByRole('combobox', { name: 'Discount type' }), null);
  for (const label of ['Included Weight', 'Weight Rate', 'Dimensional Divisor']) assert.equal(screen.queryByLabelText(label), null);
  cleanup(); seedCard({ pricingMethod: 'ZONE' });
  render(React.createElement(RateCardsPage, {  }));
  assert.equal(screen.queryByText('Pricing terms'), null); assert.match(screen.getByRole('status').textContent!, /zone/i);
});

test('zone cards start with the three starter zones and the 500 kg pickup-to-delivery matrix', async () => {
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const config = loadPricingConfig();
  assert.deepEqual(config.zones.map(z => [z.name, z.postalCodes]), [['Zone 1', ['V5Y 1V4']], ['Zone 2', ['V5G 1M2']], ['Zone 3', ['V3T 1V8']]]);
  const price = (rates: typeof config.zoneRates, o: string, d: string) => rates.find(r => r.originZoneId === o && r.destinationZoneId === d)!;
  assert.equal(config.zoneRates.length, 9);
  assert.deepEqual([price(config.zoneRates, 'zone_1', 'zone_2').amount, price(config.zoneRates, 'zone_2', 'zone_3').amount, price(config.zoneRates, 'zone_3', 'zone_3').amount], [45, 50, 35]);
  assert.ok(config.zoneRates.every(r => r.weightBands?.length === 1 && r.weightBands[0].maxWeightKg === 500 && r.weightBands[0].amount === r.amount));
  const demo = config.rateCards.find(card => card.pricingMethod === 'ZONE')!;
  assert.equal(demo.zoneRates!.length, 9);
  assert.equal(price(demo.zoneRates!, 'zone_1', 'zone_3').amount, 65);
  // Saved configurations gain the starters once; existing zones and prices are kept and the card's own prices win.
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, zones: [], zoneRates: [], rateCards: config.rateCards.map(c => ({ ...c, zoneRates: [] })), schemaVersion: 9 }));
  const filled = loadPricingConfig();
  assert.equal(filled.zones.length, 3); assert.equal(filled.rateCards.find(card => card.pricingMethod === 'ZONE')!.zoneRates!.length, 9);
  const custom = { id: 'zone_custom', code: 'CUSTOM', name: 'Custom', postalCodes: ['V6B 1A1'] };
  const own = { id: 'own', originZoneId: 'zone_1', destinationZoneId: 'zone_2', serviceId: null, amount: 99 };
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, zones: [custom], zoneRates: [], rateCards: config.rateCards.map(c => ({ ...c, zoneRates: c.pricingMethod === 'ZONE' ? [own] : [] })), schemaVersion: 9 }));
  const merged = loadPricingConfig();
  assert.deepEqual(merged.zones.map(z => z.id), ['zone_custom', 'zone_1', 'zone_2', 'zone_3']);
  assert.equal(merged.zoneRates.length, 9);
  const mergedCard = merged.rateCards.find(card => card.pricingMethod === 'ZONE')!;
  assert.equal(mergedCard.zoneRates!.length, 9); assert.equal(price(mergedCard.zoneRates!, 'zone_1', 'zone_2').amount, 99);
  assert.equal(mergedCard.zoneRates!.some(r => r.originZoneId === 'zone_custom'), false);
  savePricingConfig({ ...merged, zones: merged.zones.filter(z => z.id !== 'zone_3') });
  assert.equal(loadPricingConfig().zones.length, 3, 'a deliberate removal after the marker is kept');
  // An older zone that only shares a starter's name is replaced by the starter; unrelated zones and prices stay.
  const mine = { id: 'zone_mine', code: 'ZONE1', name: 'zone 1', postalCodes: ['V6B 1A1'] };
  const other = { id: 'zone_other', code: 'OTHER', name: 'Airport', postalCodes: ['V7B 1A1'] };
  const minePrice = { id: 'mine', originZoneId: 'zone_mine', destinationZoneId: 'zone_other', serviceId: null, amount: 12 };
  const otherPrice = { id: 'other', originZoneId: 'zone_other', destinationZoneId: 'zone_other', serviceId: null, amount: 20 };
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...config, zones: [mine, other], zoneRates: [], rateCards: config.rateCards.map(c => ({ ...c, zoneRates: c.pricingMethod === 'ZONE' ? [minePrice, otherPrice] : [] })), schemaVersion: 10 }));
  const replaced = loadPricingConfig();
  assert.deepEqual(replaced.zones.map(z => z.id), ['zone_other', 'zone_1', 'zone_2', 'zone_3']);
  const replacedCard = replaced.rateCards.find(card => card.pricingMethod === 'ZONE')!;
  assert.equal(replacedCard.zoneRates!.length, 10);
  assert.equal(price(replacedCard.zoneRates!, 'zone_other', 'zone_other').amount, 20);
  assert.equal(replacedCard.zoneRates!.some(r => r.originZoneId === 'zone_mine'), false);
  // A configuration that already holds both the starter and a same-named older zone drops the older one.
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ ...replaced, zones: [mine, ...replaced.zones], schemaVersion: 10 }));
  assert.deepEqual(loadPricingConfig().zones.map(z => z.id), ['zone_other', 'zone_1', 'zone_2', 'zone_3']);
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
  assert.ok(within(dialog).getByRole('combobox', { name: 'Shipper type' })); assert.ok(within(dialog).getByPlaceholderText('e.g. Elena Rostova')); assert.ok(within(dialog).getByText('Dispatch & Receiving Instructions'));
  await user.type(within(dialog).getByPlaceholderText('e.g. Pacific Fresh Logistics'), 'Harbour Bakery'); await user.type(within(dialog).getByPlaceholderText('e.g. Elena Rostova'), 'Mo Lee');
  await user.click(within(dialog).getByRole('button', { name: /Create|Save|Add/ }));
  const created = loadCustomers().find(c => c.name === 'Harbour Bakery')!;
  assert.match(created.code, /^CUST-\d{4}$/); assert.equal(created.contactName, 'Mo Lee'); assert.equal(created.customerType, 'BUSINESS'); assert.equal(created.status, 'Active');
  await user.click(screen.getAllByTitle('Edit shipper account')[0]);
  const edit = screen.getByRole('dialog'); assert.ok(within(edit).getByRole('combobox', { name: 'Shipper status' })); assert.equal(within(edit).queryByText('Account / Code'), null);
});

test('custom confirm dialog replaces the browser confirm: archive, discard-changes guard, Escape and cancel', async () => {
  const { ConfirmDialogHost, confirmDialog } = await import('../src/components/ui/ConfirmDialog');
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
  await user.type(screen.getByRole('spinbutton', { name: 'Zone 1 to Zone 1 weight limit (kg)' }), '500');
  await user.type(screen.getByRole('spinbutton', { name: 'Zone 1 to Zone 1 price' }), '25');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  cleanup(); render(React.createElement(RateCardsPage, {}));
  await user.click(screen.getByRole('button', { name: 'Zone to zone' }));
  const reopened = screen.getByRole('textbox', { name: 'ZIP / postal codes for Zone 1' });
  assert.equal((reopened as HTMLInputElement).value, '00501, 10001, V6B 1A1');
  await user.clear(reopened); await user.type(reopened, '10002');
  await user.keyboard('{Escape}');
  assert.deepEqual(loadPricingConfig().zones[0].postalCodes, ['10002']);
  assert.equal((screen.getByRole('spinbutton', { name: 'Zone 1 to Zone 1 price' }) as HTMLInputElement).value, '25');
});

test('untouched legacy preset zones retire once while user zones, archives and unrelated prices survive', async () => {
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
  assert.deepEqual(migratedRates.filter(r => !r.originZoneId.startsWith('zone_') || r.originZoneId === 'zone_bby'), [ownPrice]);
  assert.equal(migratedRates.some(r => r.id === 'old'), false);
  assert.deepEqual(migrated.rateCards.find(c => c.id === 'historical')!.zoneRates, [oldPrice, ownPrice]);
  assert.deepEqual(loadPricingConfig(), migrated);
});

test('existing effective card discounts migrate to shippers once, including Default, without altering the card history', async () => {
  const { CUSTOMERS_STORAGE_KEY, DEFAULT_CUSTOMERS, loadCustomers, saveCustomers } = await import('../src/lib/customerStorage');
  const card = seedCard({ discount: { type: 'PERCENT', value: 12.5, scope: 'TRANSPORT_ONLY' } });
  const old = structuredClone(DEFAULT_CUSTOMERS.slice(0, 2));
  old[0].rateCardId = card.id; old[1].rateCardId = null;
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, customers: old }));
  const migrated = loadCustomers();
  assert.ok(migrated.every(c => c.discount.type === 'PERCENT' && c.discount.value === 12.5));
  assert.deepEqual(loadPricingConfig().rateCards[0].discount, card.discount);
  migrated[0].discount = { type: 'NONE', value: 0, scope: 'TRANSPORT_ONLY' }; saveCustomers(migrated);
  assert.deepEqual(loadCustomers(), migrated);
  assert.equal(JSON.parse(localStorage.getItem(CUSTOMERS_STORAGE_KEY)!).schemaVersion, 3);
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
    await user.click(screen.getByRole('tab', { name: 'Fuel Charge' }));
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

test('zone weight bands preserve prices, validate duplicates, sort, save and reload', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE', zoneRates: [{ id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 40, weightBands: [{ id: 'large', maxWeightKg: 500, amount: 40 }, { id: 'small', maxWeightKg: 200, amount: 25 }] }] });
  const config = loadPricingConfig();
  config.zones = [{ id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['V1A'] }, { id: 'b', code: 'B', name: 'Zone 2', postalCodes: ['V2A'] }];
  savePricingConfig(config);
  const notices: string[] = [];
  const page = render(React.createElement(RateCardsPage, { onNotification: (message: string) => notices.push(message) }));
  const route = within(screen.getByRole('cell', { name: 'Zone 1 to Zone 2' }));
  assert.equal((route.getByLabelText('Zone 1 to Zone 2 price') as HTMLInputElement).value, '40');
  assert.equal(route.queryByRole('button'), null);
  await user.clear(route.getByLabelText('Zone 1 to Zone 2 weight limit 2 (kg)'));
  await user.type(route.getByLabelText('Zone 1 to Zone 2 weight limit 2 (kg)'), '500');
  assertFieldIssue('Zone 1 to Zone 2 weight limit (kg)', 'Each weight limit must be different');
  assertFieldIssue('Zone 1 to Zone 2 weight limit 2 (kg)', 'Each weight limit must be different');
  assertFieldIssue('Zone 1 to Zone 2 price', null);
  assertFieldIssue('Zone 1 to Zone 2 price 2', null);
  assertFieldIssue('Zone 2 to Zone 1 weight limit (kg)', null);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.match(notices.at(-1)!, /Each weight limit/);
  assert.equal(loadPricingConfig().rateCards[0].zoneRates![0].weightBands![1].maxWeightKg, 200);
  await user.clear(route.getByLabelText('Zone 1 to Zone 2 weight limit 2 (kg)'));
  await user.type(route.getByLabelText('Zone 1 to Zone 2 weight limit 2 (kg)'), '100');
  assertFieldIssue('Zone 1 to Zone 2 weight limit (kg)', null);
  assertFieldIssue('Zone 1 to Zone 2 weight limit 2 (kg)', null);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates![0].weightBands!.map(b => [b.maxWeightKg, b.amount]), [[100, 25], [500, 40]]);
  page.unmount(); render(React.createElement(RateCardsPage, {}));
  assert.equal((screen.getByLabelText('Zone 1 to Zone 2 price') as HTMLInputElement).value, '25');
  assert.equal((screen.getByLabelText('Zone 1 to Zone 2 price 2') as HTMLInputElement).value, '40');
  assert.equal((screen.getByLabelText('Zone 2 to Zone 1 price') as HTMLInputElement).value, '');
  for (const suffix of [' 2', '']) {
    await user.clear(screen.getByLabelText(`Zone 1 to Zone 2 weight limit${suffix} (kg)`));
    await user.clear(screen.getByLabelText(`Zone 1 to Zone 2 price${suffix}`));
  }
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, []);
});

test('zone weight editing uses selected company units and distinguishes blank from zero price', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'ZONE' });
  const config = loadPricingConfig(); config.zones = [{ id: 'a', code: 'A', name: 'Zone 1', postalCodes: ['V1A'] }]; savePricingConfig(config);
  const billing = loadBillingConfig(); billing.general.weightUnit = 'lb'; saveBillingConfig(billing);
  render(React.createElement(RateCardsPage, {}));
  await user.type(screen.getByLabelText('Zone 1 to Zone 1 weight limit (lb)'), '500');
  assertFieldIssue('Zone 1 to Zone 1 price', 'Enter a price of zero or more');
  assertFieldIssue('Zone 1 to Zone 1 weight limit (lb)', null);
  await user.type(screen.getByLabelText('Zone 1 to Zone 1 price'), '0');
  assertFieldIssue('Zone 1 to Zone 1 price', null);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const band = loadPricingConfig().rateCards[0].zoneRates![0].weightBands![0];
  assert.ok(Math.abs(band.maxWeightKg! - 226.796185) < 0.000001); assert.equal(band.amount, 0);
  assert.ok(screen.getByPlaceholderText('Weight'));
  assert.ok(screen.getByText(`Enter the maximum weight (${billing.general.weightUnit}) and delivery price (${billing.invoicing.currency}) for each pickup-to-delivery pair. Orders automatically use the greater of actual and dimensional weight.`));
  assert.ok(screen.getByPlaceholderText('Price'));
  assert.equal(within(screen.getByRole('table', { name: 'Zone-to-zone prices' })).queryByRole('button'), null);
});

test('ten zones show all 100 combinations and preserve directional drafts and untouched rates', async () => {
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE' });
  const config = loadPricingConfig();
  config.zones = Array.from({ length: 10 }, (_, index) => ({ id: `z${index}`, code: `Z${index}`, name: `Area ${index + 1}`, postalCodes: [`00${index}`] }));
  config.rateCards[0].zoneRates = config.zones.flatMap((origin, i) => config.zones.map((destination, j) => ({
    id: `rate-${i}-${j}`, originZoneId: origin.id, destinationZoneId: destination.id, serviceId: null, amount: i * 10 + j,
    ...(i === 0 && j === 2 ? { weightBands: [{ id: 'small', maxWeightKg: 10, amount: 4 }, { id: 'large', maxWeightKg: 30, amount: 8 }] } : {}),
  })));
  savePricingConfig(config);
  const before = structuredClone(loadPricingConfig().rateCards[0].zoneRates!);
  render(React.createElement(RateCardsPage, {}));
  const table = screen.getByRole('table', { name: 'Zone-to-zone prices' });
  assert.equal(table.querySelectorAll('tbody tr').length, 10);
  assert.equal(within(table).getAllByRole('columnheader').length, 11);
  assert.equal(within(table).getAllByRole('rowheader').length, 10);
  assert.equal(within(table).getAllByRole('cell').length, 100);
  assert.equal(within(table).getAllByRole('spinbutton').length, 202); // One extra saved band.
  assert.equal(screen.getAllByLabelText(/Zone name:/).length, 10);
  for (const origin of config.zones) for (const destination of config.zones) {
    const cell = within(table).getByRole('cell', { name: `${origin.name} to ${destination.name}` });
    assert.equal(cell.hasAttribute('hidden'), false);
  }
  assert.equal(screen.getAllByRole('table').length, 2);
  assert.equal((screen.getByLabelText('Area 1 to Area 1 price') as HTMLInputElement).value, '0');
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, before);
  await user.clear(screen.getByLabelText('Area 1 to Area 2 price'));
  assert.equal((screen.getByLabelText('Area 1 to Area 2 price') as HTMLInputElement).value, '');
  await user.type(screen.getByLabelText('Area 1 to Area 2 price'), '45');
  assert.ok(screen.getByLabelText('Area 1 to Area 2 price'));
  assert.equal((screen.getByLabelText('Area 2 to Area 1 price') as HTMLInputElement).value, '10');
  await user.clear(screen.getByLabelText('Area 2 to Area 1 price'));
  await user.type(screen.getByLabelText('Area 2 to Area 1 price'), '70');
  assert.equal((screen.getByLabelText('Area 1 to Area 2 price') as HTMLInputElement).value, '45');
  const name = screen.getAllByLabelText('Zone name: Area 1')[0];
  await user.clear(name); await user.type(name, 'Central');
  assert.equal(loadPricingConfig().zones[0].id, 'z0');
  assert.ok(within(table).getByRole('rowheader', { name: 'Central' }));
  assert.ok(within(table).getByRole('columnheader', { name: 'Central' }));
  assert.equal((screen.getByLabelText('Central to Area 2 price') as HTMLInputElement).value, '45');
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, before, 'Zone edits must not save price drafts');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig().rateCards[0].zoneRates!;
  assert.equal(saved.find(rate => rate.id === 'rate-0-1')!.amount, 45);
  assert.equal(saved.find(rate => rate.id === 'rate-1-0')!.amount, 70);
  for (const rate of before.filter(rate => !['rate-0-1', 'rate-1-0'].includes(rate.id))) {
    assert.deepEqual(saved.find(current => current.id === rate.id), rate, `Untouched route ${rate.id}`);
  }
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

test('band fields validate positive weights and nonnegative prices without band controls', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE', zoneRates: [] });
  const config = loadPricingConfig(); config.zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['001'] }]; savePricingConfig(config);
  const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onNotification: message => notices.push(message) }));
  await user.type(screen.getByLabelText('Central to Central weight limit (kg)'), '0');
  assertFieldIssue('Central to Central weight limit (kg)', 'Enter a weight limit greater than zero');
  await user.clear(screen.getByLabelText('Central to Central weight limit (kg)'));
  await user.type(screen.getByLabelText('Central to Central weight limit (kg)'), '500');
  await user.type(screen.getByLabelText('Central to Central price'), '-1');
  assertFieldIssue('Central to Central weight limit (kg)', null);
  assertFieldIssue('Central to Central price', 'Enter a price of zero or more');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.match(notices.at(-1)!, /Enter a price of zero or more/);
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, []);
  await user.clear(screen.getByLabelText('Central to Central price')); await user.type(screen.getByLabelText('Central to Central price'), '50');
  assertFieldIssue('Central to Central price', null);
  assert.equal(within(screen.getByRole('cell', { name: 'Central to Central' })).queryByRole('button'), null);
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
  assert.equal((screen.getByLabelText('Zone 1 to Zone 2 price') as HTMLInputElement).value, '45');
  assert.equal((screen.getByLabelText('Zone 2 to Zone 1 price') as HTMLInputElement).value, '70');
});

test('removing a shared zone confirms, shrinks both matrix axes and preserves drafts and archived rates', async () => {
  const { ConfirmDialogHost } = await import('../src/components/ui/ConfirmDialog');
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
  await user.clear(screen.getByLabelText('Zone 1 to Zone 1 price'));
  await user.type(screen.getByLabelText('Zone 1 to Zone 1 price'), '22');
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
  const table = screen.getByRole('table', { name: 'Zone-to-zone prices' });
  assert.equal(within(table).getAllByRole('rowheader').length, 2);
  assert.equal(within(table).getAllByRole('columnheader').length, 3);
  assert.equal(within(table).getAllByRole('cell').length, 4);
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited');
  assert.equal((screen.getByLabelText('Zone 1 to Zone 1 price') as HTMLInputElement).value, '22');
  const removed = loadPricingConfig();
  assert.deepEqual(removed.zones.map(zone => zone.id), ['a', 'c']);
  assert.deepEqual(removed.zoneRates, [rates[2]]);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(removed.rateCards[i].zoneRates, [rates[2]]);
    assert.equal(removed.rateCards[i].version, before.rateCards[i].version + 1);
  }
  assert.deepEqual(removed.rateCards[2], before.rateCards[2]);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, [{ ...rates[2], amount: 22 }]);
  page.unmount(); render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.getByRole('table', { name: 'Zone-to-zone prices' }).querySelectorAll('tbody td').length, 4);
  assert.equal((screen.getByLabelText('Zone 1 to Zone 1 price') as HTMLInputElement).value, '22');
});


test('company weight setting controls matrix entry and reload without changing saved prices', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  assert.equal(loadBillingConfig().general.weightUnit, 'kg');
  seedCard({ pricingMethod: 'ZONE', zoneRates: [] });
  const config = loadPricingConfig(); config.zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['001'] }]; savePricingConfig(config);
  let company = render(React.createElement(CompanySettingsPage, {}));
  await select(user, 'Weight unit', 'lb — Pounds');
  await user.click(screen.getByRole('button', { name: 'Save Settings' }));
  assert.equal(loadBillingConfig().general.weightUnit, 'lb');
  company.unmount();
  let page = render(React.createElement(RateCardsPage, {}));
  assert.equal(screen.queryByRole('combobox', { name: /weight.*unit/i }), null);
  const weight = screen.getByLabelText('Central to Central weight limit (lb)');
  assert.equal((weight as HTMLInputElement).value, '');
  await user.type(weight, '100');
  await user.type(screen.getByLabelText('Central to Central price'), '0');
  assert.deepEqual(loadPricingConfig().rateCards[0].zoneRates, []);
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig();
  assert.ok(Math.abs(saved.rateCards[0].zoneRates![0].weightBands![0].maxWeightKg! - 45.359237) < 1e-8);
  page.unmount(); page = render(React.createElement(RateCardsPage, {}));
  assert.equal((screen.getByLabelText('Central to Central weight limit (lb)') as HTMLInputElement).value, '100');
  page.unmount();
  company = render(React.createElement(CompanySettingsPage, {}));
  await select(user, 'Weight unit', 'kg — Kilograms');
  await user.click(screen.getByRole('button', { name: 'Save Settings' })); company.unmount();
  render(React.createElement(RateCardsPage, {}));
  assert.equal((screen.getByLabelText('Central to Central weight limit (kg)') as HTMLInputElement).value, '45.359237');
  assert.equal((screen.getByLabelText('Central to Central price') as HTMLInputElement).value, '0');
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
  const values = () => Object.fromEntries([...screen.getByLabelText('Pricing values').querySelectorAll('dt')].map(term => [term.textContent!.replace(/ =$/, ''), term.nextElementSibling!.firstElementChild!.textContent!]));
  assert.equal(values()['Base freight'], '$20.00 + max(0, 12 − 20) km × $1.00 = $20.00');
  assert.equal(values()['Weight charge'], undefined);
  assert.doesNotMatch(screen.getByLabelText('Pricing values').textContent!, /dimensional|divisor|Weight charge/i);
  await user.clear(screen.getByLabelText('Included Distance')); await user.type(screen.getByLabelText('Included Distance'), '5');
  assert.equal(values()['Base freight'], '$20.00 + max(0, 12 − 5) km × $1.00 = $27.00');
});


test('Distance example uses selected distance and actual-weight display units', () => {
  const billing = loadBillingConfig(); Object.assign(billing.general, { distanceUnit: 'mi', weightUnit: 'lb', dimensionUnit: 'in' }); saveBillingConfig(billing);
  seedCard({ baseFee: 20, includedKm: 0, kmRate: 1, dimensionalDivisor: 5000 });
  render(React.createElement(RateCardsPage, {}));
  const values = screen.getByLabelText('Pricing values').textContent!;
  assert.match(values, /max\(0, 12 − 0\) mi/);
  assert.match(values, /= \$39.31/);
  assert.doesNotMatch(values, /in³|chargeable|dimensional/i);
  assert.match(values, /actual 88.2 lb/);
});


test('Zone formula selects prices automatically using dimensional movement weight', async () => {
  useMetricCompany();
  const user = userEvent.setup({ document });
  seedCard({ pricingMethod: 'ZONE', dimensionalDivisor: 5000, zoneRates: [{ id: 'ab', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 999, weightBands: [{ id: 'light', maxWeightKg: 25, amount: 30 }, { id: 'bulky', maxWeightKg: 50, amount: 60 }] }] });
  render(React.createElement(RateCardsPage, {}));
  const baseFreight = () => [...screen.getByLabelText('Pricing values').querySelectorAll('dt')].find(dt => dt.textContent === 'Base freight =')!.nextElementSibling!.firstElementChild!.textContent;
  assert.match(baseFreight()!, /= \$60.00/); // Two separate 24 kg movements at $30 each.
  await user.clear(screen.getByLabelText('Dimensional Divisor')); await user.type(screen.getByLabelText('Dimensional Divisor'), '2500');
  assert.match(baseFreight()!, /= \$120.00/); // Each movement is now 48 kg and uses the $60 band.
  assert.match(screen.getByRole('region', { name: 'Zone prices' }).textContent!, /automatically use the greater of actual and dimensional weight/);
});


test('Service Level lives in Pricing, preserves rate drafts and reloads saved services', async () => {
  const user = userEvent.setup({ document });
  seedCard();
  const page = render(React.createElement(RateCardsPage, {}));
  await user.type(screen.getByLabelText('Rate card name'), ' draft');
  const tab = screen.getByRole('tab', { name: 'Rate Cards' }); tab.focus();
  await user.keyboard('{ArrowRight}');
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'Fuel Charge', selected: true }));
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
  const page = render(React.createElement(CompanySettingsPage, {}));
  const logo = screen.getByRole('button', { name: 'Upload company logo' });
  assert.equal(screen.queryByText('Upload logo'), null);
  assert.ok(logo.querySelector('svg'));
  const input = page.container.querySelector('input[type="file"]') as HTMLInputElement;
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
  await user.click(screen.getByRole('button', { name: 'Save Settings' }));
  assert.equal(loadBillingConfig().company.logoDataUrl, replacementUrl);
  page.unmount(); render(React.createElement(CompanySettingsPage, {}));
  assert.equal(screen.getByRole('img', { name: 'Company logo' }).getAttribute('src'), replacementUrl);
  assert.ok(screen.getByRole('button', { name: 'Change company logo' }).contains(screen.getByRole('img', { name: 'Company logo' })));
  assert.equal(screen.queryByText('Change logo'), null);
  await user.click(screen.getByRole('button', { name: 'Remove company logo' }));
  assert.ok(screen.getByRole('button', { name: 'Upload company logo' }));
});


test('company logo accepts only PNG and JPEG uploads and preserves its draft after invalid files', async () => {
  const user = userEvent.setup({ document, applyAccept: false });
  const billing = loadBillingConfig(); billing.company.logoDataUrl = 'data:image/png;base64,c2F2ZWQ='; saveBillingConfig(billing);
  const page = render(React.createElement(CompanySettingsPage, {}));
  const input = page.container.querySelector('input[type="file"]') as HTMLInputElement;
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
