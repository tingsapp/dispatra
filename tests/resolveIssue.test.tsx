import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup, within } = await import('@testing-library/react');
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
  // A thumbnail opens the viewer over the page; the arrows step to the next photo and Escape closes it.
  screen.getByRole('button', { name: 'View Report photo 1 for ORD-7' }).click();
  const viewer = await screen.findByRole('dialog');
  screen.getByRole('button', { name: 'Next photo' }).click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(within(viewer).getByRole('img').getAttribute('src'), '/api/v1/companies/acme/evidence/p2');
  assert.ok(within(viewer).getByText('2 / 2'));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(screen.queryByRole('dialog'), null);
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

test('Extra time waiting for review offers Charge and Waive; a company Don’t charge rule reads as such', async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { operations } = await import('../src/operations/api');
  const { ExtraTimeReview } = await import('../src/components/orders/ExtraTimeReview');
  const calls: unknown[][] = [];
  Object.assign(operations, { decideExtraTime: async (...args: unknown[]) => { calls.push(args); } });
  const stop = (id: string, status: 'REVIEW' | 'EXCLUDED', reasons: string[]) => ({ stop_id: id, stop: id, minutes_over: 45, amount: '150.00', reasons, responsibility: 'UNDECIDED' as const, status, decided_by_dispatcher: false });
  const job = { id: 'o1', version: 4, pricing: { extraTime: { minutes_free: 30, amount: '50', stops: [stop('Pickup 1', 'REVIEW', ['Traffic delay']), stop('Drop-off 1', 'EXCLUDED', ['Need handling assistance'])] } } } as never;
  render(<QueryClientProvider client={new QueryClient()}><ExtraTimeReview slug="acme" job={job} /></QueryClientProvider>);
  assert.ok(screen.getByText('Driver: Traffic delay · Needs review'));
  assert.ok(screen.getByText('Driver: Need handling assistance · Not charged: company rule'));
  const user = userEvent.setup({ document });
  const [charge] = screen.getAllByRole('button', { name: 'Charge' });
  await user.click(charge);
  await user.click(screen.getByRole('button', { name: 'Waive' }));
  assert.deepEqual(calls.map(call => [call[2], call[3]]), [['Pickup 1', true], ['Pickup 1', false]]);
});
