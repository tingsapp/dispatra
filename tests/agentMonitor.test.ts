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
const { MachineMonitor } = await import('../src/portal/admin/MachineMonitor');
const { AgentLogFeed } = await import('../src/portal/admin/AgentLogFeed');
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
  await screen.findByRole('region', { name: 'Agent activity' });
  assert.equal(screen.queryByRole('button', { name: 'Activity' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Issues & history' }), null);
  assert.ok(within(screen.getByRole('region', { name: 'Order agent' })).getByText('Validating booking facts.'));
  assert.equal(screen.getByRole('progressbar', { name: 'Order agent progress' }).getAttribute('aria-valuenow'), '45');
  assert.ok(screen.getByRole('link', { name: 'Monitor, 1 report needs attention' }));
  assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'One connected machine.');
  assert.equal(screen.queryByRole('button', { name: /Review orders|Order review queued or running/ }), null);
  assert.ok(within(screen.getByRole('heading', { level: 1 }).closest('.app-page-header') as HTMLElement).getByRole('button', { name: 'Run checks' }));
  assert.ok(within(screen.getByRole('banner', { name: 'Workspace header' })).getByRole('button', { name: 'Notifications' }));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Order agent: 1 open issue' }));
  await screen.findByRole('dialog', { name: 'Order agent log' });
  await screen.findByText('Recorded activity');
  assert.equal(within(screen.getByRole('dialog', { name: 'Order agent log' })).queryByText('Validating booking facts.'), null);
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Details: Recorded activity' }));
  await within(screen.getByRole('dialog', { name: 'Order agent log' })).findByText('Validating booking facts.');
  assert.equal(screen.queryByRole('button', { name: 'Activity' }), null);
});

test('agent card progress follows live percentages and clears for stale or failed runs', async () => {
  let progress = 45, stale = false;
  let phase: 'RUNNING' | 'FAILED' = 'RUNNING';
  api.agentMonitor = async () => ({ ...empty(), agents: [{ agent: 'ORDER', queued: 0, issue_count: 0, stale,
    run: { id: 'run-1', agent: 'ORDER', status: phase, step: 'Validating booking facts.', progress, created_at: time, heartbeat_at: time, finished_at: phase === 'FAILED' ? time : null } }, ...empty().agents.slice(1)] });
  mount(); await screen.findByRole('region', { name: 'Agent activity' });
  const card = screen.getByRole('region', { name: 'Order agent' });
  const fill = () => card.querySelector<HTMLElement>('[data-agent-card-fill]');
  assert.equal(fill()?.style.width, '45%');
  assert.ok(within(card).getByRole('button', { name: 'Order agent details' }));
  assert.ok(within(card).getByRole('progressbar', { name: 'Order agent progress' }).closest('[data-machine-agent]'));
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
  mount(); await screen.findByRole('region', { name: 'Agent activity' });
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
  api.agentLogs = async (agent, level, before, limit) => { if (limit === 5) return { items: [], next_before: null }; calls.push([agent, level, before]); return { items: [{ ...entry(before ? 'older' : 'newest'), message: before ? 'Earlier saved activity.' : 'Latest saved activity.' }], next_before: before ? null : 'newest' }; };
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
  mount(); await screen.findByRole('region', { name: 'Agent activity' }); assert.deepEqual(requests, []);
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
  let fixed = false;
  api.technicalReports = async (_status, before) => ({ items: fixed ? [] : [{ ...issue(), id: before ? 'older' : 'newest', title: before ? 'Older unresolved report' : 'Newest unresolved report' }], next_before: !fixed && !before ? 'older' : null });
  api.agentLogs = async () => ({ items: [entry('activity')], next_before: null });
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(AgentLogFeed, { accountId: 'owner', agent: 'ORDER' })));
  await screen.findByText('Older unresolved report');
  await waitFor(() => assert.equal(cache.isFetching({ queryKey: ['platform', 'agents', 'reports'] }), 0));
  fixed = true; await act(async () => { await cache.invalidateQueries({ queryKey: ['platform', 'agents', 'reports'] }); });
  await waitFor(() => assert.equal(screen.queryByText('Older unresolved report'), null));
  assert.equal(screen.queryByText('Newest unresolved report'), null);
  assert.ok(screen.getByText('Recorded activity'));
});


