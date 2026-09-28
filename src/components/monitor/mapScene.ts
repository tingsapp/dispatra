// The operational map opens directly on Vancouver. Keep these coordinates in
// [longitude, latitude] order for the App controller and [latitude, longitude]
// order where the map API expects a point.
export const VANCOUVER_CENTER_LAT_LNG: [number, number] = [49.2827, -123.1207];
export const VANCOUVER_CENTER_LNG_LAT: [number, number] = [-123.1207, 49.2827];
export const TORONTO_CENTER_LNG_LAT = VANCOUVER_CENTER_LNG_LAT;
export const MONITOR_CAMERA = { center: { lat: 49.2827, lng: -123.1207 }, zoom: 11 } as const;
