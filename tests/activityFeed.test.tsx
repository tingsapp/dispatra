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

test('Monitor popup contains only chat, keeps its composer mounted and never reads activity', async () => {
  let reads = 0;
  operations.activity = async () => { reads++; return page([]); };
  operations.assistant = async () => ({ message: 'Your orders are ready.', references: [], mode: 'AI', observed_at: new Date().toISOString(), limited: false });
  mount(); const user = userEvent.setup({ document });
  const input = screen.getByRole('textbox', { name: 'Message Dispatra' });
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  await user.click(input);
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
  await user.type(input, '   {Enter}');
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
  await user.clear(input);
  await user.type(input, 'Check my orders');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
  assert.ok(input.closest('.public-chat-composer'));
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  const panel = screen.getByRole('dialog', { name: 'Dispatra' });
  await screen.findByText('Your orders are ready.');
  assert.equal(within(panel).queryByText('Live activity'), null);
  assert.equal(within(panel).queryByRole('group', { name: 'Suggested questions' }), null);
  await user.type(input, 'Next question');
  await user.click(screen.getByRole('button', { name: 'Close Dispatra' }));
  await user.click(input);
  assert.equal(screen.getByRole('textbox', { name: 'Message Dispatra' }), input);
  assert.equal((input as HTMLTextAreaElement).value, 'Next question');
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
  await user.keyboard('{Enter}');
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
  await waitFor(() => assert.equal(screen.getAllByText('Your orders are ready.').length, 2));
  assert.equal(reads, 0);
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

test('console rows retain recorded time, actor, severity and order context without inventing agent work', async () => {
  const driver: CompanyActivityEntry = { ...entry('EVENT:driver', 'Arrival recorded'), source: 'EVENT', actor: 'DRIVER', agent: null, kind: 'stop.arrived', order_number: '#1042' };
  const warning: CompanyActivityEntry = { ...entry('AGENT:warning', 'Assignment needs review'), agent: 'DISPATCH', level: 'WARNING' };
  const error: CompanyActivityEntry = { ...entry('AGENT:error', 'Email processing failed'), level: 'ERROR' };
  render(<ActivityLog entries={[error, warning, driver]} active reducedMotion timeZone="America/Vancouver" />);
  const rows = screen.getAllByRole('listitem');
  assert.equal(rows[0].querySelector('time')?.getAttribute('dateTime'), driver.created_at);
  assert.ok(rows[0].querySelector('time')?.textContent?.startsWith('02:00:00'));
  assert.ok(within(rows[0]).getByText('[Driver]'));
  assert.ok(within(rows[0]).getByText('#1042'));
  assert.ok(within(rows[0]).getByText('INFO'));
  assert.ok(within(rows[1]).getByText('[Dispatch agent]'));
  assert.ok(within(rows[1]).getByText('WARNING').className.includes('text-amber-700'));
  assert.ok(within(rows[2]).getByText('ERROR').className.includes('text-rose-700'));
  assert.ok(rows.every(row => row.className.includes('font-mono')));
  assert.equal(screen.queryByText(/Working|Processing|Thinking/), null);
});

test('the console shows the latest six saved entries and does not replay unchanged records', async () => {
  const entries = Array.from({ length: 8 }, (_, index) => entry(`AGENT:${8 - index}`, `Saved step ${8 - index}`));
  const view = render(<ActivityLog entries={entries} active reducedMotion />);
  const identities = () => screen.getAllByRole('listitem').map(row => row.getAttribute('data-activity-entry'));
  assert.deepEqual(identities(), ['AGENT:3', 'AGENT:4', 'AGENT:5', 'AGENT:6', 'AGENT:7', 'AGENT:8']);
  view.rerender(<ActivityLog entries={[...entries]} active reducedMotion />);
  assert.deepEqual(identities(), ['AGENT:3', 'AGENT:4', 'AGENT:5', 'AGENT:6', 'AGENT:7', 'AGENT:8']);
  view.rerender(<ActivityLog entries={[entry('AGENT:9', 'New saved step'), ...entries]} active reducedMotion />);
  await screen.findByText('New saved step');
  assert.deepEqual(identities(), ['AGENT:4', 'AGENT:5', 'AGENT:6', 'AGENT:7', 'AGENT:8', 'AGENT:9']);
});

test('failed questions retain the draft, retry the same payload without duplicate user messages and prevent double send', async () => {
  const payloads: unknown[] = []; let fail = true;
  operations.assistant = async (_slug, body) => { payloads.push(body); if (fail) throw new Error('Temporarily unavailable'); return { message: 'Recovered answer.', references: [], mode: 'AI', observed_at: new Date().toISOString(), limited: false }; };
  mount(); const user = userEvent.setup({ document });
  const input = screen.getByRole('textbox', { name: 'Message Dispatra' });
  await user.type(input, 'Where is my order?{Enter}');
  await screen.findByText('Temporarily unavailable');
  assert.equal((input as HTMLTextAreaElement).value, 'Where is my order?');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Recovered answer.');
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(screen.getAllByText('Where is my order?').length, 1);
});