test('Chat agent card shows real failed-run state and exposes its recorded error without repair controls', async () => {
  api.agentMonitor = async () => ({ ...empty(), agents: [{ agent: 'CHAT', stale: false, queued: 0, issue_count: 0,
    run: { id: 'chat-run', agent: 'CHAT', status: 'FAILED', progress: 100, step: 'Run completed with errors', created_at: time, heartbeat_at: time, finished_at: time } }] });
  api.agentLogs = async (agent, _level, _before, limit) => { if (limit === 5) return { items: [], next_before: null }; assert.equal(agent, 'CHAT'); return { items: [{ ...entry('chat-error'), agent: 'CHAT', level: 'ERROR', message: 'AI answers unavailable; company search results returned.' }], next_before: null }; };
  mount(); const user = userEvent.setup({ document });
  const card = await screen.findByRole('region', { name: 'Chat agent' });
  assert.ok(within(card).getByText('Run failed'));
  await user.click(within(card).getByRole('button', { name: 'Chat agent: latest run failed' }));
  const dialog = await screen.findByRole('dialog', { name: 'Chat agent log' });
  await user.click(await within(dialog).findByRole('button', { name: 'Details: Recorded activity' }));
  await within(dialog).findByText('AI answers unavailable; company search results returned.');
  assert.equal(within(dialog).queryByRole('button', { name: 'Review repair' }), null);
});


test('machine telemetry preserves server totals and opens the combined report feed', async () => {
  api.agentMonitor = async () => ({ ...empty(), running: 2, needs_attention: 7, awaiting_approval: 3, automatic_fixes_24h: 11,
    agents: empty().agents.map(item => ({ ...item, issue_count: item.agent === 'DISPATCH' ? 4 : 0 })) });
  mount();
  const summary = await screen.findByRole('region', { name: 'Platform summary' });
  for (const value of ['2', '3', '11']) assert.ok(within(summary).getByText(value, { exact: true }));
  assert.ok(within(screen.getByRole('region', { name: 'Dispatch agent' })).getByText(/4 open issues/));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: '7 reports need attention ↗' }));
  await screen.findByRole('dialog', { name: 'Platform log' });
});

test('failed runs retain a review entry even with no unresolved reports', async () => {
  api.agentMonitor = async () => ({ ...empty(), agents: [{ agent: 'CHAT', stale: false, queued: 0, issue_count: 0,
    run: { id: 'failed-chat', agent: 'CHAT', status: 'FAILED', progress: 100, step: 'Run completed with errors', created_at: time, heartbeat_at: time, finished_at: time } }] });
  mount();
  await screen.findByRole('button', { name: 'Agent runs need review ↗' });
  assert.ok(within(screen.getByRole('region', { name: 'Chat agent' })).getByText('Run failed'));
});

test('the connected machine shows empty history and never invents order progress', async () => {
  mount();
  await screen.findByRole('group', { name: 'Connected processing pipeline' });
  assert.equal(screen.getAllByText('No recorded run yet.').length, 5);
  assert.equal(document.querySelectorAll('[data-machine-node]').length, 8);
  assert.equal(screen.queryAllByRole('progressbar').length, 0);
  assert.equal(document.querySelectorAll('[data-machine-node][data-active="true"]').length, 0);
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'View platform log ↗' }));
  await screen.findByRole('dialog', { name: 'Platform log' });
});

test('demonstration is clearly labelled, can pause and step, and never submits work', async () => {
  let mutations = 0;
  api.runTechnicalCheck = async () => { mutations++; throw new Error('Must not be called'); };
  api.runOperationalCheck = async () => { mutations++; throw new Error('Must not be called'); };
  mount(); const user = userEvent.setup({ document });
  await screen.findByRole('group', { name: 'Connected processing pipeline' });
  await user.click(screen.getByRole('button', { name: 'Demo flow' }));
  await screen.findByText('DEMONSTRATION · SAMPLE DATA');
  await user.click(screen.getByRole('button', { name: 'Pause demonstration' }));
  await user.click(screen.getByRole('button', { name: 'Next demonstration step' }));
  assert.equal(document.querySelector('[data-machine-node="ORDER"]')?.getAttribute('data-active'), 'true');
  assert.ok(screen.getByText('Order engine extracts and validates the booking.'));
  assert.equal(mutations, 0);
  await user.click(screen.getByRole('button', { name: 'Live system' }));
  assert.equal(screen.queryByText('DEMONSTRATION · SAMPLE DATA'), null);
  assert.equal(document.querySelectorAll('[data-machine-node][data-active="true"]').length, 0);
});

