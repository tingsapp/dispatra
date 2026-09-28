import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configured = false;

/** Load only the Places library when an address is searched; this does not construct a map. */
export async function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (typeof google !== 'undefined' && google.maps?.importLibrary) {
    return google.maps.importLibrary('places');
  }
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error('Google Maps key missing');
  if (!configured) {
    setOptions({ key: apiKey, language: 'en', region: 'CA' });
    configured = true;
  }
  return importLibrary('places');
}
