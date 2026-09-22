import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { BILLING_STORAGE_KEY, loadBillingConfig, saveBillingConfig } = await import('../src/lib/billingStorage');
const { CompanySettingsPage } = await import('../src/pages/CompanySettingsPage');
const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
const { VehicleEditor } = await import('../src/components/entities/VehicleEditor');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { loadPricingContext, createDefaultOrderInput, priceOrder } = await import('../src/lib/orderPricing');
const { DimensionalWeightFields } = await import('../src/components/pricing/DimensionalWeightFields');
const { createEmptyRateCard } = await import('../src/lib/pricingStorage');
const { fromDisplayDivisor } = await import('../src/lib/units');
afterEach(() => { cleanup(); localStorage.clear(); });
test('company defaults use pounds and inches while preserving explicit saved units', () => {
  let config = loadBillingConfig();
  assert.deepEqual([config.general.weightUnit, config.general.dimensionUnit, config.general.distanceUnit], ['lb', 'in', 'km']);
  localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify({ company: { name: 'Existing company' }, general: { distanceUnit: 'mi' } }));
  config = loadBillingConfig();
  assert.equal(config.company.name, 'Existing company');
  assert.deepEqual([config.general.weightUnit, config.general.dimensionUnit, config.general.distanceUnit], ['lb', 'in', 'mi']);
  Object.assign(config.general, { weightUnit: 'kg', dimensionUnit: 'cm' });
  saveBillingConfig(config);
  assert.deepEqual([loadBillingConfig().general.weightUnit, loadBillingConfig().general.dimensionUnit], ['kg', 'cm']);
});
test('settings saved before the pound/inch defaults migrate once to lb and in', () => {
  localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify({ company: { name: 'Older save' }, general: { distanceUnit: 'km', weightUnit: 'kg', dimensionUnit: 'cm' } }));
  const config = loadBillingConfig();
  assert.deepEqual([config.general.weightUnit, config.general.dimensionUnit, config.general.distanceUnit], ['lb', 'in', 'km']);
  assert.equal(config.company.name, 'Older save');
  saveBillingConfig(config);
  assert.equal(JSON.parse(localStorage.getItem(BILLING_STORAGE_KEY)!).unitsDefaultVersion, 1);
});
test('Company settings shows the new defaults and keeps a saved metric preference after reload', async () => {
  const user = userEvent.setup({ document });
  let page = render(React.createElement(CompanySettingsPage, {}));
  assert.match(screen.getByRole('combobox', { name: 'Weight unit' }).textContent!, /Pounds/);
  assert.match(screen.getByRole('combobox', { name: 'Dimension unit' }).textContent!, /Inches/);
  assert.match(screen.getByRole('combobox', { name: 'Distance unit' }).textContent!, /Kilometres/);
  for (const [name, option] of [['Weight unit', 'kg — Kilograms'], ['Dimension unit', 'cm — Centimetres']]) {
    await user.click(screen.getByRole('combobox', { name })); await user.click(screen.getByRole('option', { name: option }));
  }
  await user.click(screen.getByRole('button', { name: 'Save Settings' }));
  page.unmount(); page = render(React.createElement(CompanySettingsPage, {}));
  assert.match(screen.getByRole('combobox', { name: 'Weight unit' }).textContent!, /Kilograms/);
  assert.match(screen.getByRole('combobox', { name: 'Dimension unit' }).textContent!, /Centimetres/);
});
test('default order fields accept fractional inches and pounds and store canonical values', async () => {
  const ctx = loadPricingContext();
  const initial = { ...createDefaultOrderInput(ctx), routeKm: 10 };
  let current = initial;
  const original = structuredClone(initial);
  function Form() {
    const [value, setValue] = React.useState(initial);
    return React.createElement(OrderPricingForm, { value, ctx, snapshot: priceOrder(value, ctx), onChange: next => { current = next; setValue(next); } });
  }
  const user = userEvent.setup({ document }); render(React.createElement(Form));
  assert.ok(screen.getByRole('columnheader', { name: 'Weight (lb)' }));
  assert.ok(screen.getByRole('columnheader', { name: 'L × W × H (in)' }));
  const length = screen.getByLabelText('Package 1 length') as HTMLInputElement;
  assert.equal(length.value, '15.7');
  assert.equal(length.validity.stepMismatch, false);
  assert.deepEqual(current, original, 'Displaying converted values must not rewrite stored measurements');
  await user.clear(length); await user.type(length, '12.5');
  const weight = screen.getByLabelText('Package 1 weight') as HTMLInputElement;
  await user.clear(weight); await user.type(weight, '2.5');
  assert.equal(current.packages[0].lengthCm, 31.75);
  assert.equal(current.packages[0].weightKg, 2.5 * 0.45359237);
  assert.equal(length.checkValidity(), true);
  assert.equal(weight.checkValidity(), true);
  const metric = structuredClone(ctx); Object.assign(metric.billing.general, { weightUnit: 'kg', dimensionUnit: 'cm' });
  assert.equal(priceOrder(current, ctx).total, priceOrder(current, metric).total);
  assert.deepEqual(priceOrder(current, ctx).inputs, priceOrder(current, metric).inputs);
});
test('vehicle type limits display in company units and stored cargo dimensions survive an edit', async () => {
  const vehicle = { ...loadVehicles()[0], cargoLengthCm: 254, cargoWidthCm: 127, cargoHeightCm: 101.6 };
  let saved: typeof vehicle | undefined;
  const user = userEvent.setup({ document });
  render(React.createElement(VehicleEditor, { vehicle, vehicles: [vehicle], onCancel: () => {}, onSave: next => { saved = next as typeof vehicle; } }));
  assert.match(screen.getByText(/payload ·/).textContent!, /\blb payload/);
  assert.equal(screen.queryByLabelText(/Cargo length/), null);
  await user.click(screen.getByRole('button', { name: 'Save vehicle' }));
  assert.ok(saved);
  assert.equal(saved.cargoLengthCm, vehicle.cargoLengthCm);
});
test('converted zone dimensional divisors accept fractional values without changing canonical defaults', async () => {
  const units = loadBillingConfig().general;
  let card = createEmptyRateCard({ pricingMethod: 'ZONE', dimensionalDivisor: 5000 });
  function Form() {
    const [draft, setDraft] = React.useState(card);
    return React.createElement(DimensionalWeightFields, { card: draft, units, patch: changes => { card = { ...draft, ...changes }; setDraft(card); } });
  }
  const user = userEvent.setup({ document }); render(React.createElement(Form));
  const field = screen.getByLabelText('Dimensional Divisor') as HTMLInputElement;
  assert.ok(screen.getByText('in³/lb'));
  assert.equal(field.validity.stepMismatch, false);
  assert.equal(card.dimensionalDivisor, 5000);
  await user.clear(field); await user.type(field, '139.5');
  assert.equal(card.dimensionalDivisor, fromDisplayDivisor(139.5, units));
  assert.equal(field.checkValidity(), true);
});

