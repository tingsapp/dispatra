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
const {inputToDraftBooking}=await import('../src/operations/orderAdapters');
const {loadPricingContext,priceOrder,createBookingInput}=await import('../src/lib/orderPricing');
import type {PricingOrderInput} from '../src/types/pricing';
afterEach(()=>{cleanup();localStorage.clear();});

const ctx=loadPricingContext();
const accessorial=(code:string)=>ctx.catalogue.accessorials.find(a=>a.code===code&&a.active)!;
function setup(){
 const base=createBookingInput(ctx);let current:PricingOrderInput={...base,serviceId:ctx.catalogue.services.find(s=>s.active)!.id,
  stops:base.stops.map(s=>({...s,label:'100 Main St, Vancouver, BC V6A 2S5'})),
  packages:[{id:'pkg-1',quantity:0,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,declaredValue:0,missingFields:['quantity','weightKg','lengthCm','widthCm','heightCm']}]};
 function Form(){const[value,setValue]=React.useState(current);current=value;return <OrderPricingForm value={value} onChange={setValue} ctx={ctx} snapshot={priceOrder(value,ctx)} showStopAddresses />;}
 render(<Form/>);
 return {user:userEvent.setup({document}),get current(){return current;},box:(name:string|RegExp)=>screen.getByRole('checkbox',{name}) as HTMLInputElement};
}

test('Fragile and DG tick together on the package and under Accessorials, even before the package has a Qty',async()=>{
 const {user,box}=setup(), fragile=new RegExp(`^${accessorial('FRAGILE').name}`), dg=new RegExp(`^${accessorial('DG').name}`);
 await user.click(box('Package 1 fragile'));
 assert.equal(box(fragile).checked,true);
 await user.click(box(fragile));
 assert.equal(box('Package 1 fragile').checked,false);
 await user.click(box(dg));
 assert.equal(box('Package 1 dangerous goods').checked,true);
 await user.click(box('Package 1 dangerous goods'));
 assert.equal(box(dg).checked,false);
});

test('Power lift gate at pickup and at drop-off each select their own Liftgate Accessorial once and follow it back',async()=>{
 const form=setup(), {user,box}=form, pickup=accessorial('LIFTGATE'), drop=accessorial('LIFTGATE_DROPOFF');
 const charge=(item:typeof pickup)=>box(new RegExp(`^${item.name}`)), selected=(item:typeof pickup)=>form.current.accessorials.filter(a=>a.accessorialId===item.id);
 assert.ok(screen.getByText('Power lift gate at pickup'));assert.ok(screen.getByText('Power lift gate at drop-off'));
 await user.click(box('Stop 2 power lift gate'));
 assert.deepEqual([charge(pickup).checked,charge(drop).checked],[false,true]);
 await user.click(box('Stop 1 power lift gate'));
 assert.deepEqual([selected(pickup),selected(drop)],[[{accessorialId:pickup.id,quantity:1}],[{accessorialId:drop.id,quantity:1}]]);
 await user.click(box('Stop 2 power lift gate'));
 assert.deepEqual([charge(pickup).checked,charge(drop).checked],[true,false]);
 await user.click(charge(drop));
 assert.deepEqual([box('Stop 1 power lift gate').checked,box('Stop 2 power lift gate').checked],[true,true]);
 assert.deepEqual(inputToDraftBooking(form.current).stops.map(s=>s.liftgate),[true,true]);
 await user.click(charge(pickup));
 assert.deepEqual([box('Stop 1 power lift gate').checked,box('Stop 2 power lift gate').checked,selected(pickup).length,selected(drop).length],[false,true,0,1]);
});
