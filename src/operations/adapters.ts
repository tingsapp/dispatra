import type { SelectedAddress } from '../components/ui/AddressAutocomplete';
import type { Customer } from '../lib/customerStorage';
import type { Address, Shipper, ShipperInput } from './api';

/** Accept the complete Canadian address shown by the existing one-field forms. */
export function canadianAddress(text: string, previous?: Address, coordinates?: SelectedAddress): Address {
  const clean = text.trim();
  if (previous && previous.text === clean && !coordinates) return previous;
  const match = clean.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})[,\s]+([A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d)(?:,\s*Canada)?$/i);
  const postalInText = clean.match(/\b([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)\b/i);
  const city = coordinates?.city?.trim() || match?.[2]?.trim();
  const province = coordinates?.province?.trim().toUpperCase() || match?.[3]?.toUpperCase();
  const postal = coordinates?.postalCode?.trim() || postalInText?.[0];
  if (coordinates?.country && coordinates.country.toUpperCase() !== 'CA') throw new Error('Choose an address in Canada.');
  if (!city || !province || !postal || !clean) throw new Error('Enter a full Canadian address: street, city, province and postal code.');
  const postalCode = postal.toUpperCase().replace(/[\s-]/g, '').replace(/^(.{3})(.{3})$/, '$1 $2');
  if (!/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(postalCode)) throw new Error('Enter a valid Canadian postal code.');
  const fullText = postalInText ? clean : clean.replace(/(,\s*Canada)?$/i, `${clean.endsWith(',') ? '' : ' '}${postalCode}$1`);
  return { text: fullText, city, province, postal_code: postalCode, country: 'CA', latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null };
}

export function shipperToCustomer(row: Shipper): Customer {
  const status = row.status === 'ON_HOLD' ? 'On Hold' : row.status === 'INACTIVE' ? 'Inactive' : 'Active';
  return {
    id: row.id, code: row.number, name: row.name, legalName: row.company_name,
    customerType: row.kind === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'BUSINESS', contactName: row.name,
    email: row.email, phone: row.phone, address: row.warehouse.text, city: row.warehouse.city,
    accountType: 'Standard Freight', status, defaultRequirements: [], billingEmail: '',
    rateCardId: row.rate_card_id, discount: { type: row.discount.kind, value: Number(row.discount.value), scope: 'TRANSPORT_ONLY' },
    taxProfileId: null, taxExempt: false, totalShipments: 0, activeJobsCount: 0,
    notes: row.instructions, createdAt: row.created_at,
    communicationPreferences: { sms: false, email: row.email_updates ?? true, tracking: true },
  };
}

export function customerToShipper(form: Partial<Customer>, previous?: Shipper, coordinates?: SelectedAddress): ShipperInput {
  const kind = form.customerType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'BUSINESS';
  return {
    name: form.name?.trim() ?? '', kind, company_name: kind === 'BUSINESS' ? form.legalName?.trim() ?? '' : '',
    email: form.email?.trim().toLowerCase() ?? '', phone: form.phone?.trim() ?? '',
    warehouse: canadianAddress(form.address ?? '', previous?.warehouse, coordinates),
    rate_card_id: form.rateCardId || null,
    discount: { kind: form.discount?.type === 'PERCENT' || form.discount?.type === 'FIXED' ? form.discount.type : 'NONE', value: form.discount?.value ?? 0 },
    instructions: form.notes ?? '',
    email_updates: form.communicationPreferences?.email ?? previous?.email_updates ?? true,
  };
}

import type { Driver as UiDriver } from '../types';
import type { VehicleAsset } from '../lib/vehicleStorage';
import type { Driver as ApiDriver, DriverInput, Vehicle as ApiVehicle, VehicleInput, CatalogItem, CatalogInput } from './api';

