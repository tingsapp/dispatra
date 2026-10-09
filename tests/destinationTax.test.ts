import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_BILLING_CONFIG } from '../src/lib/billingStorage';
import { INITIAL_ACCESSORIALS, INITIAL_SERVICES, INITIAL_VEHICLES } from '../src/lib/simplePricingStorage';
import { createEmptyRateCard } from '../src/lib/pricingStorage';
import { createDefaultOrderInput, createStop, priceOrder } from '../src/lib/orderPricing';
import { calculatePricing, PricingContext } from '../src/lib/pricingEngine';
import { addressChange, resolveStopLocation } from '../src/lib/taxAddress';
import { DEFAULT_SHIPPERS } from '../src/lib/customerStorage';

function setup() {
  const billing = structuredClone(INITIAL_BILLING_CONFIG);
  Object.assign(billing.quoteSettings, { taxRegistrationStatus: 'REGISTERED', taxRegistrationNumber: '123456789 RT0001' });
  billing.fuelSurcharge.enabled = false; billing.serviceCharge.enabled = false; billing.rules.minimumChargePerJob = 0;
  const card = createEmptyRateCard({ id: 'tax-card', scope: 'ORGANIZATION', effectiveFrom: '2020-01-01', pricingMethod: 'FIXED', fixedAmount: 100, applyVehicleSurcharge: false, applyAdminFee: false, applyServiceMultiplier: false, applyAccessorials: false });
  const ctx: PricingContext = { billing, catalogue: { services: structuredClone(INITIAL_SERVICES), vehicles: structuredClone(INITIAL_VEHICLES), accessorials: structuredClone(INITIAL_ACCESSORIALS) }, pricing: { rateCards: [card], zones: [], zoneRates: [], customerGroups: [] }, customers: [], asOf: new Date('2026-09-17T12:00:00Z') };
  const order = createDefaultOrderInput(ctx); order.packages = []; order.taxCalculation = 'DESTINATION'; // Historical quote compatibility.
  order.stops[0] = { ...order.stops[0], ...addressChange('100 Main St, Vancouver, BC V6A 2S5, Canada') };
  order.stops[1] = { ...order.stops[1], ...addressChange('200 Main St, Vancouver, BC V6A 2S5, Canada') };
  return { ctx, order, billing, card };
}
function assertReview(s: ReturnType<typeof setup>, pattern: RegExp) {
  const result = priceOrder(s.order, s.ctx); assert.equal(result.status, 'NEEDS_ATTENTION'); assert.match(result.errors.map(e => e.message).join(' '), pattern);
  assert.equal(result.taxTotal, 0);
}

