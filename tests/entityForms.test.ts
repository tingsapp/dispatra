import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach,test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup,within}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {DriverEditor}=await import('../src/components/entities/DriverEditor');
const {VehicleEditor}=await import('../src/components/entities/VehicleEditor');
const {JobsPage}=await import('../src/pages/JobsPage');
const {CustomersPage}=await import('../src/pages/CustomersPage');
const {OrderPricingForm}=await import('../src/components/pricing/OrderPricingForm');
const {INITIAL_DRIVERS}=await import('../src/data/mockData');
const {normalizeDriver}=await import('../src/lib/driverStorage');
const {validateDriver}=await import('../src/domain/validation');
const {loadSimplePricingConfig}=await import('../src/lib/simplePricingStorage');
const {loadVehicles}=await import('../src/lib/vehicleStorage');
const {loadPricingContext,createDefaultOrderInput,priceOrder}=await import('../src/lib/orderPricing');
afterEach(()=>{cleanup();localStorage.clear();});
test('new drivers get the next background driver number; the form has no number field', async()=>{
  const { nextDriverNumber } = await import('../src/lib/driverStorage');
  const existing=INITIAL_DRIVERS.map(d=>normalizeDriver(d));
  assert.equal(nextDriverNumber(existing),'D32'); assert.equal(nextDriverNumber([]),'D01');
  const user=userEvent.setup({document}); let saved:any;
  render(React.createElement(DriverEditor,{drivers:existing,onSave:d=>saved=d,onCancel:()=>{}}));
  assert.equal(screen.queryByLabelText(/Driver number/),null);
  await user.type(screen.getByLabelText('Driver name'),'New Driver'); await user.type(screen.getByLabelText('Phone'),'604-555-0199');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.ok(saved,'driver saved'); assert.equal(saved.driverNumber,'D32'); assert.equal(saved.id,'D32');
});
test('owner-operators get payout share fields; employees do not', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:null});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  assert.equal(screen.queryByLabelText(/Driver share of order price/),null);
  await user.click(screen.getByRole('combobox',{name:'Employment'})); await user.click(screen.getByRole('option',{name:/Owner-operator/}));
  const share=screen.getByLabelText(/Driver share of order price/) as HTMLInputElement; const fuel=screen.getByLabelText(/Driver share of fuel surcharge/) as HTMLInputElement;
  assert.equal(share.value,'70'); assert.equal(fuel.value,'100');
  await user.clear(share); await user.type(share,'120'); await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved,undefined); assert.equal(share.checkValidity(),false);
  assert.match(validateDriver({...driver,employmentType:'CONTRACTOR',revenueSharePercent:120,fuelSurchargeSharePercent:100},[]).join(' '),/between 0 and 100/);
  await user.clear(share); await user.type(share,'65'); await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.revenueSharePercent,65); assert.equal(saved.fuelSurchargeSharePercent,100); assert.equal(saved.employmentType,'CONTRACTOR');
  await user.click(screen.getByRole('combobox',{name:'Employment'})); await user.click(screen.getByRole('option',{name:/Employee/}));
  assert.equal(screen.queryByLabelText(/Driver share of order price/),null);
});
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
test('vehicle form requires a type, hides status and capacity inputs on registration, and inherits capacity from the type', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const types=loadSimplePricingConfig().vehicles.filter(t=>t.active);
  render(React.createElement(VehicleEditor,{vehicles:[],onSave:v=>saved=v,onCancel:()=>{}}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  await user.click(screen.getByRole('button',{name:'Save vehicle'})); assert.equal(saved,undefined); assert.match(screen.getByRole('alert').textContent!,/vehicle type/);
  for (const gone of [/Cargo length/,/Cargo volume/,/Payload capacity/,/Pallet capacity/,/odometer/i,/Service areas/]) assert.equal(screen.queryByLabelText(gone),null,String(gone));
  assert.equal(screen.queryByRole('combobox',{name:'Record status'}),null); assert.equal(screen.queryByRole('combobox',{name:'Availability'}),null);
  assert.equal(document.querySelector('details'),null);
  await user.click(screen.getByRole('combobox',{name:'Vehicle type'})); await user.click(screen.getByRole('option',{name:types[1].name}));
  await user.type(screen.getByLabelText('Description'),'Reefer unit');
  await user.click(screen.getByRole('button',{name:'Save vehicle'}));
  assert.ok(saved); assert.equal(saved.vehicleTypeId,types[1].id); assert.equal(saved.payloadCapacityKg,types[1].payloadCapacityKg); assert.equal(saved.palletCapacity,types[1].palletCapacity); assert.equal(saved.notes,'Reefer unit');
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
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{ jobs, drivers:[], onSelectJob:()=>{}, onNotification:m=>notices.push(m), onCreateJob:j=>{created=j;setJobs([j]);}, onUpdateJob:j=>{updated=j;setJobs([j]);} });}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  for (const gone of ['Order Number','Shipper Name (walk-in)','Contact Phone','Reference / PO numbers','Commodity description','Freight tax treatment','Route & Schedule']) assert.equal(screen.queryByText(gone),null,gone);
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.equal(created,undefined); assert.match(notices.at(-1)!,/Choose a shipper/);
  await user.click(screen.getByRole('combobox',{name:'Shipper'})); await user.click(screen.getAllByRole('option')[1]);
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  assert.match(screen.getByText(/calculated from the stop addresses/).textContent!,/routing is connected/); await user.type(screen.getByLabelText('Route distance'),'12');
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.ok(created,notices.join(' ')); assert.match(created.jobNumber,/^#\d+$/); assert.equal(created.pricingInput.routeKm,12); assert.equal(created.pricing.status,'PRICED'); assert.equal(created.pricing.taxDecision.ruleVersion,'company-tax-v1'); assert.equal(created.lifecycleStatus,'NEW'); assert.equal(created.pricingInput.stops.length,2); assert.ok(created.customerSnapshot?.id);
  await user.click(screen.getAllByText(created.jobNumber)[0]); await user.click(screen.getByRole('button',{name:'Edit order'}));
  await user.click(screen.getByRole('combobox',{name:'Priority'})); await user.click(screen.getByRole('option',{name:'Urgent'}));
  await user.click(screen.getByRole('button',{name:'Save Order'})); assert.ok(updated,notices.join(' ')); assert.equal(updated.priority,'URGENT'); assert.equal(updated.jobNumber,created.jobNumber); assert.equal(updated.id,created.id); assert.equal(updated.version,2); assert.deepEqual(updated.customerSnapshot,created.customerSnapshot);
});

