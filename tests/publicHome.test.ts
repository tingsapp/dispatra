import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { workspaceDestination, readWorkspaceEntry, rememberWorkspaceEntry, WORKSPACE_ENTRY_KEY, accountWorkspace } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; });

test('company names produce canonical login destinations without accepting URLs', () => {
  assert.deepEqual((['dispatcher', 'shipper', 'driver'] as const).map(role => workspaceDestination(' Demo ', role)), ['/demo/', '/demo/shipper', '/demo/driver']);
  for (const invalid of ['', 'admin', 'driver', 'prototype', 'a', 'x'.repeat(64), 'Acme Delivery', 'javascript:alert(1)', '//other.example/acme', 'https://dispatra.com/acme/', '/acme/driver', 'acme/../admin', 'acme?redirect=other']) {
    assert.equal(workspaceDestination(invalid, 'dispatcher'), undefined, invalid);
  }
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
test('resume destinations use the authenticated role and company rather than remembered entry', () => {
  assert.deepEqual((['DISPATCHER', 'SHIPPER', 'DRIVER', 'ADMIN'] as const).map(role => accountWorkspace(account(role))), ['/acme/', '/acme/shipper', '/acme/driver', '/admin']);
  assert.equal(accountWorkspace(), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), role: 'UNKNOWN' } as unknown as Account), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), organization: null }), undefined);
});
test('homepage entry is inside the hero with a fixed prefix and no role selection or popup', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  const input = screen.getByLabelText('Company workspace');
  const hero = screen.getByRole('heading', { level: 1, name: /From order to delivery/ }).closest('section');
  assert.ok(hero?.contains(input));
  assert.ok(screen.getByText('dispatra.com/'));
  assert.ok(screen.getByRole('button', { name: 'Continue' }));
  assert.equal(screen.queryByRole('radio'), null);
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(screen.getByRole('banner').querySelectorAll('a').length, 1);
  assert.equal(screen.queryByRole('link', { name: 'Log in' }), null);
  assert.equal(screen.queryByRole('link', { name: 'How it works' }), null);
  fireEvent.click(screen.getByRole('link', { name: 'Sign in to your workspace' }));
  assert.equal(document.activeElement, input);
  assert.equal(document.querySelector('a[href="/admin"]'), null);
});
test('hero input rejects invalid workspace names and never saves them', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome, { initialRole: 'driver' }));
  for (const value of ['', 'admin', 'https://dispatra.com/demo/']) {
    fireEvent.change(screen.getByLabelText('Company workspace'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    assert.equal(screen.getByLabelText('Company workspace').getAttribute('aria-invalid'), 'true');
    assert.ok(screen.getByRole('alert'));
  }
  assert.equal(localStorage.length, 0);
});
test('returning visitors get their company name and signed-in visitors resume their actual portal', async () => {
  rememberWorkspaceEntry('last-company', 'shipper');
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  assert.equal((screen.getByLabelText('Company workspace') as HTMLInputElement).value, 'last-company');
  await waitFor(() => assert.equal(screen.getByRole('link', { name: 'Open my workspace' }).getAttribute('href'), '/acme/driver'));
});
