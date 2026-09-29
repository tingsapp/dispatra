import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach,test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render: rawRender,screen,cleanup,within,waitFor}=await import('@testing-library/react');

const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const render = (ui: React.ReactElement) => rawRender(React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } } }) }, ui));
const {default:userEvent}=await import('@testing-library/user-event');
const {DriverEditor}=await import('../src/components/entities/DriverEditor');
const {VehicleEditor}=await import('../src/components/entities/VehicleEditor');
const {JobsPage}=await import('../src/pages/JobsPage');
const {CustomersPage}=await import('../src/pages/CustomersPage');
const {OrderPricingForm}=await import('../src/components/pricing/OrderPricingForm');
const {INITIAL_DRIVERS}=await import('../src/data/mockData');
const {normalizeDriver}=await import('../src/lib/driverStorage');
const {driverToUi}=await import('../src/operations/adapters');
const {validateDriver,validateVehicle}=await import('../src/domain/validation');
const {loadSimplePricingConfig}=await import('../src/lib/simplePricingStorage');
const {loadVehicles}=await import('../src/lib/vehicleStorage');
const {loadCustomers}=await import('../src/lib/customerStorage');
const {loadPricingContext,createDefaultOrderInput,priceOrder}=await import('../src/lib/orderPricing');
afterEach(()=>{cleanup();localStorage.clear();});
test('new drivers get the next background driver number; the form has no number field', async()=>{
  const { nextDriverNumber } = await import('../src/lib/driverStorage');
  const existing=INITIAL_DRIVERS.map(d=>normalizeDriver(d));
  assert.equal(nextDriverNumber(existing),'D32'); assert.equal(nextDriverNumber([]),'D01');
  const user=userEvent.setup({document}); let saved:any;
  render(React.createElement(DriverEditor,{drivers:existing,onSave:d=>saved=d,onCancel:()=>{}}));
  assert.equal(screen.queryByLabelText(/Driver number/),null); assert.equal(screen.queryByLabelText('Maximum Active Orders'),null);
  assert.equal(screen.queryByLabelText(/Service areas/),null);
  const address=screen.getByRole('combobox',{name:'Address'}) as HTMLInputElement; assert.equal(address.required,true);
  await user.type(screen.getByLabelText('Driver name'),'New Driver'); await user.type(screen.getByLabelText('Phone'),'604-555-0199'); await user.type(screen.getByLabelText('Email'),'driver@example.ca');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved,undefined); assert.equal(address.checkValidity(),false);
  await user.type(address,'100 Main St, Vancouver, BC V6A 2S5');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.ok(saved,'driver saved'); assert.equal(saved.address,'100 Main St, Vancouver, BC V6A 2S5'); assert.equal(saved.driverNumber,'D32'); assert.equal(saved.id,'D32'); assert.equal(saved.maxActiveOrders,undefined);
});
test('owner-operators get payout share fields; employees do not', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:null,email:'driver@example.ca',address:'100 Main St, Vancouver, BC V6A 2S5'});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  assert.equal(screen.queryByLabelText(/Driver share of order price/),null);
  await user.click(screen.getByRole('combobox',{name:'Employment'})); await user.click(screen.getByRole('option',{name:/Owner-operator/}));
  assert.ok(screen.getByRole('heading',{name:'Payout terms'}));
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
test('driver form: employee or owner-operator, attached vehicle, address and contact; no work/shift/qualification fields', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],shiftStart:undefined,currentVehicleId:null,serviceAreaIds:['Vancouver','Burnaby']});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  await user.clear(screen.getByLabelText('Email')); await user.type(screen.getByLabelText('Email'),'driver@example.test');
  assert.equal(screen.queryByLabelText(/Service areas/),null);
  await user.type(screen.getByRole('combobox',{name:'Address'}),'200 Broadway, Vancouver, BC V5Y 1V4');
  for (const gone of ['Work','Shift starts','Shift ends','Licence class','Qualifications, availability & notes','Current vehicle','Skills (comma separated)']) assert.equal(screen.queryByText(gone),null,gone);
  assert.equal(document.querySelector('details'),null);
  await user.click(screen.getByRole('combobox',{name:'Employment'})); await user.click(screen.getByRole('option',{name:/Owner-operator/}));
  await user.click(screen.getByRole('button',{name:'Attached vehicle'})); const options=screen.getAllByRole('menuitem'); assert.equal(options[0].textContent,'None yet'); await user.click(options[1]);
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.email,'driver@example.test'); assert.equal(saved.address,'200 Broadway, Vancouver, BC V5Y 1V4'); assert.equal(saved.employmentType,'CONTRACTOR'); assert.ok(saved.currentVehicleId); assert.deepEqual(saved.serviceAreaIds,['vancouver']); assert.equal(saved.dutyStatus,driver.dutyStatus);
  assert.equal(normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'TEMPORARY'} as any).employmentType,'EMPLOYEE');
});
test('driver vehicle menu registers and selects a vehicle without losing the new driver draft', async()=>{
  const {DriversPage}=await import('../src/pages/DriversPage');
  const {bindDriverVehicle}=await import('../src/lib/driverStorage'); const {loadVehicles}=await import('../src/lib/vehicleStorage');
  const user=userEvent.setup({document}); let saved:any;
  render(React.createElement(DriversPage,{drivers:[],jobs:[],onSelectDriver:()=>{},onUpdateDriver:()=>{},onCreateDriver:d=>{bindDriverVehicle(d);saved=d;},onNotification:()=>{}}));
  await user.click(screen.getByRole('button',{name:'Add Driver'}));
  await user.type(screen.getByLabelText('Driver name'),'New Driver'); await user.type(screen.getByLabelText('Phone'),'604-555-0199'); await user.type(screen.getByLabelText('Email'),'driver@example.ca');
  await user.type(screen.getByRole('combobox',{name:'Address'}),'100 Main St, Vancouver, BC V6A 2S5');
  assert.equal(screen.queryByLabelText('Maximum Active Orders'),null);
  await user.click(screen.getByRole('button',{name:'Attached vehicle'}));
  const menuItems=screen.getAllByRole('menuitem'); assert.equal(menuItems[0].textContent,'Register new vehicle');
  await user.click(menuItems[0]); assert.ok(screen.getByRole('heading',{name:'Register Vehicle'}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  await user.click(screen.getByRole('combobox',{name:'Vehicle type'})); await user.click(screen.getByRole('option',{name:loadSimplePricingConfig().vehicles.find(type=>type.active)!.name}));
  for (const [label,value] of [['Cargo length (in)','100'],['Cargo width (in)','60'],['Cargo height (in)','60']]) await user.type(screen.getByLabelText(label),value);
  await user.click(screen.getByRole('button',{name:'Save vehicle'}));
  assert.equal(screen.queryByRole('heading',{name:'Register Vehicle'}),null);
  assert.match(screen.getByRole('button',{name:'Attached vehicle'}).textContent!,/V99.*TEST-99/);
  assert.equal((screen.getByLabelText('Driver name') as HTMLInputElement).value,'New Driver');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.ok(saved); assert.equal(saved.maxActiveOrders,undefined); assert.equal(saved.currentVehicleId,loadVehicles().find(v=>v.unitNumber==='V99')?.id);
  assert.equal(loadVehicles().find(v=>v.unitNumber==='V99')?.currentDriverId,saved.id);
});
test('Shipper form saves one complete warehouse address with no Service Area input', async()=>{
  const user=userEvent.setup({document});
  render(React.createElement(CustomersPage,{onBackToMonitor:()=>{}}));
  await user.click(screen.getByRole('button',{name:'New Shipper'}));
  assert.equal(screen.queryByLabelText('Service Area'),null);
  assert.ok(screen.getByText('No card on file'));
  assert.equal((screen.getByRole('button',{name:'Add credit card'}) as HTMLButtonElement).disabled,true);
  assert.equal(screen.queryByLabelText(/Card number|Expiry|CVC/i),null);
  const address=screen.getByLabelText('Warehouse Address') as HTMLInputElement;
  assert.match(address.parentElement!.textContent!,/street, city, province and postal code/i);
  assert.ok(screen.getByRole('textbox',{name:'Shipper name'}));
  assert.ok(screen.getByRole('textbox',{name:'Company name'}));
  assert.equal(screen.queryByRole('textbox',{name:'Contact name'}),null);
  await user.type(screen.getByRole('textbox',{name:'Shipper name'}),'Warehouse Shipper');
  await user.type(screen.getByRole('textbox',{name:'Company name'}),'Warehouse Logistics Ltd');
  await user.type(address,'100 Main St, Vancouver, BC V6A 2S5');
  await user.type(screen.getByRole('textbox',{name:/^Email /}),'warehouse@example.ca');
  await user.click(screen.getByRole('button',{name:'Create Shipper'}));
  const shipper=await waitFor(() => { const saved=loadCustomers().find(customer=>customer.name==='Warehouse Shipper'); assert.ok(saved); return saved; });
  assert.equal(shipper.address,'100 Main St, Vancouver, BC V6A 2S5');
  assert.equal(shipper.legalName,'Warehouse Logistics Ltd');
  assert.equal(shipper.contactName,'Warehouse Shipper');
  assert.equal(shipper.city,'');
  assert.equal(shipper.addresses?.find(item=>item.id===`${shipper.id}-primary`)?.address,shipper.address);
  await user.click(screen.getByRole('button',{name:'New Shipper'}));
  await user.click(screen.getByRole('combobox',{name:'Shipper type'}));
  await user.click(screen.getByRole('option',{name:'Individual'}));
  assert.ok(screen.getByRole('textbox',{name:'Shipper name'}));
  assert.equal(screen.queryByRole('textbox',{name:'Company name'}),null);
  await user.type(screen.getByRole('textbox',{name:'Shipper name'}),'Alex Morgan');
  await user.type(screen.getByRole('textbox',{name:/^Email /}),'alex@example.ca');
  await user.click(screen.getByRole('button',{name:'Create Shipper'}));
  const individual=loadCustomers().find(customer=>customer.name==='Alex Morgan')!;
  assert.equal(individual.customerType,'INDIVIDUAL');
  assert.equal(individual.legalName,'Alex Morgan');
  assert.equal(individual.contactName,'Alex Morgan');
  await user.click(within(screen.getByRole('row',{name:/Pacific Fresh Logistics/})).getByTitle('Edit shipper account'));
  assert.equal((screen.getByRole('textbox',{name:'Company name'}) as HTMLInputElement).value,'Pacific Fresh Logistics');
  assert.equal(screen.queryByRole('textbox',{name:'Contact name'}),null);
  await user.click(screen.getByRole('button',{name:'Save Changes'}));
  assert.equal(loadCustomers().find(customer=>customer.id==='cust-1')?.contactName,'Elena Rostova');
});

test('vehicle form combines type pricing, required dimensions and equipment checkboxes', async()=>{
  const user=userEvent.setup({document}); let saved:any; let profile:any;
  const types=loadSimplePricingConfig().vehicles.filter(type=>type.active);
  render(React.createElement(VehicleEditor,{vehicles:[],onSave:(vehicle,details)=>{saved=vehicle;profile=details;},onCancel:()=>{}}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  assert.equal(screen.queryByRole('combobox',{name:'Record status'}),null); assert.equal(screen.queryByRole('combobox',{name:'Availability'}),null);
  await user.click(screen.getByRole('combobox',{name:'Vehicle type'})); await user.click(screen.getByRole('option',{name:types[1].name}));
  assert.equal(screen.queryByLabelText('Vehicle class name'),null);
  assert.equal(screen.queryByLabelText('Vehicle class description'),null);
  assert.ok(screen.getByLabelText('Vehicle description'));
  for (const label of ['Cargo length (in)','Cargo width (in)','Cargo height (in)']) assert.equal((screen.getByLabelText(label) as HTMLInputElement).value,'');
  const maxStops=screen.getByRole('spinbutton',{name:'Maximum stops'}) as HTMLInputElement; assert.equal(maxStops.value,''); assert.equal(maxStops.placeholder,'No limit');
  await user.click(screen.getByRole('button',{name:'Save vehicle'})); assert.equal(saved,undefined);
  for (const [label,value] of [['Cargo length (in)','100'],['Cargo width (in)','60'],['Cargo height (in)','55']]) await user.type(screen.getByLabelText(label),value);
  await user.type(maxStops,'12');
  await user.click(screen.getByRole('checkbox',{name:'Liftgate'}));
  await user.click(screen.getByRole('checkbox',{name:'Refrigeration'}));
  for (const label of ['Vehicle upgrade surcharge ($)', 'Surcharge is fuel-eligible', 'Requires commercial driver licence']) assert.equal(screen.queryByLabelText(label),null);
  await user.clear(screen.getByLabelText('Running cost / km (internal)')); await user.type(screen.getByLabelText('Running cost / km (internal)'),'1.25');
  await user.type(screen.getByLabelText('Vehicle description'),'Reefer unit');
  await user.click(screen.getByRole('button',{name:'Save vehicle'}));
  assert.ok(saved); assert.equal(saved.vehicleTypeId,`fleet_${saved.id}`); assert.equal(saved.payloadCapacityKg,types[1].payloadCapacityKg);
  assert.equal(saved.palletCapacity,types[1].palletCapacity); assert.equal(saved.maxStops,12); assert.equal(saved.notes,'Reefer unit'); assert.equal(saved.hasLiftgate,true); assert.equal(saved.hasReefer,true);
  assert.match(validateVehicle({...saved,maxStops:0},[]).join(' '),/Maximum stops/);
  assert.match(validateVehicle({...saved,maxStops:1.5},[]).join(' '),/Maximum stops/);
  assert.equal(profile.type.name,types[1].name); assert.equal(profile.type.description,types[1].description);
  assert.equal(profile.type.baseSurcharge,types[1].baseSurcharge); assert.equal(profile.type.fuelEligible,types[1].fuelEligible); assert.equal(profile.type.requiresCommercialLicense,types[1].requiresCommercialLicense); assert.equal(profile.costPerKm,1.25); assert.equal(Math.round(saved.cargoLengthCm),254);
  const {saveVehicleProfile}=await import('../src/lib/vehicleStorage'); saveVehicleProfile(saved,profile,[]); assert.equal(loadVehicles()[0].maxStops,12);
});
test('multi-stop editor: inline contact and phone per stop, ready-at sets the schedule, added pickups keep item links', async()=>{
  const ctx=loadPricingContext(); const initial=createDefaultOrderInput(ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);return React.createElement(OrderPricingForm,{value,ctx,snapshot:priceOrder(value,ctx),showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  assert.equal(document.querySelector('details:not([open]) summary')?.textContent?.includes('Accessorials'),true); assert.equal(screen.queryByText('Contact, time window & delivery requirements'),null); assert.equal(screen.queryByRole('button',{name:/Move stop/}),null); assert.equal(screen.queryByRole('combobox',{name:'Zone'}),null); assert.equal(screen.queryByLabelText('Wait minutes'),null); assert.match(screen.getByText(/Package weight and dimensions do not change this rate card’s base price/i).textContent!,/do not change this rate card/);
  await user.type(screen.getByLabelText('Stop 1 contact name'),'Recipient One'); await user.type(screen.getByLabelText('Stop 1 phone'),'604-555-0100');
  await user.click(screen.getByRole('button',{name:'+ Pickup'})); assert.equal(changed.stops.length,3); assert.equal(changed.stops[2].type,'PICKUP');
  assert.equal(changed.stops[0].contactName,'Recipient One'); assert.equal(changed.stops[0].contactPhone,'604-555-0100'); assert.equal(changed.packages[0].deliveryStopId,initial.stops[1].id);
  assert.ok(screen.getByRole('combobox',{name:'Package 1 pickup'})); assert.ok(screen.getByText('Picked up at:'));
  const qty=screen.getByRole('spinbutton',{name:'Package 1 quantity'}); await user.tripleClick(qty); await user.keyboard('3'); assert.equal(changed.packages[0].quantity,3);
  assert.equal(screen.queryByRole('checkbox',{name:'Residential'}),null);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 fragile'})); assert.equal(changed.packages[0].fragile,true);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 dangerous goods'})); assert.deepEqual(changed.packages[0].handlingTags,['DANGEROUS_GOODS']);
  assert.equal((screen.getByRole('checkbox',{name:'Package 1 dangerous goods'}) as HTMLInputElement).checked,true);
});
test('order create, detail, edit and save retain operational and stop data', async()=>{
  const {loadBillingConfig,saveBillingConfig}=await import('../src/lib/billingStorage'); const billing=loadBillingConfig(); billing.invoicing.taxRegistrationStatus='REGISTERED'; billing.invoicing.taxRegistrationNumber='123456789RT0001'; saveBillingConfig(billing);
  const user=userEvent.setup({document});let created:any;let updated:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{ jobs, drivers:[], onSelectJob:()=>{}, onNotification:m=>notices.push(m), onCreateJob:j=>{created=j;setJobs([j]);}, onUpdateJob:j=>{updated=j;setJobs([j]);} });}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  for (const gone of ['Order Number','Shipper Name (walk-in)','Contact Phone','Reference / PO numbers','Commodity description','Freight tax treatment','Route & Schedule']) assert.equal(screen.queryByText(gone),null,gone);
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.equal(created,undefined); assert.match(notices.at(-1)!,/Choose a shipper/);
  await user.click(screen.getByRole('combobox',{name:'Shipper'})); await user.click(screen.getAllByRole('option')[1]);
  assert.ok((screen.getAllByLabelText('Stop address')[0] as HTMLInputElement).value);
  await user.clear(screen.getAllByLabelText('Stop address')[0]); await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5'); await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  assert.match(screen.getByText(/calculated from the stop addresses/).textContent!,/routing is connected/); assert.equal(screen.queryByLabelText('Route distance'),null);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 dangerous goods'}));
  await user.click(screen.getByRole('button',{name:'Create Order'})); assert.ok(created,notices.join(' ')); assert.match(created.jobNumber,/^#\d+$/); assert.equal(created.pricingInput.routeKm,null); assert.equal(created.pricing.status,'NEEDS_ATTENTION'); assert.equal(created.pricing.taxDecision.ruleVersion,'company-tax-v2'); assert.equal(created.lifecycleStatus,'NEW'); assert.equal(created.pricingInput.stops.length,2); assert.deepEqual(created.pricingInput.packages[0].handlingTags,['DANGEROUS_GOODS']); assert.ok(created.customerSnapshot?.id);
  await user.click(screen.getAllByText(created.jobNumber)[0]); assert.ok(screen.getByRole('table',{name:'Order packages'}).textContent?.includes('DG'));
  const detailPrice=screen.getByText('Price').closest('section')!; assert.ok(within(detailPrice).getByText('Total')); assert.equal(within(detailPrice).queryByRole('button',{name:'View calculation'}),null);
  await user.click(screen.getByRole('button',{name:'Edit order'}));
  assert.equal(screen.queryByRole('combobox',{name:'Priority'}),null);
  await user.click(screen.getByRole('button',{name:'Save Order'})); assert.ok(updated,notices.join(' ')); assert.equal(updated.priority,'NORMAL'); assert.equal(updated.jobNumber,created.jobNumber); assert.equal(updated.id,created.id); assert.equal(updated.version,2); assert.deepEqual(updated.customerSnapshot,created.customerSnapshot);
});

