import type { Job } from '../../types';
import type { Driver, Vehicle } from '../../operations/api';
import type { LocatedOrderStop } from './GoogleOrderMarkers';

export const validMapPoint = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Retain each visit and its booked sequence, including repeated addresses and intermediate stops. */
export function locatedOrderStops(job: Job): LocatedOrderStop[] {
  return (job.pricingInput?.stops ?? []).flatMap((stop, index) => validMapPoint(stop.latitude, stop.longitude)
    ? [{ id: stop.id, type: stop.type, label: stop.label ?? '', lat: stop.latitude!, lng: stop.longitude!, sequence: index + 1 }] : []);
}

export interface MapVehicle {
  id: string;
  label: string;
  driverName?: string;
  lat: number;
  lng: number;
  source: 'GPS' | 'PARKING';
  address?: string;
  unavailable: boolean;
}

type DriverLocation = { id: string; on_duty: boolean; location?: Record<string, unknown> | null };

/** Parking is explicitly an estimated start; never display old GPS or a driver's residence as live. */
export function vehicleMapLocations(vehicles: Vehicle[], drivers: Driver[], telemetry: DriverLocation[], observedAt = Date.now()): MapVehicle[] {
  return vehicles.filter(vehicle => vehicle.active).flatMap(vehicle => {
    const driver = drivers.find(row => row.vehicle_id === vehicle.id && row.active);
    const observation = telemetry.find(row => row.id === driver?.id);
    const point = observation?.location;
    const age = observedAt - Date.parse(String(point?.captured_at ?? ''));
    const gps = observation?.on_duty && point && typeof point.latitude === 'number' && typeof point.longitude === 'number'
      && validMapPoint(point.latitude, point.longitude) && age >= 0 && age <= 120_000
      && typeof point.accuracy_m === 'number' && point.accuracy_m > 0 && point.accuracy_m <= 75;
    const parking = vehicle.data.parking_address;
    if (!gps && !validMapPoint(parking?.latitude, parking?.longitude)) return [];
    return [{ id: vehicle.id, label: vehicle.data.unit_number || vehicle.number, driverName: driver?.name,
      lat: gps ? point.latitude as number : parking!.latitude!, lng: gps ? point.longitude as number : parking!.longitude!,
      source: gps ? 'GPS' as const : 'PARKING' as const, address: gps ? undefined : parking?.text,
      unavailable: vehicle.data.availability === 'UNAVAILABLE' }];
  });
}

/** Spread coincident visit glyphs in screen pixels without changing their geographic coordinates. */
export function separateStopMarkers(rows: { job: Job; stops: LocatedOrderStop[] }[]) {
  const groups = new Map<string, LocatedOrderStop[]>();
  for (const { stops } of rows) for (const stop of stops) {
    const key = `${stop.lat},${stop.lng}`;
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  for (const stops of groups.values()) if (stops.length > 1) {
    const radius = Math.max(24, stops.length * 7);
    stops.forEach((stop, index) => {
      const angle = index * Math.PI * 2 / stops.length;
      stop.offset = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }
  return rows;
}
