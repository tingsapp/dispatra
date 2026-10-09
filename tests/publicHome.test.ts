import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { workspaceSlug, workspaceDestination, readWorkspaceEntry, rememberWorkspaceEntry, WORKSPACE_ENTRY_KEY, accountWorkspace } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; });

test('workspace entry accepts names and links but only produces canonical local role destinations', () => {
  assert.equal(workspaceDestination('  Acme-Delivery ', 'dispatcher'), '/acme-delivery/');
  assert.equal(workspaceDestination('https://dispatra.com/acme/orders?redirect=https://other.example', 'shipper'), '/acme/shipper');
  assert.equal(workspaceDestination('/acme/shipper', 'driver'), '/acme/driver');
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
test('home provides accessible portal choices, preserves intent on invalid entry and keeps admin reachable', async () => {
  api.me = anonymous;
  render(React.createElement(PublicHome, { initialRole: 'driver' }));
  assert.ok(screen.getByRole('heading', { level: 1, name: /From order to delivery/  }));
  assert.equal((screen.getByRole('radio', { name: 'Driver' }) as HTMLInputElement).checked, true);
  assert.equal(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'), '#workspace');
  fireEvent.click(screen.getByRole('button', { name: 'Continue as driver' }));
  assert.ok(screen.getByRole('alert'));
  fireEvent.change(screen.getByLabelText('Company workspace'), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue as driver' }));
  assert.equal(screen.getByLabelText('Company workspace').getAttribute('aria-invalid'), 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Shipper' }));
  assert.ok(screen.getByRole('button', { name: 'Continue as shipper' }));
  assert.equal(screen.getByRole('link', { name: 'Platform administration' }).getAttribute('href'), '/admin');
  await waitFor(() => assert.ok(screen.getByRole('link', { name: 'Sign in' })));
});
test('returning visitors get their workspace preference and signed-in visitors get their actual portal', async () => {
  rememberWorkspaceEntry('last-company', 'shipper');
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  assert.equal((screen.getByLabelText('Company workspace') as HTMLInputElement).value, 'last-company');
  assert.equal((screen.getByRole('radio', { name: 'Shipper' }) as HTMLInputElement).checked, true);
  await waitFor(() => assert.equal(screen.getAllByRole('link', { name: 'Open my workspace' })[0].getAttribute('href'), '/acme/driver'));
});
