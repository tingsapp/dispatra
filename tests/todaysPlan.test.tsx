import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { INITIAL_JOBS } from '../src/data/mockData';
import type { Job } from '../src/types';
import { companyDay, createdDay, todaysPlan } from '../src/components/monitor/todaysPlan';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup, fireEvent, within } = await import('@testing-library/react');
const { TodaysPlan } = await import('../src/components/monitor/TodaysPlan');
afterEach(cleanup);
after(() => dom.window.close());
const zone = 'America/Vancouver';
const order = (id: string, lifecycleStatus: Job['lifecycleStatus'], schedule: string): Job => ({
  ...INITIAL_JOBS[0], id, jobNumber: `#${id}`, lifecycleStatus, status: 'on_time', assignedDriverId: undefined,
  pricing: undefined, pricingInput: undefined, scheduledTime: schedule, createdAt: `${schedule.slice(0, 10)}T12:00:00-07:00`,
});

test('uses company-local creation dates regardless of schedule and excludes missing timestamps and cancellations', () => {
  const today = '2026-10-27';
  const jobs = [order('new', 'NEW', '2026-11-01T09:00'), order('assigned', 'ASSIGNED', '2026-10-27T09:00'),
    order('moving', 'IN_PROGRESS', '2026-10-27T10:00'), order('done', 'COMPLETED', '2026-10-27T11:00'),
    order('cancelled', 'CANCELLED', '2026-10-27T11:00'), order('tomorrow', 'NEW', '2026-10-27T09:00'),
    order('yesterday', 'NEW', '2026-10-27T09:00'), order('missing', 'NEW', '2026-10-27T09:00'),
    order('invalid', 'NEW', '2026-10-27T09:00')];
  jobs[0].createdAt = '2026-10-28T01:00:00Z'; // Still Oct 27 in Vancouver, scheduled next month.
  jobs[5].createdAt = '2026-10-28T12:00:00Z';
  jobs[6].createdAt = '2026-10-27T01:00:00Z'; // Oct 26 in Vancouver, scheduled today.
  jobs[7].createdAt = undefined;
  jobs[8].createdAt = 'invalid';
  const groups = todaysPlan(jobs, today, zone, new Set(['assigned', 'moving', 'done', 'tomorrow']));
  assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.map(row => row.id)])), {
    all: ['new', 'assigned', 'done', 'moving'], unassigned: ['new'], assigned: ['assigned'],
    in_progress: ['moving'], completed: ['done'], attention: ['assigned', 'moving'],
  });
  assert.equal(createdDay(jobs[0], zone), today);
  assert.equal(createdDay(jobs[7], zone), undefined);
  assert.equal(createdDay(jobs[8], zone), undefined);
});

test('attention counts an order once even when API and local flags overlap', () => {
  const job = { ...order('risk', 'NEW', '2026-10-27T09:00'), status: 'at_risk' as const };
  assert.equal(todaysPlan([job], '2026-10-27', zone, new Set([job.id])).attention.length, 1);
});

