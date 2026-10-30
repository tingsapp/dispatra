import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/docs/integrations', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'location', 'history', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
const { render, screen, cleanup, within, fireEvent } = await import('@testing-library/react');
const { default: Guide } = await import('../src/pages/IntegrationGuidePage');
const { default: Root } = await import('../src/Root');
const { companySlugForPath } = await import('../src/lib/pageRoutes');
const { apiResources, ORDER_EVENTS } = await import('../src/integrations/preview');
afterEach(() => { cleanup(); localStorage.clear(); });
after(() => dom.window.close());

test('public guide shows Samsara account connection and five unavailable connectors without offering connection or setup requests', () => {
  render(<Guide />);
  assert.ok(screen.getByRole('heading', { level: 1, name: 'Integrations & API' }));
  const section = within(screen.getByRole('region', { name: 'TMS connectors' }));
  assert.equal(section.getAllByRole('article').length, 6);
  for (const [name, status] of [['Rose Rocket', 'In preparation'], ['CartonCloud', 'In preparation'], ['Truckbase', 'Planned'], ['Tailwind TMS', 'Planned'], ['AscendTMS', 'Planned'], ['Samsara', 'Account connection available']]) assert.ok(within(section.getByRole('article', { name })).getByText(status));
  assert.ok(section.getByText(/not available to connect yet/));
  assert.equal(screen.queryByRole('button', { name: /Connect|Request setup/ }), null);
  const footer = within(screen.getByRole('contentinfo'));
  assert.equal(footer.getByRole('link', { name: 'Integrations & API' }).getAttribute('href'), '/docs/integrations');
  for (const link of within(screen.getByRole('navigation', { name: 'Guide sections' })).getAllByRole('link')) assert.ok(document.querySelector(link.getAttribute('href')!));
});

test('developer details reuse supported resources and events with placeholders and accurate pagination', () => {
  render(<Guide />);
  const summary = screen.getByText('Developer quick start');
  fireEvent.click(summary);
  assert.equal(summary.closest('details')?.open, true);
  const request = screen.getByLabelText('Read-only orders request');
  assert.ok(request.textContent?.includes('https://dispatra.com/api/v1/companies/YOUR_COMPANY_SLUG/orders?limit=10'));
  assert.ok(request.textContent?.includes('Authorization: Bearer YOUR_API_KEY'));
  assert.ok(screen.getByText(/Orders list returns a JSON array/));
  for (const resource of apiResources('example')) assert.ok(screen.getByText(resource.title));
  assert.ok(screen.getByText(new RegExp(ORDER_EVENTS[0].event.replaceAll('.', '\\.'))));
  assert.ok(screen.getByText(/Current order imports support Canadian addresses/));
  assert.equal(screen.queryByRole('textbox'), null);
});

test('anonymous guide route and trailing slash render outside the company portal', async () => {
  for (const path of ['/docs/integrations', '/docs/integrations/']) {
    history.replaceState(null, '', path);
    assert.equal(companySlugForPath(path), undefined);
    render(<Root />);
    await screen.findByRole('heading', { level: 1, name: 'Integrations & API' });
    assert.equal(screen.queryByRole('textbox'), null);
    cleanup();
  }
});
