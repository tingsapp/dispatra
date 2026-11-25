import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { ResolveIssue } = await import('../src/components/monitor/ResolveIssue');
import type { NeedsAttentionItem } from '../src/types';
afterEach(() => cleanup());
after(() => dom.window.close());
const item = (issue?: NeedsAttentionItem['issue']): NeedsAttentionItem => ({ id: 'i1', jobNumber: 'ORD-7', statusType: 'at_risk', statusLabel: 'Failed delivery', subtitle: 'Nobody home', pickupAddress: '', badgeColor: 'amber', issue });

test('only reported issues offer Resolve', () => {
  render(<ResolveIssue item={item()} onResolve={async () => {}} />);
  assert.equal(screen.queryByRole('button', { name: 'Resolve' }), null);
});

test('Resolve needs a short note, keeps errors visible for retry and never selects the row behind it', async () => {
  const calls: string[] = []; let fail = true; let rowClicks = 0;
  const onResolve = async (_: NeedsAttentionItem, note: string) => { calls.push(note); if (fail) throw new Error('Issue changed. Reload and try again.'); };
  render(<div role="button" aria-label="Order row" onClick={() => rowClicks++}><ResolveIssue item={item({ id: 'i1', version: 2 })} onResolve={onResolve} /></div>);
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole('button', { name: 'Resolve' }));
  const save = screen.getByRole('button', { name: 'Mark resolved' });
  assert.equal((save as HTMLButtonElement).disabled, true);
  await user.type(screen.getByRole('textbox', { name: 'What was done?' }), 'Rescheduled');
  await user.click(save);
  await screen.findByText('Issue changed. Reload and try again.');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Mark resolved' }));
  await screen.findByRole('button', { name: 'Resolve' });
  assert.deepEqual(calls, ['Rescheduled', 'Rescheduled']);
  assert.equal(rowClicks, 0);
});

test('report photos show on the issue and open full size', async () => {
  const { IssuePhotos } = await import('../src/components/monitor/IssuePhotos');
  const photographed = { ...item({ id: 'i1', version: 2 }), photoIds: ['p1', 'p2'] };
  const { unmount } = render(<IssuePhotos slug="acme" item={photographed} />);
  const images = screen.getAllByRole('img');
  assert.deepEqual(images.map(image => image.getAttribute('src')), ['/api/v1/companies/acme/evidence/p1', '/api/v1/companies/acme/evidence/p2']);
  assert.equal(images[0].getAttribute('alt'), 'Report photo 1 for ORD-7');
  unmount();
  render(<IssuePhotos slug="acme" item={photographed} compact />);
  assert.ok(screen.getByText('2 report photos'));
});

test('Extra time lists each stop with its reason and lets dispatch waive or charge it', async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { operations } = await import('../src/operations/api');
  const { ExtraTimeReview } = await import('../src/components/orders/ExtraTimeReview');
  const calls: unknown[][] = [];
  Object.assign(operations, { decideExtraTime: async (...args: unknown[]) => { calls.push(args); } });
  const stop = (id: string, status: 'CHARGED' | 'EXCLUDED', reasons: string[]) => ({ stop_id: id, stop: id === 's1' ? 'Pickup 1' : 'Drop-off 1', minutes_over: 45, amount: '100.00', reasons, responsibility: status === 'EXCLUDED' ? 'CARRIER' as const : 'SHIPPER' as const, status, decided_by_dispatcher: false });
  const job = { id: 'o1', version: 4, pricing: { extraTime: { minutes_free: 30, amount: '50', stops: [stop('s1', 'CHARGED', ['Waiting for staff']), stop('s2', 'EXCLUDED', ['Vehicle problem'])] } } } as never;
  render(<QueryClientProvider client={new QueryClient()}><ExtraTimeReview slug="acme" job={job} /></QueryClientProvider>);
  assert.ok(screen.getByText('Driver: Waiting for staff · Charged'));
  assert.ok(screen.getByText('Driver: Vehicle problem · Not charged: carrier reason'));
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole('button', { name: 'Waive' }));
  await user.click(screen.getByRole('button', { name: 'Charge' }));
  assert.deepEqual(calls, [['acme', { id: 'o1', version: 4 }, 's1', false], ['acme', { id: 'o1', version: 4 }, 's2', true]]);
});
