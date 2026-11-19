import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/orders', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {OrderPricingForm}=await import('../src/components/pricing/OrderPricingForm');
const {inputToBooking}=await import('../src/operations/orderAdapters');
const {applyCustomerDefaults}=await import('../src/domain/orderAdapters');
const {loadPricingContext,priceOrder,createBookingInput}=await import('../src/lib/orderPricing');
import type {PricingOrderInput,PricingStopInput} from '../src/types/pricing';
afterEach(()=>{cleanup();localStorage.clear();});

const ctx=loadPricingContext();
const service=ctx.catalogue.services.find(s=>s.active)!.id, vehicle=ctx.catalogue.vehicles.find(v=>v.active)!.id;
function input(changes:Partial<PricingOrderInput>={}):PricingOrderInput{
 const base=createBookingInput(ctx);
 const [pickup,drop]=[base.stops.find(s=>s.type==='PICKUP')!,base.stops.find(s=>s.type==='DROPOFF')!];
 return {...base,serviceId:service,vehicleId:vehicle,scheduledAt:'2030-01-02T10:00',
  stops:base.stops.map(s=>({...s,label:'100 Main St, Vancouver, BC V6A 2S5',city:'Vancouver',provinceCode:'BC',postalCode:'V6A 2S5'})),
  packages:[{id:'pkg-1',quantity:2,weightKg:500,lengthCm:120,widthCm:100,heightCm:90,declaredValue:0,pickupStopId:pickup.id,deliveryStopId:drop.id,packageTypeId:'type-1'}],...changes};
}

test('each load size sends only its fields: FTL drops service, sizes and package type; Small parcel drops the vehicle type',()=>{
 const ftl=inputToBooking(input({loadSize:'FTL'}));
 assert.equal(ftl.load_size,'FTL');assert.equal(ftl.service_id,null);assert.equal(ftl.vehicle_type_id,vehicle);
 assert.deepEqual([ftl.items[0].weight_kg,ftl.items[0].length_cm,ftl.items[0].width_cm,ftl.items[0].height_cm,ftl.items[0].package_type_id,ftl.items[0].quantity],[null,null,null,null,null,1]);
 const parcel=inputToBooking(input({loadSize:'SMALL_PARCEL'}));
 assert.equal(parcel.vehicle_type_id,null);assert.equal(parcel.service_id,service);assert.equal(Number(parcel.items[0].length_cm),120);
 const ltl=inputToBooking(input({loadSize:'LTL',vehicleId:null}));
 assert.equal(ltl.vehicle_type_id,null);assert.equal(ltl.service_id,service);
 assert.throws(()=>inputToBooking(input({loadSize:'FTL',vehicleId:null})),/vehicle type for a full truckload/);
 assert.throws(()=>inputToBooking(input({loadSize:'LTL',serviceId:''})),/service level/);
 // A full truckload asks for no weight or size, so missing ones do not block it; other load sizes still need them.
 const blank=input({loadSize:'FTL'});blank.packages[0]={...blank.packages[0],missingFields:['quantity','weightKg','lengthCm','widthCm','heightCm']};
 assert.equal(inputToBooking(blank).items[0].quantity,1);
 assert.throws(()=>inputToBooking({...blank,loadSize:'LTL'}),/Package 1: weight/);
});

