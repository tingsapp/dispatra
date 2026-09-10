// Replaceable storage adapter for Dispatra organization pricing settings.
// Persists demonstration settings locally in browser storage with versioning,
// while maintaining typed contracts ready for backend integration.

import { OrganizationPricingSettings, RateCard } from '../types/pricing';

export const STORAGE_KEY = 'dispatra_org_pricing_settings_v1';

export const DEFAULT_PRICING_SETTINGS: OrganizationPricingSettings = {
  organizationId: 'org_dispatra_van_01',
  organizationName: 'Dispatra Vancouver Fleet & Logistics',
  timezone: 'America/Vancouver',
  defaultCurrency: 'CAD',
  readOnlyMode: false,

  serviceSpeeds: [
    {
      id: 'direct',
      name: 'Direct Point-to-Point',
      code: 'DIR-EXCL',
      description: 'Exclusive vehicle assigned directly. Direct non-stop routing with no unrelated stops or batching.',
      active: true,
      bookingCutoffTime: '18:00',
      operatingHours: {
        start: '06:00',
        end: '22:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      },
      deadlineRule: {
        startsAt: 'collection',
        durationHours: 1.5
      },
      exclusiveVehicle: true,
      rateCardId: 'rc_metro_default'
    },
    {
      id: 'within_4h',
      name: 'Within 4 Hours',
      code: 'EXP-4H',
      description: 'Expedited same-day window with priority batching across Vancouver core.',
      active: true,
      bookingCutoffTime: '15:00',
      operatingHours: {
        start: '07:00',
        end: '19:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      deadlineRule: {
        startsAt: 'booking',
        durationHours: 4.0
      },
      exclusiveVehicle: false,
      rateCardId: 'rc_metro_default'
    },
    {
      id: 'same_day',
      name: 'Same-Day End-of-Day',
      code: 'SAME-DAY',
      description: 'Standard same-day delivery completed by 17:00 for morning bookings.',
      active: true,
      bookingCutoffTime: '11:00',
      operatingHours: {
        start: '08:00',
        end: '17:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      deadlineRule: {
        startsAt: 'booking',
        durationHours: 8.0
      },
      exclusiveVehicle: false,
      rateCardId: 'rc_metro_default'
    },
    {
      id: 'next_day',
      name: 'Next-Day Commercial',
      code: 'NEXT-DAY',
      description: 'Economical distribution batched into regional overnight linehauls.',
      active: true,
      bookingCutoffTime: '17:00',
      operatingHours: {
        start: '08:00',
        end: '17:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      deadlineRule: {
        startsAt: 'scheduled_window_start',
        durationHours: 24.0
      },
      exclusiveVehicle: false,
      rateCardId: 'rc_nextday_econ'
    },
    {
      id: 'scheduled',
      name: 'Scheduled Appointment',
      code: 'SCHED-SLOT',
      description: 'Pre-booked dock appointment or residential customer time slot.',
      active: true,
      bookingCutoffTime: '16:00',
      operatingHours: {
        start: '07:00',
        end: '20:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      },
      deadlineRule: {
        startsAt: 'scheduled_window_start',
        durationHours: 2.0
      },
      exclusiveVehicle: false,
      rateCardId: 'rc_metro_default'
    }
  ],

  handlingLevels: [
    {
      id: 'curbside',
      name: 'Curbside Handover',
      description: 'Driver unloads to curb or tailgate. Consignee takes immediate custody without property entry.',
      active: true,
      premiumType: 'fixed',
      premiumValue: 0,
      appliesTo: 'base_fee',
      stairEligible: false
    },
    {
      id: 'doorstep',
      name: 'Doorstep / Porch Drop',
      description: 'Placement at main exterior door or sheltered porch with photo POD evidence.',
      active: true,
      premiumType: 'fixed',
      premiumValue: 5.00,
      appliesTo: 'base_fee',
      stairEligible: false
    },
    {
      id: 'inside_delivery',
      name: 'Inside Entryway Delivery',
      description: 'Placed inside residential foyer, garage, or commercial reception area past the threshold.',
      active: true,
      premiumType: 'fixed',
      premiumValue: 18.00,
      appliesTo: 'base_fee',
      stairEligible: true
    },
    {
      id: 'room_of_choice',
      name: 'Room of Choice',
      description: 'Item carried to specified room (upstairs or basement) with safety path clearance.',
      active: true,
      premiumType: 'fixed',
      premiumValue: 35.00,
      appliesTo: 'base_fee',
      stairEligible: true
    },
    {
      id: 'white_glove',
      name: 'White-Glove & Assembly',
      description: '2-person placement, unboxing, light assembly, and complete cardboard/debris removal.',
      active: true,
      premiumType: 'percentage',
      premiumValue: 30.0, // 30% handling premium
      appliesTo: 'transport_total',
      stairEligible: true
    }
  ],

  rateCards: [
    {
      id: 'rc_metro_default',
      name: 'Greater Vancouver Standard Fleet Rate Card',
      version: '2.4',
      status: 'published',
      isOrganizationDefault: true,
      effectiveFrom: '2026-01-01',
      currency: 'CAD',
      pricingMethod: 'distance_based',
      baseFee: 24.50,
      baseFeeIncludesKm: 5.0,
      additionalKmRate: 1.85,
      useDistanceBands: true,
      distanceBands: [
        { minKm: 0, maxKm: 15, ratePerKm: 1.85 },
        { minKm: 15, maxKm: 45, ratePerKm: 1.65 },
        { minKm: 45, maxKm: null, ratePerKm: 1.45 }
      ],
      includedMinutes: 15,
      additionalHourlyRate: 48.00,
      minimumBillableMinutes: 15,
      timeRoundingIncrementMinutes: 5,
      distanceBasis: 'individual_delivery',
      includeApproachTravel: false,
      includeReturnDepotTravel: false,
      minimumCharge: 32.00,
      fuelSurchargeEnabled: true,
      fuelSurchargePercentage: 11.4,
      fuelSurchargeBasis: 'transport_only'
    },
    {
      id: 'rc_dedicated_trip',
      name: 'Dedicated Van & Truck Trip Rate Card',
      version: '1.8',
      status: 'published',
      isOrganizationDefault: false,
      effectiveFrom: '2026-02-01',
      currency: 'CAD',
      pricingMethod: 'whole_trip',
      baseFee: 75.00,
      baseFeeIncludesKm: 15.0,
      additionalKmRate: 2.10,
      useDistanceBands: false,
      distanceBands: [],
      includedMinutes: 45,
      additionalHourlyRate: 65.00,
      minimumBillableMinutes: 30,
      timeRoundingIncrementMinutes: 15,
      distanceBasis: 'whole_trip',
      includeApproachTravel: true,
      includeReturnDepotTravel: false,
      minimumCharge: 95.00,
      fuelSurchargeEnabled: true,
      fuelSurchargePercentage: 11.4,
      fuelSurchargeBasis: 'transport_and_handling'
    },
    {
      id: 'rc_partner_westcoast',
      name: 'WestCoast Retailers Negotiated Rate Card',
      version: '1.2',
      status: 'published',
      isOrganizationDefault: false,
      customerId: 'cust_westcoast',
      customerName: 'WestCoast Home Living & Goods',
      effectiveFrom: '2026-03-01',
      currency: 'CAD',
      pricingMethod: 'distance_based',
      baseFee: 20.00,
      baseFeeIncludesKm: 8.0,
      additionalKmRate: 1.55,
      useDistanceBands: false,
      distanceBands: [],
      includedMinutes: 20,
      additionalHourlyRate: 42.00,
      minimumBillableMinutes: 15,
      timeRoundingIncrementMinutes: 5,
      distanceBasis: 'individual_delivery',
      includeApproachTravel: false,
      includeReturnDepotTravel: false,
      minimumCharge: 28.00,
      fuelSurchargeEnabled: true,
      fuelSurchargePercentage: 9.5, // Negotiated fuel index
      fuelSurchargeBasis: 'transport_only'
    },
    {
      id: 'rc_nextday_econ',
      name: 'Regional Overnight Consolidation',
      version: '1.0',
      status: 'draft',
      isOrganizationDefault: false,
      effectiveFrom: '2026-06-01',
      currency: 'CAD',
      pricingMethod: 'distance_based',
      baseFee: 14.00,
      baseFeeIncludesKm: 10.0,
      additionalKmRate: 1.15,
      useDistanceBands: false,
      distanceBands: [],
      includedMinutes: 10,
      additionalHourlyRate: 35.00,
      minimumBillableMinutes: 15,
      timeRoundingIncrementMinutes: 15,
      distanceBasis: 'individual_delivery',
      includeApproachTravel: false,
      includeReturnDepotTravel: false,
      minimumCharge: 18.50,
      fuelSurchargeEnabled: true,
      fuelSurchargePercentage: 8.0,
      fuelSurchargeBasis: 'transport_only'
    }
  ],

  vehicleTypes: [
    {
      vehicleId: 'veh_car_sedan',
      name: 'Sedan / Hatchback Courier',
      category: 'car',
      maxPayloadKg: 180,
      maxVolumeCbm: 0.8,
      baseRateMultiplier: 0.9,
      flatFeeAdjustment: 0,
      requiresCommercialLicense: false
    },
    {
      vehicleId: 'veh_cargo_van',
      name: 'Standard Cargo Van (High Roof)',
      category: 'cargo_van',
      maxPayloadKg: 1250,
      maxVolumeCbm: 9.5,
      baseRateMultiplier: 1.0,
      flatFeeAdjustment: 0,
      requiresCommercialLicense: false
    },
    {
      vehicleId: 'veh_sprinter_xl',
      name: 'Extended Sprinter Van (Heavy Duty)',
      category: 'cargo_van',
      maxPayloadKg: 1950,
      maxVolumeCbm: 14.2,
      baseRateMultiplier: 1.25,
      flatFeeAdjustment: 15.00,
      requiresCommercialLicense: false
    },
    {
      vehicleId: 'veh_box_truck_16',
      name: '16ft Box Truck with Power Liftgate',
      category: 'box_truck',
      maxPayloadKg: 3800,
      maxVolumeCbm: 24.0,
      baseRateMultiplier: 1.65,
      flatFeeAdjustment: 45.00,
      requiresCommercialLicense: true
    },
    {
      vehicleId: 'veh_box_truck_24',
      name: '24ft Freight Truck with Heavy Tailgate',
      category: 'box_truck',
      maxPayloadKg: 7500,
      maxVolumeCbm: 42.0,
      baseRateMultiplier: 2.15,
      flatFeeAdjustment: 85.00,
      requiresCommercialLicense: true
    }
  ],

  crewEquipment: {
    driverOnly: { baseRateMultiplier: 1.0, flatFee: 0 },
    twoPersonCrew: { flatFee: 65.00, minimumNoticeHours: 4 },
    extraHelperRate: 45.00,
    tailLiftSurcharge: 25.00,
    palletJackSurcharge: 15.00,
    refrigeratedSurcharge: 40.00
  },

  itemsAndLoad: {
    dimWeightDivisor: 5000, // 5000 cm3 / kg standard IATA
    dimWeightUnit: 'metric_cm_kg',
    dimWeightRule: 'greater_of_actual_or_dim',
    oversizedDimensionThresholdCm: 210, // Length, width, or height > 210 cm
    oversizedItemFee: 22.00,
    fragileHandlingFee: 14.50,
    nonStackableFee: 18.00,
    palletRatePerUnit: 25.00,
    maxSingleItemWeightKg: 180 // Above 180kg triggers manual review
  },

  accessHandling: {
    freeWaitTimeMinutes: 15, // 15 min free loading/unloading
    detentionRatePerHour: 48.00,
    stairPricingModel: 'per_flight_flat',
    stairFlightRate: 12.50,
    stairFreeFlightAllowance: 0,
    elevatorReservationWaitFee: 20.00,
    longCarryDistanceThresholdMeters: 35, // Carry beyond 35 meters
    longCarryFee: 16.00,
    dockAccessDiscount: 8.00 // -$8.00 discount if commercial dock is available
  },

  schedulingExceptions: {
    narrowWindowFee: 18.00,
    afterHoursFeePercent: 25, // +25% between 20:00 - 06:00
    weekendFeePercent: 15,    // +15%
    holidayFeePercent: 30,    // +30%
    remoteAreaSurcharge: 35.00,
    failedAttemptFee: 32.00,
    redeliveryFee: 24.00,
    returnToSenderFee: 45.00,
    cancellationFreeNoticeHours: 2,
    lateCancellationFee: 25.00
  },

  customerAgreements: [
    {
      customerId: 'cust_westcoast',
      customerName: 'WestCoast Home Living & Goods',
      contactEmail: 'logistics@westcoasthomeliving.ca',
      activeRateCardId: 'rc_partner_westcoast',
      discountPercentage: 10.0, // 10% contract discount
      paymentTerms: 'NET30',
      quoteValidityDays: 30,
      requiresPO: true
    },
    {
      customerId: 'cust_apex_dist',
      customerName: 'Apex Medical Supplies Ltd.',
      contactEmail: 'dispatch@apexsupplies.ca',
      activeRateCardId: 'rc_metro_default',
      discountPercentage: 5.0,
      paymentTerms: 'NET15',
      quoteValidityDays: 14,
      requiresPO: false
    }
  ]
};

export function loadPricingSettings(): OrganizationPricingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.organizationId && parsed.rateCards) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Unable to load pricing settings from localStorage:', e);
  }
  return DEFAULT_PRICING_SETTINGS;
}

export function savePricingSettings(settings: OrganizationPricingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Unable to save pricing settings to localStorage:', e);
  }
}

export function resetPricingSettings(): OrganizationPricingSettings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to reset storage:', e);
  }
  return DEFAULT_PRICING_SETTINGS;
}
