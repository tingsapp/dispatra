import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configured = false;

/** Load only the Places library when an address is searched; this does not construct a map. */
export async function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (typeof google !== 'undefined' && google.maps?.importLibrary) {
    return google.maps.importLibrary('places');
  }
  const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error('Google Maps key missing');
  if (!configured) {
    setOptions({ key: apiKey, language: 'en', region: 'CA' });
    configured = true;
  }
  return importLibrary('places');
}

export interface SelectedAddress {
  latitude: number | null;
  longitude: number | null;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface ResolvedAddress { address: string; selected: SelectedAddress }

const STREET_ADDRESS_TYPES = new Set(['street_address', 'premise', 'subpremise']);
const CITY_TYPES = ['locality', 'postal_town', 'sublocality', 'administrative_area_level_2'];
const FULL_POSTAL_CODE = /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i;

/**
 * Resolve a Places prediction into a full Canadian street address (number, street, city, province, postal code),
 * or null when Google cannot supply every part. Throws only when Google lookups fail.
 */
export async function resolveCompleteAddress(prediction: google.maps.places.PlacePrediction, includeCoordinates: boolean): Promise<ResolvedAddress | null> {
  if (prediction.types?.length && !prediction.types.some(type => STREET_ADDRESS_TYPES.has(type))) return null;
  const place = prediction.toPlace();
  try {
    await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', ...(includeCoordinates ? ['location'] : [])] });
  } catch { /* Geocoding by place ID can still supply the address details. */ }
  const component = (...types: string[]) => place.addressComponents?.find(item => types.some(type => item.types.includes(type)));
  const postal = component('postal_code')?.longText ?? undefined;
  let address = place.formattedAddress || prediction.text.toString();
  let streetNumber = component('street_number')?.longText ?? undefined;
  let street = component('route')?.longText ?? undefined;
  let city = component(...CITY_TYPES)?.longText ?? undefined;
  let province = component('administrative_area_level_1')?.shortText ?? undefined;
  let postalCode = postal && FULL_POSTAL_CODE.test(postal) ? postal : undefined;
  let country = component('country')?.shortText ?? undefined;
  let latitude = includeCoordinates ? place.location?.lat() ?? null : null;
  let longitude = includeCoordinates ? place.location?.lng() ?? null : null;
  const complete = () => !!(streetNumber && street && city && province && postalCode && country?.toUpperCase() === 'CA');
  if (!complete()) {
    const { Geocoder } = await google.maps.importLibrary('geocoding') as google.maps.GeocodingLibrary;
    const result = await new Geocoder().geocode({ placeId: prediction.placeId });
    const hasFullPostal = (item: google.maps.GeocoderResult) => item.address_components.some(part => part.types.includes('postal_code') && FULL_POSTAL_CODE.test(part.long_name));
    const fallback = result.results.find(hasFullPostal) ?? result.results[0];
    if (fallback) {
      const part = (...types: string[]) => fallback.address_components.find(item => types.some(type => item.types.includes(type)));
      const fallbackPostal = part('postal_code')?.long_name;
      address = fallback.formatted_address || address;
      streetNumber ||= part('street_number')?.long_name;
      street ||= part('route')?.long_name;
      city ||= part(...CITY_TYPES)?.long_name;
      province ||= part('administrative_area_level_1')?.short_name;
      postalCode ||= fallbackPostal && FULL_POSTAL_CODE.test(fallbackPostal) ? fallbackPostal : undefined;
      country ||= part('country')?.short_name;
      if (includeCoordinates) {
        latitude ??= fallback.geometry.location.lat();
        longitude ??= fallback.geometry.location.lng();
      }
    }
  }
  if (!complete()) return null;
  return { address, selected: { latitude, longitude, city, province, postalCode, country } };
}