test('shows one direct order list with status and customer; a click opens details without expansion', () => {
  const today = companyDay(new Date(), zone);
  const job = order('completed', 'COMPLETED', `${today}T09:00`);
  const unassigned = order('new', 'NEW', `${today}T09:00`);
  let selected: Job | undefined;
  render(<TodaysPlan jobs={[job, unassigned]} attentionIds={new Set([unassigned.id])} timeZone={zone} onRetry={() => {}} onSelectOrder={value => { selected = value; }} />);
  const list = screen.getByRole('list', { name: 'Orders created today' });
  assert.equal(within(list).getAllByRole('listitem').length, 2);
  const button = within(list).getByRole('button', { name: /#completed/ });
  assert.ok(within(button).getByText('Completed'));
  assert.ok(within(button).getByText(job.customerName));
  assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
  assert.ok(within(list).getByText(unassigned.statusLabel));
  assert.ok(within(list).getByLabelText('Needs attention'));
  fireEvent.click(button);
  assert.equal(selected, job);
  assert.equal(screen.getAllByRole('list').length, 1);
  assert.equal(screen.getAllByRole('button').length, 3);
  assert.equal(screen.queryByRole('button', { name: 'Close matching orders' }), null);
  assert.equal(screen.getByRole('button', { name: /Today’s plan/ }).getAttribute('aria-expanded'), 'true');
});

test('loading and failure never present misleading zero counts; retry works', () => {
  let retries = 0;
  const props = { jobs: [], attentionIds: new Set<string>(), timeZone: zone, onRetry: () => { retries++; }, onSelectOrder: () => {} };
  const view = render(<TodaysPlan {...props} loading />);
  assert.ok(screen.getByRole('status'));
  assert.equal(screen.queryByRole('button', { name: 'Orders today: 0' }), null);
  view.rerender(<TodaysPlan {...props} error />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  assert.equal(retries, 1);
  assert.ok(screen.getByRole('alert'));
});

test('empty day shows a clear message without zero status rows', () => {
  render(<TodaysPlan jobs={[]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  assert.ok(screen.getByText('No orders created today.'));
  assert.equal(screen.queryByRole('list', { name: 'Orders created today' }), null);
  assert.equal(screen.queryAllByRole('button').length, 1);
});


test('collapses for chat, restores afterward, and respects intentional hiding', () => {
  let closed = 0;
  const props = { jobs: [], attentionIds: new Set<string>(), timeZone: zone, onRetry: () => {}, onSelectOrder: () => {}, onCloseChat: () => { closed++; } };
  const view = render(<TodaysPlan {...props} />);
  const toggle = () => screen.getByRole('button', { name: /Today’s plan/ });
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  view.rerender(<TodaysPlan {...props} chatOpen />);
  assert.equal(toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(screen.queryByText('No orders created today.'), null);
  fireEvent.click(toggle());
  assert.equal(closed, 1);
  view.rerender(<TodaysPlan {...props} />);
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
  fireEvent.click(toggle());
  view.rerender(<TodaysPlan {...props} chatOpen />);
  view.rerender(<TodaysPlan {...props} />);
  assert.equal(toggle().getAttribute('aria-expanded'), 'false');
  fireEvent.click(toggle());
  assert.ok(screen.getByText('No orders created today.'));
});


test('sorts newest first without mutating the source and searches one list without tabs', () => {
  const today = companyDay(new Date(), zone);
  const older = order('older', 'NEW', `${today}T09:00`);
  const newer = order('newer', 'NEW', `${today}T09:00`);
  older.createdAt = `${today}T08:00:00-07:00`;
  newer.createdAt = `${today}T10:00:00-07:00`;
  const jobs = [older, newer];
  assert.deepEqual(todaysPlan(jobs, today, zone, new Set()).all.map(j => j.id), ['newer', 'older']);
  assert.deepEqual(jobs.map(j => j.id), ['older', 'newer']);
  render(<TodaysPlan jobs={jobs} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  const list = screen.getByRole('list', { name: 'Orders created today' });
  assert.match(within(list).getAllByRole('listitem')[0].textContent!, /#newer/);
  assert.equal(screen.queryByRole('tab'), null);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search today’s orders' }), { target: { value: '#older' } });
  assert.equal(within(list).getAllByRole('listitem').length, 1);
  assert.equal(within(list).queryByText('#newer'), null);
});


test('shows saved delivery deadline, current driver, destination and customer without fabricating ETA', () => {
  const today = companyDay(new Date(), zone);
  const job = order('delivery', 'ASSIGNED', `${today}T09:00`);
  job.assignedDriverId = 'driver-1';
  job.pricingInput = { stops: [{ id: 'drop', type: 'DROPOFF', windowEnd: `${today}T22:30:00Z` }] } as Job['pricingInput'];
  const drivers = [{ id: 'driver-1', name: 'Ahmed' }] as import('../src/types').Driver[];
  render(<TodaysPlan jobs={[job]} drivers={drivers} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  const row = within(screen.getByRole('list')).getByRole('button');
  assert.ok(within(row).getByText('Due 15:30'));
  assert.ok(within(row).getByText('Driver: Ahmed'));
  assert.ok(row.textContent?.includes(job.dropoffAddress));
  assert.ok(within(row).getByText(job.customerName));
  assert.equal(within(row).queryByText(/ETA/), null);
});

test('labels schedule fallback and missing driver and time honestly', () => {
  const today = companyDay(new Date(), zone);
  const job = order('schedule', 'NEW', `${today}T09:00`);
  job.driverName = undefined;
  const props = { jobs: [job], attentionIds: new Set<string>(), timeZone: zone, onRetry: () => {}, onSelectOrder: () => {} };
  const view = render(<TodaysPlan {...props} />);
  assert.ok(screen.getByText(/Scheduled /));
  assert.ok(screen.getByText('No driver'));
  view.rerender(<TodaysPlan {...props} jobs={[{...job, scheduledTime: ''}]} />);
  assert.ok(screen.getByText('Delivery time not set'));
});


test('retains delivery dates for other days and compares today in company timezone', () => {
  const today = companyDay(new Date(), zone);
  const job = order('dates', 'NEW', `${today}T09:00`);
  const deadline = new Date(`${today}T22:30:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 1);
  job.pricingInput = { stops: [{ id: 'drop', type: 'DROPOFF', windowEnd: deadline.toISOString() }] } as Job['pricingInput'];
  render(<TodaysPlan jobs={[job]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  const label = screen.getByText(/^Due /).textContent!;
  assert.match(label, /15:30/);
  assert.notEqual(label, 'Due 15:30');
});


test('shows missing driver once when already conveyed by the status badge', () => {
  const today = companyDay(new Date(), zone);
  const job = { ...order('unassigned', 'NEW', `${today}T09:00`), driverName: undefined, status: 'no_driver' as const, statusLabel: 'No Driver' };
  render(<TodaysPlan jobs={[job]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  const row = within(screen.getByRole('list')).getByRole('button');
  assert.equal(within(row).getAllByText(/no driver/i).length, 1);
  assert.ok(screen.getByText(/1 unassigned/));
});
