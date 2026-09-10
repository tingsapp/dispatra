// Pure, typed domain models for Dispatra Organization Pricing & Services

export type BasePricingMethod =
  | 'distance_based' // Base fee + road distance (per km)
  | 'zone_to_zone'   // Zone pair matrix table
  | 'fixed_delivery' // Flat fee per delivery
  | 'hourly'         // Billable duration per hour
  | 'whole_trip';    // Dedicated route/trip basis

export type ServiceSpeedId = 'direct' | 'within_4h' | 'same_day' | 'next_day' | 'scheduled';

export interface ServiceSpeed {
  id: ServiceSpeedId;
  name: string;
  code: string;
  description: string;
  active: boolean;
  bookingCutoffTime: string; // "14:00"
  operatingHours: {
    start: string; // "07:00"
    end: string;   // "19:00"
    days: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[];
  };
  deadlineRule: {
    startsAt: 'booking' | 'collection' | 'scheduled_window_start';
    durationHours: number;
  };
  exclusiveVehicle: boolean; // Direct: true (no unrelated stops, batching disabled)
  rateCardId: string;
}

export type HandlingLevelId = 'curbside' | 'doorstep' | 'inside_delivery' | 'room_of_choice' | 'white_glove';

export interface HandlingLevel {
  id: HandlingLevelId;
  name: string;
  description: string;
  active: boolean;
  premiumType: 'fixed' | 'percentage';
  premiumValue: number; // e.g., $15.00 or 15%
  appliesTo: 'base_fee' | 'transport_total' | 'subtotal';
  stairEligible: boolean; // Curbside = false, Inside = true
}

export interface DistanceBand {
  minKm: number;
  maxKm: number | null; // null = unlimited
  ratePerKm: number;
}

export interface RateCard {
  id: string;
  name: string;
  version: string;
  status: 'published' | 'draft' | 'archived';
  isOrganizationDefault: boolean;
  customerId?: string;
  customerName?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  currency: 'CAD' | 'USD';
  pricingMethod: BasePricingMethod;
  
  // Transport & Base
  baseFee: number;
  baseFeeIncludesKm: number; // e.g. first 5 km included
  additionalKmRate: number;  // after included km
  useDistanceBands: boolean;
  distanceBands: DistanceBand[];
  
  // Time & Hourly
  includedMinutes: number;
  additionalHourlyRate: number;
  minimumBillableMinutes: number;
  timeRoundingIncrementMinutes: number; // 5m, 15m
  
  // Trip & Route Basis
  distanceBasis: 'individual_delivery' | 'whole_trip';
  includeApproachTravel: boolean;
  includeReturnDepotTravel: boolean;
  minimumCharge: number;

  // Fuel Surcharge
  fuelSurchargeEnabled: boolean;
  fuelSurchargePercentage: number; // e.g. 11.4%
  fuelSurchargeBasis: 'transport_only' | 'transport_and_handling' | 'net_subtotal';
}

export interface VehicleTypeRate {
  vehicleId: string;
  name: string;
  category: 'car' | 'cargo_van' | 'box_truck' | 'specialist';
  maxPayloadKg: number;
  maxVolumeCbm: number;
  baseRateMultiplier: number;
  flatFeeAdjustment: number;
  requiresCommercialLicense: boolean;
}

export interface CrewEquipmentRules {
  driverOnly: { baseRateMultiplier: number; flatFee: number };
  twoPersonCrew: { flatFee: number; minimumNoticeHours: number };
  extraHelperRate: number; // Per additional helper
  tailLiftSurcharge: number;
  palletJackSurcharge: number;
  refrigeratedSurcharge: number;
}

export interface ItemsAndLoadRules {
  dimWeightDivisor: number; // e.g., 5000 cm³/kg
  dimWeightUnit: 'metric_cm_kg' | 'imperial_in_lb';
  dimWeightRule: 'greater_of_actual_or_dim' | 'actual_only' | 'dim_only';
  oversizedDimensionThresholdCm: number; // length > 220cm
  oversizedItemFee: number;
  fragileHandlingFee: number;
  nonStackableFee: number;
  palletRatePerUnit: number;
  maxSingleItemWeightKg: number; // e.g., 400kg -> requires manual review
}

