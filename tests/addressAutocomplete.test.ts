import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useState } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { AddressAutocomplete } = await import('../src/components/ui/AddressAutocomplete');
let chosen: { address: string; latitude: number | null; longitude: number | null; city?: string; province?: string; postalCode?: string; country?: string } | null = null;

function Field({ includeCoordinates = true }: { includeCoordinates?: boolean }) {
  const [value, setValue] = useState('');
  return React.createElement(AddressAutocomplete, {
    'aria-label': 'Stop address', value, includeCoordinates,
    onChange: (address: string, selected?: { latitude: number | null; longitude: number | null; city?: string; province?: string; postalCode?: string; country?: string }) => {
      setValue(address);
      if (selected) chosen = { address, ...selected };
    }
  });
}

afterEach(() => { cleanup(); delete (globalThis as Record<string, unknown>).google; chosen = null; });

test('address suggestions wait for meaningful input, keep one session, and save selected coordinates', async () => {
  const requests: Array<{ sessionToken: unknown; includedRegionCodes: string[]; locationBias?: unknown }> = [];
  const fields: string[][] = [];
  const place = { formattedAddress: '1420 Derwent Way, Delta, BC V3M 6M7, Canada', addressComponents: [{ types: ['locality'], longText: 'Delta', shortText: 'Delta' }, { types: ['administrative_area_level_1'], longText: 'British Columbia', shortText: 'BC' }, { types: ['postal_code'], longText: 'V3M 6M7', shortText: 'V3M 6M7' }, { types: ['country'], longText: 'Canada', shortText: 'CA' }], location: { lat: () => 49.1901, lng: () => -122.9412 }, fetchFields: async ({ fields: requested }: { fields: string[] }) => { fields.push(requested); } };
  const prediction = { placeId: 'delta-address', text: { toString: () => place.formattedAddress }, toPlace: () => place };
  class Token {}
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async () => ({
    AutocompleteSessionToken: Token,
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: async (request: { sessionToken: unknown; includedRegionCodes: string[]; locationBias?: unknown }) => {
      requests.push(request);
      return { suggestions: [{ placePrediction: prediction }] };
    } },
  }) } };
  render(React.createElement(Field));
  const input = screen.getByLabelText('Stop address') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '142' } });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(requests.length, 0);
  fireEvent.change(input, { target: { value: '1420 Derwent' } });
  await waitFor(() => assert.equal(screen.getByRole('option').textContent, place.formattedAddress));
  fireEvent.change(input, { target: { value: '1420 Derwent Way' } });
  await waitFor(() => assert.equal(requests.length, 2));
  assert.equal(requests[0].sessionToken, requests[1].sessionToken);
  assert.deepEqual(requests[0].includedRegionCodes, ['ca']);
  assert.equal(requests[0].locationBias, undefined);
  fireEvent.click(screen.getByRole('button', { name: place.formattedAddress }));
  await waitFor(() => assert.equal(input.value, place.formattedAddress));
  assert.deepEqual(chosen, { address: place.formattedAddress, latitude: 49.1901, longitude: -122.9412, city: 'Delta', province: 'BC', postalCode: 'V3M 6M7', country: 'CA' });
  assert.deepEqual(fields, [['formattedAddress', 'addressComponents', 'location']]);
  assert.equal(screen.queryByRole('listbox'), null);
});

test('ordinary address fields request only the formatted address', async () => {
  const fields: string[][] = [];
  const place = { formattedAddress: '1420 Derwent Way, Delta, BC V3M 6M7, Canada', fetchFields: async ({ fields: requested }: { fields: string[] }) => { fields.push(requested); } };
  const prediction = { placeId: 'delta-address', text: { toString: () => place.formattedAddress }, toPlace: () => place };
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: prediction }] }) },
  }) } };
  render(React.createElement(Field, { includeCoordinates: false }));
  const input = screen.getByLabelText('Stop address') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '1420 Derwent Way' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: place.formattedAddress })));
  fireEvent.click(screen.getByRole('button', { name: place.formattedAddress }));
  await waitFor(() => assert.equal(input.value, place.formattedAddress));
  assert.deepEqual(fields, [['formattedAddress', 'addressComponents']]);
  assert.deepEqual(chosen, { address: place.formattedAddress, latitude: null, longitude: null, city: undefined, province: undefined, postalCode: undefined, country: undefined });
});

test('manual address entry works when Places is unavailable', async () => {
  render(React.createElement(Field));
  const input = screen.getByLabelText('Stop address') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '100 Main St, Vancouver BC' } });
  await waitFor(() => assert.match(screen.getByRole('status').textContent ?? '', /enter the address manually/i));
  assert.equal(input.value, '100 Main St, Vancouver BC');
  assert.equal(chosen, null);
});


