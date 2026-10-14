import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: dom.window.requestAnimationFrame.bind(dom.window) });
Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: dom.window.cancelAnimationFrame.bind(dom.window) });
HTMLElement.prototype.scrollIntoView = () => {};
let reduced = false;
window.matchMedia = (() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })) as never;
const { render, screen, cleanup, within, waitFor, act } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { MonitorActions } = await import('../src/components/MonitorActions');
const { ActivityLog } = await import('../src/components/activity/ActivityLog');
const { activityKey } = await import('../src/components/activity/useActivity');
const { syncKey } = await import('../src/portal/sync');
import type { CompanyActivityEntry } from '../src/operations/api';
const original = { ...operations };
let cache: InstanceType<typeof QueryClient>;
const entry = (id: string, title: string): CompanyActivityEntry => ({ id, title, source: 'AGENT', agent: 'ORDER', actor: 'AGENT', kind: 'agent.step', level: 'INFO', created_at: '2026-10-13T09:00:00Z', order_id: null, order_number: null });
const page = (items: CompanyActivityEntry[], next_before: string | null = null) => ({ items, next_before, observed_at: '2026-10-13T09:00:00Z', time_zone: 'America/Vancouver' });
beforeEach(() => { reduced = false; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); operations.activity = async () => page([entry('AGENT:1', 'Reading the order queue.')]); operations.vehicles = async () => []; operations.notifications = async () => []; });
afterEach(() => { cleanup(); cache?.clear(); Object.assign(operations, original); });
after(() => dom.window.close());
function Actions({ active }: { active: boolean }) {
  return <MonitorActions active={active} onActionNotification={() => {}} />;
}
function mount(active = true) {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  cache.setQueryData(syncKey('acme'), { unread: 0 });
  return render(<QueryClientProvider client={cache}><Actions active={active} /></QueryClientProvider>);
}

