import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { JobsPage } = await import('../src/pages/JobsPage');
const { DriversPage } = await import('../src/pages/DriversPage');
const { CustomersPage } = await import('../src/pages/CustomersPage');
const { VehiclesPage } = await import('../src/pages/VehiclesPage');
const { INITIAL_DRIVERS, INITIAL_JOBS } = await import('../src/data/mockData');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { formatDateValue } = await import('../src/lib/dateValues');
const { loadCustomers } = await import('../src/lib/customerStorage');
const noop = () => {};
afterEach(() => { cleanup(); localStorage.clear(); });
const scenarios = [
  { name: 'Orders', view: () => React.createElement(JobsPage, { jobs: INITIAL_JOBS, drivers: INITIAL_DRIVERS, onSelectJob: noop, onUpdateJob: noop, onCreateJob: noop, onNotification: noop }), total: () => INITIAL_JOBS.length },
  { name: 'Drivers', view: () => React.createElement(DriversPage, { jobs: INITIAL_JOBS, drivers: INITIAL_DRIVERS, onSelectDriver: noop, onCreateDriver: noop, onUpdateDriver: noop, onNotification: noop }), total: () => INITIAL_DRIVERS.length },
  { name: 'Shippers', view: () => React.createElement(CustomersPage, { jobs: INITIAL_JOBS, onBackToMonitor: noop }), total: () => loadCustomers().length },
  { name: 'Vehicles', view: () => React.createElement(VehiclesPage, { drivers: INITIAL_DRIVERS, onNotification: noop }), total: () => loadVehicles().length },
];
for (const scenario of scenarios) test(`${scenario.name} summary stays accurate while search filters and restores the table`, async () => {
  const user = userEvent.setup({ document });
  const total = scenario.total();
  render(scenario.view());
  const summary = screen.getByLabelText(`${scenario.name} summary`);
  assert.equal(summary.tagName, 'DL');
  assert.equal(within(summary).getByText('Total').closest('dt')!.nextElementSibling!.textContent, total.toLocaleString());
  const totals = summary.textContent;
  const rowCount = screen.getByRole('table', { name: scenario.name }).querySelectorAll('tbody tr').length;
  assert.ok(rowCount > 0);
  const search = screen.getByRole('searchbox');
  await user.type(search, 'zz-no-matching-record-987');
  assert.equal(summary.textContent, totals);
  assert.ok((screen.queryByRole('table', { name: scenario.name })?.querySelectorAll('tbody tr').length ?? 0) < rowCount);
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  assert.equal(screen.getByRole('table', { name: scenario.name }).querySelectorAll('tbody tr').length, rowCount);
  assert.equal(summary.textContent, totals);
});

test('Analytics date menu updates figures, audit rows and CSV together', async () => {
  const { ReportsPage } = await import('../src/pages/ReportsPage');
  const { AUDIT_LOG_ITEMS } = await import('../src/lib/reportStorage');
  const user = userEvent.setup({ document });
  const notices: string[] = [];
  render(React.createElement(ReportsPage, { onNotification: message => notices.push(message), today: '2026-09-09' }));
  const summary = screen.getByLabelText('Analytics summary');
  const before = summary.textContent;
  for (const value of ['71.4%', '31.6 min', '$1,425']) assert.ok(within(summary).getByText(value));
  assert.equal(within(summary).getByText('Dispatches completed').closest('dt')!.nextElementSibling!.textContent, '7');
  assert.ok(screen.getByText('Peak: 09:00 (1 jobs)'));
  assert.ok(screen.getByText('Sep 9'));
  assert.equal(within(screen.getByLabelText('Accessorial summary')).getByText('Liftgate services').closest('dt')!.nextElementSibling!.textContent, '2');
  const table = screen.getByRole('table', { name: 'Analytics audit log' });
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.length);
  await user.type(screen.getByRole('searchbox'), AUDIT_LOG_ITEMS[0].jobNumber);
  assert.equal(table.querySelectorAll('tbody tr').length, 1);
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  await user.click(screen.getByRole('combobox', { name: 'Filter by SLA outcome' }));
  await user.click(screen.getByRole('option', { name: 'Late (SLA Breached)' }));
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.filter(log => log.slaStatus === 'late').length);
  await user.click(screen.getByRole('combobox', { name: 'Filter by SLA outcome' }));
  await user.click(screen.getByRole('option', { name: 'All SLA Outcomes' }));
  assert.equal(summary.textContent, before);
  assert.equal(screen.queryByRole('button', { name: 'Print PDF' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Last 7 Days' }), null);
  const trigger = screen.getByRole('button', { name: /^Filter analytics by date:/ });
  assert.ok(screen.getByRole('banner').contains(trigger));
  await user.click(trigger);
  assert.deepEqual(Array.from(screen.getByRole('dialog', { name: 'Analytics date filter' }).querySelectorAll('button')).map(button => button.textContent?.trim()), ['Today', 'Tomorrow', 'All dates', 'Date range']);
  await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
  assert.equal(screen.queryByText(AUDIT_LOG_ITEMS[0].jobNumber), null);
  assert.ok(screen.getByText('No audit records for these filters.'));
  assert.equal(within(summary).getByText('Dispatches completed').closest('dt')!.nextElementSibling!.textContent, '0');
  assert.ok(within(summary).getByText('$0'));
  assert.ok(screen.getByText('No hourly activity for the selected dates.'));
  assert.ok(screen.getByText('No daily activity for the selected dates.'));
  assert.equal(within(screen.getByLabelText('Accessorial summary')).getByText('Liftgate services').closest('dt')!.nextElementSibling!.textContent, '0');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  assert.equal(notices.at(-1), 'Downloaded SLA Audit Log report (0 records)');
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.length);
  assert.equal(summary.textContent, before);
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Date range' }));
  await user.click(screen.getByRole('button', { name: /September 8th, 2026/ }));
  await user.click(screen.getByRole('button', { name: /September 9th, 2026/ }));
  await user.click(screen.getByRole('button', { name: 'Apply range' }));
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.length);
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'All dates' }));
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.length);
});

