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

test('Ask Dispatra starts collapsed and expands on keyboard focus without replacing the input or losing drafts', async () => {
  let reads = 0;
  operations.activity = async slug => { assert.equal(slug, 'acme'); reads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  const view = mount(); const user = userEvent.setup({ document });
  const input = screen.getByRole('textbox', { name: 'Message Dispatra' });
  assert.equal(input.getAttribute('placeholder'), 'Ask Dispatra...');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(reads, 0);
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Dispatra' }), null);
  await user.tab();
  const panel = await screen.findByRole('dialog', { name: 'Dispatra' });
  assert.ok(within(panel).getByRole('heading', { name: 'Live activity' }));
  const toggle = within(panel).getByRole('button', { name: 'Show chat' });
  assert.equal(toggle.querySelectorAll('circle').length, 2);
  assert.equal(toggle.querySelector('svg')?.getAttribute('width'), '16');
  assert.deepEqual(Array.from(toggle.querySelectorAll('g')).map(group => group.getAttribute('stroke')), ['#1447e6', '#0d0d0d']);
  await within(panel).findByText('Reading the order queue.');
  const activityList = screen.getByRole('list', { name: 'Recent order and agent activity' });
  assert.equal(reads, 1);
  assert.equal(document.activeElement, input);
  assert.equal(within(panel).getByRole('textbox', { name: 'Message Dispatra' }), input);
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  await user.type(input, 'Find my order');
  await user.click(screen.getByRole('button', { name: 'Show chat' }));
  assert.ok(within(panel).getByRole('heading', { name: 'Dispatra' }));
  assert.deepEqual(Array.from(within(panel).getByRole('button', { name: 'Show live activity' }).querySelectorAll('g')).map(group => group.getAttribute('stroke')), ['#0d0d0d', '#1447e6']);
  assert.equal(screen.queryByRole('list', { name: 'Recent order and agent activity' }), null);
  assert.equal((input as HTMLTextAreaElement).value, 'Find my order');
  await user.click(screen.getByRole('button', { name: 'Show live activity' }));
  assert.ok(within(panel).getByRole('heading', { name: 'Live activity' }));
  assert.ok(screen.getByRole('list', { name: 'Recent order and agent activity' }));
  assert.equal(screen.getByRole('list', { name: 'Recent order and agent activity' }), activityList, 'switching views retains the feed rather than clearing and replaying it');
  assert.equal(within(panel).queryByRole('button', { name: 'View history' }), null);
  assert.equal(panel.querySelector('[class*="border-t"]'), null);
  await user.click(document.body);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
  await user.keyboard('{Escape}');
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
  await user.click(screen.getByRole('button', { name: 'Close Dispatra' }));
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null));
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal((input as HTMLTextAreaElement).value, 'Find my order');
  await user.click(input);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
  assert.equal(document.activeElement, input);
  await user.click(screen.getByRole('button', { name: /^Notifications/ }));
  await screen.findByRole('dialog', { name: 'Notifications' });
  await user.click(document.body);
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Notifications' }), null));
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
  await user.click(screen.getByRole('button', { name: 'Close Dispatra' }));
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null));
  assert.equal(screen.getByRole('textbox', { name: 'Message Dispatra' }), input);
  view.rerender(<QueryClientProvider client={cache}><Actions active /></QueryClientProvider>);
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null, 'refreshing the page data must not reopen dismissed Activity');
  await user.click(input);
  assert.ok(screen.getByRole('dialog', { name: 'Dispatra' }));
});

