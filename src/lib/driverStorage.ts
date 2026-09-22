import { INITIAL_BILLING_CONFIG } from './billingStorage';
import { loadVehicles, saveVehicles } from './vehicleStorage';
import { Driver } from '../types';
export const DRIVER_STORAGE_KEY = 'dispatra_drivers_v1';
export function normalizeDriver(d: Driver): Driver {
  return { currentVehicleId: loadVehicles().find(v => v.currentDriverId === d.id)?.id ?? null, driverNumber: d.id, accountStatus: 'ACTIVE', dutyStatus: d.status === 'offline' ? 'OFF_DUTY' : 'ON_DUTY',
    workStatus: d.status === 'on_route' ? 'BUSY' : d.status === 'idle' ? 'ON_BREAK' : 'AVAILABLE',
    skills: [], serviceAreaIds: [], vehicleTypeQualifications: [], availabilitySchedule: [], locationPermissionStatus: 'UNKNOWN', ...d,
    // V1 knows two kinds of driver; legacy temporary records count as employees.
    employmentType: d.employmentType === 'CONTRACTOR' ? 'CONTRACTOR' : 'EMPLOYEE' };
}
/** Background driver number (D01, D02, …): one past the highest existing number. The API will own this later. */
export function nextDriverNumber(drivers: Driver[]): string {
  const used = drivers.flatMap(d => [d.driverNumber, d.id]).map(v => /^D(\d+)$/i.exec(v ?? '')?.[1]).filter((n): n is string => !!n).map(Number);
  return `D${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}
export function syncDriver(d: Driver): Driver {
  const status = d.accountStatus === 'INACTIVE' || d.dutyStatus === 'OFF_DUTY' ? 'offline' : d.workStatus === 'BUSY' ? 'on_route' : d.workStatus === 'ON_BREAK' ? 'idle' : 'available';
  return { ...d, status, statusLabel: d.accountStatus === 'INACTIVE' ? 'Inactive' : d.dutyStatus === 'OFF_DUTY' ? 'Off duty' : d.workStatus === 'ON_BREAK' ? 'On break' : d.workStatus === 'BUSY' ? 'Busy' : 'Available', updatedAt: new Date().toISOString() };
}
export function connectivity(timestamp?: string | null, now = Date.now()): 'Online' | 'Stale' | 'Offline' | 'Unknown' {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return 'Unknown';
  const age = now - Date.parse(timestamp);
  return age < 0 ? 'Unknown' : age <= 120000 ? 'Online' : age <= 900000 ? 'Stale' : 'Offline';
}
export function loadDrivers(fallback: Driver[]): Driver[] {
  try { const raw = localStorage.getItem(DRIVER_STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(normalizeDriver); } } catch { /* Read-only fallback; saving errors are shown by the app. */ }
  return fallback.map(normalizeDriver);
}
export function saveDrivers(drivers: Driver[]): void { localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(drivers)); }

/** Keep the driver's selected asset and fleet ownership in sync in local mode. */
export function bindDriverVehicle(driver: Driver): void {
  const fleet = loadVehicles();
  const selected = fleet.find(v => v.id === driver.currentVehicleId);
  if (selected?.currentDriverId && selected.currentDriverId !== driver.id) throw new Error('Vehicle is linked to another driver. Release it on that driver profile first.');
  const old = fleet.find(v => v.currentDriverId === driver.id && v.id !== driver.currentVehicleId);
  if (old?.availability === 'IN_USE') throw new Error('Finish the active vehicle assignment before changing this driver’s vehicle.');
  const updated = fleet.map(v => v.id === driver.currentVehicleId ? { ...v, currentDriverId: driver.id, currentDriverName: driver.name } : v.currentDriverId === driver.id ? { ...v, currentDriverId: undefined, currentDriverName: undefined } : v);
  saveVehicles(updated);
}

/** One policy resolver for driver details and both local assignment paths. */
export function driverOrderLimit(driver: Pick<Driver, 'maxActiveOrders'>, companyDefault: number): number {
  const valid = (value: number | undefined): value is number => Number.isSafeInteger(value) && value! > 0;
  return valid(driver.maxActiveOrders) ? driver.maxActiveOrders
    : valid(companyDefault) ? companyDefault : INITIAL_BILLING_CONFIG.dispatch.maxActiveOrdersPerDriver;
}
