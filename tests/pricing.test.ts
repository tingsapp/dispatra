import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricing, estimateInternalCost, PricingContext } from '../src/lib/pricingEngine';
import { INITIAL_BILLING_CONFIG } from '../src/lib/billingStorage';
import { createEmptyRateCard } from '../src/lib/pricingStorage';
import { INITIAL_SERVICES, INITIAL_ACCESSORIALS, INITIAL_VEHICLES } from '../src/lib/simplePricingStorage';
import { createDefaultOrderInput, finalizeOrderPrice, priceOrder } from '../src/lib/orderPricing';
import { fromDisplayDistance, toDisplayDistance, fromDisplayWeight, toDisplayWeight, fromDisplayDimension, toDisplayDimension, fromDisplayDivisor, toDisplayDivisor } from '../src/lib/units';
import { DEFAULT_CUSTOMERS } from '../src/lib/customerStorage';
import { organizationTime, validateBooking, validateAssignment, createInvoicePreview } from '../src/lib/organizationWorkflows';
import type { Driver, Job } from '../src/types';
import type { RateCard } from '../src/types/pricing';

const setup = () => {
  const billing = structuredClone(INITIAL_BILLING_CONFIG);
  billing.fuelSurcharge.enabled = false;
  billing.rules.minimumChargePerJob = 0;
  billing.rules.distanceRoundingKm = 0;
  const card = createEmptyRateCard({ id: 'card', status: 'ACTIVE', effectiveFrom: '2020-01-01', pricingMethod: 'FIXED', fixedAmount: 100, minimumFreight: 0, applyVehicleSurcharge: false });
  const ctx: PricingContext = { billing, catalogue: { services: structuredClone(INITIAL_SERVICES), vehicles: structuredClone(INITIAL_VEHICLES), accessorials: structuredClone(INITIAL_ACCESSORIALS) }, pricing: { rateCards: [card], zones: [], zoneRates: [], customerGroups: [] }, customers: [], asOf: new Date('2026-09-12T12:00:00Z') };
  const order = createDefaultOrderInput(ctx);
  order.packages = []; order.routeKm = 10; order.estimatedMinutes = 30;
  return { billing, card, ctx, order };
};
const priced = (s: ReturnType<typeof setup>) => { const result = calculatePricing(s.order, s.ctx); assert.equal(result.status, 'PRICED', JSON.stringify(result.errors)); return result; };

