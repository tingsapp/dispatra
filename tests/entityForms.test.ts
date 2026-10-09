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
const {OrderDossierSections}=await import('../src/components/orders/OrderDossierSections');
const {INITIAL_DRIVERS}=await import('../src/data/mockData');
const {normalizeDriver}=await import('../src/lib/driverStorage');
const {driverToUi,driverFromUi}=await import('../src/operations/adapters');
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
  const dg=screen.getByRole('checkbox',{name:/Qualified to handle dangerous goods/}) as HTMLInputElement;
  assert.equal(dg.checked,false);
  const address=screen.getByRole('combobox',{name:'Address'}) as HTMLInputElement; assert.equal(address.required,true);
  await user.type(screen.getByLabelText('Driver name'),'New Driver'); await user.type(screen.getByLabelText('Phone'),'604-555-0199'); await user.type(screen.getByLabelText('Email'),'driver@example.ca');
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved,undefined); assert.equal(address.checkValidity(),false);
  await user.type(address,'100 Main St, Vancouver, BC V6A 2S5');
  await user.click(dg);
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.ok(saved,'driver saved'); assert.equal(saved.address,'100 Main St, Vancouver, BC V6A 2S5'); assert.equal(saved.driverNumber,'D32'); assert.equal(saved.id,'D32'); assert.equal(saved.maxActiveOrders,undefined);
  assert.deepEqual(saved.skills,['DG']); assert.deepEqual(driverFromUi(saved).qualifications,['DG']);
});
test('driver form has no employment, payout or earnings fields and keeps the saved employment', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',currentVehicleId:null,email:'driver@example.ca',address:'100 Main St, Vancouver, BC V6A 2S5'});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  assert.equal(screen.queryByRole('combobox',{name:'Employment'}),null); assert.equal(screen.queryByRole('heading',{name:'Payout terms'}),null); assert.equal(screen.queryByLabelText(/Driver share/),null);
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.employmentType,'CONTRACTOR'); assert.equal('revenueSharePercent' in saved,false);
});
test('driver form: attached vehicle, address, contact and DG qualification; no generic work or shift fields', async()=>{
  const user=userEvent.setup({document}); let saved:any;
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',shiftStart:undefined,currentVehicleId:null,serviceAreaIds:['Vancouver','Burnaby'],skills:['Furniture','DG']});
  render(React.createElement(DriverEditor,{driver,drivers:[driver],onSave:d=>saved=d,onCancel:()=>{}}));
  const dg=screen.getByRole('checkbox',{name:/Qualified to handle dangerous goods/}) as HTMLInputElement;
  assert.equal(dg.checked,true); await user.click(dg);
  await user.clear(screen.getByLabelText('Email')); await user.type(screen.getByLabelText('Email'),'driver@example.test');
  assert.equal(screen.queryByLabelText(/Service areas/),null);
  await user.type(screen.getByRole('combobox',{name:'Address'}),'200 Broadway, Vancouver, BC V5Y 1V4');
  for (const gone of ['Work','Shift starts','Shift ends','Licence class','Qualifications, availability & notes','Current vehicle','Skills (comma separated)']) assert.equal(screen.queryByText(gone),null,gone);
  assert.equal(document.querySelector('details'),null);
  await user.click(screen.getByRole('button',{name:'Attached vehicle'})); const options=screen.getAllByRole('menuitem'); assert.equal(options[0].textContent,'None yet'); await user.click(options[1]);
  await user.click(screen.getByRole('button',{name:'Save driver'}));
  assert.equal(saved.email,'driver@example.test'); assert.equal(saved.address,'200 Broadway, Vancouver, BC V5Y 1V4'); assert.equal(saved.employmentType,'CONTRACTOR'); assert.ok(saved.currentVehicleId); assert.deepEqual(saved.serviceAreaIds,['vancouver']); assert.equal(saved.dutyStatus,driver.dutyStatus);
  assert.deepEqual(saved.skills,['Furniture']); assert.deepEqual(driverFromUi(saved).qualifications,['Furniture']);
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
  for (const [label,value] of [['Box length (in)','100'],['Box width (in)','60'],['Box height (in)','60']]) await user.type(screen.getByLabelText(label),value);
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
  assert.equal(screen.queryByText('Credit card'),null); assert.equal(screen.queryByRole('button',{name:'Add credit card'}),null);
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
  const chosen=loadSimplePricingConfig().vehicles.find(type=>type.name==='Cube Van')!; const types=[chosen,chosen];
  render(React.createElement(VehicleEditor,{vehicles:[],onSave:(vehicle,details)=>{saved=vehicle;profile=details;},onCancel:()=>{}}));
  await user.type(screen.getByLabelText('Unit number'),'V99'); await user.type(screen.getByLabelText('Licence plate'),'TEST-99');
  assert.equal(screen.queryByRole('combobox',{name:'Record status'}),null); assert.equal(screen.queryByRole('combobox',{name:'Availability'}),null);
  await user.click(screen.getByRole('combobox',{name:'Vehicle type'})); await user.click(screen.getByRole('option',{name:types[1].name}));
  assert.equal(screen.queryByLabelText('Vehicle class name'),null);
  assert.equal(screen.queryByLabelText('Vehicle class description'),null);
  assert.ok(screen.getByLabelText('Description')); assert.equal(screen.queryByRole('checkbox',{name:'Refrigeration'}),null);
  for (const [label,cm] of [['Box length (in)',types[1].cargoLengthCm],['Box width (in)',types[1].cargoWidthCm],['Box height (in)',types[1].cargoHeightCm]] as const) { const input=screen.getByLabelText(label) as HTMLInputElement; assert.equal(Number(input.value),Number((cm!/2.54).toFixed(6))); await user.clear(input); }
  const maxStops=screen.getByRole('spinbutton',{name:'Maximum stops'}) as HTMLInputElement; assert.equal(maxStops.value,''); assert.equal(maxStops.placeholder,'No limit');
  await user.click(screen.getByRole('button',{name:'Save vehicle'})); assert.equal(saved,undefined);
  for (const [label,value] of [['Box length (in)','100'],['Box width (in)','60'],['Box height (in)','55']]) await user.type(screen.getByLabelText(label),value);
  await user.type(maxStops,'12');
  await user.click(screen.getByRole('checkbox',{name:'Liftgate'}));
  for (const label of ['Vehicle upgrade surcharge ($)', 'Surcharge is fuel-eligible', 'Requires commercial driver licence']) assert.equal(screen.queryByLabelText(label),null);
  assert.equal(screen.queryByLabelText('Running cost / km (internal)'),null);
  await user.type(screen.getByLabelText('Description'),'Reefer unit');
  await user.click(screen.getByRole('button',{name:'Save vehicle'}));
  assert.ok(saved); assert.equal(saved.vehicleTypeId,`fleet_${saved.id}`); assert.equal(saved.payloadCapacityKg,types[1].payloadCapacityKg);
  assert.equal(saved.palletCapacity,types[1].palletCapacity); assert.equal(saved.maxStops,12); assert.equal(saved.notes,'Reefer unit'); assert.equal(saved.hasLiftgate,true); assert.equal(saved.hasReefer,false);
  assert.match(validateVehicle({...saved,maxStops:0},[]).join(' '),/Maximum stops/);
  assert.match(validateVehicle({...saved,maxStops:1.5},[]).join(' '),/Maximum stops/);
  assert.equal(profile.type.name,types[1].name); assert.equal(profile.type.description,types[1].description);
  assert.equal(profile.type.baseSurcharge,types[1].baseSurcharge); assert.equal(profile.type.fuelEligible,types[1].fuelEligible); assert.equal(profile.type.requiresCommercialLicense,types[1].requiresCommercialLicense); assert.equal(profile.costPerKm,(await import('../src/lib/billingStorage')).loadBillingConfig().operatingCost.costPerKmByVehicleId[types[1].id]??null); assert.equal(Math.round(saved.cargoLengthCm),254);
  const {saveVehicleProfile}=await import('../src/lib/vehicleStorage'); saveVehicleProfile(saved,profile,[]); assert.equal(loadVehicles()[0].maxStops,12);
});
test('multi-stop editor: inline contact and phone per stop, ready-at sets the schedule, added pickups keep item links', async()=>{
  const ctx=loadPricingContext(); const initial=createDefaultOrderInput(ctx); let changed=initial;
  function Form(){const [value,setValue]=React.useState(initial);return React.createElement(OrderPricingForm,{value,ctx,snapshot:priceOrder(value,ctx),showStopAddresses:true,onChange:v=>{changed=v;setValue(v);}});}
  const user=userEvent.setup({document});render(React.createElement(Form));
  for (const heading of ['Shipper, Service & Vehicle', 'Stops', 'Packages']) assert.ok(screen.getByRole('heading',{name:heading}));
  assert.ok(screen.getByText('Pickup')); assert.ok(screen.getByText('Drop-off'));
  assert.equal(screen.queryByText(/^\d+ · (Pickup|Drop-off)$/),null);
  assert.equal(screen.getByRole('button',{name:'Stop 1 ready at date: Date'}).textContent?.trim().includes('Date'),true);
  assert.equal(screen.getByRole('button',{name:'Stop 2 deliver by date: Date'}).textContent?.trim().includes('Date'),true);
  assert.equal(document.querySelector('details:not([open]) summary')?.textContent?.includes('Accessorials'),true); assert.equal(screen.queryByText('Contact, time window & delivery requirements'),null); assert.equal(screen.queryByRole('button',{name:/Move stop/}),null); assert.equal(screen.queryByRole('combobox',{name:'Zone'}),null); assert.equal(screen.queryByLabelText('Wait minutes'),null); assert.match(screen.getByText(/Package weight and dimensions do not change this rate card’s base price/i).textContent!,/do not change this rate card/);
  await user.type(screen.getByLabelText('Stop 1 contact name'),'Recipient One'); await user.type(screen.getByLabelText('Stop 1 phone'),'604-555-0100');
  await user.click(screen.getByRole('button',{name:'+ Pickup'})); assert.equal(changed.stops.length,3); assert.equal(changed.stops[2].type,'PICKUP');
  assert.equal(changed.stops[0].contactName,'Recipient One'); assert.equal(changed.stops[0].contactPhone,'(604) 555-0100'); assert.equal(changed.packages[0].deliveryStopId,initial.stops[1].id);
  assert.ok(screen.getByRole('combobox',{name:'Package 1 pickup'})); assert.ok(screen.getByText('Picked up at:'));
  const qty=screen.getByRole('spinbutton',{name:'Package 1 quantity'}); await user.tripleClick(qty); await user.keyboard('3'); assert.equal(changed.packages[0].quantity,3);
  assert.equal(screen.queryByRole('checkbox',{name:'Residential'}),null);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 fragile'})); assert.equal(changed.packages[0].fragile,true);
  assert.equal(changed.accessorials.find(a => a.accessorialId === ctx.catalogue.accessorials.find(item => item.code === 'FRAGILE')?.id)?.quantity,3);
  await user.click(screen.getByRole('checkbox',{name:'Package 1 dangerous goods'})); assert.deepEqual(changed.packages[0].handlingTags,['DANGEROUS_GOODS']);
  assert.equal(changed.accessorials.find(a => a.accessorialId === ctx.catalogue.accessorials.find(item => item.code === 'DG')?.id)?.quantity,3);
  assert.equal((screen.getByRole('checkbox',{name:'Package 1 dangerous goods'}) as HTMLInputElement).checked,true);
  await user.click(screen.getByText('Accessorials'));
  assert.equal((screen.getByRole('checkbox',{name:/^Fragile/}) as HTMLInputElement).checked,true);
  assert.equal((screen.getByRole('checkbox',{name:/^DG/}) as HTMLInputElement).checked,true);
  await user.click(screen.getByRole('checkbox',{name:/^DG/}));
  assert.equal(changed.packages[0].handlingTags?.includes('DANGEROUS_GOODS'),false);
  assert.equal(changed.accessorials.some(a => a.accessorialId === ctx.catalogue.accessorials.find(item => item.code === 'DG')?.id),false);
});
test('new order drop-off calendar begins at its linked pickup date', async()=>{
  const ctx=loadPricingContext(); const initial=createDefaultOrderInput(ctx);
  const zone=ctx.billing.general.timeZone ?? 'America/Vancouver';
  const {organizationTime}=await import('../src/lib/organizationWorkflows');
  const today=organizationTime(new Date(),zone)!.day;
  const tomorrow=new Date(Date.parse(`${today}T12:00:00Z`)+86400000).toISOString().slice(0,10);
  initial.stops[0].windowStart=`${tomorrow}T10:00`;
  initial.scheduledAt=initial.stops[0].windowStart;
  const user=userEvent.setup({document});
  render(React.createElement(OrderPricingForm,{value:initial,ctx,snapshot:priceOrder(initial,ctx),futureOnly:true,onChange:()=>{}}));
  await user.click(screen.getByRole('button',{name:'Stop 2 deliver by date: Date'}));
  assert.equal((screen.getByRole('button',{name:'Today'}) as HTMLButtonElement).disabled,true);
});
test('dispatcher adds an accessorial from the order form and selects it in the current draft', async()=>{
  const user=userEvent.setup({document});
  render(React.createElement(JobsPage,{jobs:[],drivers:[],onSelectJob:()=>{},onUpdateJob:()=>{},onCreateJob:()=>{},onNotification:()=>{}}));
  await user.click(screen.getByRole('button',{name:/Create Order|New Order/}));
  await user.click(screen.getByText('Accessorials'));
  await user.click(screen.getByRole('button',{name:/Add accessorial/}));
  await user.type(screen.getByLabelText('Accessorial name'),'Special loading');
  await user.clear(screen.getByLabelText('Accessorial rate'));
  await user.type(screen.getByLabelText('Accessorial rate'),'18.50');
  await user.click(screen.getByRole('button',{name:'Create Accessorial'}));
  const added=await waitFor(()=>{const item=loadSimplePricingConfig().accessorials.find(a=>a.name==='Special loading');assert.ok(item);return item;});
  assert.equal(added.rate,18.5);
  assert.equal((screen.getByRole('checkbox',{name:/Special loading/}) as HTMLInputElement).checked,true);
  assert.match(screen.getByText('Accessorials').closest('summary')?.textContent ?? '',/Special loading/);
  await user.click(screen.getByRole('button',{name:/Add accessorial/}));
  await user.type(screen.getByLabelText('Accessorial name'),'Special loading');
  await user.click(screen.getByRole('button',{name:'Create Accessorial'}));
  assert.match((await screen.findByRole('alert')).textContent ?? '',/already exists/);
  assert.ok(screen.getByRole('button',{name:'Create Accessorial'}));
});
test('order create, detail, edit and save retain operational and stop data', async()=>{
  const {loadBillingConfig,saveBillingConfig}=await import('../src/lib/billingStorage'); const billing=loadBillingConfig(); billing.quoteSettings.taxRegistrationStatus='REGISTERED'; billing.quoteSettings.taxRegistrationNumber='123456789RT0001'; saveBillingConfig(billing);
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
  assert.ok(created.pricingInput.stops.every((stop: { contactPhone?: string }) => !stop.contactPhone));
  await user.click(screen.getAllByText(created.jobNumber)[0]); assert.ok(screen.getByRole('table',{name:'Order packages'}).textContent?.includes('DG'));
  const detailPrice=screen.getByText('Price').closest('section')!; assert.ok(within(detailPrice).getByText('Total')); assert.equal(within(detailPrice).queryByRole('button',{name:'View calculation'}),null);
  await user.click(screen.getByRole('button',{name:'Edit order'}));
  assert.equal(screen.queryByRole('combobox',{name:'Priority'}),null);
  await user.click(screen.getByRole('button',{name:'Save Order'})); assert.ok(updated,notices.join(' ')); assert.equal(updated.priority,'NORMAL'); assert.equal(updated.jobNumber,created.jobNumber); assert.equal(updated.id,created.id); assert.equal(updated.version,2); assert.deepEqual(updated.customerSnapshot,created.customerSnapshot);
});

