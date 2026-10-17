import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost/acme',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key as keyof Window]});
const {render,screen,cleanup}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {FleetPlan}=await import('../src/components/monitor/FleetPlan');
const {operations}=await import('../src/operations/api');
afterEach(cleanup);
test('fleet proposal requires individual approval and displays capacity or GPS exclusions',async()=>{
  const approvals:string[]=[];
  Object.assign(operations,{fleetPlan:async()=>[
    {id:'d1',order_id:'o1',candidates:[{driver_id:'a',driver_name:'Dana',vehicle_name:'Van',facts:['Compatible delivery area','40 min committed']}],excluded:[]},
    {id:'d2',order_id:'o2',candidates:[],excluded:[{reason:'Live assignment requires accurate driver GPS captured within two minutes.'}]}],
    approveDispatch:async(_slug:string,row:{id:string})=>{approvals.push(row.id);}});
  render(<QueryClientProvider client={new QueryClient()}><FleetPlan slug="acme" orders={[{id:'o1',number:'ACO-1'},{id:'o2',number:'ACO-2'}] as never}/></QueryClientProvider>);
  const user=userEvent.setup({document});
  await user.click(screen.getByRole('button',{name:'Plan dispatch'}));
  assert.ok(await screen.findByText('Compatible delivery area'));
  assert.ok(screen.getByText(/accurate driver GPS/));
  assert.deepEqual(approvals,[]);
  await user.click(screen.getByRole('button',{name:'Approve assignment'}));
  assert.ok(await screen.findByRole('button',{name:'Assigned'}));
  assert.deepEqual(approvals,['d1']);
});
