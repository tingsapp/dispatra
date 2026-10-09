import { scopedStorageKey } from './scopedStorage';
import { SimplePricingConfig, DeliveryService, VehicleType, AccessorialItem } from '../types/simplePricing';

export const SIMPLE_PRICING_STORAGE_KEY = 'dispatra_simple_pricing_v4';

/** Apply the approved starting charges to built-in services; custom premiums need review. */
export function normalizeService(service: DeliveryService): DeliveryService {
  return { ...service, additionalCharge: service.additionalCharge === undefined
    ? (INITIAL_SERVICES.find(seed => seed.id === service.id && seed.code === service.code)?.additionalCharge ?? (service.defaultMultiplier === 1 ? 0 : null)) : service.additionalCharge };
}

export const INITIAL_SERVICES: DeliveryService[] = [
  {
    id: 'srv_same_day',
    code: 'SAME_DAY',
    name: 'Same-Day Standard',
    description: 'Standard scheduled delivery completed by 17:00 across metro area.',
    defaultMultiplier: 1.0,
    additionalCharge: 0,
    estimatedTime: 'Same-Day (by 17:00)',
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
    additionalCharge: 20,
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
    additionalCharge: 35,
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
    additionalCharge: 0,
    estimatedTime: 'Next-Day Flexible',
    bookingCutoffTime: '17:00',
    exclusiveVehicle: false,
    active: true
  }
];

/** Vehicle kinds common in Canadian moving and transportation. Sizes are typical defaults the vehicle form prefills and each vehicle can override:
 * published fleet specs (Penske, U-Haul, Enterprise Canada, Ford Transit, 53 ft dry and reefer trailer guides); refrigerated van sizes allow ~3 in insulation;
 * flatbed height is the load height left under Canada's 4.15 m limit. Pallets are single-layer 40 × 48 in. */
