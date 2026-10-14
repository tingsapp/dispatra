import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor, within } = await import('@testing-library/react');
const { accountWorkspace, signupDestination, dispatcherPageAvailable } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role, tms_workspace: false,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; });

test('resume destinations use the authenticated role and company rather than remembered entry', () => {
  assert.deepEqual((['DISPATCHER', 'SHIPPER', 'DRIVER', 'ADMIN'] as const).map(role => accountWorkspace(account(role))), ['/acme/', '/acme/shipper', '/acme/driver', '/admin']);
  assert.equal(accountWorkspace(), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), role: 'UNKNOWN' } as unknown as Account), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), organization: null }), undefined);
  assert.equal(accountWorkspace({ ...account('DISPATCHER'), tms_workspace: true }), '/acme/integrations');
  assert.equal(accountWorkspace({ ...account('SHIPPER'), tms_workspace: true }), '/acme/shipper');
  assert.equal(accountWorkspace({ ...account('DRIVER'), tms_workspace: true }), '/acme/driver');
});
test('homepage restores the prefixed company input and Start trial, keeping shared login separate', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  const input = screen.getByLabelText('Workspace');
  const hero = screen.getByRole('heading', { level: 1, name: /From order to delivery/ }).closest('section');
  assert.ok(hero?.contains(input));
  assert.ok(screen.getByText('dispatra.com/'));
  assert.ok(screen.getByRole('button', { name: 'Start trial' }));
  assert.equal(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'), '/login');
  assert.equal(screen.queryByRole('radio'), null);
  assert.equal(screen.getByRole('link', { name: 'Sign in to your workspace' }).getAttribute('href'), '/login');
  assert.equal(within(screen.getByRole('banner')).getByRole('link', { name: 'Login' }).getAttribute('href'), '/login');
  const footer = within(screen.getByRole('contentinfo'));
  assert.equal(footer.getByRole('link', { name: 'Start free trial' }).getAttribute('href'), '/signup');
  assert.equal(footer.getByRole('link', { name: 'How it works' }).getAttribute('href'), '/#how-it-works');
  assert.deepEqual(['Dispatchers', 'Shippers', 'Drivers'].map(name => footer.getByRole('link', { name }).getAttribute('href')), ['/dispatch', '/shipper', '/driver']);
});
test('company identifiers produce signup destinations and reject URLs or reserved names', () => {
  assert.equal(signupDestination(' My-Company '), '/signup?company=my-company');
  for (const invalid of ['', 'admin', 'signup', 'driver', 'a', 'x'.repeat(64), 'https://dispatra.com/acme/', '/acme', 'my company', 'acme?redirect=evil']) {
    assert.equal(signupDestination(invalid), undefined, invalid);
  }
});
test('invalid homepage identifiers show an error without saving preferences', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
  assert.ok(screen.getByRole('alert'));
  assert.equal(localStorage.length, 0);
});
test('authenticated resume uses the session company even with a remembered company', async () => {
  localStorage.setItem('dispatra_public_workspace_v1', JSON.stringify({ slug: 'last-company', role: 'shipper' }));
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  assert.equal((screen.getByLabelText('Workspace') as HTMLInputElement).value, '');
  await waitFor(() => assert.equal(screen.getByRole('link', { name: 'Open my workspace' }).getAttribute('href'), '/acme/driver'));
});

test('Monitor is available in both TMS modes while External TMS keeps its other page restrictions',()=>{
 for(const external of [false,true])assert.equal(dispatcherPageAvailable('monitor',external),true);
 for(const page of ['profile','help','integrations'])assert.equal(dispatcherPageAvailable(page,true),true);
 for(const page of ['jobs','drivers','vehicles','customers','reports','rate-cards',undefined])assert.equal(dispatcherPageAvailable(page,true),false);
 assert.equal(dispatcherPageAvailable('jobs',false),true);
});
