import type { CanadianProvince } from '../lib/taxAddress';

// Organization-wide billing, tax, and operating-cost settings.
//
// These are the modifiers that apply to EVERY quote, as opposed to
// `simplePricing.ts`, which defines what each individual service costs.

/** The charge groups a tax or surcharge can be calculated on. */
export type ChargeGroup = 'transport' | 'accessorials' | 'service_charge' | 'fuel_surcharge';

export type SurchargeBasis = 'transport_only' | 'transport_and_accessorials' | 'subtotal';

export interface TaxRate {
  id: string;
  name: string; // "GST", "PST", "HST"
  ratePercent: number;
  /** Which charge groups this tax applies to. Freight is often PST-exempt. */
  appliesTo: ChargeGroup[];
  active: boolean;
  note?: string;
}

/** A named bundle of tax rates (e.g. "BC Standard", "Alberta"). */
export interface TaxProfileConfig {
  id: string;
  name: string;
  description: string;
  taxes: TaxRate[];
}

export interface ServiceChargeSettings {
  enabled: boolean;
  /** Customer-facing label on the quote and invoice. */
  label: string;
  mode: 'percentage' | 'flat' | 'greater_of';
  percent: number;
  flatAmount: number;
  basis: SurchargeBasis;
  taxable: boolean;
}

export interface FuelSurchargeSettings {
  enabled: boolean;
  label: string;
  /** 'fixed_percent' uses `percent`; 'index_pegged' derives it from fuel price. */
  mode: 'fixed_percent' | 'index_pegged';
  percent: number;
  taxable: boolean;
  /** Fuel price ($/L) at which the surcharge is zero. */
  baselineFuelPrice: number;
  currentFuelPrice: number;
  /** Surcharge % added per whole cent/L above the baseline. */
  percentPerCentAboveBaseline: number;
}

export interface OperatingCostSettings {
  /** Fallback running cost per km when a vehicle has no specific rate. */
  defaultCostPerKm: number;
  /** Per-vehicle-class overrides, keyed by VehicleType id. */
  costPerKmByVehicleId: Record<string, number>;
  driverCostPerHour: number;
  averageMinutesPerStop: number;
  /** Legacy per-stop consumables; fixed at 0 in V1 and kept only for stored estimates. */
  fixedCostPerStop: number;
  /** Overhead allocated as a % of direct cost. */
  overheadPercent: number;
}

export interface BillingRules {
  /** Legacy inheritance only: migrated onto active rate cards; retained for frozen quotes. */
  minimumChargePerJob: number;
  /** Legacy frozen quote floor. Active organization settings always load 0. */
  minimumBillableKm: number;
}

/**
 * Organization-wide defaults (Pricing → Extras). Every value here is a
 * fallback: a Rate Card may override any of them for its own customers.
 */
export interface OrganizationDefaults {
  timeZone?: string;
  distanceUnit: 'km' | 'mi';
  weightUnit: 'kg' | 'lb';
  dimensionUnit: 'cm' | 'in';
  /** Charge on max(actual, dimensional) weight instead of actual weight only. */
  dimensionalPricingEnabled: boolean;
  /** Volumetric divisor (e.g. 5000 cm³/kg) used to derive dimensional weight. */
  dimensionalDivisor: number;
  /** Stops included in every order (typically 1 pickup + 1 drop-off). */
  defaultIncludedStops: number;
  /** Charge per stop beyond the included count. */
  defaultExtraStopRate: number;
}

export interface InvoicingSettings {
  /** Legacy stored value; new destination tax always applies regardless of registration. */
  taxRegistrationStatus?: 'UNCONFIRMED' | 'REGISTERED' | 'NOT_REGISTERED';
  currency: 'CAD' | 'USD';
  /** Tax profile applied unless a customer overrides it. */
  defaultTaxProfileId: string;
  taxRegistrationNumber: string;
  /** Legacy quote context only. New quotes always add tax to the subtotal. */
  pricesIncludeTax: boolean;
  defaultPaymentTerms: 'COD' | 'NET15' | 'NET30' | 'NET45';
  quoteValidityDays: number;
  latePaymentFeePercent: number;
}

/** Assignment policy. Never read by the pricing engine — it does not change customer price. */
export interface DispatchSettings {
  maxActiveOrdersPerDriver: number;
  /** V1 runs one origin hub: the depot routes start from and return to. */
  hubAddress: string;
}

/** Who the organization is, as shown on invoices and customer communication. */
export interface CompanyDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Data URL of the invoice logo; empty means none. */
  logoDataUrl: string;
}

export interface BillingConfig {
  /** Saved province rate overrides; absent entries use the supplied defaults. */
  destinationTaxRates: Partial<Record<CanadianProvince, number | null>>;
  company: CompanyDetails;
  general: OrganizationDefaults;
  dispatch: DispatchSettings;
  invoicing: InvoicingSettings;
  taxProfiles: TaxProfileConfig[];
  serviceCharge: ServiceChargeSettings;
  fuelSurcharge: FuelSurchargeSettings;
  operatingCost: OperatingCostSettings;
  rules: BillingRules;
}
