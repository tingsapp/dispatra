import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) Object.defineProperty(globalThis, name, { configurable: true, value: (dom.window as unknown as Record<string, unknown>)[name] });
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { ProgressUpdates } = await import('../src/components/orders/ProgressUpdates');
afterEach(() => cleanup());
after(() => dom.window.close());

const view = (rows: unknown[]) => {
  (operations as unknown as Record<string, unknown>).progressUpdates = async () => rows;
  return render(<QueryClientProvider client={new QueryClient()}><ProgressUpdates slug="acme" orderId="o1" timeZone="UTC" /></QueryClientProvider>);
};
const base = { stop_kind: 'PICKUP', address: '1 Main St', prompt: '', reasons: [], responsibility: null, notes: '', photo_ids: [], replied_at: null, estimated_ready_at: null, resolution: '' };

test('the feed shows questions with the driver answer and stop reports with reasons, responsibility, notes and photos', async () => {
  view([
    { ...base, id: 'q1', kind: 'QUESTION', at: '2026-11-25T22:01:00Z', status: 'ANSWERED', prompt: 'Arrival deadline passed; arrival not recorded.', reasons: ['Goods not ready'], responsibility: 'SHIPPER', notes: 'Still packing', photo_ids: ['p1'], replied_at: '2026-11-25T22:20:00Z' },
    { ...base, id: 'q2', kind: 'QUESTION', at: '2026-11-25T23:00:00Z', status: 'OPEN', stop_kind: 'DROPOFF', address: '9 Oak Ave', prompt: 'Drop-off deadline passed.' },
    { ...base, id: 'r1', kind: 'REPORT', at: '2026-11-25T21:00:00Z', status: 'RESOLVED', reasons: ['Vehicle problem'], responsibility: 'CARRIER', resolution: 'Spare van sent' },
  ]);
  const [answered, waiting, report] = within(await screen.findByRole('list', { name: 'Progress updates' })).getAllByRole('listitem').filter(li => li.parentElement?.getAttribute('aria-label') === 'Progress updates');
  assert.ok(within(answered).getByText('Arrival deadline passed; arrival not recorded.'));
  assert.ok(within(answered).getByText('Answered'));
  assert.ok(within(answered).getByText('Goods not ready'));
  assert.ok(within(answered).getByText('Shipper responsible'));
  assert.ok(within(answered).getByText('“Still packing”'));
  assert.deepEqual(within(answered).getAllByRole('link').map(a => a.getAttribute('href')), ['/api/v1/companies/acme/evidence/p1']);
  assert.ok(within(waiting).getByText('Waiting for driver'));
  assert.equal(within(waiting).queryByText('Driver’s answer'), null);
  assert.ok(within(report).getByText('Stop report'));
  assert.ok(within(report).getByText('Carrier responsible'));
  assert.ok(within(report).getByText('Resolved'));
  assert.ok(within(report).getByText('Resolution: Spare van sent'));
});

test('an Order without updates says so', async () => {
  view([]);
  assert.ok(await screen.findByText(/No progress updates yet/));
});
