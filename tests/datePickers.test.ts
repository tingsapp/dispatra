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
const { TimePicker } = await import('../src/components/ui/TimePicker');
const { MonitorActions } = await import('../src/components/MonitorActions');
const { OrderDateFilter } = await import('../src/components/orders/OrderDateFilter');
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
  await user.click(screen.getByRole('combobox', { name: 'Service window time minutes' }));
  assert.equal(screen.getByRole('option', { name: '37' }).getAttribute('aria-selected'), 'true');
  await user.click(screen.getByRole('option', { name: '45' }));
  assert.equal(last, '2026-09-16T18:45');
  await user.click(screen.getByRole('combobox', { name: 'Service window time minutes' }));
  assert.deepEqual(screen.getAllByRole('option').map(option => option.textContent), ['00', '15', '30', '45', '59']);
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: /^Service window date:/ }));
  await user.click(screen.getByRole('button', { name: 'Clear' }));
  assert.equal(last, '');
  assert.ok((screen.getByRole('combobox', { name: 'Service window time hours' }) as HTMLButtonElement).disabled);
});

test('new booking picker blocks past dates and minutes while leaving future times selectable', async () => {
  const user = userEvent.setup({ document });
  let selected = '';
  function BookingTime() {
    const [value, setValue] = useState('');
    return React.createElement(DateTimePicker, { value, timeZone: 'UTC', currentTime: new Date('2026-09-14T17:25:40Z'), futureOnly: true,
      'aria-label': 'Pickup', onValueChange: next => { selected = next; setValue(next); } });
  }
  render(React.createElement(BookingTime));
  await user.click(screen.getByRole('button', { name: 'Pickup date: Pick a date' }));
  assert.equal((screen.getByRole('button', { name: /September 13th, 2026/ }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(selected, '2026-09-14T17:30');
  await user.click(screen.getByRole('combobox', { name: 'Pickup time minutes' }));
  assert.equal(screen.getByRole('option', { name: '15' }).getAttribute('aria-disabled'), 'true');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('combobox', { name: 'Pickup time hours' }));
  assert.equal(screen.getByRole('option', { name: '16' }).getAttribute('aria-disabled'), 'true');
  await user.click(screen.getByRole('option', { name: '18' }));
  assert.equal(selected, '2026-09-14T18:30');
  await user.click(screen.getByRole('combobox', { name: 'Pickup time minutes' }));
  assert.equal(screen.getByRole('option', { name: '15' }).getAttribute('aria-disabled'), null);
  await user.click(screen.getByRole('option', { name: '15' }));
  assert.equal(selected, '2026-09-14T18:15');
});

test('drop-off picker allows the pickup day from the following minute and blocks older dates', async () => {
  const user = userEvent.setup({ document });
  let selected = '';
  function DropoffTime() {
    const [value, setValue] = useState('');
    return React.createElement(DateTimePicker, { value, timeZone: 'UTC', currentTime: new Date('2026-09-14T08:00:00Z'), futureOnly: true,
      after: '2026-09-16T15:45', 'aria-label': 'Drop-off', onValueChange: next => { selected = next; setValue(next); } });
  }
  render(React.createElement(DropoffTime));
  await user.click(screen.getByRole('button', { name: 'Drop-off date: Pick a date' }));
  assert.equal((screen.getByRole('button', { name: /September 15th, 2026/ }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole('button', { name: 'Today' }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: /September 16th, 2026/ }));
  assert.equal(selected, '2026-09-16T15:59');
  await user.click(screen.getByRole('combobox', { name: 'Drop-off time hours' }));
  assert.equal(screen.getByRole('option', { name: '14' }).getAttribute('aria-disabled'), 'true');
  await user.click(screen.getByRole('option', { name: '15' }));
  await user.click(screen.getByRole('combobox', { name: 'Drop-off time minutes' }));
  assert.equal(screen.getByRole('option', { name: '45' }).getAttribute('aria-disabled'), 'true');
});

test('time picker offers five minutes with keyboard selection and retains the last minute of the day', async () => {
  const user = userEvent.setup({ document });
  let selected = '';
  render(React.createElement(TimePicker, { value: '23:45', 'aria-label': 'Time', onValueChange: next => { selected = next; } }));
  screen.getByRole('combobox', { name: 'Time minutes' }).focus();
  await user.keyboard('{Enter}');
  assert.deepEqual(screen.getAllByRole('option').map(option => option.textContent), ['00', '15', '30', '45', '59']);
  await user.keyboard('{End}{Enter}');
  assert.equal(selected, '23:59');
});

test('booking defaults advance to midnight after the last minute of the day', async () => {
  const user = userEvent.setup({ document });
  let selected = '';
  render(React.createElement(DateTimePicker, { value: '', timeZone: 'UTC', currentTime: new Date('2026-09-14T23:59:40Z'),
    futureOnly: true, 'aria-label': 'Late pickup', onValueChange: next => { selected = next; } }));
  await user.click(screen.getByRole('button', { name: 'Late pickup date: Pick a date' }));
  assert.equal((screen.getByRole('button', { name: 'Today' }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: /September 15th, 2026/ }));
  assert.equal(selected, '2026-09-15T00:00');
});

test('shared calendar uses real dates and shortcuts across year boundaries', async () => {
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

test('Orders date menu supports shortcuts and a selected inclusive range', async () => {
  const user = userEvent.setup({ document });
  const changes: unknown[] = [];
  function Filter() {
    const [value, setValue] = useState<import('../src/components/orders/OrderDateFilter').OrderDateSelection>({ kind: 'all' });
    return React.createElement(OrderDateFilter, { value, today: '2026-12-31', onValueChange: next => { changes.push(next); setValue(next); } });
  }
  render(React.createElement(Filter));
  const trigger = screen.getByRole('button', { name: /^Filter orders by date:/ });
  await user.click(trigger);
  assert.deepEqual(Array.from(screen.getByRole('dialog', { name: 'Order date filter' }).querySelectorAll('button')).map(button => button.textContent?.trim()), ['Today', 'Tomorrow', 'All dates', 'Date range']);
  await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
  assert.deepEqual(changes.at(-1), { kind: 'day', date: '2027-01-01' });
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Date range' }));
  assert.equal((screen.getByRole('button', { name: 'Apply range' }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: /December 30th, 2026/ }));
  await user.click(screen.getByRole('button', { name: /December 31st, 2026/ }));
  await user.click(screen.getByRole('button', { name: 'Apply range' }));
  assert.deepEqual(changes.at(-1), { kind: 'range', from: '2026-12-30', to: '2026-12-31' });
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'All dates' }));
  assert.deepEqual(changes.at(-1), { kind: 'all' });
});

test('Monitor corner keeps notifications without search or a date menu', async () => {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  render(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } }) }, React.createElement(MonitorActions, { onActionNotification: () => {} })));
  assert.equal(screen.queryByRole('button', { name: /^Dispatch date:/ }), null);
  assert.equal(screen.queryByTitle('Search orders, drivers, vehicles or addresses'), null);
  assert.ok(screen.getByTitle('Dispatch alerts and notifications'));
});

test('an open calendar keeps day buttons mounted when its form rerenders', async () => {
  const user = userEvent.setup({ document });
  const props = { value: '', today: '2026-11-04', 'aria-label': 'Pickup', onValueChange: (_: string) => {} };
  const view = render(React.createElement(DatePicker, props));
  await user.click(screen.getByRole('button', { name: /^Pickup:/ }));
  const day = screen.getByRole('button', { name: /November 12th, 2026/ });
  await user.hover(day);
  view.rerender(React.createElement(DatePicker, { ...props }));
  assert.ok(screen.getByRole('button', { name: /November 12th, 2026/ }) === day, 'rerender must preserve the hovered day button');
  await user.click(day);
  assert.equal(screen.queryByRole('dialog'), null);
});
