import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BILLING_STORAGE_KEY, INITIAL_BILLING_CONFIG, loadBillingConfig } from '../src/lib/billingStorage';
import { INITIAL_ACCESSORIALS, INITIAL_SERVICES, INITIAL_VEHICLES } from '../src/lib/simplePricingStorage';
import { createEmptyRateCard } from '../src/lib/pricingStorage';
import { createDefaultOrderInput, createStop, finalizeOrderPrice, priceOrder } from '../src/lib/orderPricing';
import { createInvoicePreview } from '../src/lib/organizationWorkflows';
import { PricingContext } from '../src/lib/pricingEngine';
import { addressChange } from '../src/lib/taxAddress';

function setup() {
  const billing = structuredClone(INITIAL_BILLING_CONFIG);
  Object.assign(billing.invoicing, { taxRegistrationStatus: 'REGISTERED', taxRegistrationNumber: '123456789 RT0001' });
  billing.fuelSurcharge.enabled = false; billing.serviceCharge.enabled = false; billing.rules.minimumChargePerJob = 0;
  const card = createEmptyRateCard({ id: 'tax-card', scope: 'ORGANIZATION', effectiveFrom: '2020-01-01', pricingMethod: 'FIXED', fixedAmount: 100, applyVehicleSurcharge: false, applyAdminFee: false, applyServiceMultiplier: false, applyAccessorials: false });
  const ctx: PricingContext = { billing, catalogue: { services: structuredClone(INITIAL_SERVICES), vehicles: structuredClone(INITIAL_VEHICLES), accessorials: structuredClone(INITIAL_ACCESSORIALS) }, pricing: { rateCards: [card], zones: [], zoneRates: [], customerGroups: [] }, customers: [], asOf: new Date('2026-09-17T12:00:00Z') };
  const order = createDefaultOrderInput(ctx); order.packages = [];
  order.stops[0] = { ...order.stops[0], ...addressChange('100 Main St, Vancouver, BC V6A 2S5, Canada') };
  order.stops[1] = { ...order.stops[1], ...addressChange('200 Main St, Vancouver, BC V6A 2S5, Canada') };
  return { ctx, order, billing, card };
}
test('new quotes use one company rate across all provinces, regardless of legacy overrides', () => {
  for (const province of ['BC', 'AB', 'SK', 'MB', 'ON', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT', 'QC']) {
    const s = setup(); assert.equal(s.order.taxCalculation, 'COMPANY');
    s.billing.companyTax.ratePercent = 7.25;
    s.billing.destinationTaxRates = { BC: 99, ON: 13, QC: null };
    s.billing.taxProfiles[0].taxes[0].ratePercent = 98;
    s.order.stops[1] = { ...s.order.stops[1], ...addressChange(`200 Main Street, City, ${province}, Canada`) };
    const result = priceOrder(s.order, s.ctx);
    assert.equal(result.status, 'PRICED', JSON.stringify(result.errors));
    assert.equal(result.taxTotal, 7.25); assert.equal(result.total, 107.25);
    assert.equal(result.taxDecision?.province, undefined);
    assert.equal(result.taxDecision?.profile?.taxes.length, 1);
  }
});
test('mixed provinces and addresses without province details use the company rate', () => {
  const s = setup();
  s.order.stops.push(createStop('DROPOFF', { ...addressChange('20 King St, Toronto ON M5V 2T6'), pickupIds: [s.order.stops[0].id] }));
  s.order.stops[1] = { ...s.order.stops[1], ...addressChange('200 Main Street') };
  const result = priceOrder(s.order, s.ctx);
  assert.equal(result.status, 'PRICED', JSON.stringify(result.errors)); assert.equal(result.taxTotal, 5);
});
test('zero, decimal and maximum rates are supported without a registration number', () => {
  for (const rate of [0, 0.125, 100]) {
    const s = setup(); s.billing.companyTax.ratePercent = rate; s.billing.invoicing.taxRegistrationNumber = '';
    const result = priceOrder(s.order, s.ctx);
    assert.equal(result.status, 'PRICED'); assert.equal(result.taxTotal, Math.round(rate * 100) / 100);
  }
});
test('invalid company rates require review and cannot produce an invoice', () => {
  for (const rate of [null, -1, 101, NaN, Infinity]) {
    const s = setup(); s.billing.companyTax.ratePercent = rate;
    const result = priceOrder(s.order, s.ctx);
    assert.equal(result.status, 'NEEDS_ATTENTION');
    assert.ok(result.errors.some(error => error.code === 'TAX_REVIEW_REQUIRED' && /Company → Taxes/.test(error.message)));
    assert.throws(() => createInvoicePreview('order', { ...result, stage: 'FINAL' }, s.ctx));
  }
});
test('explicit special tax treatment still requires review', () => {
  const s = setup(); s.order.freightTaxTreatment = 'REVIEW';
  assert.equal(priceOrder(s.order, s.ctx).status, 'NEEDS_ATTENTION');
});
test('saved quotes, hourly settlement and invoices retain their frozen company rate', () => {
  const s = setup();
  Object.assign(s.card, { pricingMethod: 'HOURLY', hourlyRate: 100, minimumBillableMinutes: 0, billingIncrementMinutes: 1, hourlySettleActual: true }); s.order.hourlyBillableMinutes = 60;
  const quote = JSON.parse(JSON.stringify(priceOrder(s.order, s.ctx)));
  assert.equal(quote.taxTotal, 5);
  s.billing.companyTax.ratePercent = 9;
  assert.equal(priceOrder(s.order, s.ctx).taxTotal, 9);
  const settled = finalizeOrderPrice(s.order, 120, s.ctx, quote);
  assert.equal(settled.snapshot.status, 'PRICED'); assert.equal(settled.snapshot.taxTotal, 10);
  assert.equal(createInvoicePreview('order', settled.snapshot, s.ctx).tax, 10);
  assert.equal(quote.taxTotal, 5);
  s.order.stops[1].label = 'Changed delivery';
  assert.equal(finalizeOrderPrice(s.order, 120, s.ctx, quote).snapshot.status, 'NEEDS_ATTENTION');
});
test('explicit repricing can replace a historical province rate without mutating its snapshot', () => {
  const s = setup(); s.order.taxCalculation = 'DESTINATION';
  s.order.stops[1] = { ...s.order.stops[1], ...addressChange('20 King St, Toronto ON M5V 2T6') };
  const historical = priceOrder(s.order, s.ctx); assert.equal(historical.taxTotal, 13);
  const input = { ...s.order, taxCalculation: 'COMPANY' as const };
  assert.equal(priceOrder(input, s.ctx).taxTotal, 5); assert.equal(historical.taxTotal, 13);
  assert.equal(finalizeOrderPrice(s.order, null, s.ctx, historical).snapshot.taxTotal, 13);
});
test('storage upgrades preserve the previous home rate and explicit company rate including zero', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === BILLING_STORAGE_KEY ? raw : null } });
  try {
    assert.equal(loadBillingConfig().companyTax.ratePercent, 5);
    for (const rate of [0, 7.25]) {
      raw = JSON.stringify({ destinationTaxRates: { BC: rate, ON: 13 } });
      assert.equal(loadBillingConfig().companyTax.ratePercent, rate);
    }
    for (const rate of [0, 6, null]) {
      raw = JSON.stringify({ companyTax: { ratePercent: rate }, destinationTaxRates: { BC: 7.25 } });
      assert.equal(loadBillingConfig().companyTax.ratePercent, rate);
    }
    raw = JSON.stringify({ destinationTaxRates: { BC: -1 } });
    assert.equal(loadBillingConfig().companyTax.ratePercent, 5);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
