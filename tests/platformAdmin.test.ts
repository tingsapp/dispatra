import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','PopStateEvent','MutationObserver','getComputedStyle','localStorage','sessionStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
window.scrollTo = () => {};
const { render, screen, cleanup, waitFor, within, fireEvent } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { api, ApiError } = await import('../src/portal/api');
const { AdminPortal } = await import('../src/portal/admin/AdminPortal');
const { adminRoute, isAdminPath } = await import('../src/portal/admin/adminRoutes');
const { parsePortal, default: PortalApp } = await import('../src/portal/PortalApp');

const ACME = '11111111-1111-4111-8111-111111111111';
const owner = { id: '99999999-9999-4999-8999-999999999999', login_id: 'owner', display_name: '', role: 'ADMIN', organization: null } as never;
const company = (overrides = {}) => ({ id: ACME, slug: 'acme', name: 'Acme Dispatch', logo_url: '', active: true, version: 1, phone: '(604) 555-0100', address: '123 Main Street, Vancouver, BC', settings_version: 1, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  dispatcher_count: 1, active_dispatcher_count: 1, shipper_account_count: 2, driver_account_count: 3, active_session_count: 1, shipper_count: 5, driver_count: 7, order_count: 12, ...overrides });
const person = (overrides = {}) => ({ id: '22222222-2222-4222-8222-222222222222', login_id: 'dispatcher', display_name: 'First Desk', active: true, version: 1,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', last_login_at: null, active_session_count: 0, ...overrides });
const original = { ...api };
let cache: InstanceType<typeof QueryClient>;
let calls: string[] = [];
beforeEach(() => {
  calls = [];
  Object.assign(api, {
    agentMonitor: async () => ({ observed_at: new Date().toISOString(), agents: [], running: 0, awaiting_approval: 0, needs_attention: 0, automatic_fixes_24h: 0, errors_24h: 0, issues: [] }),
    platformNotifications: async () => ({ items: [], unread: 0 }), organizations: async () => [company()], company: async () => company(), companyAudit: async () => [], dispatchers: async () => [person()],
  });
});
afterEach(() => { cleanup(); Object.assign(api, original); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '/admin'); });

function mount(path = '/admin') {
  history.replaceState(null, '', path);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  return render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(AdminPortal, { account: owner, onLogout: () => {}, loggingOut: false, logoutError: null })));
}

test('admin URLs parse to owner pages and stay out of company slugs', () => {
  assert.deepEqual(adminRoute('/admin'), { page: 'companies' });
  assert.deepEqual(adminRoute('/platform'), { page: 'companies' });
  assert.deepEqual(adminRoute('/admin/companies/'), { page: 'companies' });
  assert.deepEqual(adminRoute(`/admin/companies/${ACME}`), { page: 'company', id: ACME });
  assert.deepEqual(adminRoute('/admin/profile'), { page: 'profile' });
  assert.equal(adminRoute('/admin/companies/not-an-id'), null);
  assert.equal(adminRoute('/admin/companies/x/y'), null);
  assert.equal(isAdminPath('/administrator'), false);
  assert.equal(parsePortal(`/admin/companies/${ACME}`)?.portal, 'platform');
  assert.equal(parsePortal('/acme/')?.portal, 'dispatch');
});

test('companies list canonicalizes the URL, opens a company and supports Back', async () => {
  const user = userEvent.setup({ document });
  mount('/admin');
  await screen.findByRole('cell', { name: 'Acme Dispatch' });
  assert.equal(location.pathname, '/admin/companies');
  assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'Companies');
  const header = screen.getByRole('banner', { name: 'Workspace header' });
  const bell = within(header).getByRole('button', { name: 'Notifications' });
  assert.ok(bell.classList.contains('app-icon-button-surface'));
  assert.equal(within(header).queryByRole('button', { name: 'Add company' }), null);
  await user.click(screen.getByRole('link', { name: 'Manage Acme Dispatch' }));
  assert.equal(location.pathname, `/admin/companies/${ACME}`);
  await user.click(await screen.findByRole('tab', { name: 'Overview' }));
  await screen.findByRole('region', { name: 'Company details' });
  await waitFor(() => assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'Acme Dispatch'));
  assert.equal(within(screen.getByRole('banner', { name: 'Workspace header' })).getByRole('button', { name: 'Notifications' }), bell);
  history.back();
  await waitFor(() => assert.equal(location.pathname, '/admin/companies'));
  await screen.findByRole('table', { name: 'Dispatch companies' });
});

