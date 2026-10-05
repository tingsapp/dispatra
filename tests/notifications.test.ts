import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { syncInvalidations, retryDelay, syncKey, useSync } = await import('../src/portal/sync');
const { NotificationPanel, notificationAge } = await import('../src/portal/Notifications');
afterEach(() => cleanup());

const change = (entity: string, type: string, order_id: string | null = null) => ({ id: crypto.randomUUID(), type, actor_type: 'USER' as const, entity, entity_id: 'e1', entity_version: 2, order_id, route_id: null, created_at: '2026-10-05T10:00:00Z' });
const keys = (role: 'DISPATCHER' | 'SHIPPER' | 'DRIVER', changes: ReturnType<typeof change>[]) => syncInvalidations(role, 'acme', changes).map(key => JSON.stringify(key));

test('changes invalidate only the reads each role uses, once per key', () => {
  const assigned = [change('order', 'order.assigned', 'o1'), change('order', 'order.revised', 'o1'), change('notification', 'notification.created')];
  assert.deepEqual(keys('DISPATCHER', assigned), ['["operations","acme","orders"]', '["operations","acme","routes"]', '["operations","acme","monitor"]',
    '["operations","acme","analytics"]', '["tracking","acme","o1"]', '["delivery-proof","acme","o1"]', '["notifications","acme"]']);
  assert.deepEqual(keys('SHIPPER', assigned), ['["shipper-orders","acme"]', '["tracking","acme","o1"]', '["tracking-path","acme","o1"]', '["delivery-proof","acme","o1"]', '["notifications","acme"]']);
  assert.deepEqual(keys('DRIVER', [change('duty', 'duty.ended_by_dispatcher')]), ['["driver-profile","acme"]']);
  assert.deepEqual(keys('SHIPPER', [change('vehicle', 'vehicle.updated')]), []);
  assert.deepEqual(keys('DISPATCHER', [change('settings', 'settings.updated')]), ['["company-settings","acme"]', '["operations","acme","settings"]', '["operations","acme","catalog"]', '["operations","acme","rates"]']);
  assert.deepEqual(keys('DISPATCHER', [change('future', 'future.thing')]), ['["operations","acme"]']);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelay), [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
  const now = Date.parse('2026-10-05T12:00:00Z');
  assert.deepEqual(['2026-10-05T11:59:40Z', '2026-10-05T11:55:00Z', '2026-10-05T09:00:00Z'].map(at => notificationAge(at, now)), ['Just now', '5m ago', '3h ago']);
});

const row = (id: string, severity: 'INFO' | 'WARNING' | 'CRITICAL', read_at: string | null) => ({ id, version: 1, created_at: new Date().toISOString(), kind: 'order.assigned', severity,
  title: `${severity} title`, body: `Body ${id}`, order_id: 'o1', route_id: null, read_at });

test('panel lists notifications, reads one on open and disables Mark all read once nothing is unread', async () => {
  const user = userEvent.setup({ document });
  const calls: string[] = [];
  let rows = [row('n1', 'CRITICAL', null), row('n2', 'INFO', '2026-10-05T10:00:00Z')];
  Object.assign(operations, {
    notifications: async () => rows,
    readNotification: async (_slug: string, item: { id: string }) => { calls.push('read:' + item.id); rows = rows.map(r => r.id === item.id ? { ...r, read_at: 'now', version: 2 } : r); return rows[0]; },
    readAllNotifications: async () => { calls.push('read-all'); return { updated: 0 }; },
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  cache.setQueryData(syncKey('acme'), { unread: 1 });
  const opened: string[] = [];
  render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(NotificationPanel, { slug: 'acme', onOpen: item => opened.push(item.id) })));
  const unread = await screen.findByRole('button', { name: /^Unread\. Critical\. CRITICAL title/ });
  assert.ok(screen.getByRole('button', { name: /^Information\. INFO title/ }));
  assert.ok(screen.getByLabelText('1 unread'));
  await user.click(unread);
  assert.deepEqual(opened, ['n1']);
  await waitFor(() => assert.deepEqual(calls, ['read:n1']));
  await waitFor(() => assert.equal(screen.queryByLabelText('1 unread'), null));
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled, true));
  await user.click(screen.getByRole('button', { name: /^Information/ }));
  assert.deepEqual(calls, ['read:n1']);
});

test('sync loop starts at the server cursor, invalidates changed reads and stores unread', async () => {
  const cursors: (string | undefined)[] = [];
  const views = [{ cursor: '10-0', changes: [], unread: 0, reset: false, next_poll_ms: 1 },
    { cursor: '11-4', changes: [change('order', 'order.created', 'o1')], unread: 2, reset: false, next_poll_ms: 60_000 }];
  Object.assign(operations, { sync: async (_slug: string, cursor?: string) => { cursors.push(cursor); return views[Math.min(cursors.length - 1, 1)]; } });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let fetched = 0;
  await cache.prefetchQuery({ queryKey: ['operations', 'acme', 'orders'], queryFn: () => ++fetched });
  function Probe() { useSync('acme', 'DISPATCHER'); return null; }
  const view = render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(Probe)));
  await waitFor(() => assert.deepEqual(cursors, [undefined, '10-0']));
  await waitFor(() => assert.deepEqual(cache.getQueryData(syncKey('acme')), { unread: 2 }));
  assert.equal(cache.getQueryState(['operations', 'acme', 'orders'])?.isInvalidated, true);
  view.unmount();
});