export function driverToUi(row: ApiDriver, vehicle?: ApiVehicle, monitor?: { on_duty: boolean; location?: { latitude?: number; longitude?: number } | null }): UiDriver {
  const details = row.data as Partial<DriverInput>;
  const onDuty = row.active && (monitor?.on_duty ?? row.on_duty);
  const status = !row.active ? 'offline' : onDuty ? 'available' : 'offline';
  return {
    id: row.id, driverNumber: row.number, name: row.name, avatar: details.avatar_url ?? '',
    status, statusLabel: onDuty ? 'Available' : 'Off duty', vehicle: vehicle ? `${vehicle.number} · ${vehicle.plate}` : 'Unassigned',
    currentVehicleId: row.vehicle_id, nextStop: 'Not set', eta: '—', distance: '—', lastUpdate: row.last_seen_at ?? 'Not set',
    phone: row.phone, email: row.email, address: row.address.text,
    skills: details.qualifications ?? [], maximumWorkMinutes: details.maximum_work_minutes ?? 480,
    accountStatus: row.active ? 'ACTIVE' : 'INACTIVE',
    dutyStatus: onDuty ? 'ON_DUTY' : 'OFF_DUTY', locationPermissionStatus: row.location_permission as UiDriver['locationPermissionStatus'],
    appLastSeenAt: row.last_seen_at, createdAt: row.created_at,
    lat: monitor?.location?.latitude ?? NaN, lng: monitor?.location?.longitude ?? NaN,
  };
}

export function driverFromUi(form: UiDriver, previous?: ApiDriver, coordinates?: SelectedAddress): DriverInput {
  const old = previous?.data as Partial<DriverInput> | undefined;
  return {
    name: form.name.trim(), avatar_url: form.avatar.startsWith('http') ? form.avatar : '', email: form.email?.trim() ?? '',
    phone: form.phone?.trim() ?? '', address: canadianAddress(form.address ?? '', previous?.address, coordinates),
    vehicle_id: form.currentVehicleId || null,
    qualifications: form.skills ?? old?.qualifications ?? [], crew_size: old?.crew_size ?? 1,
    shift_start: form.shiftStart || null, shift_end: form.shiftEnd || null,
    maximum_work_minutes: form.maximumWorkMinutes ?? old?.maximum_work_minutes ?? 480,
    active: form.accountStatus !== 'INACTIVE',
  };
}

export function vehicleToUi(row: ApiVehicle, type?: CatalogItem, driver?: ApiDriver): VehicleAsset {
  const data = row.data;
  const available = !row.active ? 'INACTIVE' : data.availability;
  const status = available === 'UNAVAILABLE' ? 'maintenance' : available === 'INACTIVE' ? 'standby' : 'available';
  return {
    id: row.id, vehicleNumber: row.number, unitNumber: data.unit_number, plateNumber: row.plate, vin: data.vin,
    category: (['1 Tonne Van', '2 Tonne Cube', '3 Tonne Box', '5 Tonne Freight', 'Flatbed', 'Refrigerated Reefer'] as const).find(name => name === type?.data.name) ?? (data.equipment.includes('REFRIGERATION') ? 'Refrigerated Reefer' : '1 Tonne Van'), makeModel: data.make_model, year: data.year ?? 0,
    status, statusLabel: available === 'UNAVAILABLE' ? 'Unavailable' : available === 'INACTIVE' ? 'Inactive' : 'Available',
    currentDriverId: driver?.id, currentDriverName: driver?.name, currentLocation: '',
    fuelBatteryPercent: 0, fuelType: 'Diesel', odometerKm: 0, payloadCapacityKg: Number(data.payload_kg),
    palletCapacity: data.pallet_capacity, hasLiftgate: data.equipment.includes('LIFTGATE'), hasReefer: data.equipment.includes('REFRIGERATION'),
    lastInspectionDate: '', nextServiceKm: 0, notes: data.description, createdAt: row.created_at,
    vehicleTypeId: type?.id ?? row.type_id, recordStatus: row.active ? 'ACTIVE' : 'INACTIVE',
    availability: available === 'INACTIVE' ? 'AVAILABLE' : available,
    plateProvince: row.province, maxStops: data.maximum_stops ?? undefined,
    cargoLengthCm: Number(data.length_cm), cargoWidthCm: Number(data.width_cm), cargoHeightCm: Number(data.height_cm),
    cargoVolumeM3: Number(data.volume_m3), equipment: data.equipment,
    unavailableReason: data.unavailable_reason, unavailableFrom: data.unavailable_from ?? undefined,
    unavailableUntil: data.unavailable_until ?? undefined,
  };
}