export const INITIAL_VEHICLES: VehicleType[] = [
  {
    id: 'veh_1_ton',
    name: 'Cargo Van',
    payloadCapacityKg: 1587.573295,
    palletCapacity: 3,
    cargoBedFeet: 14.33,
    cargoVolumeCbm: 15.98,
    cargoLengthCm: 436.88,
    cargoWidthCm: 177.8,
    cargoHeightCm: 205.74,
    baseSurcharge: 0,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Enclosed van (Ford Transit, Mercedes-Benz Sprinter, Ram ProMaster) for parcels, courier work and small moves.',
    active: true
  },
  {
    id: 'veh_reefer_van',
    name: 'Refrigerated Van',
    payloadCapacityKg: 1360.77711,
    palletCapacity: 3,
    cargoBedFeet: 13.83,
    cargoVolumeCbm: 13.06,
    cargoLengthCm: 421.64,
    cargoWidthCm: 162.56,
    cargoHeightCm: 190.5,
    baseSurcharge: 20,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Insulated cargo van with a refrigeration unit for food, flowers and pharmaceuticals.',
    equipment: ['Refrigeration'],
    active: true
  },
  {
    id: 'veh_2_ton',
    name: 'Cube Van',
    payloadCapacityKg: 1950.447191,
    palletCapacity: 8,
    cargoBedFeet: 16.0,
    cargoVolumeCbm: 22.33,
    cargoLengthCm: 487.68,
    cargoWidthCm: 231.14,
    cargoHeightCm: 198.12,
    baseSurcharge: 25,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Box body on a van cutaway chassis; the common local delivery and apartment moving truck.',
    active: true
  },
  {
    id: 'veh_3_ton',
    name: 'Box Truck',
    payloadCapacityKg: 4535.9237,
    palletCapacity: 12,
    cargoBedFeet: 25.92,
    cargoVolumeCbm: 50.92,
    cargoLengthCm: 789.94,
    cargoWidthCm: 246.38,
    cargoHeightCm: 261.62,
    baseSurcharge: 60,
    fuelEligible: true,
    hasLiftgate: true,
    requiresCommercialLicense: false,
    description: 'Straight truck with an enclosed dry box for furniture, household moves and LTL freight.',
    equipment: ['Liftgate'],
    active: true
  },
  {
    id: 'veh_reefer_truck',
    name: 'Refrigerated Truck',
    payloadCapacityKg: 1646.540303,
    palletCapacity: 8,
    cargoBedFeet: 16.0,
    cargoVolumeCbm: 22.17,
    cargoLengthCm: 487.68,
    cargoWidthCm: 220.98,
    cargoHeightCm: 205.74,
    baseSurcharge: 60,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Straight truck with an insulated box and nose-mounted reefer unit for temperature-controlled loads.',
    equipment: ['Refrigeration'],
    active: true
  },
  {
    id: 'veh_flatbed_truck',
    name: 'Flatbed Truck',
    payloadCapacityKg: 4535.9237,
    palletCapacity: 12,
    cargoBedFeet: 24.0,
    cargoVolumeCbm: 46.21,
    cargoLengthCm: 731.52,
    cargoWidthCm: 243.84,
    cargoHeightCm: 259.08,
    baseSurcharge: 60,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: false,
    description: 'Straight truck with an open deck for building materials, machinery and oversized items.',
    equipment: ['Open deck'],
    active: true
  },
  {
    id: 'veh_53_trailer',
    name: 'Dry Van Trailer',
    payloadCapacityKg: 20411.65665,
    palletCapacity: 26,
    cargoBedFeet: 52.5,
    cargoVolumeCbm: 113.56,
    cargoLengthCm: 1600.2,
    cargoWidthCm: 254.0,
    cargoHeightCm: 279.4,
    baseSurcharge: 250,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: true,
    description: 'Enclosed semi-trailer pulled by a tractor for full truckload freight; Class 1 / AZ licence.',
    active: true
  },
  {
    id: 'veh_reefer_trailer',
    name: 'Refrigerated Trailer',
    payloadCapacityKg: 18506.568696,
    palletCapacity: 26,
    cargoBedFeet: 52.0,
    cargoVolumeCbm: 101.17,
    cargoLengthCm: 1584.96,
    cargoWidthCm: 246.38,
    cargoHeightCm: 259.08,
    baseSurcharge: 300,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: true,
    description: 'Insulated reefer semi-trailer for temperature-controlled truckload freight; Class 1 / AZ licence.',
    equipment: ['Refrigeration'],
    active: true
  },
  {
    id: 'veh_flatbed_trailer',
    name: 'Flatbed Trailer',
    payloadCapacityKg: 21772.43376,
    palletCapacity: 26,
    cargoBedFeet: 53.0,
    cargoVolumeCbm: 108.43,
    cargoLengthCm: 1615.44,
    cargoWidthCm: 259.08,
    cargoHeightCm: 259.08,
    baseSurcharge: 250,
    fuelEligible: true,
    hasLiftgate: false,
    requiresCommercialLicense: true,
    description: 'Open-deck semi-trailer for steel, lumber and machinery; Class 1 / AZ licence.',
    equipment: ['Open deck'],
    active: true
  },
  {
    id: 'veh_5_ton',
    name: 'Box Truck (retired preset)',
    payloadCapacityKg: 4535.9237,
    palletCapacity: 12,
    cargoBedFeet: 25.92,
    cargoVolumeCbm: 50.92,
    cargoLengthCm: 789.94,
    cargoWidthCm: 246.38,
    cargoHeightCm: 261.62,
    baseSurcharge: 90,
    fuelEligible: true,
    hasLiftgate: true,
    requiresCommercialLicense: false,
    description: 'Retired preset kept so older records still resolve; use Box Truck.',
    equipment: ['Liftgate'],
    active: false
  }
];

