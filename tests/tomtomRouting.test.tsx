import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup, fireEvent } = await import('@testing-library/react');
const { TruckRoutingFields, truckRoutingError } = await import('../src/components/entities/TruckRoutingFields');
const { vehicleToUi, vehicleFromUi, catalogToVehicleType, vehicleTypeToCatalog } = await import('../src/operations/adapters');
const { monitorTiming } = await import('../src/operations/monitorTiming');
afterEach(() => { cleanup(); localStorage.clear(); });
const metric = { weightUnit: 'kg', dimensionUnit: 'cm', distanceUnit: 'km' } as const;

test('truck measurements are explicit, separate from box dimensions, and use company units', () => {
  let saved: Parameters<typeof TruckRoutingFields>[0]['value'] = {lengthM:0,widthM:0,heightM:0,grossWeightKg:0};
  function Form() {
    const [value, setValue] = React.useState(saved);
    saved = value;
    return <TruckRoutingFields value={value} onChange={setValue} units={metric} />;
  }
  render(<Form />);
  assert.equal(screen.queryByRole('checkbox'), null);
  assert.equal((screen.getByLabelText('Height (cm)') as HTMLInputElement).required,true);
  assert.equal((screen.getByLabelText('Loaded gross weight') as HTMLInputElement).required,true);
  assert.equal((screen.getByLabelText('Max axle weight') as HTMLInputElement).required,false);
  fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '380' } });
  fireEvent.change(screen.getByLabelText('Length (cm)'), { target: { value: '820' } });
  fireEvent.change(screen.getByLabelText('Width (cm)'), { target: { value: '250' } });
  fireEvent.change(screen.getByLabelText('Loaded gross weight'), { target: { value: '12000' } });
  assert.deepEqual(saved, { heightM: 3.8, lengthM: 8.2, widthM: 2.5, grossWeightKg: 12000 });
  assert.equal(truckRoutingError(saved), null);
  assert.match(truckRoutingError({ ...saved!, axleWeightKg: 15000 })!, /axle weight/);
  assert.ok(truckRoutingError(undefined));
});

test('Vehicle Types roundtrip routing measurements independently from cargo dimensions', () => {
  const row = { id: 't', kind: 'VEHICLE_TYPE', active: true, data: {name:'26ft Truck',description:'',amount:'0',taxable:true,
    fuel_eligible:true,exclusive_vehicle:false,equipment:[],required_equipment:[],required_crew:1,
    payload_kg:'1000',length_cm:'300',width_cm:'180',height_cm:'180',pallet_capacity:2,road_profile:{
      length_m:'8.2',width_m:'2.5',height_m:'3.8',gross_weight_kg:12000,axle_weight_kg:null}} } as never;
  const type = catalogToVehicleType(row);
  assert.equal(type.cargoHeightCm,180);assert.equal(type.truckRouting?.heightM,3.8);
  const payload=vehicleTypeToCatalog({...type,truckRouting:{...type.truckRouting!,grossWeightKg:12000.2}});
  assert.equal(payload.road_profile?.gross_weight_kg,12001);assert.equal(payload.height_cm,180);
  assert.equal(vehicleTypeToCatalog({...type,truckRouting:undefined}).road_profile,null);
});

test('vehicle adapter omits routing fields so a form save preserves legacy measurements', () => {
  const row={id:'v',number:'DV-V1',plate:'ABC',province:'BC',type_id:'t',active:true,data:{name:'V1',unit_number:'V1',payload_kg:'1000',length_cm:'300',width_cm:'180',height_cm:'180',pallet_capacity:2,equipment:[],availability:'AVAILABLE',road_profile:{length_m:'8.2',width_m:'2.5',height_m:'3.8',gross_weight_kg:12000,axle_weight_kg:null}}} as never;
  const payload=vehicleFromUi(vehicleToUi(row));assert.equal('road_profile' in payload,false);
});

test('Vehicle Type form requires shared routing measurements and rejects clearing them', async () => {
  const {VehicleTypeModal}=await import('../src/components/pricing/VehicleTypeModal');
  const {loadBillingConfig,saveBillingConfig}=await import('../src/lib/billingStorage');
  const billing=loadBillingConfig();saveBillingConfig({...billing,general:{...billing.general,...metric}});
  const type={id:'t',name:'26ft box truck',payloadCapacityKg:1000,palletCapacity:2,cargoLengthCm:300,cargoWidthCm:180,cargoHeightCm:180,baseSurcharge:5,fuelEligible:true,hasLiftgate:false,requiresCommercialLicense:false,active:true};
  let saved:any;
  render(<VehicleTypeModal initialVehicle={type} onSave={value=>{saved=value;}} onClose={()=>{}} />);
  assert.equal(screen.queryByRole('checkbox'),null);
  fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
  assert.match(screen.getByRole('alert').textContent!,/outside dimensions/);assert.equal(saved,undefined);
  for(const [label,value] of [['Length (cm)','820'],['Width (cm)','250'],['Height (cm)','380'],['Loaded gross weight','12000']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
  assert.deepEqual(saved.truckRouting,{lengthM:8.2,widthM:2.5,heightM:3.8,grossWeightKg:12000});assert.equal(saved.baseSurcharge,5);assert.equal(saved.cargoHeightCm,180);
  const previous=saved;saved=undefined;
  fireEvent.change(screen.getByLabelText('Loaded gross weight'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));assert.equal(saved,undefined);
  assert.match(screen.getByRole('alert').textContent!,/outside dimensions/);assert.equal(previous.truckRouting.grossWeightKg,12000);
});

test('live Monitor ETA uses company timezone and rejects stale, future or wrong-stop evidence', () => {
  const current = Date.parse('2026-10-19T18:00:00Z');
  const estimate = { source: 'TomTom truck route with traffic', observed_at: new Date(current).toISOString(),
    captured_at: new Date(current).toISOString(), truck_profile_applied: true,
    stops: [{ stop_id: 's', eta: '2026-10-19T18:20:00Z', traffic_added_seconds: 180, road_distance_metres: 2000 }] };
  assert.deepEqual(monitorTiming(estimate, 's', metric, 'America/Vancouver', current), { eta: 'ETA 11:20 · 3 min traffic', distance: '2 km' });
  for (const candidate of [null, { ...estimate, observed_at: '2026-10-19T18:00:01Z' },
    { ...estimate, captured_at: '2026-10-19T17:57:00Z' }])
    assert.equal(monitorTiming(candidate, 's', metric, 'UTC', current).eta, '-');
  assert.equal(monitorTiming(estimate, 'other-stop', metric, 'UTC', current).eta, '-');
});
