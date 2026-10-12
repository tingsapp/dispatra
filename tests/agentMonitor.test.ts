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
let cache: InstanceType<typeof QueryClient>;
beforeEach(() => {
  Object.assign(api, { agentMonitor: async () => empty(), agentLogs: async () => ({ items: [], next_before: null }), technicalReports: async () => ({ items: [], next_before: null }),
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
  await screen.findByRole('dialog', { name: 'Order agent issues' });
  assert.ok(screen.getByText('Validating booking facts.').closest('[hidden]'));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Activity' }));
  await screen.findByText('Validating booking facts.');
  await screen.findByText('No open technical reports.');
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
  await screen.findByText('No open technical reports.'); assert.deepEqual(calls, [{ id: 'repair-1', version: 1, approve: true, key: true }]);
});

test('manual investigations have no approval control and stale errors remain visible', async () => {
  api.technicalReports = async () => ({ items: [{ ...issue(), action: null, status: 'NEEDS_ADMIN' }], next_before: null });
  api.decideTechnicalReport = async () => { throw new ApiError(409, 'This report changed. Reload before continuing.'); };
  mount(); await userEvent.setup({ document }).click(await screen.findByRole('button', { name: 'Order agent details' })); await screen.findByText('Needs investigation'); assert.equal(screen.queryByRole('button', { name: 'Review repair' }), null);
  const user = userEvent.setup({ document }); await user.click(screen.getByRole('button', { name: /^Details:/ })); await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dismiss report' }));
  await screen.findByText('This report changed. Reload before continuing.');
});

test('activity expands on demand, keeps issues visible and preserves scoped paged logs', async () => {
  const user = userEvent.setup({ document }); const calls: unknown[] = [];
  api.technicalReports = async () => ({ items: [issue()], next_before: null });
  api.agentLogs = async (agent, level, before) => { calls.push([agent, level, before]); return { items: [{ ...entry(before ? 'older' : 'newest'), message: before ? 'Earlier saved activity.' : 'Latest saved activity.' }], next_before: before ? null : 'newest' }; };
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  await screen.findByRole('article', { name: 'Order agent processing failed · Acme' });
  const trigger = screen.getByRole('button', { name: 'Activity' });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false'); assert.deepEqual(calls, []);
  assert.equal(screen.queryByRole('combobox'), null); assert.equal(screen.queryByRole('region', { name: 'Log entries' }), null);
  await user.click(trigger); await screen.findByText('Latest saved activity.');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true'); assert.deepEqual(calls[0], ['ORDER', undefined, undefined]);
  assert.ok(screen.getByRole('article', { name: 'Order agent processing failed · Acme' }));
  assert.equal(screen.queryByRole('combobox'), null);
  await user.click(screen.getByRole('button', { name: 'Earlier logs' })); await screen.findByText('Earlier saved activity.');
  assert.equal(screen.queryByText('Latest saved activity.'), null);
  assert.equal(screen.queryByRole('button', { name: 'Pause live logs' }), null);
  await user.click(screen.getByRole('button', { name: 'Newer logs' })); await screen.findByText('Latest saved activity.');
  await user.click(screen.getByRole('button', { name: 'Pause live logs' }));
  assert.equal(screen.getByRole('button', { name: 'Resume live logs' }).getAttribute('aria-pressed'), 'true');
  const count = calls.length; await user.click(trigger);
  assert.equal(screen.queryByRole('region', { name: 'Log entries' }), null);
  assert.ok(screen.getByRole('article', { name: 'Order agent processing failed · Acme' }));
  await user.click(trigger); assert.equal(calls.length, count);
  assert.equal(screen.getByRole('button', { name: 'Resume live logs' }).getAttribute('aria-pressed'), 'true');
});

test('report cards show paged history without dropdowns and reset the cursor when returning to open issues', async () => {
  const user = userEvent.setup({ document }); const calls: unknown[] = [];
  api.technicalReports = async (view, before, limit, agent) => {
    calls.push([view, before, limit, agent]);
    return { items: view === 'OPEN' ? [] : [{ ...issue(), id: before ? 'old' : 'fixed', title: before ? 'Earlier repair' : 'Saved repair', status: 'FIXED' }], next_before: view === 'ALL' && !before ? 'fixed' : null };
  };
  mount(); await user.click(await screen.findByRole('button', { name: 'Order agent details' }));
  await screen.findByText('No open technical reports.');
  assert.equal(screen.queryByRole('button', { name: 'Earlier reports' }), null);
  await user.click(screen.getByRole('button', { name: 'Show history' }));
  await screen.findByRole('article', { name: 'Saved repair · Acme' });
  assert.equal(screen.queryByRole('combobox'), null);
  await user.click(screen.getByRole('button', { name: 'Earlier reports' })); await screen.findByRole('article', { name: 'Earlier repair · Acme' });
  await user.click(screen.getByRole('button', { name: 'Show open issues' })); await screen.findByText('No open technical reports.');
  assert.deepEqual(calls.at(-1), ['OPEN', undefined, 12, 'ORDER']);
});

test('compact issue cards reveal complete details and actions for one report at a time', async () => {
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
  const dialog = await screen.findByRole('dialog', { name: 'Dispatch agent issues' });
  await within(dialog).findByText('Dispatch progress is overdue'); assert.deepEqual(requests, ['DISPATCH']);
  assert.ok(within(dialog).getByRole('region', { name: 'Report entries' }));
  await user.click(within(dialog).getByRole('button', { name: /^Details:/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }));
  await screen.findByRole('alertdialog'); await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('alertdialog'), null); assert.ok(screen.getByRole('dialog', { name: 'Dispatch agent issues' }));
  await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(screen.queryByText('Dispatch progress is overdue'), null);
  assert.ok(document.activeElement === card);
  for (const key of ['{Enter}', ' ']) {
    await user.keyboard(key);
    await screen.findByRole('dialog', { name: 'Dispatch agent issues' });
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
