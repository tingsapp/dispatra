import { useMemo } from 'react';
import { createDefaultOrderInput, createStop } from '../../lib/orderPricing';
import { calculatePricing, PricingContext } from '../../lib/pricingEngine';
import { toDisplayDistance, toDisplayDistanceRate, toDisplayWeight, toDisplayWeightRate } from '../../lib/units';
import { BillingConfig } from '../../types/billing';
import { PricingConfig, RateCard } from '../../types/pricing';
import { SimplePricingConfig } from '../../types/simplePricing';
import { SettingsDisclosure } from '../settings/SettingsLayout';

const money = (n: number) => `$${n.toFixed(2)}`;
const EXAMPLE_KM = 12;

/**
 * Read-only worked example: one realistic order priced through the real engine with this card,
 * shown as the values it used and the single formula that combines them.
 */
export function RateCardFormula({ card, config, billing, catalogue }: { card: RateCard; config: PricingConfig; billing: BillingConfig; catalogue: SimplePricingConfig }) {
  const units = billing.general;
  const unit = units.distanceUnit;
  const example = useMemo(() => {
    const services = catalogue.services.filter(s => s.active);
    const service = services.find(s => /rush/i.test(s.name)) ?? services.find(s => s.defaultMultiplier !== 1) ?? services[0];
    const vehicles = catalogue.vehicles.filter(v => v.active);
    const vehicle = vehicles.find(v => v.baseSurcharge > 0) ?? vehicles[0];
    const usable = catalogue.accessorials.filter(a => a.active && a.autoRule === 'NONE' && a.rate > 0 && !a.calculationType.startsWith('PERCENT') && a.calculationType !== 'PER_MINUTE' && a.calculationType !== 'PER_HOUR');
    const stairs = usable.find(a => /stair/i.test(a.name));
    const accessorials = [stairs, ...usable.filter(a => a !== stairs)].filter((a): a is NonNullable<typeof a> => !!a).slice(0, 3);
    const priced = (card.zoneRates ?? []).find(rate => rate.amount > 0);
    const origin = priced?.originZoneId ?? config.zones[0]?.id ?? null;
    const destination = priced?.destinationZoneId ?? config.zones[1]?.id ?? config.zones[0]?.id ?? null;
    const ctx: PricingContext = { billing, catalogue, pricing: { ...config, rateCards: [card] }, customers: [], asOf: new Date() };
    const pickup = createStop('PICKUP', { label: 'Vancouver, BC', countryCode: 'CA', provinceCode: 'BC', zoneId: origin });
    const drops = [1, 2].map(n => createStop('DROPOFF', { label: `Delivery ${n}, Vancouver, BC`, countryCode: 'CA', provinceCode: 'BC', zoneId: destination, pickupIds: [pickup.id] }));
    const base = createDefaultOrderInput(ctx);
    const order = {
      ...base,
      serviceId: service?.id ?? base.serviceId, vehicleId: vehicle?.id ?? null,
      stops: [pickup, ...drops],
      // Two boxes: one bulky-but-light so dimensional weight has something to show.
      packages: [{ ...base.packages[0], quantity: 2, weightKg: 20, lengthCm: 60, widthCm: 50, heightCm: 40, pickupStopId: pickup.id, deliveryStopId: drops[0].id }],
      routeKm: EXAMPLE_KM, estimatedMinutes: 45, hourlyBillableMinutes: 150,
      accessorials: accessorials.map(a => ({ accessorialId: a.id, quantity: /stair/i.test(a.name) ? 2 : 1 })),
      rateCardOverrideId: card.id
    };
    const snapshot = calculatePricing(order, ctx);
    return { service, vehicle, accessorials, snapshot };
  }, [card, config, billing, catalogue]);
  const { service, vehicle, accessorials, snapshot } = example;
  const ok = snapshot.status === 'PRICED';
  const line = (key: string) => snapshot.lines.find(l => l.key === key)?.amount ?? 0;
  const multiplier = service?.defaultMultiplier ?? 1;
  const freightBeforeMultiplier = card.pricingMethod === 'BASE_PLUS_DISTANCE' ? line('base_fee') + line('distance') : snapshot.freight;
  const weightCharge = line('load');
  const { actualWeightKg, dimensionalWeightKg, chargeableWeightKg, pieces } = snapshot.inputs;
  const w = (kg: number) => `${toDisplayWeight(kg, units).toFixed(1)} ${units.weightUnit}`;
  const dimOn = billing.general.dimensionalPricingEnabled;
  const extraStops = line('stops');
  const fuelBase = snapshot.inputs.fuelBase;
  const feeBase = snapshot.serviceFreight + snapshot.vehicleSurcharge + snapshot.accessorialsTotal;
  const discountBase = snapshot.serviceFreight + snapshot.vehicleSurcharge + snapshot.minimumAdjustment;
  const minimum = card.applyOrderMinimum === false ? 0 : card.minimumOrderSubtotal ?? 0;
  const sc = billing.serviceCharge;
  const chargesBeforeMinimum = snapshot.subtotal - snapshot.minimumAdjustment;

  const baseFreight: Record<RateCard['pricingMethod'], string> = {
    BASE_PLUS_DISTANCE: `${money(card.baseFee)} + (${EXAMPLE_KM} − ${toDisplayDistance(card.includedKm, units)} ${unit}) × ${money(toDisplayDistanceRate(card.kmRate, units))}`,
    FIXED: `${money(card.fixedAmount)} per delivery`,
    ZONE: 'zone rate for the pickup → delivery pair',
    HOURLY: `150 min ÷ 60 × ${money(card.hourlyRate)}/h`,
    IMPORTED: 'imported price'
  };
  const included = billing.general.defaultIncludedStops;
  const explain: Record<RateCard['pricingMethod'], string> = {
    BASE_PLUS_DISTANCE: `Base fee covers the first ${toDisplayDistance(card.includedKm, units)} ${unit}; every ${unit} beyond it is charged at the distance rate.`,
    FIXED: 'One agreed amount per order, whatever the distance.',
    ZONE: 'The price in this card\u2019s grid for the pickup zone → delivery zone of the example.',
    HOURLY: `Billable minutes (at least ${card.minimumBillableMinutes}, in ${card.billingIncrementMinutes}-min steps) × the hourly rate.`,
    IMPORTED: 'Freight comes with the order from the external system.'
  };
  const values: [string, string, string][] = [
    ['Base freight', `${baseFreight[card.pricingMethod]} = ${money(freightBeforeMultiplier)}`, explain[card.pricingMethod]],
    ['Packages', `${pieces} × ${w(20)} (60 × 50 × 40 cm) → actual ${w(actualWeightKg)}, dimensional ${w(dimensionalWeightKg)}, chargeable ${w(chargeableWeightKg)}`, `Dimensional weight = length × width × height ÷ ${billing.general.dimensionalDivisor}. Chargeable weight is ${dimOn ? 'the greater of actual and dimensional' : 'the actual weight (the dimensional rule is off)'}. Set under Pricing → Extras.`],
    ['Weight charge', card.pricingMethod === 'BASE_PLUS_DISTANCE' ? (card.weightRatePerKg > 0 ? `(${w(chargeableWeightKg)} − ${w(card.includedWeightKg)}) × ${money(toDisplayWeightRate(card.weightRatePerKg, units))}/${units.weightUnit} = ${money(weightCharge)}` : 'none') : 'none', card.pricingMethod === 'BASE_PLUS_DISTANCE' ? 'Chargeable weight beyond the included weight × this card\u2019s weight rate. 0 rate = weight is not charged.' : 'This pricing method does not charge by weight.'],
    ['Extra stops', `(3 − ${included}) × ${money(billing.general.defaultExtraStopRate)} = ${money(extraStops)}`, `Every order includes ${included} stops; each further stop adds ${money(billing.general.defaultExtraStopRate)}. Set under Pricing → Extras.`],
    ['Service multiplier', service ? `${service.name} ×${multiplier}` : 'no active service', 'The service chosen on the order scales base freight + weight charge + extra stops. Each service\u2019s multiplier is set under Services & Dispatch.'],
    ['Vehicle surcharge', vehicle ? `${vehicle.name} = ${money(snapshot.vehicleSurcharge)}` : 'no vehicle', 'Added when the order needs this vehicle type. Set on the vehicle type under Services & Dispatch.'],
    ['Accessorials', accessorials.length ? `${accessorials.map(a => `${a.name}${/stair/i.test(a.name) ? ' ×2' : ''} ${money(line(`acc_${a.id}`))}`).join(' + ')} = ${money(snapshot.accessorialsTotal)}` : 'none on this order', 'Extra services added on the order at their standard rate. Waiting recorded at stops is added automatically. Set under Pricing → Accessorials.'],
    ['Fuel surcharge', snapshot.fuelSurcharge > 0 ? `${billing.fuelSurcharge.percent}% × ${money(fuelBase)} = ${money(snapshot.fuelSurcharge)}` : 'none', 'Percentage of freight, vehicle surcharge and fuel-eligible Accessorials. Set under Pricing → Extras.'],
    ['Service fee', snapshot.companyCharge > 0 ? `${sc.mode === 'flat' ? money(sc.flatAmount) : `${sc.percent}% × ${money(feeBase)}`} = ${money(snapshot.companyCharge)}` : 'none', 'The company\u2019s fee on every order, on freight, vehicle surcharge and Accessorials. Set under Pricing → Extras.'],
    ['Discount', snapshot.discount > 0 ? `${card.discount.type === 'PERCENT' ? `${card.discount.value}% × ${money(discountBase)}` : money(card.discount.value)} = −${money(snapshot.discount)}` : 'none', 'This card\u2019s negotiated discount, taken off freight and vehicle surcharge only — never fuel, Accessorials, service fee or tax.'],
    ['Minimum charge', minimum > 0 ? money(minimum) : 'none', 'This card\u2019s floor: if the charges come to less, the order is raised to this amount before tax.'],
    ['Tax', snapshot.taxTotal > 0 ? `GST/HST (BC 5%) = ${money(snapshot.taxTotal)}` : 'none', 'GST/HST at the rate of the delivery province, on the taxable lines. Rates under Billing → Taxes.'],
  ];
  const formula = [
    `Freight   = (${money(freightBeforeMultiplier)} + ${money(weightCharge)} + ${money(extraStops)}) × ${multiplier} = ${money(snapshot.serviceFreight)}`,
    `Charges   = ${money(snapshot.serviceFreight)} + ${money(snapshot.vehicleSurcharge)} + ${money(snapshot.accessorialsTotal)} + ${money(snapshot.fuelSurcharge)} + ${money(snapshot.companyCharge)} − ${money(snapshot.discount)} = ${money(chargesBeforeMinimum)}`,
    `Subtotal  = greater of ${money(chargesBeforeMinimum)} and ${money(minimum)} = ${money(snapshot.subtotal)}`,
    `Total     = ${money(snapshot.subtotal)} + ${money(snapshot.taxTotal)} tax = ${money(snapshot.total)}`,
  ].join('\n');

  const scenario = `${EXAMPLE_KM} ${unit}, 3 stops, ${service?.name ?? 'default service'}${vehicle ? `, ${vehicle.name}` : ''}${accessorials.length ? `, ${accessorials.map(a => a.name).join(', ')}` : ''}, delivered in BC`;
  return <SettingsDisclosure title="Pricing formula" description={ok ? `Example order (${scenario}) totals ${money(snapshot.total)} on this card.` : `Example order (${scenario}) cannot be priced yet.`}>
    <p className="text-xs text-slate-500">A worked example priced with this card, updating as you edit.</p>
    {ok ? <>
      <dl aria-label="Pricing values" className="grid grid-cols-[auto_1fr] sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-xs">
        {values.map(([name, value, description]) => <div key={name} className="contents">
          <dt className="font-medium text-slate-700 whitespace-nowrap">{name} =</dt>
          <dd><span className={`font-mono text-[11px] ${value === 'none' ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span><span className="block text-[11px] text-slate-500 mt-0.5">{description}</span></dd>
        </div>)}
      </dl>
      <pre aria-label="Pricing formula" className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] leading-5 text-slate-800 overflow-x-auto whitespace-pre">{formula}</pre>
      <p className="mt-3 text-sm font-semibold text-slate-900">Example total: {money(snapshot.total)}</p>
    </> : <p role="status" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{snapshot.errors[0]?.message ?? 'Complete the rates above to see a worked example.'}</p>}
  </SettingsDisclosure>;
}