export function vehicleFromUi(form: VehicleAsset, previous?: ApiVehicle): VehicleInput {
  const old = previous?.data;
  return {
    name: form.unitNumber.trim(), unit_number: form.unitNumber.trim(), make_model: form.makeModel ?? '',
    year: form.year || null, vin: form.vin ?? '',
    availability: form.availability === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    unavailable_reason: form.availability === 'UNAVAILABLE' ? form.unavailableReason ?? '' : '',
    unavailable_from: form.unavailableFrom || null, unavailable_until: form.unavailableUntil || null,
    type_id: form.vehicleTypeId ?? old?.type_id ?? '', plate: form.plateNumber.trim(), province: form.plateProvince || 'BC',
    payload_kg: form.payloadCapacityKg, volume_m3: form.cargoVolumeM3 ?? null,
    length_cm: form.cargoLengthCm ?? 0, width_cm: form.cargoWidthCm ?? 0, height_cm: form.cargoHeightCm ?? 0,
    pallet_capacity: form.palletCapacity, maximum_stops: form.maxStops ?? null,
    equipment: form.equipment ?? [], description: form.notes ?? '', active: form.recordStatus !== 'INACTIVE',
  };
}

import type { VehicleType } from '../types/simplePricing';
export function catalogToVehicleType(row: CatalogItem): VehicleType {
  return {
    id: row.id, name: row.data.name, description: row.data.description,
    payloadCapacityKg: Number(row.data.payload_kg ?? 0), palletCapacity: row.data.pallet_capacity,
    cargoBedFeet: row.data.length_cm == null ? undefined : Number(row.data.length_cm) / 30.48,
    cargoVolumeCbm: row.data.volume_m3 == null ? undefined : Number(row.data.volume_m3),
    cargoLengthCm: row.data.length_cm == null ? undefined : Number(row.data.length_cm),
    cargoWidthCm: row.data.width_cm == null ? undefined : Number(row.data.width_cm),
    cargoHeightCm: row.data.height_cm == null ? undefined : Number(row.data.height_cm),
    equipment: (row.data.equipment ?? []).map(item => item.charAt(0) + item.slice(1).toLowerCase()),
    baseSurcharge: Number(row.data.amount), fuelEligible: row.data.fuel_eligible,
    hasLiftgate: row.data.equipment.includes('LIFTGATE'), requiresCommercialLicense: false, active: row.active,
  };
}

/** Vehicle Types form → catalogue record; fields the form does not show are carried over. */
export function vehicleTypeToCatalog(type: VehicleType, previous?: CatalogItem): CatalogInput {
  const { cargoLengthCm: l, cargoWidthCm: w, cargoHeightCm: h } = type;
  return {
    name: type.name, description: type.description ?? previous?.data.description ?? '',
    amount: type.baseSurcharge, taxable: previous?.data.taxable ?? true,
    fuel_eligible: previous?.data.fuel_eligible ?? type.fuelEligible, exclusive_vehicle: previous?.data.exclusive_vehicle ?? false,
    payload_kg: type.payloadCapacityKg, volume_m3: l && w && h ? l * w * h / 1e6 : previous?.data.volume_m3 ?? null,
    length_cm: l ?? null, width_cm: w ?? null, height_cm: h ?? null, pallet_capacity: type.palletCapacity,
    equipment: previous?.data.equipment ?? [], required_equipment: previous?.data.required_equipment ?? [], required_crew: previous?.data.required_crew ?? 1,
  };
}
