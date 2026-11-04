import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
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

test('submission feedback stays inside the topmost popup and can be dismissed', async () => {
  const { Dialog } = await import('../src/components/ui/Dialog');
  const { showPopupFeedback } = await import('../src/components/ui/popupFeedback');
  render(<><Dialog onClose={() => {}}>Parent form</Dialog><Dialog onClose={() => {}}>Child form</Dialog></>);
  await act(async () => { assert.equal(showPopupFeedback('Assignment saved.'), true); });
  const message = screen.getByRole('status');
  assert.equal(message.textContent, 'Assignment saved.');
  assert.ok(message.closest('[data-popup-feedback]')?.textContent?.includes('Child form'));
  await userEvent.setup({ document }).click(screen.getByRole('button', { name: 'Dismiss message' }));
  assert.equal(screen.queryByRole('status'), null);
  cleanup();
  assert.equal(showPopupFeedback('Page feedback'), false);
});

test('driver selection is pending until Confirm and closing discards it', async () => {
  const { OrderDetailsDialog } = await import('../src/components/orders/OrderDetailsDialog');
  const { INITIAL_JOBS, INITIAL_DRIVERS } = await import('../src/data/mockData');
  const { loadPricingContext } = await import('../src/lib/orderPricing');
  const calls: string[] = [];
  const props = { job: { ...INITIAL_JOBS[0], assignedDriverId: undefined }, ctx: loadPricingContext(), drivers: INITIAL_DRIVERS,
    onClose: () => {}, onReassign: async (_job: unknown, driver: string) => { calls.push(driver); } };
  const view = render(<OrderDetailsDialog {...props} />);
  const user = userEvent.setup({ document });
  assert.equal((screen.getByRole('button', { name: /^Confirm$/ }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('combobox', { name: 'Reassign driver' }));
  await user.click(screen.getByRole('option', { name: new RegExp(INITIAL_DRIVERS[0].name) }));
  assert.deepEqual(calls, []);
  view.unmount();
  render(<OrderDetailsDialog {...props} />);
  assert.equal((screen.getByRole('button', { name: /^Confirm$/ }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('combobox', { name: 'Reassign driver' }));
  await user.click(screen.getByRole('option', { name: new RegExp(INITIAL_DRIVERS[0].name) }));
  await user.click(screen.getByRole('button', { name: /^Confirm$/ }));
  assert.deepEqual(calls, [INITIAL_DRIVERS[0].id]);
});

test('assignment errors render as red inline alerts', async () => {
  const { Dialog } = await import('../src/components/ui/Dialog');
  const { showPopupFeedback } = await import('../src/components/ui/popupFeedback');
  render(<Dialog onClose={() => {}}>Assign driver</Dialog>);
  await act(async () => { showPopupFeedback('TomTom routing credits are exhausted.', 'error'); });
  const alert = screen.getByRole('alert');
  assert.ok(alert.classList.contains('text-red-700'));
  assert.ok(alert.classList.contains('bg-red-50'));
});

for (const lifecycleStatus of ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
  test(`${lifecycleStatus} order details keep the saved driver read-only`, async () => {
    const { OrderDetailsDialog } = await import('../src/components/orders/OrderDetailsDialog');
    const { INITIAL_JOBS, INITIAL_DRIVERS } = await import('../src/data/mockData');
    const { loadPricingContext } = await import('../src/lib/orderPricing');
    render(<OrderDetailsDialog job={{ ...INITIAL_JOBS[0], lifecycleStatus, assignedDriverId: INITIAL_DRIVERS[0].id }} ctx={loadPricingContext()} drivers={INITIAL_DRIVERS} onClose={() => {}} onReassign={() => { throw new Error('Closed order reassigned'); }} onEdit={() => {}} onComplete={() => {}} />);
    assert.equal(screen.queryByRole('combobox', { name: 'Reassign driver' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Confirm' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Edit order' }), null);
    if (lifecycleStatus !== 'IN_PROGRESS') assert.equal(screen.queryByRole('button', { name: 'Complete order' }), null);
    assert.ok(screen.getByText(INITIAL_DRIVERS[0].name));
  });
}

test('an order that completes while driver selection is staged loses its mutation controls', async () => {
  const { OrderDetailsDialog } = await import('../src/components/orders/OrderDetailsDialog');
  const { INITIAL_JOBS, INITIAL_DRIVERS } = await import('../src/data/mockData');
  const { loadPricingContext } = await import('../src/lib/orderPricing');
  let calls = 0;
  const job = { ...INITIAL_JOBS[0], lifecycleStatus: 'ASSIGNED' as const, assignedDriverId: INITIAL_DRIVERS[0].id };
  const props = { job, ctx: loadPricingContext(), drivers: INITIAL_DRIVERS, onClose: () => {}, onReassign: () => { calls++; } };
  const view = render(<OrderDetailsDialog {...props} />);
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole('combobox', { name: 'Reassign driver' }));
  await user.click(screen.getByRole('option', { name: /Unassigned/ }));
  assert.equal((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled, false);
  view.rerender(<OrderDetailsDialog {...props} job={{ ...job, lifecycleStatus: 'COMPLETED' }} />);
  assert.equal(screen.queryByRole('button', { name: 'Confirm' }), null);
  assert.equal(calls, 0);
});
