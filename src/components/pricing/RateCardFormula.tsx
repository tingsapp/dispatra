import { useMemo } from 'react';
import { createDefaultOrderInput, createStop, defaultServiceId } from '../../lib/orderPricing';
import { calculatePricing, PricingContext } from '../../lib/pricingEngine';
import { fromDisplayDistance, toDisplayDistance, toDisplayDistanceRate, toDisplayWeight } from '../../lib/units';
import { zoneRateIssue } from '../../lib/zoneWeightBands';
import { BillingConfig } from '../../types/billing';
import { PricingConfig, RateCard } from '../../types/pricing';
import { SimplePricingConfig } from '../../types/simplePricing';
import { SettingsDisclosure } from '../settings/SettingsLayout';

const money = (amount: number) => `$${amount.toFixed(2)}`;
const round = (amount: number) => Math.round(amount * 100) / 100;
const EXAMPLE_DISTANCE = 12;
const EXAMPLE_IMPORTED_AMOUNT = 100;

/** A worked example for the card, calculated by the pricing engine, in plain language. */
export function RateCardFormula({ card, config, billing, catalogue }: { card: RateCard; config: PricingConfig; billing: BillingConfig; catalogue: SimplePricingConfig }) {
  const units = billing.general;
  const example = useMemo(() => {
    const services = catalogue.services.filter(service => service.active);
    // The example prices a normal order on the default service (Same-Day Standard).
    const service = services.find(item => item.id === defaultServiceId(catalogue.services));
    const usable = catalogue.accessorials.filter(item => item.active && item.autoRule === 'NONE' && item.rate > 0 && !item.calculationType.startsWith('PERCENT') && item.calculationType !== 'PER_MINUTE' && item.calculationType !== 'PER_HOUR');
    const stairs = usable.find(item => /stair/i.test(item.name));
    const accessorials = [stairs, ...usable.filter(item => item !== stairs)].filter((item): item is NonNullable<typeof item> => !!item).slice(0, 3);
    const priced = (card.zoneRates ?? []).find(rate => !zoneRateIssue(rate));
    const destination = priced?.destinationZoneId ?? config.zones[0]?.id ?? null;
    const origin = priced?.originZoneId ?? config.zones[0]?.id ?? null;
    const context: PricingContext = { billing, catalogue, pricing: { ...config, rateCards: [card] }, customers: [], asOf: new Date() };
    const pickup = createStop('PICKUP', { label: 'Vancouver, BC', countryCode: 'CA', provinceCode: 'BC', zoneId: origin });
    // Zone cards price one pickup to one delivery zone; the other methods show a two-drop route.
    const drops = (card.pricingMethod === 'ZONE' ? [1] : [1, 2]).map(index => createStop('DROPOFF', { label: `Delivery ${index}, Vancouver, BC`, countryCode: 'CA', provinceCode: 'BC', zoneId: destination, pickupIds: [pickup.id] }));
    const base = createDefaultOrderInput(context);
    const packageOne = { ...base.packages[0], quantity: card.pricingMethod === 'ZONE' ? 1 : 2, weightKg: 20, lengthCm: 60, widthCm: 50, heightCm: 40, pickupStopId: pickup.id, deliveryStopId: drops[0].id };
    const order = {
      ...base,
      serviceId: service?.id ?? base.serviceId, vehicleId: null,
      stops: [pickup, ...drops],
      packages: [packageOne],
      routeKm: fromDisplayDistance(EXAMPLE_DISTANCE, units), estimatedMinutes: 45, hourlyBillableMinutes: 150,
      accessorials: accessorials.map(item => ({ accessorialId: item.id, quantity: 1 })),
      source: card.pricingMethod === 'IMPORTED' ? 'IMPORT' as const : base.source,
      taxCalculation: card.pricingMethod === 'IMPORTED' ? undefined : base.taxCalculation,
      importedPrice: card.pricingMethod === 'IMPORTED' ? EXAMPLE_IMPORTED_AMOUNT : null,
      importedTaxTreatment: card.pricingMethod === 'IMPORTED' && card.importedPriceMode === 'FINAL_TOTAL' ? 'EXEMPT' as const : undefined,
      rateCardOverrideId: card.id
    };
    return { service, accessorials, destination, snapshot: calculatePricing(order, context) };
  }, [card, config, billing, catalogue, units]);

  const { service, accessorials, destination, snapshot } = example;
  const ok = snapshot.status === 'PRICED';
  const zoneName = config.zones.find(zone => zone.id === destination)?.name ?? 'Delivery zone';
  const distanceUnit = units.distanceUnit;
  const displayWeight = (kg: number) => `${toDisplayWeight(kg, units).toFixed(1)} ${units.weightUnit}`;
  const minimum = card.applyOrderMinimum === false ? 0 : card.minimumOrderSubtotal ?? billing.rules.minimumChargePerJob;
  const finalImported = card.pricingMethod === 'IMPORTED' && card.importedPriceMode === 'FINAL_TOTAL';
  const methodValues: [string, string][] = [];
  if (ok) {
    switch (card.pricingMethod) {
      case 'BASE_PLUS_DISTANCE': {
        const billable = toDisplayDistance(snapshot.inputs.billableKm, units);
        const included = toDisplayDistance(card.includedKm, units);
        const extra = Math.max(0, billable - included);
        methodValues.push(['Distance', `${Number(billable.toFixed(2))} ${distanceUnit} billable; ${Number(included.toFixed(2))} ${distanceUnit} included`]);
        methodValues.push(['Delivery charge', `${money(card.baseFee)} + ${Number(extra.toFixed(2))} ${distanceUnit} × ${money(toDisplayDistanceRate(card.kmRate, units))}/${distanceUnit} = ${money(snapshot.freight)}`]);
        break;
      }
      case 'FIXED':
        methodValues.push(['Delivery charge', `${money(card.fixedAmount)} fixed = ${money(snapshot.freight)}`]);
        break;
      case 'ZONE': {
        const dimensional = 60 * 50 * 40 / snapshot.inputs.dimensionalDivisor;
        methodValues.push(['Weight', displayWeight(Math.max(20, dimensional))]);
        methodValues.push(['Delivery charge', `Pickup → ${zoneName} = ${money(snapshot.freight)}`]);
        break;
      }
      case 'HOURLY':
        methodValues.push(['Time', `150 min entered; ${card.minimumBillableMinutes} min minimum; ${card.billingIncrementMinutes} min increments`]);
        methodValues.push(['Delivery charge', `${snapshot.inputs.billableMinutes} min ÷ 60 × ${money(card.hourlyRate)}/h = ${money(snapshot.freight)}`]);
        break;
      case 'IMPORTED':
        methodValues.push([finalImported ? 'Final total' : 'Delivery charge', money(finalImported ? snapshot.total : snapshot.freight)]);
        break;
    }
  }
  const values: [string, string][] = [...methodValues];
  if (ok && !finalImported) {
    if (service) values.push(['Service charge', `${service.name}: ${money(snapshot.inputs.serviceCharge ?? 0)}`]);
    if (snapshot.accessorialsTotal) values.push(['Accessorials', `${accessorials.map(item => item.name).join(', ')}: ${money(snapshot.accessorialsTotal)}`]);
    if (snapshot.fuelSurcharge) values.push(['Fuel surcharge', `${card.fuelPercent ?? billing.fuelSurcharge.percent}% of ${money(snapshot.inputs.fuelBase)} = ${money(snapshot.fuelSurcharge)}`]);
    if (snapshot.discount) values.push(['Discount', `−${money(snapshot.discount)}`]);
  }
  const subtotalTerms = [money(snapshot.freight)];
  const addSubtotalTerm = (amount: number) => {
    if (Math.abs(amount) < 0.005) return;
    subtotalTerms.push(`${amount < 0 ? '−' : '+'} ${money(Math.abs(amount))}`);
  };
  addSubtotalTerm(snapshot.serviceFreight - snapshot.freight);
  addSubtotalTerm(snapshot.accessorialsTotal);
  addSubtotalTerm(snapshot.fuelSurcharge);
  addSubtotalTerm(snapshot.companyCharge);
  addSubtotalTerm(-snapshot.discount);
  addSubtotalTerm(snapshot.adjustmentsTotal);
  const charges = round(snapshot.subtotal - snapshot.minimumAdjustment);
  const subtotalEquation = finalImported
    ? `${money(snapshot.subtotal)} agreed amount`
    : `${subtotalTerms.length > 1 ? `${subtotalTerms.join(' ')} = ` : ''}${money(charges)}`;
  const hasMinimum = !finalImported && minimum > 0;
  const comparison = minimum < charges ? '<' : minimum > charges ? '>' : '=';
  const minimumEquation = `${money(minimum)} minimum ${comparison} ${money(charges)} = ${money(snapshot.subtotal)}`;
  const taxParts = snapshot.taxLines.map(taxLine => {
    if (taxLine.quantity == null || taxLine.unitRate == null) return `${taxLine.label}: ${money(taxLine.amount)}`;
    const name = snapshot.taxLines.length > 1 ? `${taxLine.label.replace(/\s+\([\d.]+%\)$/, '')}: ` : '';
    return `${name}${money(taxLine.quantity)} × ${Number((taxLine.unitRate * 100).toFixed(4))}%`;
  });
  const taxEquation = finalImported
    ? `${money(snapshot.subtotal)} × 0% (exempt) = ${money(snapshot.taxTotal)}`
    : taxParts.length ? `${taxParts.join(' + ')} = ${money(snapshot.taxTotal)}` : `${money(snapshot.taxTotal)} (no applicable tax)`;
  const rounding = snapshot.roundingAdjustment ?? 0;
  const totalEquation = `${money(snapshot.subtotal)} + ${money(snapshot.taxTotal)}${Math.abs(rounding) >= 0.005 ? ` ${rounding < 0 ? '−' : '+'} ${money(Math.abs(rounding))} rounding` : ''} = ${money(snapshot.total)}`;
  const summary = !ok ? 'Complete rates to preview pricing.' : {
    BASE_PLUS_DISTANCE: `Example: ${EXAMPLE_DISTANCE} ${distanceUnit}, 3 stops · ${money(snapshot.total)}`,
    FIXED: `Example: ${money(card.fixedAmount)} fixed · ${money(snapshot.total)} total`,
    ZONE: `Example: pickup to ${zoneName} · ${money(snapshot.total)} total`,
    HOURLY: `Example: ${snapshot.inputs.billableMinutes} billable min · ${money(snapshot.total)} total`,
    IMPORTED: `Example: ${money(EXAMPLE_IMPORTED_AMOUNT)} imported · ${money(snapshot.total)} total`
  }[card.pricingMethod];

  return <SettingsDisclosure title="How pricing works" description={summary}>
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h4 className="font-semibold text-slate-900">Example values</h4>
        {ok ? <><dl aria-label="Pricing values" className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {values.map(([label, value]) => <div key={label} className="contents">
            <dt className={label === 'Total' ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}>{label}</dt>
            <dd className={label === 'Total' ? 'font-semibold text-slate-900' : 'text-slate-900'}>{value}</dd>
          </div>)}
        </dl>
          <div aria-label="Example calculation" className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-900">
            {hasMinimum ? <>
              <p><span className="font-semibold">Charges</span> = {subtotalEquation}</p>
              <p><span className="font-semibold">Subtotal</span> = {minimumEquation}</p>
            </> : <p><span className="font-semibold">Subtotal</span> = {subtotalEquation}</p>}
            <p><span className="font-semibold">Tax</span> = {taxEquation}</p>
            <p><span className="font-semibold">Total</span> = {totalEquation}</p>
          </div>
        </> : <>
          {card.pricingMethod === 'ZONE' && <>
            <p className="mt-1 text-xs text-slate-600">Sample only, not saved: 0–99 {units.weightUnit} to {zoneName} at $20.00. Enter a rate in the matrix for a calculated total.</p>
            <div aria-label="Example calculation" className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-700">
              <p><span className="font-semibold">Charges</span> = zone rates + other charges − discounts</p>
              <p><span className="font-semibold">Subtotal</span> = minimum compared with charges = the larger amount</p>
              <p><span className="font-semibold">Tax</span> = taxable charges × applicable tax rate</p>
              <p><span className="font-semibold">Total</span> = subtotal + tax</p>
            </div>
          </>}
          <p role="status" className="mt-2 text-xs text-amber-700">{snapshot.errors[0]?.message ?? 'Complete the rates above to see example values.'}</p>
        </>}
      </div>
    </div>
  </SettingsDisclosure>;
}