test('selecting a delivery address keeps coordinates in order stop data', async () => {
  const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
  const { loadPricingContext, createDefaultOrderInput, priceOrder } = await import('../src/lib/orderPricing');
  const context = loadPricingContext();
  const initial = createDefaultOrderInput(context);
  let latest = initial;
  const place = { formattedAddress: '1420 Derwent Way, Delta, BC V3M 6M7, Canada', addressComponents: [{ types: ['locality'], longText: 'Delta', shortText: 'Delta' }, { types: ['administrative_area_level_1'], longText: 'British Columbia', shortText: 'BC' }, { types: ['postal_code'], longText: 'V3M 6M7', shortText: 'V3M 6M7' }, { types: ['country'], longText: 'Canada', shortText: 'CA' }], location: { lat: () => 49.1901, lng: () => -122.9412 }, fetchFields: async () => {} };
  const prediction = { placeId: 'delivery-place', text: { toString: () => place.formattedAddress }, toPlace: () => place };
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: prediction }] }) },
  }) } };
  function Form() {
    const [value, setValue] = useState(initial);
    return React.createElement(OrderPricingForm, { value, ctx: context, snapshot: priceOrder(value, context), showStopAddresses: true,
      onChange: next => { latest = next; setValue(next); } });
  }
  render(React.createElement(Form));
  fireEvent.change(screen.getAllByLabelText('Stop address')[1], { target: { value: '1420 Derwent Way' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: place.formattedAddress })));
  fireEvent.click(screen.getByRole('button', { name: place.formattedAddress }));
  await waitFor(() => assert.equal(latest.stops[1].latitude, 49.1901));
  assert.equal(latest.stops[1].longitude, -122.9412);
  assert.equal(latest.stops[1].normalizedAddress, place.formattedAddress);
  assert.equal(latest.stops[1].provinceCode, 'BC');
  assert.equal(latest.stops[1].city, 'Delta');
  fireEvent.change(screen.getAllByLabelText('Stop address')[1], { target: { value: 'Other address' } });
  assert.equal(latest.stops[1].city, undefined);
  assert.equal(latest.stops[1].latitude, null);
});

// Google components are authoritative even if the formatted line has a different layout.
test('selected Google components become the structured API address', async () => {
  const { canadianAddress } = await import('../src/operations/adapters');
  const result = canadianAddress('1420 Derwent Way, Delta, British Columbia, Canada', undefined, { city: 'Delta', province: 'BC', postalCode: 'V3M 6M7', country: 'CA', latitude: 49.1901, longitude: -122.9412 });
  assert.equal(result.city, 'Delta'); assert.equal(result.province, 'BC'); assert.equal(result.postal_code, 'V3M 6M7'); assert.equal(result.country, 'CA');
  assert.equal(result.text, '1420 Derwent Way, Delta, British Columbia V3M 6M7, Canada');
  assert.equal(result.latitude, 49.1901);
  assert.equal(canadianAddress('1420 Derwent Way, Delta, BC, V3M 6M7').postal_code, 'V3M 6M7');
  assert.throws(() => canadianAddress('Seattle', undefined, { city: 'Seattle', province: 'WA', postalCode: '98101', country: 'US', latitude: 1, longitude: 1 }), /Canada/);
});

test('driver cannot save before selected Google address details arrive', async () => {
  const { DriversPage } = await import('../src/pages/DriversPage');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { driverFromUi } = await import('../src/operations/adapters');
  const address = '600 W 12th Ave, Vancouver, BC V5Z 1M9, Canada';
  let resolveDetails!: () => void;
  const place = { formattedAddress: address, addressComponents: [
    { types: ['locality'], longText: 'Vancouver', shortText: 'Vancouver' },
    { types: ['administrative_area_level_1'], longText: 'British Columbia', shortText: 'BC' },
    { types: ['postal_code'], longText: 'V5Z 1M9', shortText: 'V5Z 1M9' },
    { types: ['country'], longText: 'Canada', shortText: 'CA' },
  ], location: { lat: () => 49.26, lng: () => -123.12 }, fetchFields: () => new Promise<void>(resolve => { resolveDetails = resolve; }) };
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: { placeId: 'driver-place', text: { toString: () => address }, toPlace: () => place } }] }) },
  }) } };
  let saved: Parameters<typeof driverFromUi>[0] | undefined;
  render(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }) }, React.createElement(DriversPage, {
    drivers: [], jobs: [], onSelectDriver: () => {}, onUpdateDriver: () => {}, onCreateDriver: driver => { saved = driver; }, onNotification: () => {},
  })));
  fireEvent.click(screen.getByRole('button', { name: 'Add Driver' }));
  fireEvent.change(screen.getByLabelText('Driver name'), { target: { value: 'New Driver' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '6045550199' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'driver@example.ca' } });
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: '600 W 12th Ave, Vancouver, BC' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: address })));
  fireEvent.click(screen.getByRole('button', { name: address }));
  assert.equal((screen.getByRole('button', { name: 'Save driver' }) as HTMLButtonElement).disabled, true);
  assert.equal(saved, undefined);
  resolveDetails();
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Save driver' }) as HTMLButtonElement).disabled, false));
  fireEvent.click(screen.getByRole('button', { name: 'Save driver' }));
  assert.ok(saved);
  const api = driverFromUi(saved, undefined, saved.addressCoordinates);
  assert.equal(api.address.postal_code, 'V5Z 1M9');
  assert.equal(api.address.city, 'Vancouver');
  assert.equal(api.address.country, 'CA');
});

