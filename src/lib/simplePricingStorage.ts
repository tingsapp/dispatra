import { SimplePricingConfig, DeliveryService, VehicleType, AccessorialItem } from '../types/simplePricing';

export const SIMPLE_PRICING_STORAGE_KEY = 'dispatra_simple_pricing_v3';

export const INITIAL_SERVICES: DeliveryService[] = [
  {
    id: 'srv_same_day',
    name: 'Same-Day Standard',
    description: 'Standard scheduled delivery completed by 5:00 PM across metro area.',
    basePrice: 20.0,
    includedKm: 5,
    perKmPrice: 1.5,
    estimatedTime: 'Same-Day (by 5 PM)',
    active: true
  },
  {
    id: 'srv_rush',
    name: 'Rush Expedited (2-Hour)',
    description: 'Priority expedited pickup and delivery within 2 hours of booking.',
    basePrice: 35.0,
    includedKm: 5,
    perKmPrice: 2.0,
    estimatedTime: 'Under 2 Hours',
    active: true
  },
  {
    id: 'srv_direct',
    name: 'Direct Hotshot',
    description: 'Immediate non-stop exclusive vehicle with zero intermediate stops.',
    basePrice: 50.0,
    includedKm: 5,
    perKmPrice: 2.5,
    estimatedTime: 'Immediate Direct',
    active: true
  },
  {
    id: 'srv_economy',
    name: 'Scheduled Economy',
    description: 'Cost-efficient next-day consolidated delivery for non-urgent shipments.',
    basePrice: 15.0,
    includedKm: 5,
    perKmPrice: 1.25,
    estimatedTime: 'Next-Day Flexible',
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
    hasLiftgate: true,
    requiresCommercialLicense: true,
    description: 'Heavy distribution freight truck with power liftgate for full LTL shipments.',
    active: true
  }
];

export const INITIAL_ACCESSORIALS: AccessorialItem[] = [
  {
    id: 'acc_stairs',
    name: 'Stair Carry',
    description: 'Manual carry per flight of stairs navigated at pickup or delivery site.',
    price: 5.0,
    pricingType: 'per_unit',
    unitLabel: 'per flight',
    active: true
  },
  {
    id: 'acc_crew',
    name: 'Two-Person Crew',
    description: 'Driver plus assistant helper for heavy, bulky, or awkward pieces.',
    price: 40.0,
    pricingType: 'flat',
    unitLabel: 'flat fee',
    active: true
  },
  {
    id: 'acc_liftgate',
    name: 'Power Liftgate',
    description: 'Hydraulic tailgate required for palletized freight without a loading dock.',
    price: 25.0,
    pricingType: 'flat',
    unitLabel: 'flat fee',
    active: true
  },
  {
    id: 'acc_inside',
    name: 'Inside Room of Choice',
    description: 'Carry items beyond threshold into specific office room or apartment suite.',
    price: 20.0,
    pricingType: 'flat',
    unitLabel: 'flat fee',
    active: true
  },
  {
    id: 'acc_wait_time',
    name: 'Wait Time / Detention',
    description: 'Site wait time billed per minute after 15-minute free loading allowance.',
    price: 1.0,
    pricingType: 'per_unit',
    unitLabel: 'per minute',
    active: true
  },
  {
    id: 'acc_fragile',
    name: 'Fragile Blanket Wrap',
    description: 'Padded furniture blankets, protective corner guards, and tie-down strap security.',
    price: 15.0,
    pricingType: 'flat',
    unitLabel: 'flat fee',
    active: true
  }
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
