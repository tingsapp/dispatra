import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => { };
window.confirm = () => true;
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { PricingServicesPage } = await import('../src/pages/PricingServicesPage');
const { BillingSettingsPage } = await import('../src/pages/BillingSettingsPage');
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
function seedCard(overrides: Parameters<typeof createEmptyRateCard>[0] = {}) {
  const card = createEmptyRateCard({ name: 'Contract A', scope: 'ORGANIZATION', ...overrides });
  const config = loadPricingConfig(); config.rateCards = [card]; savePricingConfig(config); return card;
}
async function select(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label })); await user.click(screen.getByRole('option', { name: option }));
}
test('four destinations put company, dispatch, Accessorials and invoicing in their intended homes', async () => {
  const props = { onBackToMonitor: noop, onNavigateSettings: noop };
  assert.deepEqual(SETTINGS_AREAS.map(area => area.label), ['Company', 'Services & Dispatch', 'Pricing', 'Billing']);
  const company = render(React.createElement(CompanySettingsPage, props)); assert.equal(screen.queryByRole('tab'), null); assert.ok(screen.getByRole('combobox', { name: 'Organization timezone' })); assert.equal(screen.queryByLabelText('Driver Cost / hour'), null); assert.equal(screen.queryByLabelText('Quote Validity'), null); company.unmount();
  const service = render(React.createElement(PricingServicesPage, props));
  assert.equal(screen.queryByRole('navigation', { name: 'Organization settings' }), null); assert.equal(screen.queryByRole('tab'), null);
  assert.ok(screen.getByRole('heading', { name: 'Vehicle types' })); assert.ok(screen.getByRole('heading', { name: 'Services' })); assert.ok(screen.getByLabelText('Maximum Active Orders per Driver')); assert.equal(screen.queryByRole('heading', { name: 'Accessorials' }), null); assert.equal(screen.queryByLabelText('Driver Cost / hour'), null); service.unmount();
  const billing = render(React.createElement(BillingSettingsPage, props)); assert.equal(screen.queryByRole('navigation'), null); assert.ok(screen.getByRole('tab', { name: 'Invoicing', selected: true })); assert.ok(screen.getByRole('combobox', { name: 'Default payment terms' })); assert.equal(screen.queryByRole('tab', { name: 'Operating Costs' }), null); assert.equal(screen.queryByRole('combobox', { name: 'Organization timezone' }), null); assert.equal(screen.queryByLabelText('Maximum Active Orders per Driver'), null); assert.equal(screen.queryByLabelText('Fuel Surcharge'), null); billing.unmount();
  render(React.createElement(RateCardsPage, props)); await userEvent.setup({ document }).click(screen.getByRole('tab', { name: 'Rate Cards' })); assert.equal(screen.queryByRole('button', { name: 'Duplicate' }), null); assert.equal(screen.queryByRole('button', { name: 'Archive' }), null); assert.equal(screen.queryByRole('navigation'), null); assert.equal(screen.queryByRole('heading', { name: 'Accessorials' }), null); assert.ok(screen.getByRole('tab', { name: 'Accessorials' })); assert.ok(screen.getByRole('button', { name: 'Add rate card' })); assert.ok(screen.getByRole('complementary', { name: 'Rate cards' })); assert.ok(screen.getByRole('region', { name: 'Rate card editor' }));
});
test('new cards choose one method, do not persist before Save, and cancelled drafts leave no records', async () => {
  const user = userEvent.setup({ document }); seedCard(); const before = loadPricingConfig();
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  await user.click(screen.getByRole('combobox', { name: 'Filter pricing method' })); assert.equal(screen.queryByRole('option', { name: 'Imported price' }), null); await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Add rate card' }));
  assert.deepEqual(loadPricingConfig(), before);
  await user.click(screen.getByRole('combobox', { name: 'Pricing method' })); assert.equal(screen.queryByRole('option', { name: 'Imported price' }), null); assert.ok(screen.getByRole('option', { name: 'Fixed per delivery' })); await user.keyboard('{Escape}');
  assert.equal(screen.getByLabelText('Minimum Charge').closest('.grid'), screen.getByLabelText('Rate card name').closest('.grid'));
  await select(user, 'Pricing method', 'Fixed per delivery'); assert.ok(screen.getByLabelText('Fixed Amount per Delivery')); assert.equal(screen.queryByLabelText('Base Fee'), null);
  await user.click(screen.getByRole('button', { name: 'Cancel' })); assert.deepEqual(loadPricingConfig(), before);
  await user.click(screen.getByRole('button', { name: 'Add rate card' })); await select(user, 'Pricing method', 'Fixed per delivery');
  await user.clear(screen.getByLabelText('Rate card name')); await user.type(screen.getByLabelText('Rate card name'), 'Local fixed'); await user.clear(screen.getByLabelText('Fixed Amount per Delivery')); await user.type(screen.getByLabelText('Fixed Amount per Delivery'), '42');
  await user.click(screen.getByRole('button', { name: 'Save Card' })); const saved = loadPricingConfig().rateCards.find(card => card.name === 'Local fixed')!; assert.equal(saved.fixedAmount, 42); assert.equal(saved.pricingMethod, 'FIXED'); assert.equal(saved.version, 1); assert.equal(screen.queryByRole('combobox', { name: 'Pricing method' }), null);
});
test('stored background contract exceptions are normalised on load; editing keeps the discount and unrelated billing data', async () => {
  const original = seedCard({ fuelPercent: 0, waitFreeMinutes: 0, minimumOrderSubtotal: 0, applyAdminFee: false, accessorialRateOverrides: { acc_stairs: 0 }, discount: { type: 'NONE', value: 0, scope: 'SUBTOTAL' } });
  const billing = loadBillingConfig(); saveBillingConfig(billing); const user = userEvent.setup({ document }); render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByText('Additional settings'), null); assert.deepEqual([...document.querySelectorAll('details summary')].map(el => el.textContent!.split('Example')[0].trim()), ['Pricing formula']); assert.equal(screen.queryByRole('note'), null);
  for (const hidden of ['Code', 'Applies to', 'Customer', 'Service restriction', 'Status', 'Vehicle restriction', 'Priority', 'Effective From', 'Effective To', 'Currency', 'Notes', 'Minimum Freight', 'Fuel Surcharge', 'Included Pieces', 'Wait-Free Allowance']) assert.equal(screen.queryByLabelText(hidden), null, hidden);
  await user.clear(screen.getByLabelText('Base Fee')); await user.type(screen.getByLabelText('Base Fee'), '27'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const saved = loadPricingConfig().rateCards[0];
  assert.deepEqual({ ...original, ...RATE_CARD_BACKGROUND_DEFAULTS, baseFee: 27, code: 'CONTRACT-A', discount: { ...original.discount, scope: 'TRANSPORT_ONLY' }, version: original.version + 2, updatedAt: saved.updatedAt }, saved);
  assert.equal(saved.discount.type, 'NONE'); assert.equal(saved.minimumOrderSubtotal, 0); assert.deepEqual(loadBillingConfig(), billing);
  assert.equal(rateCardCode(' Pacific Fresh — 2026 '), 'PACIFIC-FRESH-2026'); assert.equal(rateCardCode(''), 'CARD');
});
test('hourly and zone cards show required method terms without exposing other methods', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'HOURLY' }); const page = render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' }));
  const terms = screen.getAllByRole('checkbox', { name: /Billable clock|Includes|Settled/ }); assert.equal(terms.length, 5); assert.ok(terms.every(box => (box as HTMLInputElement).checked && (box as HTMLInputElement).disabled)); assert.ok(screen.getByRole('checkbox', { name: 'Billable clock starts: Arrival at first pickup' })); assert.equal(screen.queryByRole('textbox', { name: /Billable clock/ }), null); assert.equal(terms[0].closest('details'), null); assert.equal(screen.queryByLabelText('Base Fee'), null); page.unmount();
  seedCard({ pricingMethod: 'ZONE', zoneMatrixMode: 'CONTRACT', zoneNoMatchFallback: 'NEEDS_ATTENTION' }); render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.equal(screen.queryByRole('combobox', { name: 'Zone prices' }), null); assert.equal(screen.queryByRole('checkbox', { name: /organization rates/ }), null); const zoneSection = screen.getByRole('table', { name: 'Zone prices' }).closest('details')!; assert.equal(zoneSection.open, false); assert.match(zoneSection.textContent!, /0 of 36 pickup → delivery pairs priced/); await user.click(screen.getByText('Zone to zone rates')); assert.equal(zoneSection.open, true); assert.equal(screen.queryByRole('combobox', { name: 'Zone no-match fallback' }), null); assert.equal(screen.queryByLabelText('Base Fee'), null); assert.equal(screen.queryByLabelText('Hourly Rate'), null);
});
test('unsaved card navigation can be cancelled without losing changes', async () => {
  const user = userEvent.setup({ document }); seedCard(); const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', status: 'ACTIVE', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config); render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); await user.type(screen.getByLabelText('Rate card name'), ' edited'); window.confirm = () => false;
  assert.equal(window.dispatchEvent(new Event(SETTINGS_NAVIGATION_EVENT, { cancelable: true })), false); await user.click(screen.getByRole('button', { name: 'Add rate card' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A');
  await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A edited'); window.confirm = () => true; await user.click(screen.getByRole('button', { name: 'Contract B' })); assert.equal((screen.getByLabelText('Fixed Amount per Delivery') as HTMLInputElement).value, '55'); assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
});
test('dispatch save merges its change without reverting billing or pricing defaults', async () => {
  const user = userEvent.setup({ document }); render(React.createElement(BillingSettingsForm, { section: 'dispatch' })); await user.clear(screen.getByLabelText('Maximum Active Orders per Driver')); await user.type(screen.getByLabelText('Maximum Active Orders per Driver'), '8');
  const other = loadBillingConfig(); other.fuelSurcharge.percent = 17; other.general.timeZone = 'America/Toronto'; saveBillingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save dispatch rules' })); const saved = loadBillingConfig(); assert.equal(saved.dispatch.maxActiveOrdersPerDriver, 8); assert.equal(saved.fuelSurcharge.percent, 17); assert.equal(saved.general.timeZone, 'America/Toronto');
});
test('Services & Dispatch edits multipliers alongside service details and preserves other catalogue sections', async () => {
  const config = loadSimplePricingConfig(); config.services[0].defaultMultiplier = 0; saveSimplePricingConfig(config);
  const service = config.services[0]; const user = userEvent.setup({ document });
  render(React.createElement(PricingServicesPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: `Edit ${service.name}` }));
  assert.equal((screen.getByLabelText('Default price multiplier') as HTMLInputElement).value, '0');
  await user.type(screen.getByLabelText('Service name'), ' Updated');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].defaultMultiplier, 0);
  await user.click(screen.getByRole('button', { name: `Edit ${service.name} Updated` }));
  await user.clear(screen.getByLabelText('Default price multiplier'));
  await user.type(screen.getByLabelText('Default price multiplier'), '1.5');
  const other = loadSimplePricingConfig(); other.accessorials[0].rate = 123; saveSimplePricingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  assert.equal(loadSimplePricingConfig().services[0].defaultMultiplier, 1.5);
  assert.equal(loadSimplePricingConfig().accessorials[0].rate, 123);
  assert.ok(within(screen.getByRole('row', { name: new RegExp(`${service.name} Updated`) })).getByText('1.5×'));
  await user.click(screen.getByRole('button', { name: `Edit ${service.name} Updated` }));
  assert.equal((screen.getByLabelText('Default price multiplier') as HTMLInputElement).value, '1.5');
});
test('new services default to 1x and reject blank or negative multipliers', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(PricingServicesPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'Add Service' }));
  assert.equal((screen.getByLabelText('Default price multiplier') as HTMLInputElement).value, '1');
  await user.type(screen.getByLabelText('Service name'), 'Custom service');
  const before = loadSimplePricingConfig().services.length;
  for (const invalid of ['', '-1']) {
    await user.clear(screen.getByLabelText('Default price multiplier'));
    if (invalid) await user.type(screen.getByLabelText('Default price multiplier'), invalid);
    await user.click(screen.getByRole('button', { name: 'Create Service' }));
    assert.equal(loadSimplePricingConfig().services.length, before);
  }
  await user.clear(screen.getByLabelText('Default price multiplier'));
  await user.type(screen.getByLabelText('Default price multiplier'), '1.25');
  await user.click(screen.getByRole('button', { name: 'Create Service' }));
  assert.equal(loadSimplePricingConfig().services.find(service => service.name === 'Custom service')!.defaultMultiplier, 1.25);
});
test('Accessorial edit shows charge limits inline and saves only its catalogue section', async () => {
  const config = loadSimplePricingConfig(); const acc = config.accessorials[0]; acc.minimumCharge = 0; acc.maximumCharge = 99; saveSimplePricingConfig(config); const user = userEvent.setup({ document }); render(React.createElement(CatalogueSection, { section: 'accessorials' })); await user.click(screen.getByRole('button', { name: `Edit ${acc.name}` })); assert.equal(document.querySelector('details'), null); assert.equal((screen.getByLabelText('Minimum charge') as HTMLInputElement).value, '0'); assert.equal((screen.getByLabelText('Maximum charge') as HTMLInputElement).value, '99'); assert.equal(screen.queryByLabelText('Code'), null); await user.clear(screen.getByLabelText('Accessorial rate')); await user.type(screen.getByLabelText('Accessorial rate'), '12');
  const other = loadSimplePricingConfig(); other.services[0].description = 'Concurrent service edit'; saveSimplePricingConfig(other); await user.click(screen.getByRole('button', { name: 'Save Changes' })); const saved = loadSimplePricingConfig(); assert.equal(saved.accessorials[0].rate, 12); assert.equal(saved.accessorials[0].minimumCharge, 0); assert.equal(saved.accessorials[0].maximumCharge, 99); assert.equal(saved.services[0].description, 'Concurrent service edit');
});
test('existing imported cards remain editable with their agreed-total treatment', async () => {
  const user = userEvent.setup({ document }); seedCard({ pricingMethod: 'IMPORTED', importedPriceMode: 'FINAL_TOTAL' }); render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' })); await user.click(screen.getByRole('button', { name: 'Contract A' })); assert.ok(screen.getByRole('combobox', { name: 'Imported amount means' })); assert.equal(screen.getByRole('combobox', { name: 'Imported amount means' }).closest('details'), null); await user.type(screen.getByLabelText('Rate card name'), ' renewed'); await user.click(screen.getByRole('button', { name: 'Save Card' })); assert.equal(loadPricingConfig().rateCards[0].importedPriceMode, 'FINAL_TOTAL');
});

