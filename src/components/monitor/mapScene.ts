// The operational map opens directly on Vancouver. Keep these coordinates in
// [longitude, latitude] order for the App controller and [latitude, longitude]
// order where the map API expects a point.
export const VANCOUVER_CENTER_LAT_LNG: [number, number] = [49.2827, -123.1207];
export const VANCOUVER_CENTER_LNG_LAT: [number, number] = [-123.1207, 49.2827];
export const TORONTO_CENTER_LNG_LAT = VANCOUVER_CENTER_LNG_LAT;
export const MONITOR_CAMERA = { center: { lat: 49.2827, lng: -123.1207 }, zoom: 11 } as const;

const TIME_ZONE_CENTERS: Record<string, { label: string; center: [number, number] }> = {
  'America/Vancouver': { label: 'Vancouver', center: VANCOUVER_CENTER_LNG_LAT },
  'America/Edmonton': { label: 'Edmonton', center: [-113.4938, 53.5461] },
  'America/Winnipeg': { label: 'Winnipeg', center: [-97.1384, 49.8951] },
  'America/Toronto': { label: 'Toronto', center: [-79.3832, 43.6532] },
  'America/Halifax': { label: 'Halifax', center: [-63.5752, 44.6488] },
  'America/St_Johns': { label: "St. John's", center: [-52.7126, 47.5615] }
};

type CompanyAddress = { city?: string; latitude?: number | null; longitude?: number | null } | string | null | undefined;

/** Camera target for the company's home area: geocoded address first, then the company time zone's city, then Vancouver. Returns [longitude, latitude]. */
export function companyMapCenter(address: CompanyAddress, timeZone?: string | null): { label: string; center: [number, number] } {
  const fallback = TIME_ZONE_CENTERS[timeZone ?? ''] ?? TIME_ZONE_CENTERS['America/Vancouver'];
  if (address && typeof address === 'object' && Number.isFinite(address.latitude) && Number.isFinite(address.longitude)) return { label: address.city || fallback.label, center: [address.longitude!, address.latitude!] };
  return fallback;
}
