import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin/monitor', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'PopStateEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
window.scrollTo = () => {}; HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, within, act, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { api, ApiError } = await import('../src/portal/api');
const { AdminPortal } = await import('../src/portal/admin/AdminPortal');
const { adminRoute, adminHref } = await import('../src/portal/admin/adminRoutes');
const { installRuntimeDiagnostics } = await import('../src/portal/runtimeDiagnostics');
const original = { ...api };
const time = new Date().toISOString();
const owner = { id: 'owner', role: 'ADMIN', login_id: 'owner', display_name: 'Owner', organization: null } as never;
const empty = () => ({ observed_at: time, agents: (['ORDER', 'DISPATCH', 'TECHNICAL'] as const).map(agent => ({ agent, run: null, stale: false, queued: 0, issue_count: 0 })), running: 0, awaiting_approval: 0, needs_attention: 0, automatic_fixes_24h: 0, errors_24h: 0, issues: [] });
const issue = () => ({ id: 'repair-1', version: 1, organization_id: 'company-1', company_name: 'Acme', agent: 'ORDER' as const, kind: 'ORDER_PROCESSING', severity: 'CRITICAL' as const, title: 'Order agent processing failed', description: 'Reprocessing requires approval.', status: 'AWAITING_APPROVAL' as const, action: 'RETRY_ORDER_AGENT' as const, automatic: false, fixed_count: 0, created_at: time, updated_at: time });
const entry = (id: string) => ({ id, run_id: 'run-1', agent: 'ORDER' as const, organization_id: 'company-1', company_name: 'Acme', level: 'INFO' as const, message: 'Validating booking facts.', created_at: time });
const incident = { id: 'incident-1', version: 1, organization_id: 'company-1', company_name: 'Acme', order_id: 'order-1', order_number: 'ACO-1234', stop_id: null,
    kind: 'ARRIVAL_RISK', title: 'Arrival commitment at risk', description: 'Saved arrival prediction requires review.', severity: 'WARNING' as const, certainty: 'PREDICTED' as const,
    status: 'OPEN' as const, evidence: [{ label: 'Driver location', value: 'Saved GPS observation', source: 'TELEMETRY', at: time }], suggestions: ['Ask the driver for an update.'],
    response_due_at: null, acknowledged_at: null, resolved_at: null, resolution: '', driver_reply: null, created_at: time, updated_at: time };
let cache: InstanceType<typeof QueryClient>;
beforeEach(() => {
  Object.assign(api, { agentMonitor: async () => empty(), agentLogs: async () => ({ items: [], next_before: null }), technicalReports: async () => ({ items: [], next_before: null }), operationalIssues: async () => ({ items: [], next_before: null }),
    platformNotifications: async () => ({ items: [], unread: 0 }), organizations: async () => [] });
});
afterEach(() => { cleanup(); cache?.clear(); Object.assign(api, original); history.replaceState(null, '', '/admin/monitor'); });
after(() => dom.window.close());
function mount(path = '/admin/monitor') {
  history.replaceState(null, '', path);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(AdminPortal, { account: owner, onLogout: () => {}, loggingOut: false, logoutError: null })));
}

