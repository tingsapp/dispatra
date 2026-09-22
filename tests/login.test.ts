import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/orders', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage', 'location', 'history']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { LoginPage } = await import('../src/pages/LoginPage');
const { loadSession, signIn, signOut, SESSION_STORAGE_KEY, DISPATCHER_CREDENTIALS } = await import('../src/lib/sessionStorage');
const { DEFAULT_USER_PROFILE } = await import('../src/lib/profileStorage');
afterEach(() => { cleanup(); localStorage.clear(); history.replaceState(null, '', '/orders'); });

test('sessions require the dispatcher credentials and persist until sign-out', () => {
  assert.equal(loadSession(), null);
  assert.equal(DISPATCHER_CREDENTIALS.email, 'dispatcher@dispatra.com'); assert.equal(DISPATCHER_CREDENTIALS.password, '123456');
  assert.throws(() => signIn('not-an-email', 'x'), /valid email/);
  assert.throws(() => signIn(DISPATCHER_CREDENTIALS.email, ''), /password/);
  assert.throws(() => signIn('someone@else.test', '123456'), /Incorrect email or password/);
  assert.throws(() => signIn(DISPATCHER_CREDENTIALS.email, '654321'), /Incorrect email or password/);
  const session = signIn('Dispatcher@Dispatra.com', '123456', new Date('2026-09-22T10:00:00Z'));
  assert.deepEqual(session, { email: 'dispatcher@dispatra.com', name: DEFAULT_USER_PROFILE.name, signedInAt: '2026-09-22T10:00:00.000Z' });
  assert.deepEqual(loadSession(), session);
  signOut(); assert.equal(loadSession(), null); assert.equal(localStorage.getItem(SESSION_STORAGE_KEY), null);
});

test('login page reports bad credentials and hands a session back on success', async () => {
  const user = userEvent.setup({ document }); let signed: unknown;
  render(React.createElement(LoginPage, { onSignedIn: s => { signed = s; } }));
  await user.type(screen.getByLabelText('Email'), 'wrong@example.test'); await user.type(screen.getByLabelText('Password'), '123456');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  assert.match(screen.getByRole('alert').textContent!, /Incorrect email or password/); assert.equal(signed, undefined);
  await user.clear(screen.getByLabelText('Email')); await user.type(screen.getByLabelText('Email'), DISPATCHER_CREDENTIALS.email);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  assert.equal(screen.queryByRole('alert'), null); assert.equal((signed as { email: string }).email, DISPATCHER_CREDENTIALS.email);
});

test('dispatch URLs show the login page until a session exists, then the workspace; sign-out returns to login', async () => {
  const { default: Root } = await import('../src/Root');
  const user = userEvent.setup({ document });
  const view = render(React.createElement(Root));
  assert.ok(screen.getByRole('heading', { name: 'Sign in' })); assert.equal(location.pathname, '/login');
  await user.type(screen.getByLabelText('Email'), DISPATCHER_CREDENTIALS.email); await user.type(screen.getByLabelText('Password'), DISPATCHER_CREDENTIALS.password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  assert.equal(screen.queryByRole('heading', { name: 'Sign in' }), null); assert.equal(location.pathname, '/'); assert.ok(loadSession());
  view.unmount(); cleanup();
  history.replaceState(null, '', '/login');
  render(React.createElement(Root));
  assert.equal(screen.queryByRole('heading', { name: 'Sign in' }), null, 'a signed-in dispatcher skips the login page'); assert.equal(location.pathname, '/');
});