test('activity streams without pause, play or history controls', async () => {
  let reads = 0;
  operations.activity = async () => { reads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  mount(); const user = userEvent.setup({ document });
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
  const panel = await screen.findByRole('dialog', { name: 'Dispatra' });
  await within(panel).findByText('Reading the order queue.');
  assert.equal(within(panel).queryByRole('button', { name: /Pause|Resume|View history/ }), null);
  assert.deepEqual(within(panel).getAllByRole('button').map(button => button.getAttribute('aria-label')), ['Show chat', 'Close Dispatra', 'Send message']);
  const count = reads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.ok(reads > count);
  assert.ok(screen.getByRole('heading', { name: 'Live activity' }));
});

test('view layers switch access immediately and preserve both panes through rapid toggles', async () => {
  reduced = true;
  mount(); const user = userEvent.setup({ document });
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
  await screen.findByText('Reading the order queue.');
  const conversation = screen.getByRole('log', { name: 'Dispatra conversation', hidden: true });
  const chatPane = conversation.closest('.assistant-view-layer')!;
  const activityList = screen.getByRole('list', { name: 'Recent order and agent activity' });
  const activityPane = activityList.closest('.assistant-view-layer')!;
  assert.equal(chatPane.getAttribute('aria-hidden'), 'true');
  assert.ok(chatPane.hasAttribute('inert'));
  assert.equal(activityPane.getAttribute('data-active'), 'true');
  for (let index = 0; index < 3; index++) {
    await user.click(screen.getByRole('button', { name: 'Show chat' }));
    assert.equal(screen.getByRole('log', { name: 'Dispatra conversation' }), conversation);
    assert.equal(chatPane.getAttribute('data-active'), 'true');
    assert.equal(chatPane.hasAttribute('inert'), false);
    assert.ok(activityPane.hasAttribute('inert'));
    assert.equal(screen.getAllByRole('heading').length, 1);
    await user.click(screen.getByRole('button', { name: 'Show live activity' }));
    assert.equal(screen.getByRole('list', { name: 'Recent order and agent activity' }), activityList);
    assert.equal(activityPane.hasAttribute('inert'), false);
    assert.ok(chatPane.hasAttribute('inert'));
  }
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

test('activity refresh indication follows the actual read rather than implying a running agent', async () => {
  mount(); const user = userEvent.setup({ document });
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
  await screen.findByText('Watching for new activity');
  let finish: () => void = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  operations.activity = async () => { await pending; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  await act(async () => { void cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  await screen.findByText('Refreshing activity…');
  await act(async () => { finish(); });
  await screen.findByText('Watching for new activity');
  assert.equal(screen.queryByText('Refreshing activity…'), null);
});

test('hidden or inactive maps do not refresh and failed refresh keeps saved rows explicit', async () => {
  let fail = false, reads = 0;
  operations.activity = async () => { reads++; if (fail) throw new Error('Activity refresh unavailable.'); return page([entry('AGENT:1', 'Reading the order queue.')]); };
  mount(); const user = userEvent.setup({ document });
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
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
  const inactiveInput = screen.getByRole('textbox', { name: 'Message Dispatra' });
  assert.equal((inactiveInput as HTMLTextAreaElement).disabled, true);
  await user.click(inactiveInput);
  assert.equal(screen.queryByRole('dialog', { name: 'Dispatra' }), null);
});


test('chat and activity can switch during a reply, resume activity refresh and retain conversation through close/reopen', async () => {
  let activityReads = 0;
  operations.activity = async () => { activityReads++; return page([entry('AGENT:1', 'Reading the order queue.')]); };
  let payload: unknown;
  let finishThinking: () => void = () => {};
  const thinking = new Promise<void>(resolve => { finishThinking = resolve; });
  operations.assistant = async (_slug, body) => { payload = body; await thinking; return { message: 'Found the requested order.', references: [{ key: 'ORDER:1', kind: 'ORDER', id: '1', label: '#100', detail: 'NEW', order_number: '#100', driver_id: null }], mode: 'AI', observed_at: new Date().toISOString(), limited: false }; };
  mount(); const user = userEvent.setup({ document });
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
  await screen.findByText('Reading the order queue.');
  const input = screen.getByRole('textbox', { name: 'Message Dispatra' });
  await user.type(input, 'Find order 100');
  assert.ok(screen.getByRole('list', { name: 'Recent order and agent activity' }), 'typing a draft retains the initial activity feed');
  assert.equal(screen.queryByRole('log', { name: 'Dispatra conversation' }), null);
  await user.keyboard('{Enter}');
  assert.equal(screen.getByRole('status').textContent, 'Thinking...');
  const activityCount = activityReads;
  await user.click(screen.getByRole('button', { name: 'Show live activity' }));
  assert.ok(screen.getByRole('heading', { name: 'Live activity' }));
  assert.equal(screen.queryByRole('status'), null);
  await waitFor(() => assert.ok(activityReads > activityCount));
  const refreshedCount = activityReads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.ok(activityReads > refreshedCount);
  await act(async () => { finishThinking(); });
  assert.equal(screen.queryByRole('article', { name: 'Dispatra message' }), null, 'a completed reply must not override the selected activity view');
  assert.ok(screen.getByRole('list', { name: 'Recent order and agent activity' }));
  await user.click(screen.getByRole('button', { name: 'Show chat' }));
  await screen.findByText('Found the requested order.');
  assert.ok(screen.getByRole('article', { name: 'Dispatra message' }));
  assert.deepEqual(payload, { message: 'Find order 100', history: [] });
  assert.equal(screen.queryByRole('list', { name: 'Recent order and agent activity' }), null);
  assert.ok(screen.getByRole('log', { name: 'Dispatra conversation' }));
  const count = activityReads;
  await act(async () => { await cache.invalidateQueries({ queryKey: [...activityKey('acme'), 'latest'] }); });
  assert.equal(activityReads, count);
  await user.click(screen.getByRole('button', { name: 'Close Dispatra' }));
  await waitFor(() => assert.equal(screen.queryByText('Found the requested order.'), null));
  await user.click(screen.getByRole('textbox', { name: 'Message Dispatra' }));
  await screen.findByText('Found the requested order.');
  assert.equal(screen.getAllByText('Find order 100').length, 1);
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
