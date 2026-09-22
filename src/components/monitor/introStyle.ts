import type { StyleSpecification } from 'maplibre-gl';
import earth from './introEarth.jpg?inline';
import { SATELLITE_STYLE, VANCOUVER_CENTER_LNG_LAT } from './mapScene';

// Low-resolution startup tile from the same attributed imagery provider.
// https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0
export const INTRO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'intro-earth': { type: 'raster', tiles: [earth], tileSize: 256, minzoom: 0, maxzoom: 0 },
    'intro-destination': { type: 'geojson', data: {
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: VANCOUVER_CENTER_LNG_LAT },
    } },
    'esri-satellite': { ...SATELLITE_STYLE.sources['esri-satellite'], type: 'raster', tileSize: 128 },
  },
  layers: [
    { id: 'intro-ocean', type: 'background', paint: { 'background-color': '#102e49' } },
    { id: 'intro-earth', type: 'raster', source: 'intro-earth', paint: { 'raster-fade-duration': 0 } },
    { id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite', paint: { 'raster-fade-duration': 400 } },
    { id: 'intro-destination', type: 'circle', source: 'intro-destination', paint: {
      'circle-radius': 5, 'circle-color': '#f4f8ff', 'circle-stroke-color': '#99ceff',
      'circle-stroke-width': 8, 'circle-opacity': 0, 'circle-stroke-opacity': 0,
      'circle-opacity-transition': { duration: 700 }, 'circle-stroke-opacity-transition': { duration: 700 },
    } },
  ],
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#020610', 'horizon-color': '#759fd4', 'sky-horizon-blend': 0.08,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 4, 0.12, 6, 0],
  },
};