test('order details identify email, shipper, dispatcher and external TMS origins with the TMS reference', async()=>{
  const {INITIAL_JOBS}=await import('../src/data/mockData');
  const {OrderDetailsDialog}=await import('../src/components/orders/OrderDetailsDialog');
  const ctx=loadPricingContext();
  for (const [source,label] of [['EMAIL','Email'],['SHIPPER_PORTAL','Shipper created'],['DISPATCHER','Dispatcher created'],['IMPORT','External TMS']] as const) {
    const input={...createDefaultOrderInput(ctx),source,externalReference:source==='IMPORT'?'TMS-482':null};
    render(React.createElement(OrderDetailsDialog,{job:{...INITIAL_JOBS[0],creationSource:source,externalReference:input.externalReference ?? undefined,pricingInput:input},ctx,drivers:[],onClose:()=>{},onReassign:()=>{}}));
    assert.equal(screen.getByText('Order source').nextElementSibling?.textContent,label);
    if (source==='IMPORT') assert.equal(screen.getByText('TMS reference number').nextElementSibling?.textContent,'TMS-482');
    else assert.equal(screen.queryByText('TMS reference number'),null);
    cleanup();
  }
  render(React.createElement(OrderDossierSections,{job:{...INITIAL_JOBS[0],pricingInput:{...createDefaultOrderInput(ctx),source:'IMPORT',externalReference:null}},ctx}));
  assert.equal(screen.getByText('TMS reference number').nextElementSibling?.textContent,'Not provided');
  cleanup();
  render(React.createElement(OrderDossierSections,{job:{...INITIAL_JOBS[0],pricingInput:undefined},ctx}));
  assert.equal(screen.getByText('Order source').nextElementSibling?.textContent,'Not recorded');
});

