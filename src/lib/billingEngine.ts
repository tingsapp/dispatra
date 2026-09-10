import {
  BillingConfig,
  ChargeGroup,
  QuoteBreakdown,
  QuoteLine,
  SurchargeBasis
} from '../types/billing';

export interface QuoteInput {
  /** Service base fee + vehicle surcharge + distance charge. */
  transport: number;
  accessorials: number;
  /** Cost-side inputs. Omit to skip margin analysis. */
  distanceKm?: number;
  stopCount?: number;
  vehicleId?: string;
  /** Driving time estimate in minutes, if the caller has one. */
  driveMinutes?: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const roundMoney = (amount: number, rule: BillingConfig['rules']['moneyRounding']): number => {
  switch (rule) {
    case 'nearest_05':
      return round2(Math.round(amount * 20) / 20);
    case 'nearest_25':
      return round2(Math.round(amount * 4) / 4);
    case 'nearest_1':
      return round2(Math.round(amount));
    default:
      return round2(amount);
  }
};

/** Round distance up to the configured increment, then apply the billable floor. */
export const applyDistanceRules = (distanceKm: number, config: BillingConfig): number => {
  const { distanceRoundingKm, minimumBillableKm } = config.rules;
  let km = distanceKm;
  if (distanceRoundingKm > 0) {
    km = Math.ceil(km / distanceRoundingKm) * distanceRoundingKm;
  }
  return round2(Math.max(km, minimumBillableKm));
};

const basisAmount = (basis: SurchargeBasis, transport: number, accessorials: number): number => {
  switch (basis) {
    case 'transport_only':
      return transport;
    case 'transport_and_accessorials':
    case 'subtotal':
      return transport + accessorials;
    default:
      return transport;
  }
};

/** Effective fuel-surcharge percentage, resolving the index-pegged mode. */
export const resolveFuelPercent = (config: BillingConfig): number => {
  const fs = config.fuelSurcharge;
  if (!fs.enabled) return 0;
  if (fs.mode === 'fixed_percent') return Math.max(0, fs.percent);

  const centsAbove = Math.max(0, (fs.currentFuelPrice - fs.baselineFuelPrice) * 100);
  return round2(centsAbove * fs.percentPerCentAboveBaseline);
};

export const computeQuote = (input: QuoteInput, config: BillingConfig): QuoteBreakdown => {
  const transport = round2(Math.max(0, input.transport));
  const accessorials = round2(Math.max(0, input.accessorials));
  const lines: QuoteLine[] = [];

  // --- Company service charge ---
  let serviceCharge = 0;
  const sc = config.serviceCharge;
  if (sc.enabled) {
    const base = basisAmount(sc.basis, transport, accessorials);
    const asPercent = round2((base * sc.percent) / 100);
    if (sc.mode === 'percentage') serviceCharge = asPercent;
    else if (sc.mode === 'flat') serviceCharge = round2(sc.flatAmount);
    else serviceCharge = round2(Math.max(asPercent, sc.flatAmount));

    if (serviceCharge > 0) {
      lines.push({
        key: 'service_charge',
        label: sc.label,
        detail:
          sc.mode === 'flat'
            ? 'Flat company charge'
            : `${sc.percent}% of ${sc.basis === 'transport_only' ? 'transport' : 'subtotal'}`,
        amount: serviceCharge
      });
    }
  }

  // --- Fuel surcharge ---
  let fuelSurcharge = 0;
  const fuelPercent = resolveFuelPercent(config);
  const fs = config.fuelSurcharge;
  if (fs.enabled && fuelPercent > 0) {
    fuelSurcharge = round2((basisAmount(fs.basis, transport, accessorials) * fuelPercent) / 100);
    lines.push({
      key: 'fuel_surcharge',
      label: fs.label,
      detail:
        fs.mode === 'index_pegged'
          ? `${fuelPercent}% — pegged to $${fs.currentFuelPrice.toFixed(2)}/L`
          : `${fuelPercent}% of ${fs.basis === 'transport_only' ? 'transport' : 'subtotal'}`,
      amount: fuelSurcharge
    });
  }

  // --- Minimum charge floor ---
  let netSubtotal = round2(transport + accessorials + serviceCharge + fuelSurcharge);
  let minimumAdjustment = 0;
  if (netSubtotal < config.rules.minimumChargePerJob) {
    minimumAdjustment = round2(config.rules.minimumChargePerJob - netSubtotal);
    netSubtotal = round2(config.rules.minimumChargePerJob);
    lines.push({
      key: 'minimum_adjustment',
      label: 'Minimum Charge Adjustment',
      detail: `Raised to the $${config.rules.minimumChargePerJob.toFixed(2)} job minimum`,
      amount: minimumAdjustment
    });
  }

  // --- Taxes ---
  // Each tax is applied only to the charge groups it covers, so a
  // freight-exempt provincial tax does not touch the transport line.
  const groupAmounts: Record<ChargeGroup, number> = {
    transport: transport + minimumAdjustment,
    accessorials,
    service_charge: sc.taxable ? serviceCharge : 0,
    fuel_surcharge: fs.taxable ? fuelSurcharge : 0
  };

  const taxLines: QuoteLine[] = [];
  let taxTotal = 0;
  config.taxes
    .filter((t) => t.active && t.ratePercent > 0)
    .forEach((tax) => {
      const taxable = tax.appliesTo.reduce((sum, group) => sum + (groupAmounts[group] || 0), 0);
      if (taxable <= 0) return;

      // Tax-inclusive pricing back-calculates the tax already inside the price.
      const amount = config.invoicing.pricesIncludeTax
        ? round2(taxable - taxable / (1 + tax.ratePercent / 100))
        : round2((taxable * tax.ratePercent) / 100);
      if (amount <= 0) return;

      taxTotal = round2(taxTotal + amount);
      taxLines.push({
        key: tax.id,
        label: `${tax.name} (${tax.ratePercent}%)`,
        detail: `on $${round2(taxable).toFixed(2)}`,
        amount
      });
    });

  const total = config.invoicing.pricesIncludeTax
    ? roundMoney(netSubtotal, config.rules.moneyRounding)
    : roundMoney(netSubtotal + taxTotal, config.rules.moneyRounding);

  // --- Cost & margin ---
  const costLines: QuoteLine[] = [];
  let estimatedCost = 0;
  const oc = config.operatingCost;
  const hasCostInputs = typeof input.distanceKm === 'number';

  if (hasCostInputs) {
    const km = Math.max(0, input.distanceKm || 0);
    const perKm =
      (input.vehicleId && oc.costPerKmByVehicleId[input.vehicleId]) || oc.defaultCostPerKm;
    const distanceCost = round2(km * perKm);
    costLines.push({
      key: 'cost_distance',
      label: 'Vehicle running cost',
      detail: `${km} km × $${perKm.toFixed(2)}/km`,
      amount: distanceCost
    });

    const stops = Math.max(1, input.stopCount ?? 2);
    const minutes = input.driveMinutes ?? stops * oc.averageMinutesPerStop;
    const labourCost = round2((minutes / 60) * oc.driverCostPerHour);
    costLines.push({
      key: 'cost_labour',
      label: 'Driver labour',
      detail: `${minutes} min × $${oc.driverCostPerHour.toFixed(2)}/hr`,
      amount: labourCost
    });

    const stopCost = round2(stops * oc.fixedCostPerStop);
    costLines.push({
      key: 'cost_stops',
      label: 'Handling per stop',
      detail: `${stops} stops × $${oc.fixedCostPerStop.toFixed(2)}`,
      amount: stopCost
    });

    const direct = round2(distanceCost + labourCost + stopCost);
    const overhead = round2((direct * oc.overheadPercent) / 100);
    if (overhead > 0) {
      costLines.push({
        key: 'cost_overhead',
        label: 'Allocated overhead',
        detail: `${oc.overheadPercent}% of direct cost`,
        amount: overhead
      });
    }
    estimatedCost = round2(direct + overhead);
  }

  // Margin is measured against revenue excluding tax — tax is not income.
  const revenue = netSubtotal;
  const grossProfit = round2(revenue - estimatedCost);
  const grossMarginPercent = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;

  return {
    transport,
    accessorials,
    serviceCharge,
    fuelSurcharge,
    minimumAdjustment,
    netSubtotal,
    taxLines,
    taxTotal,
    total,
    lines,
    estimatedCost,
    costLines,
    grossProfit,
    grossMarginPercent,
    meetsTargetMargin: !hasCostInputs || grossMarginPercent >= oc.targetGrossMarginPercent
  };
};
