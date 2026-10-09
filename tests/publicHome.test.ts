import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { workspaceSlug, readWorkspaceEntry, rememberWorkspaceEntry, WORKSPACE_ENTRY_KEY, accountWorkspace } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const originalLogin = api.login;
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; api.login = originalLogin; });

test('workspace entry accepts names and links but only produces valid company identifiers', () => {
  assert.equal(workspaceSlug('  Acme-Delivery '), 'acme-delivery');
  assert.equal(workspaceSlug('https://dispatra.com/acme/orders?redirect=https://other.example'), 'acme');
  assert.equal(workspaceSlug('/acme/shipper'), 'acme');
  for (const invalid of ['', 'admin', 'driver', 'prototype', 'Acme Delivery', 'javascript:alert(1)', '//other.example/acme', 'https://dispatra.com/admin', 'https://dispatra.com/', 'acme/../admin']) assert.equal(workspaceSlug(invalid), undefined, invalid);
});
test('remembered entry contains only validated workspace and role preferences', () => {
  rememberWorkspaceEntry('acme', 'shipper');
  assert.deepEqual(readWorkspaceEntry(), { slug: 'acme', role: 'shipper' });
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(WORKSPACE_ENTRY_KEY)!)), ['slug', 'role']);
  for (const data of ['broken JSON', '{"slug":"admin","role":"driver"}', '{"slug":"acme","role":"ADMIN"}']) {
    localStorage.setItem(WORKSPACE_ENTRY_KEY, data);
    assert.deepEqual(readWorkspaceEntry(), { slug: '', role: 'dispatcher' });
  }
});
test('resume links use authenticated account role and company rather than remembered entry', () => {
  assert.deepEqual((['DISPATCHER', 'SHIPPER', 'DRIVER', 'ADMIN'] as const).map(role => accountWorkspace(account(role))), ['/acme/', '/acme/shipper', '/acme/driver', '/admin']);
  assert.equal(accountWorkspace(), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), role: 'UNKNOWN' } as unknown as Account), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), organization: null }), undefined);
});
test('home provides portal sign-in shortcuts and validates the form without public admin links', async () => {
  api.me = anonymous;
  render(React.createElement(PublicHome, { initialRole: 'driver' }));
  assert.ok(screen.getByRole('heading', { level: 1, name: /From order to delivery/  }));
  assert.equal((screen.getByRole('radio', { name: 'Driver' }) as HTMLInputElement).checked, true);
  assert.equal(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'), '#workspace');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in as driver' }));
  assert.ok(screen.getByRole('alert'));
  fireEvent.change(screen.getByLabelText('Company workspace'), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in as driver' }));
  assert.equal(screen.getByLabelText('Company workspace').getAttribute('aria-invalid'), 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Shipper' }));
  assert.ok(screen.getByRole('button', { name: 'Sign in as shipper' }));
  assert.equal(screen.queryByRole('link', { name: 'Platform administration' }), null);
  for (const role of ['Dispatcher', 'Shipper', 'Driver']) {
    fireEvent.click(screen.getByRole('link', { name: `${role} sign in` }));
    assert.equal((screen.getByRole('radio', { name: role }) as HTMLInputElement).checked, true);
  }
  await waitFor(() => assert.ok(screen.getByRole('link', { name: 'Sign in' })));
});
test('all three homepage sign-in choices submit credentials with the correct tenant and API portal', async () => {
  api.me = anonymous;
  const requests: unknown[] = [];
  api.login = async body => { requests.push(body); throw new ApiError(401, 'Incorrect login or password.'); };
  render(React.createElement(PublicHome));
  fireEvent.change(screen.getByLabelText('Company workspace'), { target: { value: 'https://dispatra.com/acme/' } });
  fireEvent.change(screen.getByLabelText('Email or login ID'), { target: { value: ' User@Example.com ' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Example-Password-99' } });
  for (const [index, [role, portal]] of [['Dispatcher', 'dispatch'], ['Shipper', 'customer'], ['Driver', 'driver']].entries()) {
    fireEvent.click(screen.getByRole('radio', { name: role }));
    fireEvent.click(screen.getByRole('button', { name: `Sign in as ${role.toLowerCase()}` }));
    await waitFor(() => assert.match(screen.getByRole('alert').textContent!, /Incorrect login or password/));
    assert.deepEqual(requests[index], { organization: 'acme', portal, login_id: 'user@example.com', password: 'Example-Password-99' });
    assert.equal(localStorage.length, 0, 'Failed sign-in never saves credentials or workspace preferences');
  }
});
test('sign-in disables credentials and prevents duplicate submissions while the request is pending', async () => {
  api.me = anonymous;
  let calls = 0;
  let reject: (error: Error) => void = () => {};
  api.login = () => { calls++; return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); };
  render(React.createElement(PublicHome));
  for (const [label, value] of [['Company workspace', 'acme'], ['Email or login ID', 'user'], ['Password', 'Example-Password-99']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sign in as dispatcher' }));
  await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement).disabled, true));
  assert.equal(screen.getByLabelText('Password').closest('fieldset')?.disabled, true);
  fireEvent.submit(screen.getByLabelText('Password').closest('form')!);
  assert.equal(calls, 1);
  reject(new ApiError(401, 'Incorrect login or password.'));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Sign in as dispatcher' })));
});
test('an owner session does not add an administration shortcut to the public homepage', async () => {
  api.me = async () => account('ADMIN');
  render(React.createElement(PublicHome));
  await waitFor(() => assert.ok(screen.getByRole('link', { name: 'Sign in' })));
  assert.equal(document.querySelector('a[href="/admin"]'), null);
});
test('returning visitors get their workspace preference and signed-in visitors get their actual portal', async () => {
  rememberWorkspaceEntry('last-company', 'shipper');
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  assert.equal((screen.getByLabelText('Company workspace') as HTMLInputElement).value, 'last-company');
  assert.equal((screen.getByRole('radio', { name: 'Shipper' }) as HTMLInputElement).checked, true);
  await waitFor(() => assert.equal(screen.getAllByRole('link', { name: 'Open my workspace' })[0].getAttribute('href'), '/acme/driver'));
});