test('company names show saved logos and use a fallback for missing or failed images', async () => {
  let logo = 'https://example.com/acme.png';
  api.organizations = async () => [company({ logo_url: logo }), company({ id: '33333333-3333-4333-8333-333333333333', name: 'No Logo', slug: 'no-logo' })];
  mount('/admin/companies');
  const cell = await screen.findByRole('cell', { name: 'Acme Dispatch' });
  const image = cell.querySelector('img')!;
  assert.equal(image.getAttribute('src'), logo);
  assert.equal(image.getAttribute('alt'), '');
  assert.equal(image.getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(screen.getByRole('cell', { name: 'No Logo' }).querySelector('img'), null);
  assert.ok(screen.getByRole('cell', { name: 'No Logo' }).querySelector('svg'));
  fireEvent.error(image);
  await waitFor(() => assert.equal(cell.querySelector('img'), null));
  assert.ok(cell.querySelector('svg'));
  logo = 'https://example.com/replaced.png';
  await cache.invalidateQueries({ queryKey: ['platform', 'companies'] });
  await waitFor(() => assert.equal(cell.querySelector('img')?.getAttribute('src'), logo));
});

test('empty, search and first-load error states are explicit', async () => {
  const user = userEvent.setup({ document });
  api.organizations = async (filter = {}) => { calls.push(JSON.stringify(filter)); return filter.search ? [] : []; };
  mount('/admin/companies');
  await screen.findByText('No companies yet. Add your first dispatch company.');
  await user.type(screen.getByLabelText('Search companies'), 'zz');
  await screen.findByText('No companies match these filters.');
  assert.ok(calls.some(call => call.includes('"search":"zz"')));
  cleanup();
  api.organizations = async () => { throw new ApiError(503, 'Database unavailable. Please try again.'); };
  mount('/admin/companies');
  await screen.findByText('Database unavailable. Please try again.');
  assert.ok(screen.getByRole('button', { name: 'Try again' }));
});

test('Overview combines prefilled company and dispatcher fields and preserves drafts across History', async () => {
  const user = userEvent.setup({ document });
  mount(`/admin/companies/${ACME}`);
  const name = await screen.findByLabelText('Company name') as HTMLInputElement;
  assert.equal(name.value, 'Acme Dispatch');
  assert.equal((screen.getByLabelText('Full name') as HTMLInputElement).value, 'First Desk');
  assert.equal((screen.getByLabelText('Email') as HTMLInputElement).value, 'dispatcher');
  assert.equal(screen.queryByLabelText('Company access'), null);
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Overview', 'History']);
  await user.clear(name); await user.type(name, 'Unsaved name');
  screen.getByRole('tab', { name: 'Overview' }).focus();
  await user.keyboard('{ArrowRight}');
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'History' }));
  assert.equal(screen.queryByRole('form', { name: 'Company overview' }), null);
  await screen.findByText('No administration events yet.');
  await user.keyboard('{Home}');
  assert.equal((screen.getByLabelText('Company name') as HTMLInputElement).value, 'Unsaved name');
});