test('Monitor routes show real progress and keep the notification in the workspace header', async () => {
  assert.deepEqual(adminRoute('/admin/monitor'), { page: 'monitor' }); assert.equal(adminRoute('/admin/monitor/extra'), null); assert.equal(adminHref({ page: 'monitor' }), '/admin/monitor');
  api.agentMonitor = async () => ({ ...empty(), running: 1, needs_attention: 1, agents: [{ agent: 'ORDER', stale: false, queued: 2, issue_count: 1,
    run: { id: 'run-1', agent: 'ORDER', status: 'RUNNING', step: 'Validating booking facts.', progress: 45, created_at: time, heartbeat_at: time, finished_at: null } }, ...empty().agents.slice(1)] });
  api.agentLogs = async () => ({ items: [entry('saved')], next_before: null });
  mount();
  await screen.findByRole('region', { name: 'Order flow' });
  assert.equal(screen.queryByRole('button', { name: 'Activity' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Issues & history' }), null);
  assert.equal(screen.queryByText('Validating booking facts.'), null);
  assert.equal(screen.getByRole('progressbar', { name: 'Order agent progress' }).getAttribute('aria-valuenow'), '45');
  assert.ok(screen.getByRole('link', { name: 'Monitor, 1 report needs attention' }));
  assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'Monitor');
  assert.ok(within(screen.getByRole('heading', { level: 1 }).closest('.app-page-header') as HTMLElement).getByRole('button', { name: 'Run checks' }));
  assert.ok(within(screen.getByRole('banner', { name: 'Workspace header' })).getByRole('button', { name: 'Notifications' }));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Order agent: 1 open issue' }));
  await screen.findByRole('dialog', { name: 'Order agent log' });
  await screen.findByText('Recorded activity');
  assert.equal(screen.queryByText('Validating booking facts.'), null);
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Details: Recorded activity' }));
  await screen.findByText('Validating booking facts.');
  assert.equal(screen.queryByRole('button', { name: 'Activity' }), null);
});

test('agent card progress follows live percentages and clears for stale or failed runs', async () => {
  let progress = 45, stale = false;
  let phase: 'RUNNING' | 'FAILED' = 'RUNNING';
  api.agentMonitor = async () => ({ ...empty(), agents: [{ agent: 'ORDER', queued: 0, issue_count: 0, stale,
    run: { id: 'run-1', agent: 'ORDER', status: phase, step: 'Validating booking facts.', progress, created_at: time, heartbeat_at: time, finished_at: phase === 'FAILED' ? time : null } }, ...empty().agents.slice(1)] });
  mount(); await screen.findByRole('region', { name: 'Order flow' });
  const card = screen.getByRole('region', { name: 'Order agent' });
  const fill = () => card.querySelector<HTMLElement>('[data-agent-card-fill]');
  assert.equal(fill()?.style.width, '45%');
  assert.ok(within(card).getByRole('button', { name: 'Order agent details' }));
  assert.ok(within(card).getByRole('progressbar', { name: 'Order agent progress' }).closest('[data-flow-header]'));
  progress = 75; await act(async () => { await cache.invalidateQueries({ queryKey: ['platform', 'agents'] }); });
  await waitFor(() => assert.equal(fill()?.style.width, '75%'));
  assert.equal(within(card).getByRole('progressbar', { name: 'Order agent progress' }).getAttribute('aria-valuenow'), '75');
  stale = true; await act(async () => { await cache.invalidateQueries({ queryKey: ['platform', 'agents'] }); });
  await within(card).findByText('Progress overdue');
  assert.ok(!fill()); assert.ok(!within(card).queryByRole('progressbar'));
  stale = false; phase = 'FAILED'; await act(async () => { await cache.invalidateQueries({ queryKey: ['platform', 'agents'] }); });
  await within(card).findByText('Run failed');
  assert.ok(!fill()); assert.ok(!within(card).queryByRole('progressbar'));
});

test('a requested platform check is queued, then reflected in progress', async () => {
  const user = userEvent.setup({ document }); let queued = false;
  api.agentMonitor = async () => queued ? { ...empty(), agents: [...empty().agents.slice(0, 2), { agent: 'TECHNICAL', queued: 1, stale: false, issue_count: 0,
    run: { id: 'check-1', agent: 'TECHNICAL', status: 'QUEUED', step: 'Waiting for the Technical agent', progress: 0, created_at: time, heartbeat_at: time, finished_at: null } }] } : empty();
  api.runTechnicalCheck = async key => { assert.ok(key); queued = true; return { id: 'check-1', agent: 'TECHNICAL', status: 'QUEUED', step: 'Waiting for the Technical agent', progress: 0, created_at: time, heartbeat_at: time, finished_at: null }; };
  mount(); await screen.findByRole('region', { name: 'Order flow' });
  await user.click(screen.getByRole('button', { name: 'Run checks' }));
  await screen.findByText('Platform checks requested.'); await screen.findByText('Queued');
  assert.ok((screen.getByRole('button', { name: 'Checks queued or running' }) as HTMLButtonElement).disabled);
});

test('repairs require explicit confirmation and submit only the server report version', async () => {
  const user = userEvent.setup({ document }); let approved = false; const calls: unknown[] = [];
  api.technicalReports = async () => ({ items: approved ? [] : [issue()], next_before: null });
  api.decideTechnicalReport = async (row, approve, key) => { calls.push({ id: row.id, version: row.version, approve, key: Boolean(key) }); approved = true; return { ...row, status: 'APPROVED' }; };
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' })); await screen.findByText('Order agent processing failed');
  await user.click(screen.getByRole('button', { name: /^Details:/ }));
  await user.click(screen.getByRole('button', { name: 'Review repair' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' })); assert.deepEqual(calls, []);
  await user.click(screen.getByRole('button', { name: 'Review repair' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Approve repair' }));
  await screen.findByText('No unresolved issues or recorded activity.'); assert.deepEqual(calls, [{ id: 'repair-1', version: 1, approve: true, key: true }]);
});

test('manual investigations have no approval control and stale errors remain visible', async () => {
  api.technicalReports = async () => ({ items: [{ ...issue(), action: null, status: 'NEEDS_ADMIN' }], next_before: null });
  api.decideTechnicalReport = async () => { throw new ApiError(409, 'This report changed. Reload before continuing.'); };
  mount(); await userEvent.setup({ document }).click(await screen.findByRole('button', { name: 'Order agent details' })); await screen.findByText('Needs investigation'); assert.equal(screen.queryByRole('button', { name: 'Review repair' }), null);
  const user = userEvent.setup({ document }); await user.click(screen.getByRole('button', { name: /^Details:/ })); await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dismiss report' }));
  await screen.findByText('This report changed. Reload before continuing.');
});

test('one Activity row expands and automatically loads all activity without hiding issues', async () => {
  const user = userEvent.setup({ document }); const calls: unknown[] = [];
  api.technicalReports = async () => ({ items: [issue()], next_before: null });
  api.agentLogs = async (agent, level, before) => { calls.push([agent, level, before]); return { items: [{ ...entry(before ? 'older' : 'newest'), message: before ? 'Earlier saved activity.' : 'Latest saved activity.' }], next_before: before ? null : 'newest' }; };
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  const viewport = await screen.findByRole('region', { name: 'Report entries' });
  await within(viewport).findByText('Recorded activity');
  assert.equal(within(viewport).queryByText('Latest saved activity.'), null);
  await user.click(within(viewport).getByRole('button', { name: 'Details: Recorded activity' }));
  await within(viewport).findByText('Latest saved activity.');
  assert.deepEqual(calls[0], ['ORDER', 'INFO', undefined]);
  assert.ok(within(viewport).getByRole('article', { name: 'Order agent processing failed · Acme' }));
  assert.equal(screen.queryByRole('button', { name: 'Activity' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Show history' }), null);
  assert.equal(screen.queryByRole('combobox'), null);
  await within(viewport).findByText('Earlier saved activity.');
  assert.ok(within(viewport).getByText('Latest saved activity.'));
  assert.equal(within(viewport).getAllByRole('article', { name: 'Recorded activity' }).length, 1);
  assert.equal(within(viewport).getByRole('list', { name: 'Activity entries' }).querySelectorAll('li').length, 2);
  assert.ok(within(viewport).getByRole('article', { name: 'Order agent processing failed · Acme' }));
  assert.deepEqual(calls.at(-1), ['ORDER', 'INFO', 'newest']);
  assert.equal(screen.queryByRole('button', { name: 'Load more activity' }), null);
});

test('all unresolved report pages load automatically, deduplicate and exclude closed reports', async () => {
  const user = userEvent.setup({ document }); const calls: unknown[] = [];
  api.technicalReports = async (view, before, limit, agent) => {
    calls.push([view, before, limit, agent]);
    if (!before) return { items: [issue(), { ...issue(), id: 'fixed', title: 'Fixed repair', status: 'FIXED' }], next_before: 'older' };
    return { items: [issue(), ...(['NEEDS_ADMIN', 'APPROVED', 'APPLYING', 'FAILED', 'REJECTED', 'SUPERSEDED'] as const).map((status, index) =>
      ({ ...issue(), id: status, title: status, status, created_at: new Date(Date.parse(time) - (index + 1) * 60000).toISOString() }))], next_before: null };
  };
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  await screen.findByRole('article', { name: 'FAILED · Acme' });
  const viewport = screen.getByRole('region', { name: 'Report entries' });
  assert.equal(within(viewport).getAllByRole('article').length, 5);
  assert.equal(screen.queryByText('Fixed repair'), null);
  assert.equal(screen.queryByText('REJECTED'), null); assert.equal(screen.queryByText('SUPERSEDED'), null);
  assert.equal(screen.queryByRole('button', { name: 'Show history' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Earlier reports' }), null);
  assert.deepEqual(calls, [['OPEN', undefined, 12, 'ORDER'], ['OPEN', 'older', 12, 'ORDER']]);
  assert.equal(within(viewport).getAllByRole('article')[0].getAttribute('aria-label'), 'FAILED · Acme');
});

test('compact issue log rows reveal complete details and actions for one report at a time', async () => {
  const user = userEvent.setup({ document });
  api.technicalReports = async () => ({ items: [issue(), { ...issue(), id: 'repair-2', title: 'Another saved issue', description: 'Another complete description.' }], next_before: null });
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  const first = await screen.findByRole('article', { name: 'Order agent processing failed · Acme' });
  const second = screen.getByRole('article', { name: 'Another saved issue · Acme' });
  const firstTrigger = within(first).getByRole('button', { name: /^Details:/ });
  assert.equal(firstTrigger.getAttribute('aria-expanded'), 'false');
  assert.equal(within(first).queryByRole('button', { name: 'Review repair' }), null);
  await user.click(firstTrigger);
  assert.equal(firstTrigger.getAttribute('aria-expanded'), 'true');
  assert.ok(within(first).getByRole('button', { name: 'Review repair' }));
  assert.ok(within(first).getByText('Reprocessing requires approval.'));
  await user.click(within(second).getByRole('button', { name: /^Details:/ }));
  assert.equal(firstTrigger.getAttribute('aria-expanded'), 'false');
  assert.equal(within(first).queryByRole('button', { name: 'Review repair' }), null);
  assert.ok(within(second).getByRole('button', { name: 'Review repair' }));
});

test('whole agent cards open scoped issues by click, Enter and Space and restore focus', async () => {
  const user = userEvent.setup({ document }); const requests: unknown[] = [];
  api.agentMonitor = async () => ({ ...empty(), agents: empty().agents.map(item => ({ ...item, issue_count: item.agent === 'DISPATCH' ? 2 : 0 })) });
  api.technicalReports = async (_status, _before, _limit, agent) => { requests.push(agent); return { items: [{ ...issue(), agent: 'DISPATCH', action: null, kind: 'WORKER_PROGRESS', title: 'Dispatch progress is overdue', status: 'NEEDS_ADMIN' }], next_before: null }; };
  mount(); await screen.findByRole('region', { name: 'Order flow' }); assert.deepEqual(requests, []);
  assert.equal(screen.queryByText('Dispatch progress is overdue'), null);
  const card = await screen.findByRole('button', { name: 'Dispatch agent: 2 open issues' });
  assert.equal(within(screen.getByRole('region', { name: 'Dispatch agent' })).getAllByRole('button').length, 1);
  assert.equal(card.getAttribute('aria-haspopup'), 'dialog');
  await user.click(card);
  const dialog = await screen.findByRole('dialog', { name: 'Dispatch agent log' });
  await within(dialog).findByText('Dispatch progress is overdue'); assert.deepEqual(requests, ['DISPATCH']);
  assert.ok(within(dialog).getByRole('region', { name: 'Report entries' }));
  await user.click(within(dialog).getByRole('button', { name: /^Details:/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }));
  await screen.findByRole('alertdialog'); await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('alertdialog'), null); assert.ok(screen.getByRole('dialog', { name: 'Dispatch agent log' }));
  await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(screen.queryByText('Dispatch progress is overdue'), null);
  assert.ok(document.activeElement === card);
  for (const key of ['{Enter}', ' ']) {
    await user.keyboard(key);
    await screen.findByRole('dialog', { name: 'Dispatch agent log' });
    await screen.findByText('Dispatch progress is overdue');
    await user.keyboard('{Escape}');
    assert.ok(document.activeElement === card);
  }
  assert.ok(requests.every(agent => agent === 'DISPATCH'));
});

test('technical notifications open Monitor and loading failures offer retry', async () => {
  const user = userEvent.setup({ document });
  api.platformNotifications = async () => ({ unread: 1, items: [{ id: 'note-1', version: 1, created_at: time, kind: 'technical.approval_required', severity: 'CRITICAL', title: 'Technical repair needs approval', body: 'Review it in Monitor.', read_at: null, organization_id: 'company-1', company_name: 'Acme', target: 'monitor' }] });
  api.readPlatformNotification = async row => ({ ...row, read_at: time, version: 2 });
  api.agentMonitor = async () => { throw new ApiError(503, 'Monitoring unavailable.'); };
  mount('/admin/profile'); await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  await user.click(await screen.findByRole('button', { name: /^Unread\. Critical\. Acme/ }));
  assert.equal(location.pathname, '/admin/monitor'); await screen.findByText('Monitoring unavailable.');
  assert.ok(screen.getByRole('button', { name: 'Try again' }));
});

test('web diagnostics send categories only, throttle repeats and preserve normal error handling', async () => {
  const sent: string[] = []; const target = document.createElement('div');
  const stop = installRuntimeDiagnostics(target, async kind => { sent.push(kind); return { accepted: true }; });
  target.dispatchEvent(new Event('error')); target.dispatchEvent(new Event('error')); target.dispatchEvent(new Event('unhandledrejection'));
  assert.deepEqual(sent, ['RUNTIME_ERROR', 'UNHANDLED_REJECTION']); stop(); target.dispatchEvent(new Event('error')); assert.equal(sent.length, 2);
});

test('operational log rows keep warning evidence and acknowledgement available', async () => {
  const user = userEvent.setup({ document });
  let acknowledged = false;

  api.operationalIssues = async () => ({ items: [{ ...incident, status: acknowledged ? 'ACKNOWLEDGED' as const : 'OPEN' as const }], next_before: null });
  api.acknowledgeOperationalIssue = async row => { acknowledged = true; return { ...row, status: 'ACKNOWLEDGED' as const }; };
  mount(); await user.click(await screen.findByRole('button', { name: 'Operational agent details' }));
  const viewport = await screen.findByRole('region', { name: 'Report entries' });
  await within(viewport).findByText('Warning');
  assert.ok(viewport.querySelector('.agent-report-line'));
  assert.equal(within(viewport).queryByText('Saved arrival prediction requires review.'), null);
  await user.click(within(viewport).getByRole('button', { name: 'Details: ACO-1234 · Arrival commitment at risk' }));
  await within(viewport).findByText('Saved arrival prediction requires review.');
  assert.ok(within(viewport).getByText('Prediction'));
  assert.ok(within(viewport).getByText('Saved GPS observation'));
  assert.ok(within(viewport).getByText('Ask the driver for an update.'));
  await user.click(within(viewport).getByRole('button', { name: 'Acknowledge issue' }));
  await within(viewport).findByText('Acknowledged · still open');
  assert.equal(within(viewport).queryByRole('button', { name: 'Review repair' }), null);
});


test('platform notifications combine all agents, all open operational pages and activity in one chronological feed', async () => {
  const user = userEvent.setup({ document }); const calls: unknown[] = [];
  api.platformNotifications = async () => ({ unread: 1, items: [{ id: 'note-1', version: 1, created_at: time, kind: 'technical.approval_required', severity: 'CRITICAL', title: 'Technical repair needs approval', body: 'Review it in Monitor.', read_at: null, organization_id: 'company-1', company_name: 'Acme', target: 'monitor' }] });
  api.readPlatformNotification = async row => ({ ...row, read_at: time, version: 2 });
  api.technicalReports = async (status, before, _limit, agent) => { calls.push(['technical', status, before, agent]); return { items: [issue()], next_before: null }; };
  api.operationalIssues = async (status, before) => { calls.push(['operational', status, before]); return { items: before ? [{ ...incident, id: 'acknowledged', title: 'Acknowledged open warning', status: 'ACKNOWLEDGED' }, { ...incident, id: 'resolved', title: 'Resolved warning', status: 'RESOLVED' }]
    : [incident], next_before: before ? null : incident.id }; };
  api.agentLogs = async (agent, level) => { calls.push(['activity', agent, level]); return { items: [entry('activity'), { ...entry('old-error'), level: 'ERROR', message: 'Historical error without resolution state' }], next_before: null }; };
  mount('/admin/profile'); await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  await user.click(await screen.findByRole('button', { name: /^Unread\. Critical\. Acme/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Platform log' });
  const viewport = within(dialog).getByRole('region', { name: 'Report entries' });
  await within(viewport).findByText('ACO-1234 · Acknowledged open warning');
  assert.ok(within(viewport).getByText('Order agent processing failed'));
  assert.ok(within(viewport).getByText('ACO-1234 · Arrival commitment at risk'));
  assert.ok(within(viewport).getByText('Recorded activity'));
  assert.equal(within(viewport).queryByText('Validating booking facts.'), null);
  await user.click(within(viewport).getByRole('button', { name: 'Details: Recorded activity' }));
  assert.ok(within(viewport).getByRole('list', { name: 'Activity entries' }));
  assert.ok(within(viewport).getByText('Validating booking facts.'));
  assert.equal(within(viewport).getAllByRole('article').length, 4);
  assert.equal(within(dialog).queryByText('Resolved warning'), null);
  assert.equal(within(dialog).queryByText('Historical error without resolution state'), null);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['technical', 'OPEN', undefined, undefined])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['operational', 'OPEN', incident.id])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['activity', undefined, 'INFO'])));
});

test('refresh removes fixed reports from every loaded page while retaining activity', { timeout: 15_000 }, async () => {
  const user = userEvent.setup({ document }); let fixed = false;
  process.stderr.write('refresh:start\n');
  api.technicalReports = async (_status, before) => ({ items: fixed ? [] : [{ ...issue(), id: before ? 'older' : 'newest', title: before ? 'Older unresolved report' : 'Newest unresolved report' }], next_before: !fixed && !before ? 'older' : null });
  api.agentLogs = async () => ({ items: [entry('activity')], next_before: null });
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  await screen.findByText('Older unresolved report');
  process.stderr.write('refresh:loaded\n');
  fixed = true; void cache.invalidateQueries({ queryKey: ['platform', 'agents'] });
  process.stderr.write('refresh:invalidated\n');
  await waitFor(() => assert.equal(screen.queryByText('Older unresolved report'), null));
  assert.equal(screen.queryByText('Newest unresolved report'), null);
  assert.ok(screen.getByText('Recorded activity'));
});


test('Chat agent card shows real failed-run state and exposes its recorded error without repair controls', async () => {
  api.agentMonitor = async () => ({ ...empty(), agents: [{ agent: 'CHAT', stale: false, queued: 0, issue_count: 0,
    run: { id: 'chat-run', agent: 'CHAT', status: 'FAILED', progress: 100, step: 'Run completed with errors', created_at: time, heartbeat_at: time, finished_at: time } }] });
  api.agentLogs = async agent => { assert.equal(agent, 'CHAT'); return { items: [{ ...entry('chat-error'), agent: 'CHAT', level: 'ERROR', message: 'AI answers unavailable; company search results returned.' }], next_before: null }; };
  mount(); const user = userEvent.setup({ document });
  const card = await screen.findByRole('region', { name: 'Chat agent' });
  assert.ok(within(card).getByText('Run failed'));
  await user.click(within(card).getByRole('button', { name: 'Chat agent: latest run failed' }));
  const dialog = await screen.findByRole('dialog', { name: 'Chat agent log' });
  await user.click(await within(dialog).findByRole('button', { name: 'Details: Recorded activity' }));
  await within(dialog).findByText('AI answers unavailable; company search results returned.');
  assert.equal(within(dialog).queryByRole('button', { name: 'Review repair' }), null);
});
