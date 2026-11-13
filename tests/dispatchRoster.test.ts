import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driverToUi,driverFromUi} from '../src/operations/adapters';
const address={text:'123 Main Street, Vancouver, BC V5Y 1V4, Canada',city:'Vancouver',province:'BC',postal_code:'V5Y 1V4',country:'CA',latitude:49.26,longitude:-123.11};
const previous={id:'driver',number:'D01',version:1,name:'Dana',email:'dana@example.com',phone:'6045550102',address,active:true,on_duty:false,vehicle_id:null,location_permission:'UNKNOWN',data:{shift_start:'2026-10-16T15:00:00Z',shift_end:'2026-10-16T23:00:00Z',maximum_work_minutes:480}} as never;
test('driver directory edits retain saved shift instants and working duration',()=>{
 const ui=driverToUi(previous);
 assert.equal(ui.shiftStart,'2026-10-16T15:00:00Z');
 assert.equal(ui.shiftEnd,'2026-10-16T23:00:00Z');
 const saved=driverFromUi({...ui,phone:'6045550103'},previous);
 assert.equal(saved.shift_start,'2026-10-16T15:00:00.000Z');
 assert.equal(saved.shift_end,'2026-10-16T23:00:00.000Z');
 assert.equal(saved.maximum_work_minutes,480);
});
test('local shift choices use company timezone and omitted fields preserve historical shifts',()=>{
 const ui=driverToUi(previous);
 const saved=driverFromUi({...ui,shiftStart:'2026-10-16T08:00',shiftEnd:'2026-10-16T16:00'},previous,undefined,'America/Vancouver');
 assert.equal(saved.shift_start,'2026-10-16T15:00:00.000Z');
 assert.equal(saved.shift_end,'2026-10-16T23:00:00.000Z');
 const omitted=driverFromUi({...ui,shiftStart:undefined,shiftEnd:undefined},previous);
 assert.equal(omitted.shift_start,'2026-10-16T15:00:00Z');
 const cleared=driverFromUi({...ui,shiftStart:'',shiftEnd:''},previous);
 assert.equal(cleared.shift_start,null);assert.equal(cleared.shift_end,null);
});

test('planned assignment is not idle availability; start and completion change the display',()=>{
 const row={...previous as object,active:true,on_duty:true} as Parameters<typeof driverToUi>[0];
 const vehicle={active:true,number:'V1',plate:'TEST',data:{availability:'AVAILABLE'}} as Parameters<typeof driverToUi>[1];
 const planned=driverToUi(row,vehicle,undefined,{status:'PLANNED'},true);
 assert.equal(planned.status,'assigned');assert.equal(planned.statusLabel,'Assigned · awaiting start');
 assert.equal([planned].filter(d=>d.status==='available').length,0);
 assert.equal(driverToUi(row,vehicle,undefined,{status:'IN_PROGRESS'},true).status,'on_route');
 assert.equal(driverToUi(row,vehicle,undefined,{status:'COMPLETED'},true).status,'available');
 assert.equal(driverToUi(row,vehicle,undefined,undefined,true).status,'available');
 assert.equal(driverToUi(row,vehicle,{on_duty:false},{status:'PLANNED'},true).status,'offline');
 assert.equal(driverToUi({...row,active:false},vehicle,undefined,{status:'PLANNED'},true).status,'offline');
 assert.equal(driverToUi(row,undefined,undefined,{status:'PLANNED'},true).statusLabel,'Vehicle unavailable');
});
test('team size round-trips and older profiles without it stay a 1-person team',()=>{
 const ui=driverToUi(previous);
 assert.equal(ui.crewSize,1);
 assert.equal(driverFromUi(ui,previous).crew_size,1);
 const team=driverFromUi({...ui,crewSize:2},previous);
 assert.equal(team.crew_size,2);
 assert.equal(driverToUi({...previous as object,data:{...(previous as {data:object}).data,crew_size:2}} as never).crewSize,2);
});
