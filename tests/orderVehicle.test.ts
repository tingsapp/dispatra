import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import type { Job } from '../src/types';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render: rawRender, screen, cleanup } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const render = (ui: React.ReactElement) => rawRender(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }) }, ui));
const { default: userEvent } = await import('@testing-library/user-event');
const { JobsPage } = await import('../src/pages/JobsPage');
const { INITIAL_DRIVERS } = await import('../src/data/mockData');
const { normalizeDriver } = await import('../src/lib/driverStorage');
const { loadVehicles, saveVehicles } = await import('../src/lib/vehicleStorage');
const { loadPricingConfig, savePricingConfig, createEmptyRateCard } = await import('../src/lib/pricingStorage');
const { loadCustomers, saveCustomers } = await import('../src/lib/customerStorage');
const { loadPricingContext, createDefaultOrderInput, priceOrder } = await import('../src/lib/orderPricing');
const { validateAssignment } = await import('../src/lib/organizationWorkflows');
afterEach(() => { cleanup(); localStorage.clear(); });
function setup() {
  const pricing = loadPricingConfig();
  const card = createEmptyRateCard({ id: 'test-card', name: 'Test fixed', scope: 'ORGANIZATION', status: 'ACTIVE', effectiveFrom: '2020-01-01', pricingMethod: 'FIXED', fixedAmount: 100, applyVehicleSurcharge: true });
  savePricingConfig({ ...pricing, rateCards: [card] });
  const customer = { ...loadCustomers()[0], status: 'Active' as const, rateCardId: card.id };
  saveCustomers([customer]);
  const fleet = loadVehicles().slice(0, 2).map((vehicle, index) => ({ ...vehicle, currentDriverId: INITIAL_DRIVERS[index].id, availability: 'AVAILABLE' as const, recordStatus: 'ACTIVE' as const }));
  saveVehicles(fleet);
  const drivers = INITIAL_DRIVERS.slice(0, 2).map((driver, index) => normalizeDriver({ ...driver, status: 'available', currentVehicleId: fleet[index].id, dutyStatus: 'ON_DUTY', workStatus: 'AVAILABLE' }));
  return { customer, fleet, drivers };
}
async function openOrder(drivers: ReturnType<typeof setup>['drivers']) {
  const user = userEvent.setup({ document });
  let created: Job | undefined;
  const notices: string[] = [];
  render(React.createElement(JobsPage, { jobs: [], drivers, onSelectJob: () => {}, onUpdateJob: () => {}, onCreateJob: job => { created = job; }, onNotification: message => notices.push(message) }));
  await user.click(screen.getByRole('button', { name: 'New Order' }));
  await user.click(screen.getByRole('combobox', { name: 'Shipper' }));
  await user.click(screen.getAllByRole('option')[1]);
  await user.clear(screen.getAllByLabelText('Stop address')[0]);
  await user.type(screen.getAllByLabelText('Stop address')[0], '100 Main St, Vancouver BC');
  await user.type(screen.getAllByLabelText('Stop address')[1], '200 Main St, Vancouver BC');
  return { user, created: () => created, notices };
}
const required = () => screen.getByRole('combobox', { name: 'Vehicle type' }).textContent;
const vehicleRow = () => screen.getByText('Vehicle Surcharge').closest('div')!.parentElement!.textContent!;
async function chooseDriver(view: Awaited<ReturnType<typeof openOrder>>, name: RegExp) {
  await view.user.click(screen.getByRole('combobox', { name: 'Assign driver' }));
  await view.user.click(screen.getByRole('option', { name }));
}
test('new order suggests the smallest vehicle type the load fits and saves without a driver', async () => {
  const { drivers } = setup();
  const view = await openOrder(drivers);
  assert.equal(required(), 'Cargo Van');
  assert.match(vehicleRow(), /Cargo Van \(no surcharge\)\$0\.00/);
  await view.user.click(screen.getByRole('button', { name: 'Create Order' }));
  const order = view.created();
  assert.ok(order, view.notices.join(' '));
  assert.equal(order.pricingInput?.vehicleId, 'veh_1_ton');
  assert.equal(order.assignedDriverId, undefined);
  assert.equal(order.pricing?.status, 'PRICED');
  assert.equal(order.pricing?.vehicleSurcharge, 0);
});
test('choosing a driver never changes the required vehicle or the price; a larger required type adds its surcharge and any fitting truck may take it', async () => {
  const { drivers } = setup();
  const view = await openOrder(drivers);
  for (const driver of drivers) await chooseDriver(view, new RegExp(driver.name));
  assert.equal(required(), 'Cargo Van');
  await view.user.click(screen.getByRole('combobox', { name: 'Vehicle type' }));
  await view.user.click(screen.getByRole('option', { name: 'Cube Van' }));
  assert.match(vehicleRow(), /Cube Van\$25\.00/);
  await view.user.click(screen.getByRole('button', { name: 'Create Order' }));
  const order = view.created();
  assert.ok(order, view.notices.join(' '));
  assert.equal(order.assignedDriverId, drivers[1].id);
  assert.equal(order.pricingInput?.vehicleId, 'veh_2_ton');
  assert.equal(order.pricing?.vehicleSurcharge, 25);
});
test('a refrigerated requirement needs a truck with refrigeration', async () => {
  const { fleet, drivers } = setup();
  assert.ok(!fleet[0].equipment?.includes('Refrigeration') && fleet[1].equipment?.includes('Refrigeration'));
  const view = await openOrder(drivers);
  await view.user.click(screen.getByRole('combobox', { name: 'Vehicle type' }));
  await view.user.click(screen.getByRole('option', { name: 'Refrigerated Van' }));
  await chooseDriver(view, new RegExp(drivers[0].name));
  await view.user.click(screen.getByRole('button', { name: 'Create Order' }));
  assert.equal(view.created(), undefined);
  assert.match(view.notices.at(-1)!, /needs refrigeration for the required Refrigerated Van/);
  await chooseDriver(view, new RegExp(drivers[1].name));
  await view.user.click(screen.getByRole('button', { name: 'Create Order' }));
  assert.equal(view.created()?.assignedDriverId, drivers[1].id, view.notices.join(' '));
});
test('a driver with no attached vehicle cannot be assigned on a new order', async () => {
  const { drivers } = setup();
  const driver = { ...drivers[0], currentVehicleId: null };
  const view = await openOrder([drivers[1], driver]);
  await chooseDriver(view, new RegExp(driver.name));
  await view.user.click(screen.getByRole('button', { name: 'Create Order' }));
  assert.equal(view.created(), undefined);
  assert.match(view.notices.at(-1)!, /current fleet vehicle on the driver profile/);
});
test('later assignment checks the attached vehicle type without mutating the stored quote', () => {
  const { customer, fleet, drivers } = setup();
  const ctx = loadPricingContext();
  const input = { ...createDefaultOrderInput(ctx), customerId: customer.id };
  input.stops.forEach((stop, index) => { stop.label = `${index + 1} Main St, Vancouver BC`; });
  const quote = priceOrder(input, ctx);
  const order = { id: 'new', version: 1, status: 'no_driver' as const, pricingInput: input, pricing: quote };
  const before = JSON.stringify(order);
  assert.deepEqual(validateAssignment(order, drivers[0], [], ctx), []);
  const vehicleType = ctx.catalogue.vehicles.find(v => v.id === fleet[0].vehicleTypeId)!;
  vehicleType.active = false;
  assert.match(validateAssignment(order, drivers[0], [], ctx).join(' '), /vehicle type is inactive/);
  assert.equal(JSON.stringify(order), before);
});
