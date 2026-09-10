// Verification scenarios for Dispatra pricing engine.
// Each scenario demonstrates an explicit rule from the requirements and can be
// loaded directly into the Quote Simulator or run through assertions.

import { QuoteCalculationRequest } from '../types/pricing';

export interface VerificationScenario {
  id: string;
  name: string;
  badge: string;
  description: string;
  expectedBehavior: string;
  request: QuoteCalculationRequest;
}

export const VERIFICATION_SCENARIOS: VerificationScenario[] = [
  {
    id: 'scen_basic_distance',
    name: '1. Basic Distance & Transport Pricing',
    badge: 'Standard Road Fare',
    description: 'Standard cargo van transport across 22 km on Greater Vancouver Fleet Rate Card with 5 km included.',
    expectedBehavior: 'Base fee ($24.50) + 17 billable km @ $1.85 ($31.45) + 11.4% fuel index + 5% GST.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'same_day',
      handlingLevelId: 'doorstep',
      distanceKm: 22.0,
      durationMinutes: 38,
      selectedVehicleId: 'veh_cargo_van',
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: '885 W Georgia St, Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: '4700 Kingsway, Burnaby',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 15,
          hasLoadingDock: false
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Cartons of Retail Goods (3 boxes)',
          quantity: 3,
          weightKg: 15,
          lengthCm: 40,
          widthCm: 30,
          heightCm: 30,
          isFragile: false,
          isPallet: false,
          isNonStackable: false
        }
      ]
    }
  },
  {
    id: 'scen_min_charge_discount',
    name: '2. Minimum Charge Floor & Customer Discount',
    badge: 'Rule Floor Check',
    description: 'Short 1.5 km trip under minimum floor rate. Tests customer agreement discount and minimum price floor adjustment.',
    expectedBehavior: 'Raw calculated subtotal is below $32.00 minimum charge floor; engine automatically applies minimum floor adjustment before taxes.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'same_day',
      handlingLevelId: 'curbside',
      distanceKm: 1.5,
      durationMinutes: 10,
      selectedVehicleId: 'veh_cargo_van',
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: '1055 W Hastings St, Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 5,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: '550 Burrard St, Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 5,
          hasLoadingDock: true
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Document Pouches (Small batch)',
          quantity: 1,
          weightKg: 2,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 5,
          isFragile: false,
          isPallet: false,
          isNonStackable: false
        }
      ]
    }
  },
  {
    id: 'scen_customer_override',
    name: '3. Customer-Specific Rate Card Override',
    badge: 'Enterprise MSA',
    description: 'WestCoast Home Living agreement: custom rate card ($20 base, 8km included, $1.55/km, 9.5% fuel) plus 10% contract discount.',
    expectedBehavior: 'Engine identifies WestCoast agreement, uses customized rate card instead of org default, and applies 10% contract discount line.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'same_day',
      handlingLevelId: 'inside_delivery',
      customerId: 'cust_westcoast',
      distanceKm: 28.0,
      durationMinutes: 45,
      selectedVehicleId: 'veh_cargo_van',
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: '13300 Vulcan Way, Richmond',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: '2280 W 4th Ave, Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 12,
          hasLoadingDock: false
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Flatpack Dining Table & Chairs',
          quantity: 2,
          weightKg: 45,
          lengthCm: 160,
          widthCm: 90,
          heightCm: 25,
          isFragile: false,
          isPallet: false,
          isNonStackable: false
        }
      ]
    }
  },
  {
    id: 'scen_stop_stairs',
    name: '4. Two-Flight Stair Handling at Drop-off Only',
    badge: 'Stop-Specific Access',
    description: 'Pickup has dock and elevator (0 flights). Consignee drop-off walk-up apartment has 2 flights of stairs.',
    expectedBehavior: 'Only Drop-off Stop #2 incurs stair fees (2 flights @ $12.50 = $25.00). Pickup stop is not charged for stairs.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'within_4h',
      handlingLevelId: 'room_of_choice',
      distanceKm: 14.5,
      durationMinutes: 30,
      selectedVehicleId: 'veh_cargo_van',
      crewType: 'two_person',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: '3500 Viking Way, Richmond',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: '1540 W 12th Ave, Apt 302, Vancouver',
          stairFlights: 2,
          elevatorAvailable: false,
          itemFitsElevator: false,
          carryDistanceMeters: 25,
          hasLoadingDock: false
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Commercial Espresso Machine',
          quantity: 1,
          weightKg: 62,
          lengthCm: 75,
          widthCm: 60,
          heightCm: 55,
          isFragile: true,
          isPallet: false,
          isNonStackable: false
        }
      ]
    }
  },
  {
    id: 'scen_elevator_overflow',
    name: '5. Item Does Not Fit in Elevator -> Stair Fallback',
    badge: 'Elevator Clearance',
    description: 'Building has a working passenger elevator, but large sofa (230 cm) does not fit inside cab, forcing walk-up stairs.',
    expectedBehavior: 'Elevator flag is overridden by itemFitsElevator=false; engine charges for 3 flights of stairs carry.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'scheduled',
      handlingLevelId: 'inside_delivery',
      distanceKm: 18.0,
      durationMinutes: 40,
      selectedVehicleId: 'veh_sprinter_xl',
      crewType: 'two_person',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: true,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: 'Warehouse Hub 3, Delta',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 5,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: '988 Richards St, Vancouver',
          stairFlights: 3,
          elevatorAvailable: true,
          itemFitsElevator: false, // DOES NOT FIT!
          carryDistanceMeters: 20,
          hasLoadingDock: false
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Three-Seater Sectional Couch (Oversized)',
          quantity: 1,
          weightKg: 85,
          lengthCm: 230,
          widthCm: 95,
          heightCm: 85,
          isFragile: false,
          isPallet: false,
          isNonStackable: true
        }
      ]
    }
  },
  {
    id: 'scen_dedicated_multi_stop',
    name: '6. Dedicated Multi-Stop Trip with Shared Pickup',
    badge: 'Dedicated Fleet Route',
    description: 'Dedicated Sprinter Van chartered for 4 stops. Base dispatch fee charged once at trip level, not duplicated per drop.',
    expectedBehavior: 'Trip base fee charged once ($75.00 for 15km). Stop handling evaluated individually without duplicate dispatch fees.',
    request: {
      pricingMode: 'dedicated_trip',
      serviceSpeedId: 'scheduled',
      handlingLevelId: 'doorstep',
      rateCardId: 'rc_dedicated_trip',
      distanceKm: 42.0,
      durationMinutes: 110,
      selectedVehicleId: 'veh_sprinter_xl',
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: 'Depot A (Origin), 1200 Terminal Ave',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: 'Drop 1: 3300 Commercial Dr, Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 15,
          hasLoadingDock: false
        },
        {
          id: 's3',
          stopType: 'dropoff',
          address: 'Drop 2: 6500 Hastings St, Burnaby',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 15,
          hasLoadingDock: false
        },
        {
          id: 's4',
          stopType: 'dropoff',
          address: 'Drop 3: 1100 Lonsdale Ave, North Vancouver',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: false
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Assorted Retail Deliveries (3 stops)',
          quantity: 6,
          weightKg: 120,
          lengthCm: 60,
          widthCm: 50,
          heightCm: 40,
          isFragile: false,
          isPallet: false,
          isNonStackable: false
        }
      ]
    }
  },
  {
    id: 'scen_locked_manual_price',
    name: '7. Preservation of Accepted / Locked Manual Price',
    badge: 'Locked Price Guarantee',
    description: 'Dispatch manifest has an agreed quote of $165.00 CAD. Setting changes or formula variations must never rewrite accepted price.',
    expectedBehavior: 'Automated distance/surcharge calculation bypassed. Exact $165.00 CAD preserved + 5% GST.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'direct',
      handlingLevelId: 'inside_delivery',
      manualLockedPrice: 165.00,
      distanceKm: 35.0,
      durationMinutes: 55,
      selectedVehicleId: 'veh_cargo_van',
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: 'Downtown Port Terminal',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: 'Surrey Central Logistics Park',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 10,
          hasLoadingDock: true
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Custom Sealed Machinery Crate',
          quantity: 1,
          weightKg: 350,
          lengthCm: 150,
          widthCm: 100,
          heightCm: 90,
          isFragile: true,
          isPallet: true,
          isNonStackable: true
        }
      ]
    }
  },
  {
    id: 'scen_infeasible_weight',
    name: '8. Infeasible Payload -> Manual Review Alert',
    badge: 'Safety Alert Check',
    description: 'Cargo payload of 2,400 kg assigned to a standard sedan courier with 180 kg payload limit.',
    expectedBehavior: 'Returns "Cannot Quote Automated: Manual Review Required" warning with explicit safety payload violation details.',
    request: {
      pricingMode: 'individual_delivery',
      serviceSpeedId: 'same_day',
      handlingLevelId: 'curbside',
      distanceKm: 15.0,
      durationMinutes: 25,
      selectedVehicleId: 'veh_car_sedan', // 180 kg max payload!
      crewType: 'driver_only',
      requiresTailLift: false,
      requiresPalletJack: false,
      isAfterHours: false,
      isWeekend: false,
      isNarrowWindow: false,
      stops: [
        {
          id: 's1',
          stopType: 'pickup',
          address: 'Richmond Industrial Park',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 5,
          hasLoadingDock: true
        },
        {
          id: 's2',
          stopType: 'dropoff',
          address: 'Vancouver Wholesale Market',
          stairFlights: 0,
          elevatorAvailable: true,
          itemFitsElevator: true,
          carryDistanceMeters: 5,
          hasLoadingDock: true
        }
      ],
      items: [
        {
          id: 'it1',
          description: 'Industrial Steel Piping & Fittings',
          quantity: 12,
          weightKg: 200, // 2,400 kg total!
          lengthCm: 200,
          widthCm: 30,
          heightCm: 30,
          isFragile: false,
          isPallet: true,
          isNonStackable: true
        }
      ]
    }
  }
];
