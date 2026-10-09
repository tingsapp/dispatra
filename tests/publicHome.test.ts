import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor, within } = await import('@testing-library/react');
const { workspaceSlug, workspaceDestination, readWorkspaceEntry, rememberWorkspaceEntry, WORKSPACE_ENTRY_KEY, accountWorkspace } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; });

test('popup company names produce canonical role login destinations without accepting URLs', () => {
  assert.equal(workspaceSlug('https://dispatra.com/acme/orders'), 'acme', 'Historical preferences/account validation keep their existing parser');
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
test('Log in opens a focused popup, locks background scrolling and restores focus on Escape', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(screen.queryByLabelText('Company workspace'), null, 'There is no inline form beneath the hero');
  const trigger = screen.getByRole('button', { name: 'Log in' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Open your workspace' });
  const input = within(dialog).getByLabelText('Company workspace');
  assert.equal(document.activeElement, input);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(within(dialog).getAllByRole('radio').length, 3);
  assert.equal(within(dialog).getAllByRole('textbox').length, 1);
  assert.ok(within(dialog).getByText('dispatra.com/'));
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement, trigger);
  assert.equal(document.querySelector('a[href="/admin"]'), null);
});
test('popup validates the company name and preserves the selected role on invalid entry', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome, { initialRole: 'driver' }));
  assert.equal((screen.getByRole('radio', { name: 'Driver' }) as HTMLInputElement).checked, true);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  assert.ok(screen.getByRole('alert'));
  for (const value of ['admin', 'https://dispatra.com/demo/']) {
    fireEvent.change(screen.getByLabelText('Company workspace'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    assert.equal(screen.getByLabelText('Company workspace').getAttribute('aria-invalid'), 'true');
    assert.equal((screen.getByRole('radio', { name: 'Driver' }) as HTMLInputElement).checked, true);
  }
  assert.equal(localStorage.length, 0, 'Invalid entries are never saved');
  fireEvent.click(screen.getByRole('radio', { name: 'Shipper' }));
  assert.equal(screen.queryByRole('alert'), null);
});
test('each role shortcut opens the popup with its corresponding role selected', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  for (const role of ['Dispatcher', 'Shipper', 'Driver']) {
    fireEvent.click(screen.getByRole('button', { name: `${role} sign in` }));
    assert.equal((screen.getByRole('radio', { name: role }) as HTMLInputElement).checked, true);
    fireEvent.click(screen.getByRole('button', { name: 'Close workspace selection' }));
    assert.equal(screen.queryByRole('dialog'), null);
  }
});
test('returning visitors get their preference in the popup and signed-in visitors resume their actual portal', async () => {
  rememberWorkspaceEntry('last-company', 'shipper');
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  await waitFor(() => assert.equal(screen.getAllByRole('link', { name: 'Open my workspace' })[0].getAttribute('href'), '/acme/driver'));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to your workspace' }));
  assert.equal((screen.getByLabelText('Company workspace') as HTMLInputElement).value, 'last-company');
  assert.equal((screen.getByRole('radio', { name: 'Shipper' }) as HTMLInputElement).checked, true);
});
