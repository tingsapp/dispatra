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

test('Analytics retains KPI values and audit filtering with the shared summary cards', async () => {
  const { ReportsPage } = await import('../src/pages/ReportsPage');
  const { AUDIT_LOG_ITEMS } = await import('../src/lib/reportStorage');
  const user = userEvent.setup({ document });
  render(React.createElement(ReportsPage, { onNotification: noop }));
  const summary = screen.getByLabelText('Analytics summary');
  const before = summary.textContent;
  for (const value of ['96.8%', '306', '8.4 min', '1,840 km', '$28,270']) assert.ok(within(summary).getByText(value));
  const table = screen.getByRole('table', { name: 'Analytics audit log' });
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.length);
  await user.type(screen.getByRole('searchbox'), AUDIT_LOG_ITEMS[0].jobNumber);
  assert.equal(table.querySelectorAll('tbody tr').length, 1);
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  await user.click(screen.getByRole('combobox', { name: 'Filter by SLA outcome' }));
  await user.click(screen.getByRole('option', { name: 'Late (SLA Breached)' }));
  assert.equal(table.querySelectorAll('tbody tr').length, AUDIT_LOG_ITEMS.filter(log => log.slaStatus === 'late').length);
  assert.equal(summary.textContent, before);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed'), 'true');
});