test('the processing stream reads saved events and recovers from a read failure', async () => {
  let fail = true;
  api.agentLogs = async (_agent, _level, _before, limit) => {
    assert.equal(limit, 5);
    if (fail) throw new ApiError(503, 'Activity temporarily unavailable.');
    return { items: [{ ...entry('stream-entry'), level: 'ERROR', message: 'Saved processing failure.' }], next_before: null };
  };
  mount();
  const stream = await screen.findByRole('region', { name: 'Processing stream' });
  const retry = await within(stream).findByRole('button', { name: 'Retry activity' });
  fail = false; await userEvent.setup({ document }).click(retry);
  await within(stream).findByText('Saved processing failure.');
  assert.ok(within(stream).getByText('ERROR'));
  assert.ok(within(stream).getByText('Order agent'));
});

function telemetry() {
  return { observed_at: new Date().toISOString(), agents: [
    { agent: 'ORDER' as const, state: 'PROCESSING' as const, detail: 'Validating saved email booking.', company_name: 'Acme', heartbeat_at: time, queued: 2 },
    { agent: 'DISPATCH' as const, state: 'WAITING' as const, detail: '3 automatic orders waiting; 1 has no eligible driver.', company_name: null, heartbeat_at: time, queued: 3 },
    { agent: 'CHAT' as const, state: 'ERROR' as const, detail: 'AI answers unavailable; company search results returned.', company_name: null, heartbeat_at: time, queued: 0 }],
    workload: { emails_waiting: 2, emails_review: 1, emails_failed: 1, orders_waiting: 5, auto_waiting: 3, manual_waiting: 2, no_driver: 1, orders_assigned: 4, orders_in_progress: 2, routes_in_progress: 1, completed_24h: 6 },
    activity: [] as import('../src/portal/api').MachineActivity[], activity_truncated: false, window_seconds: 86400 };
}

test('live machine states explain current processing, waiting, errors and real queue counts', async () => {
  const machine = telemetry();
  api.agentMonitor = async () => ({ ...empty(), machine }); mount();
  const order = await screen.findByRole('region', { name: 'Order agent' });
  await within(order).findByText('Processing');
  assert.ok(within(order).getByText('Validating saved email booking.'));
  assert.ok(within(order).getByText('Acme'));
  assert.ok(within(screen.getByRole('region', { name: 'Dispatch agent' })).getByText('3 automatic orders waiting; 1 has no eligible driver.'));
  assert.ok(within(screen.getByRole('region', { name: 'Chat agent' })).getByText('Error'));
  assert.ok(screen.getByText('2 emails waiting'));
  assert.ok(screen.getByText('5 unassigned orders'));
  assert.ok(screen.getByText('1 routes active · 6 completed / 24h'));
  assert.equal(screen.getAllByRole('banner').length, 1);
  assert.equal(document.querySelectorAll('.machine-header').length, 0);
  assert.ok(screen.getByRole('button', { name: 'Run checks' }).closest('header'));
  assert.ok(document.querySelector('.app-page-machine'));
});

test('initial history never animates; only newly observed committed handoffs carry a real reference', async () => {
  const machine = telemetry();
  const old = { id: 'EVENT:old', source: 'EVENT' as const, kind: 'order.created', from_node: 'ORDER' as const, to_node: 'data' as const, title: 'Order saved', level: 'INFO' as const, company_name: 'Acme', reference: 'DAO-4567', created_at: machine.observed_at };
  let current = { ...machine, activity: [old] };
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const tree = () => React.createElement(QueryClientProvider, { client: cache }, React.createElement(MachineMonitor, { monitor: { ...empty(), machine: current }, accountId: 'owner', updatedAt: Date.now(), onOpen: () => {} }));
  const mounted = render(tree());
  await screen.findByText('2 emails waiting');
  assert.equal(document.querySelectorAll('[data-transfer-id]').length, 0);
  const at = new Date().toISOString();
  current = { ...current, observed_at: at, activity: [{ ...old, id: 'EVENT:new', created_at: at, reference: 'DAO-8901' }, old] };
  mounted.rerender(tree());
  await waitFor(() => assert.ok(document.querySelector('[data-transfer-id="EVENT:new"]')));
  assert.equal(document.querySelector('[data-transfer-id="EVENT:old"]'), null);
  assert.ok(within(screen.getByRole('region', { name: 'Processing stream' })).getByText('· DAO-8901'));
});
