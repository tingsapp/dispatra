import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/orders', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup,fireEvent}=await import('@testing-library/react');
const {OrderPricingForm}=await import('../src/components/pricing/OrderPricingForm');
const {EmailDraftSection}=await import('../src/components/orders/EmailDraftSection');
const {draftToInput,inputToDraftBooking}=await import('../src/operations/orderAdapters');
const {loadPricingContext,priceOrder}=await import('../src/lib/orderPricing');
const {loginDestination}=await import('../src/portal/PortalApp');
import type {EmailIntakeDetail} from '../src/operations/api';
import type {Account} from '../src/portal/api';
afterEach(()=>{cleanup();localStorage.clear();});

test('email measurements render blank, accept entries, and remain blank when cleared',()=>{
 const ctx=loadPricingContext();let current=draftToInput({items:[{id:crypto.randomUUID(),quantity:2,length_cm:'121.92'}]});
 function Form(){const[value,setValue]=React.useState(current);current=value;return <OrderPricingForm value={value} onChange={setValue} ctx={ctx} snapshot={priceOrder(value,ctx)} showStopAddresses />;}
 render(<Form />);
 assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value,'');
 assert.equal((screen.getByLabelText('Package 1 width') as HTMLInputElement).value,'');
 assert.equal((screen.getByLabelText('Package 1 quantity') as HTMLInputElement).value,'2');
 assert.notEqual((screen.getByLabelText('Package 1 length') as HTMLInputElement).value,'');
 fireEvent.change(screen.getByLabelText('Package 1 weight'),{target:{value:'200'}});
 fireEvent.blur(screen.getByLabelText('Package 1 weight'));
 assert.ok(!current.packages[0].missingFields?.includes('weightKg'));
 assert.ok(Number(inputToDraftBooking(current).items[0].weight_kg)>0);
 fireEvent.change(screen.getByLabelText('Package 1 weight'),{target:{value:''}});
 fireEvent.blur(screen.getByLabelText('Package 1 weight'));
 assert.equal((screen.getByLabelText('Package 1 weight') as HTMLInputElement).value,'');
 assert.equal(inputToDraftBooking(current).items[0].weight_kg,null);
});

test('review summary is above the collapsed email and email HTML stays inert',()=>{
 const email={body:'<script>window.compromised=true</script>',summary:'Two pallets of books',missing:['Package 1: weight'],sender_verified:false,from_address:'shipper@example.com',subject:'Delivery',received_at:'2026-11-09T09:00:00Z'} as EmailIntakeDetail;
 const{container}=render(<EmailDraftSection email={email} timeZone="UTC" />);
 const details=container.querySelector('details')!;
 assert.equal(details.open,false);
 assert.equal(container.querySelector('script'),null);
 assert.ok(screen.getByText('Sender not verified'));
 assert.ok(screen.getByText('Package 1: weight'));
 assert.ok(container.querySelector('section')!.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_FOLLOWING);
 fireEvent.click(screen.getByText('Original email'));
 assert.equal(details.open,true);
});

test('completion deep links survive matching shipper sign-in without redirecting other accounts',()=>{
 const id=crypto.randomUUID();const account={role:'SHIPPER',organization:{slug:'acme'}} as Account;
 assert.equal(loginDestination(account,'/acme/shipper',`?draft=${id}`),`/acme/shipper?draft=${id}`);
 assert.equal(loginDestination(account,'/foreign/shipper',`?draft=${id}`),'/acme/shipper');
 assert.equal(loginDestination(account,'/acme/shipper','?draft=https://attacker.test'),'/acme/shipper');
});