test('order address entry retains the company rate without province tax prompts', async()=>{
  const ctx=loadPricingContext(); ctx.billing.invoicing.taxRegistrationStatus='REGISTERED'; ctx.billing.invoicing.taxRegistrationNumber='123456789RT0001';
  const initial={...createDefaultOrderInput(ctx),routeKm:15,estimatedMinutes:40}; let latest=priceOrder(initial,ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);latest=priceOrder(value,ctx);return React.createElement(OrderPricingForm,{value,ctx,snapshot:latest,showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5');
  await user.type(screen.getAllByLabelText('Stop address')[1],'200 Main St, Vancouver BC V6A 2S5');
  assert.equal(latest.status,'PRICED',JSON.stringify(latest.errors)); assert.equal(latest.taxDecision?.ruleVersion,'company-tax-v1');
  await user.clear(screen.getAllByLabelText('Stop address')[1]); await user.type(screen.getAllByLabelText('Stop address')[1],'20 King St, Toronto ON M5V 2T6');
  assert.equal(latest.taxDecision?.province,undefined); assert.equal(changed.stops[1].provinceCode,'ON'); assert.equal(latest.taxDecision?.profile?.taxes[0].ratePercent,5);
  await user.clear(screen.getAllByLabelText('Stop address')[1]); await user.type(screen.getAllByLabelText('Stop address')[1],'20 King St');
  assert.equal(latest.status,'PRICED'); assert.equal(changed.stops[1].provinceCode,undefined);
  assert.equal(screen.queryByText(/Include the province and postal code/),null);
  assert.equal(latest.taxDecision?.profile?.taxes[0].ratePercent,5);
});

test('completed orders offer Invoice; invoicing finalises the price, records the invoice and shows Invoiced', async()=>{
  const {invoiceOrder,invoiceState}=await import('../src/lib/invoicing'); const {INITIAL_JOBS}=await import('../src/data/mockData');
  const ctx=loadPricingContext(); const base=createDefaultOrderInput(ctx); const customer=ctx.customers.find(c=>c.rateCardId)!;
  const cards=ctx.pricing.rateCards; const fixed=cards.find(c=>c.pricingMethod==='FIXED')!; customer.rateCardId=fixed.id;
  const input={...base,customerId:customer.id,routeKm:8}; const priced=priceOrder(input,ctx); assert.equal(priced.status,'PRICED');
  const done:any={...INITIAL_JOBS[0],id:'done',jobNumber:'#900',status:'completed',lifecycleStatus:'COMPLETED',customerId:customer.id,pricingInput:input,pricing:priced,invoicePreview:undefined,assignedDriverId:undefined};
  const open:any={...INITIAL_JOBS[1],id:'open',jobNumber:'#901',status:'assigned',lifecycleStatus:'ASSIGNED',customerId:customer.id,pricingInput:input,pricing:priced,invoicePreview:undefined};
  assert.equal(invoiceState(done),'READY'); assert.equal(invoiceState(open),'NOT_READY');
  const invoiced=invoiceOrder(done,ctx,new Date('2026-09-22T12:00:00Z'));
  assert.equal(invoiced.lifecycleStatus,'INVOICED'); assert.equal(invoiced.pricing.stage,'FINAL'); assert.equal(invoiced.pricing.total,priced.total); assert.equal(invoiced.invoicePreview?.billingEmail,customer.email); assert.equal(invoiceState(invoiced),'INVOICED');
  assert.throws(()=>invoiceOrder(open,ctx),/completed/); assert.throws(()=>invoiceOrder(invoiced,ctx),/not yet invoiced/);
  const user=userEvent.setup({document}); let updated:any; const notices:string[]=[];
  render(React.createElement(JobsPage,{jobs:[done,open],drivers:[],onSelectJob:()=>{},onUpdateJob:j=>updated=j,onCreateJob:()=>{},onNotification:m=>notices.push(m)}));
  const row=screen.getByText('#900').closest('tr')!; assert.ok(within(row).getByRole('button',{name:/Invoice/})); assert.equal(within(screen.getByText('#901').closest('tr')!).queryByRole('button',{name:/Invoice/}),null);
  await user.click(within(row).getByRole('button',{name:/Invoice/}));
  assert.equal(updated.lifecycleStatus,'INVOICED'); assert.match(notices.at(-1)!,/#900 invoiced/);
  cleanup(); render(React.createElement(JobsPage,{jobs:[updated,open],drivers:[],onSelectJob:()=>{},onUpdateJob:()=>{},onCreateJob:()=>{},onNotification:()=>{}}));
  const after=screen.getByText('#900').closest('tr')!; assert.ok(within(after).getByText('Invoiced')); assert.equal(within(after).queryByRole('button',{name:/Invoice$/}),null);
});
test('drivers and vehicles can be deleted after confirmation, but not while assigned or attached', async()=>{
  const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
  const {VehiclesPage}=await import('../src/pages/VehiclesPage'); const {DriversPage}=await import('../src/pages/DriversPage'); const {saveVehicles}=await import('../src/lib/vehicleStorage');
  const user=userEvent.setup({document}); const notices:string[]=[]; let deleted:any;
  const busy=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:null}); const idle=normalizeDriver({...INITIAL_DRIVERS[1],currentVehicleId:null});
  const job:any={id:'j1',jobNumber:'#1',assignedDriverId:busy.id,status:'assigned'};
  render(React.createElement(React.Fragment,null,React.createElement(ConfirmDialogHost),React.createElement(DriversPage,{drivers:[busy,idle],jobs:[job],onSelectDriver:()=>{},onUpdateDriver:()=>{},onCreateDriver:()=>{},onDeleteDriver:d=>deleted=d,onNotification:m=>notices.push(m)})));
  await user.click(screen.getByRole('button',{name:`Delete ${busy.name}`}));
  assert.equal(screen.queryByRole('alertdialog'),null); assert.match(notices.at(-1)!,/active order/); assert.equal(deleted,undefined);
  await user.click(screen.getByRole('button',{name:`Delete ${idle.name}`}));
  assert.ok(screen.getByRole('alertdialog')); await user.click(screen.getByRole('button',{name:'Delete driver'}));
  assert.equal(deleted?.id,idle.id); assert.match(notices.at(-1)!,/Removed driver/);
  cleanup();
  const fleet=loadVehicles(); const attached={...fleet[0],currentDriverId:busy.id,currentDriverName:busy.name}; const free={...fleet[1],currentDriverId:undefined,currentDriverName:undefined}; saveVehicles([attached,free]);
  render(React.createElement(React.Fragment,null,React.createElement(ConfirmDialogHost),React.createElement(VehiclesPage,{drivers:[busy],onNotification:m=>notices.push(m)})));
  await user.click(screen.getByRole('button',{name:`Delete ${attached.unitNumber}`}));
  assert.equal(screen.queryByRole('alertdialog'),null); assert.match(notices.at(-1)!,/attached to/); assert.equal(loadVehicles().length,2);
  await user.click(screen.getByRole('button',{name:`Delete ${free.unitNumber}`}));
  await user.click(screen.getByRole('button',{name:'Delete vehicle'}));
  assert.deepEqual(loadVehicles().map(v=>v.id),[attached.id]); assert.equal(screen.queryByRole('button',{name:`Delete ${free.unitNumber}`}),null);
});
test('driver table opens complete details with a keyboard-accessible Details action', async()=>{
  const {DriversPage}=await import('../src/pages/DriversPage'); const user=userEvent.setup({document}); const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:null});
  render(React.createElement(DriversPage,{ drivers:[driver], jobs:[], onSelectDriver:()=>{}, onUpdateDriver:()=>{}, onCreateDriver:()=>{}, onNotification:()=>{} }));
  assert.ok(screen.getByRole('table',{name:'Drivers'})); assert.equal(screen.queryByTitle('Grid Cards View'),null);
  const details=screen.getByRole('button',{name:`Details for ${driver.name}`}); await user.click(details); assert.ok(screen.getByLabelText('Email')); assert.ok(screen.getByLabelText('Maximum Active Orders')); await user.keyboard('{Escape}'); assert.equal(screen.queryByLabelText('Email'),null); assert.equal(document.activeElement,details);
});
test('vehicle table opens the vehicle editor with status and equipment details', async()=>{
  const {VehiclesPage}=await import('../src/pages/VehiclesPage'); const vehicle=loadVehicles()[0]; const user=userEvent.setup({document});
  render(React.createElement(VehiclesPage,{ drivers:[], onNotification:()=>{} }));
  assert.ok(screen.getByRole('table',{name:'Vehicles'})); const details=screen.getByRole('button',{name:`Details for ${vehicle.unitNumber}`}); await user.click(details); assert.ok(screen.getByRole('combobox',{name:'Availability'})); assert.ok(screen.getByLabelText(/Equipment/)); await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('combobox',{name:'Availability'}),null); assert.equal(document.activeElement,details);
});
test('zone selects appear on stops only when the customer is priced zone to zone, and are required', async()=>{
  const {loadCustomers,saveCustomers}=await import('../src/lib/customerStorage'); const {loadPricingConfig}=await import('../src/lib/pricingStorage');
  const zoneCard=loadPricingConfig().rateCards.find(c=>c.pricingMethod==='ZONE')!; const customers=loadCustomers(); customers[0].rateCardId=zoneCard.id; customers[1].rateCardId=null; saveCustomers(customers);
  const user=userEvent.setup({document});let created:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{ jobs, drivers:[], onSelectJob:()=>{}, onNotification:m=>notices.push(m), onCreateJob:j=>{created=j;setJobs([j]);}, onUpdateJob:()=>{} });}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  await user.click(screen.getByRole('combobox',{name:'Shipper'})); await user.click(screen.getByRole('option',{name:customers[1].name}));
  assert.equal(screen.queryAllByRole('combobox',{name:'Zone'}).length,0);
  await user.click(screen.getByRole('combobox',{name:'Shipper'})); await user.click(screen.getByRole('option',{name:customers[0].name}));
  assert.equal(screen.getAllByRole('combobox',{name:'Zone'}).length,2); assert.match(screen.getByText(/Priced on/).textContent!,new RegExp(zoneCard.name));
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  for (const zone of screen.getAllByRole('combobox',{name:'Zone'})) { await user.click(zone); await user.click(screen.getAllByRole('option',{name:'Zone (required)'})[0]); }
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.equal(created,undefined); assert.match(notices.at(-1)!,/Choose a zone for every stop/);
});