/** Earlier preset names. A saved preset still carrying one is replaced by the current kind (surcharge and status kept); retired-only presets are deactivated. */
const RETIRED_PRESET_NAMES: Record<string, string[]> = {
  veh_1_ton: ['1 Tonne (Van / Sprinter)', 'Cargo Van – High Roof Extended'], veh_2_ton: ['2 Tonne (16ft Cube Truck)', '16 ft Cube Van'],
  veh_3_ton: ['3 Tonne (20ft Straight Truck)', '20 ft Straight Truck'], veh_5_ton: ['5 Tonne (26ft Heavy Truck)', '26 ft Straight Truck'],
  veh_53_trailer: ['53ft Dry Van Trailer', '53 ft Dry Van Trailer'], veh_cargo_van: ['Cargo Van (Small)', 'Cargo Van – Low Roof'], veh_12ft_cube: ['12 ft Cube Van'],
};
const withCurrentPreset = (vehicle: VehicleType): VehicleType => {
  if (!RETIRED_PRESET_NAMES[vehicle.id]?.includes(vehicle.name)) return vehicle;
  const preset = INITIAL_VEHICLES.find(item => item.id === vehicle.id);
  if (!preset) return { ...vehicle, active: false };
  const { baseSurcharge, fuelEligible } = vehicle;
  return { ...structuredClone(preset), baseSurcharge, fuelEligible, active: preset.active && vehicle.active };
};
/** Kinds added after a company saved its list appear once; deleted types stay as inactive records, so they are never re-added. */
const withNewPresets = (vehicles: VehicleType[]): VehicleType[] => [...vehicles, ...structuredClone(INITIAL_VEHICLES.filter(preset => preset.active && !vehicles.some(vehicle => vehicle.id === preset.id)))];
/** Fresh copies, so callers that edit a loaded config never change the built-in defaults. */
const defaultConfig = (): SimplePricingConfig => structuredClone({ services: INITIAL_SERVICES, vehicles: INITIAL_VEHICLES, accessorials: INITIAL_ACCESSORIALS });

const retiredSeedDescriptions: Record<string, string> = {
  "Manual carry per flight of stairs navigated at pickup or delivery site.": "Carry items using stairs at pickup or delivery.",
  "Site wait beyond the free allowance at each stop, billed in increments.": "Waiting at pickup or delivery.",
  "Pickup or delivery outside 08:00\u201318:00. Added automatically.": "Pickup or delivery outside 08:00\u201318:00.",
  "Saturday or Sunday service. Added automatically.": "Saturday or Sunday service.",
  "Per item over 70 kg requiring special handling.": "Special handling for items over 150 lb.",
  "Special handling for items over 70 kg.": "Special handling for items over 150 lb.",
  "Cargo insurance charged as a percentage of declared value.": "Cargo insurance for the order.",
  "Actual parking or toll cost incurred, passed through at cost.": "Parking or toll charge for the order."
};

/** Current catalogue rules; frozen quote catalogues bypass storage normalization. */
export function normalizeAccessorial(item: AccessorialItem): AccessorialItem {
  const packageCharge = item.code === 'FRAGILE' || item.code === 'DG';
  return { ...item, description: retiredSeedDescriptions[item.description] ?? item.description, calculationType: packageCharge ? 'PER_UNIT' : 'FLAT', unitLabel: packageCharge ? 'per package' : 'per order', appliesAt: 'ORDER',
    autoRule: 'NONE', fuelEligible: false, freeAllowance: null, incrementMinutes: null,
    minimumCharge: null, maximumCharge: null };
}

