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