test('zero vehicle cost override remains zero', () => {
  const s = setup(); s.billing.operatingCost.costPerKmByVehicleId['v'] = 0;
  const cost = estimateInternalCost({ routeKm: 10, vehicleId: 'v', stopCount: 0, driveMinutes: 0, durationBasis: 'DRIVING_ONLY' }, s.billing, 100);
  assert.equal(cost.costLines[0].amount, 0);
});
test('display units roundtrip preserves distance, weight, dimensions, divisor and price', () => {
  const s = setup(); s.card.pricingMethod = 'BASE_PLUS_DISTANCE';
  s.order.packages = [{ id: 'p', quantity: 2, weightKg: 20, lengthCm: 60, widthCm: 50, heightCm: 40, declaredValue: 0 }];
  const before = priced(s);
  const units = { distanceUnit: 'mi', weightUnit: 'lb', dimensionUnit: 'in' } as const;
  Object.assign(s.billing.general, units);
  s.order.routeKm = fromDisplayDistance(toDisplayDistance(s.order.routeKm!, units), units);
  for (const p of s.order.packages) { p.weightKg = fromDisplayWeight(toDisplayWeight(p.weightKg, units), units); p.lengthCm = fromDisplayDimension(toDisplayDimension(p.lengthCm, units), units); }
  s.billing.general.dimensionalDivisor = fromDisplayDivisor(toDisplayDivisor(s.billing.general.dimensionalDivisor, units), units);
  assert.equal(priced(s).total, before.total);
});
test('inclusive tax is excluded from estimated revenue and multiple taxes share normalized base', () => {
  const s = setup(); s.billing.invoicing.pricesIncludeTax = true;
  s.billing.taxProfiles[0].taxes = [{ id: 'a', name: 'A', ratePercent: 5, active: true, appliesTo: ['transport'] }, { id: 'b', name: 'B', ratePercent: 7, active: true, appliesTo: ['transport'] }];
  s.card.fixedAmount = 112;
  const result = priced(s); assert.equal(result.total, 112); assert.equal(result.subtotal, 100); assert.equal(result.cost?.revenueExcludingTax, 100);
});
test('only Waiting recorded automatically consumes waiting; rule reasons are retained', () => {
  const s = setup(); s.order.stops[0].waitMinutes = 30;
  const other = structuredClone(s.ctx.catalogue.accessorials.find(a => a.code === 'WAIT')!); other.id = 'other'; other.code = 'OTHER'; other.autoRule = 'NONE';
  s.ctx.catalogue.accessorials.push(other);
  const result = priced(s); assert.equal(result.accessorialsTotal, 11.25); assert.match(result.lines.find(l => l.key === 'acc_acc_wait_time')!.detail!, /waiting recorded/);
});
test('waiting override beats accessorial default; per-stop allowance, rounding, min and max', () => {
  const s = setup(); const wait = s.ctx.catalogue.accessorials.find(a => a.code === 'WAIT')!;
  wait.freeAllowance = 20; wait.incrementMinutes = 30; wait.rate = 1; wait.minimumCharge = 8; wait.maximumCharge = 12;
  s.card.waitFreeMinutes = 0; s.card.waitIncrementMinutes = 0;
  s.order.stops[0].waitMinutes = 5; s.order.stops[1].waitMinutes = 20;
  assert.equal(priced(s).accessorialsTotal, 20);
});
test('multiple automatic waiting rules produce configuration error, not double billing', () => {
  const s = setup(); s.order.stops[0].waitMinutes = 30;
  s.ctx.catalogue.accessorials.push({ ...s.ctx.catalogue.accessorials.find(a => a.code === 'WAIT')!, id: 'wait2' });
  assert.equal(calculatePricing(s.order, s.ctx).status, 'NEEDS_ATTENTION');
});
test('hourly waiting is not billed twice and actual settlement requires actual clock', () => {
  const s = setup(); s.card.pricingMethod = 'HOURLY'; s.card.minimumBillableMinutes = 0; s.card.hourlyRate = 60;
  s.order.hourlyBillableMinutes = 60; s.order.stops[0].waitMinutes = 30;
  assert.equal(priced(s).accessorialsTotal, 0); assert.equal(priced(s).freight, 60);
  s.order.stage = 'FINAL'; assert.equal(calculatePricing(s.order, s.ctx).status, 'NEEDS_ATTENTION');
  s.order.actualHourlyBillableMinutes = 90; assert.equal(priced(s).freight, 90);
});
test('minimum order subtotal applies after discounts and manual adjustments; zero waiver works', () => {
  const s = setup(); s.billing.rules.minimumChargePerJob = 100; s.card.discount = { type: 'PERCENT', value: 20, scope: 'SUBTOTAL' };
  s.order.adjustments = [{ id: 'a', amount: -10, reason: 'Agreed credit', taxable: true }];
  const result = priced(s); assert.equal(result.subtotal, 100); assert.equal(result.discount, 20); assert.equal(result.minimumAdjustment, 30);
  s.card.minimumOrderSubtotal = 0; assert.equal(priced(s).subtotal, 70);
});
test('freight minimum is enforced after service multiplier', () => {
  const s = setup(); s.card.fixedAmount = 100; s.card.minimumFreight = 90; s.card.applyServiceMultiplier = true;
  s.ctx.catalogue.services[0].defaultMultiplier = 0.5;
  assert.equal(priced(s).serviceFreight, 90);
});
test('No discount stops inheritance; Inherit continues customer → card → group', () => {
  const s = setup(); const customer = structuredClone(DEFAULT_CUSTOMERS[0]); customer.customerGroupId = 'g'; customer.discount = { type: 'NONE', value: 0, scope: 'SUBTOTAL' };
  s.ctx.customers = [customer]; s.order.customerId = customer.id;
  s.ctx.pricing.customerGroups = [{ id: 'g', name: 'Group', description: '', rateCardId: null, discount: { type: 'PERCENT', value: 10, scope: 'SUBTOTAL' } }];
  s.card.discount = { type: 'PERCENT', value: 20, scope: 'SUBTOTAL' };
  assert.equal(priced(s).discount, 0); customer.discount.type = 'INHERIT'; assert.equal(priced(s).discount, 20);
  s.card.discount.type = 'NONE'; assert.equal(priced(s).discount, 0); s.card.discount.type = 'INHERIT'; assert.equal(priced(s).discount, 10);
});
test('contract matrices differ and explicit movements price each supplying pickup once', () => {
  const s = setup(); s.card.pricingMethod = 'ZONE'; s.card.zoneMatrixMode = 'CONTRACT';
  s.order.stops[0].zoneId = 'a'; s.order.stops[1].zoneId = 'b'; s.order.stops[1].pickupIds = [s.order.stops[0].id];
  s.card.zoneRates = [{ id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 40 }];
  const other = createEmptyRateCard({ ...s.card, id: 'other', zoneRates: [{ ...s.card.zoneRates[0], amount: 70 }] }); s.ctx.pricing.rateCards.push(other);
  s.order.rateCardOverrideId = s.card.id; assert.equal(priced(s).freight, 40);
  s.order.rateCardOverrideId = other.id; assert.equal(priced(s).freight, 70);
  s.order.rateCardOverrideId = s.card.id; s.order.stops.push({ ...s.order.stops[0], id: 'pickup2', zoneId: 'c' });
  s.order.stops[1].pickupIds.push('pickup2', 'pickup2'); s.card.zoneRates.push({ id: 'cb', originZoneId: 'c', destinationZoneId: 'b', serviceId: null, amount: 25 });
  assert.equal(priced(s).freight, 65);
});
test('zone contract fallback and service-specific prices are explicit', () => {
  const s = setup(); s.card.pricingMethod = 'ZONE'; s.card.zoneMatrixMode = 'CONTRACT';
  s.order.stops[0].zoneId = 'a'; s.order.stops[1].zoneId = 'b'; s.order.stops[1].pickupIds = [s.order.stops[0].id];
  s.ctx.pricing.zoneRates = [{ id: 'ab', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 40 }, { id: 'abs', originZoneId: 'a', destinationZoneId: 'b', serviceId: s.order.serviceId, amount: 55 }];
  assert.equal(calculatePricing(s.order, s.ctx).status, 'NEEDS_ATTENTION'); s.card.zoneFallbackToOrganization = true; assert.equal(priced(s).freight, 55);
  s.order.stops[1].pickupIds = []; assert.equal(calculatePricing(s.order, s.ctx).status, 'NEEDS_ATTENTION');
});
test('imported final agreed total bypasses all modifiers and rounding', () => {
  const s = setup(); s.order.importedPrice = 101.23; s.order.source = 'IMPORT'; s.order.importedTaxTreatment = 'SUPPLIED'; s.order.importedTaxAmount = 5;
  s.card.importedPriceMode = 'FINAL_TOTAL'; s.billing.serviceCharge.enabled = true; s.billing.fuelSurcharge.enabled = true; s.billing.rules.minimumChargePerJob = 500; s.billing.rules.moneyRounding = 'nearest_1';
  const result = priced(s); assert.equal(result.total, 101.23); assert.equal(result.subtotal, 96.23); assert.equal(result.companyCharge, 0); assert.equal(result.imported?.amount, 101.23);
});
test('imported freight honors admin, multiplier, discount and minimum switches', () => {
  const s = setup(); s.order.importedPrice = 100; s.card.applyServiceMultiplier = true; s.ctx.catalogue.services[0].defaultMultiplier = 2;
  s.card.applyAdminFee = false; s.card.applyContractDiscount = false; s.card.applyOrderMinimum = false; s.billing.serviceCharge.enabled = true; s.billing.rules.minimumChargePerJob = 500;
  assert.equal(priced(s).subtotal, 200);
});
test('fuel eligible lines determine base before discounts; admin fee is excluded', () => {
  const s = setup(); s.billing.fuelSurcharge.enabled = true; s.billing.fuelSurcharge.percent = 10; s.billing.serviceCharge.enabled = true; s.billing.serviceCharge.mode = 'flat'; s.billing.serviceCharge.flatAmount = 20;
  s.order.accessorials = [{ accessorialId: 'acc_liftgate', quantity: 1 }]; s.card.discount = { type: 'PERCENT', value: 10, scope: 'SUBTOTAL' };
  const result = priced(s); assert.equal(result.inputs.fuelBase, 125); assert.equal(result.fuelSurcharge, 12.5);
});
test('traffic and obsolete minute-rate fields do not change normal customer prices', () => {
  const s = setup(); s.card.pricingMethod = 'BASE_PLUS_DISTANCE'; const total = priced(s).total; s.order.estimatedMinutes = 180;
  assert.equal(priced(s).total, total); s.card.minuteRate = 1; s.card.includedMinutes = 15;
  assert.equal(priced(s).total, total); assert.equal(priced(s).rateCard?.id, s.card.id);
});
test('cost separates driving, handling and waiting, and flags incomplete inputs', () => {
  const s = setup(); s.billing.operatingCost.driverCostPerHour = 60;
  const driving = estimateInternalCost({ routeKm: 0, stopCount: 2, driveMinutes: 30, handlingMinutes: 20, waitMinutes: 10, durationBasis: 'DRIVING_ONLY' }, s.billing, 100);
  const total = estimateInternalCost({ routeKm: 0, stopCount: 2, driveMinutes: 60, handlingMinutes: 20, waitMinutes: 10, durationBasis: 'TOTAL_SERVICE' }, s.billing, 100);
  assert.equal(driving.estimatedCost, total.estimatedCost);
  assert.equal(estimateInternalCost({ routeKm: null, stopCount: 2 }, s.billing, 100).complete, false);
  const zero = estimateInternalCost({ routeKm: 0, stopCount: 0, driveMinutes: 0, durationBasis: 'TOTAL_SERVICE' }, s.billing, 0);
  assert.equal(zero.grossMarginPercent, 0); assert.equal(zero.meetsTargetMargin, false);
});
test('order wrapper and shared pricing engine return identical results', () => {
  const s = setup(); const a = calculatePricing(s.order, s.ctx); const b = priceOrder(s.order, s.ctx);
  assert.equal(a.total, b.total); assert.deepEqual(a.lines, b.lines); assert.deepEqual(a.inputs, b.inputs);
});
test('quotes preserve terms on finalization; finalized snapshots are immutable to settings changes', () => {
  const s = setup(); const quote = priced(s); s.card.fixedAmount = 900; s.billing.serviceCharge.enabled = true;
  const final = finalizeOrderPrice(s.order, 90, s.ctx, quote); assert.equal(final.snapshot.total, quote.total); assert.equal(final.snapshot.stage, 'FINAL');
  assert.deepEqual(finalizeOrderPrice(final.input, 200, s.ctx, final.snapshot).snapshot, final.snapshot);
  const job = { pricing: final.snapshot, assignedDriverId: 'A' }; const reassigned = { ...job, assignedDriverId: 'B', operationalKm: 100 }; assert.deepEqual(job.pricing, reassigned.pricing);
});
test('hourly settlement uses frozen rate-card version', () => {
  const s = setup(); s.card.pricingMethod = 'HOURLY'; s.card.hourlyRate = 60; s.card.minimumBillableMinutes = 0; s.order.hourlyBillableMinutes = 60;
  const quote = priced(s); s.card.hourlyRate = 900;
  const final = finalizeOrderPrice(s.order, 90, s.ctx, quote); assert.equal(final.snapshot.freight, 90);
});
test('cutoff uses organization timezone for same-day bookings', () => {
  const s = setup(); s.order.scheduledAt = '2026-09-12T17:00'; s.ctx.catalogue.services[0].bookingCutoffTime = '14:00';
  assert.equal(organizationTime('2026-09-12T22:30:00Z', 'America/Vancouver')?.clock, '15:30');
  assert.equal(validateBooking(s.order, s.ctx, new Date('2026-09-12T22:30:00Z')).length, 1);
  s.order.scheduledAt = '2026-09-13T17:00'; assert.deepEqual(validateBooking(s.order, s.ctx, new Date('2026-09-12T22:30:00Z')), []);
});
test('manual and recommendation assignments enforce maximum and exclusive work', () => {
  const s = setup(); const driver = { id: 'd', status: 'available' } as Driver;
  const job = { id: 'new', status: 'no_driver', pricing: priced(s), pricingInput: s.order } as Job;
  const active = { ...job, id: 'old', assignedDriverId: 'd' }; s.billing.dispatch.maxActiveOrdersPerDriver = 1;
  assert.match(validateAssignment(job, driver, [active], s.ctx, s.ctx.asOf)[0], /maximum/);
  s.billing.dispatch.maxActiveOrdersPerDriver = 3; s.ctx.catalogue.services[0].exclusiveVehicle = true;
  assert.match(validateAssignment(job, driver, [active], s.ctx, s.ctx.asOf)[0], /Exclusive/);
});
test('invoice preview uses finalized lines, tax registration and payment terms', () => {
  const s = setup(); s.billing.invoicing.taxRegistrationNumber = 'DEMO'; s.billing.invoicing.defaultPaymentTerms = 'NET15';
  const quote = priced(s); const final = finalizeOrderPrice(s.order, null, s.ctx, quote);
  const invoice = createInvoicePreview('id', final.snapshot, s.ctx, new Date('2026-09-12T12:00:00Z'));
  assert.equal(invoice.dueAt, '2026-09-27T12:00:00.000Z'); assert.equal(invoice.taxRegistrationNumber, 'DEMO'); assert.equal(invoice.total, final.snapshot.total); assert.deepEqual(invoice.lines, [...final.snapshot.lines, ...final.snapshot.taxLines]);
});