test('all packages follow company units without changing weights or prices on display changes', async () => {
  const ctx = loadPricingContext();
  const initial = createDefaultOrderInput(ctx);
  initial.routeKm = 10;
  initial.packages.push({ ...initial.packages[0], id: 'second-package' });
  let changed = initial;
  function Form() {
    const [value, setValue] = React.useState(initial);
    return React.createElement(OrderPricingForm, { value, ctx, snapshot: priceOrder(value, ctx), onChange: next => { changed = next; setValue(next); } });
  }
  const user = userEvent.setup({ document }); const view = render(React.createElement(Form));
  const before = structuredClone(changed);
  const quoted = priceOrder(changed, ctx);
  assert.equal(screen.queryByRole('combobox', { name: /weight unit/ }), null);
  ctx.billing.general.weightUnit = 'lb';
  view.rerender(React.createElement(Form));
  assert.deepEqual(changed, before);
  assert.equal(priceOrder(changed, ctx).total, quoted.total);
  assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value, '22.046226');
  assert.equal((screen.getByLabelText('Package 2 weight') as HTMLInputElement).value, '22.046226');
  await user.clear(screen.getByLabelText('Package 1 weight')); await user.type(screen.getByLabelText('Package 1 weight'), '100');
  assert.ok(Math.abs(changed.packages[0].weightKg - 45.359237) < 1e-8);
  assert.equal(changed.packages[1].weightKg, 10);
  const after = structuredClone(changed);
  ctx.billing.general.weightUnit = 'kg';
  view.rerender(React.createElement(Form));
  assert.deepEqual(changed, after);
  assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value, '45.359237');
});

