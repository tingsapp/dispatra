import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { normalizeFuelSurcharge, resolveFuelPercent } from '../src/lib/billingEngine';
import { BILLING_STORAGE_KEY, INITIAL_BILLING_CONFIG, loadBillingConfig, saveBillingConfig } from '../src/lib/billingStorage';
import { createDefaultOrderInput, finalizeOrderPrice, priceOrder } from '../src/lib/orderPricing';
import { calculatePricing, PricingContext } from '../src/lib/pricingEngine';
import { createEmptyRateCard } from '../src/lib/pricingStorage';
import { loadSimplePricingConfig } from '../src/lib/simplePricingStorage';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { BillingSettingsForm } = await import('../src/components/settings/BillingSettingsForm');
afterEach(() => { cleanup(); localStorage.clear(); });

const setup = () => {
  const billing = structuredClone(INITIAL_BILLING_CONFIG);
  const card = createEmptyRateCard({ id: 'fuel-card', scope: 'ORGANIZATION', pricingMethod: 'FIXED', fixedAmount: 100, minimumOrderSubtotal: 0, fuelPercent: null, applyFuelSurcharge: true });
  const ctx: PricingContext = { billing, catalogue: structuredClone(loadSimplePricingConfig()), pricing: { rateCards: [card], zones: [], zoneRates: [], customerGroups: [] }, customers: [] };
  const order = createDefaultOrderInput(ctx); order.vehicleId = null; order.packages = []; order.routeKm = 10;
  return { billing, card, ctx, order };
};

test('new fuel settings default to the researched 28.5%, while saved percentages including zero survive', () => {
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 28.5);
  for (const percent of [8, 17.25, 0, 125]) {
    const config = structuredClone(INITIAL_BILLING_CONFIG); config.fuelSurcharge.percent = percent;
    saveBillingConfig(config); const loaded = loadBillingConfig();
    assert.equal(loaded.fuelSurcharge.percent, percent);
    assert.equal(loaded.fuelSurcharge.mode, 'fixed_percent');
    assert.equal(loaded.fuelSurcharge.enabled, percent > 0);
  }
});

test('legacy indexed and disabled fuel settings migrate without changing their effective charge', () => {
  for (const enabled of [true, false]) {
    const stored = structuredClone(INITIAL_BILLING_CONFIG);
    Object.assign(stored.fuelSurcharge, { enabled, mode: 'index_pegged', baselineFuelPrice: 1.5, currentFuelPrice: 1.8, percentPerCentAboveBaseline: 0.5, percent: 8, taxable: false });
    const effective = resolveFuelPercent(stored);
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(stored));
    const before = localStorage.getItem(BILLING_STORAGE_KEY);
    const loaded = loadBillingConfig();
    assert.equal(loaded.fuelSurcharge.percent, effective);
    assert.equal(loaded.fuelSurcharge.mode, 'fixed_percent');
    assert.equal(loaded.fuelSurcharge.taxable, false);
    assert.equal(localStorage.getItem(BILLING_STORAGE_KEY), before);
    saveBillingConfig(loaded); assert.deepEqual(loadBillingConfig(), loaded);
  }
  assert.equal(normalizeFuelSurcharge({ ...INITIAL_BILLING_CONFIG.fuelSurcharge, mode: 'index_pegged', currentFuelPrice: 1 }).percent, 0);
});

test('Fuel Charge exposes one field, validates input, saves decimals and toggles charging with zero', async () => {
  const user = userEvent.setup({ document });
  const page = render(React.createElement(BillingSettingsForm, { section: 'fuel' }));
  assert.equal(screen.getAllByRole('spinbutton').length, 1);
  assert.equal(screen.queryAllByRole('combobox').length, 0);
  assert.equal(screen.queryAllByRole('checkbox').length, 0);
  for (const label of ['Current Fuel Price', 'Baseline Fuel Price', 'Surcharge Increase per 1¢', 'Enabled', 'This charge is taxable']) assert.equal(screen.queryByLabelText(label), null);
  const field = screen.getByLabelText('Fuel surcharge (%)');
  assert.equal((field as HTMLInputElement).value, '28.5');
  for (const invalid of ['', '-1']) {
    await user.clear(field); if (invalid) await user.type(field, invalid);
    await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
    assert.equal(loadBillingConfig().fuelSurcharge.percent, 28.5);
  }
  await user.clear(field); await user.type(field, '24.75');
  const changedElsewhere = loadBillingConfig(); changedElsewhere.company.name = 'Concurrent company'; changedElsewhere.fuelSurcharge.taxable = false; saveBillingConfig(changedElsewhere);
  await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 24.75); assert.equal(loadBillingConfig().fuelSurcharge.taxable, false);
  assert.equal(loadBillingConfig().company.name, 'Concurrent company');
  await user.clear(field); await user.type(field, '0'); await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
  assert.equal(loadBillingConfig().fuelSurcharge.enabled, false);
  page.unmount(); render(React.createElement(BillingSettingsForm, { section: 'fuel' }));
  const reloaded = screen.getByLabelText('Fuel surcharge (%)'); assert.equal((reloaded as HTMLInputElement).value, '0');
  await user.clear(reloaded); await user.type(reloaded, '28.5'); await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
  assert.equal(loadBillingConfig().fuelSurcharge.enabled, true);
});

