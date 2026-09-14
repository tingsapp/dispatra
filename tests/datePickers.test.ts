import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { useState } from 'react';
import { JSDOM } from 'jsdom';
import { parseDateValue, formatDateValue, combineDateAndTime } from '../src/lib/dateValues';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
Object.defineProperty(globalThis, 'requestAnimationFrame', { value: dom.window.requestAnimationFrame.bind(dom.window), configurable: true });
Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: dom.window.cancelAnimationFrame.bind(dom.window), configurable: true });
HTMLElement.prototype.scrollIntoView = () => {};

// Load DOM-aware components after the test document exists, including Radix portals.
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { DatePicker } = await import('../src/components/ui/DatePicker');
const { DateTimePicker } = await import('../src/components/ui/DateTimePicker');
const { DateControl } = await import('../src/components/DateControl');
afterEach(cleanup);

function Field({ initial = '2026-09-14', onChange = (_: string) => {} }) {
  const [value, setValue] = useState(initial);
  return React.createElement(DatePicker, { value, 'aria-label': 'Effective To', onValueChange: next => { setValue(next); onChange(next); } });
}

test('calendar dates roundtrip across timezones and reject impossible dates', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['America/Vancouver', 'Asia/Karachi', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      for (const value of ['2024-02-29', '2026-03-08', '2026-11-01', '2026-12-31']) assert.equal(formatDateValue(parseDateValue(value)!), value);
      assert.equal(parseDateValue('2026-02-29'), undefined);
      assert.equal(parseDateValue('2026-13-01'), undefined);
      assert.equal(parseDateValue(''), undefined);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  assert.equal(combineDateAndTime('2026-09-14', '23:57'), '2026-09-14T23:57');
  assert.equal(combineDateAndTime('', '23:57'), '');
});

test('date picker navigates months, commits a date, restores focus, and clears', async () => {
  const changes: string[] = [];
  const user = userEvent.setup({ document });
  render(React.createElement(Field, { onChange: next => changes.push(next) }));
  const trigger = screen.getByRole('button', { name: /^Effective To:/ });
  await user.click(trigger);
  assert.ok(screen.getByRole('dialog', { name: 'Effective To calendar' }));
  await user.click(screen.getByRole('button', { name: 'Go to the Next Month' }));
  await user.click(screen.getByRole('button', { name: /October 5th, 2026/ }));
  assert.equal(changes.at(-1), '2026-10-05');
  assert.equal(screen.queryByRole('dialog'), null);
  await waitFor(() => assert.equal(document.activeElement, trigger));
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Clear' }));
  assert.equal(changes.at(-1), '');
  assert.match(trigger.textContent!, /Pick a date/);
  assert.equal(document.querySelector('input[type="date"], input[type="datetime-local"]'), null);
});

test('calendar supports keyboard day selection and Escape dismissal without changing the value', async () => {
  const changes: string[] = [];
  const user = userEvent.setup({ document });
  render(React.createElement(Field, { onChange: next => changes.push(next) }));
  const trigger = screen.getByRole('button', { name: /^Effective To:/ });
  trigger.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => assert.match(document.activeElement?.getAttribute('aria-label') ?? '', /September 14th/));
  await user.keyboard('{ArrowRight}{Enter}');
  assert.equal(changes.at(-1), '2026-09-15');
  await user.click(trigger);
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(changes.length, 1);
});

test('calendar dismisses on outside click and does not submit its enclosing form', async () => {
  const user = userEvent.setup({ document });
  let submissions = 0;
  render(React.createElement('form', { onSubmit: (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); submissions++; } } as React.FormHTMLAttributes<HTMLFormElement>,
    React.createElement(Field), React.createElement('button', { type: 'button' }, 'Outside')));
  await user.click(screen.getByRole('button', { name: /^Effective To:/ }));
  await user.click(screen.getByRole('button', { name: /September 18th, 2026/ }));
  assert.equal(submissions, 0);
  await user.click(screen.getByRole('button', { name: /^Effective To:/ }));
  await user.click(screen.getByRole('button', { name: 'Outside' }));
  assert.equal(screen.queryByRole('dialog'), null);
});

test('service calendar preserves organization wall time and arbitrary minutes while editing and clearing', async () => {
  const user = userEvent.setup({ document });
  let last = '';
  function Schedule() {
    const [value, setValue] = useState('2026-09-15T00:37:00Z');
    return React.createElement(DateTimePicker, { value, timeZone: 'America/Vancouver', 'aria-label': 'Service window', onValueChange: next => { last = next; setValue(next); } });
  }
  render(React.createElement(Schedule));
  assert.match(screen.getByRole('button', { name: /^Service window date:/ }).textContent!, /Sep 14, 2026/);
  assert.match(screen.getByRole('combobox', { name: 'Service window time hours' }).textContent!, /17/);
  assert.match(screen.getByRole('combobox', { name: 'Service window time minutes' }).textContent!, /37/);
  await user.click(screen.getByRole('button', { name: /^Service window date:/ }));
  await user.click(screen.getByRole('button', { name: /September 16th, 2026/ }));
  assert.equal(last, '2026-09-16T17:37');
  await user.click(screen.getByRole('combobox', { name: 'Service window time hours' }));
  await user.click(screen.getByRole('option', { name: '18' }));
  assert.equal(last, '2026-09-16T18:37');
  await user.click(screen.getByRole('button', { name: /^Service window date:/ }));
  await user.click(screen.getByRole('button', { name: 'Clear' }));
  assert.equal(last, '');
  assert.ok((screen.getByRole('combobox', { name: 'Service window time hours' }) as HTMLButtonElement).disabled);
});

test('Monitor calendar uses real dates and shortcuts across year boundaries', async () => {
  const user = userEvent.setup({ document });
  let last = '';
  render(React.createElement(DatePicker, { value: '2026-12-31', today: '2026-12-31', 'aria-label': 'Dispatch date', onValueChange: next => { last = next; }, clearable: false, showTomorrow: true }));
  await user.click(screen.getByRole('button', { name: /^Dispatch date:/ }));
  assert.equal(screen.queryByRole('button', { name: 'Clear' }), null);
  await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
  assert.equal(last, '2027-01-01');
  await user.click(screen.getByRole('button', { name: /^Dispatch date:/ }));
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(last, '2026-12-31');
});

test('Monitor opens the shared calendar and closes adjacent search and notification popovers', async () => {
  const user = userEvent.setup({ document });
  const search: boolean[] = []; const notifications: boolean[] = [];
  function Monitor() {
    const [open, setOpen] = useState(false);
    return React.createElement(DateControl, { showCalendarPopover: open, setShowCalendarPopover: setOpen, setShowSearchPopover: next => search.push(next as boolean), setShowNotificationPopover: next => notifications.push(next as boolean), onActionNotification: () => {} });
  }
  render(React.createElement(Monitor));
  await user.click(screen.getByRole('button', { name: /^Dispatch date:/ }));
  assert.ok(screen.getByRole('dialog', { name: 'Dispatch date calendar' }));
  assert.deepEqual(search, [false]);
  assert.deepEqual(notifications, [false]);
});