test('revised settings and shared order form render without a browser', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BillingSettingsPage } = await import('../src/pages/BillingSettingsPage');
  const { RateCardsPage } = await import('../src/pages/RateCardsPage');
  const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
  const { ContractRulesEditor } = await import('../src/components/pricing/ContractRulesEditor');
  const noop = () => {};
  const general = renderToStaticMarkup(React.createElement(BillingSettingsPage, { onBackToMonitor: noop }));
  assert.match(general, /Minimum Order Subtotal/); assert.doesNotMatch(general, /Default Fuel Surcharge/);
  const rates = renderToStaticMarkup(React.createElement(RateCardsPage, { onBackToMonitor: noop }));
  assert.match(rates, /Contract rules/); assert.doesNotMatch(rates, /Minute Rate|Included Minutes/);
  const s = setup(); const form = renderToStaticMarkup(React.createElement(OrderPricingForm, { value: s.order, onChange: noop, ctx: s.ctx, snapshot: priced(s) }));
  assert.match(form, /Supplying pickups/); assert.match(form, /Driving only/);
  s.card.pricingMethod = 'IMPORTED'; s.card.importedPriceMode = 'FINAL_TOTAL';
  const contract = renderToStaticMarkup(React.createElement(ContractRulesEditor, { card: s.card, patch: noop, zones: [], services: s.ctx.catalogue.services, organizationMinimum: 100 }));
  assert.match(contract, /preserve exactly/); assert.doesNotMatch(contract, /Apply resolved contract discount/);
});

