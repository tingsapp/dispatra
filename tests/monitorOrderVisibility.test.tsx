import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React, { useState } from 'react';
import { APIProviderContext, APILoadingStatus, type APIProviderContextValue } from '@vis.gl/react-google-maps';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { INITIAL_JOBS, INITIAL_DRIVERS } from '../src/data/mockData';
import type { Job } from '../src/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name as keyof Window]});
Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: dom.window.requestAnimationFrame.bind(dom.window) });
Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: dom.window.cancelAnimationFrame.bind(dom.window) });
HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as never;
const { render, screen, cleanup, waitFor, within, fireEvent } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { MonitorMapContent } = await import('../src/components/GoogleMonitorMap');
const { TopMetrics } = await import('../src/components/TopMetrics');
const { TodaysPlan } = await import('../src/components/monitor/TodaysPlan');
const { DetailModalDialog } = await import('../src/components/DetailModalDialog');
const { isActiveMonitorOrder } = await import('../src/components/monitor/orderVisibility');
const { operations } = await import('../src/operations/api');
const original = { ...operations };
const pane = document.createElement('div');
const lines = new Set<FakePolyline>();
const fits: google.maps.LatLngLiteral[][] = [];
const pans: unknown[] = [];
const zooms: number[] = [];
let canvasWidth = 1200;
pane.getBoundingClientRect = () => ({ width: canvasWidth, height: 800 } as DOMRect);
class FakeLatLng {
  position: google.maps.LatLngLiteral;
  constructor(lat: google.maps.LatLngLiteral | number, lng?: number) { this.position = typeof lat === 'number' ? { lat, lng: lng! } : lat; }
  lat() { return this.position.lat; } lng() { return this.position.lng; } toJSON() { return this.position; }
}
class FakeOverlay {
  onAdd() {} draw() {} onRemove() {}
  getPanes() { return { overlayMouseTarget: pane }; }
  getProjection() { const project = ({ position }: FakeLatLng) => ({ x: position.lng * 100, y: position.lat * 100 }); return { fromLatLngToDivPixel: project, fromLatLngToContainerPixel: project }; }
  setMap(map: unknown) { if (map) { this.onAdd(); this.draw(); } else this.onRemove(); }
}
class FakePolyline {
  path: google.maps.LatLngLiteral[];
  constructor(options: { path: google.maps.LatLngLiteral[] }) { this.path = options.path; }
  setOptions() {} setMap(map: unknown) { if (map) lines.add(this); else lines.delete(this); }
  setPath(path: google.maps.LatLngLiteral[]) { this.path = path; }
  getPath() { return { getArray: () => this.path.map(point => new FakeLatLng(point)), getLength: () => this.path.length, getAt: (i: number) => new FakeLatLng(this.path[i]) }; }
}
class FakeBounds {
  points: google.maps.LatLngLiteral[] = [];
  extend(point: google.maps.LatLngLiteral) { this.points.push(point); }
  getCenter() { return new FakeLatLng(this.points[0]); }
}
const map = { getCenter: () => new FakeLatLng({lat:0,lng:0}), getDiv: () => pane, addListener: () => ({remove(){}}), fitBounds: (bounds: FakeBounds) => fits.push(bounds.points), getZoom: () => 10, panTo(point: unknown){pans.push(point);}, setZoom(zoom: number){zooms.push(zoom);}, setTilt(){}, setHeading(){} };
Object.defineProperty(globalThis, 'google', { configurable: true, value: { maps: { OverlayView: FakeOverlay, Polyline: FakePolyline, LatLng: FakeLatLng, LatLngBounds: FakeBounds, event: {addListener:()=>({remove(){}}),addListenerOnce:()=>({remove(){}}),trigger(){}} } } });
const context = { status: APILoadingStatus.LOADED, loadedLibraries: {geometry:{}}, importLibrary: async () => ({}), mapInstances: {default: map}, internalUsageAttributionIds:null } as unknown as APIProviderContextValue;
const job = (id: string, number: string): Job => ({ ...INITIAL_JOBS[0], id, jobNumber:number, version:1, pricingInput: {stops:[{id:'p',type:'PICKUP',label:'Warehouse',latitude:49.2,longitude:-123.1},{id:'d',type:'DROPOFF',label:'Recipient',latitude:49.3,longitude:-123.2}]} as Job['pricingInput'],lat:49.3,lng:-123.2 });
const orders = [job('first','#100'),job('second','#200')];
let cache: QueryClient;
afterEach(()=>{cleanup();cache?.clear();Object.assign(operations,original);pane.remove();lines.clear();fits.length=0;pans.length=0;zooms.length=0;canvasWidth=1200;});
after(()=>dom.window.close());
const tree = (children: React.ReactNode) => { cache = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}); document.body.appendChild(pane); return <QueryClientProvider client={cache}><APIProviderContext.Provider value={context}>{children}</APIProviderContext.Provider></QueryClientProvider>; };

