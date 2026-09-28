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
let chosen: { address: string; latitude: number | null; longitude: number | null } | null = null;

function Field({ includeCoordinates = true }: { includeCoordinates?: boolean }) {
  const [value, setValue] = useState('');
  return React.createElement(AddressAutocomplete, {
    'aria-label': 'Stop address', value, includeCoordinates,
    onChange: (address: string, selected?: { latitude: number | null; longitude: number | null }) => {
      setValue(address);
      if (selected) chosen = { address, ...selected };
    }
  });
}

afterEach(() => { cleanup(); delete (globalThis as Record<string, unknown>).google; chosen = null; });

test('address suggestions wait for meaningful input, keep one session, and save selected coordinates', async () => {
  const requests: Array<{ sessionToken: unknown; includedRegionCodes: string[]; locationBias?: unknown }> = [];
  const fields: string[][] = [];
  const place = { formattedAddress: '1420 Derwent Way, Delta, BC V3M 6M7, Canada', location: { lat: () => 49.1901, lng: () => -122.9412 }, fetchFields: async ({ fields: requested }: { fields: string[] }) => { fields.push(requested); } };
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
  assert.deepEqual(chosen, { address: place.formattedAddress, latitude: 49.1901, longitude: -122.9412 });
  assert.deepEqual(fields, [['formattedAddress', 'location']]);
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
  assert.deepEqual(fields, [['formattedAddress']]);
  assert.deepEqual(chosen, { address: place.formattedAddress, latitude: null, longitude: null });
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
  const place = { formattedAddress: '1420 Derwent Way, Delta, BC V3M 6M7, Canada', location: { lat: () => 49.1901, lng: () => -122.9412 }, fetchFields: async () => {} };
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
});