test('activity opens without focusing close, ignores outside/Escape, and toggles from its trigger', async () => {
  let reads = 0;
  operations.activity = async slug => { assert.equal(slug, 'acme'); reads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  const view = mount(); const user = userEvent.setup({ document });
  const trigger = screen.getByRole('button', { name: 'Dispatra AI' });
  const panel = await screen.findByRole('dialog', { name: 'Dispatra AI' });
  await within(panel).findByText('Reading the order queue.');
  assert.equal(reads, 1);
  assert.notEqual(document.activeElement, within(panel).getByRole('button', { name: 'Close Dispatra AI' }));
  assert.equal(within(panel).queryByRole('button', { name: 'View history' }), null);
  assert.equal(panel.querySelector('[class*="border-t"]'), null);
  await user.click(document.body);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra AI' }));
  await user.keyboard('{Escape}');
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra AI' }));
  await user.click(trigger);
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Dispatra AI' }), null));
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  await user.click(trigger);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra AI' }));
  assert.equal(document.activeElement, trigger);
  await user.click(screen.getByRole('button', { name: /^Notifications/ }));
  await screen.findByRole('dialog', { name: 'Notifications' });
  await user.click(document.body);
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Notifications' }), null));
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra AI' }));
  await user.click(screen.getByRole('button', { name: 'Close Dispatra AI' }));
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Dispatra AI' }), null));
  assert.equal(document.activeElement, trigger);
  view.rerender(<QueryClientProvider client={cache}><Actions active /></QueryClientProvider>);
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra AI' }), null, 'refreshing the page data must not reopen dismissed Activity');
  await user.click(trigger);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra AI' }));
});

test('activity streams without pause, play or history controls', async () => {
  let reads = 0;
  operations.activity = async () => { reads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  mount(); const user = userEvent.setup({ document });
  const panel = await screen.findByRole('dialog', { name: 'Dispatra AI' });
  await within(panel).findByText('Reading the order queue.');
  assert.equal(within(panel).queryByRole('button', { name: /Pause|Resume|View history/ }), null);
  assert.deepEqual(within(panel).getAllByRole('button').map(button => button.getAttribute('aria-label')), ['Close Dispatra AI', 'Send message']);
  const count = reads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.ok(reads > count);
  assert.ok(screen.getByText('Live activity'));
});

test('opening rows and new records slide upward once in chronological order; reduced motion respects visibility', async () => {
  const originalRows = [entry('AGENT:2', 'Second saved step.'), entry('AGENT:1', 'First saved step.')];
  const view = render(<ActivityLog entries={originalRows} active reducedMotion={false} />);
  await screen.findByText('First saved step.');
  assert.equal(screen.queryByText('Second saved step.'), null, 'opening rows should enter progressively');
  const next = entry('AGENT:3', 'New recorded step.');
  view.rerender(<ActivityLog entries={[next, ...originalRows]} active reducedMotion={false} />);
  await screen.findByText('New recorded step.', {}, { timeout: 4000 });
  const list = screen.getByRole('list', { name: 'Recent order and agent activity' });
  assert.deepEqual(within(list).getAllByRole('listitem').map(row => row.querySelector('p')?.textContent), ['First saved step.', 'Second saved step.', 'New recorded step.']);
  view.rerender(<ActivityLog entries={[next, ...originalRows]} active reducedMotion />);
  const last = entry('AGENT:4', 'A further recorded step.');
  view.rerender(<ActivityLog entries={[last, next, ...originalRows]} active={false} reducedMotion />);
  assert.equal(screen.queryByText('A further recorded step.'), null);
  view.rerender(<ActivityLog entries={[last, next, ...originalRows]} active reducedMotion />);
  await screen.findByText('A further recorded step.');
  assert.equal(screen.getAllByText('New recorded step.').length, 1);
});

test('reduced motion shows the latest recorded rows immediately without the opening queue', async () => {
  const entries = [entry('AGENT:2', 'Second saved step.'), entry('AGENT:1', 'First saved step.')];
  render(<ActivityLog entries={entries} active reducedMotion />);
  await screen.findByText('Second saved step.');
  assert.ok(screen.getByText('First saved step.'));
});

test('hidden or inactive maps do not refresh and failed refresh keeps saved rows explicit', async () => {
  let fail = false, reads = 0;
  operations.activity = async () => { reads++; if (fail) throw new Error('Activity refresh unavailable.'); return page([entry('AGENT:1', 'Reading the order queue.')]); };
  mount(); const user = userEvent.setup({ document });
  await screen.findByText('Reading the order queue.');
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  const count = reads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.equal(reads, count);
  fail = true;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await screen.findByRole('alert');
  assert.ok(screen.getByText('Showing the last saved activity.'));
  assert.ok(screen.getByText('Reading the order queue.'));
  cleanup(); cache.clear();
  mount(false);
  await user.click(screen.getByRole('button', { name: 'Dispatra AI' }));
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra AI' }), null);
});


test('a question replaces activity with messages, stops feed refresh and keeps conversation through close/reopen', async () => {
  let activityReads = 0;
  operations.activity = async () => { activityReads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  let payload: unknown;
  operations.assistant = async (_slug, body) => { payload = body; return { message: 'Found the requested order.', references: [{ key: 'ORDER:1', kind: 'ORDER', id: '1', label: '#100', detail: 'NEW', order_number: '#100', driver_id: null }], mode: 'AI', observed_at: new Date().toISOString(), limited: false }; };
  mount(); const user = userEvent.setup({ document });
  await screen.findByText('Reading the order queue.');
  const input = screen.getByRole('textbox', { name: 'Message Dispatra AI' });
  await user.type(input, 'Find order 100');
  assert.ok(screen.getByRole('list', { name: 'Recent order and agent activity' }), 'typing a draft retains the initial activity feed');
  assert.equal(screen.queryByRole('log', { name: 'Dispatra AI conversation' }), null);
  await user.keyboard('{Enter}');
  await screen.findByText('Found the requested order.');
  assert.deepEqual(payload, { message: 'Find order 100', history: [] });
  assert.equal(screen.queryByRole('list', { name: 'Recent order and agent activity' }), null);
  assert.ok(screen.getByRole('log', { name: 'Dispatra AI conversation' }));
  const count = activityReads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.equal(activityReads, count);
  await user.click(screen.getByRole('button', { name: 'Close Dispatra AI' }));
  await waitFor(() => assert.equal(screen.queryByText('Found the requested order.'), null));
  await user.click(screen.getByRole('button', { name: 'Dispatra AI' }));
  await screen.findByText('Found the requested order.');
  assert.equal(screen.getAllByText('Find order 100').length, 1);
});

test('failed questions retain the draft, retry the same payload without duplicate user messages and prevent double send', async () => {
  const payloads: unknown[] = []; let fail = true;
  operations.assistant = async (_slug, body) => { payloads.push(body); if (fail) throw new Error('Temporarily unavailable'); return { message: 'Recovered answer.', references: [], mode: 'AI', observed_at: new Date().toISOString(), limited: false }; };
  mount(); const user = userEvent.setup({ document });
  const input = screen.getByRole('textbox', { name: 'Message Dispatra AI' });
  await user.type(input, 'Where is my order?{Enter}');
  await screen.findByText('Temporarily unavailable');
  assert.equal((input as HTMLTextAreaElement).value, 'Where is my order?');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Recovered answer.');
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(screen.getAllByText('Where is my order?').length, 1);
});