test('checkboxes hide complete order markers and cached road paths without selecting or closing the menu, then restore them', async () => {
  const calls:string[]=[];
  operations.orderRoadPath = async (_slug,id)=>{calls.push(id);return {points:[[49.2,-123.1],[49.3,-123.2]]} as never;};
  const selected:string[]=[];
  function Harness({rows=orders}:{rows?:Job[]}) {
    const [hidden,setHidden]=useState<ReadonlySet<string>>(new Set());
    return <><TodaysPlan jobs={rows.map(row => ({...row, createdAt: new Date().toISOString()}))} timeZone="America/Vancouver" attentionIds={new Set()} onRetry={()=>{}}
      onSelectOrder={order=>selected.push(order.jobNumber)} hiddenOrderIds={hidden} onOrderVisibilityChange={(id,visible)=>setHidden(current=>{const next=new Set(current);if(visible)next.delete(id);else next.add(id);return next;})} />
      <MonitorMapContent demo={false} jobs={rows.filter(row=>isActiveMonitorOrder(row)&&!hidden.has(row.id))} drivers={[INITIAL_DRIVERS[0]]} onSelectJob={()=>{}} onSelectDriver={()=>{}} layerConfig={{mode:'map',traffic:false,labels:true}} /></>;
  }
  const view=render(tree(<Harness/>));const user=userEvent.setup({document});
  await waitFor(()=>assert.equal(lines.size,2));assert.deepEqual(calls.sort(),['first','second']);assert.equal(screen.getAllByRole('button',{name:/^Order #100,/}).length,2);
  const beforeToggle = fits.length;
  await user.click(screen.getByRole('checkbox',{name:'Show #100 on map'}));
  await waitFor(() => assert.ok(fits.length > beforeToggle, 'Checkbox changes automatically fit the remaining visible work'));
  assert.equal(screen.queryByRole('button',{name:/^Order #100,/}),null);assert.equal(lines.size,1);assert.deepEqual(selected,[]);assert.ok(screen.getByRole('region',{name:'Today’s plan'}));
  await user.type(screen.getByPlaceholderText('Search orders, shippers or addresses...'),'200');assert.equal(screen.queryByRole('checkbox',{name:'Show #100 on map'}),null);
  await user.clear(screen.getByPlaceholderText('Search orders, shippers or addresses...'));assert.equal((screen.getByRole('checkbox',{name:'Show #100 on map'}) as HTMLInputElement).checked,false);
  view.rerender(<QueryClientProvider client={cache}><APIProviderContext.Provider value={context}><Harness rows={[{...orders[0],version:2},orders[1],job('new','#300')]} /></APIProviderContext.Provider></QueryClientProvider>);
  await waitFor(()=>assert.equal(lines.size,2));assert.equal(calls.includes('first')&&calls.filter(id=>id==='first').length,1,'hidden refreshed order never requests a new road path');
  assert.equal((screen.getByRole('checkbox',{name:'Show #100 on map'}) as HTMLInputElement).checked,false);assert.equal((screen.getByRole('checkbox',{name:'Show #300 on map'}) as HTMLInputElement).checked,true);
  await user.click(screen.getByRole('checkbox',{name:'Show #100 on map'}));await waitFor(()=>assert.equal(lines.size,3));assert.equal(screen.getAllByRole('button',{name:/^Order #100,/}).length,2);
  for(const number of ['#100','#200','#300']) await user.click(screen.getByRole('checkbox',{name:`Show ${number} on map`}));
  assert.equal(lines.size,0);assert.equal(screen.queryByRole('button',{name:/^Order #/}),null);assert.ok(screen.getByRole('button',{name:/^Driver /}));
  await waitFor(() => assert.deepEqual((pans.at(-1) as FakeLatLng).toJSON(), {lat:INITIAL_DRIVERS[0].lat,lng:INITIAL_DRIVERS[0].lng}));
});

test('full Active Orders list shares visibility controls and excludes completed/cancelled records', async () => {
  const calls:unknown[]=[];const selected:string[]=[];
  render(<DetailModalDialog isOpen type="all_jobs" jobs={[...orders,{...orders[0],id:'done',jobNumber:'#900',lifecycleStatus:'COMPLETED'},{...orders[0],id:'cancel',jobNumber:'#901',lifecycleStatus:'CANCELLED'}]} drivers={[]} onClose={()=>{}} onSelectJob={number=>selected.push(number)} onActionNotification={()=>{}}
    hiddenOrderIds={new Set(['first'])} onOrderVisibilityChange={(id,visible)=>calls.push([id,visible])} />);
  const list=within(screen.getByRole('list',{name:'Active orders'}));assert.equal(list.getAllByRole('checkbox').length,2);assert.equal((list.getByRole('checkbox',{name:'Show #100 on map'}) as HTMLInputElement).checked,false);
  fireEvent.click(list.getByRole('checkbox',{name:'Show #100 on map'}));assert.deepEqual(calls,[['first',true]]);assert.deepEqual(selected,[]);assert.equal(list.queryByText('#900'),null);assert.equal(list.queryByText('#901'),null);
});

test('an explicitly empty prototype map does not resurrect seed markers or route lines', () => {
  render(tree(<MonitorMapContent demo jobs={[]} drivers={[]} active={false} onSelectJob={()=>{}} onSelectDriver={()=>{}} layerConfig={{mode:'map',traffic:false,labels:true}} />));
  assert.equal(screen.queryByRole('button',{name:/^Order /}),null);assert.equal(lines.size,0);
});

test('Drivers popup filters/searches real records and selects a driver with the keyboard', async () => {
  const driverRows = INITIAL_DRIVERS.slice(0,3).map((driver,index)=>({...driver,avatar:'',driverNumber:`DDD-${index+1}`,status:index===2?'available' as const:'offline' as const,statusLabel:index===2?'Available':index===1?'Off duty':'Vehicle unavailable',nextStop:'Not set',eta:'-'}));
  const selected:string[]=[];let closes=0;const user=userEvent.setup({document});
  render(<DetailModalDialog isOpen type="all_drivers" drivers={driverRows} onClose={()=>{closes++;}} onSelectDriver={id=>selected.push(id)} onActionNotification={()=>{}} />);
  const dialog=within(screen.getByRole('dialog',{name:'Drivers'}));assert.ok(dialog.getByRole('heading',{name:'Drivers'}));assert.equal(dialog.queryByText(/Metro Vancouver|Next: Not set/),null);
  await user.click(dialog.getByRole('button',{name:'Available'}));assert.equal(dialog.getAllByRole('button',{name:/DDD-/}).length,1);
  await user.click(dialog.getByRole('button',{name:'All (3)'}));const search=dialog.getByPlaceholderText('Search by driver name, ID, vehicle...');await user.type(search,'DDD-2');assert.equal(dialog.getAllByRole('button',{name:/DDD-/}).length,1);
  await user.clear(search);await user.type(search,'no match');assert.ok(dialog.getByText('No drivers match your search or filter.'));
  await user.clear(search);const driver=dialog.getByRole('button',{name:`DDD-2 ${driverRows[1].name}`});driver.focus();await user.keyboard('{Enter}');assert.deepEqual(selected,[driverRows[1].id]);assert.equal(closes,1);
});

test('live bounds react to arrivals, completion, checkboxes, changed coordinates and delayed road geometry', async () => {
  let resolveRoad!: (value: never) => void;
  operations.orderRoadPath = async (_slug, id) => id === 'distant'
    ? new Promise(resolve => { resolveRoad = resolve; })
    : { points: [[49.2,-123.1],[49.3,-123.2]] } as never;
  const props = { demo: false, drivers: [], onSelectJob() {}, onSelectDriver() {}, layerConfig: { mode: 'map' as const, traffic: false, labels: true } };
  const content = (rows: Job[]) => <QueryClientProvider client={cache}><APIProviderContext.Provider value={context}><MonitorMapContent {...props} jobs={rows} /></APIProviderContext.Provider></QueryClientProvider>;
  const view = render(tree(<MonitorMapContent {...props} jobs={orders} />));
  await waitFor(() => assert.ok(fits.length && lines.size === 2, 'Initial bounds and road paths must settle'));
  // Let cached road geometry settle before testing identical data refreshes.
  await new Promise(resolve => setTimeout(resolve, 80));
  const initial = fits.length;
  view.rerender(content(orders.map(row => ({ ...row, version: 2 })).reverse()));
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(fits.length, initial, 'Identical refreshes retain camera framing');
  const distant: Job = { ...job('distant','#300'), lat:51, lng:-120, pricingInput: { ...orders[0].pricingInput!, stops: orders[0].pricingInput!.stops.map(stop => stop.type === 'DROPOFF' ? {...stop,latitude:51,longitude:-120} : stop) } };
  view.rerender(content([...orders,distant]));
  await waitFor(() => assert.ok(fits.length > initial && fits.at(-1)!.some(p => p.lat === 51), 'New orders must be included in bounds'));
  const beforeRoad = fits.length;
  resolveRoad({points:[[49.2,-123.1],[52,-119],[51,-120]]} as never);
  await waitFor(() => assert.ok(fits.length > beforeRoad && fits.at(-1)!.some(p => p.lat === 52), 'Delayed road geometry must update bounds'));
  const beforeCompletion = fits.length;
  view.rerender(content([...orders,{...distant,lifecycleStatus:'COMPLETED'}]));
  await waitFor(() => assert.ok(fits.length > beforeCompletion && fits.at(-1)!.every(p => p.lat < 51), 'Completed orders must leave bounds'));
  assert.equal(screen.queryByRole('button',{name:/^Order #300,/}),null);
  const beforeHide = fits.length;
  view.rerender(content([orders[1]]));
  await waitFor(() => assert.ok(fits.length > beforeHide, "Hidden orders must leave bounds"));
  assert.equal(screen.queryByRole('button',{name:/^Order #100,/}),null);
  view.rerender(content([]));
  await waitFor(() => assert.equal(zooms.at(-1),11));
  assert.deepEqual(pans.at(-1),{lat:49.2827,lng:-123.1207});assert.equal(lines.size,0);
  const beforeRestore = fits.length;
  view.rerender(content(orders));await waitFor(() => assert.ok(fits.length > beforeRestore, "Restored orders must return to bounds"));
  const beforeMove = fits.length;
  const moved: Job = {...orders[0],pricingInput:{...orders[0].pricingInput!,stops:orders[0].pricingInput!.stops.map(stop => ({...stop,latitude:50}))}};
  view.rerender(content([moved,orders[1]]));
  await waitFor(() => assert.ok(fits.length > beforeMove && fits.at(-1)!.some(p => p.lat === 50), 'Changed coordinates must update bounds'));
});

test('bounds wait for a visible canvas and resume after navigation, resize and map replacement', async () => {
  operations.orderRoadPath = async () => ({points:[[49.2,-123.1],[49.3,-123.2]]} as never);
  const props = {demo:false,drivers:[],onSelectJob(){},onSelectDriver(){},layerConfig:{mode:'map' as const,traffic:false,labels:true}};
  const content = (active:boolean, rows=orders, value=context) => <QueryClientProvider client={cache}><APIProviderContext.Provider value={value}><MonitorMapContent {...props} jobs={rows} active={active} /></APIProviderContext.Provider></QueryClientProvider>;
  canvasWidth=0;
  const view=render(tree(<MonitorMapContent {...props} jobs={orders}/>));
  await new Promise(resolve=>setTimeout(resolve,80));assert.equal(fits.length,0);
  canvasWidth=390;fireEvent(window,new Event('resize'));await waitFor(()=>assert.equal(fits.length,1));
  canvasWidth=320;fireEvent(window,new Event('resize'));await waitFor(()=>assert.equal(fits.length,2));
  fireEvent(window,new Event('resize'));await new Promise(resolve=>setTimeout(resolve,40));assert.equal(fits.length,2);
  view.rerender(content(false,[orders[0]]));canvasWidth=1200;fireEvent(window,new Event('resize'));
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(fits.length,2);
  view.rerender(content(true,[orders[0]]));await waitFor(()=>assert.equal(fits.length,3));
  const replacementFits:unknown[]=[];
  const replacement={...context,mapInstances:{default:{...map,fitBounds:(bounds:FakeBounds)=>replacementFits.push(bounds.points)}}} as unknown as APIProviderContextValue;
  view.rerender(content(true,[orders[0]],replacement));await waitFor(()=>assert.equal(replacementFits.length,1));
  canvasWidth=390;fireEvent(window,new Event('resize'));view.unmount();
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(replacementFits.length,1,'Unmount cancels pending camera changes');
});


test('bounds follow located drivers even when no orders are displayed', async () => {
  const props = {demo:false,jobs:[],onSelectJob(){},onSelectDriver(){},layerConfig:{mode:'map' as const,traffic:false,labels:true}};
  const first = INITIAL_DRIVERS[0];
  const view=render(tree(<MonitorMapContent {...props} drivers={[first]}/>));
  await waitFor(()=>assert.equal(zooms.at(-1),15));
  const moved={...first,lat:50,lng:-122};
  view.rerender(<QueryClientProvider client={cache}><APIProviderContext.Provider value={context}><MonitorMapContent {...props} drivers={[moved]}/></APIProviderContext.Provider></QueryClientProvider>);
  await waitFor(()=>assert.deepEqual((pans.at(-1) as FakeLatLng).toJSON(),{lat:50,lng:-122}));
  assert.ok(screen.getByRole('button',{name:/^Driver /}));
});

test('unassigned previews draw road geometry and assignment refresh replaces them with TomTom attribution', async () => {
  operations.orderRoadPath = async () => ({ points:[[49.2,-123.1],[49.3,-123.2]],provider:'GOOGLE',preview:true,truck_profile_applied:false,attribution:'' });
  const props={demo:false,jobs:[orders[0]],drivers:[],onSelectJob:()=>{},onSelectDriver:()=>{},layerConfig:{mode:'map' as const,traffic:false,labels:true}};
  const view=render(tree(<MonitorMapContent {...props}/>));
  await waitFor(()=>assert.equal(lines.size,1));
  assert.ok(screen.getByText('Road preview · no vehicle assigned'));
  operations.orderRoadPath = async () => ({ points:[[49.2,-123.1],[49.25,-123.18],[49.3,-123.2]],provider:'TOMTOM',preview:false,truck_profile_applied:true,attribution:'© TomTom' });
  view.rerender(<QueryClientProvider client={cache}><APIProviderContext.Provider value={context}><MonitorMapContent {...props} jobs={[{...orders[0],version:2,assignedDriverId:'assigned'}]}/></APIProviderContext.Provider></QueryClientProvider>);
  await waitFor(()=>assert.ok(screen.getByLabelText('Route data attribution').textContent?.includes('TomTom')));
  assert.equal(screen.queryByText('Road preview · no vehicle assigned'),null);
  await waitFor(()=>assert.equal([...lines][0].path.length,3));
});

test('failed route requests keep stops visible and explain the missing route', async () => {
  operations.orderRoadPath=async()=>{throw new Error('Truck profile required');};
  render(tree(<MonitorMapContent demo={false} jobs={[orders[0]]} drivers={[]} onSelectJob={()=>{}} onSelectDriver={()=>{}} layerConfig={{mode:'map',traffic:false,labels:true}}/>));
  await waitFor(()=>assert.ok(screen.getByRole('status').textContent?.includes('Route unavailable for 1 order')));
  assert.equal(lines.size,0);
  assert.equal(screen.getAllByRole('button',{name:/^Order #100,/}).length,2);
});


test('Monitor toolbar exposes drivers and attention without an Active Orders menu', () => {
  render(<TopMetrics drivers={[]} availableDriversCount={0} needsAttentionCount={0} needsAttentionItems={[]}
    showAvailableDriversMenu={false} setShowAvailableDriversMenu={()=>{}} showNeedsAttentionPopover={false} setShowNeedsAttentionPopover={()=>{}}
    onSelectJob={()=>{}} onSelectDriver={()=>{}} onActionNotification={()=>{}} />);
  assert.equal(screen.queryByRole('button', {name:/Active Orders/}), null);
  assert.ok(screen.getByRole('button', {name:/Available Drivers/}));
  assert.ok(screen.getByRole('button', {name:/Needs Attention/}));
});
