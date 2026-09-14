import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderInput, removeOrderStop, snapshotCustomer, applyCustomerDefaults } from '../src/domain/orderAdapters';
import { validateOrderFacts, validateDriver, validateVehicle, validateCustomer, orderEditable, orderLifecycle } from '../src/domain/validation';
import { validateLoad, validateOperationalAssignment } from '../src/domain/assignment';
import { loadDrivers, saveDrivers, normalizeDriver, syncDriver, connectivity } from '../src/lib/driverStorage';
import { loadVehicles, saveVehicles, INITIAL_VEHICLES_FLEET, normalizeVehicle, syncVehicle } from '../src/lib/vehicleStorage';
import { DEFAULT_CUSTOMERS, loadCustomers, saveCustomers, normalizeCustomer } from '../src/lib/customerStorage';
import { INITIAL_DRIVERS, INITIAL_JOBS } from '../src/data/mockData';
import { createDefaultOrderInput, createStop, loadPricingContext, priceOrder, loadSavedOrders, saveOrders } from '../src/lib/orderPricing';
import { createInvoicePreview, validateAssignment } from '../src/lib/organizationWorkflows';
const store = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k:string) => store.get(k) ?? null, setItem: (k:string,v:string) => store.set(k,v), removeItem: (k:string) => store.delete(k), clear: () => store.clear() } });
function facts() { const input = createDefaultOrderInput(loadPricingContext()); input.stops[0].label = 'Pickup A'; input.stops[1].label = 'Delivery A'; return input; }
function fleetVehicle() { return normalizeVehicle({ ...INITIAL_VEHICLES_FLEET[2], currentDriverId: undefined, availability:'AVAILABLE', payloadCapacityKg: 100, cargoVolumeM3: 5, cargoLengthCm: 200, cargoWidthCm: 120, cargoHeightCm: 150 }); }
test('default order has valid stable movement links; removing a stop clears dangling item and movement links', () => {
  const input = facts(); assert.deepEqual(validateOrderFacts(input), []);
  const removed = removeOrderStop(input,input.stops[0].id); assert.equal(removed.packages[0].pickupStopId, undefined); assert.deepEqual(removed.stops[0].pickupIds, []); assert.ok(validateOrderFacts(removed).length);
});
test('interleaved pickups and drop-offs validate and capacity is checked at each leg', () => {
  const input = facts(); const p1 = input.stops[0], d1 = input.stops[1];
  const p2 = createStop('PICKUP',{label:'Pickup B'}), d2 = createStop('DROPOFF',{label:'Delivery B',pickupIds:[p2.id]});
  input.stops = [p1,d1,p2,d2]; input.packages[0].weightKg = 70;
  input.packages.push({...input.packages[0],id:'p2',pickupStopId:p2.id,deliveryStopId:d2.id});
  assert.deepEqual(validateLoad(input,fleetVehicle()), []);
  input.stops = [p1,p2,d1,d2]; assert.match(validateLoad(input,fleetVehicle()).join(' '), /Stop 2: loaded weight/);
  input.stops = [d1,p1,p2,d2]; assert.match(validateOrderFacts(input).join(' '), /before delivery|later delivery/);
});
test('volume and cargo fit are independent of payload', () => {
  const input = facts(); input.packages[0].weightKg = 1; input.packages[0].heightCm = 160;
  assert.match(validateLoad(input,fleetVehicle()).join(' '), /does not fit/);
  input.packages[0].heightCm = 100; input.packages[0].quantity = 10;
  assert.match(validateLoad(input,{...fleetVehicle(), cargoVolumeM3: 0.5}).join(' '), /volume/);
});
test('invalid contacts, reversed windows, missing override reasons and negative dimensions are rejected', () => {
  const input = facts(); input.stops[0].contactEmail='bad'; input.stops[0].windowStart='2026-09-14T12:00'; input.stops[0].windowEnd='2026-09-14T11:00'; input.packages[0].widthCm=-1; input.rateCardOverrideId='card';
  const errors=validateOrderFacts(input).join(' '); assert.match(errors,/email/); assert.match(errors,/end must/); assert.match(errors,/nonnegative/); assert.match(errors,/override/);
});
test('legacy link migration never guesses an ambiguous multi-stop allocation', () => {
  const input=facts(); delete input.packages[0].pickupStopId; delete input.packages[0].deliveryStopId;
  assert.equal(normalizeOrderInput(input).packages[0].pickupStopId,input.stops[0].id);
  input.stops.push(createStop('DROPOFF',{label:'Delivery B'})); assert.equal(normalizeOrderInput(input).packages[0].deliveryStopId,undefined);
});
test('driver duty, work, connectivity and GPS are independent and persist through reload', () => {
  const driver=normalizeDriver(INITIAL_DRIVERS[0]); const changed=syncDriver({...driver,dutyStatus:'OFF_DUTY',workStatus:'BUSY',skills:['Furniture'],serviceAreaIds:['Vancouver'],licenseClass:'Class 5'});
  assert.equal(changed.status,'offline'); assert.equal(changed.workStatus,'BUSY'); assert.equal(changed.locationCapturedAt,undefined);
  saveDrivers([changed]); assert.deepEqual(loadDrivers([])[0],changed);
  assert.equal(connectivity(undefined),'Unknown'); assert.equal(connectivity('2026-09-14T10:00:00Z',Date.parse('2026-09-14T10:01:00Z')),'Online'); assert.equal(connectivity('2026-09-14T10:00:00Z',Date.parse('2026-09-14T10:05:00Z')),'Stale');
});
test('customer locations and defaults persist while booking snapshot remains unchanged', () => {
  const c=normalizeCustomer({...DEFAULT_CUSTOMERS[0], paymentTerms:'NET7', defaultServiceId:'srv_direct', instructions:'Call receiving', tags:['Retail']});
  const snapshot=snapshotCustomer(c)!; saveCustomers([{...c,phone:'Changed',addresses:[{id:'loc',type:'DELIVERY',label:'Warehouse',address:'200 Main St'}]}]);
  assert.equal(snapshot.phone,DEFAULT_CUSTOMERS[0].phone); assert.equal(loadCustomers()[0].addresses![0].address,'200 Main St');
  const input=applyCustomerDefaults(facts(),c); assert.equal(input.serviceId,'srv_direct'); assert.equal(input.stops[0].instructions,'Call receiving');
});
test('new properties survive vehicle save and an intentionally empty fleet remains empty', () => {
  const v=syncVehicle({...fleetVehicle(),equipment:['Dolly','Liftgate'],cargoVolumeM3:2,unavailableReason:'Reserved'}); saveVehicles([v]); assert.deepEqual(loadVehicles()[0],JSON.parse(JSON.stringify(v))); assert.equal(v.hasLiftgate,true); saveVehicles([]); assert.deepEqual(loadVehicles(),[]);
});
test('profile validation rejects duplicates, invalid capacity, blank availability and missing required data', () => {
  const d=normalizeDriver({...INITIAL_DRIVERS[0],shiftStart:undefined,driverNumber:'DUP',phone:'6041234567'}); assert.match(validateDriver({...d,id:'new'},[d]).join(' '),/already exists/);
  assert.match(validateDriver({...d,availabilitySchedule:[{id:'a',start:'',end:'',available:false}]},[]).join(' '),/start and end/);
  assert.match(validateVehicle({...fleetVehicle(),payloadCapacityKg:-1},[]).join(' '),/nonnegative/);
  assert.match(validateCustomer({...DEFAULT_CUSTOMERS[0],code:DEFAULT_CUSTOMERS[1].code},DEFAULT_CUSTOMERS,DEFAULT_CUSTOMERS[0].id).join(' '),/already exists/);
});
test('assignment respects skills, duty, service area, fleet type, equipment and shift limits', () => {
  const input=facts(); input.scheduledAt='2026-09-14T11:00';
  const v=fleetVehicle(); const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:v.id,shiftStart:'2026-09-14T08:00',shiftEnd:'2026-09-14T10:00',skills:[],dutyStatus:'OFF_DUTY'});
  const order={pricingInput:input,requiredSkills:['Furniture'],requiredEquipment:['Liftgate'],serviceAreaId:'Vancouver'};
  const errors=validateOperationalAssignment(order,driver,[v]).join(' '); assert.match(errors,/on duty/); assert.match(errors,/skills/); assert.match(errors,/service area/); assert.match(errors,/shift/); assert.match(errors,/equipment/);
});
test('final, completed and executing orders cannot be edited; risk is independent of lifecycle', () => {
  const order={...INITIAL_JOBS[0],status:'at_risk' as const,lifecycleStatus:'ASSIGNED' as const}; assert.equal(orderLifecycle(order),'ASSIGNED'); assert.equal(orderEditable({...order,lifecycleStatus:'IN_EXECUTION'}),false); assert.equal(orderEditable({...order,status:'completed',lifecycleStatus:'COMPLETED'}),false);
});
test('invoice payer and payment terms come from the frozen booking context', () => {
  store.clear(); const ctx=loadPricingContext(); const buyer=normalizeCustomer(DEFAULT_CUSTOMERS[0]), payer=normalizeCustomer({...DEFAULT_CUSTOMERS[1],paymentTerms:'NET7',billingEmail:'payer@example.test'}); ctx.customers=[buyer,payer];
  const input=facts(); input.customerId=buyer.id; input.billingCustomerId=payer.id; input.stage='FINAL'; const priced=priceOrder(input,ctx); assert.equal(priced.status,'PRICED');
  payer.billingEmail='changed@example.test'; const invoice=createInvoicePreview('o',priced,ctx,new Date('2026-09-14T12:00:00Z')); assert.equal(invoice.billingEmail,'payer@example.test'); assert.equal(invoice.dueAt,'2026-09-21T12:00:00.000Z');
});
test('saved order operational fields and frozen amounts survive a roundtrip', () => {
  store.clear(); const input=facts(); const order={...INITIAL_JOBS[0],pricingInput:input,pricing:priceOrder(input),priority:'URGENT' as const,referenceNumbers:'PO-42',customerSnapshot:snapshotCustomer(DEFAULT_CUSTOMERS[0]),version:2}; saveOrders([order]); const loaded=loadSavedOrders([])[0]; assert.equal(loaded.referenceNumbers,'PO-42'); assert.deepEqual(loaded.pricing,JSON.parse(JSON.stringify(order.pricing))); assert.deepEqual(loaded.customerSnapshot,JSON.parse(JSON.stringify(order.customerSnapshot)));
});

test('legacy Preferred customer status becomes an active account with a stable classification tag', () => {
  const c=normalizeCustomer({...DEFAULT_CUSTOMERS[0],status:'Preferred'}); assert.equal(c.status,'Active'); assert.deepEqual(c.tags,['Preferred']); assert.deepEqual(normalizeCustomer(c),c);
});
