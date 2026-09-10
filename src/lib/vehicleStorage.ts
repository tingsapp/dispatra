export interface VehicleAsset {
  id: string;
  unitNumber: string;
  plateNumber: string;
  vin: string;
  category: '1 Tonne Van' | '2 Tonne Cube' | '3 Tonne Box' | '5 Tonne Freight' | 'Flatbed' | 'Refrigerated Reefer';
  makeModel: string;
  year: number;
  status: 'in_service' | 'available' | 'maintenance' | 'standby';
  statusLabel: string;
  currentDriverId?: string;
  currentDriverName?: string;
  currentLocation?: string;
  fuelBatteryPercent: number;
  fuelType: 'Diesel' | 'Gasoline' | 'Electric' | 'Hybrid';
  odometerKm: number;
  payloadCapacityKg: number;
  palletCapacity: number;
  hasLiftgate: boolean;
  hasReefer: boolean;
  reeferTempC?: number;
  lastInspectionDate: string;
  nextServiceKm: number;
  notes?: string;
}

export const INITIAL_VEHICLES_FLEET: VehicleAsset[] = [
  {
    id: 'veh-01',
    unitNumber: 'V12',
    plateNumber: 'BC L2 ABC 123',
    vin: '2C3CDZFJ8NH109482',
    category: '2 Tonne Cube',
    makeModel: 'Ford E-450 Super Duty Cutaway',
    year: 2023,
    status: 'in_service',
    statusLabel: 'In Service / En Route',
    currentDriverId: 'D14',
    currentDriverName: 'Arles Morgan',
    currentLocation: 'Granville St & W Broadway, Vancouver',
    fuelBatteryPercent: 78,
    fuelType: 'Diesel',
    odometerKm: 84210,
    payloadCapacityKg: 2200,
    palletCapacity: 4,
    hasLiftgate: true,
    hasReefer: false,
    lastInspectionDate: '2026-01-15',
    nextServiceKm: 90000,
    notes: 'Equipped with heavy-duty Maxon 1000kg fold-away liftgate.'
  },
  {
    id: 'veh-02',
    unitNumber: 'V08',
    plateNumber: 'BC TRK 882',
    vin: '1HTMMAAK6FH648102',
    category: '3 Tonne Box',
    makeModel: 'Freightliner M2 106 Medium Duty',
    year: 2022,
    status: 'in_service',
    statusLabel: 'In Service / En Route',
    currentDriverId: 'D28',
    currentDriverName: 'Marcus Vance',
    currentLocation: 'Commercial Dr & E Broadway, East Vancouver',
    fuelBatteryPercent: 64,
    fuelType: 'Diesel',
    odometerKm: 126450,
    payloadCapacityKg: 3500,
    palletCapacity: 6,
    hasLiftgate: true,
    hasReefer: true,
    reeferTempC: 3.8,
    lastInspectionDate: '2026-02-10',
    nextServiceKm: 135000,
    notes: 'Thermo King V-520 reefer unit calibrated for chilled pharma/produce.'
  },
  {
    id: 'veh-03',
    unitNumber: 'V14',
    plateNumber: 'BC DISP 901',
    vin: 'WD4PF4CC4MT092811',
    category: '1 Tonne Van',
    makeModel: 'Mercedes-Benz Sprinter 2500 High Roof',
    year: 2024,
    status: 'available',
    statusLabel: 'Available / Staged',
    currentDriverId: 'D09',
    currentDriverName: 'Maria Garcia',
    currentLocation: 'Olympic Village Staging Dock, Vancouver',
    fuelBatteryPercent: 92,
    fuelType: 'Diesel',
    odometerKm: 42190,
    payloadCapacityKg: 1450,
    palletCapacity: 2,
    hasLiftgate: false,
    hasReefer: false,
    lastInspectionDate: '2026-03-01',
    nextServiceKm: 50000,
    notes: 'Clean express cargo van with interior e-track tie down rails.'
  },
  {
    id: 'veh-04',
    unitNumber: 'V04',
    plateNumber: 'BC FLT 319',
    vin: '1FDRF3HT9PED48190',
    category: '5 Tonne Freight',
    makeModel: 'Hino 338 26ft Dry Freight Box',
    year: 2021,
    status: 'available',
    statusLabel: 'Available / Depot',
    currentDriverId: 'D18',
    currentDriverName: 'Sam Jenkins',
    currentLocation: 'Mount Pleasant Main Depot, Vancouver',
    fuelBatteryPercent: 55,
    fuelType: 'Diesel',
    odometerKm: 198300,
    payloadCapacityKg: 5800,
    palletCapacity: 10,
    hasLiftgate: true,
    hasReefer: false,
    lastInspectionDate: '2025-11-20',
    nextServiceKm: 205000,
    notes: 'Commercial Air Brakes required (Class 3 with Air endorsement).'
  },
  {
    id: 'veh-05',
    unitNumber: 'V19',
    plateNumber: 'BC VAN 442',
    vin: '1FTBR1Y88PKA98201',
    category: '1 Tonne Van',
    makeModel: 'Ford E-Transit 350 Cargo Long Extended',
    year: 2024,
    status: 'available',
    statusLabel: 'Available / Staged',
    currentDriverId: 'D31',
    currentDriverName: 'Chloe Bennett',
    currentLocation: 'Downtown Coal Harbour Hub, Vancouver',
    fuelBatteryPercent: 84,
    fuelType: 'Electric',
    odometerKm: 28600,
    payloadCapacityKg: 1380,
    palletCapacity: 2,
    hasLiftgate: false,
    hasReefer: false,
    lastInspectionDate: '2026-02-18',
    nextServiceKm: 40000,
    notes: 'Zero emission certified for downtown low-emission courier zones.'
  },
  {
    id: 'veh-06',
    unitNumber: 'V02',
    plateNumber: 'BC SPR 109',
    vin: 'WD3PF0CD7LP114820',
    category: 'Refrigerated Reefer',
    makeModel: 'Mercedes-Benz Sprinter 3500 Deep Freeze',
    year: 2023,
    status: 'standby',
    statusLabel: 'Standby / Pre-Cooling',
    currentLocation: 'Richmond Cold Storage Facility, BC',
    fuelBatteryPercent: 96,
    fuelType: 'Diesel',
    odometerKm: 61400,
    payloadCapacityKg: 1850,
    palletCapacity: 3,
    hasLiftgate: true,
    hasReefer: true,
    reeferTempC: -18.2,
    lastInspectionDate: '2026-01-28',
    nextServiceKm: 70000,
    notes: 'Pre-cooled for frozen seafood / lab samples. Ready for standby call.'
  },
  {
    id: 'veh-07',
    unitNumber: 'V07',
    plateNumber: 'BC FLT 774',
    vin: '3ALACWDN8HD891024',
    category: 'Flatbed',
    makeModel: 'Freightliner Business Class M2 Flatbed',
    year: 2020,
    status: 'standby',
    statusLabel: 'Standby / Yard',
    currentLocation: 'Annacis Island Yard, Delta, BC',
    fuelBatteryPercent: 42,
    fuelType: 'Diesel',
    odometerKm: 154200,
    payloadCapacityKg: 4200,
    palletCapacity: 8,
    hasLiftgate: true,
    hasReefer: false,
    lastInspectionDate: '2025-10-14',
    nextServiceKm: 160000,
    notes: 'Stake body flatbed with heavy straps & weatherproof tarps.'
  },
  {
    id: 'veh-08',
    unitNumber: 'V11',
    plateNumber: 'BC BOX 505',
    vin: '1HTMMAAK0GH771920',
    category: '3 Tonne Box',
    makeModel: 'International MV607 Box Truck',
    year: 2021,
    status: 'maintenance',
    statusLabel: 'In Maintenance / Shop',
    currentLocation: 'Harbor Commercial Fleet Repair, Burnaby',
    fuelBatteryPercent: 30,
    fuelType: 'Diesel',
    odometerKm: 182900,
    payloadCapacityKg: 3400,
    palletCapacity: 6,
    hasLiftgate: true,
    hasReefer: false,
    lastInspectionDate: '2025-08-05',
    nextServiceKm: 185000,
    notes: 'Undergoing 180,000 km scheduled brake overhaul and hydraulic lift seal replacement.'
  }
];

export const VEHICLES_STORAGE_KEY = 'dispatra_vehicles_fleet_v1';

export function loadVehicles(): VehicleAsset[] {
  try {
    const raw = localStorage.getItem(VEHICLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load vehicles from localStorage:', err);
  }
  return INITIAL_VEHICLES_FLEET;
}

export function saveVehicles(vehicles: VehicleAsset[]): void {
  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
  } catch (err) {
    console.warn('Could not save vehicles to localStorage:', err);
  }
}