test('billing tabs keep edits across panels, support keyboard navigation, and save together', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(BillingSettingsPage, { onBackToMonitor: noop }));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Invoicing', 'Taxes']);
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  await user.clear(screen.getByLabelText('Quote Validity')); await user.type(screen.getByLabelText('Quote Validity'), '21');
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  assert.equal(screen.queryByLabelText('Quote Validity'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Company tax details' }), null); assert.equal(screen.queryByRole('button', { name: 'Add Profile' }), null);
  assert.equal(screen.queryByLabelText('Tax Registration Number'), null);
  assert.match(screen.getByText(/GST\/HST is added to the subtotal/).textContent!, /delivery province/);
  assert.equal(screen.queryByRole('checkbox', { name: /Quoted prices already include tax/ }), null);
  const rates = within(screen.getByRole('table', { name: 'Default destination tax rates' }));
  assert.equal(rates.getAllByRole('row').length, 14);
  assert.equal((rates.getByRole('spinbutton', { name: 'Ontario tax rate' }) as HTMLInputElement).value, '13');
  assert.equal((rates.getByRole('spinbutton', { name: 'British Columbia tax rate' }) as HTMLInputElement).value, '5');
  assert.match(rates.getByRole('row', { name: /Quebec/ }).textContent!, /GST \+ QSTReview required/);
  await user.clear(screen.getByRole('spinbutton', { name: 'Ontario tax rate' })); await user.type(screen.getByRole('spinbutton', { name: 'Ontario tax rate' }), '12');
  await user.click(screen.getByRole('tab', { name: 'Invoicing' }));
  assert.equal((screen.getByLabelText('Quote Validity') as HTMLInputElement).value, '21');
  await user.keyboard('{ArrowRight}'); assert.equal(screen.getByRole('tab', { name: 'Taxes' }).getAttribute('aria-selected'), 'true');
  assert.equal((screen.getByRole('spinbutton', { name: 'Ontario tax rate' }) as HTMLInputElement).value, '12');
  await user.click(screen.getByRole('button', { name: 'Save billing' }));
  const saved = loadBillingConfig(); assert.equal(saved.invoicing.quoteValidityDays, 21); assert.equal(saved.destinationTaxRates.ON, 12);
});