test('Orders date menu filters scheduled rows and resets with other filters', async () => {
  const user = userEvent.setup({ document });
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const jobs = [
    { ...INITIAL_JOBS[0], id: 'date-today', jobNumber: '#9101', scheduledTime: `${formatDateValue(today)}T10:00` },
    { ...INITIAL_JOBS[1], id: 'date-tomorrow', jobNumber: '#9102', scheduledTime: `${formatDateValue(tomorrow)}T10:00` },
    { ...INITIAL_JOBS[2], id: 'date-next-week', jobNumber: '#9103', scheduledTime: `${formatDateValue(nextWeek)}T10:00` },
  ];
  render(React.createElement(JobsPage, { jobs, drivers: INITIAL_DRIVERS, onSelectJob: noop, onUpdateJob: noop, onCreateJob: noop, onNotification: noop }));
  const trigger = screen.getByRole('button', { name: /^Filter orders by date:/ });
  assert.ok(document.querySelector('.app-list-filters')?.contains(trigger));
  assert.equal(screen.getByRole('banner').querySelectorAll('button').length, 2);
  assert.ok(screen.getByRole('button', { name: 'New Quote' }));
  assert.equal(screen.queryByRole('button', { name: 'Unassigned' }), null);
  await user.click(screen.getByRole('combobox', { name: 'Filter by order status' }));
  assert.ok(screen.getByRole('option', { name: 'New' }));
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('button', { name: 'Export Manifest' }), null);
  assert.equal(screen.getByRole('table', { name: 'Orders' }).querySelectorAll('tbody tr').length, 3);
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(screen.getByRole('table', { name: 'Orders' }).querySelectorAll('tbody tr').length, 1);
  assert.ok(screen.getByText('#9101'));
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
  assert.equal(screen.getByRole('table', { name: 'Orders' }).querySelectorAll('tbody tr').length, 1);
  assert.ok(screen.getByText('#9102'));
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'All dates' }));
  assert.equal(screen.getByRole('table', { name: 'Orders' }).querySelectorAll('tbody tr').length, 3);
});

test('drivers without photos show a first-letter avatar in the list and details', async () => {
  const user = userEvent.setup({ document });
  const withoutPhoto = { ...INITIAL_DRIVERS[0], name: 'Alice Rivera', avatar: ' ' };
  const withPhoto = INITIAL_DRIVERS[1];
  render(React.createElement(DriversPage, { jobs: [], drivers: [withoutPhoto, withPhoto], onSelectDriver: noop, onCreateDriver: noop, onUpdateDriver: noop, onNotification: noop }));
  const fallback = screen.getByRole('img', { name: withoutPhoto.name });
  assert.equal(fallback.tagName, 'SPAN');
  assert.equal(fallback.textContent?.trim(), 'A');
  assert.equal(screen.getByRole('img', { name: withPhoto.name }).tagName, 'IMG');
  await user.click(screen.getByRole('button', { name: `Details for ${withoutPhoto.name}` }));
  assert.equal(screen.getAllByRole('img', { name: withoutPhoto.name }).filter(node => node.textContent?.trim() === 'A').length, 2);
});
