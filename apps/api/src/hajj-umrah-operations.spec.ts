import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { HajjUmrahOperationsController } from './hajj-umrah-operations.controller.js';

function fixture(){
  const calls:{name:string;context?:{companyId:string;branchId:string;actorId:string};payload?:unknown}[]=[];
  const bookings={
    async list(context:{companyId:string;branchId:string;actorId:string}){calls.push({name:'bookings.list',context});return[];},
  };
  const tickets={
    async reserve(context:{companyId:string;branchId:string;actorId:string},input:unknown){calls.push({name:'tickets.reserve',context,payload:input});return{id:'ticket-1'};},
  };
  const transport={
    async assignTraveler(context:{companyId:string;branchId:string;actorId:string},runId:string,bookingId:string,travelerId:string){calls.push({name:'transport.assign',context,payload:{runId,bookingId,travelerId}});return{id:'manifest-1'};},
  };
  const trip={
    async createTask(context:{companyId:string;branchId:string;actorId:string},input:unknown){calls.push({name:'trip.task',context,payload:input});return{id:'task-1'};},
  };
  const platform={
    async currentUser(token:string){calls.push({name:'platform.currentUser',payload:token});return{id:'user-1'};},
    async requireBranchAccess(){return undefined;},
    async authorize(){return undefined;},
  };
  const controller=new HajjUmrahOperationsController(
    bookings as never,{} as never,{} as never,tickets as never,transport as never,trip as never,platform as never,
  );
  return{controller,calls};
}

test('HU-02 API rejects missing auth/company/branch context before domain execution',async()=>{
  const {controller,calls}=fixture();
  await assert.rejects(
    ()=>controller.listBookings(undefined,'company-1','branch-1'),
    (error:unknown)=>error instanceof UnauthorizedException,
  );
  await assert.rejects(
    ()=>controller.listBookings('Bearer token',undefined,'branch-1'),
    (error:unknown)=>error instanceof UnauthorizedException,
  );
  await assert.rejects(
    ()=>controller.listBookings('Bearer token','company-1',undefined),
    (error:unknown)=>error instanceof UnauthorizedException,
  );
  assert.equal(calls.filter(call=>call.name==='bookings.list').length,0);
});

test('HU-02 API builds company/branch/actor context from authenticated request headers',async()=>{
  const {controller,calls}=fixture();
  await controller.listBookings('Bearer session-token','company-1','branch-9');
  assert.deepEqual(calls.find(call=>call.name==='bookings.list')?.context,{companyId:'company-1',branchId:'branch-9',actorId:'user-1'});
  assert.equal(calls.find(call=>call.name==='platform.currentUser')?.payload,'session-token');
});

test('Ticket mutation is delegated with authenticated HU-02 execution context',async()=>{
  const {controller,calls}=fixture();
  const input={bookingId:'booking-1',travelerId:'traveler-1',allocationId:'allocation-1',pnr:'PNR-1'};
  await controller.reserveTicket('Bearer token','company-1','branch-1',input);
  const call=calls.find(value=>value.name==='tickets.reserve');
  assert.deepEqual(call?.context,{companyId:'company-1',branchId:'branch-1',actorId:'user-1'});
  assert.deepEqual(call?.payload,input);
});

test('Transport manifest mutation delegates real booking and traveler identifiers',async()=>{
  const {controller,calls}=fixture();
  await controller.assignRun('Bearer token','company-1','branch-1','run-1',{bookingId:'booking-1',travelerId:'traveler-1'});
  const call=calls.find(value=>value.name==='transport.assign');
  assert.deepEqual(call?.context,{companyId:'company-1',branchId:'branch-1',actorId:'user-1'});
  assert.deepEqual(call?.payload,{runId:'run-1',bookingId:'booking-1',travelerId:'traveler-1'});
});

test('Trip task mutation delegates through the authenticated API boundary',async()=>{
  const {controller,calls}=fixture();
  const input={programId:'program-1',title:'استقبال المجموعة',dueAt:'2027-01-01T09:00:00Z'};
  await controller.createTask('Bearer token','company-1','branch-1',input);
  const call=calls.find(value=>value.name==='trip.task');
  assert.deepEqual(call?.context,{companyId:'company-1',branchId:'branch-1',actorId:'user-1'});
  assert.deepEqual(call?.payload,input);
});
