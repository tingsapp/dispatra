import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useState } from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { Field } = await import('../src/portal/ui');
const { PasswordInput } = await import('../src/components/ui/PasswordInput');
afterEach(cleanup);

test('password fields toggle independently by mouse and keyboard without submitting or changing values', async () => {
  let submissions = 0;
  function Form() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    return React.createElement('form', { onSubmit: event => { event.preventDefault(); submissions++; } },
      React.createElement(Field, { label: 'Current password', type: 'password', autoComplete: 'current-password', value: current, onChange: event => setCurrent(event.target.value) }),
      React.createElement(Field, { label: 'New password', type: 'password', autoComplete: 'new-password', minLength: 12, maxLength: 128, required: true, value: next, onChange: event => setNext(event.target.value) }));
  }
  render(React.createElement(Form));
  const user = userEvent.setup({ document });
  const current = screen.getByLabelText('Current password') as HTMLInputElement;
  const next = screen.getByLabelText('New password') as HTMLInputElement;
  await user.type(current, ' Current secret 42! ');
  await user.type(next, 'Different secret 43!');
  assert.equal(current.type, 'password'); assert.equal(next.type, 'password');
  await user.click(screen.getByRole('button', { name: 'Show current password' }));
  assert.equal(current.type, 'text'); assert.equal(next.type, 'password');
  assert.equal(current.value, ' Current secret 42! ');
  const hide = screen.getByRole('button', { name: 'Hide current password' });
  hide.focus(); await user.keyboard('{Enter}');
  assert.equal(current.type, 'password'); assert.equal(submissions, 0);
  await user.click(screen.getByRole('button', { name: 'Show new password' }));
  assert.equal(next.type, 'text');
  assert.equal(next.maxLength, 128); assert.equal(next.minLength, 12); assert.ok(next.required);
  assert.equal(next.autocomplete, 'new-password');
  await user.clear(next);
  assert.equal(next.type, 'password');
  assert.equal(screen.getByRole('button', { name: 'Show new password' }).getAttribute('aria-pressed'), 'false');
});

test('disabled password entries and entries in disabled fieldsets cannot be revealed', async () => {
  render(React.createElement('div', null,
    React.createElement(PasswordInput, { label: 'Disabled password', 'aria-label': 'Disabled password', value: 'secret', disabled: true, readOnly: true }),
    React.createElement('fieldset', { disabled: true }, React.createElement(Field, { label: 'Saving password', type: 'password', value: 'secret', readOnly: true }))));
  const user = userEvent.setup({ document });
  for (const label of ['Disabled password', 'Saving password']) {
    const input = screen.getByLabelText(label) as HTMLInputElement;
    const button = screen.getByRole('button', { name: `Show ${label.toLowerCase()}` });
    assert.ok(button.matches(':disabled'));
    await user.click(button); assert.equal(input.type, 'password');
  }
});
