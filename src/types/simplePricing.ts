// Organization catalogue: Services, Vehicle Types, and Accessorials.
//
// These entities hold *defaults* only. Commercial rates (base fee, km rate,
// minimums, negotiated overrides) live on Rate Cards — see `pricing.ts`.

export interface DeliveryService {
  id: string;
  code: string; // "SAME_DAY", "DIRECT"
  name: string;
  description: string;
  /**
   * Default multiplier applied to freight for this service speed. Next Day is
   * the cheapest (1.00); Direct the most expensive. A Rate Card may override.
   */
  defaultMultiplier: number;
  /** Customer-facing promise, e.g. "Same-Day (by 5 PM)". */
  estimatedTime?: string;
  /** Latest booking time for same-day fulfilment, "HH:MM" 24h. */
  bookingCutoffTime?: string;
  /** Direct: one exclusive vehicle, no unrelated stops, batching disabled. */
  exclusiveVehicle: boolean;
  active: boolean;
}

/**
 * How an accessorial's charge is derived from its quantity.
 *  FLAT                      rate (× quantity when appliesAt = PER_STOP)
 *  PER_UNIT                  max(0, qty − freeAllowance) × rate
 *  PER_MINUTE                wait minutes beyond the free allowance, rounded up
 *                            to the billing increment, × rate
 *  PER_HOUR                  hours × rate
 *  PERCENT_OF_FREIGHT        service freight × rate %
 *  PERCENT_OF_DECLARED_VALUE declared value × rate %  (insurance)
 */
export type AccessorialCalcType =
  | 'FLAT'
  | 'PER_UNIT'
  | 'PER_MINUTE'
  | 'PER_HOUR'
  | 'PERCENT_OF_FREIGHT'
  | 'PERCENT_OF_DECLARED_VALUE';

/** Simple conditions that add the accessorial automatically. */
export type AccessorialAutoRule = 'NONE' | 'AFTER_HOURS' | 'WEEKEND' | 'RESIDENTIAL_STOP';

export interface AccessorialItem {
  id: string;
  code: string; // "STAIRS", "WAIT"
  name: string;
  description: string;
  calculationType: AccessorialCalcType;
  /** Dollar rate, or a percentage for PERCENT_* types. */
  rate: number;
  unitLabel: string; // "per flight", "per minute", "flat fee"
  /** Units included before charging starts. `null` = use organization wait default (PER_MINUTE). */
  freeAllowance: number | null;
  /** PER_MINUTE billing block. `null` = use organization wait increment. */
  incrementMinutes: number | null;
  minimumCharge: number | null;
  maximumCharge: number | null;
  appliesAt: 'ORDER' | 'PER_STOP';
  /** Included in the base the fuel surcharge is calculated on. */
  fuelEligible: boolean;
  taxable: boolean;
  autoRule: AccessorialAutoRule;
  active: boolean;
}

export interface VehicleType {
  id: string;
  name: string;
  payloadCapacityKg: number; // e.g. 1000 for 1 Tonne, 2000 for 2 Tonne, etc.
  palletCapacity: number; // e.g. 2, 4, 8, 12 pallets
  cargoBedFeet?: number; // e.g. 10ft, 16ft, 20ft, 26ft
  cargoVolumeCbm?: number; // e.g. 12 m³, 22 m³, 35 m³
  /** Default additive surcharge ($). A Rate Card may override per customer. */
  baseSurcharge: number;
  /** Whether the surcharge is included in the fuel-surcharge base. */
  fuelEligible: boolean;
  hasLiftgate: boolean; // Equipped with power tail-lift
  requiresCommercialLicense: boolean; // CDL / Air brakes required
  description?: string;
  active: boolean;
}

export interface SimplePricingConfig {
  services: DeliveryService[];
  vehicles: VehicleType[];
  accessorials: AccessorialItem[];
}
