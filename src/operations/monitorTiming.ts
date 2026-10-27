import type { components } from '../portal/schema';
import { clockTime } from '../lib/dateTimeFormat';
import { formatDistance, type Units } from '../lib/units';

/** Display only current evidence for the driver's actual next visit. */
export function monitorTiming(estimate: components['schemas']['TrafficEstimateView'] | null | undefined,
  nextStopId: string | undefined, units: Units, timeZone?: string, current = Date.now()) {
  const unavailable = { eta: '-', distance: '-' };
  if (!estimate || !nextStopId) return unavailable;
  const age = current - Date.parse(estimate.observed_at);
  const gpsAge = current - Date.parse(estimate.captured_at);
  if (!Number.isFinite(age) || !Number.isFinite(gpsAge) || age < 0 || age > 180000 || gpsAge < 0 || gpsAge > 120000) return unavailable;
  const stop = estimate.stops.find(item => item.stop_id === nextStopId);
  if (!stop || !Number.isFinite(Date.parse(stop.eta)) || stop.traffic_added_seconds < 0 || stop.road_distance_metres < 0) return unavailable;
  const delay = Math.ceil(stop.traffic_added_seconds / 60);
  return { eta: `ETA ${clockTime(stop.eta, timeZone)}${delay ? ` · ${delay} min traffic` : ''}`,
    distance: formatDistance(stop.road_distance_metres / 1000, units) };
}