test('missing Place Details postcode falls back to geocoding the selected place ID', async () => {
  const address = '600 W 12th Ave, Vancouver, BC';
  const place = { formattedAddress: address, addressComponents: [
    { types: ['locality'], longText: 'Vancouver', shortText: 'Vancouver' },
    { types: ['administrative_area_level_1'], longText: 'British Columbia', shortText: 'BC' },
    { types: ['country'], longText: 'Canada', shortText: 'CA' },
  ], location: { lat: () => 49.26, lng: () => -123.12 }, fetchFields: async () => {} };
  let geocodedPlaceId = '';
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async (name: string) => name === 'geocoding' ? ({ Geocoder: class {
    geocode = async ({ placeId }: { placeId: string }) => { geocodedPlaceId = placeId; return { results: [{ formatted_address: '600 W 12th Ave, Vancouver, BC V5Z 1M9, Canada', address_components: [
      { types: ['postal_code'], long_name: 'V5Z 1M9', short_name: 'V5Z 1M9' },
    ], geometry: { location: { lat: () => 49.26, lng: () => -123.12 } } }] }; };
  } }) : ({ AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: { placeId: 'driver-place', text: { toString: () => address }, toPlace: () => place } }] }) } }) } };
  render(React.createElement(Field));
  fireEvent.change(screen.getByLabelText('Stop address'), { target: { value: '600 W 12th Ave' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: address })));
  fireEvent.click(screen.getByRole('button', { name: address }));
  await waitFor(() => assert.equal(chosen?.postalCode, 'V5Z 1M9'));
  assert.equal(geocodedPlaceId, 'driver-place');
});

test('a failed Place Details request can still resolve the selected address by place ID', async () => {
  const address = '600 W 12th Ave, Vancouver, BC';
  const place = { fetchFields: async () => { throw new Error('Place details unavailable'); } };
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async (name: string) => name === 'geocoding' ? ({ Geocoder: class {
    geocode = async () => ({ results: [{ formatted_address: '600 W 12th Ave, Vancouver, BC V5Z 1M9, Canada', address_components: [
      { types: ['locality'], long_name: 'Vancouver', short_name: 'Vancouver' },
      { types: ['administrative_area_level_1'], long_name: 'British Columbia', short_name: 'BC' },
      { types: ['postal_code'], long_name: 'V5Z 1M9', short_name: 'V5Z 1M9' },
      { types: ['country'], long_name: 'Canada', short_name: 'CA' },
    ], geometry: { location: { lat: () => 49.26, lng: () => -123.12 } } }] });
  } }) : ({ AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: { placeId: 'driver-place', text: { toString: () => address }, toPlace: () => place } }] }) } }) } };
  render(React.createElement(Field));
  fireEvent.change(screen.getByLabelText('Stop address'), { target: { value: '600 W 12th Ave' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: address })));
  fireEvent.click(screen.getByRole('button', { name: address }));
  await waitFor(() => assert.equal(chosen?.postalCode, 'V5Z 1M9'));
  assert.equal(chosen?.country, 'CA');
  assert.equal(chosen?.latitude, 49.26);
});

test('failed Google lookups do not silently treat a clicked suggestion as a complete address', async () => {
  const address = '600 W 12th Ave, Vancouver, BC';
  const place = { fetchFields: async () => { throw new Error('Place details unavailable'); } };
  (globalThis as Record<string, unknown>).google = { maps: { importLibrary: async (name: string) => name === 'geocoding' ? ({ Geocoder: class {
    geocode = async () => { throw new Error('Geocoding unavailable'); };
  } }) : ({ AutocompleteSessionToken: class {}, AutocompleteSuggestion: { fetchAutocompleteSuggestions: async () => ({ suggestions: [{ placePrediction: { placeId: 'driver-place', text: { toString: () => address }, toPlace: () => place } }] }) } }) } };
  render(React.createElement(Field));
  fireEvent.change(screen.getByLabelText('Stop address'), { target: { value: '600 W 12th Ave' } });
  await waitFor(() => assert.ok(screen.getByRole('button', { name: address })));
  fireEvent.click(screen.getByRole('button', { name: address }));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /could not load the selected address details/i));
  assert.equal(chosen, null);
});
