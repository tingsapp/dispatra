import { normalizeFuelSurcharge } from './billingEngine';
import { isValidTaxRate } from './taxRate';
import { BillingConfig, TaxRate, TaxProfileConfig } from '../types/billing';

export const BILLING_STORAGE_KEY = 'dispatra_billing_v2';
const FUEL_DEFAULT_VERSION = 1;
const UNITS_DEFAULT_VERSION = 1;
type StoredBillingConfig = Partial<BillingConfig> & { fuelDefaultVersion?: number; unitsDefaultVersion?: number };

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

export const INITIAL_TAX_PROFILES: TaxProfileConfig[] = [
  {
    id: 'taxp_bc_standard',
    name: 'BC Standard',
    description: 'GST on all charges; PST available but off for freight.',
    taxes: INITIAL_TAXES
  },
  {
    id: 'taxp_alberta',
    name: 'Alberta (GST only)',
    description: 'No provincial sales tax.',
    taxes: [INITIAL_TAXES[0]]
  }
];

export const INITIAL_BILLING_CONFIG: BillingConfig = {
  companyTax: { ratePercent: 5 },
  destinationTaxRates: {},
  company: { name: 'Dispatra Logistics', address: '', phone: '', email: '', logoDataUrl: '' },
  general: {
    timeZone: 'America/Vancouver',
    distanceUnit: 'km',
    weightUnit: 'lb',
    dimensionUnit: 'in',
    dimensionalPricingEnabled: true,
    dimensionalDivisor: 5000,
    defaultIncludedStops: 2,
    defaultExtraStopRate: 0
  },
  invoicing: {
    currency: 'CAD',
    defaultTaxProfileId: 'taxp_bc_standard',
    taxRegistrationNumber: '',
    pricesIncludeTax: false,
    defaultPaymentTerms: 'NET30',
    quoteValidityDays: 14,
    latePaymentFeePercent: 1.5
  },
  taxProfiles: INITIAL_TAX_PROFILES,
  serviceCharge: {
    enabled: false,
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
    // Novex Metro Vancouver courier benchmark, September 2026; editable, not a live feed.
    // https://www.novex.ca/fuel-surcharge/
    percent: 28.5,
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
    fixedCostPerStop: 0,
    overheadPercent: 14
  },
  rules: {
    minimumChargePerJob: 24,
    minimumBillableKm: 0
  },
  dispatch: {
    maxActiveOrdersPerDriver: 3
  }
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Merge stored values over defaults so a new setting never arrives undefined. */
const withDefaults = (stored: StoredBillingConfig | null): BillingConfig => {
  const base = clone(INITIAL_BILLING_CONFIG);
  if (!stored) return base;
  // Preserve the previous home-region rate when upgrading the Vancouver defaults.
  const previousRate = stored.destinationTaxRates?.BC;
  const companyTax = stored.companyTax
    ? { ...base.companyTax, ...stored.companyTax }
    : { ratePercent: isValidTaxRate(previousRate) ? previousRate : base.companyTax.ratePercent };
  const fuelSurcharge = normalizeFuelSurcharge({ ...base.fuelSurcharge, ...(stored.fuelSurcharge || {}), label: base.fuelSurcharge.label });
  // Replace the old active 8% default once. A newly saved 8% remains an explicit choice.
  if ((stored.fuelDefaultVersion ?? 0) < FUEL_DEFAULT_VERSION && stored.fuelSurcharge?.mode === 'fixed_percent' && stored.fuelSurcharge.enabled && stored.fuelSurcharge.percent === 8) {
    fuelSurcharge.percent = base.fuelSurcharge.percent;
  }
  const general = { ...base.general, ...(stored.general || {}), defaultExtraStopRate: 0 };
  // Replace the old metric defaults once. Units saved after the marker exists are an explicit choice.
  if ((stored.unitsDefaultVersion ?? 0) < UNITS_DEFAULT_VERSION) {
    if (general.weightUnit === 'kg') general.weightUnit = base.general.weightUnit;
    if (general.dimensionUnit === 'cm') general.dimensionUnit = base.general.dimensionUnit;
  }
  return {
    companyTax,
    destinationTaxRates: { ...base.destinationTaxRates, ...(stored.destinationTaxRates || {}) },
    company: { ...base.company, ...(stored.company || {}) },
    general,
    invoicing: { ...base.invoicing, ...(stored.invoicing || {}) },
    taxProfiles:
      Array.isArray(stored.taxProfiles) && stored.taxProfiles.length
        ? stored.taxProfiles
        : base.taxProfiles,
    serviceCharge: { ...base.serviceCharge, ...(stored.serviceCharge || {}), enabled: false, label: base.serviceCharge.label, basis: 'transport_and_accessorials', mode: stored.serviceCharge?.mode === 'flat' ? 'flat' : 'percentage' },
    fuelSurcharge,
    operatingCost: {
      ...base.operatingCost,
      ...Object.fromEntries(Object.entries(stored.operatingCost || {}).filter(([key]) => key !== 'targetGrossMarginPercent')),
      // A vehicle type without an entry uses the default cost; seed values must not resurrect a cleared one.
      costPerKmByVehicleId: stored.operatingCost?.costPerKmByVehicleId ?? base.operatingCost.costPerKmByVehicleId,
      // V1 has no per-stop consumables line; driver time already covers handling.
      fixedCostPerStop: 0
    },
    rules: {
      minimumChargePerJob: stored.rules?.minimumChargePerJob ?? base.rules.minimumChargePerJob,
      // Retired organization distance floor does not apply to new quotes.
      minimumBillableKm: 0
    },
    dispatch: { ...base.dispatch, ...(stored.dispatch || {}) }
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
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify({ ...config, fuelDefaultVersion: FUEL_DEFAULT_VERSION, unitsDefaultVersion: UNITS_DEFAULT_VERSION, fuelSurcharge: normalizeFuelSurcharge(config.fuelSurcharge) }));
  } catch {
    // Storage unavailable (private mode / quota) — settings stay in memory.
  }
};

export const resetBillingConfig = (): BillingConfig => {
  const defaults = clone(INITIAL_BILLING_CONFIG);
  saveBillingConfig(defaults);
  return defaults;
};
