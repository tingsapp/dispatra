import { BillingConfig, TaxRate } from '../types/billing';

export const BILLING_STORAGE_KEY = 'dispatra_billing_v1';

/**
 * Defaults are set for a Metro Vancouver operator:
 * GST applies to freight; BC PST generally does not, so it ships inactive.
 */
export const INITIAL_TAXES: TaxRate[] = [
  {
    id: 'tax_gst',
    name: 'GST',
    ratePercent: 5,
    appliesTo: ['transport', 'accessorials', 'service_charge', 'fuel_surcharge'],
    active: true,
    note: 'Federal goods & services tax. Applies to freight and all surcharges.'
  },
  {
    id: 'tax_pst',
    name: 'PST (BC)',
    ratePercent: 7,
    appliesTo: ['accessorials'],
    active: false,
    note: 'BC provincial tax. Freight transportation is generally exempt — enable only if you sell taxable goods or equipment rental.'
  }
];

export const INITIAL_BILLING_CONFIG: BillingConfig = {
  invoicing: {
    currency: 'CAD',
    taxRegistrationNumber: '',
    pricesIncludeTax: false,
    defaultPaymentTerms: 'NET30',
    quoteValidityDays: 14,
    latePaymentFeePercent: 1.5
  },
  taxes: INITIAL_TAXES,
  serviceCharge: {
    enabled: true,
    label: 'Service Fee',
    mode: 'percentage',
    percent: 5,
    flatAmount: 3.5,
    basis: 'transport_and_accessorials',
    taxable: true
  },
  fuelSurcharge: {
    enabled: true,
    label: 'Fuel Surcharge',
    mode: 'fixed_percent',
    percent: 11.5,
    basis: 'transport_only',
    taxable: true,
    baselineFuelPrice: 1.55,
    currentFuelPrice: 1.89,
    percentPerCentAboveBaseline: 0.3
  },
  operatingCost: {
    defaultCostPerKm: 0.68,
    costPerKmByVehicleId: {
      veh_1_ton: 0.52,
      veh_2_ton: 0.71,
      veh_3_ton: 0.94,
      veh_5_ton: 1.22
    },
    driverCostPerHour: 31.5,
    averageMinutesPerStop: 12,
    fixedCostPerStop: 2.4,
    overheadPercent: 14,
    targetGrossMarginPercent: 35
  },
  rules: {
    minimumChargePerJob: 24,
    minimumBillableKm: 0,
    distanceRoundingKm: 0.5,
    moneyRounding: 'nearest_05'
  }
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Merge stored values over defaults so a new setting never arrives undefined. */
const withDefaults = (stored: Partial<BillingConfig> | null): BillingConfig => {
  const base = clone(INITIAL_BILLING_CONFIG);
  if (!stored) return base;
  return {
    invoicing: { ...base.invoicing, ...(stored.invoicing || {}) },
    taxes: Array.isArray(stored.taxes) && stored.taxes.length ? stored.taxes : base.taxes,
    serviceCharge: { ...base.serviceCharge, ...(stored.serviceCharge || {}) },
    fuelSurcharge: { ...base.fuelSurcharge, ...(stored.fuelSurcharge || {}) },
    operatingCost: {
      ...base.operatingCost,
      ...(stored.operatingCost || {}),
      costPerKmByVehicleId: {
        ...base.operatingCost.costPerKmByVehicleId,
        ...((stored.operatingCost && stored.operatingCost.costPerKmByVehicleId) || {})
      }
    },
    rules: { ...base.rules, ...(stored.rules || {}) }
  };
};

export const loadBillingConfig = (): BillingConfig => {
  try {
    const raw = localStorage.getItem(BILLING_STORAGE_KEY);
    return withDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return clone(INITIAL_BILLING_CONFIG);
  }
};

export const saveBillingConfig = (config: BillingConfig): void => {
  try {
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable (private mode / quota) — settings stay in memory.
  }
};

export const resetBillingConfig = (): BillingConfig => {
  const defaults = clone(INITIAL_BILLING_CONFIG);
  saveBillingConfig(defaults);
  return defaults;
};
