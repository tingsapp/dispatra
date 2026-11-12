import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { INITIAL_JOBS } from '../src/data/mockData';
import type { Job } from '../src/types';
import { companyDay, createdDay, ordersCompletedToday, todaysPlan } from '../src/components/monitor/todaysPlanData';

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
  assert.ok(within(list).getByText('New'));
  assert.ok(within(list).getByLabelText('Needs attention'));
  fireEvent.click(button);
  assert.equal(selected, job);
  assert.equal(screen.getAllByRole('list').length, 1);
  assert.equal(screen.getAllByRole('button').length, 4);
  assert.equal(screen.queryByRole('button', { name: 'Close matching orders' }), null);
  assert.equal(screen.getByRole('button', { name: /Active orders/ }).getAttribute('aria-expanded'), 'true');
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
  const toggle = () => screen.getByRole('button', { name: /Active orders/ });
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


test('an incoming order or draft focus request reopens a manually collapsed plan', () => {
  const props = { jobs: [], attentionIds: new Set<string>(), timeZone: zone, onRetry: () => {}, onSelectOrder: () => {} };
  const view = render(<TodaysPlan {...props} />);
  const toggle = () => screen.getByRole('button', { name: /Active orders/ });
  fireEvent.click(toggle());
  assert.equal(toggle().getAttribute('aria-expanded'), 'false');
  view.rerender(<TodaysPlan {...props} focusVersion={1} />);
  assert.equal(toggle().getAttribute('aria-expanded'), 'true');
});


test('sorts newest first without mutating the source and searches the filtered list', () => {
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
  assert.equal(screen.getAllByRole('tab').length, 6);
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
  assert.ok(within(row).getByText(`Due ${new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(`${today}T22:30:00Z`))}`));
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
  assert.match(label, new RegExp(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(deadline)));
  assert.notEqual(label, 'Due 15:30');
});