test('order origins use saved creation data and never infer TMS from prices or PO numbers', async()=>{
  const {INITIAL_JOBS}=await import('../src/data/mockData');
  const {OrderDetails}=await import('../src/components/entities/OrderFields');
  const {orderOrigin}=await import('../src/domain/orderOrigin');
  const input={...createDefaultOrderInput(loadPricingContext()),source:'DISPATCHER' as const,externalReference:'PO-77'};
  const job={...INITIAL_JOBS[0],creationSource:'IMPORT',externalReference:'  TMS-482  ',pricingInput:input};
  render(React.createElement(OrderDetails,{order:job}));
  assert.ok(screen.getByText('External TMS'));
  assert.ok(screen.getByText('TMS-482'));
  assert.deepEqual(orderOrigin({...job,pricingInput:undefined}),{label:'External TMS',tmsReference:'TMS-482'});
  assert.deepEqual(orderOrigin({...job,externalReference:' '}),{label:'External TMS',tmsReference:'Not provided'});
  assert.deepEqual(orderOrigin({pricingInput:input}),{label:'Dispatcher created',tmsReference:null});
  assert.deepEqual(orderOrigin({...job,creationSource:'UNRECOGNIZED'}),{label:'Not recorded',tmsReference:null});
});

test('order address entry retains the company rate without province tax prompts', async()=>{
  const ctx=loadPricingContext(); ctx.billing.quoteSettings.taxRegistrationStatus='REGISTERED'; ctx.billing.quoteSettings.taxRegistrationNumber='123456789RT0001';
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

test('completed orders retain prices and have no invoice actions or status', async()=>{
  const {INITIAL_JOBS}=await import('../src/data/mockData');
  const input=createDefaultOrderInput(loadPricingContext());
  const done={...INITIAL_JOBS[0],id:'done',jobNumber:'#900',status:'completed' as const,lifecycleStatus:'COMPLETED' as const,pricingInput:input};
  const user=userEvent.setup({document});
  render(React.createElement(JobsPage,{jobs:[done],drivers:[],onSelectJob:()=>{},onUpdateJob:()=>{},onCreateJob:()=>{},onNotification:()=>{}}));
  assert.ok(within(screen.getByText('#900').closest('tr')!).getByText('Completed'));
  assert.equal(screen.queryByRole('button',{name:/invoice/i}),null);
  assert.equal(screen.queryByRole('option',{name:'Invoiced'}),null);
  await user.click(screen.getByText('#900'));
  assert.ok(screen.getByRole('dialog'));
  assert.equal(screen.queryByRole('button',{name:/invoice|edit order|complete order/i}),null);
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
  const {DriversPage}=await import('../src/pages/DriversPage'); const user=userEvent.setup({document}); const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',currentVehicleId:null});
  render(React.createElement(DriversPage,{ drivers:[driver], jobs:[], onSelectDriver:()=>{}, onUpdateDriver:()=>{}, onCreateDriver:()=>{}, onNotification:()=>{} }));
  assert.ok(screen.getByRole('table',{name:'Drivers'})); assert.equal(screen.queryByTitle('Grid Cards View'),null);
  const details=screen.getByRole('button',{name:`Details for ${driver.name}`}); await user.click(details); assert.ok(screen.getByLabelText('Email')); assert.equal(screen.queryByLabelText('Maximum Active Orders'),null); assert.equal(screen.queryByRole('heading',{name:'Payout terms'}),null); await user.keyboard('{Escape}'); assert.equal(screen.queryByLabelText('Email'),null); assert.equal(document.activeElement,details);
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
test('driver details split into Details and Orders tabs without earnings', async()=>{
  const {DriversPage}=await import('../src/pages/DriversPage');
  const {freezeCompletedOrder}=await import('../src/lib/orderCompletion');
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',currentVehicleId:null,routeId:undefined});
  const assigned:any={id:'J-DONE',jobNumber:'#990',customerName:'Acme',pickupAddress:'1 A St, Vancouver',dropoffAddress:'2 B St, Burnaby',status:'assigned',lifecycleStatus:'ASSIGNED',assignedDriverId:driver.id};
  const done=freezeCompletedOrder(assigned,{...assigned,status:'completed',lifecycleStatus:'COMPLETED'},new Date('2025-01-22T12:00:00Z'));
  assert.equal(done.completedAt,'2025-01-22T12:00:00.000Z');
  const user=userEvent.setup({document});
  render(React.createElement(DriversPage,{drivers:[driver],jobs:[done,{...assigned,id:'J-OPEN',jobNumber:'#989'}],onSelectDriver:()=>{},onUpdateDriver:()=>{},onCreateDriver:()=>{},onNotification:()=>{}}));
  await user.click(screen.getByRole('button',{name:`Details for ${driver.name}`}));
  assert.deepEqual(screen.getAllByRole('tab').map(t=>t.textContent),['Details','Orders']);
  const activity=screen.getByRole('region',{name:'Activity'});
  assert.doesNotMatch(activity.textContent!,/Orders completed/); assert.doesNotMatch(document.body.textContent!,/earnings|payout/i);
  const profile=screen.getByRole('region',{name:'Driver profile'});
  assert.ok(profile.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING);
  for (const [label,value] of [['App connectivity','Unknown'],['App last seen','Not set'],['GPS captured','Not set'],['Location permission','UNKNOWN'],['Current route','Not set']]) assert.equal(within(activity).getByText(label).nextElementSibling?.textContent,value);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  const orders=screen.getByRole('region',{name:'Driver orders'});
  assert.match(orders.textContent!,/#990/); assert.match(orders.textContent!,/Acme/); assert.match(orders.textContent!,/#989/); assert.match(orders.textContent!,/2 orders/);
  assert.ok(screen.getByRole('button',{name:'Save driver'}));
});
test('Monitor driver details has Details and Orders tabs', async()=>{
  const {DetailModalDialog}=await import('../src/components/DetailModalDialog');
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],employmentType:'CONTRACTOR',routeId:undefined});
  const done:any={id:'J-MONITOR',jobNumber:'#991',customerName:'Acme',pickupAddress:'1 A St, Vancouver',dropoffAddress:'2 B St, Burnaby',status:'completed',lifecycleStatus:'COMPLETED',completedAt:'2025-01-22T12:00:00Z',assignedDriverId:driver.id};
  let selected=''; const user=userEvent.setup({document});
  render(React.createElement(DetailModalDialog,{isOpen:true,type:'driver_detail',data:driver,jobs:[done],onClose:()=>{},onSelectJob:(n:string)=>selected=n,onActionNotification:()=>{}}));
  const activity=screen.getByRole('region',{name:'Activity'});
  assert.doesNotMatch(activity.textContent!,/Orders completed/); assert.doesNotMatch(document.body.textContent!,/earnings|share of/i);
  const profile=screen.getByRole('region',{name:'Driver profile'});
  assert.equal(within(profile).queryByText('Employment'),null);
  for (const mock of ['HOS Remaining','Rating & Score','Speed & Heading','License Class']) assert.equal(screen.queryByText(mock),null);
  await user.click(screen.getByRole('tab',{name:'Orders'}));
  await user.click(within(screen.getByRole('region',{name:'Driver orders'})).getByRole('button',{name:/View/}));
  assert.equal(selected,'#991');
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
test('dispatcher completes an assigned order from order details after confirming', async()=>{
  const {MonitorOrderDetails}=await import('../src/components/orders/MonitorOrderDetails');
  const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
  const {INITIAL_JOBS}=await import('../src/data/mockData');
  const ctx=loadPricingContext(); const input={...createDefaultOrderInput(ctx),routeKm:15,estimatedMinutes:40};
  const job:any={...INITIAL_JOBS[0],lifecycleStatus:'ASSIGNED',version:3,pricingInput:input,pricing:priceOrder(input,ctx)};
  const user=userEvent.setup({document}); let updated:any; const notices:string[]=[];
  function Host(){const [jobs,setJobs]=React.useState([job]);return React.createElement(React.Fragment,null,React.createElement(ConfirmDialogHost),
    React.createElement(MonitorOrderDetails,{job,jobs,drivers:[],onClose:()=>{},onEdit:()=>{},onUpdateJob:j=>{updated=j;setJobs([j]);},onNotification:m=>notices.push(m)}));}
  render(React.createElement(Host));
  await user.click(screen.getByRole('button',{name:'Complete order'}));
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Cancel'})); assert.equal(updated,undefined);
  await user.click(screen.getByRole('button',{name:'Complete order'}));
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Complete order'}));
  assert.equal(updated.lifecycleStatus,'COMPLETED'); assert.equal(updated.status,'completed'); assert.equal(updated.version,4); assert.match(notices.at(-1)!,/completed/);
  await waitFor(()=>assert.equal(screen.queryByRole('button',{name:'Complete order'}),null));
});
