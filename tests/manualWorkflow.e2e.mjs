// Live local API + disposable demo database. Start API with ROUTING_PROVIDER=demo,
// no email worker, and seed app.demo. Only Places and GPS are deterministic fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
if (process.env.E2E_DISPOSABLE !== 'true') throw new Error('Set E2E_DISPOSABLE=true only for a disposable demo database without an email worker.');
const base = `${origin}/api/v1/companies/demo`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const pages = [];
const address = n => `${n} Main Street, Vancouver, BC V5Y 1V4, Canada`;
const placesFixture = `export async function loadPlacesLibrary() { return {
  AutocompleteSessionToken: class {},
  AutocompleteSuggestion: { async fetchAutocompleteSuggestions({input}) { return {suggestions:[{placePrediction:{
    text: {toString:()=>input}, placeId:input, toPlace:()=>({ formattedAddress:input,
      addressComponents:[{types:['locality'],longText:'Vancouver'},{types:['administrative_area_level_1'],shortText:'BC'}, {types:['postal_code'],longText:'V5Y 1V4'},{types:['country'],shortText:'CA'}],
      location:{lat:()=>input.startsWith('100')?49.26:49.27,lng:()=>-123.11}, async fetchFields(){}
    })}}]}; }} }; }`;
async function open(path, label, id) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  // No paid map/provider calls. The operational API and its database are real.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.route('**/src/lib/googlePlaces.ts', route => route.fulfill({contentType:'application/javascript', body:placesFixture}));
  await context.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: {
    getCurrentPosition(success) { success({ timestamp:Date.now(), coords:{latitude:49.26,longitude:-123.11,accuracy:10} }); }
  }}));
  const page = await context.newPage(); pages.push(page);
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const path=new URL(response.url()).pathname;
    if (response.request().method()==='POST' && /\/(orders|assign|start|complete|finish|location)$/.test(path)) console.log(response.status(),path);
  });
  await page.goto(origin + path, { waitUntil:'domcontentloaded' });
  await page.getByLabel(label, {exact:true}).fill(id);
  await page.getByLabel('Password', {exact:true}).fill('123456');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('input[type=password]'));
  await page.goto(origin + path, {waitUntil:'domcontentloaded'});
  return page;
}
async function json(response) { assert.ok(response.ok(), `${response.status()} ${await response.text()}`); return response.json(); }
async function select(page, label, option) {
  await page.getByRole('combobox', { name:label,exact:true }).click();
  await page.getByRole('option', {name:option,exact:true}).click();
}
async function book(page, dispatcher) {
  await page.getByRole('button', {name:/^New order$/i}).click();
  const dialog = page.getByRole('dialog', {name:'New Order',exact:true});
  if (dispatcher) await select(page, 'Shipper', 'Demo Shipper');
  for (let i=0;i<2;i++) {
    const text=address(i?200:100);
    await dialog.getByLabel('Stop address',{exact:true}).nth(i).fill(text);
    await page.getByRole('option',{name:text,exact:true}).click();
  }
  await dialog.getByRole('button',{name:/^Stop 1 ready at date:/}).click();
  await page.getByRole('button',{name:'Today',exact:true}).click();
  await page.getByLabel('Stop 1 ready at date calendar',{exact:true}).waitFor({state:'hidden'});
  const clock=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  await select(page,'Stop 1 ready at time hours',clock.hour);
  await select(page,'Stop 1 ready at time minutes',clock.minute);
  const response = page.waitForResponse(r => r.url() === base+'/orders' && r.request().method()==='POST',{timeout:15000});
  await dialog.getByRole('button', {name:'Create Order',exact:true}).click();
  const order=await json(await response);
  await dialog.waitFor({state:'hidden'});
  assert.equal(order.status,'NEW'); assert.equal(order.pricing.status,'PRICED');
  console.log(`PASS: ${dispatcher?'dispatcher':'shipper'} browser creates a priced order.`);
  return order;
}
try {
  const desk=await open('/demo/orders','Login ID','dispatcher@example.com');
  const shipper=await open('/demo/shipper-portal','Email or login ID','shipper@example.com');
  const driver=await open('/demo/driver','Login ID','driver@example.com');
  // Real driver activation verifies the first location belongs to the newly created duty.
  const existing=await json(await driver.request.get(base+'/driver/profile'));
  if (existing.duty) {
    await driver.getByRole('switch',{name:'Online'}).click();
    await driver.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked')==='false');
  }
  const gps=driver.waitForResponse(r=>r.url()===base+'/driver/location' && r.request().method()==='POST');
  await driver.getByRole('switch',{name:'Online'}).click();
  await json(await gps);
  const dispatcherOrder=await book(desk,true);
  const order=await book(shipper,false);
  assert.equal(order.source,'SHIPPER_PORTAL'); assert.equal(dispatcherOrder.source,'DISPATCHER');
  // Orders from another account appear without a page reload.
  const row=desk.getByRole('row').filter({hasText:order.number});
  await row.waitFor();
  await row.getByRole('button',{name:'Assign Driver',exact:true}).click();
  const assignment=desk.waitForResponse(r=>r.url()===base+`/orders/${order.id}/assign` && r.request().method()==='POST');
  await desk.getByRole('menuitem').filter({hasText:'Demo Driver'}).click();
  await json(await assignment);
  // Keep the Monitor open while the driver changes the order and route.
  await desk.goto(origin+'/demo/',{waitUntil:'domcontentloaded'});
  const monitor=async predicate => {
    const response=await desk.waitForResponse(async r=>r.url()===base+'/monitor' && r.ok() && predicate(await r.json()));
    return response.json();
  };
  await driver.getByRole('button',{name:`View ${order.number}`,exact:true}).click();
  await driver.getByRole('button',{name:'Start route',exact:true}).click();
  await driver.getByRole('button',{name:'Record arrival',exact:true}).waitFor();
  await monitor(data=>data.orders.some(o=>o.id===order.id && o.status==='IN_PROGRESS'));
  await driver.getByRole('button',{name:'Record arrival',exact:true}).click();
  await driver.getByRole('button',{name:'Confirm pickup',exact:true}).click();
  await driver.getByRole('button',{name:'Record arrival',exact:true}).click();
  await driver.getByLabel('Recipient name',{exact:true}).fill('Browser Test Receiver');
  assert.equal(await driver.getByRole('button',{name:'Confirm delivery',exact:true}).isEnabled(),false);
  const pad=driver.getByRole('img',{name:'Signature pad'});
  const bounds=await pad.boundingBox(); assert.ok(bounds);
  await driver.mouse.move(bounds.x+30,bounds.y+30); await driver.mouse.down();
  await driver.mouse.move(bounds.x+130,bounds.y+70,{steps:10}); await driver.mouse.up();
  await driver.getByRole('button',{name:'Save signature',exact:true}).click();
  await driver.getByText('Signature saved',{exact:true}).waitFor();
  await driver.getByRole('button',{name:'Confirm delivery',exact:true}).click();
  await driver.getByRole('button',{name:'Finish route',exact:true}).click();
  const completed=await monitor(data=>!data.orders.some(o=>o.id===order.id));
  assert.equal(completed.routes.some(r=>r.status==='IN_PROGRESS'),false);
  const done=await json(await desk.request.get(base+`/orders/${order.id}`));
  assert.equal(done.status,'INVOICED');
  const invoices=await json(await desk.request.get(base+'/invoices'));
  const invoice=invoices.find(i=>i.order_id===order.id); assert.ok(invoice);
  assert.equal(invoice.total,order.pricing.total);
  const proof=await json(await shipper.request.get(base+`/orders/${order.id}/delivery-proof`));
  assert.equal(proof[0].recipient_name,'Browser Test Receiver'); assert.equal(proof[0].evidence[0].kind,'SIGNATURE');
  await shipper.getByRole('link',{name:'Invoices',exact:true}).click();
  const invoiceRow=shipper.getByRole('row').filter({hasText:invoice.number}); await invoiceRow.waitFor();
  const pdf=await shipper.request.get(new URL(await invoiceRow.getByRole('link',{name:'View invoice'}).getAttribute('href'),origin).href);
  assert.equal(pdf.headers()['content-type'],'application/pdf'); assert.ok((await pdf.body()).subarray(0,5).equals(Buffer.from('%PDF-')));
  await desk.getByRole('button',{name:'1 Available Drivers',exact:true}).waitFor();
  let vehicle=(await json(await desk.request.get(base+'/vehicles')))[0];
  const originalVehicle=vehicle.data;
  const saveVehicle=async data => {
    vehicle=await json(await desk.request.put(base+`/vehicles/${vehicle.id}`,{
      headers:{Origin:origin,'X-Requested-With':'Dispatra','Idempotency-Key':randomUUID()},
      data:{version:vehicle.version,data}
    }));
  };
  try {
    await saveVehicle({...originalVehicle,availability:'UNAVAILABLE',unavailable_reason:'Browser verification'});
    await desk.getByRole('button',{name:'0 Available Drivers',exact:true}).waitFor();
  } finally { await saveVehicle(originalVehicle); }
  await desk.getByRole('button',{name:'1 Available Drivers',exact:true}).waitFor();
  await driver.getByRole('button',{name:'Close',exact:true}).click();
  await driver.getByRole('switch',{name:'Online'}).click();
  await monitor(data=>data.drivers.every(d=>!d.on_duty && d.location===null));
  await desk.getByRole('button',{name:'0 Available Drivers',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: cross-account order refresh, browser assignment, driver duty/GPS, route start, pickup, signature POD, delivery, automatic frozen invoice, shipper PDF, Monitor order/driver/vehicle updates.');
} catch (error) {
  for (const [i,page] of pages.entries()) {
    await page.screenshot({path:`/tmp/dispatra-manual-${i}.png`,fullPage:true}).catch(()=>{});
    console.error(`Page ${i} alerts:`,await page.getByRole('alert').allTextContents().catch(()=>[]));
    console.error(`Page ${i} URL:`,page.url());
  }
  throw error;
} finally { await browser.close(); }