test('order address entry retains the company rate without province tax prompts', async()=>{
  const ctx=loadPricingContext(); ctx.billing.invoicing.taxRegistrationStatus='REGISTERED'; ctx.billing.invoicing.taxRegistrationNumber='123456789RT0001';
  const initial={...createDefaultOrderInput(ctx),routeKm:15,estimatedMinutes:40}; let latest=priceOrder(initial,ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);latest=priceOrder(value,ctx);return React.createElement(OrderPricingForm,{value,ctx,snapshot:latest,showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5');
  await user.type(screen.getAllByLabelText('Stop address')[1],'200 Main St, Vancouver BC V6A 2S5');
  assert.equal(latest.status,'PRICED',JSON.stringify(latest.errors)); assert.equal(latest.taxDecision?.ruleVersion,'company-tax-v2');
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
  const row=screen.getByText('#900').closest('tr')!; assert.ok(within(row.cells[0]).getByText('Invoice')); assert.ok(within(row).getByRole('button',{name:/Invoice/}));
  const openRow=screen.getByText('#901').closest('tr')!; assert.equal(within(openRow.cells[0]).queryByText('Invoice'),null); assert.equal(within(openRow).queryByRole('button',{name:/Invoice/}),null);
  await user.click(within(row).getByRole('button',{name:/Invoice/}));
  assert.equal(updated.lifecycleStatus,'INVOICED'); assert.match(notices.at(-1)!,/#900 invoiced/);
  cleanup(); render(React.createElement(JobsPage,{jobs:[updated,open],drivers:[],onSelectJob:()=>{},onUpdateJob:()=>{},onCreateJob:()=>{},onNotification:()=>{}}));
  const after=screen.getByText('#900').closest('tr')!; assert.ok(within(after.cells[0]).getByText('Invoiced')); assert.equal(within(after.cells[0]).queryByText('Invoice'),null); assert.equal(within(after).queryByRole('button',{name:/Invoice$/}),null);
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
  const {DriversPage}=await import('../src/pages/DriversPage'); const user=userEvent.setup({document}); const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',revenueSharePercent:65,fuelSurchargeSharePercent:100,currentVehicleId:null});
  render(React.createElement(DriversPage,{ drivers:[driver], jobs:[], onSelectDriver:()=>{}, onUpdateDriver:()=>{}, onCreateDriver:()=>{}, onNotification:()=>{} }));
  assert.ok(screen.getByRole('table',{name:'Drivers'})); assert.equal(screen.queryByTitle('Grid Cards View'),null);
  const details=screen.getByRole('button',{name:`Details for ${driver.name}`}); await user.click(details); assert.ok(screen.getByLabelText('Email')); assert.ok(screen.getByLabelText('Maximum Active Orders')); assert.ok(screen.getByRole('heading',{name:'Payout terms'})); assert.equal((screen.getByLabelText(/Driver share of order price/) as HTMLInputElement).value,'65'); await user.keyboard('{Escape}'); assert.equal(screen.queryByLabelText('Email'),null); assert.equal(document.activeElement,details);
});
test('vehicle table opens the vehicle editor with status and equipment details', async()=>{
  const {VehiclesPage}=await import('../src/pages/VehiclesPage'); const vehicle=loadVehicles()[0]; const user=userEvent.setup({document});
  render(React.createElement(VehiclesPage,{ drivers:[], onNotification:()=>{} }));
  assert.ok(screen.getByRole('table',{name:'Vehicles'})); const details=screen.getByRole('button',{name:`Details for ${vehicle.unitNumber}`}); await user.click(details); assert.ok(screen.getByRole('combobox',{name:'Availability'})); assert.ok(screen.getByRole('checkbox',{name:'Liftgate'})); await user.keyboard('{Escape}'); assert.equal(screen.queryByRole('combobox',{name:'Availability'}),null); assert.equal(document.activeElement,details);
});
test('postal-code zone matching accepts full codes and a configured FSA without guessing ambiguous zones', async()=>{
  const { zoneForAddress } = await import('../src/lib/zoneAddress');
  const zones = [
    { id: 'full', code: 'FULL', name: 'Full', postalCodes: ['V5Y 1V4'] },
    { id: 'fsa', code: 'FSA', name: 'FSA', postalCodes: ['V6A'] },
    { id: 'zip', code: 'ZIP', name: 'ZIP', postalCodes: ['00501'] },
  ];
  assert.equal(zoneForAddress('200 Broadway, Vancouver BC V5Y 1V4', zones), 'full');
  assert.equal(zoneForAddress('200 Broadway, Vancouver BC V5Y 1V4', [...zones, { id: 'broad', code: 'BROAD', name: 'Broad', postalCodes: ['V5Y'] }]), 'full');
  assert.equal(zoneForAddress('100 Main St, Vancouver BC V6A 2S5', zones), 'fsa');
  assert.equal(zoneForAddress('New York NY 00501', zones), 'zip');
  assert.equal(zoneForAddress('No postal code', zones), null);
  assert.equal(zoneForAddress('200 Broadway, Vancouver BC V5Y 1V4', [...zones, { id: 'duplicate', code: 'DUP', name: 'Duplicate', postalCodes: ['V5Y1V4'] }]), null);
});

test('zone-priced orders infer destination zones from postal codes without zone selectors', async()=>{
  const {loadCustomers,saveCustomers}=await import('../src/lib/customerStorage'); const {loadPricingConfig}=await import('../src/lib/pricingStorage');
  const zoneCard=loadPricingConfig().rateCards.find(c=>c.pricingMethod==='ZONE')!; const customers=loadCustomers(); customers[0].rateCardId=zoneCard.id; saveCustomers(customers);
  const user=userEvent.setup({document});let created:any;const notices:string[]=[];
  function Page(){const [jobs,setJobs]=React.useState<any[]>([]);return React.createElement(JobsPage,{ jobs, drivers:[], onSelectJob:()=>{}, onNotification:m=>notices.push(m), onCreateJob:j=>{created=j;setJobs([j]);}, onUpdateJob:()=>{} });}
  render(React.createElement(Page)); await user.click(screen.getByRole('button',{name:'New Order'}));
  await user.click(screen.getByRole('combobox',{name:'Shipper'})); await user.click(screen.getByRole('option',{name:customers[0].name}));
  assert.equal(screen.queryByRole('combobox',{name:/Zone|Delivery zone/}),null);
  await user.clear(screen.getAllByLabelText('Stop address')[0]); await user.type(screen.getAllByLabelText('Stop address')[0],'100 Main St, Vancouver BC V6A 2S5');
  await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1P3');
  assert.ok(screen.getByText(/No pricing zone matches this postal code/));
  await user.clear(screen.getAllByLabelText('Stop address')[1]);
  await user.type(screen.getAllByLabelText('Stop address')[1],'200 Broadway, Vancouver BC V5Y 1V4');
  assert.ok(screen.getByText('Pricing zone: Zone 1'));
  await user.click(screen.getByRole('button',{name:'Create Order'}));
  assert.ok(created,notices.join(' ')); assert.equal(created.pricingInput.stops[1].zoneId,'zone_1'); assert.equal(created.pricing.status,'PRICED');
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
  assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value, '22.0');
  assert.equal((screen.getByLabelText('Package 2 weight') as HTMLInputElement).value, '22.0');
  await user.clear(screen.getByLabelText('Package 1 weight')); await user.type(screen.getByLabelText('Package 1 weight'), '100');
  assert.ok(Math.abs(changed.packages[0].weightKg - 45.359237) < 1e-8);
  assert.equal(changed.packages[1].weightKg, 10);
  const after = structuredClone(changed);
  ctx.billing.general.weightUnit = 'kg';
  view.rerender(React.createElement(Form));
  assert.deepEqual(changed, after);
  assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value, '45.4');
});

test('editing a vehicle exposes status and re-derives capacity from its type', async () => {
  const user = userEvent.setup({ document }); let saved: any;
  const vehicle = loadVehicles()[0]; const type = loadSimplePricingConfig().vehicles.find(t => t.id === vehicle.vehicleTypeId)!;
  render(React.createElement(VehicleEditor, { vehicle: { ...vehicle, cargoLengthCm: 254, cargoWidthCm: 127, cargoHeightCm: 101.6, payloadCapacityKg: 1 }, vehicles: [vehicle], onSave: value => { saved = value; }, onCancel: () => {} }));
  assert.ok(screen.getByRole('combobox', { name: 'Record status' })); assert.ok(screen.getByRole('combobox', { name: 'Availability' }));
  assert.ok(screen.getByLabelText('Max payload'));
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
  const vehicle = { ...loadVehicles()[0], payloadCapacityKg: 45.359237, maxStops: 12 };
  const list = render(React.createElement(VehicleTable, { vehicles: [vehicle], drivers: [], vehicleTypes: [], onDetails: () => {} }));
  assert.match(screen.getByRole('table', { name: 'Vehicles' }).textContent!, /100 lb/); assert.match(screen.getByRole('table', { name: 'Vehicles' }).textContent!, /12 stops max/); list.unmount();
  const ctx = loadPricingContext(); const input = createDefaultOrderInput(ctx); input.routeKm = 1.609344;
  Object.assign(input.packages[0], { quantity: 1, weightKg: 4.5359237, lengthCm: 2.54, widthCm: 2.54, heightCm: 2.54 });
  const details = render(React.createElement(OrderDetails, { order: { ...({} as any), pricingInput: input } }));
  assert.match(screen.getByText(/lb each/).textContent!, /10 lb each · 1 in × 1 in × 1 in/); details.unmount();
  const snapshot = priceOrder(input, ctx); const before = structuredClone(snapshot);
  render(React.createElement(PriceBreakdown, { snapshot }));
  assert.equal(screen.queryByRole('button', { name: 'View calculation' }), null);
  assert.ok(screen.getByText('Charge Lines'));
  assert.deepEqual(snapshot, before);
});
test('driver details show all-time completed activity and saved owner-operator estimates', async()=>{
  const {DriversPage}=await import('../src/pages/DriversPage');
  const {freezeCompletedOrder}=await import('../src/lib/driverPayout');
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',revenueSharePercent:65,fuelSurchargeSharePercent:80,currentVehicleId:null,routeId:undefined});
  const assigned:any={id:'J-PAYOUT',jobNumber:'#990',customerName:'Acme',status:'assigned',lifecycleStatus:'ASSIGNED',assignedDriverId:driver.id,pricing:{status:'PRICED',stage:'QUOTE',currency:'CAD',serviceFreight:120,fuelSurcharge:15}};
  const done=freezeCompletedOrder(assigned,{...assigned,status:'completed',lifecycleStatus:'COMPLETED'},[driver],new Date('2025-01-22T12:00:00Z'));
  const user=userEvent.setup({document});
  render(React.createElement(DriversPage,{drivers:[driver],jobs:[done],onSelectDriver:()=>{},onUpdateDriver:()=>{},onCreateDriver:()=>{},onNotification:()=>{}}));
  await user.click(screen.getByRole('button',{name:`Details for ${driver.name}`}));
  const activity=screen.getByRole('region',{name:'Activity & Earnings'});
  assert.equal(within(activity).queryByRole('button'),null);
  assert.match(activity.textContent!,/Orders completed1/);
  assert.match(activity.textContent!,/Estimated earnings\$90\.00/);
  assert.equal(within(activity).queryByRole('region',{name:'Completed driver orders'}),null);
  assert.equal(screen.queryByText('#990'),null);
  assert.equal(screen.queryByRole('heading',{name:'Profile'}),null);
  const profile=screen.getByRole('region',{name:'Driver profile'});
  assert.ok(profile.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING);
  for (const [label,value] of [['App connectivity','Unknown'],['App last seen','Not set'],['GPS captured','Not set'],['Location permission','UNKNOWN'],['Current route','Not set']]) assert.equal(within(activity).getByText(label).nextElementSibling?.textContent,value);
  assert.ok(screen.getByRole('button',{name:'Save driver'}));
});
test('Monitor driver details shows Activity & Earnings immediately', async()=>{
  const {DetailModalDialog}=await import('../src/components/DetailModalDialog');
  const {freezeCompletedOrder}=await import('../src/lib/driverPayout');
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',revenueSharePercent:65,fuelSurchargeSharePercent:80,routeId:undefined});
  const assigned:any={id:'J-MONITOR',jobNumber:'#991',customerName:'Acme',status:'assigned',lifecycleStatus:'ASSIGNED',assignedDriverId:driver.id,pricing:{status:'PRICED',stage:'QUOTE',currency:'CAD',serviceFreight:120,fuelSurcharge:15}};
  const done=freezeCompletedOrder(assigned,{...assigned,status:'completed',lifecycleStatus:'COMPLETED'},[driver],new Date('2025-01-22T12:00:00Z'));
  render(React.createElement(DetailModalDialog,{isOpen:true,type:'driver_detail',data:driver,jobs:[done],onClose:()=>{},onActionNotification:()=>{}}));
  const activity=screen.getByRole('region',{name:'Activity & Earnings'});
  assert.equal(within(activity).queryByRole('button'),null);
  assert.match(activity.textContent!,/Orders completed1/);
  assert.match(activity.textContent!,/Estimated earnings\$90\.00/);
  assert.equal(within(activity).queryByRole('region',{name:'Completed driver orders'}),null);
  assert.equal(screen.queryByText('#991'),null);
  const profile=screen.getByRole('region',{name:'Driver profile'});
  assert.ok(profile.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(within(profile).getByText('Employment').nextElementSibling?.textContent,'Owner-operator');
  assert.equal(within(profile).getByText('Driver share of order price').nextElementSibling?.textContent,'65%');
  for (const mock of ['HOS Remaining','Rating & Score','Speed & Heading','License Class']) assert.equal(screen.queryByText(mock),null);
  for (const [label,value] of [['App connectivity','Unknown'],['App last seen','Not set'],['GPS captured','Not set'],['Location permission','UNKNOWN'],['Current route','Not set']]) assert.equal(within(activity).getByText(label).nextElementSibling?.textContent,value);
});


test('live Driver edit reloads duty from the saved API status',()=>{
  const row = { id: 'driver-id', number: 'D01', name: 'Dana Driver', email: 'dana@example.ca', phone: '6045550102', active: true,
    on_duty: true, vehicle_id: null, address: { text: '123 Main, Vancouver, BC V5Y 1V4', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', country: 'CA' },
    data: { employment: 'EMPLOYEE' }, location_permission: 'UNKNOWN', last_seen_at: null, created_at: new Date().toISOString() } as unknown as Parameters<typeof driverToUi>[0];
  assert.equal(driverToUi(row).dutyStatus, 'ON_DUTY');
  assert.equal(driverToUi(row).status, 'available');
  assert.equal(driverToUi({ ...row, on_duty: false }).dutyStatus, 'OFF_DUTY');
  assert.equal(driverToUi({ ...row, on_duty: false }).status, 'offline');
});

test('Monitor assignment shows off-duty movers with a reason and only assigns an available selection', async()=>{
  const { JobDetailPopover } = await import('../src/components/JobDetailPopover');
  const { INITIAL_JOBS } = await import('../src/data/mockData');
  const off = normalizeDriver({ ...INITIAL_DRIVERS[0], id: 'off', driverNumber: 'DDD-1001', name: 'Off Duty Mover', dutyStatus: 'OFF_DUTY', status: 'offline', accountStatus: 'ACTIVE', currentVehicleId: 'vehicle-one' });
  const available = normalizeDriver({ ...INITIAL_DRIVERS[1], id: 'ready', driverNumber: 'DDD-1002', name: 'Available Mover', dutyStatus: 'ON_DUTY', status: 'available', accountStatus: 'ACTIVE', currentVehicleId: 'vehicle-two' });
  let assigned = '';
  render(React.createElement(JobDetailPopover, { job: { ...INITIAL_JOBS[0], lifecycleStatus: 'NEW' }, live: true, drivers: [off, available], showAssignDriver: true, showAiRecommendation: false, setShowAssignDriver: ()=>{}, setShowAiRecommendation: ()=>{}, onClose: ()=>{}, onApproveRecommendation: ()=>{}, onKeepCurrent: ()=>{}, onActionNotification: ()=>{}, onAssignDriver: id=>{assigned=id;} }));
  const user = userEvent.setup({ document });
  assert.equal((screen.getByRole('button', { name: /DDD-1001/ }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByRole('button', { name: /DDD-1001/ }).textContent!, /Off duty/);
  const assign = screen.getByRole('button', { name: 'Assign selected driver' }) as HTMLButtonElement;
  assert.equal(assign.disabled, true);
  await user.click(screen.getByRole('button', { name: /DDD-1002/ }));
  assert.equal(assign.disabled, false);
  await user.click(assign);
  assert.equal(assigned, 'ready');
});