test('Company saves details, tax number and time zone without touching billing; Pricing → Vehicle & Labour Costs saves operating costs', async () => {
  const user = userEvent.setup({ document });
  const company = render(React.createElement(CompanySettingsPage, { onBackToMonitor: noop }));
  await user.clear(screen.getByLabelText('Company name')); await user.type(screen.getByLabelText('Company name'), 'Pacific Couriers');
  await user.type(screen.getByLabelText('Company address'), '100 Main St, Vancouver'); await user.type(screen.getByLabelText('Company phone'), '604-555-0100'); await user.type(screen.getByLabelText('Company email'), 'billing@pacific.test');
  await user.type(screen.getByLabelText('Tax Registration Number'), 'REG-123');
  await select(user, 'Organization timezone', 'Toronto');
  const other = loadBillingConfig(); other.invoicing.quoteValidityDays = 21; saveBillingConfig(other);
  await user.click(screen.getByRole('button', { name: 'Save company settings' }));
  let saved = loadBillingConfig(); assert.equal(saved.general.timeZone, 'America/Toronto'); assert.equal(saved.invoicing.quoteValidityDays, 21);
  assert.deepEqual(saved.company, { name: 'Pacific Couriers', address: '100 Main St, Vancouver', phone: '604-555-0100', email: 'billing@pacific.test', logoDataUrl: '' }); assert.equal(saved.invoicing.taxRegistrationNumber, 'REG-123');
  assert.ok(screen.getByRole('button', { name: 'Upload company logo' })); company.unmount();
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Vehicle & Labour Costs' }));
  assert.equal(screen.queryByText(/Per vehicle class/i), null);
  await user.clear(screen.getByLabelText('Driver Cost / hour')); await user.type(screen.getByLabelText('Driver Cost / hour'), '44');
  await user.click(screen.getByRole('button', { name: 'Save vehicle & labour costs' }));
  saved = loadBillingConfig(); assert.equal(saved.operatingCost.driverCostPerHour, 44); assert.equal(saved.general.timeZone, 'America/Toronto');
});