test('historical destination-mode orders retain their supported province rates', () => {
  for (const [province, rate] of Object.entries({ BC: 5, AB: 5, SK: 5, MB: 5, ON: 13, NB: 15, NS: 14, PE: 15, NL: 15, NT: 5, NU: 5, YT: 5 })) {
    const s = setup(); assert.equal(s.order.taxCalculation, 'DESTINATION');
    s.order.stops[1] = { ...s.order.stops[1], ...addressChange(`200 Main Street, City, ${province}, Canada`) };
    const result = priceOrder(s.order, s.ctx); assert.equal(result.status, 'PRICED', JSON.stringify(result.errors)); assert.equal(result.taxTotal, rate); assert.equal(result.total, 100 + rate); assert.equal(result.taxDecision?.province, province);
  }
});
test('typed address parsing detects postal/province conflicts, foreign addresses and ambiguous territories', () => {
  assert.equal(resolveStopLocation({ label: '123 Main St, Toronto, Ontario M5V 2T6 Canada' }).province, 'ON');
  assert.equal(resolveStopLocation({ label: '123 Main St, M5V 2T6' }).province, 'ON');
  assert.equal(resolveStopLocation({ label: '123 Main St, BC M5V 2T6' }).conflict, true);
  assert.equal(resolveStopLocation({ label: '123 Main St, Seattle, WA 98101 USA' }).country, 'US');
  assert.equal(resolveStopLocation({ label: '10 Main St, X0A 0H0' }).province, undefined);
  assert.equal(resolveStopLocation({ label: '10 Main St, X0A 0H0', provinceCode: 'BC', countryCode: 'CA' }).conflict, true);
  assert.equal(resolveStopLocation({ label: '100 Ontario Street' }).province, undefined);
});
test('missing, conflicting and cross-border addresses cannot silently fall back to company taxes', () => {
  for (const [address, pattern] of [['100 Main St', /Confirm the country/], ['100 Main St, BC M5V2T6', /conflicting/], ['100 Main St, Seattle WA 98101 USA', /International/]] as const) {
    const s = setup(); s.order.stops[1] = { ...s.order.stops[1], ...addressChange(address) }; assertReview(s, pattern);
  }
});
test('changing an address clears stale structured jurisdiction and map coordinates', () => {
  const original = { ...setup().order.stops[1], latitude: 49, longitude: -123, normalizedAddress: 'old' };
  const next = { ...original, ...addressChange('20 King St, Toronto ON M5V 2T6') };
  assert.equal(next.provinceCode, 'ON'); assert.equal(next.latitude, null); assert.equal(next.normalizedAddress, undefined);
});
test('same-province multi-stop orders price once and reordering does not alter tax', () => {
  const s = setup(); s.order.stops.push(createStop('DROPOFF', { ...addressChange('25 Main St, Victoria, BC, Canada'), pickupIds: [s.order.stops[0].id] }));
  const before = priceOrder(s.order, s.ctx); s.order.stops.reverse(); const after = priceOrder(s.order, s.ctx);
  assert.equal(before.status, 'PRICED'); assert.equal(after.taxTotal, before.taxTotal); assert.equal(after.taxDecision?.destinationKey, before.taxDecision?.destinationKey);
});
test('mixed-province destinations require charge allocation; the final stop never sets tax for the whole order', () => {
  const s = setup(); s.order.stops.push(createStop('DROPOFF', { ...addressChange('20 King St, Toronto ON M5V 2T6'), pickupIds: [s.order.stops[0].id] })); assertReview(s, /Allocate the freight charge/);
});
test('Quebec movements and special freight treatment require review', () => {
  const s = setup(); s.order.stops[1] = { ...s.order.stops[1], ...addressChange('20 Rue Main, Montreal QC H2Y 1C6') }; assertReview(s, /GST\/QST/);
  const special = setup(); special.order.freightTaxTreatment = 'REVIEW'; assertReview(special, /special tax treatment/);
  const imported = setup(); imported.order.importedPrice = 100; assertReview(imported, /special tax treatment/);
});
test('destination tax applies without registration setup and ignores legacy registration choices', () => {
  for (const status of [undefined, 'UNCONFIRMED', 'REGISTERED', 'NOT_REGISTERED'] as const) {
    for (const number of ['', 'invalid', '123456789 RT0001']) {
      const s = setup(); s.billing.quoteSettings.taxRegistrationStatus = status; s.billing.quoteSettings.taxRegistrationNumber = number;
      const result = priceOrder(s.order, s.ctx);
      assert.equal(result.status, 'PRICED'); assert.equal(result.taxTotal, 5); assert.equal(result.total, 105);
      assert.match(result.taxDecision!.description, /GST 5%/);
    }
  }
});
test('destination rates ignore manually configured profiles and review customer exemptions', () => {
  const s = setup(); s.billing.taxProfiles[0].taxes[0].ratePercent = 99;
  const customer = { ...structuredClone(DEFAULT_SHIPPERS[0]), id: 'customer', customerGroupId: null, rateCardId: null, taxProfileId: 'not-a-profile', taxExempt: false };
  s.ctx.customers = [customer]; s.order.customerId = customer.id; assert.equal(priceOrder(s.order, s.ctx).taxTotal, 5);
  customer.taxExempt = true; assertReview(s, /exemption documents/);
});
test('new quotes add destination tax even when legacy inclusive pricing is enabled', () => {
  const s = setup(); s.billing.quoteSettings.pricesIncludeTax = true; s.card.fixedAmount = 113;
  s.order.stops[1] = { ...s.order.stops[1], ...addressChange('200 Main St, Toronto ON M5V 2T6') };
  const result = priceOrder(s.order, s.ctx); assert.equal(result.subtotal, 113); assert.equal(result.taxTotal, 14.69); assert.equal(result.total, 127.69);
  assert.equal(result.context!.billing.quoteSettings.pricesIncludeTax, false);
  assert.equal(s.billing.quoteSettings.pricesIncludeTax, true);
});
test('unhandled historical rate periods need review', () => {
  const s = setup(); s.ctx.asOf = new Date('2025-03-31'); assertReview(s, /Historical tax dates/);
});
test('saved quotes keep their tax after company settings change', () => {
  const s = setup(); const quote = priceOrder(s.order, s.ctx); const stored = JSON.parse(JSON.stringify(quote));
  s.billing.quoteSettings.taxRegistrationStatus = 'NOT_REGISTERED';
  assert.equal(stored.taxTotal, 5); assert.equal(stored.taxDecision?.ruleVersion, quote.taxDecision?.ruleVersion);
});

