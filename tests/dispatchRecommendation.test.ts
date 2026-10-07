import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { operations } = await import('../src/operations/api');
const { DispatchRecommendation } = await import('../src/components/monitor/DispatchRecommendation');
afterEach(() => cleanup());

const order = { id: 'o1', version: 3, number: 'ACO-1001' };
const candidate = (id: string, name: string, reason: string) => ({ driver_id: id, driver_name: name, driver_number: `D-${id}`, vehicle_id: `v-${id}`, vehicle_name: 'Van', route_id: null,
  planned_at: '2026-10-06T16:00:00Z', first_arrival: '2026-10-06T16:00:00Z', score: 12, reason, facts: ['Starts a new route, about 12 min of driving including the trip to pickup', 'About 2.1 km from the first pickup (live GPS)'],
  metrics: { extra_minutes: 12, deadhead_km: 2.1, position: 'GPS', route_orders: 0, slack_minutes: 90, preferred: false, exact_vehicle_type: true } });
const decision = (changes: object = {}) => ({ id: 'd1', version: 1, order_id: 'o1', order_version: 3, mode: 'MANUAL', status: 'SUGGESTED', ranked_by: 'AI', summary: 'Dana is closest.',
  candidates: [candidate('a', 'Dana Driver', 'Closest on-duty driver'), candidate('b', 'Omar Other', 'Further away')], excluded: [{ driver_id: 'c', driver_name: 'Nia', driver_number: 'D-c', reason: 'Driver must be On Duty before assignment.' }],
  driver_id: null, decided_by: 'u1', error_code: null, created_at: '2026-10-06T15:00:00Z', ...changes });
const mount = (onAssigned: (message: string) => void = () => {}) => render(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }) },
  React.createElement(DispatchRecommendation, { slug: 'acme', order: order as never, onClose: () => {}, onAssigned })));

test('shows the ranked driver with facts and approves through the decision', async () => {
  const approvals: [string, string][] = [];
  Object.assign(operations, { dispatchSuggestion: async () => decision(), approveDispatch: async (_slug: string, current: { id: string }, driverId: string) => { approvals.push([current.id, driverId]); return {}; } });
  const messages: string[] = [];
  mount(message => messages.push(message));
  assert.ok(await screen.findByText('Closest on-duty driver'));
  assert.ok(screen.getByText('AI ranked'));
  assert.ok(screen.getByText('About 2.1 km from the first pickup (live GPS)'));
  assert.ok(screen.getByText('1 other driver cannot take it.'));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Approve' }));
  assert.deepEqual(approvals, [['d1', 'a']]);
  assert.deepEqual(messages, ['Assigned ACO-1001 to Dana Driver.']);
});

test('explains why no driver can take the order and labels the rules fallback', async () => {
  Object.assign(operations, { dispatchSuggestion: async () => decision({ status: 'NO_CANDIDATE', candidates: [], ranked_by: 'RULES' }) });
  mount();
  assert.ok(await screen.findByText('No driver can take this order right now.'));
  assert.ok(screen.getByText('Rules'));
  assert.ok(screen.getByText(/Driver must be On Duty before assignment\./));
  assert.equal(screen.queryByRole('button', { name: 'Approve' }), null);
});
