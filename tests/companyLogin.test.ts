import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { LoginPage } = await import('../src/portal/LoginPage');
const { api, ApiError } = await import('../src/portal/api');
import type { Account, LoginInput } from '../src/portal/api';
const originalLogin = api.login;
afterEach(() => { cleanup(); localStorage.clear(); api.login = originalLogin; window.history.replaceState(null, '', '/acme/'); });
const view = (portal: LoginInput['portal'], onLogin: (account: Account) => void = () => {}) => render(React.createElement(QueryClientProvider,
  { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } } }) },
  React.createElement(LoginPage, { slug: portal === 'platform' ? undefined : 'acme', portal, onLogin })));

test('company login labels the workspace above role selection without a company field', () => {
  for (const [portal, role] of [['dispatch', 'Dispatcher'], ['customer', 'Shipper'], ['driver', 'Driver']] as const) {
    view(portal);
    const company = screen.getByText('dispatra.com/acme');
    assert.equal(screen.queryByLabelText('Company workspace'), null);
    assert.ok(company.compareDocumentPosition(screen.getByText('Sign in as')) & Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal((screen.getByRole('radio', { name: role }) as HTMLInputElement).checked, true);
    assert.equal(screen.getByRole('link', { name: 'Change workspace' }).getAttribute('href'), '/#workspace');
    cleanup();
  }
});
test('changing roles submits the matching API portal and retains the company and entered login', async () => {
  const requests: LoginInput[] = [];
  const signedIn: Account[] = [];
  api.login = async body => {
    requests.push(body);
    return { id: 'user-1', login_id: body.login_id, display_name: 'User', role: ({ dispatch: 'DISPATCHER', customer: 'SHIPPER', driver: 'DRIVER', platform: 'ADMIN' } as const)[body.portal],
      organization: { id: 'company-1', name: 'Acme', slug: 'acme', active: true } };
  };
  view('dispatch', account => signedIn.push(account));
  fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: 'User@Example.com' } });
  for (const [index, [role, portal, path]] of ([['Dispatcher', 'dispatch', '/acme/'], ['Shipper', 'customer', '/acme/shipper'], ['Driver', 'driver', '/acme/driver']] as const).entries()) {
    fireEvent.click(screen.getByRole('radio', { name: role }));
    assert.equal(window.location.pathname, path);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Example-Password-99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => assert.equal(signedIn.length, index + 1));
    assert.deepEqual(requests[index], { organization: 'acme', portal, login_id: 'user@example.com', password: 'Example-Password-99' });
    assert.equal((screen.getByLabelText('Password') as HTMLInputElement).value, '');
    assert.ok(screen.getByText('dispatra.com/acme'));
    assert.equal(JSON.stringify(Object.values(localStorage)).includes('Example-Password-99'), false);
    assert.equal(JSON.stringify(Object.values(localStorage)).includes('user@example.com'), false);
  }
});
test('pending sign-in locks role and credential inputs and prevents duplicate requests', async () => {
  let calls = 0;
  let reject: (error: Error) => void = () => {};
  api.login = () => { calls++; return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); };
  view('dispatch');
  fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: 'user' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Example-Password-99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement).disabled, true));
  assert.equal(screen.getByRole('radio', { name: 'Shipper' }).closest('fieldset')?.disabled, true);
  assert.equal(screen.getByLabelText('Password').closest('fieldset')?.disabled, true);
  fireEvent.submit(screen.getByLabelText('Password').closest('form')!);
  assert.equal(calls, 1);
  reject(new ApiError(401, 'Incorrect login or password.'));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent!, /Incorrect login or password/));
  fireEvent.click(screen.getByRole('radio', { name: 'Driver' }));
  assert.equal(screen.queryByRole('alert'), null);
});
test('administration retains its separate owner login without company role choices', async () => {
  let request: LoginInput | undefined;
  api.login = async body => { request = body; throw new ApiError(401, 'Incorrect login or password.'); };
  view('platform');
  assert.ok(screen.getByRole('heading', { name: 'Platform administration' }));
  assert.equal(screen.queryByRole('radio'), null);
  assert.equal(screen.queryByLabelText('Company workspace'), null);
  fireEvent.change(screen.getByLabelText('Login ID'), { target: { value: 'owner' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Example-Password-99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => assert.equal(request?.portal, 'platform'));
  assert.equal(request?.organization, null);
});