test('the order form shows Service, Vehicle type and package sizes according to the load size',async()=>{
 const user=userEvent.setup({document});let current=input({loadSize:null});
 function Form(){const[value,setValue]=React.useState(current);current=value;return <OrderPricingForm value={value} onChange={setValue} ctx={ctx} snapshot={priceOrder(value,ctx)} showStopAddresses loadSizes />;}
 render(<Form/>);
 const choose=async(label:string)=>{await user.click(screen.getByRole('combobox',{name:'Load size'}));await user.click(screen.getByRole('option',{name:label}));};
 await choose('Full truckload (FTL)');
 assert.equal(current.loadSize,'FTL');
 assert.equal(screen.queryByRole('combobox',{name:'Service'}),null);
 assert.ok(screen.getByRole('combobox',{name:'Vehicle type'}));
 // FTL has no Packages/Load section: Fragile and DG come from Accessorials, and the stops give the single load line.
 assert.equal(screen.queryByRole('heading',{name:'Load'}),null);assert.equal(screen.queryByRole('heading',{name:'Packages'}),null);
 assert.equal(screen.queryByLabelText('Package 1 fragile'),null);assert.equal(screen.queryByLabelText('Package 1 length'),null);
 assert.ok(screen.getByText(/weight and size come from the vehicle type/));
 assert.equal(current.packages.length,1);assert.equal(current.packages[0].quantity,1);
 await choose('Small parcel');
 assert.equal(current.vehicleId,null);
 assert.equal(screen.queryByRole('combobox',{name:'Vehicle type'}),null);
 assert.ok(screen.getByRole('combobox',{name:'Service'}));assert.ok(screen.getByLabelText('Package 1 length'));
 await choose('Less than truckload (LTL)');
 assert.ok(screen.getByText('Vehicle type (optional)'));assert.ok(screen.getByRole('combobox',{name:'Service'}));
 await user.click(screen.getByRole('combobox',{name:'Vehicle type'}));
 assert.ok(screen.getByRole('option',{name:'Any vehicle type'}));
});

test('the vehicle type list follows the load size, and a type not offered for the new size is replaced by the suggestion',async()=>{
 const user=userEvent.setup({document});
 const listed=ctx.catalogue.vehicles.filter(v=>v.active&&!v.id.startsWith('fleet_'));
 const [ftlOnly,ltlOnly]=[listed[0],listed[1]];
 const sized={...ctx,catalogue:{...ctx.catalogue,vehicles:ctx.catalogue.vehicles.map(v=>v.id===ftlOnly.id?{...v,loadSizes:['FTL' as const]}:v.id===ltlOnly.id?{...v,loadSizes:['LTL' as const]}:v)}};
 let current=input({loadSize:'FTL',vehicleId:ftlOnly.id});
 function Form(){const[value,setValue]=React.useState(current);current=value;return <OrderPricingForm value={value} onChange={setValue} ctx={sized} snapshot={priceOrder(value,sized)} showStopAddresses loadSizes suggestVehicle />;}
 render(<Form/>);
 const options=async()=>{await user.click(screen.getByRole('combobox',{name:'Vehicle type'}));const names=screen.getAllByRole('option').map(o=>o.textContent);await user.keyboard('{Escape}');return names;};
 let names=await options();
 assert.ok(names.includes(ftlOnly.name));assert.ok(!names.includes(ltlOnly.name));
 await user.click(screen.getByRole('combobox',{name:'Load size'}));await user.click(screen.getByRole('option',{name:'Less than truckload (LTL)'}));
 assert.notEqual(current.vehicleId,ftlOnly.id);
 names=await options();
 assert.ok(names.includes(ltlOnly.name));assert.ok(!names.includes(ftlOnly.name));
});

test('a full truckload books one load line per pickup and drop-off link and keeps Fragile/DG on the whole load',async()=>{
 const {fullTruckLoad}=await import('../src/lib/loadSize');
 const stop=(id:string,type:'PICKUP'|'DROPOFF',pickupIds?:string[]):PricingStopInput=>({id,type,pickupIds,zoneId:null,residential:false,waitMinutes:0});
 const stops=[stop('p1','PICKUP'),stop('p2','PICKUP'),stop('d1','DROPOFF',['p1','p2']),stop('d2','DROPOFF',['p2'])];
 const pkg={id:'keep',quantity:4,weightKg:10,lengthCm:1,widthCm:1,heightCm:1,declaredValue:0,pickupStopId:'p1',deliveryStopId:'d1',fragile:true};
 const lines=fullTruckLoad([pkg],stops);
 assert.deepEqual(lines.map(l=>[l.pickupStopId,l.deliveryStopId,l.quantity,l.fragile]),[['p1','d1',1,true],['p2','d1',1,true],['p2','d2',1,true]]);
 assert.equal(lines[0].id,'keep');
 assert.equal(fullTruckLoad(lines,stops),lines);
 const booking=inputToBooking(input({loadSize:'FTL',stops:[...input().stops],packages:fullTruckLoad(input().packages,input().stops)}));
 assert.equal(booking.items.length,1);assert.equal(booking.items[0].quantity,1);
});