test('historical no-tax hourly quotes retain their frozen treatment while new quotes collect tax', () => {
  const s = setup(); Object.assign(s.card, { pricingMethod: 'HOURLY', hourlyRate: 100, minimumBillableMinutes: 0, billingIncrementMinutes: 1 }); s.order.hourlyBillableMinutes = 60;
  const decision = structuredClone(priceOrder(s.order, s.ctx).taxDecision!);
  decision.ruleVersion = 'ca-domestic-freight-2026-09-17';
  decision.profile!.taxes = [];
  decision.description = 'GST/HST not collected · company marked as not registered';
  const oldQuote = priceOrder(s.order, { ...s.ctx, destinationTax: decision });
  assert.equal(oldQuote.taxTotal, 0);
  const saved = JSON.parse(JSON.stringify(oldQuote));
  assert.equal(saved.status, 'PRICED'); assert.equal(saved.taxTotal, 0); assert.equal(saved.total, 100);
  assert.equal(priceOrder(s.order, s.ctx).taxTotal, 5);
});
test('saved inclusive hourly quotes retain their original tax treatment', () => {
  const s = setup(); s.billing.quoteSettings.pricesIncludeTax = true;
  Object.assign(s.card, { pricingMethod: 'HOURLY', hourlyRate: 105, minimumBillableMinutes: 0, billingIncrementMinutes: 1 }); s.order.hourlyBillableMinutes = 60;
  const oldQuote = calculatePricing(s.order, s.ctx);
  assert.equal(oldQuote.total, 105); assert.equal(oldQuote.taxTotal, 5);
  assert.equal(JSON.parse(JSON.stringify(oldQuote)).total, 105);
  assert.equal(priceOrder(s.order, s.ctx).total, 110.25);
});
test('historical profile orders preserve the previous tax calculation', () => {
  const s = setup(); s.order.taxCalculation = undefined; s.billing.taxProfiles[0].taxes[0].ratePercent = 8;
  const result = priceOrder(s.order, s.ctx); assert.equal(result.taxTotal, 8); assert.equal(result.taxDecision, undefined);
});

test('unresolved tax displays no misleading zero-dollar total', async () => {
  const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server'); const { PriceBreakdown } = await import('../src/components/pricing/PriceBreakdown');
  const s = setup(); s.order.stops[1] = { ...s.order.stops[1], ...addressChange('Unknown address') };
  const html = renderToStaticMarkup(React.createElement(PriceBreakdown, { snapshot: priceOrder(s.order, s.ctx) }));
  assert.doesNotMatch(html, /\$0\.00/); assert.match(html, /Automatic tax needs review/);
});

test('saved province overrides drive new tax with zero supported and defaults for other provinces', () => {
  for (const rate of [0, 7.25, 100]) {
    const s = setup(); s.billing.destinationTaxRates = { BC: rate, ON: 20 };
    const result = priceOrder(s.order, s.ctx);
    assert.equal(result.status, 'PRICED'); assert.equal(result.taxTotal, rate); assert.equal(result.total, 100 + rate);
    assert.match(result.taxDecision!.description, new RegExp(`GST ${rate}%`));
    s.order.stops[1] = { ...s.order.stops[1], ...addressChange('200 Main St, Calgary AB Canada') };
    assert.equal(priceOrder(s.order, s.ctx).taxTotal, 5);
  }
});
test('invalid saved rates need review and cannot become an untaxed price', () => {
  for (const rate of [null, -1, 101, NaN, Infinity]) {
    const s = setup(); s.billing.destinationTaxRates = { BC: rate }; assertReview(s, /tax rate from 0 to 100%/);
  }
});
test('province changes preserve saved hourly quotes', () => {
  const s = setup(); s.billing.destinationTaxRates = { BC: 7.25 };
  Object.assign(s.card, { pricingMethod: 'HOURLY', hourlyRate: 100, minimumBillableMinutes: 0, billingIncrementMinutes: 1 }); s.order.hourlyBillableMinutes = 60;
  const quote = JSON.parse(JSON.stringify(priceOrder(s.order, s.ctx)));
  s.billing.destinationTaxRates.BC = 9;
  assert.equal(priceOrder(s.order, s.ctx).taxTotal, 9);
  assert.equal(quote.taxTotal, 7.25);

});
