import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','PopStateEvent','MutationObserver','getComputedStyle','localStorage','sessionStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
window.scrollTo = () => {};
const { render, screen, cleanup, waitFor, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { api, ApiError } = await import('../src/portal/api');
const { AdminPortal } = await import('../src/portal/admin/AdminPortal');
const { adminRoute, isAdminPath } = await import('../src/portal/admin/adminRoutes');
const { parsePortal, default: PortalApp } = await import('../src/portal/PortalApp');

const ACME = '11111111-1111-4111-8111-111111111111';
const owner = { id: '99999999-9999-4999-8999-999999999999', login_id: 'owner', display_name: '', role: 'ADMIN', organization: null } as never;
const company = (overrides = {}) => ({ id: ACME, slug: 'acme', name: 'Acme Dispatch', active: true, version: 1, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  dispatcher_count: 1, active_dispatcher_count: 1, shipper_account_count: 2, driver_account_count: 3, active_session_count: 1, ...overrides });
const person = (overrides = {}) => ({ id: '22222222-2222-4222-8222-222222222222', login_id: 'dispatcher', display_name: 'First Desk', active: true, version: 1,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', last_login_at: null, active_session_count: 0, ...overrides });
const original = { ...api };
let cache: InstanceType<typeof QueryClient>;
let calls: string[] = [];
beforeEach(() => {
  calls = [];
  Object.assign(api, {
    organizations: async () => [company()], company: async () => company(), companyAudit: async () => [], dispatchers: async () => [person()],
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
  await user.click(screen.getByRole('link', { name: 'Manage Acme Dispatch' }));
  assert.equal(location.pathname, `/admin/companies/${ACME}`);
  await screen.findByRole('table', { name: 'Dispatcher accounts' });
  await waitFor(() => assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'Acme Dispatch'));
  history.back();
  await waitFor(() => assert.equal(location.pathname, '/admin/companies'));
  await screen.findByRole('table', { name: 'Dispatch companies' });
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

test('a new dispatcher password is shown once and never persisted or used as a query key', async () => {
  const user = userEvent.setup({ document });
  const secret = 'Generated-Secret-Password-42';
  let body: unknown;
  api.createDispatcher = async (_id, submitted) => { body = submitted; return { ...person({ id: '33333333-3333-4333-8333-333333333333', login_id: 'second' }), initial_password: secret }; };
  mount(`/admin/companies/${ACME}`);
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
  await user.click(screen.getByRole('button', { name: 'Done' }));
  assert.equal(screen.queryByLabelText('Login details'), null);
  assert.ok(!document.body.innerHTML.includes(secret));
});

test('dispatcher actions require confirmation and the last active dispatcher cannot be deactivated', async () => {
  const user = userEvent.setup({ document });
  const commands: string[] = [];
  api.dispatcherCommand = async (_id, _user, action, version) => { commands.push(`${action}:${version}`); return { ...person({ version: 2 }), initial_password: 'Reset-Secret-Value-99' }; };
  mount(`/admin/companies/${ACME}`);
  await user.click(await screen.findByRole('button', { name: 'Actions for dispatcher' }));
  const deactivate = screen.getByRole('menuitem', { name: 'Deactivate (last active)' });
  assert.ok(deactivate.hasAttribute('data-disabled') || deactivate.getAttribute('aria-disabled') === 'true');
  await user.click(screen.getByRole('menuitem', { name: 'Reset password' }));
  const confirm = await screen.findByRole('alertdialog');
  await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
  assert.deepEqual(commands, []);
  await user.click(screen.getByRole('button', { name: 'Actions for dispatcher' }));
  await user.click(screen.getByRole('menuitem', { name: 'Reset password' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset password' }));
  assert.match((await screen.findByLabelText('Login details') as HTMLTextAreaElement).value, /Reset-Secret-Value-99/);
  assert.deepEqual(commands, ['reset-password:1']);
});

test('stale versions show a conflict with a reload action, and suspension is confirmed', async () => {
  const user = userEvent.setup({ document });
  const changes: string[] = [];
  api.updateCompany = async () => { throw new ApiError(409, 'Company changed. Reload before continuing.'); };
  api.setCompanyActive = async (_id, active, version) => { changes.push(`${active}:${version}`); return company({ active, version: version + 1 }); };
  mount(`/admin/companies/${ACME}`);
  const name = await screen.findByLabelText('Company name');
  await user.clear(name); await user.type(name, 'Renamed');
  await user.click(screen.getByRole('button', { name: 'Save details' }));
  await screen.findByText('Company changed. Reload before continuing.');
  assert.ok(screen.getByRole('button', { name: 'Reload latest' }));
  assert.equal((screen.getByLabelText('Company identifier') as HTMLInputElement).readOnly, true);
  await user.click(screen.getByRole('button', { name: 'Suspend company' }));
  const confirm = await screen.findByRole('alertdialog');
  assert.match(confirm.textContent!, /signed out immediately/);
  await user.click(within(confirm).getByRole('button', { name: 'Suspend company' }));
  await screen.findByRole('button', { name: 'Activate company' });
  assert.deepEqual(changes, ['false:1']);
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