test('editing fuel percent wins over a concurrent disable without losing unrelated billing fields', async () => {
  const user = userEvent.setup({ document }); render(React.createElement(BillingSettingsForm, { section: 'fuel' }));
  const field = screen.getByLabelText('Fuel surcharge (%)'); await user.clear(field); await user.type(field, '24');
  const latest = loadBillingConfig(); latest.fuelSurcharge.enabled = false; saveBillingConfig(latest);
  await user.click(screen.getByRole('button', { name: 'Save Fuel Charge' }));
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 24); assert.equal(loadBillingConfig().fuelSurcharge.enabled, true);
});

test('percentage fuel is charged once on each of the four methods and zero disables it', () => {
  for (const method of ['FIXED', 'HOURLY', 'ZONE', 'BASE_PLUS_DISTANCE'] as const) {
    const s = setup(); Object.assign(s.card, { pricingMethod: method, baseFee: 60, includedKm: 0, kmRate: 4, hourlyRate: 100, minimumBillableMinutes: 0, billingIncrementMinutes: 1 });
    s.order.hourlyBillableMinutes = 60;
    s.order.stops[0].zoneId = 'a'; s.order.stops[1].zoneId = 'b'; s.order.stops[1].pickupIds = [s.order.stops[0].id];
    s.card.zoneRates = [{ id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 100 }];
    const quote = priceOrder(s.order, s.ctx);
    assert.equal(quote.status, 'PRICED', JSON.stringify(quote.errors));
    assert.equal(quote.inputs.fuelBase, 100); assert.equal(quote.fuelSurcharge, 28.5); assert.equal(quote.total, 134.93);
    assert.equal(quote.lines.filter(l => l.group === 'FUEL').length, 1);
    s.billing.fuelSurcharge.percent = 0;
    assert.equal(priceOrder(s.order, s.ctx).fuelSurcharge, 0);
  }
});

test('frozen indexed quotes retain their fuel rules at hourly settlement; new quotes freeze a percentage', () => {
  const s = setup(); Object.assign(s.card, { pricingMethod: 'HOURLY', hourlyRate: 100, minimumBillableMinutes: 0, billingIncrementMinutes: 1, hourlySettleActual: true });
  s.order.hourlyBillableMinutes = 60;
  Object.assign(s.billing.fuelSurcharge, { mode: 'index_pegged', currentFuelPrice: 1.8, baselineFuelPrice: 1.5, percentPerCentAboveBaseline: 0.5 });
  const legacy = calculatePricing(s.order, s.ctx); const frozen = JSON.stringify(legacy);
  const current = priceOrder(s.order, s.ctx);
  assert.equal(legacy.context!.billing.fuelSurcharge.mode, 'index_pegged');
  assert.equal(current.context!.billing.fuelSurcharge.mode, 'fixed_percent');
  assert.equal(current.inputs.fuelPercent, 15);
  Object.assign(s.billing.fuelSurcharge, { mode: 'fixed_percent', percent: 99, currentFuelPrice: 9 });
  for (const quote of [legacy, current]) {
    const final = finalizeOrderPrice(s.order, 120, s.ctx, quote).snapshot;
    assert.equal(final.inputs.fuelPercent, 15); assert.equal(final.fuelSurcharge, 30);
  }
  assert.equal(JSON.stringify(legacy), frozen);
});

test('invalid fuel settings require review and do not silently remove the charge', () => {
  for (const percent of [NaN, Infinity, -1, null]) {
    const s = setup(); s.billing.fuelSurcharge.percent = percent as number;
    const result = priceOrder(s.order, s.ctx);
    assert.equal(result.status, 'NEEDS_ATTENTION'); assert.match(result.errors[0].message, /fuel surcharge/);
  }
});

test('the old saved 8% default displays 28.5%, while a deliberate later 8% and historical quotes stay unchanged', () => {
  const legacy = structuredClone(INITIAL_BILLING_CONFIG); legacy.fuelSurcharge.percent = 8;
  localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(legacy));
  const frozenContext = structuredClone(legacy);
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 28.5);
  render(React.createElement(BillingSettingsForm, { section: 'fuel' }));
  assert.equal((screen.getByLabelText('Fuel surcharge (%)') as HTMLInputElement).value, '28.5');
  assert.equal(resolveFuelPercent(frozenContext), 8);
  const chosen = loadBillingConfig(); chosen.fuelSurcharge.percent = 8; saveBillingConfig(chosen);
  assert.equal(loadBillingConfig().fuelSurcharge.percent, 8);
  for (const [mode, enabled, percent, expected] of [
    ['fixed_percent', true, 17, 17], ['fixed_percent', false, 8, 0], ['fixed_percent', true, 0, 0], ['index_pegged', true, 8, 10.2]
  ] as const) {
    const old = structuredClone(legacy); Object.assign(old.fuelSurcharge, { mode, enabled, percent });
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(old));
    assert.equal(loadBillingConfig().fuelSurcharge.percent, expected);
  }
});