test('a new size brings its package type: LTL takes Pallet, Small parcel the company Default, and chosen types and entered sizes stay',async()=>{
 const {prefillPackageTypes}=await import('../src/lib/packageTypes');
 const type=(id:string,code:string,extra={})=>({id,code,name:code,description:'',defaultWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,active:true,...extra});
 const types=[type('pallet','PALLET',{lengthCm:120,widthCm:100,heightCm:150}),type('box','BOX',{isDefault:true,defaultWeightKg:5,lengthCm:30,widthCm:20,heightCm:20}),type('drum','DRUM')];
 const blank={...input().packages[0],packageTypeId:null,weightKg:40,lengthCm:0,widthCm:0,heightCm:0,missingFields:['lengthCm' as const,'widthCm' as const,'heightCm' as const]};
 const [ltl]=prefillPackageTypes([blank],'LTL',types);
 assert.deepEqual([ltl.packageTypeId,ltl.weightKg,ltl.lengthCm],['pallet',40,120]);
 // Switching size replaces the type the previous size gave, with that type's measurements.
 const [parcel]=prefillPackageTypes([ltl],'SMALL_PARCEL',types,'LTL');
 assert.deepEqual([parcel.packageTypeId,parcel.weightKg,parcel.lengthCm],['box',5,30]);
 // A new type without saved sizes clears the ones the previous automatic type brought.
 const [plain]=prefillPackageTypes([ltl],'SMALL_PARCEL',types.map(t=>t.id==='box'?{...t,lengthCm:null,widthCm:null,heightCm:null}:t),'LTL');
 assert.deepEqual([plain.packageTypeId,plain.lengthCm,plain.missingFields?.includes('lengthCm')],['box',0,true]);
 assert.equal(prefillPackageTypes([{...blank,packageTypeId:'drum'}],'SMALL_PARCEL',types)[0].packageTypeId,'drum');
 assert.equal(prefillPackageTypes([blank],'FTL',types)[0].packageTypeId,null);
 assert.equal(prefillPackageTypes([blank],'LTL',types.filter(t=>t.id!=='pallet'))[0].packageTypeId,'box');
});

test('choosing a shipper preselects the load size of its default card, never over a size already chosen',async()=>{
 const {shipperLoadSize}=await import('../src/domain/orderAdapters');
 const card=(id:string,loadSize?:'FTL'|'LTL'|'SMALL_PARCEL')=>({...ctx.pricing.rateCards[0],id,status:'ACTIVE' as const,loadSize});
 const shipper={...ctx.customers[0],id:'ship-1',status:'Active' as const,rateCardId:'ftl-card',rateCardIds:['ftl-card','ltl-card']};
 const cards=[card('ftl-card','FTL'),card('ltl-card')];
 assert.equal(shipperLoadSize(shipper,cards),'FTL');
 // The Shipper portal sees no cards and uses the sizes on its profile.
 assert.equal(shipperLoadSize({...shipper,rateCardLoadSizes:['SMALL_PARCEL']},[]),'SMALL_PARCEL');
 const own={...ctx,customers:[shipper],pricing:{...ctx.pricing,rateCards:[...ctx.pricing.rateCards,...cards]}};
 const user=userEvent.setup({document});let current=input({loadSize:null,customerId:null,vehicleId:null});
 function Form(){const[value,setValue]=React.useState(current);current=value;return <OrderPricingForm value={value} onChange={setValue} ctx={own} snapshot={priceOrder(value,own)} showStopAddresses loadSizes suggestVehicle />;}
 render(<Form/>);
 await user.click(screen.getByRole('combobox',{name:'Shipper'}));await user.click(screen.getByRole('option',{name:shipper.name}));
 assert.equal(current.loadSize,'FTL');
 cleanup();current={...input({loadSize:'LTL',customerId:null})};render(<Form/>);
 await user.click(screen.getByRole('combobox',{name:'Shipper'}));await user.click(screen.getByRole('option',{name:shipper.name}));
 assert.equal(current.loadSize,'LTL');
});
