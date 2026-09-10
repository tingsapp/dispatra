// Simple, dynamic domain types for Dispatra Services and Accessorials

export interface DeliveryService {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  includedKm: number;
  perKmPrice: number;
  estimatedTime?: string;
  active: boolean;
}

export type AccessorialPricingType = 'flat' | 'per_unit';

export interface AccessorialItem {
  id: string;
  name: string;
  description: string;
  price: number;
  pricingType: AccessorialPricingType;
  unitLabel: string; // e.g. "per flight", "per 15 min", "per item", "flat fee"
  active: boolean;
}

export interface VehicleType {
  id: string;
  name: string;
  payloadCapacityKg: number; // e.g. 1000 for 1 Tonne, 2000 for 2 Tonne, etc.
  palletCapacity: number;    // e.g. 2, 4, 8, 12 pallets
  cargoBedFeet?: number;     // e.g. 10ft, 16ft, 20ft, 26ft
  cargoVolumeCbm?: number;   // e.g. 12 m³, 22 m³, 35 m³
  baseSurcharge: number;     // Flat vehicle upgrade surcharge ($)
  hasLiftgate: boolean;      // Equipped with power tail-lift
  requiresCommercialLicense: boolean; // CDL / Air brakes required
  description?: string;
  active: boolean;
}

export interface SimplePricingConfig {
  services: DeliveryService[];
  vehicles: VehicleType[];
  accessorials: AccessorialItem[];
}

export interface SimulatorSelection {
  serviceId: string;
  vehicleId: string;
  distanceKm: number;
  cargoWeightKg?: number;
  palletCount?: number;
  selectedAccessorials: {
    [accessorialId: string]: {
      enabled: boolean;
      quantity: number;
    };
  };
}