test('zone weight fields use default pounds and preserve weight-price pairing in canonical units', async () => {
  const { ZoneMatrixEditor } = await import('../src/components/pricing/ZoneMatrixEditor');
  const units = loadBillingConfig().general;
  const zones = [{ id: 'a', code: 'A', name: 'Central', postalCodes: ['00501'] }];
  const initial = [{ id: 'aa', originZoneId: 'a', destinationZoneId: 'a', serviceId: null, amount: 40, weightBands: [{ id: 'band', maxWeightKg: 45.359237, amount: 40 }] }];
  let rates = initial;
  function Form() {
    const [draft, setDraft] = React.useState(initial);
    return React.createElement(ZoneMatrixEditor, { rates: draft, zones, units, currency: 'CAD', onChange: next => { rates = next as typeof initial; setDraft(rates); } });
  }
  const user = userEvent.setup({ document }); render(React.createElement(Form));
  const weight = screen.getByLabelText('Central to Central weight limit (lb)') as HTMLInputElement;
  assert.equal(weight.value, '100');
  assert.deepEqual(rates, initial);
  await user.clear(weight); await user.type(weight, '200'); await user.tab();
  assert.equal(rates[0].weightBands[0].maxWeightKg, 200 * 0.45359237);
  assert.equal(rates[0].weightBands[0].amount, 40);
});