test('province rate drafts save decimals and zero, survive reload and validate across tabs', async () => {
  const user = userEvent.setup({ document });
  const props = { onBackToMonitor: noop };
  const view = render(React.createElement(BillingSettingsPage, props));
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  await user.clear(screen.getByRole('spinbutton', { name: 'Ontario tax rate' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Ontario tax rate' }), '12.75');
  await user.clear(screen.getByRole('spinbutton', { name: 'British Columbia tax rate' }));
  await user.type(screen.getByRole('spinbutton', { name: 'British Columbia tax rate' }), '0');
  assert.equal(loadBillingConfig().destinationTaxRates.ON, undefined);
  await user.click(screen.getByRole('button', { name: 'Save billing' }));
  assert.deepEqual(loadBillingConfig().destinationTaxRates, { ON: 12.75, BC: 0 });
  view.unmount(); render(React.createElement(BillingSettingsPage, props));
  await user.click(screen.getByRole('tab', { name: 'Taxes' }));
  assert.equal((screen.getByRole('spinbutton', { name: 'Ontario tax rate' }) as HTMLInputElement).value, '12.75');
  assert.equal((screen.getByRole('spinbutton', { name: 'British Columbia tax rate' }) as HTMLInputElement).value, '0');
  for (const invalid of ['', '-1', '101']) {
    await user.clear(screen.getByRole('spinbutton', { name: 'Ontario tax rate' }));
    if (invalid) await user.type(screen.getByRole('spinbutton', { name: 'Ontario tax rate' }), invalid);
    await user.click(screen.getByRole('tab', { name: 'Invoicing' }));
    await user.click(screen.getByRole('button', { name: 'Save billing' }));
    assert.match(screen.getByRole('alert').textContent!, /0 to 100%/);
    assert.equal(loadBillingConfig().destinationTaxRates.ON, 12.75);
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
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Vehicle & Labour Costs' }));
  assert.equal(screen.queryByText(/Margin Target/i), null);
  assert.equal(screen.queryByLabelText('Target Estimated Margin'), null);
  assert.equal((screen.getByLabelText('Driver Cost / hour') as HTMLInputElement).value, '42');
});

test('pricing-method filter sits in the editor header and still filters the card list', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig();
  config.rateCards.push(createEmptyRateCard({ name: 'Fixed contract', status: 'ACTIVE', pricingMethod: 'FIXED' })); savePricingConfig(config);
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
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
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Rate Cards', 'Zones', 'Accessorials', 'Extras', 'Vehicle & Labour Costs']);
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  await user.type(screen.getByLabelText('Rate card name'), ' draft');
  await user.click(screen.getByRole('tab', { name: 'Extras' }));
  assert.equal(screen.queryByRole('button', { name: 'Save Card' }), null);
  const fuel = screen.getByLabelText('Default Fuel Surcharge');
  await user.clear(fuel); await user.type(fuel, '17');
  await user.click(screen.getByRole('tab', { name: 'Accessorials' }));
  assert.ok(screen.getByRole('heading', { name: 'Accessorials' }));
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  await user.keyboard('{End}');
  assert.equal(screen.getByRole('tab', { name: 'Vehicle & Labour Costs' }).getAttribute('aria-selected'), 'true');
  await user.keyboard('{Home}');
  assert.ok(screen.getByRole('tab', { name: 'Rate Cards', selected: true }));
  assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, 'Contract A draft');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.equal(loadPricingConfig().rateCards[0].name, 'Contract A draft');
  await user.click(screen.getByRole('tab', { name: 'Extras' }));
  assert.equal((screen.getByLabelText('Default Fuel Surcharge') as HTMLInputElement).value, '17');
  await user.click(screen.getByRole('button', { name: 'Save extras' }));
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 17);
  assert.ok(screen.getByRole('spinbutton', { name: 'Dimensional Divisor' })); assert.ok(screen.getByRole('spinbutton', { name: 'Extra Stop Charge' }));
  assert.equal(screen.queryByRole('tab', { name: 'Vehicle Pricing' }), null); assert.equal(screen.queryByRole('tab', { name: 'Surcharges' }), null); assert.equal(screen.queryByRole('tab', { name: 'Stops & Weight' }), null);
  await user.click(screen.getByRole('tab', { name: 'Zones' }));
  assert.ok(screen.getByRole('button', { name: 'Add Zone' }));
});

test('customer groups are absent from Pricing tabs and the customer form attaches any active card', async () => {
  const user = userEvent.setup({ document }); seedCard();
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Rate Cards' }));
  assert.equal(screen.queryByRole('tab', { name: 'Customer Groups' }), null);
  assert.equal(screen.queryByRole('combobox', { name: 'Applies to' }), null);
  cleanup();
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { normalizeCustomer, DEFAULT_CUSTOMERS } = await import('../src/lib/customerStorage');
  assert.equal(normalizeCustomer({ ...DEFAULT_CUSTOMERS[0], customerGroupId: 'old-group' }).customerGroupId, undefined);
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Customer' }));
  assert.equal(screen.queryByRole('combobox', { name: 'Customer group' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Customer rate card' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['Contract A (Default)']); assert.equal(screen.queryByRole('option', { name: /^Default \(/ }), null);
});

test('Extras omits retired rounding and minimum controls', async () => {
  const config = loadBillingConfig();
  Object.assign(config.rules, { moneyRounding: 'nearest_1', distanceRoundingKm: 1, minimumBillableKm: 3 });
  saveBillingConfig(config);
  assert.deepEqual(loadBillingConfig().rules, { minimumChargePerJob: config.rules.minimumChargePerJob, minimumBillableKm: 0 });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  await userEvent.setup({ document }).click(screen.getByRole('tab', { name: 'Extras' }));
  assert.equal(screen.queryByRole('combobox', { name: /rounding/i }), null);
  assert.equal(screen.queryByLabelText('Minimum Billable Distance'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Minimums' }), null);
});

test('rate cards expose a saved minimum charge with zero to disable it', async () => {
  const user = userEvent.setup({ document });
  seedCard({ minimumOrderSubtotal: 25 });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
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

test('rate cards show a Default badge, can be re-defaulted and archived from the footer, and the Default cannot be archived', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config);
  const notices: string[] = [];
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop, onNotification: message => notices.push(message) }));
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
  await user.click(screen.getByRole('button', { name: 'Add rate card' }));
  await user.type(screen.getByLabelText('Rate card name'), ' C'); await user.click(screen.getByRole('button', { name: 'Save Card' }));
  const created = loadPricingConfig().rateCards.find(card => card.name === 'New Rate Card C')!;
  assert.equal(created.status, 'ACTIVE'); assert.equal(created.scope, 'ORDER'); assert.equal(created.serviceId, null); assert.equal(created.applyServiceMultiplier, true);
});

test('zone prices are one amount per origin and destination', async () => {
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig();
  config.zoneRates = [{ id: 'a', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: 'srv_rush', amount: 80 }, { id: 'b', originZoneId: 'zone_van', destinationZoneId: 'zone_bby', serviceId: null, amount: 45 }, { id: 'c', originZoneId: 'zone_bby', destinationZoneId: 'zone_van', serviceId: 'srv_rush', amount: 70 }];
  savePricingConfig(config);
  assert.deepEqual(loadPricingConfig().zoneRates.map(rate => [rate.originZoneId, rate.destinationZoneId, rate.serviceId, rate.amount]), [['zone_van', 'zone_bby', null, 45], ['zone_bby', 'zone_van', null, 70]]);
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Zones' }));
  assert.equal(screen.queryByLabelText('Zone code'), null); assert.equal(screen.queryByRole('combobox', { name: /zone/i }), null); assert.equal(screen.queryByRole('button', { name: 'Add zone price' }), null);
  const grid = within(screen.getByRole('table', { name: 'Zone prices' }));
  assert.equal(grid.getAllByRole('spinbutton').length, 36);
  assert.equal((grid.getByRole('spinbutton', { name: 'Vancouver to Burnaby / New West price' }) as HTMLInputElement).value, '45');
  assert.equal((grid.getByRole('spinbutton', { name: 'Vancouver to Richmond / YVR price' }) as HTMLInputElement).value, '');
  assert.equal(grid.getAllByRole('spinbutton').filter(input => (input as HTMLInputElement).value !== '').length, 2);
  await user.type(grid.getByRole('spinbutton', { name: 'Vancouver to Richmond / YVR price' }), '52');
  await user.clear(grid.getByRole('spinbutton', { name: 'Burnaby / New West to Vancouver price' }));
  const saved = loadPricingConfig().zoneRates.map(rate => [rate.originZoneId, rate.destinationZoneId, rate.amount]);
  assert.deepEqual(saved.filter(([o, d]) => o === 'zone_van' && d === 'zone_rmd'), [['zone_van', 'zone_rmd', 52]]); assert.equal(saved.some(([o, d]) => o === 'zone_bby' && d === 'zone_van'), false);
  await user.type(screen.getAllByLabelText('Zone name')[0], ' East');
  assert.equal(loadPricingConfig().zones[0].code, 'VANCOU'); assert.ok(grid.getByRole('spinbutton', { name: 'Vancouver East to Burnaby / New West price' }));
});

test('account menu lists the four settings destinations inline and highlights the open one', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = userEvent.setup({ document }); const visited: string[] = [];
  const props = { isOpen: true, onToggle: noop, setActiveTab: noop, showAccountPopover: true, setShowAccountPopover: noop, onActionNotification: noop, dispatchMode: 'AUTO' as const, onDispatchModeChange: noop, onNavigateSettings: (area: string) => visited.push(area) };
  const closed = render(React.createElement(Sidebar, { ...props, activeTab: 'monitor' }));
  const trigger = screen.getByRole('button', { name: 'Organization Settings' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false'); assert.equal(screen.queryByRole('button', { name: 'Pricing' }), null);
  await user.click(trigger);
  assert.deepEqual(['Company', 'Services & Dispatch', 'Pricing', 'Billing'].map(label => screen.getAllByRole('button', { name: label }).length), [1, 1, 1, 1]);
  await user.click(screen.getByRole('button', { name: 'Billing' })); assert.deepEqual(visited, ['billing']);
  closed.unmount();
  render(React.createElement(Sidebar, { ...props, activeTab: 'rate-cards', activeSettingsArea: 'pricing' }));
  assert.equal(screen.getByRole('button', { name: 'Organization Settings' }).getAttribute('aria-expanded'), 'true');
  assert.equal(screen.getByRole('button', { name: 'Pricing' }).getAttribute('aria-current'), 'page');
  assert.equal(screen.getByRole('button', { name: 'Company' }).getAttribute('aria-current'), null);
});

test('vehicle types carry their internal running cost, stored with operating costs and never in the customer price', async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(PricingServicesPage, { onBackToMonitor: noop }));
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


test('surcharge customer labels are fixed; calculation controls remain', async () => {
  const stored = loadBillingConfig(); stored.serviceCharge.label = 'Admin'; stored.serviceCharge.basis = 'transport_only'; stored.serviceCharge.mode = 'greater_of'; stored.fuelSurcharge.label = 'Diesel'; saveBillingConfig(stored);
  assert.deepEqual([loadBillingConfig().serviceCharge.label, loadBillingConfig().serviceCharge.basis, loadBillingConfig().serviceCharge.mode, loadBillingConfig().fuelSurcharge.label], ['Service Fee', 'transport_and_accessorials', 'percentage', 'Fuel Surcharge']);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Extras' }));
  assert.equal(screen.queryByLabelText('Label Shown to Customer'), null); assert.equal(screen.queryByRole('combobox', { name: 'Service charge basis' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Service charge method' })); assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['Percentage', 'Flat amount per order']); await user.click(screen.getByRole('option', { name: 'Flat amount per order' }));
  assert.ok(screen.getByRole('spinbutton', { name: 'Flat Amount' })); assert.equal(screen.queryByRole('spinbutton', { name: 'Percentage' }), null);
  assert.ok(screen.getByRole('combobox', { name: 'Fuel surcharge mode' })); assert.ok(screen.getByLabelText('Default Fuel Surcharge'));
});

test('service fee is enabled by default for a new organization', () => {
  assert.equal(loadBillingConfig().serviceCharge.enabled, true); assert.equal(loadBillingConfig().serviceCharge.mode, 'percentage'); assert.equal(loadBillingConfig().serviceCharge.percent, 5);
});

test('waiting allowance and increment belong to the Waiting accessorial; older records are back-filled', async () => {
  const seeded = loadSimplePricingConfig().accessorials.find(a => a.autoRule === 'WAITING_RECORDED')!;
  assert.deepEqual([seeded.freeAllowance, seeded.incrementMinutes], [15, 5]);
  saveSimplePricingConfig({ ...loadSimplePricingConfig(), accessorials: loadSimplePricingConfig().accessorials.map(a => a.id === seeded.id ? { ...a, freeAllowance: null, incrementMinutes: null } : a) });
  const restored = loadSimplePricingConfig().accessorials.find(a => a.id === seeded.id)!;
  assert.deepEqual([restored.freeAllowance, restored.incrementMinutes], [15, 5]);
  assert.equal('defaultWaitFreeMinutes' in loadBillingConfig().general, false);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Extras' }));
  assert.equal(screen.queryByLabelText('Default Wait-Free Allowance'), null); assert.equal(screen.queryByLabelText('Default Wait Increment'), null);
  assert.ok((screen.getByRole('checkbox', { name: /greater of actual or dimensional/ }) as HTMLInputElement).checked);
  assert.ok(screen.getByRole('spinbutton', { name: 'Dimensional Divisor' })); assert.ok(screen.getByRole('spinbutton', { name: 'Included Stops' })); assert.ok(screen.getByRole('spinbutton', { name: 'Extra Stop Charge' }));
});

test('Vehicle & Labour Costs keeps four fields; per-stop consumables are pinned to zero', async () => {
  const stored = loadBillingConfig(); stored.operatingCost.fixedCostPerStop = 2.4; saveBillingConfig(stored);
  assert.equal(loadBillingConfig().operatingCost.fixedCostPerStop, 0);
  const user = userEvent.setup({ document });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop })); await user.click(screen.getByRole('tab', { name: 'Vehicle & Labour Costs' }));
  assert.equal(screen.queryByLabelText('Fixed Cost per Stop'), null);
  for (const label of ['Default Cost / km', 'Driver Cost / hour', 'Driver Time per Stop', 'Overhead Share']) assert.ok(screen.getByRole('spinbutton', { name: label }), label);
  assert.equal(screen.getAllByRole('spinbutton').length, 4);
});

test('rate card discount offers None / Percentage / Fixed with no scope selector; customer form has no discount', async () => {
  const user = userEvent.setup({ document }); seedCard();
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  assert.equal(screen.queryByRole('combobox', { name: 'Discount scope' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Discount type' }));
  assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['No discount', 'Percentage', 'Fixed amount']);
  await user.click(screen.getByRole('option', { name: 'Percentage' }));
  await user.clear(screen.getByRole('spinbutton', { name: 'Percentage' })); await user.type(screen.getByRole('spinbutton', { name: 'Percentage' }), '12.5');
  await user.click(screen.getByRole('button', { name: 'Save Card' }));
  assert.deepEqual(loadPricingConfig().rateCards[0].discount, { type: 'PERCENT', value: 12.5, scope: 'TRANSPORT_ONLY' });
  cleanup();
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  render(React.createElement(CustomersPage, { onBackToMonitor: noop }));
  await user.click(screen.getByRole('button', { name: 'New Customer' }));
  assert.equal(screen.queryByRole('combobox', { name: 'Discount type' }), null); assert.equal(screen.queryByText('Contract Discount'), null);
});

test('My Profile holds only personal fields; organization name, time zone, hub and logo live in settings', async () => {
  const { ProfilePage } = await import('../src/pages/ProfilePage');
  const { loadUserProfile, PROFILE_STORAGE_KEY } = await import('../src/lib/profileStorage');
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Sam', organization: 'Old Org', hub: 'Old Hub', timezone: 'America/Toronto', orgLogoUrl: 'data:image/png;base64,x' }));
  const profile = loadUserProfile() as unknown as Record<string, unknown>;
  assert.equal(profile.name, 'Sam'); for (const gone of ['organization', 'hub', 'timezone', 'orgLogoUrl', 'organizationId']) assert.equal(gone in profile, false, gone);
  const user = userEvent.setup({ document });
  const page = render(React.createElement(ProfilePage, { onBackToMonitor: noop }));
  assert.ok(screen.getByRole('heading', { name: 'Contact Information' }));
  for (const gone of ['Organization', 'Timezone', 'Active Operating Origin / Dispatch Hub', 'Organization & Hub Logo']) assert.equal(screen.queryByText(gone), null, gone);
  page.unmount();
  render(React.createElement(PricingServicesPage, { onBackToMonitor: noop }));
  await user.clear(screen.getByLabelText('Dispatch hub')); await user.type(screen.getByLabelText('Dispatch hub'), '200 Depot Rd');
  await user.click(screen.getByRole('button', { name: 'Save dispatch rules' }));
  assert.equal(loadBillingConfig().dispatch.hubAddress, '200 Depot Rd');
});

test('every rate card ends with a worked pricing example computed by the engine; zone cards have no Pricing terms', async () => {
  const user = userEvent.setup({ document }); seedCard({ baseFee: 20, includedKm: 5, kmRate: 1.5, minimumOrderSubtotal: 35, discount: { type: 'PERCENT', value: 10, scope: 'TRANSPORT_ONLY' } });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  const values = () => Object.fromEntries([...screen.getByLabelText('Pricing values').querySelectorAll('dt')].map(term => [term.textContent!.replace(/ =$/, ''), term.nextElementSibling!.firstElementChild!.textContent!]));
  const section = screen.getByText('Pricing formula').closest('details')!; assert.equal(section.open, false); assert.match(section.textContent!, /Example order \(12 km, 3 stops, Rush Expedited.*\) totals \$[\d.]+ on this card/);
  let v = values();
  assert.match(screen.getByLabelText('Pricing values').textContent!, /Base fee covers the first 5 km/); assert.match(screen.getByLabelText('Pricing values').textContent!, /negotiated discount, taken off freight/);
  assert.equal(v['Base freight'], '$20.00 + (12 − 5 km) × $1.50 = $30.50'); assert.equal(v['Service multiplier'], 'Rush Expedited (2-Hour) ×1.3');
  assert.equal(v['Extra stops'], '(3 − 2) × $10.00 = $10.00'); assert.match(v['Vehicle surcharge'], /2 Tonne.*= \$25\.00/); assert.match(v['Accessorials'], /^Stair Carry ×2 \$10\.00 \+ .* = \$/);
  assert.match(v['Fuel surcharge'], /^8% × \$[\d.]+ = \$[\d.]+$/); assert.match(v['Service fee'], /^5% × \$[\d.]+ = \$[\d.]+$/); assert.match(v['Discount'], /^10% × \$[\d.]+ = −\$[\d.]+$/); assert.equal(v['Minimum charge'], '$35.00'); assert.match(v['Tax'], /BC 5%/);
  const formula = screen.getByLabelText('Pricing formula').textContent!;
  assert.match(formula, /Freight\s+= \(\$30\.50 \+ \$0\.00 \+ \$10\.00\) × 1\.3 = \$52\.65/); assert.match(v['Packages'], /2 × 20\.0 kg .* actual 40\.0 kg, dimensional 48\.0 kg, chargeable 48\.0 kg/); assert.equal(v['Weight charge'], 'none'); assert.match(formula, /Subtotal\s+= greater of/); const total = formula.match(/Total\s+= .* = (\$[\d.]+)$/m)![1];
  assert.match(screen.getByText(/Example total:/).textContent!, new RegExp(total.replace('$', '\\$').replace('.', '\\.')));
  await user.click(screen.getByRole('combobox', { name: 'Discount type' })); await user.click(screen.getByRole('option', { name: 'No discount' }));
  v = values(); assert.equal(v['Discount'], 'none');
  await user.type(screen.getByLabelText('Included Weight'), '30'); await user.clear(screen.getByLabelText('Weight Rate')); await user.type(screen.getByLabelText('Weight Rate'), '0.5');
  v = values(); assert.equal(v['Weight charge'], '(48.0 kg − 30.0 kg) × $0.50/kg = $9.00'); assert.match(screen.getByLabelText('Pricing formula').textContent!, /\(\$30\.50 \+ \$9\.00 \+ \$10\.00\) × 1\.3/);
  await user.click(screen.getByRole('button', { name: 'Save Card' })); assert.deepEqual([loadPricingConfig().rateCards[0].includedWeightKg, loadPricingConfig().rateCards[0].weightRatePerKg], [30, 0.5]);
  cleanup(); seedCard({ pricingMethod: 'ZONE' });
  render(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  assert.equal(screen.queryByText('Pricing terms'), null); assert.match(screen.getByRole('status').textContent!, /zone/i);
});

test('the standard zone price grid ships empty; the demo zone card keeps its own prices', () => {
  assert.deepEqual(loadPricingConfig().zoneRates, []);
  const demo = loadPricingConfig().rateCards.find(card => card.pricingMethod === 'ZONE')!;
  assert.ok(demo.zoneRates.length > 0); assert.ok(demo.zoneRates.every(rate => rate.amount > 0));
});

test('customer create form is flat and minimal; status appears only on edit and the code is assigned in the background', async () => {
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  const { loadCustomers } = await import('../src/lib/customerStorage');
  const user = userEvent.setup({ document }); const notices: string[] = [];
  render(React.createElement(CustomersPage, { onBackToMonitor: noop, onNotification: (m: string) => notices.push(m) }));
  await user.click(screen.getByRole('button', { name: 'New Customer' }));
  const dialog = screen.getByRole('dialog');
  assert.equal(dialog.querySelector('details'), null);
  for (const gone of ['Account / Code', 'Account Tier', 'Status', 'Default Accessorials / Requirements', 'Legal name', 'Saved locations & delivery defaults', 'Communication preferences']) assert.equal(within(dialog).queryByText(gone), null, gone);
  assert.equal(within(dialog).queryByRole('checkbox', { name: /tax exemption/ }), null); assert.equal(within(dialog).queryByRole('combobox', { name: 'Customer status' }), null);
  assert.ok(within(dialog).getByRole('combobox', { name: 'Customer type' })); assert.ok(within(dialog).getByPlaceholderText('e.g. Elena Rostova')); assert.ok(within(dialog).getByText('Dispatch & Receiving Instructions'));
  await user.type(within(dialog).getByPlaceholderText('e.g. Pacific Fresh Logistics'), 'Harbour Bakery'); await user.type(within(dialog).getByPlaceholderText('e.g. Elena Rostova'), 'Mo Lee');
  await user.click(within(dialog).getByRole('button', { name: /Create|Save|Add/ }));
  const created = loadCustomers().find(c => c.name === 'Harbour Bakery')!;
  assert.match(created.code, /^CUST-\d{4}$/); assert.equal(created.contactName, 'Mo Lee'); assert.equal(created.customerType, 'BUSINESS'); assert.equal(created.status, 'Active');
  await user.click(screen.getAllByTitle('Edit customer account')[0]);
  const edit = screen.getByRole('dialog'); assert.ok(within(edit).getByRole('combobox', { name: 'Customer status' })); assert.equal(within(edit).queryByText('Account / Code'), null);
});

test('custom confirm dialog replaces the browser confirm: archive, discard-changes guard, Escape and cancel', async () => {
  const { ConfirmDialogHost, confirmDialog } = await import('../src/components/ui/ConfirmDialog');
  const user = userEvent.setup({ document }); seedCard();
  const config = loadPricingConfig(); config.rateCards.push(createEmptyRateCard({ id: 'contract-b', name: 'Contract B', pricingMethod: 'FIXED', fixedAmount: 55 })); savePricingConfig(config);
  window.confirm = () => { throw new Error('native confirm must not be used while the host is mounted'); };
  render(React.createElement(React.Fragment, null, React.createElement(ConfirmDialogHost), React.createElement(RateCardsPage, { onBackToMonitor: noop })));
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
