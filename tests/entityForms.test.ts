import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach,test } from 'node:test';
import React from 'react';
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
test('driver form: employee or owner-operator, attached vehicle, service areas and contact; no work/shift/qualification fields', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],shiftStart:undefined,currentVehicleId:null});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  await user.clear(screen.getByLabelText('Email')); await user.type(screen.getByLabelText('Email'),'driver@example.test');
  await user.type(screen.getByLabelText(/Service areas \(comma/),'Vancouver, Burnaby'); await user.tab();
  for (const gone of ['Work','Shift starts','Shift ends','Licence class','Qualifications, availability & notes','Current vehicle','Skills (comma separated)']) assert.equal(screen.queryByText(gone),null,gone);
  assert.equal(document.querySelector('details'),null);
  await user.click(screen.getByRole('combobox',{name:'Employment'})); await user.click(screen.getByRole('option',{name:/Owner-operator/}));
  await user.click(screen.getByRole('combobox',{name:'Attached vehicle'})); const options=screen.getAllByRole('option'); assert.equal(options[0].textContent,'None yet'); await user.click(options[1]);
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.email,'driver@example.test'); assert.equal(saved.employmentType,'CONTRACTOR'); assert.ok(saved.currentVehicleId); assert.deepEqual(saved.serviceAreaIds,['Vancouver','Burnaby']); assert.equal(saved.dutyStatus,driver.dutyStatus);
  assert.equal(normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'TEMPORARY'} as any).employmentType,'EMPLOYEE');
});
test('vehicle form rejects missing type and has cargo dimensions without maintenance inputs', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  render(React.createElement(VehicleEditor,{vehicles:[],onSave:v=>saved=v,onCancel:()=>{}}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  await user.click(screen.getByRole('button',{name:'Save vehicle'})); assert.equal(saved,undefined); assert.match(screen.getByRole('alert').textContent!,/vehicle type/);
  assert.ok(screen.getByLabelText('Cargo length (cm)')); assert.ok(screen.getByLabelText('Cargo volume (m³)')); assert.equal(screen.queryByLabelText(/odometer/i),null); assert.equal(screen.queryByLabelText(/Service areas/),null); assert.equal(screen.queryByText('Depot & notes'),null); assert.equal(document.querySelector('details'),null); await user.type(screen.getByLabelText('Description'),'Reefer unit'); assert.ok(screen.getByLabelText('Description'));
});
test('multi-stop editor: inline contact and phone per stop, ready-at sets the schedule, added pickups keep item links', async()=>{
  const ctx=loadPricingContext(); const initial=createDefaultOrderInput(ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);return React.createElement(OrderPricingForm,{value,ctx,snapshot:priceOrder(value,ctx),showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  assert.equal(document.querySelector('details:not([open]) summary')?.textContent?.includes('Accessorials'),true); assert.equal(screen.queryByText('Contact, time window & delivery requirements'),null); assert.equal(screen.queryByRole('button',{name:/Move stop/}),null); assert.equal(screen.queryByRole('combobox',{name:'Zone'}),null); assert.equal(screen.queryByLabelText('Wait minutes'),null); assert.match(screen.getByText(/Chargeable weight is the larger of actual and dimensional weight/i).textContent!,/larger of actual and dimensional weight/i); assert.match(screen.getByText(/No live estimate yet|Nothing priced yet/i).textContent!,/No live estimate yet|Nothing priced yet/i);
  await user.type(screen.getByLabelText('Stop 1 contact name'),'Recipient One'); await user.type(screen.getByLabelText('Stop 1 phone'),'604-555-0100');
  await user.click(screen.getByRole('button',{name:'+ Pickup'})); assert.equal(changed.stops.length,3); assert.equal(changed.stops[2].type,'PICKUP');
  assert.equal(changed.stops[0].contactName,'Recipient One'); assert.equal(changed.stops[0].contactPhone,'604-555-0100'); assert.equal(changed.packages[0].deliveryStopId,initial.stops[1].id);
  assert.ok(screen.getByRole('combobox',{name:'Package 1 pickup'})); assert.ok(screen.getByText('Picked up at:'));
  const qty=screen.getByRole('spinbutton',{name:'Package 1 quantity'}); await user.tripleClick(qty); await user.keyboard('3'); assert.equal(changed.packages[0].quantity,3);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 fragile'})); assert.equal(changed.packages[0].fragile,true);
});
test('order create, detail, edit and save retain operational and stop data', async()=>{
  const {loadBillingConfig,saveBillingConfig}=await import('../src/lib/billingStorage'); const billing=loadBillingConfig(); billing.invoicing.taxRegistrationStatus='REGISTERED'; billing.invoicing.taxRegistrationNumber='123456789RT0001'; saveBillingConfig(billing);
  const user=userEvent.setup({document});let created:any;let updated:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{jobs,drivers:[],onBackToMonitor:()=>{},onSelectJob:()=>{},onNotification:m=>notices.push(m),onCreateJob:j=>{created=j;setJobs([j]);},onUpdateJob:j=>{updated=j;setJobs([j]);}});}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  for (const gone of ['Order Number','Shipper Name (walk-in)','Contact Phone','Reference / PO numbers','Commodity description','Freight tax treatment','Route & Schedule']) assert.equal(screen.queryByText(gone),null,gone);
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.equal(created,undefined); assert.match(notices.at(-1)!,/Choose a customer/);
  await user.click(screen.getByRole('combobox',{name:'Customer'})); await user.click(screen.getAllByRole('option')[1]);
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  assert.match(screen.getByText(/calculated from the stop addresses/).textContent!,/routing is connected/); await user.type(screen.getByLabelText('Route distance'),'12');
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.ok(created,notices.join(' ')); assert.match(created.jobNumber,/^#\d+$/); assert.equal(created.pricingInput.routeKm,12); assert.equal(created.pricing.status,'PRICED'); assert.equal(created.pricing.taxDecision.province,'BC'); assert.equal(created.lifecycleStatus,'READY_FOR_DISPATCH'); assert.equal(created.pricingInput.stops.length,2); assert.ok(created.customerSnapshot?.id);
  await user.click(screen.getAllByText(created.jobNumber)[0]); await user.click(screen.getByRole('button',{name:'Edit order'}));
  await user.click(screen.getByRole('combobox',{name:'Priority'})); await user.click(screen.getByRole('option',{name:'Urgent'}));
  await user.click(screen.getByRole('button',{name:'Save Order'})); assert.ok(updated,notices.join(' ')); assert.equal(updated.priority,'URGENT'); assert.equal(updated.jobNumber,created.jobNumber); assert.equal(updated.id,created.id); assert.equal(updated.version,2); assert.deepEqual(updated.customerSnapshot,created.customerSnapshot);
});

test('order address entry changes live destination tax and clears it when the address becomes ambiguous', async()=>{
  const ctx=loadPricingContext(); ctx.billing.invoicing.taxRegistrationStatus='REGISTERED'; ctx.billing.invoicing.taxRegistrationNumber='123456789RT0001';
  const initial={...createDefaultOrderInput(ctx),routeKm:15,estimatedMinutes:40}; let latest=priceOrder(initial,ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);latest=priceOrder(value,ctx);return React.createElement(OrderPricingForm,{value,ctx,snapshot:latest,showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5');
  await user.type(screen.getAllByLabelText('Stop address')[1],'200 Main St, Vancouver BC V6A 2S5');
  assert.equal(latest.status,'PRICED',JSON.stringify(latest.errors)); assert.equal(latest.taxDecision?.province,'BC');
  await user.clear(screen.getAllByLabelText('Stop address')[1]); await user.type(screen.getAllByLabelText('Stop address')[1],'20 King St, Toronto ON M5V 2T6');
  assert.equal(latest.taxDecision?.province,'ON'); assert.equal(changed.stops[1].provinceCode,'ON'); assert.equal(latest.taxDecision?.profile?.taxes[0].ratePercent,13);
  await user.clear(screen.getAllByLabelText('Stop address')[1]); await user.type(screen.getAllByLabelText('Stop address')[1],'20 King St');
  assert.equal(latest.status,'NEEDS_ATTENTION'); assert.equal(changed.stops[1].provinceCode,undefined);
});

test('driver table opens complete details with a keyboard-accessible Details action', async()=>{
  const {DriversPage}=await import('../src/pages/DriversPage'); const user=userEvent.setup({document}); const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:null});
  render(React.createElement(DriversPage,{drivers:[driver],jobs:[],onBackToMonitor:()=>{},onSelectDriver:()=>{},onUpdateDriver:()=>{},onCreateDriver:()=>{},onNotification:()=>{}}));
  assert.ok(screen.getByRole('table',{name:'Drivers'})); assert.equal(screen.queryByTitle('Grid Cards View'),null);
  const details=screen.getByRole('button',{name:`Details for ${driver.name}`}); await user.click(details); assert.ok(screen.getByLabelText('Email')); await user.keyboard('{Escape}'); assert.equal(screen.queryByLabelText('Email'),null); assert.equal(document.activeElement,details);
});
test('vehicle table opens full capacity and equipment details', async()=>{
  const {VehiclesPage}=await import('../src/pages/VehiclesPage'); const {loadVehicles}=await import('../src/lib/vehicleStorage'); const vehicle=loadVehicles()[0]; const user=userEvent.setup({document});
  render(React.createElement(VehiclesPage,{drivers:[],onBackToMonitor:()=>{},onNotification:()=>{}}));
  assert.ok(screen.getByRole('table',{name:'Vehicles'})); const details=screen.getByRole('button',{name:`Details for ${vehicle.unitNumber}`}); await user.click(details); assert.ok(screen.getByLabelText('Cargo length (cm)')); await user.keyboard('{Escape}'); assert.equal(screen.queryByLabelText('Cargo length (cm)'),null); assert.equal(document.activeElement,details);
});
test('zone selects appear on stops only when the customer is priced zone to zone, and are required', async()=>{
  const {loadCustomers,saveCustomers}=await import('../src/lib/customerStorage'); const {loadPricingConfig}=await import('../src/lib/pricingStorage');
  const zoneCard=loadPricingConfig().rateCards.find(c=>c.pricingMethod==='ZONE')!; const customers=loadCustomers(); customers[0].rateCardId=zoneCard.id; customers[1].rateCardId=null; saveCustomers(customers);
  const user=userEvent.setup({document});let created:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{jobs,drivers:[],onBackToMonitor:()=>{},onSelectJob:()=>{},onNotification:m=>notices.push(m),onCreateJob:j=>{created=j;setJobs([j]);},onUpdateJob:()=>{}});}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  await user.click(screen.getByRole('combobox',{name:'Customer'})); await user.click(screen.getByRole('option',{name:customers[1].name}));
  assert.equal(screen.queryAllByRole('combobox',{name:'Zone'}).length,0);
  await user.click(screen.getByRole('combobox',{name:'Customer'})); await user.click(screen.getByRole('option',{name:customers[0].name}));
  assert.equal(screen.getAllByRole('combobox',{name:'Zone'}).length,2); assert.match(screen.getByText(/Priced on/).textContent!,new RegExp(zoneCard.name));
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  for (const zone of screen.getAllByRole('combobox',{name:'Zone'})) { await user.click(zone); await user.click(screen.getAllByRole('option',{name:'Zone (required)'})[0]); }
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.equal(created,undefined); assert.match(notices.at(-1)!,/Choose a zone for every stop/);
});
