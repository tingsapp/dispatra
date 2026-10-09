import type { Address } from '../../operations/api';
import { companyMapCenter } from '../monitor/mapScene';

export type MapPoint = { lat: number; lng: number };
export const addressPoint = (address?: Pick<Address, 'latitude' | 'longitude'> | null): MapPoint | null =>
  address?.latitude != null && address.longitude != null && Number.isFinite(address.latitude) && Number.isFinite(address.longitude)
    && Math.abs(address.latitude) <= 90 && Math.abs(address.longitude) <= 180 ? { lat: address.latitude, lng: address.longitude } : null;

/** Warehouse first, then a one-time device fallback. Nothing is stored or reported to the API. */
export async function resolveShipperLocation(warehouse: Address | undefined, geocode: (text: string) => Promise<MapPoint | null>, locate: () => Promise<MapPoint | null>) {
  const point = addressPoint(warehouse);
  if (point) return { point, source: 'warehouse' as const };
  if (warehouse?.text.trim()) {
    const resolved = await geocode(warehouse.text).catch(() => null);
    if (resolved) return { point: resolved, source: 'warehouse' as const };
  }
  const device = await locate().catch(() => null);
  return device ? { point: device, source: 'device' as const } : null;
}

export function initialShipperCenter(warehouse?: Address, timeZone?: string): MapPoint {
  const [lng, lat] = companyMapCenter(warehouse, timeZone).center;
  return { lat, lng };
}

export function deviceLocation(): Promise<MapPoint | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(position => resolve(addressPoint(position.coords)), () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 });
  });
}
