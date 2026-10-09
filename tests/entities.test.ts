import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderInput, removeOrderStop, snapshotCustomer, applyCustomerDefaults } from '../src/domain/orderAdapters';
import { validateOrderFacts, validateDriver, validateVehicle, validateCustomer, orderEditable, orderLifecycle, orderAttention } from '../src/domain/validation';
import { validateLoad, validateOperationalAssignment } from '../src/domain/assignment';
import { loadDrivers, saveDrivers, normalizeDriver, syncDriver, connectivity } from '../src/lib/driverStorage';
import { loadVehicles, saveVehicles, INITIAL_VEHICLES_FLEET, normalizeVehicle, syncVehicle } from '../src/lib/vehicleStorage';
import { DEFAULT_SHIPPERS, loadCustomers, saveCustomers, normalizeCustomer } from '../src/lib/customerStorage';
import { INITIAL_DRIVERS, INITIAL_JOBS } from '../src/data/mockData';
import { createDefaultOrderInput, createStop, loadPricingContext, priceOrder, loadSavedOrders, saveOrders } from '../src/lib/orderPricing';
import { validateAssignment } from '../src/lib/organizationWorkflows';
const store = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k:string) => store.get(k) ?? null, setItem: (k:string,v:string) => store.set(k,v), removeItem: (k:string) => store.delete(k), clear: () => store.clear() } });
function facts() { const input = createDefaultOrderInput(loadPricingContext()); input.taxCalculation = undefined; // Historical entity fixtures.
 input.stops[0].label = 'Pickup A'; input.stops[1].label = 'Delivery A'; return input; }
function fleetVehicle() { return normalizeVehicle({ ...INITIAL_VEHICLES_FLEET[2], currentDriverId: undefined, availability:'AVAILABLE', payloadCapacityKg: 100, cargoVolumeM3: 5, cargoLengthCm: 200, cargoWidthCm: 120, cargoHeightCm: 150 }); }
test('vehicle public IDs follow normalized unit numbers while preserving internal ID and company prefix', () => {
  const vehicle = normalizeVehicle({ ...fleetVehicle(), unitNumber: ' v12 ', vehicleNumber: 'DAV-3748' });
  assert.equal(vehicle.vehicleNumber, 'DAV-V12'); assert.equal(vehicle.unitNumber, 'V12');
  const renamed = syncVehicle({ ...vehicle, unitNumber: 'v14' });
  assert.equal(renamed.id, vehicle.id); assert.equal(renamed.vehicleNumber, 'DAV-V14');
  const duplicate = { ...renamed, id: 'other', unitNumber: ' V12 ', plateNumber: 'NEW-PLATE' };
  assert.match(validateVehicle(duplicate, [vehicle]).join(' '), /already exists/);
  saveVehicles([renamed]); assert.equal(loadVehicles()[0].vehicleNumber, 'DAV-V14');
  store.clear();
});
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
test('invalid contacts, reversed windows and negative dimensions are rejected; choosing a rate card needs no reason', () => {
  const input = facts(); input.stops[0].contactEmail='bad'; input.stops[0].windowStart='2026-09-14T12:00'; input.stops[0].windowEnd='2026-09-14T11:00'; input.packages[0].widthCm=-1; input.rateCardOverrideId='card';
  const errors=validateOrderFacts(input).join(' '); assert.match(errors,/email/); assert.match(errors,/end must/); assert.match(errors,/nonnegative/); assert.doesNotMatch(errors,/override|reason/);
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
  const c=normalizeCustomer({...DEFAULT_SHIPPERS[0], defaultServiceId:'srv_direct', instructions:'Call receiving', tags:['Retail']});
  const snapshot=snapshotCustomer(c)!; saveCustomers([{...c,phone:'Changed',addresses:[{id:'loc',type:'DELIVERY',label:'Warehouse',address:'200 Main St'}]}]);
  assert.equal(snapshot.phone,DEFAULT_SHIPPERS[0].phone); assert.equal(loadCustomers()[0].addresses![0].address,'200 Main St');
  const input=applyCustomerDefaults(facts(),c); assert.equal(input.serviceId,'srv_direct'); assert.equal(input.stops[0].instructions,'Call receiving');
});
test('legacy shipper city becomes part of the warehouse and default pickup without duplication', () => {
  const legacy = normalizeCustomer(DEFAULT_SHIPPERS[0]);
  assert.equal(legacy.address, '1420 Derwent Way, Annacis Island, Delta, BC');
  assert.equal(legacy.addresses?.find(item => item.id === `${legacy.id}-primary`)?.address, legacy.address);
  assert.equal(normalizeCustomer(legacy).address, legacy.address);
  const updated = normalizeCustomer({ ...legacy, address: '20 Main St, Surrey, BC V3T 1X1', city: '', addresses: [...(legacy.addresses ?? []), { id: 'secondary', type: 'DELIVERY', label: 'Secondary', address: '30 Side St' }] });
  assert.equal(updated.addresses?.find(item => item.id === `${legacy.id}-primary`)?.address, updated.address);
  assert.equal(updated.addresses?.find(item => item.id === 'secondary')?.address, '30 Side St');
  const blankPickup = facts(); blankPickup.stops[0].label = '';
  const input = applyCustomerDefaults(blankPickup, updated);
  assert.equal(input.stops[0].label, updated.address);
  assert.equal(input.stops[0].provinceCode, 'BC');
  const custom = applyCustomerDefaults({ ...input, stops: input.stops.map((stop, index) => index === 0 ? { ...stop, label: 'Manual pickup' } : stop) }, legacy, updated);
  assert.equal(custom.stops[0].label, 'Manual pickup');
  assert.equal(applyCustomerDefaults(input, legacy, updated).stops[0].label, legacy.address);
});

