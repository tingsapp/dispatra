import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/shippers' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { DirectoryPasswordForm } = await import('../src/components/entities/DirectoryPasswordForm');
const { operations } = await import('../src/operations/api');
const { ApiError } = await import('../src/portal/api');
const original = { ...operations };
let cache: InstanceType<typeof QueryClient>;
afterEach(() => { cleanup(); cache?.clear(); Object.assign(operations, original); });
after(() => dom.window.close());
function mount(kind: 'shipper' | 'driver') {
  cache = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } } });
  render(React.createElement(QueryClientProvider, { client: cache }, React.createElement(DirectoryPasswordForm, { slug: 'acme', kind, record: { id: 'account-1', version: 4 } })));
}
for (const kind of ['shipper', 'driver'] as const) test(`${kind} password form validates confirmation, preserves exact credentials and clears after saving`, async () => {
  const calls: unknown[] = [];
  operations[kind === 'shipper' ? 'changeShipperPassword' : 'changeDriverPassword'] = async (slug, id, body, key) => { calls.push({ slug, id, body, key: Boolean(key) }); return { id, version: 5 }; };
  mount(kind);
  const user = userEvent.setup({ document });
  const password = '  Supplied-password-2026!  ';
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm password'), 'Different-password-2026!');
  await user.click(screen.getByRole('button', { name: 'Change password' }));
  assert.equal((await screen.findByRole('alert')).textContent, 'New passwords do not match.'); assert.deepEqual(calls, []);
  await user.clear(screen.getByLabelText('Confirm password')); await user.type(screen.getByLabelText('Confirm password'), password);
  await user.click(screen.getByRole('button', { name: 'Show new password' }));
  assert.equal((screen.getByLabelText('New password') as HTMLInputElement).type, 'text');
  await user.click(screen.getByRole('button', { name: 'Change password' }));
  await screen.findByText('Password changed.');
  assert.deepEqual(calls, [{ slug: 'acme', id: 'account-1', body: { version: 4, new_password: password }, key: true }]);
  assert.equal((screen.getByLabelText('New password') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('Confirm password') as HTMLInputElement).value, '');
  assert.equal((screen.getByLabelText('New password') as HTMLInputElement).type, 'password');
  assert.ok(!JSON.stringify(cache.getQueryCache().getAll().map(query => query.queryKey)).includes(password));
});

test('an uncertain request retries with the same key and keeps the form editable', async () => {
  const keys: string[] = [];
  operations.changeDriverPassword = async (_slug, id, _body, key) => {
    keys.push(key); if (keys.length === 1) throw new ApiError(503, 'Temporarily unavailable.'); return { id, version: 5 };
  };
  mount('driver'); const user = userEvent.setup({ document });
  for (const label of ['New password', 'Confirm password']) await user.type(screen.getByLabelText(label), 'Retry-password-2026!');
  await user.click(screen.getByRole('button', { name: 'Change password' }));
  await screen.findByText('Temporarily unavailable.');
  assert.equal((screen.getByLabelText('New password') as HTMLInputElement).value, 'Retry-password-2026!');
  await waitFor(() => assert.ok(!(screen.getByRole('button', { name: 'Change password' }) as HTMLButtonElement).disabled));
  await user.click(screen.getByRole('button', { name: 'Change password' })); await screen.findByText('Password changed.');
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});