test('editing a vehicle exposes status and re-derives capacity from its type', async () => {
  const user = userEvent.setup({ document }); let saved: any;
  const vehicle = loadVehicles()[0]; const type = loadSimplePricingConfig().vehicles.find(t => t.id === vehicle.vehicleTypeId)!;
  render(React.createElement(VehicleEditor, { vehicle: { ...vehicle, payloadCapacityKg: 1 }, vehicles: [vehicle], onSave: value => { saved = value; }, onCancel: () => {} }));
  assert.ok(screen.getByRole('combobox', { name: 'Record status' })); assert.ok(screen.getByRole('combobox', { name: 'Availability' }));
  assert.equal(screen.queryByLabelText(/Payload capacity/), null);
  await user.click(screen.getByRole('button', { name: 'Save vehicle' }));
  assert.equal(saved.payloadCapacityKg, type.payloadCapacityKg);
});

test('vehicle lists, package details and calculation totals display company units without mutating snapshots', async () => {
  const { loadBillingConfig, saveBillingConfig } = await import('../src/lib/billingStorage');
  const { VehicleTable } = await import('../src/components/entities/VehicleTable');
  const { OrderDetails } = await import('../src/components/entities/OrderFields');
  const { PriceBreakdown } = await import('../src/components/pricing/PriceBreakdown');
  const { loadVehicles } = await import('../src/lib/vehicleStorage');
  const billing = loadBillingConfig(); Object.assign(billing.general, { weightUnit: 'lb', dimensionUnit: 'in', distanceUnit: 'mi' }); saveBillingConfig(billing);
  const vehicle = { ...loadVehicles()[0], payloadCapacityKg: 45.359237 };
  const list = render(React.createElement(VehicleTable, { vehicles: [vehicle], drivers: [], vehicleTypes: [], onDetails: () => {} }));
  assert.match(screen.getByRole('table', { name: 'Vehicles' }).textContent!, /100 lb/); list.unmount();
  const ctx = loadPricingContext(); const input = createDefaultOrderInput(ctx); input.routeKm = 1.609344;
  Object.assign(input.packages[0], { quantity: 1, weightKg: 4.5359237, lengthCm: 2.54, widthCm: 2.54, heightCm: 2.54 });
  const details = render(React.createElement(OrderDetails, { order: { ...({} as any), pricingInput: input } }));
  assert.match(screen.getByText(/lb each/).textContent!, /10 lb each · 1 in × 1 in × 1 in/); details.unmount();
  const snapshot = priceOrder(input, ctx); const before = structuredClone(snapshot);
  render(React.createElement(PriceBreakdown, { snapshot }));
  const user = userEvent.setup({ document }); await user.click(screen.getByRole('button', { name: 'View calculation' }));
  assert.equal(screen.getByText('Chargeable weight').nextElementSibling!.textContent, '10 lb');
  assert.deepEqual(snapshot, before);
});
