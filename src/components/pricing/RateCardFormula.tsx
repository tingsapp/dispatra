import { hasDimensionalWeightSetting } from '../../lib/dimensionalWeight';
import { zoneRateIssue } from '../../lib/zoneWeightBands';
import { useMemo } from 'react';
import { createDefaultOrderInput, createStop } from '../../lib/orderPricing';
import { calculatePricing, PricingContext } from '../../lib/pricingEngine';
import { fromDisplayDistance, toDisplayDimension, toDisplayDivisor, toDisplayDistance, toDisplayDistanceRate, toDisplayWeight } from '../../lib/units';
import { BillingConfig } from '../../types/billing';
import { PricingConfig, RateCard } from '../../types/pricing';
import { SimplePricingConfig } from '../../types/simplePricing';
import { SettingsDisclosure } from '../settings/SettingsLayout';

const money = (n: number) => `$${n.toFixed(2)}`;
const EXAMPLE_DISTANCE = 12;

/**
 * Read-only worked example: one realistic order priced through the real engine with this card,
 * shown as the values it used and the single formula that combines them.
 */
export function RateCardFormula({ card, config, billing, catalogue }: { card: RateCard; config: PricingConfig; billing: BillingConfig; catalogue: SimplePricingConfig }) {
  const units = billing.general;
  const unit = units.distanceUnit;
  const example = useMemo(() => {
    const services = catalogue.services.filter(s => s.active);
    const service = services.find(s => /rush/i.test(s.name)) ?? services.find(s => (s.additionalCharge ?? 0) > 0) ?? services[0];
    const vehicles = catalogue.vehicles.filter(v => v.active);
    const vehicle = vehicles.find(v => v.baseSurcharge > 0) ?? vehicles[0];
    const usable = catalogue.accessorials.filter(a => a.active && a.autoRule === 'NONE' && a.rate > 0 && !a.calculationType.startsWith('PERCENT') && a.calculationType !== 'PER_MINUTE' && a.calculationType !== 'PER_HOUR');
    const stairs = usable.find(a => /stair/i.test(a.name));
    const accessorials = [stairs, ...usable.filter(a => a !== stairs)].filter((a): a is NonNullable<typeof a> => !!a).slice(0, 3);
    const priced = (card.zoneRates ?? []).find(rate => !zoneRateIssue(rate));
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
      packages: [{ ...base.packages[0], quantity: card.pricingMethod === 'ZONE' ? 1 : 2, weightKg: 20, lengthCm: 60, widthCm: 50, heightCm: 40, pickupStopId: pickup.id, deliveryStopId: drops[0].id }, ...(card.pricingMethod === 'ZONE' ? [{ ...base.packages[0], id: 'example-second-package', quantity: 1, weightKg: 20, lengthCm: 60, widthCm: 50, heightCm: 40, pickupStopId: pickup.id, deliveryStopId: drops[1].id }] : [])],
      routeKm: fromDisplayDistance(EXAMPLE_DISTANCE, units), estimatedMinutes: 45, hourlyBillableMinutes: 150,
      accessorials: accessorials.map(a => ({ accessorialId: a.id, quantity: 1 })),
      rateCardOverrideId: card.id
    };
    const snapshot = calculatePricing(order, ctx);
    return { service, vehicle, accessorials, snapshot };
  }, [card, config, billing, catalogue]);
  const { service, vehicle, accessorials, snapshot } = example;
  const ok = snapshot.status === 'PRICED';
  const line = (key: string) => snapshot.lines.find(l => l.key === key)?.amount ?? 0;
  const serviceCharge = snapshot.inputs.serviceCharge ?? 0;
  const baseFreightAmount = card.pricingMethod === 'BASE_PLUS_DISTANCE' ? line('base_fee') + line('distance') : snapshot.freight;
  const { actualWeightKg, dimensionalWeightKg, chargeableWeightKg, pieces } = snapshot.inputs;
  const w = (kg: number) => `${toDisplayWeight(kg, units).toFixed(1)} ${units.weightUnit}`;
  const dimOn = snapshot.inputs.dimensionalPricingEnabled;
  const weightedMethod = hasDimensionalWeightSetting(card.pricingMethod);
  const dimensions = [60, 50, 40].map(cm => Number(toDisplayDimension(cm, units).toFixed(2))).join(' × ');
  const billableDistance = Number(toDisplayDistance(snapshot.inputs.billableKm, units).toFixed(2));
  const fuelBase = snapshot.inputs.fuelBase;
  const discountBase = snapshot.serviceFreight + snapshot.vehicleSurcharge + snapshot.minimumAdjustment;
  const minimum = card.applyOrderMinimum === false ? 0 : card.minimumOrderSubtotal ?? 0;
  const chargesBeforeMinimum = snapshot.subtotal - snapshot.minimumAdjustment;

  const baseFreight: Record<RateCard['pricingMethod'], string> = {
    BASE_PLUS_DISTANCE: `${money(card.baseFee)} + max(0, ${billableDistance} − ${toDisplayDistance(card.includedKm, units)}) ${unit} × ${money(toDisplayDistanceRate(card.kmRate, units))}`,
    FIXED: `${money(card.fixedAmount)} per delivery`,
    ZONE: 'zone rate for the pickup → delivery pair',
    HOURLY: `150 min ÷ 60 × ${money(card.hourlyRate)}/h`,
    IMPORTED: 'imported price'
  };
  const explain: Record<RateCard['pricingMethod'], string> = {
    BASE_PLUS_DISTANCE: `Base fee covers the first ${toDisplayDistance(card.includedKm, units)} ${unit}; extra distance is charged separately.`,
    FIXED: 'One price per order, regardless of distance.',
    ZONE: 'Pickup → delivery price from this card’s routes; weight bands use the greater of actual and dimensional weight on each movement.',
    HOURLY: `Minimum ${card.minimumBillableMinutes} min; rounded to ${card.billingIncrementMinutes}-min intervals.`,
    IMPORTED: 'Freight supplied by the external system.'
  };
  const values: [string, string, string][] = [
    ['Base freight', `${baseFreight[card.pricingMethod]} = ${money(baseFreightAmount)}`, explain[card.pricingMethod]],
    ['Packages', weightedMethod ? `${pieces} × ${w(20)} (${dimensions} ${units.dimensionUnit}) → actual ${w(actualWeightKg)}, dimensional ${w(dimensionalWeightKg)}, chargeable ${w(chargeableWeightKg)}` : `${pieces} packages · actual ${w(actualWeightKg)}`, weightedMethod ? `Dimensional weight per package: L × W × H ÷ ${Number(toDisplayDivisor(snapshot.inputs.dimensionalDivisor, units).toFixed(2))} ${units.dimensionUnit}³/${units.weightUnit}; summed across quantities. Chargeable weight uses ${dimOn ? 'the higher of total actual or dimensional weight' : 'actual weight'}. Settings: this card’s Dimensional Weight.` : 'Package weight and dimensions do not change this method’s base price.'],
    ['Service charge', service ? `${service.name} +${money(serviceCharge)}` : 'no active service', 'Added once per order. Settings: Pricing → Service Level.'],
    ['Vehicle surcharge', vehicle ? `${vehicle.name} = ${money(snapshot.vehicleSurcharge)}` : 'no vehicle', 'Added for this vehicle type. Settings: Vehicles → Vehicle Types.'],
    ['Accessorials', accessorials.length ? `${accessorials.map(a => `${a.name} ${money(line(`acc_${a.id}`))}`).join(' + ')} = ${money(snapshot.accessorialsTotal)}` : 'none on this order', 'Selected extras, charged once per order. Settings: Pricing → Accessorials.'],
    ['Fuel surcharge', snapshot.fuelSurcharge > 0 ? `${billing.fuelSurcharge.percent}% × ${money(fuelBase)} = ${money(snapshot.fuelSurcharge)}` : 'none', 'Percentage of fuel-eligible charges. Settings: Pricing → Fuel Charge.'],
    ['Discount', snapshot.discount > 0 ? `${card.discount.type === 'PERCENT' ? `${card.discount.value}% × ${money(discountBase)}` : money(card.discount.value)} = −${money(snapshot.discount)}` : 'none', 'Set discounts on the Shipper form. None in this example.'],
    ['Minimum charge', minimum > 0 ? money(minimum) : 'none', 'Raises the subtotal to this amount before tax.'],
    ['Tax', `${snapshot.taxDecision?.description ?? 'Tax / GST'} = ${money(snapshot.taxTotal)}`, 'Applies to taxable charges. Settings: Company → Taxes.'],
  ];
  const formula = [
    `Freight   = ${money(snapshot.freight)} + ${money(serviceCharge)} = ${money(snapshot.serviceFreight)}`,
    `Charges   = ${money(snapshot.serviceFreight)} + ${money(snapshot.vehicleSurcharge)} + ${money(snapshot.accessorialsTotal)} + ${money(snapshot.fuelSurcharge)} + ${money(snapshot.companyCharge)} − ${money(snapshot.discount)} = ${money(chargesBeforeMinimum)}`,
    `Subtotal  = greater of ${money(chargesBeforeMinimum)} and ${money(minimum)} = ${money(snapshot.subtotal)}`,
    `Total     = ${money(snapshot.subtotal)} + ${money(snapshot.taxTotal)} tax = ${money(snapshot.total)}`,
  ].join('\n');

  const scenario = `${EXAMPLE_DISTANCE} ${unit}, 3 stops, ${service?.name ?? 'default service'}${vehicle ? `, ${vehicle.name}` : ''}${accessorials.length ? `, ${accessorials.map(a => a.name).join(', ')}` : ''}, delivered in BC`;
  return <SettingsDisclosure title="Pricing formula" description={ok ? `Example: ${EXAMPLE_DISTANCE} ${unit}, 3 stops · ${money(snapshot.total)}` : 'Complete rates to preview pricing.'}>
    <p className="text-xs text-slate-500">Live example: {scenario}.</p>
    {ok ? <>
      <dl aria-label="Pricing values" className="grid grid-cols-[auto_1fr] sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-xs">
        {values.map(([name, value, description]) => <div key={name} className="contents">
          <dt className="font-medium text-slate-700 whitespace-nowrap">{name} =</dt>
          <dd><span className={`font-mono text-xs ${value === 'none' ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span><span className="block text-xs text-slate-500 mt-0.5">{description}</span></dd>
        </div>)}
      </dl>
      <pre aria-label="Pricing formula" className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs leading-5 text-slate-800 overflow-x-auto whitespace-pre">{formula}</pre>
      <p className="mt-3 text-sm font-medium text-slate-900">Example total: {money(snapshot.total)}</p>
    </> : <p role="status" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{snapshot.errors[0]?.message ?? 'Complete the rates above to see a worked example.'}</p>}
  </SettingsDisclosure>;
}
