import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {DriverEditor}=await import('../src/components/entities/DriverEditor');
const {VehicleEditor}=await import('../src/components/entities/VehicleEditor');
const {JobsPage}=await import('../src/pages/JobsPage');
const {CustomersPage}=await import('../src/pages/CustomersPage');
const {OrderPricingForm}=await import('../src/components/pricing/OrderPricingForm');
const {INITIAL_DRIVERS}=await import('../src/data/mockData');
const {normalizeDriver}=await import('../src/lib/driverStorage');
const {loadPricingContext,createDefaultOrderInput,priceOrder}=await import('../src/lib/orderPricing');
afterEach(()=>{cleanup();localStorage.clear();});
test('driver edits persist licence, skills, shift-independent duty and contact fields', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],shiftStart:undefined,currentVehicleId:null});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  await user.clear(screen.getByLabelText('Email')); await user.type(screen.getByLabelText('Email'),'driver@example.test');
  await user.type(screen.getByLabelText(/Skills \(comma/),'Furniture, Installation'); await user.tab();
  await user.click(screen.getByText('Qualifications, availability & notes'));
  await user.clear(screen.getByLabelText('Licence class')); await user.type(screen.getByLabelText('Licence class'),'Class 3');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.email,'driver@example.test'); assert.equal(saved.licenseClass,'Class 3'); assert.deepEqual(saved.skills,['Furniture','Installation']); assert.equal(saved.dutyStatus,driver.dutyStatus);
});
test('vehicle form rejects missing type and has cargo dimensions without maintenance inputs', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  render(React.createElement(VehicleEditor,{vehicles:[],onSave:v=>saved=v,onCancel:()=>{}}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  await user.click(screen.getByRole('button',{name:'Save vehicle'})); assert.equal(saved,undefined); assert.match(screen.getByRole('alert').textContent!,/vehicle type/);
  assert.ok(screen.getByLabelText('Cargo length (cm)')); assert.ok(screen.getByLabelText('Cargo volume (m³)')); assert.equal(screen.queryByLabelText(/odometer/i),null);
});
test('multi-stop editor adds contact windows and moves stable IDs without changing item links', async()=>{
  const ctx=loadPricingContext(); const initial=createDefaultOrderInput(ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);return React.createElement(OrderPricingForm,{value,ctx,snapshot:priceOrder(value,ctx),showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  await user.click(screen.getAllByText('Contact, time window & delivery requirements')[0]);
  await user.type(screen.getAllByLabelText('Stop contact / recipient')[0],'Recipient One');
  await user.click(screen.getByRole('button',{name:'+ Pickup'})); assert.equal(changed.stops.length,3);
  const newId=changed.stops[2].id; await user.click(screen.getByRole('button',{name:'Move stop 3 up'})); assert.equal(changed.stops[1].id,newId); assert.equal(changed.stops[0].contactName,'Recipient One'); assert.equal(changed.packages[0].deliveryStopId,initial.stops[1].id);
});
test('order create, detail, edit and save retain operational and stop data', async()=>{
  const user=userEvent.setup({document});let created:any;let updated:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{jobs,drivers:[],onBackToMonitor:()=>{},onSelectJob:()=>{},onNotification:m=>notices.push(m),onCreateJob:j=>{created=j;setJobs([j]);},onUpdateJob:j=>{updated=j;setJobs([j]);}});}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  const customer=screen.getByPlaceholderText('e.g. Pacific Coast Fresh');await user.type(customer,'Walk-in Business');
  await user.type(screen.getByLabelText('Reference / PO numbers'),'PO-123');
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway');
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.ok(created,notices.join(' ')); assert.equal(created.referenceNumbers,'PO-123'); assert.equal(created.pricingInput.stops.length,2); assert.ok(created.customerSnapshot);
  await user.click(screen.getAllByText(created.jobNumber)[0]); await user.click(screen.getByRole('button',{name:'Edit order'}));
  await user.clear(screen.getByLabelText('Reference / PO numbers')); await user.type(screen.getByLabelText('Reference / PO numbers'),'PO-456');
  await user.click(screen.getByRole('button',{name:'Save Order'})); assert.ok(updated,notices.join(' ')); assert.equal(updated.referenceNumbers,'PO-456'); assert.equal(updated.id,created.id); assert.equal(updated.version,2); assert.deepEqual(updated.customerSnapshot,created.customerSnapshot);
});
