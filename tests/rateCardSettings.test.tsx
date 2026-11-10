import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'FileReader']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render: rawRender, screen, cleanup, waitFor } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { RateCardsPage } = await import('../src/pages/RateCardsPage');
const { createEmptyRateCard } = await import('../src/lib/pricingStorage');

test('API-loaded Settings skips imported cards on first load and after rate refresh', async () => {
  const { act } = await import('@testing-library/react');
  const { rateFromUi } = await import('../src/operations/pricingAdapters');
  const imported = createEmptyRateCard({ name: 'Imported price', pricingMethod: 'IMPORTED' });
  const native = createEmptyRateCard({ name: 'Native contract', pricingMethod: 'FIXED' });
  const rows = [imported, native].map(card => ({ id: card.id, code: card.code, version: 1, created_at: card.updatedAt,
    active: true, is_default: card.id === native.id, data: rateFromUi(card, []) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } } });
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    window.history.replaceState(null, '', '/acme/settings');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: window.location });
    client.setQueryData(['operations', 'acme', 'rates'], rows);
    client.setQueryData(['operations', 'acme', 'catalog'], []);
    client.setQueryData(['operations', 'acme', 'shippers'], []);
    client.setQueryData(['company-settings', 'acme'], { id: 'settings', version: 1, created_at: '', data: {
      company_name: 'Acme', tms_workspace: false, currency: 'CAD', time_zone: 'America/Vancouver',
      weight_unit: 'kg', dimension_unit: 'cm', distance_unit: 'km', gst_enabled: false,
      gst_percent: '0', provincial_enabled: false, provincial_percent: '0', fuel_enabled: false,
      fuel_percent: '0', maximum_active_orders: 3, quote_validity_days: 14, default_service_id: null,
    } });
    rawRender(React.createElement(QueryClientProvider, { client }, React.createElement(RateCardsPage)));
    assert.equal((screen.getByLabelText('Rate card name') as HTMLInputElement).value, native.name);
    assert.equal(screen.queryByRole('button', { name: 'Imported price' }), null);
    // The selected native card can disappear from an API refresh; never fall back to Imported.
    await act(async () => { client.setQueryData(['operations', 'acme', 'rates'], rows.filter(row => row.id === imported.id)); });
    await waitFor(() => assert.equal(screen.queryByLabelText('Rate card name'), null));
    assert.equal(screen.queryByRole('button', { name: 'Imported price' }), null);
  } finally {
    cleanup(); client.clear(); window.history.replaceState(null, '', '/');
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});