test('hourly billable actuals do not become driving actuals in the cost estimate', () => {
  const s = setup(); s.card.pricingMethod = 'HOURLY'; s.card.minimumBillableMinutes = 0; s.card.hourlyRate = 60;
  s.order.hourlyBillableMinutes = 60; s.order.estimatedMinutes = 30; s.order.handlingMinutes = 20; s.order.stops[0].waitMinutes = 10;
  const quote = priced(s); const final = finalizeOrderPrice(s.order, 90, s.ctx, quote);
  assert.equal(final.input.actualMinutes, null);
  assert.equal(final.snapshot.cost?.estimatedCost, quote.cost?.estimatedCost);
  assert.match(final.snapshot.cost?.basis ?? '', /^Estimated/);
});

test('legacy time rates retire on load and storage migration preserves explicit discount choices', async () => {
  const { loadPricingConfig, savePricingConfig, PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  try {
    const s = setup(); s.card.pricingMethod = 'BASE_PLUS_DISTANCE'; s.card.minuteRate = 0.4; s.card.discount.type = 'NONE';
    data.set(PRICING_STORAGE_KEY, JSON.stringify(s.ctx.pricing));
    const legacy = loadPricingConfig(); assert.equal(legacy.rateCards[0].minuteRate, 0); assert.equal(legacy.rateCards[0].discount.type, 'INHERIT');
    legacy.rateCards[0].discount.type = 'NONE'; savePricingConfig(legacy); assert.equal(loadPricingConfig().rateCards[0].discount.type, 'NONE');
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('saved Base + Distance and Zone cards migrate once without resetting negotiated terms', async () => {
  const { loadPricingConfig, savePricingConfig, PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  try {
    const s = setup();
    for (const method of ['BASE_PLUS_DISTANCE', 'ZONE'] as const) {
      const card = createEmptyRateCard({ ...s.card, pricingMethod: method, minuteRate: 0.4, includedMinutes: 30, version: 7, baseFee: 83, fuelPercent: 4, discount: { type: 'NONE', value: 0, scope: 'SUBTOTAL' }, zoneRates: [{ id: 'zoneprice', originZoneId: 'a', destinationZoneId: 'b', serviceId: null, amount: 67 }], vehicleSurchargeOverrides: { van: 0 } });
      const hourly = createEmptyRateCard({ id: 'hourly', pricingMethod: 'HOURLY', hourlyRate: 123, minimumBillableMinutes: 90, minuteRate: 9, includedMinutes: 20 });
      data.set(PRICING_STORAGE_KEY, JSON.stringify({ ...s.ctx.pricing, rateCards: [card, hourly], schemaVersion: 2 }));
      const loaded = loadPricingConfig(); const migrated = loaded.rateCards[0];
      assert.equal(migrated.minuteRate, 0); assert.equal(migrated.includedMinutes, 0); assert.equal(migrated.version, 8);
      assert.deepEqual({ ...migrated, minuteRate: card.minuteRate, includedMinutes: card.includedMinutes, version: card.version, updatedAt: card.updatedAt }, card);
      assert.deepEqual(loaded.rateCards[1], hourly);
      const saved = data.get(PRICING_STORAGE_KEY)!;
      assert.equal(JSON.parse(saved).schemaVersion, 3); assert.equal(JSON.parse(saved).rateCards[0].minuteRate, 0);
      assert.deepEqual(loadPricingConfig(), loaded); assert.equal(data.get(PRICING_STORAGE_KEY), saved);
      savePricingConfig({ ...loaded, rateCards: [card] });
      assert.equal(loadPricingConfig().rateCards[0].minuteRate, 0);
    }
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('saved orders recover only unfinished legacy-time pricing failures and persist the repair', async () => {
  const { loadSavedOrders, saveOrders, pricingAttentionItems } = await import('../src/lib/orderPricing');
  const { PRICING_STORAGE_KEY } = await import('../src/lib/pricingStorage');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  try {
    const s = setup(); s.card.pricingMethod = 'BASE_PLUS_DISTANCE';
    const quote = priced(s);
    const failed = { ...structuredClone(quote), status: 'NEEDS_ATTENTION' as const, rateCard: null, method: null, errors: [{ code: 'LEGACY_TIME_PRICING' as const, message: 'Legacy time charges' }], total: 0, subtotal: 0, lines: [] };
    const job = { id: 'failed', status: 'no_driver', pricingInput: s.order, pricing: failed } as Job;
    const preserved = [
      { ...job, id: 'agreed', pricing: quote },
      { ...job, id: 'final', pricing: { ...quote, stage: 'FINAL' as const } },
      { ...job, id: 'completed', status: 'completed' as const },
      { ...job, id: 'final-failure', pricing: { ...failed, stage: 'FINAL' as const } },
      { ...job, id: 'other-error', pricing: { ...failed, errors: [{ code: 'MISSING_DISTANCE' as const, message: 'Missing distance' }] } },
      { ...job, id: 'invoiced', invoicePreview: { id: 'invoice' } as Job['invoicePreview'] }
    ];
    s.card.minuteRate = 0.4; s.card.includedMinutes = 20;
    data.set(PRICING_STORAGE_KEY, JSON.stringify({ ...s.ctx.pricing, schemaVersion: 2 }));
    saveOrders([job, ...preserved]);
    const restored = loadSavedOrders([]);
    assert.equal(restored[0].pricing?.status, 'PRICED');
    assert.equal(restored[0].pricing?.rateCard?.id, s.card.id);
    assert.equal(restored[0].pricing?.method, 'BASE_PLUS_DISTANCE');
    assert.equal(restored[0].pricing?.lines.some(l => l.key === 'time'), false);
    assert.equal(pricingAttentionItems([restored[0]]).length, 0);
    assert.deepEqual(restored.slice(1), JSON.parse(JSON.stringify(preserved)));
    saveOrders(restored);
    assert.deepEqual(loadSavedOrders([]), JSON.parse(JSON.stringify(restored)));
    assert.equal(data.has('dispatra_orders_v1'), true);
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('legacy Zone fallback prices normally and real missing-distance errors remain visible', () => {
  const s = setup(); s.card.pricingMethod = 'ZONE'; s.card.zoneNoMatchFallback = 'BASE_PLUS_DISTANCE';
  s.card.minuteRate = 0.5; s.card.includedMinutes = 10;
  assert.equal(priced(s).method, 'BASE_PLUS_DISTANCE');
  s.order.routeKm = null;
  assert.equal(calculatePricing(s.order, s.ctx).errors[0]?.code, 'MISSING_DISTANCE');
});

test('contract editor no longer asks users to migrate retired routine time pricing', async () => {
  const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server');
  const { ContractRulesEditor } = await import('../src/components/pricing/ContractRulesEditor');
  const s = setup(); s.card.pricingMethod = 'BASE_PLUS_DISTANCE'; s.card.minuteRate = 0.5;
  const markup = renderToStaticMarkup(React.createElement(ContractRulesEditor, { card: s.card, patch: () => {}, zones: [], services: s.ctx.catalogue.services, organizationMinimum: 0 }));
  assert.doesNotMatch(markup, /New quotes are blocked|Convert to hourly|legacy card charges/);
});

test('serialized hourly quotes settle using frozen terms after reload', () => {
  const s = setup(); s.card.pricingMethod = 'HOURLY'; s.card.minimumBillableMinutes = 0; s.card.hourlyRate = 60; s.order.hourlyBillableMinutes = 60;
  const reloadedQuote = JSON.parse(JSON.stringify(priced(s))); s.card.hourlyRate = 900;
  const result = finalizeOrderPrice(s.order, 90, s.ctx, reloadedQuote);
  assert.equal(result.snapshot.status, 'PRICED'); assert.equal(result.snapshot.freight, 90);
});

test('tax-inclusive accessorial unit rates retain precision until the charge is calculated', () => {
  for (const calculationType of ['PER_UNIT', 'PER_MINUTE', 'PER_HOUR', 'FLAT'] as const) {
    const s = setup(); s.card.fixedAmount = 0; s.billing.invoicing.pricesIncludeTax = true;
    const acc = { ...s.ctx.catalogue.accessorials[0], id: 'unit', calculationType, autoRule: 'NONE' as const, appliesAt: 'PER_STOP' as const, rate: 1, freeAllowance: 0, incrementMinutes: 0, minimumCharge: null, maximumCharge: null, taxable: true };
    s.ctx.catalogue.accessorials = [acc]; s.order.accessorials = [{ accessorialId: acc.id, quantity: 100 }];
    const result = priced(s);
    assert.equal(result.total, 100, calculationType);
    assert.equal(result.subtotal, 95.24); assert.equal(result.taxTotal, 4.76);
  }
});

test('inclusive waiting rates and per-stop caps do not accumulate unit rounding errors', () => {
  const s = setup(); s.card.fixedAmount = 0; s.billing.invoicing.pricesIncludeTax = true;
  const wait = s.ctx.catalogue.accessorials.find(a => a.code === 'WAIT')!;
  s.ctx.catalogue.accessorials = [wait]; wait.rate = 1; wait.freeAllowance = 0; wait.incrementMinutes = 0;
  s.order.stops[0].waitMinutes = 100;
  assert.equal(priced(s).total, 100);
  wait.maximumCharge = 1; s.order.stops[1].waitMinutes = 100;
  assert.equal(priced(s).total, 2);
});

test('unit rates preserve exclusive and non-taxable amounts and contract overrides', () => {
  for (const inclusive of [false, true]) {
    const s = setup(); s.card.fixedAmount = 0; s.billing.invoicing.pricesIncludeTax = inclusive;
    const acc = { ...s.ctx.catalogue.accessorials[0], id: 'unit', calculationType: 'PER_UNIT' as const, autoRule: 'NONE' as const, rate: 9, freeAllowance: 0, minimumCharge: null, maximumCharge: null, taxable: true };
    s.ctx.catalogue.accessorials = [acc]; s.card.accessorialRateOverrides[acc.id] = 1;
    s.order.accessorials = [{ accessorialId: acc.id, quantity: 100 }];
    assert.equal(priced(s).total, inclusive ? 100 : 105);
    acc.taxable = false; assert.equal(priced(s).total, 100);
    acc.taxable = true;
    const customer = { ...structuredClone(DEFAULT_CUSTOMERS[0]), taxExempt: true, rateCardId: null, customerGroupId: null };
    s.ctx.customers = [customer]; s.order.customerId = customer.id;
    assert.equal(priced(s).total, 100);
  }
});

const assignedCardSetup = (scope: 'CUSTOMER' | 'CUSTOMER_GROUP') => {
  const s = setup();
  const customer = { ...structuredClone(DEFAULT_CUSTOMERS[0]), id: 'customer', customerGroupId: 'group', rateCardId: scope === 'CUSTOMER' ? 'selected' : null, taxExempt: false };
  s.ctx.customers = [customer]; s.order.customerId = customer.id;
  s.ctx.pricing.customerGroups = [{ id: 'group', name: 'Group', description: '', rateCardId: scope === 'CUSTOMER_GROUP' ? 'selected' : null, discount: { type: 'NONE', value: 0, scope: 'SUBTOTAL' } }];
  Object.assign(s.card, { scope, customerId: scope === 'CUSTOMER' ? customer.id : null, customerGroupId: scope === 'CUSTOMER_GROUP' ? 'group' : null, priority: 100, serviceId: s.order.serviceId, vehicleId: s.order.vehicleId, fixedAmount: 200 });
  const selected = createEmptyRateCard({ ...s.card, id: 'selected', serviceId: null, vehicleId: null, priority: 0, fixedAmount: 50 });
  s.ctx.pricing.rateCards.push(selected);
  return { ...s, selected };
};

test('eligible assigned customer and group cards beat more specific or higher-priority matches', () => {
  for (const scope of ['CUSTOMER', 'CUSTOMER_GROUP'] as const) {
    const s = assignedCardSetup(scope);
    const result = priced(s); assert.equal(result.rateCard?.id, 'selected'); assert.equal(result.freight, 50);
    // Equal-priority alternatives also must not turn an explicit selection into a conflict.
    s.card.serviceId = null; s.card.vehicleId = null; s.card.priority = 0;
    assert.equal(priced(s).rateCard?.id, 'selected');
  }
});

test('ineligible or missing assigned cards fall back to eligible matching cards', () => {
  const invalid: Partial<RateCard>[] = [{ status: 'ARCHIVED' }, { status: 'DRAFT' }, { effectiveTo: '2020-01-02' }, { effectiveFrom: '2099-01-01' }, { serviceId: 'other-service' }, { vehicleId: 'other-vehicle' }, { id: 'no-longer-selected' }];
  for (const scope of ['CUSTOMER', 'CUSTOMER_GROUP'] as const) {
    for (const changes of invalid) {
      const s = assignedCardSetup(scope); Object.assign(s.selected, changes);
      assert.equal(priced(s).rateCard?.id, s.card.id, JSON.stringify({ scope, changes }));
    }
  }
});

test('assigned cards retain explicit order override and customer-over-group precedence', () => {
  const s = assignedCardSetup('CUSTOMER_GROUP');
  const customerCard = createEmptyRateCard({ ...s.card, id: 'customer-specific', scope: 'CUSTOMER', customerId: 'customer', customerGroupId: null, fixedAmount: 75 });
  s.ctx.pricing.rateCards.push(customerCard);
  assert.equal(priced(s).rateCard?.id, customerCard.id);
  s.order.rateCardOverrideId = s.selected.id;
  assert.equal(priced(s).rateCard?.id, s.selected.id);
});

test('matching cards without an explicit selection still report equal-priority conflicts', () => {
  const s = assignedCardSetup('CUSTOMER'); s.ctx.customers[0].rateCardId = null;
  s.card.serviceId = null; s.card.vehicleId = null; s.card.priority = 0;
  assert.equal(calculatePricing(s.order, s.ctx).errors[0]?.code, 'RATE_CARD_CONFLICT');
});

test('shared order form exposes manual minute quantities while waiting remains automatic', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
  const s = setup(); s.card.fixedAmount = 0;
  const wait = s.ctx.catalogue.accessorials.find(a => a.code === 'WAIT')!;
  const manual = { ...wait, id: 'manual-minute', name: 'Special handling time', autoRule: 'NONE' as const, appliesAt: 'ORDER' as const, rate: 2, freeAllowance: 5, incrementMinutes: 5 };
  s.ctx.catalogue.accessorials = [wait, manual]; s.order.stops[0].waitMinutes = 30;
  s.order.accessorials = [{ accessorialId: manual.id, quantity: 12 }];
  const result = priced(s);
  const markup = renderToStaticMarkup(React.createElement(OrderPricingForm, { value: s.order, onChange: () => {}, ctx: s.ctx, snapshot: result }));
  assert.match(markup, /Special handling time/);
  assert.match(markup, /<input[^>]*aria-label="Special handling time minutes"[^>]*value="12"/);
  assert.doesNotMatch(markup, /Waiting Time/);
  assert.equal(result.lines.find(l => l.key === 'acc_manual-minute')?.amount, 20);
  assert.equal(result.lines.filter(l => l.key === `acc_${wait.id}`).length, 1);
  s.order.accessorials = [];
  assert.equal(priced(s).lines.some(l => l.key === 'acc_manual-minute'), false);
});
