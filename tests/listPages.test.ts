import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
HTMLElement.prototype.scrollIntoView = () => {};
const { render: rawRender, screen, cleanup, within } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const render = (ui: React.ReactElement) => rawRender(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }) }, ui));
const { default: userEvent } = await import('@testing-library/user-event');
const { JobsPage } = await import('../src/pages/JobsPage');
const { DriversPage } = await import('../src/pages/DriversPage');
const { CustomersPage } = await import('../src/pages/CustomersPage');
const { VehiclesPage } = await import('../src/pages/VehiclesPage');
const { INITIAL_DRIVERS, INITIAL_JOBS } = await import('../src/data/mockData');
const { loadVehicles } = await import('../src/lib/vehicleStorage');
const { VehicleTable } = await import('../src/components/entities/VehicleTable');
const { formatDateValue } = await import('../src/lib/dateValues');
const { loadCustomers } = await import('../src/lib/customerStorage');
const noop = () => {};
afterEach(() => { cleanup(); localStorage.clear(); });
test('vehicle list first column displays public ID with only year underneath', () => {
  const vehicle = { ...loadVehicles()[0], vehicleNumber: 'DDV-V12', year: 2022, makeModel: 'Ford Transit' };
  render(React.createElement(VehicleTable, { vehicles: [vehicle, { ...vehicle, id: 'unknown-year', vehicleNumber: 'DDV-V14', year: 0 }], drivers: [], vehicleTypes: [], onDetails: noop }));
  const table = screen.getByRole('table', { name: 'Vehicles' });
  assert.equal(table.querySelector('th')?.textContent, 'ID');
  const cells = table.querySelectorAll('tbody tr td:first-child');
  assert.deepEqual(Array.from(cells[0].children).map(child => child.textContent), ['DDV-V12', '2022']);
  assert.deepEqual(Array.from(cells[1].children).map(child => child.textContent), ['DDV-V14', '—']);
});
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
  if (scenario.name === 'Orders') assert.ok(screen.getByRole('columnheader', { name: 'Pickup → Delivery' }));
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

test('Analytics replaces export and order table with a date-filtered activity chart', async () => {
  const { ReportsPage } = await import('../src/pages/ReportsPage');
  const { DEMO_ANALYTICS } = await import('../src/lib/reportStorage');
  const user = userEvent.setup({ document });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class { observe() {} unobserve() {} disconnect() {} } });
  render(React.createElement(ReportsPage, { today: '2026-09-09' }));
  const summary = screen.getByLabelText('Analytics summary');
  const before = summary.textContent;
  assert.deepEqual(Array.from(summary.querySelectorAll('dt')).map(label => label.textContent), ['Total', 'In progress', 'Completed', 'Canceled']);
  assert.equal(within(summary).getByText('Total').closest('dt')!.nextElementSibling!.textContent, '7');
  assert.equal(within(summary).getByText('In progress').closest('dt')!.nextElementSibling!.textContent, '0');
  assert.equal(within(summary).getByText('Canceled').closest('dt')!.nextElementSibling!.textContent, '0');
  assert.equal(within(summary).getByText('Completed').closest('dt')!.nextElementSibling!.textContent, '7');
  assert.equal(screen.queryByRole('region', { name: 'Order volume' }), null);
  const performance = screen.getByRole('region', { name: 'Delivery performance' });
  assert.ok(within(performance).getByText('On time'));
  assert.ok(within(performance).getByText('Late'));
  assert.ok(within(performance).getByText('Not measured'));
  assert.equal(document.querySelectorAll('section[aria-label]').length, 3);
  assert.ok(screen.getByRole('region', { name: 'Order sources' }));
  assert.equal(screen.queryByText(/billing|revenue|surcharge/i), null);
  const activity = screen.getByRole('region', { name: 'Orders, drivers & shippers' });
  assert.ok(within(activity).getByText('Drivers'));
  assert.ok(within(activity).getByText('Shippers'));
  assert.equal(screen.queryByRole('button', { name: 'Export CSV' }), null);
  assert.equal(screen.queryByRole('table', { name: 'Analytics orders' }), null);
  assert.equal(screen.queryByRole('searchbox'), null);
  const trigger = screen.getByRole('button', { name: /^Filter analytics by date:/ });
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
  assert.equal(screen.queryByText(DEMO_ANALYTICS.rows[0].number), null);
  assert.ok(within(activity).getByText('No orders for these dates'));
  assert.ok(within(performance).getByText('No completed deliveries yet'));
  assert.equal(within(summary).getByText('Completed').closest('dt')!.nextElementSibling!.textContent, '0');
  assert.deepEqual(Array.from(summary.querySelectorAll('dd')).map(value => value.textContent), ['0', '0', '0', '0']);
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Today' }));
  assert.equal(within(activity).queryByText('No orders for these dates'), null);
  assert.equal(summary.textContent, before);
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Date range' }));
  await user.click(screen.getByRole('button', { name: /September 8th, 2026/ }));
  await user.click(screen.getByRole('button', { name: /September 9th, 2026/ }));
  await user.click(screen.getByRole('button', { name: 'Apply range' }));
  assert.equal(within(activity).queryByText('No orders for these dates'), null);
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