test('new properties survive vehicle save and an intentionally empty fleet remains empty', () => {
  const v=syncVehicle({...fleetVehicle(),equipment:['Dolly','Liftgate'],cargoVolumeM3:2,unavailableReason:'Reserved'}); saveVehicles([v]); assert.deepEqual(loadVehicles()[0],JSON.parse(JSON.stringify(v))); assert.equal(v.hasLiftgate,true); saveVehicles([]); assert.deepEqual(loadVehicles(),[]);
});
test('profile validation rejects duplicates, invalid capacity, blank availability and missing required data', () => {
  const d=normalizeDriver({...INITIAL_DRIVERS[0],shiftStart:undefined,driverNumber:'DUP',phone:'6041234567',email:'driver@example.ca',address:'100 Main St, Vancouver, BC V6A 2S5'}); assert.match(validateDriver({...d,id:'new'},[d]).join(' '),/already exists/);
  assert.match(validateDriver({...d,address:''},[]).join(' '),/address is required/);
  assert.match(validateDriver({...d,availabilitySchedule:[{id:'a',start:'',end:'',available:false}]},[]).join(' '),/start and end/);
  assert.match(validateVehicle({...fleetVehicle(),payloadCapacityKg:-1},[]).join(' '),/nonnegative/);
  assert.match(validateCustomer({...DEFAULT_SHIPPERS[0],code:DEFAULT_SHIPPERS[1].code},DEFAULT_SHIPPERS,DEFAULT_SHIPPERS[0].id).join(' '),/already exists/);
});
test('assignment respects skills, duty, service area, fleet type, equipment and shift limits', () => {
  const input=facts(); input.scheduledAt='2026-09-14T11:00';
  const v=fleetVehicle(); const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:v.id,shiftStart:'2026-09-14T08:00',shiftEnd:'2026-09-14T10:00',skills:[],dutyStatus:'OFF_DUTY'});
  const order={pricingInput:input,requiredSkills:['Furniture'],requiredEquipment:['Liftgate'],serviceAreaId:'Vancouver'};
  const errors=validateOperationalAssignment(order,driver,[v]).join(' '); assert.match(errors,/on duty/); assert.match(errors,/skills/); assert.match(errors,/service area/); assert.match(errors,/shift/); assert.match(errors,/equipment/);
});
test('dangerous goods packages require a DG-qualified driver in local assignment checks', () => {
  const input=facts(); input.packages[0].handlingTags=['DANGEROUS_GOODS'];
  const vehicle=fleetVehicle();
  const driver=normalizeDriver({...INITIAL_DRIVERS[0],currentVehicleId:vehicle.id,skills:[]});
  const order={pricingInput:input};
  assert.match(validateOperationalAssignment(order,driver,[vehicle]).join(' '),/verified DG qualification/);
  assert.doesNotMatch(validateOperationalAssignment(order,{...driver,skills:['DG']},[vehicle]).join(' '),/DG qualification/);
});
test('final, completed and executing orders cannot be edited; risk is independent of lifecycle', () => {
  const order={...INITIAL_JOBS[0],status:'at_risk' as const,lifecycleStatus:'ASSIGNED' as const}; assert.equal(orderLifecycle(order),'ASSIGNED'); assert.equal(orderEditable({...order,lifecycleStatus:'IN_PROGRESS'}),false); assert.equal(orderLifecycle({...order,lifecycleStatus:'IN_EXECUTION' as any}),'IN_PROGRESS'); assert.equal(orderLifecycle({...order,lifecycleStatus:'READY_FOR_DISPATCH' as any}),'NEW'); assert.deepEqual(orderAttention(order).map(a=>a.flag),['AT_RISK']); assert.equal(orderEditable({...order,status:'completed',lifecycleStatus:'COMPLETED'}),false);
});
test('saved order operational fields and frozen amounts survive a roundtrip', () => {
  store.clear(); const input=facts(); const order={...INITIAL_JOBS[0],pricingInput:input,pricing:priceOrder(input),priority:'URGENT' as const,referenceNumbers:'PO-42',customerSnapshot:snapshotCustomer(DEFAULT_SHIPPERS[0]),version:2}; saveOrders([order]); const loaded=loadSavedOrders([])[0]; assert.equal(loaded.referenceNumbers,'PO-42'); assert.deepEqual(loaded.pricing,JSON.parse(JSON.stringify(order.pricing))); assert.deepEqual(loaded.customerSnapshot,JSON.parse(JSON.stringify(order.customerSnapshot)));
});

