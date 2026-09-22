import type { StyleSpecification } from 'maplibre-gl';

// Vancouver Center Coordinates
export const VANCOUVER_CENTER_LAT_LNG: [number, number] = [49.2827, -123.1207];
export const VANCOUVER_CENTER_LNG_LAT: [number, number] = [-123.1207, 49.2827];
export const TORONTO_CENTER_LNG_LAT: [number, number] = VANCOUVER_CENTER_LNG_LAT;

// OpenFreeMap's public street map uses OpenStreetMap data with no API key.
// Keep MapLibre so the existing route layers, markers and map controls are unchanged.
export const OPENFREEMAP_STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

export const MONITOR_CAMERA = { longitude: VANCOUVER_CENTER_LNG_LAT[0], latitude: VANCOUVER_CENTER_LNG_LAT[1], zoom: 11, pitch: 0, bearing: 0 };