export const INITIAL_ACCESSORIALS: AccessorialItem[] = [
  {"taxable": true, "id": "acc_stairs", "code": "STAIRS", "name": "Stair Carry", "description": "Carry items using stairs at pickup or delivery.", "rate": 5},
  {"taxable": true, "id": "acc_wait_time", "code": "WAIT", "name": "Waiting Time", "description": "Waiting at pickup or delivery.", "rate": 0.75},
  {"taxable": true, "id": "acc_helper", "code": "HELPER", "name": "Additional Helper", "description": "Second crew member for heavy, bulky, or awkward pieces.", "rate": 35},
  {"taxable": true, "id": "acc_liftgate", "code": "LIFTGATE", "name": "Power Liftgate", "description": "Hydraulic tailgate required for palletized freight without a loading dock.", "rate": 25},
  {"taxable": true, "id": "acc_elevator", "code": "ELEVATOR", "name": "Elevator", "description": "Elevator reservation or freight-elevator handling at a stop.", "rate": 10},
  {"taxable": true, "id": "acc_inside", "code": "INSIDE", "name": "Inside / Residential Delivery", "description": "Carry beyond the threshold into a residence, office, or suite.", "rate": 20},
  {"taxable": true, "id": "acc_after_hours", "code": "AFTER_HOURS", "name": "After-Hours Service", "description": "Pickup or delivery outside 08:00\u201318:00.", "rate": 30},
  {"taxable": true, "id": "acc_weekend", "code": "WEEKEND", "name": "Weekend Service", "description": "Saturday or Sunday service.", "rate": 20},
  {"taxable": true, "id": "acc_heavy_item", "code": "HEAVY_ITEM", "name": "Heavy Item Handling", "description": "Special handling for items over 150 lb.", "rate": 15},
  {"taxable": true, "id": "acc_fragile", "code": "FRAGILE", "name": "Fragile", "description": "Extra handling for fragile packages.", "rate": 15},
  {"taxable": true, "id": "acc_dg", "code": "DG", "name": "DG", "description": "Dangerous goods handling for each flagged package.", "rate": 25},
  {"taxable": false, "id": "acc_insurance", "code": "INSURANCE", "name": "Declared Value Insurance", "description": "Cargo insurance for the order.", "rate": 1.5},
  {"taxable": false, "id": "acc_parking", "code": "PARKING", "name": "Parking / Toll Pass-through", "description": "Parking or toll charge for the order.", "rate": 1},
].map(item => ({ ...item, calculationType: item.code === 'FRAGILE' || item.code === 'DG' ? 'PER_UNIT' : 'FLAT', unitLabel: item.code === 'FRAGILE' || item.code === 'DG' ? 'per package' : 'per order', appliesAt: 'ORDER',
  autoRule: 'NONE', active: true, fuelEligible: false, freeAllowance: null,
  incrementMinutes: null, minimumCharge: null, maximumCharge: null }));


export function loadSimplePricingConfig(): SimplePricingConfig {
  try {
    const raw = localStorage.getItem(scopedStorageKey(SIMPLE_PRICING_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.services) && Array.isArray(parsed.accessorials)) {
        return {
          services: parsed.services.map(normalizeService),
          vehicles: Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0 ? withNewPresets(parsed.vehicles.map(withCurrentPreset)) : structuredClone(INITIAL_VEHICLES),
          accessorials: (() => {
            const saved = parsed.accessorials.map(normalizeAccessorial) as AccessorialItem[];
            if ((parsed.schemaVersion ?? 0) >= 5) return saved;
            const updated = saved.map(item => item.code === 'FRAGILE' && item.name === 'Fragile Blanket Wrap'
              ? { ...item, name: 'Fragile', description: 'Extra handling for fragile packages.' } : item);
            return [...updated, ...INITIAL_ACCESSORIALS.filter(item =>
              (item.code === 'FRAGILE' || item.code === 'DG') && !updated.some(existing => existing.code === item.code))];
          })()
        };
      }
    }
  } catch (err) {
    console.warn('Could not read saved pricing config, using defaults:', err);
  }

  return defaultConfig();
}

export function saveSimplePricingConfig(config: SimplePricingConfig): void {
  try {
    localStorage.setItem(scopedStorageKey(SIMPLE_PRICING_STORAGE_KEY), JSON.stringify({ ...config, services: config.services.map(normalizeService), accessorials: config.accessorials.map(normalizeAccessorial), schemaVersion: 5 }));
  } catch (err) {
    console.error('Could not save pricing config:', err);
  }
}

export function resetSimplePricingConfig(): SimplePricingConfig {
  const defaults = defaultConfig();
  saveSimplePricingConfig(defaults);
  return defaults;
}
