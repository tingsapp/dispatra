import { SimplePricingConfig, DeliveryService, VehicleType, AccessorialItem } from '../types/simplePricing';

export const SIMPLE_PRICING_STORAGE_KEY = 'dispatra_simple_pricing_v4';

export const INITIAL_SERVICES: DeliveryService[] = [
  {
    id: 'srv_same_day',
    code: 'SAME_DAY',
    name: 'Same-Day Standard',
    description: 'Standard scheduled delivery completed by 5:00 PM across metro area.',
    defaultMultiplier: 1.0,
    estimatedTime: 'Same-Day (by 5 PM)',
    bookingCutoffTime: '14:00',
    exclusiveVehicle: false,
    active: true
  },
  {
    id: 'srv_rush',
    code: 'RUSH_2H',
    name: 'Rush Expedited (2-Hour)',
    description: 'Priority expedited pickup and delivery within 2 hours of booking.',
    defaultMultiplier: 1.3,
    estimatedTime: 'Under 2 Hours',
    bookingCutoffTime: '16:00',
    exclusiveVehicle: false,
    active: true
  },
  {
    id: 'srv_direct',
    code: 'DIRECT',
    name: 'Direct Hotshot',
    description: 'Immediate non-stop exclusive vehicle with zero intermediate stops.',
    defaultMultiplier: 1.5,
    estimatedTime: 'Immediate Direct',
    bookingCutoffTime: '17:00',
    exclusiveVehicle: true,
    active: true
  },
  {
    id: 'srv_economy',
    code: 'NEXT_DAY',
    name: 'Scheduled Economy',
    description: 'Cost-efficient next-day consolidated delivery for non-urgent shipments.',
    defaultMultiplier: 0.9,
    estimatedTime: 'Next-Day Flexible',
    bookingCutoffTime: '17:00',
    exclusiveVehicle: false,
    active: true
  }
];

export const INITIAL_VEHICLES: VehicleType[] = [
  {
    id: 'veh_1_ton',
    name: '1 Tonne (Van / Sprinter)',
    payloadCapacityKg: 1000,
    palletCapacity: 2,
    cargoBedFeet: 10,
    cargoVolumeCbm: 12,
    baseSurcharge: 0,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Standard courier cargo van for parcel batches and up to 2 standard skids.',
    active: true
  },
  {
    id: 'veh_2_ton',
    name: '2 Tonne (16ft Cube Truck)',
    payloadCapacityKg: 2000,
    palletCapacity: 4,
    cargoBedFeet: 16,
    cargoVolumeCbm: 22,
    baseSurcharge: 25.0,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Enclosed 16ft box truck ideal for residential furniture and medium palletized goods.',
    active: true
  },
  {
    id: 'veh_3_ton',
    name: '3 Tonne (20ft Straight Truck)',
    payloadCapacityKg: 3500,
    palletCapacity: 8,
    cargoBedFeet: 20,
    cargoVolumeCbm: 34,
    baseSurcharge: 50.0,
    fuelEligible: true,
    hasLiftgate: true,
    requiresCommercialLicense: true,
    description: 'Commercial straight truck with hydraulic tail-lift for up to 8 commercial skids.',
    active: true
  },
  {
    id: 'veh_5_ton',
    name: '5 Tonne (26ft Heavy Truck)',
    payloadCapacityKg: 5500,
    palletCapacity: 12,
    cargoBedFeet: 26,
    cargoVolumeCbm: 48,
    baseSurcharge: 90.0,
    fuelEligible: true,
    hasLiftgate: true,
    requiresCommercialLicense: true,
    description: 'Heavy distribution freight truck with power liftgate for full LTL shipments.',
    active: true
  }
];

const accessorial = (
  partial: Pick<AccessorialItem, 'id' | 'code' | 'name' | 'description' | 'calculationType' | 'rate' | 'unitLabel'> &
    Partial<AccessorialItem>
): AccessorialItem => ({
  freeAllowance: null,
  incrementMinutes: null,
  minimumCharge: null,
  maximumCharge: null,
  appliesAt: 'ORDER',
  fuelEligible: false,
  taxable: true,
  autoRule: 'NONE',
  active: true,
  ...partial
});

