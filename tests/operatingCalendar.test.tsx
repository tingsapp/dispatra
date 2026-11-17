import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useState } from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { WorkHoursSettings } = await import('../src/components/settings/WorkHoursSettings');
const { HolidaySettings } = await import('../src/components/settings/HolidaySettings');
const { OrderPricingForm } = await import('../src/components/pricing/OrderPricingForm');
const { loadPricingContext, createDefaultOrderInput, priceOrder } = await import('../src/lib/orderPricing');
const { DEFAULT_WORK_HOURS, workHoursError, todayIn, sortHolidays, closedReason } = await import('../src/lib/operatingCalendar');
type WorkDay = typeof DEFAULT_WORK_HOURS[number];
const OFFICE: WorkDay[] = DEFAULT_WORK_HOURS.map(d => ({ ...d, open: d.day !== 'SAT' && d.day !== 'SUN', start: '08:00', end: '17:00' }));
afterEach(() => cleanup());

test('open days must end after they start; unconfigured hours are 06:00–19:00 daily', () => {
  assert.ok(DEFAULT_WORK_HOURS.every(d => d.open && d.start === '06:00' && d.end === '19:00'));
  assert.equal(workHoursError(OFFICE), undefined);
  assert.equal(workHoursError(OFFICE.map(d => d.day === 'TUE' ? { ...d, end: '08:00' } : d)), 'Tuesday hours must end after they start.');
  // Closed days keep their saved times without blocking the save.
  assert.equal(workHoursError(OFFICE.map(d => d.day === 'SUN' ? { ...d, end: '01:00' } : d)), undefined);
  assert.equal(todayIn('America/Vancouver', new Date('2026-12-25T07:30:00Z')), '2026-12-24');
});

test('closedReason mirrors the API for form wall times and saved instants', () => {
  const holidays = [{ date: '2026-12-25', name: 'Christmas Day' }];
  const zone = 'America/Vancouver';
  assert.equal(closedReason('2026-12-25T10:00', zone, OFFICE, holidays), 'Closed on Christmas Day (Dec 25).');
  assert.equal(closedReason('2026-11-21T10:00', zone, OFFICE, holidays), 'Closed on Saturdays.');
  assert.equal(closedReason('2026-11-23T07:59', zone, OFFICE), 'Monday pickups are 08:00–17:00.');
  assert.equal(closedReason('2026-11-23T17:00', zone, OFFICE), 'Monday pickups are 08:00–17:00.');
  assert.equal(closedReason('2026-11-23T08:00', zone, OFFICE), undefined);
  // 16:30 UTC is 08:30 Monday in Vancouver; 03:00 UTC Tuesday is 19:00 Monday.
  assert.equal(closedReason('2026-11-23T16:30:00Z', zone, OFFICE), undefined);
  assert.equal(closedReason('2026-11-24T03:00:00.000Z', zone, OFFICE), 'Monday pickups are 08:00–17:00.');
  for (const at of ['2026-11-22T06:00', '2026-11-22T18:59', '2026-12-25T12:00']) assert.equal(closedReason(at, zone), undefined);
  assert.equal(closedReason('2026-11-22T19:00', zone), 'Sunday pickups are 06:00–19:00.');
  assert.equal(closedReason('2026-11-22T23:59', zone, DEFAULT_WORK_HOURS.map(d => ({ ...d, end: '23:59' }))), undefined);
});

test('toggling a day opens its hours and closing shows 24:00 for end of day', async () => {
  const seen: WorkDay[][] = [];
  function Host() { const [days, setDays] = useState(OFFICE); return <WorkHoursSettings days={days} timeZone="America/Vancouver" onChange={next => { seen.push(next); setDays(next); }} />; }
  render(<Host />);
  const user = userEvent.setup({ document });
  assert.ok(screen.getByText('When pickups can be booked, in Vancouver time.'));
  assert.equal(screen.queryByRole('button', { name: /Copy Monday/ }), null);
  await user.click(screen.getByRole('switch', { name: 'Open on Saturday' }));
  assert.equal(seen.at(-1)![5].open, true);
  await user.click(screen.getByRole('combobox', { name: 'Saturday closes' }));
  await user.click(screen.getByRole('option', { name: '24:00' }));
  assert.equal(seen.at(-1)![5].end, '23:59');
  await user.click(screen.getByRole('switch', { name: 'Open on Monday' }));
  assert.equal(seen.at(-1)![0].open, false);
  assert.equal(screen.queryByRole('combobox', { name: 'Monday opens' }), null);
});

test('holidays sort by date, mark past dates, need a date and name, and can be removed', async () => {
  const today = todayIn('America/Vancouver');
  const year = Number(today.slice(0, 4));
  const past = { date: `${year - 1}-01-01`, name: 'New Year’s Day' }, future = { date: `${year + 1}-12-25`, name: 'Christmas Day' };
  assert.deepEqual(sortHolidays([future, past]), [past, future]);
  let saved = [past, future];
  function Host() { const [rows, setRows] = useState(saved); return <HolidaySettings holidays={rows} timeZone="America/Vancouver" onChange={next => { saved = next; setRows(next); }} />; }
  render(<Host />);
  const user = userEvent.setup({ document });
  assert.ok(screen.getByText(/1 upcoming\./));
  const rows = within(screen.getByRole('table', { name: 'Holidays' })).getAllByRole('row').slice(1);
  assert.match(rows[0].textContent!, /New Year’s Day\s*Past/);
  assert.match(rows[1].textContent!, /Christmas Day$/);
  await user.type(screen.getByLabelText('Name'), 'Boxing Day');
  assert.equal(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled'), true);
  await user.click(screen.getByRole('button', { name: 'Remove New Year’s Day' }));
  assert.deepEqual(saved, [future]);
  assert.ok(screen.getByText(/1 upcoming\./));
});

test('the order form blocks Shippers and warns dispatchers when the pickup is outside work hours', () => {
  const base = loadPricingContext();
  const ctx = { ...base, billing: { ...base.billing, general: { ...base.billing.general, timeZone: 'America/Vancouver', workHours: OFFICE, holidays: [] } } };
  const input = createDefaultOrderInput(ctx);
  const at = '2099-11-23T19:00'; // A Monday evening.
  const value = { ...input, scheduledAt: at, stops: input.stops.map(stop => stop.type === 'PICKUP' ? { ...stop, windowStart: at } : stop) };
  const form = (outsideHours?: 'block' | 'warn') => <OrderPricingForm value={value} onChange={() => {}} ctx={ctx} snapshot={priceOrder(value, ctx)} showStopAddresses outsideHours={outsideHours} />;
  const view = render(form('block'));
  assert.equal(screen.getByRole('alert').textContent, "Monday pickups are 08:00–17:00. Choose a time when we're open.");
  view.rerender(form('warn'));
  assert.match(screen.getByRole('status').textContent!, /^Outside work hours\. Monday pickups are 08:00–17:00\. You can still save/);
  view.rerender(form());
  assert.equal(screen.queryByText(/Monday pickups/), null);
});