test('legacy Preferred customer status becomes an active account with a stable classification tag', () => {
  const c=normalizeCustomer({...DEFAULT_SHIPPERS[0],status:'Preferred'}); assert.equal(c.status,'Active'); assert.deepEqual(c.tags,['Preferred']); assert.deepEqual(normalizeCustomer(c),c);
});



test('driver limits validate whole positive counts and preserve legacy defaults on load', () => {
  const driver = normalizeDriver({ ...INITIAL_DRIVERS[0], email:'driver@example.ca', address: '100 Main St, Vancouver, BC V6A 2S5' });
  assert.equal(driver.maxActiveOrders, undefined);
  for (const maxActiveOrders of [0, -1, 1.5, Infinity, NaN]) {
    assert.match(validateDriver({ ...driver, maxActiveOrders }, [driver])[0], /Maximum active orders/);
  }
  assert.deepEqual(validateDriver({ ...driver, maxActiveOrders: 1 }, [driver]), []);
  saveDrivers([{ ...driver, maxActiveOrders: 8 }]);
  assert.equal(loadDrivers([])[0].maxActiveOrders, 8);
});

test('legacy invoiced orders read as completed without changing their saved price', () => {
  store.clear();
  const input=facts(); const pricing=priceOrder(input);
  const old={...INITIAL_JOBS[0],lifecycleStatus:'INVOICED',pricingInput:input,pricing,completedAt:'2026-09-20T12:00:00Z'} as any;
  saveOrders([old]);
  const restored=loadSavedOrders([])[0];
  assert.equal(restored.lifecycleStatus,'COMPLETED');
  assert.equal(orderEditable(restored),false);
  assert.equal(restored.completedAt,old.completedAt);
  assert.deepEqual(restored.pricing,JSON.parse(JSON.stringify(pricing)));
});
