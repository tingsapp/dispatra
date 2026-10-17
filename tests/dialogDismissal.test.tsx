import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
}
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, within, cleanup, act } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { ConfirmDialogHost, confirmDialog } = await import('../src/components/ui/ConfirmDialog');
const { DialogHeader } = await import('../src/components/ui/Dialog');
const { NotificationDropdown, NotificationInbox } = await import('../src/portal/Notifications');
afterEach(cleanup);
after(() => dom.window.close());

test('confirmation X cancels without confirming and returns focus to the trigger', async () => {
  let result: Promise<boolean> | undefined;
  render(<><ConfirmDialogHost /><button onClick={() => { result = confirmDialog({ title: 'Delete record?', message: 'Confirm deletion.', confirmLabel: 'Delete', tone: 'danger' }); }}>Open</button></>);
  const user = userEvent.setup({ document });
  const trigger = screen.getByRole('button', { name: 'Open' });
  await user.click(trigger);
  const popup = screen.getByRole('alertdialog', { name: 'Delete record?' });
  const close = within(popup).getByRole('button', { name: 'Close dialog' });
  assert.equal(close.textContent, '');
  assert.ok(close.querySelector('svg'));
  assert.equal(document.activeElement, within(popup).getByRole('button', { name: 'Cancel' }));
  await user.click(close);
  assert.equal(await result, false);
  assert.equal(screen.queryByRole('alertdialog'), null);
  assert.equal(document.activeElement, trigger);
});

test('confirmation tab loop includes the X while explicit confirmation still resolves true', async () => {
  render(<ConfirmDialogHost />);
  const user = userEvent.setup({ document });
  let result: Promise<boolean>;
  await act(async () => { result = confirmDialog({ title: 'Proceed?', message: 'A decision.' }); });
  const close = screen.getByRole('button', { name: 'Close dialog' });
  await user.tab({ shift: true });
  assert.equal(document.activeElement, close);
  await user.tab({ shift: true });
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'Confirm' }));
  await user.tab();
  assert.equal(document.activeElement, close);
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  assert.equal(await result!, true);
});

test('informational notices use only the X, trap focus and dismiss with Escape', async () => {
  render(<ConfirmDialogHost />);
  const user = userEvent.setup({ document });
  let result: Promise<boolean>;
  await act(async () => { result = confirmDialog({ title: 'Unavailable', message: 'Try again later.', confirmLabel: null, cancelLabel: null }); });
  const popup = screen.getByRole('alertdialog', { name: 'Unavailable' });
  assert.equal(within(popup).getAllByRole('button').length, 1);
  const close = within(popup).getByRole('button', { name: 'Close dialog' });
  assert.equal(document.activeElement, close);
  await user.tab();
  assert.equal(document.activeElement, close);
  await user.tab({ shift: true });
  assert.equal(document.activeElement, close);
  await user.keyboard('{Escape}');
  assert.equal(await result!, false);
});

test('single-action notices retain their action and backdrop dismissal returns false', async () => {
  render(<ConfirmDialogHost />);
  const user = userEvent.setup({ document });
  let result: Promise<boolean>;
  await act(async () => { result = confirmDialog({ title: 'Connect first', message: 'Open integration.', confirmLabel: 'Open Integration', cancelLabel: null }); });
  assert.equal(screen.queryByRole('button', { name: 'Cancel' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Close' }), null);
  await user.click(screen.getByRole('button', { name: 'Open Integration' }));
  assert.equal(await result!, true);
  await act(async () => { result = confirmDialog({ title: 'Connect first', message: 'Open integration.', cancelLabel: null }); });
  await user.click(screen.getByRole('alertdialog').parentElement!);
  assert.equal(await result!, false);
});

test('shared header X respects pending locks and never submits its surrounding form', async () => {
  let closes = 0, submissions = 0;
  const view = (pending: boolean) => <form onSubmit={event => { event.preventDefault(); submissions++; }}><DialogHeader title="Edit record" closeDisabled={pending} onClose={() => closes++} /></form>;
  const { rerender } = render(view(true));
  const user = userEvent.setup({ document });
  const close = screen.getByRole('button', { name: 'Close dialog' });
  await user.click(close);
  assert.equal(closes, 0);
  rerender(view(false));
  await user.click(close);
  assert.equal(closes, 1);
  assert.equal(submissions, 0);
});

test('notification X closes the popup without reading or opening a notification', async () => {
  let reads = 0, opens = 0;
  render(<NotificationDropdown unread={1}>{close => <NotificationInbox rows={[]} unread={1} loading={false} loadError={null} readError={null} readingAll={false} onClose={close} onMarkAllRead={() => reads++} onOpen={() => opens++} />}</NotificationDropdown>);
  const user = userEvent.setup({ document });
  const trigger = screen.getByRole('button', { name: 'Notifications, 1 unread' });
  await user.click(trigger);
  const popup = screen.getByRole('dialog', { name: 'Notifications' });
  await user.click(within(popup).getByRole('button', { name: 'Close notifications' }));
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(reads, 0);
  assert.equal(opens, 0);
  assert.equal(document.activeElement, trigger);
});