export const INITIAL_ACCESSORIALS: AccessorialItem[] = [
  accessorial({
    id: 'acc_stairs',
    code: 'STAIRS',
    name: 'Stair Carry',
    description: 'Manual carry per flight of stairs navigated at pickup or delivery site.',
    calculationType: 'PER_UNIT',
    rate: 5.0,
    unitLabel: 'per flight',
    freeAllowance: 0
  }),
  accessorial({
    id: 'acc_wait_time',
    code: 'WAIT',
    name: 'Waiting Time',
    description: 'Site wait beyond the organization free allowance, billed in increments.',
    calculationType: 'PER_MINUTE',
    rate: 0.75,
    unitLabel: 'per minute',
    appliesAt: 'PER_STOP'
  }),
  accessorial({
    id: 'acc_helper',
    code: 'HELPER',
    name: 'Additional Helper',
    description: 'Second crew member for heavy, bulky, or awkward pieces.',
    calculationType: 'PER_HOUR',
    rate: 35.0,
    unitLabel: 'per hour',
    minimumCharge: 35
  }),
  accessorial({
    id: 'acc_liftgate',
    code: 'LIFTGATE',
    name: 'Power Liftgate',
    description: 'Hydraulic tailgate required for palletized freight without a loading dock.',
    calculationType: 'FLAT',
    rate: 25.0,
    unitLabel: 'flat fee',
    fuelEligible: true
  }),
  accessorial({
    id: 'acc_elevator',
    code: 'ELEVATOR',
    name: 'Elevator',
    description: 'Elevator reservation or freight-elevator handling at a stop.',
    calculationType: 'FLAT',
    rate: 10.0,
    unitLabel: 'flat fee',
    appliesAt: 'PER_STOP'
  }),
  accessorial({
    id: 'acc_inside',
    code: 'INSIDE',
    name: 'Inside / Residential Delivery',
    description: 'Carry beyond the threshold into a residence, office, or suite.',
    calculationType: 'FLAT',
    rate: 20.0,
    unitLabel: 'flat fee',
    appliesAt: 'PER_STOP',
    autoRule: 'RESIDENTIAL_STOP'
  }),
  accessorial({
    id: 'acc_after_hours',
    code: 'AFTER_HOURS',
    name: 'After-Hours Service',
    description: 'Pickup or delivery outside 08:00–18:00. Added automatically.',
    calculationType: 'FLAT',
    rate: 30.0,
    unitLabel: 'flat fee',
    autoRule: 'AFTER_HOURS'
  }),
  accessorial({
    id: 'acc_weekend',
    code: 'WEEKEND',
    name: 'Weekend Service',
    description: 'Saturday or Sunday service. Added automatically.',
    calculationType: 'PERCENT_OF_FREIGHT',
    rate: 20,
    unitLabel: '% of freight',
    autoRule: 'WEEKEND'
  }),
  accessorial({
    id: 'acc_heavy_item',
    code: 'HEAVY_ITEM',
    name: 'Heavy Item Handling',
    description: 'Per item over 70 kg requiring special handling.',
    calculationType: 'PER_UNIT',
    rate: 15.0,
    unitLabel: 'per item'
  }),
  accessorial({
    id: 'acc_fragile',
    code: 'FRAGILE',
    name: 'Fragile Blanket Wrap',
    description: 'Padded furniture blankets, protective corner guards, and tie-down strap security.',
    calculationType: 'FLAT',
    rate: 15.0,
    unitLabel: 'flat fee'
  }),
  accessorial({
    id: 'acc_insurance',
    code: 'INSURANCE',
    name: 'Declared Value Insurance',
    description: 'Cargo insurance charged as a percentage of declared value.',
    calculationType: 'PERCENT_OF_DECLARED_VALUE',
    rate: 1.5,
    unitLabel: '% of declared value',
    minimumCharge: 5,
    taxable: false
  }),
  accessorial({
    id: 'acc_parking',
    code: 'PARKING',
    name: 'Parking / Toll Pass-through',
    description: 'Actual parking or toll cost incurred, passed through at cost.',
    calculationType: 'PER_UNIT',
    rate: 1.0,
    unitLabel: 'per dollar',
    taxable: false
  })
];

export function loadSimplePricingConfig(): SimplePricingConfig {
  try {
    const raw = localStorage.getItem(SIMPLE_PRICING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.services) && Array.isArray(parsed.accessorials)) {
        return {
          services: parsed.services,
          vehicles: Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0 ? parsed.vehicles : INITIAL_VEHICLES,
          accessorials: parsed.accessorials
        };
      }
    }
  } catch (err) {
    console.warn('Could not read saved pricing config, using defaults:', err);
  }

  return {
    services: INITIAL_SERVICES,
    vehicles: INITIAL_VEHICLES,
    accessorials: INITIAL_ACCESSORIALS
  };
}

export function saveSimplePricingConfig(config: SimplePricingConfig): void {
  try {
    localStorage.setItem(SIMPLE_PRICING_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Could not save pricing config:', err);
  }
}

export function resetSimplePricingConfig(): SimplePricingConfig {
  const defaults: SimplePricingConfig = {
    services: INITIAL_SERVICES,
    vehicles: INITIAL_VEHICLES,
    accessorials: INITIAL_ACCESSORIALS
  };
  saveSimplePricingConfig(defaults);
  return defaults;
}