test('shows missing driver once when already conveyed by the status badge', () => {
  const today = companyDay(new Date(), zone);
  const job = { ...order('unassigned', 'NEW', `${today}T09:00`), driverName: undefined, status: 'no_driver' as const, statusLabel: 'No Driver' };
  render(<TodaysPlan jobs={[job]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  const row = within(screen.getByRole('list')).getByRole('button');
  assert.ok(within(row).getByText('New'));
  assert.equal(within(row).queryByText(/no driver/i), null);
  assert.ok(screen.getByText(/1 unassigned/));
});


test('tabs filter orders and Assign opens assignment without opening details', () => {
  const today = companyDay(new Date(), zone);
  const jobs = [order('new', 'NEW', `${today}T09:00`), { ...order('assigned', 'ASSIGNED', `${today}T09:00`), assignedDriverId: 'driver-1' }];
  let assigned: Job | undefined;
  render(<TodaysPlan jobs={jobs} attentionIds={new Set(['new'])} timeZone={zone} onRetry={() => {}} onSelectOrder={() => { throw new Error('Unexpected details'); }} onAssignOrder={job => { assigned = job; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assign #new' }));
  assert.equal(assigned, jobs[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Reassign #assigned' }));
  assert.equal(assigned, jobs[1]);
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['All', 'New', 'Assigned', 'In progress', 'Completed', 'At risk']);
  fireEvent.click(screen.getByRole('tab', { name: 'Assigned' }));
  assert.equal(within(screen.getByRole('list')).getAllByRole('listitem').length, 1);
  assert.equal(screen.queryByRole('button', { name: 'Assign #new' }), null);
  fireEvent.click(screen.getByRole('tab', { name: 'At risk' }));
  assert.ok(screen.getByRole('button', { name: 'Assign #new' }));
  fireEvent.click(screen.getByRole('tab', { name: 'New' }));
  assert.equal(within(screen.getByRole('list')).getAllByRole('listitem').length, 1);
  fireEvent.click(screen.getByRole('tab', { name: 'All' }));
  assert.equal(within(screen.getByRole('list')).getAllByRole('listitem').length, 2);
});

test('standalone assignment shows the driver panel without marker order details', async () => {
  const { JobDetailPopover } = await import('../src/components/JobDetailPopover');
  const today = companyDay(new Date(), zone);
  const job = order('standalone', 'NEW', `${today}T09:00`);
  render(<JobDetailPopover job={job} live assignmentOnly showAssignDriver showAiRecommendation={false}
    setShowAssignDriver={() => {}} setShowAiRecommendation={() => {}} onClose={() => {}}
    onApproveRecommendation={() => {}} onKeepCurrent={() => {}} onActionNotification={() => {}} />);
  assert.ok(screen.getByPlaceholderText('Search drivers...'));
  assert.equal(document.querySelector('[data-map-detail-overlay="job"]'), null);
  assert.ok(document.querySelector('[data-map-detail-overlay="assignment"]'));
  assert.ok(screen.getByRole('dialog', { name: 'Assign driver' }));
  assert.equal(document.querySelector('.app-dialog-backdrop'), null);
  assert.equal(screen.getByRole('dialog', { name: 'Assign driver' }).getAttribute('aria-modal'), 'false');
});


test('map button beneath visibility control focuses its order without opening details', () => {
  const today = companyDay(new Date(), zone);
  const job = order('locate', 'NEW', `${today}T09:00`);
  let located: Job | undefined;
  render(<TodaysPlan jobs={[job]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}}
    onOrderVisibilityChange={() => {}} hiddenOrderIds={new Set([job.id])}
    onSelectOrder={() => { throw new Error('Unexpected details'); }} onLocateOrder={value => { located = value; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Focus #locate on map' }));
  assert.equal(located, job);
});


test('warning button toggles warning details without opening the order', () => {
  const today = companyDay(new Date(), zone);
  const job = { ...order('warning', 'NEW', `${today}T09:00`), status: 'at_risk' as const, riskText: 'Delivery window may be missed' };
  render(<TodaysPlan jobs={[job]} attentionIds={new Set([job.id])} timeZone={zone} onRetry={() => {}}
    onSelectOrder={() => { throw new Error('Unexpected order dialog'); }} />);
  const warning = screen.getByRole('button', { name: 'Needs attention' });
  fireEvent.click(warning);
  assert.match(screen.getByRole('region', { name: 'Warnings for #warning' }).textContent!, /Delivery window may be missed/);
  fireEvent.click(warning);
  assert.equal(screen.queryByRole('region', { name: 'Warnings for #warning' }), null);
});

test('centered driver picker stages selection until submit and prevents duplicate submissions', async () => {
  const { JobDetailPopover } = await import('../src/components/JobDetailPopover');
  const { INITIAL_DRIVERS } = await import('../src/data/mockData');
  const { act } = await import('@testing-library/react');
  const driver = { ...INITIAL_DRIVERS[2], dutyStatus: 'ON_DUTY' as const, currentVehicleId: 'vehicle-test' };
  const job = order('assign-confirm', 'NEW', `${companyDay(new Date(), zone)}T09:00`);
  const assigned: string[] = [];
  let finish!: () => void;
  render(<JobDetailPopover job={job} drivers={[driver]} live assignmentOnly showAssignDriver showAiRecommendation={false}
    setShowAssignDriver={() => {}} setShowAiRecommendation={() => {}} onClose={() => {}}
    onApproveRecommendation={() => {}} onKeepCurrent={() => {}} onActionNotification={() => {}}
    onAssignDriver={id => { assigned.push(id); return new Promise<void>(resolve => { finish = resolve; }); }} />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(driver.name) }));
  assert.deepEqual(assigned, []);
  fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
  assert.deepEqual(assigned, [driver.id]);
  const pending = screen.getByRole('button', { name: 'Assigning…' }) as HTMLButtonElement;
  assert.equal(pending.disabled, true);
  fireEvent.click(pending);
  assert.equal(assigned.length, 1);
  await act(async () => { finish(); });
});

test('daily completions use company-local completion dates independently of creation dates', () => {
  const completed = (id: string, completedAt?: string) => ({
    ...order(id, 'COMPLETED', '2026-10-01T09:00'), completedAt,
  });
  const jobs = [
    completed('earlier-created', '2026-10-28T01:00:00Z'),
    completed('yesterday', '2026-10-27T01:00:00Z'),
    completed('tomorrow', '2026-10-28T12:00:00Z'),
    completed('missing'), completed('invalid', 'invalid'),
    { ...completed('reopened', '2026-10-28T01:00:00Z'), lifecycleStatus: 'IN_PROGRESS' as const },
  ];
  assert.deepEqual(ordersCompletedToday(jobs, '2026-10-27', zone).map(job => job.id), ['earlier-created']);
});


test('In progress tab shows only started orders and keeps search filtering', () => {
  const today = companyDay(new Date(), zone);
  const moving = order('moving-filter', 'IN_PROGRESS', `${today}T09:00`);
  const assigned = order('assigned-filter', 'ASSIGNED', `${today}T09:00`);
  render(<TodaysPlan jobs={[moving, assigned]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'In progress' }));
  const list = screen.getByRole('list', { name: 'Orders created today' });
  assert.equal(within(list).getAllByRole('listitem').length, 1);
  assert.ok(within(list).getByText('#moving-filter'));
  assert.equal(within(list).queryByText('#assigned-filter'), null);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search today’s orders' }), { target: { value: 'no match' } });
  assert.ok(screen.getByText('No matching orders found.'));
});


test('Completed tab shows only completed orders', () => {
  const today = companyDay(new Date(), zone);
  const done = order('done-filter', 'COMPLETED', `${today}T09:00`);
  const moving = order('moving-filter', 'IN_PROGRESS', `${today}T09:00`);
  render(<TodaysPlan jobs={[done, moving]} attentionIds={new Set()} timeZone={zone} onRetry={() => {}} onSelectOrder={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Completed' }));
  const list = screen.getByRole('list', { name: 'Orders created today' });
  assert.equal(within(list).getAllByRole('listitem').length, 1);
  assert.ok(within(list).getByText('#done-filter'));
  assert.equal(within(list).queryByText('#moving-filter'), null);
});