test('summary cards stay above both tabs and all account records and actions are visible in Overview', async () => {
  const user = userEvent.setup({ document });
  mount(`/admin/companies/${ACME}`);
  await screen.findByLabelText('Company name');
  for (const name of ['Overview', 'History']) {
    await user.click(screen.getByRole('tab', { name }));
    const summary = screen.getByLabelText('Company totals');
    assert.deepEqual(within(summary).getAllByRole('term').map(row => row.textContent), ['Total Shippers', 'Total Drivers', 'Total Orders']);
    assert.deepEqual(within(summary).getAllByRole('definition').map(row => row.textContent), ['5', '7', '12']);
    assert.equal(summary.closest('[role="tabpanel"]'), null);
    assert.ok(summary.compareDocumentPosition(screen.getByRole('tablist', { name: 'Company administration' })) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  assert.equal(screen.queryByRole('table'), null);
  for (const label of ['Company created', 'Company updated', 'Last sign-in']) assert.ok(screen.getByText(label));
  assert.equal((screen.getByLabelText('Company identifier') as HTMLInputElement).readOnly, true);
  assert.equal(screen.queryByRole('button', { name: 'Edit dispatcher' }), null);
  for (const label of ['Workspace URL', 'Dispatcher status', 'Dispatcher created', 'Dispatcher updated']) assert.equal(screen.queryByText(label), null);
  for (const label of ['Reset password', 'Sign out sessions', 'Discard']) assert.equal(screen.queryByRole('button', { name: label }), null);
  assert.equal(screen.getAllByRole('button', { name: 'Save changes' }).length, 1);
  assert.equal(screen.getByRole('button', { name: 'Save changes' }).closest('.app-panel'), null);
  assert.ok(screen.getByLabelText('Company identifier').parentElement!.textContent!.includes('http://localhost/'));
  assert.equal((screen.getByLabelText('Company identifier') as HTMLInputElement).value, 'acme');
  assert.equal(screen.getByRole('form', { name: 'Company overview' }).closest('.app-panel'), null);
  assert.equal(screen.getByRole('tabpanel').querySelectorAll('.app-panel').length, 1);
  assert.equal(screen.getByLabelText('Company record dates').classList.contains('app-panel'), true);
});

test('one Save changes request saves company and dispatcher edits with both versions', async () => {
  const user = userEvent.setup({ document });
  let companyData = company();
  let account = person();
  let submitted: unknown;
  api.company = async () => companyData;
  api.dispatchers = async () => [account];
  api.updateCompanyOverview = async (_id, body) => {
    submitted = body; companyData = company({ name: body.name, active: body.active, version: 2 });
    account = person({ ...body.dispatcher, version: 2 }); return { company: companyData, dispatcher: account };
  };
  mount(`/admin/companies/${ACME}`);
  const name = await screen.findByLabelText('Company name');
  await user.clear(name); await user.type(name, 'Saved company');
  const dispatcher = screen.getByLabelText('Full name');
  await user.clear(dispatcher); await user.type(dispatcher, 'Saved dispatcher');
  const login = screen.getByLabelText('Email');
  await user.clear(login); await user.type(login, 'Main@Example.com');
  assert.equal((screen.getByRole('button', { name: 'Suspend' }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Changes saved.');
  assert.deepEqual(submitted, { name: 'Saved company', active: true, version: 1,
    dispatcher: { id: person().id, login_id: 'main@example.com', display_name: 'Saved dispatcher', version: 1 } });
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled, true));
  assert.equal((screen.getByLabelText('Full name') as HTMLInputElement).value, 'Saved dispatcher');
});

test('company phone/address are prefilled and saved with the shared settings version', async () => {
  const user = userEvent.setup({ document });
  let latest = company();
  let submitted: Parameters<typeof api.updateCompanyOverview>[1] | undefined;
  api.company = async () => latest;
  api.updateCompanyOverview = async (_id, body) => {
    submitted = body; latest = company({ phone: body.phone, address: body.address, settings_version: 2, version: 2 });
    return { company: latest, dispatcher: person() };
  };
  mount(`/admin/companies/${ACME}`);
  const phone = await screen.findByLabelText('Company phone') as HTMLInputElement;
  assert.equal(phone.value, '(604) 555-0100');
  assert.equal((screen.getByLabelText('Company address') as HTMLInputElement).value, '123 Main Street, Vancouver, BC');
  await user.clear(phone); await user.type(phone, '6045550199');
  await user.clear(screen.getByLabelText('Company address')); await user.type(screen.getByLabelText('Company address'), '456 Saved Street');
  await user.click(screen.getByRole('tab', { name: 'History' }));
  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  assert.equal((screen.getByLabelText('Company address') as HTMLInputElement).value, '456 Saved Street');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Changes saved.');
  assert.equal(submitted?.phone, '(604) 555-0199');
  assert.equal(submitted?.address, '456 Saved Street');
  assert.equal(submitted?.settings_version, 1);
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled, true));
});

test('Add company includes optional company phone and address in creation', async () => {
  const user = userEvent.setup({ document });
  let submitted: Parameters<typeof api.createOrganization>[0] | undefined;
  api.createOrganization = async body => { submitted = body; return company({ name: body.name, slug: body.slug }); };
  mount('/admin/companies');
  await screen.findByRole('cell', { name: 'Acme Dispatch' });
  await user.click(screen.getByRole('button', { name: 'Add company' }));
  const form = within(screen.getByRole('form', { name: 'Add company' }));
  await user.type(form.getByLabelText('Company name'), 'New company');
  await user.type(form.getByLabelText('Company identifier'), 'new-company');
  await user.type(form.getByLabelText('Company phone'), '6045550188');
  await user.type(form.getByLabelText('Company address'), '789 New Street');
  await user.type(form.getByLabelText('Administrator login ID'), 'first@example.com');
  await user.click(form.getByRole('button', { name: 'Create company' }));
  await screen.findByLabelText('Login details');
  assert.equal(submitted?.phone, '(604) 555-0188');
  assert.equal(submitted?.address, '789 New Street');
});

test('a first dispatcher password is shown once and never persisted or used as a query key', async () => {
  const user = userEvent.setup({ document });
  const secret = 'Generated-Secret-Password-42';
  let body: unknown;
  api.company = async () => company({ dispatcher_count: 0, active_dispatcher_count: 0 });
  api.dispatchers = async () => [];
  api.createDispatcher = async (_id, submitted) => { body = submitted; return { ...person({ id: '33333333-3333-4333-8333-333333333333', login_id: 'second' }), initial_password: secret }; };
  mount(`/admin/companies/${ACME}`);
  await user.click(await screen.findByRole('tab', { name: 'Overview' }));
  await user.click(await screen.findByRole('button', { name: 'Add dispatcher' }));
  const dialog = screen.getByRole('form', { name: 'Add dispatcher' });
  await user.type(within(dialog).getByLabelText('Login ID'), 'Second');
  await user.type(within(dialog).getByLabelText('Name'), 'Second Desk');
  await user.click(within(dialog).getByRole('button', { name: 'Create dispatcher' }));
  const details = await screen.findByLabelText('Login details') as HTMLTextAreaElement;
  assert.deepEqual(body, { login_id: 'second', display_name: 'Second Desk' });
  assert.match(details.value, new RegExp(`/acme/[\\s\\S]*second[\\s\\S]*${secret}`));
  const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + JSON.stringify(cache.getQueryCache().getAll().map(q => q.queryKey)) + location.href;
  assert.ok(!stored.includes(secret));
  await user.click(screen.getByRole('tab', { name: 'History' }));
  assert.equal(screen.queryByRole('textbox', { name: 'Login details' }), null);
  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  assert.equal((screen.getByLabelText('Login details') as HTMLTextAreaElement).value, details.value);
  await user.click(screen.getByRole('button', { name: 'Done' }));
  assert.equal(screen.queryByLabelText('Login details'), null);
  assert.ok(!document.body.innerHTML.includes(secret));
});

test('password changes use the single Save button without a reset popup and clear secrets after saving', async () => {
  const user = userEvent.setup({ document });
  const secret = 'Chosen-secret-Password-42';
  let companyData = company(); let account = person();
  let submitted: Parameters<typeof api.updateCompanyOverview>[1] | undefined;
  api.company = async () => companyData;
  api.dispatchers = async () => [account];
  api.updateCompanyOverview = async (_id, body) => {
    submitted = body; companyData = company({ version: 2 }); account = person({ version: 2 });
    return { company: companyData, dispatcher: account };
  };
  mount(`/admin/companies/${ACME}`);
  await screen.findByLabelText('New password');
  await user.type(screen.getByLabelText('New password'), secret);
  await user.type(screen.getByLabelText('Confirm password'), 'Different-password-42');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Passwords do not match.');
  assert.equal(submitted, undefined);
  await user.clear(screen.getByLabelText('Confirm password'));
  await user.type(screen.getByLabelText('Confirm password'), secret);
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Changes saved.');
  assert.equal(submitted?.dispatcher?.new_password, secret);
  assert.equal(screen.queryByRole('alertdialog'), null);
  assert.equal(screen.queryByLabelText('Login details'), null);
  for (const label of ['New password', 'Confirm password']) assert.equal((screen.getByLabelText(label) as HTMLInputElement).value, '');
  const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + JSON.stringify(cache.getQueryCache().getAll().map(q => ({ key: q.queryKey, data: q.state.data }))) + location.href;
  assert.ok(!stored.includes(secret));
});

test('one account detail view prefers the active dispatcher and keeps inactive accounts from occupying the screen', async () => {
  const user = userEvent.setup({ document });
  api.dispatchers = async () => [person({ id: '33333333-3333-4333-8333-333333333333', login_id: 'legacy', active: false }), person()];
  mount(`/admin/companies/${ACME}`);
  await user.click(await screen.findByRole('tab', { name: 'Overview' }));
  await screen.findByRole('region', { name: 'Company details' });
  assert.equal((screen.getByLabelText('Email') as HTMLInputElement).value, 'dispatcher');
  assert.equal((screen.getByLabelText('Email') as HTMLInputElement).value.includes('legacy'), false);
  assert.equal(screen.queryByRole('table'), null);
  assert.equal(screen.queryByRole('button', { name: 'Add dispatcher' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Activate dispatcher' }), null);
  cleanup();
  api.company = async () => company({ active_dispatcher_count: 0 });
  api.dispatchers = async () => [person({ active: false })];
  mount(`/admin/companies/${ACME}`);
  await user.click(await screen.findByRole('tab', { name: 'Overview' }));
  await screen.findByRole('region', { name: 'Company details' });
  assert.equal(screen.queryByRole('button', { name: 'Add dispatcher' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Activate dispatcher' }), null);
});

test('a conflicting save retains the draft until Reload latest is chosen', async () => {
  const user = userEvent.setup({ document });
  let latest = company();
  api.company = async () => latest;
  api.updateCompanyOverview = async () => { throw new ApiError(409, 'Company changed. Reload before continuing.'); };
  mount(`/admin/companies/${ACME}`);
  const name = await screen.findByLabelText('Company name');
  await user.clear(name); await user.type(name, 'Draft name');
  latest = company({ name: 'Other admin edit', version: 2 });
  cache.setQueryData(['platform', 'company', ACME], latest);
  assert.equal((screen.getByLabelText('Company name') as HTMLInputElement).value, 'Draft name');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Company changed. Reload before continuing.');
  assert.equal((screen.getByLabelText('Company name') as HTMLInputElement).value, 'Draft name');
  await user.click(screen.getByRole('button', { name: 'Reload latest' }));
  await waitFor(() => assert.equal((screen.getByLabelText('Company name') as HTMLInputElement).value, 'Other admin edit'));
});

test('Suspend/Activate is inside Overview only, updates the title badge and confirms without submitting the form', async () => {
  const user = userEvent.setup({ document });
  const changes: boolean[] = [];
  let saves = 0;
  api.updateCompanyOverview = async () => { saves++; throw new Error('Unexpected form submit'); };
  let latest = company();
  api.company = async () => latest;
  api.setCompanyActive = async (_id, active, version) => {
    changes.push(active); latest = company({ active, version: version + 1 }); return latest;
  };
  mount(`/admin/companies/${ACME}`);
  const name = await screen.findByLabelText('Company name');
  const suspend = screen.getByRole('button', { name: 'Suspend' });
  assert.equal(suspend.closest('[role="tabpanel"]'), screen.getByRole('tabpanel', { name: 'Overview' }));
  assert.ok(screen.getByRole('heading', { level: 1 }).parentElement!.contains(screen.getByText('Active')));
  await user.type(name, ' draft');
  assert.equal((suspend as HTMLButtonElement).disabled, true);
  await user.clear(name); await user.type(name, 'Acme Dispatch');
  await waitFor(() => assert.equal((suspend as HTMLButtonElement).disabled, false));
  await user.click(screen.getByRole('tab', { name: 'History' }));
  assert.equal(screen.queryByRole('button', { name: 'Suspend' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Activate' }), null);
  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  await user.click(suspend);
  let confirm = await screen.findByRole('alertdialog');
  assert.match(confirm.textContent!, /signed out immediately/);
  await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
  assert.deepEqual(changes, []);
  await user.click(suspend);
  confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'Suspend' }));
  const activate = await screen.findByRole('button', { name: 'Activate' });
  assert.deepEqual(changes, [false]);
  assert.ok(screen.getByRole('heading', { level: 1 }).parentElement!.contains(screen.getByText('Suspended')));
  await user.click(activate);
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Activate' }));
  await screen.findByRole('button', { name: 'Suspend' });
  assert.deepEqual(changes, [false, true]);
  assert.equal(saves, 0);
  assert.ok(screen.getByRole('heading', { level: 1 }).parentElement!.contains(screen.getByText('Active')));
});

test('admin bell shows an inbox, marks all read and follows company notifications', async () => {
  const user = userEvent.setup({ document });
  const note = (id: string) => ({ id, version: 1, created_at: new Date().toISOString(), kind: 'settings.updated', severity: 'INFO' as const,
    title: 'Company settings updated', body: 'The dispatcher updated company settings.', read_at: null as string | null, organization_id: ACME, company_name: 'Acme Dispatch', target: 'company' as const });
  let rows = [note('note-1'), note('note-2')];
  const calls: string[] = [];
  api.platformNotifications = async () => ({ items: rows, unread: rows.filter(row => !row.read_at).length });
  api.readAllPlatformNotifications = async () => { calls.push('read-all'); rows = rows.map(row => ({ ...row, read_at: 'now', version: 2 })); return { updated: 2 }; };
  api.readPlatformNotification = async row => { calls.push('read:' + row.id); rows = rows.map(item => item.id === row.id ? { ...item, read_at: 'now', version: item.version + 1 } : item); return rows.find(item => item.id === row.id)!; };
  mount('/admin/profile');
  await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
  await screen.findByRole('dialog', { name: 'Notifications' });
  assert.equal(screen.getAllByRole('button', { name: /^Unread\. Information\. Acme Dispatch/ }).length, 2);
  await user.click(screen.getByRole('button', { name: 'Mark all read' }));
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled, true));
  assert.deepEqual(calls, ['read-all']);
  await user.keyboard('{Escape}');
  await screen.findByRole('button', { name: 'Notifications' });
  rows = [note('note-3')];
  await cache.invalidateQueries({ queryKey: ['platform', 'notifications'] });
  await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  await user.click(await screen.findByRole('button', { name: /^Unread\. Information\. Acme Dispatch/ }));
  await screen.findByLabelText('Company name');
  assert.equal(location.pathname, `/admin/companies/${ACME}`);
  await waitFor(() => assert.deepEqual(calls, ['read-all', 'read:note-3']));
  await screen.findByRole('button', { name: 'Notifications' });
});

test('Mark all read clears older unread notices beyond the visible page', async () => {
  const user = userEvent.setup({ document });
  let unread = 1;
  api.platformNotifications = async () => ({ items: [], unread });
  api.readAllPlatformNotifications = async () => { unread = 0; return { updated: 1 }; };
  mount('/admin/profile');
  await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  const markAll = screen.getByRole('button', { name: 'Mark all read' });
  assert.equal((markAll as HTMLButtonElement).disabled, false);
  await user.click(markAll);
  await screen.findByRole('button', { name: 'Notifications' });
});

test('admin bell has an empty state and closes with Escape', async () => {
  const user = userEvent.setup({ document });
  mount('/admin/profile');
  await user.click(screen.getByRole('button', { name: 'Notifications' }));
  await screen.findByText("You're all caught up.");
  assert.equal((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled, true);
  await user.keyboard('{Escape}');
  await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Notifications' }), null));
});

test('admin bell shows a notification loading error', async () => {
  const user = userEvent.setup({ document });
  api.platformNotifications = async () => { throw new ApiError(503, 'Database unavailable.'); };
  mount('/admin/profile');
  await waitFor(() => assert.equal(cache.getQueryCache().getAll().find(query => query.queryKey[1] === 'notifications')?.state.status, 'error'));
  await user.click(screen.getByRole('button', { name: 'Notifications' }));
  await waitFor(() => assert.ok(screen.getByRole('dialog', { name: 'Notifications' })));
  await screen.findByText('Notifications could not be loaded.');
});

test('the owner profile offers password change and no company workspace actions', async () => {
  mount('/admin/profile');
  assert.equal((await screen.findByLabelText('Login ID') as HTMLInputElement).value, 'owner');
  assert.ok(screen.getByRole('button', { name: 'Change password' }));
  assert.equal(screen.queryByRole('button', { name: 'Add company' }), null);
});

test('a company dispatcher session at /admin gets no owner workspace', async () => {
  api.me = async () => ({ id: '22222222-2222-4222-8222-222222222222', login_id: 'dispatcher', display_name: '', role: 'DISPATCHER', organization: { id: ACME, slug: 'acme', name: 'Acme Dispatch', active: true } }) as never;
  let listed = false;
  api.organizations = async () => { listed = true; return []; };
  history.replaceState(null, '', `/admin/companies/${ACME}`);
  render(React.createElement(PortalApp));
  await screen.findByRole('heading', { name: 'Sign in to this workspace' });
  assert.match(document.body.textContent!, /signed in as dispatcher/);
  assert.equal(screen.queryByRole('button', { name: 'Add company' }), null);
  assert.equal(listed, false);
});