export interface AccessHandlingRules {
  freeWaitTimeMinutes: number;
  detentionRatePerHour: number;
  stairPricingModel: 'per_flight_flat' | 'per_item_per_flight' | 'time_duration';
  stairFlightRate: number; // e.g. $12.00 per flight
  stairFreeFlightAllowance: number; // e.g. 0 flights free
  elevatorReservationWaitFee: number;
  longCarryDistanceThresholdMeters: number; // > 40m
  longCarryFee: number;
  dockAccessDiscount: number; // discount if standard loading dock exists
}

export interface SchedulingExceptionsRules {
  narrowWindowFee: number; // delivery window <= 1h
  afterHoursFeePercent: number; // 25% (20:00 - 06:00)
  weekendFeePercent: number;    // 15%
  holidayFeePercent: number;    // 30%
  remoteAreaSurcharge: number;  // $35.00 flat
  failedAttemptFee: number;     // 75% of base
  redeliveryFee: number;        // 50% of trip
  returnToSenderFee: number;    // 100% of transport
  cancellationFreeNoticeHours: number; // 2 hours
  lateCancellationFee: number;
}

export interface CustomerAgreement {
  customerId: string;
  customerName: string;
  contactEmail: string;
  activeRateCardId: string;
  discountPercentage: number;
  paymentTerms: 'NET15' | 'NET30' | 'COD';
  quoteValidityDays: number;
  requiresPO: boolean;
}

export interface OrganizationPricingSettings {
  organizationId: string;
  organizationName: string;
  timezone: string; // 'America/Vancouver'
  defaultCurrency: 'CAD' | 'USD';
  serviceSpeeds: ServiceSpeed[];
  handlingLevels: HandlingLevel[];
  rateCards: RateCard[];
  vehicleTypes: VehicleTypeRate[];
  crewEquipment: CrewEquipmentRules;
  itemsAndLoad: ItemsAndLoadRules;
  accessHandling: AccessHandlingRules;
  schedulingExceptions: SchedulingExceptionsRules;
  customerAgreements: CustomerAgreement[];
  readOnlyMode: boolean;
}

// Quote Simulator Types
export interface SimulatorStop {
  id: string;
  stopType: 'pickup' | 'dropoff';
  address: string;
  linkedJobId?: string;
  scheduledTime?: string;
  stairFlights: number;
  elevatorAvailable: boolean;
  itemFitsElevator: boolean;
  carryDistanceMeters: number;
  hasLoadingDock: boolean;
  actualWaitMinutes?: number;
}

export interface SimulatorItem {
  id: string;
  description: string;
  quantity: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  isFragile: boolean;
  isPallet: boolean;
  isNonStackable: boolean;
}

export interface QuoteCalculationRequest {
  pricingMode: 'individual_delivery' | 'dedicated_trip';
  serviceSpeedId: ServiceSpeedId;
  handlingLevelId: HandlingLevelId;
  customerId?: string; // or default org rate card
  rateCardId?: string; // explicitly chosen or derived
  distanceKm: number;
  durationMinutes: number;
  stops: SimulatorStop[];
  items: SimulatorItem[];
  selectedVehicleId: string;
  crewType: 'driver_only' | 'two_person';
  requiresTailLift: boolean;
  requiresPalletJack: boolean;
  isAfterHours: boolean;
  isWeekend: boolean;
  isNarrowWindow: boolean;
  manualLockedPrice?: number; // Manual or imported price that must not be overwritten
}

export interface QuoteLineItem {
  code: string;
  name: string;
  category: 'base_transport' | 'handling' | 'equipment_crew' | 'accessorial' | 'surcharge' | 'discount' | 'tax';
  description: string;
  amount: number;
  rateApplied?: string;
  allowanceApplied?: string;
}

export interface QuoteCalculationResult {
  isManualReviewRequired: boolean;
  manualReviewReasons: string[];
  rateCardUsed: {
    id: string;
    name: string;
    version: string;
    isCustomerSpecific: boolean;
  };
  lineItems: QuoteLineItem[];
  subtotal: number;
  appliedDiscounts: number;
  minimumChargeAdjustment: number;
  fuelSurchargeAmount: number;
  taxAmount: number; // 5% GST in BC
  total: number;
  currency: string;
  calculationOrderBreakdown: string[];
  isLockedManualPrice: boolean;
  postDispatchAdjustmentsAvailable?: {
    waitingTimeAdjustment: number;
    failedAttemptAdjustment: number;
  };
}
