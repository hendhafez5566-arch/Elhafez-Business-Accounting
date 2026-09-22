import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createHajjUmrahOperationsApi,
  type Booking,
  type OperationsRequest,
} from './hajj-umrah-operations-client.js';
import {
  BookingStatusPair,
  OperationsFailure,
  PermissionState,
  bookingFinancialLabels,
  bookingLifecycleLabels,
  makeOperationCommandKey,
} from './hajj-umrah-operations-primary-pages.js';
import { foundationRoutes } from './routes.js';

test('operations client maps Ticket, Transport, and Trip mutations to real HU-02 endpoints', async () => {
  const calls:{path:string;method:string;body:unknown}[]=[];
  const request:OperationsRequest=async <T>(path:string,init?:RequestInit)=>{
    calls.push({
      path,
      method:init?.method??'GET',
      body:typeof init?.body==='string'?JSON.parse(init.body):undefined,
    });
    return {} as T;
  };
  const api=createHajjUmrahOperationsApi(request);

  await api.confirmBooking('booking 1',{commandKey:'confirm-k',category:'OTHER',costCenterId:'cc1',currency:'SAR',grossAmount:'100',discountAmount:'0',postingDate:'2026-09-22',dueDate:'2026-09-23',invoiceNumber:'INV-1',inventories:[]});
  await api.cancelBooking('booking 1',{commandKey:'cancel-k',postingDate:'2026-09-22',reason:'requested'});
  await api.reserveTicket({bookingId:'b1',travelerId:'t1',allocationId:'a1',pnr:'PNR1'});
  await api.issueTicket('ticket 1',{commandKey:'k1',ticketNumber:'ET-1',amount:'100',postingDate:'2026-09-22'});
  await api.createRun({programId:'p1',allocationId:'ta1',code:'RUN-1',route:'A-B',startsAt:'2027-01-01T10:00:00Z',endsAt:'2027-01-01T12:00:00Z'});
  await api.assignRun('run 1','b1','t1');
  await api.removeRunTraveler('run 1','manifest 1');
  await api.createTask({programId:'p1',title:'استقبال المجموعة',dueAt:'2027-01-01T09:00:00Z'});
  await api.createIncident({programId:'p1',severity:'HIGH',summary:'تأخر الحافلة'});
  await api.recordService({programId:'p1',bookingId:'b1',allocationId:'s1',category:'MEAL',executedAt:'2027-01-01T18:00:00Z'});

  assert.deepEqual(calls.map(value=>[value.method,value.path]),[
    ['POST','/hajj-umrah/operations/bookings/booking%201/confirm'],
    ['POST','/hajj-umrah/operations/bookings/booking%201/cancel'],
    ['POST','/hajj-umrah/operations/tickets'],
    ['POST','/hajj-umrah/operations/tickets/ticket%201/issue'],
    ['POST','/hajj-umrah/operations/transport/runs'],
    ['POST','/hajj-umrah/operations/transport/runs/run%201/manifest'],
    ['POST','/hajj-umrah/operations/transport/runs/run%201/manifest/manifest%201/remove'],
    ['POST','/hajj-umrah/operations/trip/tasks'],
    ['POST','/hajj-umrah/operations/trip/incidents'],
    ['POST','/hajj-umrah/operations/trip/services'],
  ]);
  assert.deepEqual(calls[5]?.body,{bookingId:'b1',travelerId:'t1'});
  assert.deepEqual(calls[6]?.body,{});
});

test('booking lifecycle and financial state are rendered as separate operational states', () => {
  const booking:Booking={
    id:'b1',code:'HU-1',programId:'p1',customerId:'c1',travelerIds:['t1'],
    status:'READY',financialState:'CANCELLATION_BLOCKED',allocationIds:['a1'],
    createdAt:'2026-09-22T00:00:00Z',updatedAt:'2026-09-22T00:00:00Z',
  };
  const html=renderToStaticMarkup(createElement(BookingStatusPair,{booking}));
  assert.match(html,/data-state-kind="booking-lifecycle"/);
  assert.match(html,/data-state-kind="booking-financial"/);
  assert.match(html,new RegExp(bookingLifecycleLabels.READY));
  assert.match(html,new RegExp(bookingFinancialLabels.CANCELLATION_BLOCKED));
});

test('permission-disabled HU-02 UI hides protected children and explains access state', () => {
  const html=renderToStaticMarkup(createElement(PermissionState,{allowed:false,children:createElement('button',null,'إجراء محمي')}));
  assert.doesNotMatch(html,/إجراء محمي/);
  assert.match(html,/لا توجد صلاحية لهذا الجزء/);
});

test('HU-02 failure feedback is user-visible and accessible', () => {
  const html=renderToStaticMarkup(createElement(OperationsFailure,{message:'تعذر تنفيذ العملية من الخادم'}));
  assert.match(html,/تعذر تنفيذ العملية من الخادم/);
  assert.match(html,/role="alert"/);
});

test('all six HU-02 operational screens are registered in the real route table', () => {
  const expected=new Map([
    ['hajj-umrah-bookings','/hajj-umrah/bookings'],
    ['hajj-umrah-rooming','/hajj-umrah/rooming'],
    ['hajj-umrah-visas','/hajj-umrah/visas'],
    ['hajj-umrah-ticketing','/hajj-umrah/ticketing'],
    ['hajj-umrah-transport','/hajj-umrah/transport'],
    ['hajj-umrah-trip-operations','/hajj-umrah/trip-operations'],
  ]);
  for(const [id,path] of expected){
    const route=foundationRoutes.find(value=>value.id===id);
    assert.ok(route,`missing route ${id}`);
    assert.equal(route.path,path);
    assert.equal(route.group,'الحج والعمرة');
  }
});

test('operator command keys are deterministic and generated from operation context', () => {
  const first=makeOperationCommandKey('ticket-reissue','ticket 1','2:ET-2:2026-09-22');
  const second=makeOperationCommandKey('ticket-reissue','ticket 1','2:ET-2:2026-09-22');
  assert.equal(first,second);
  assert.match(first,/^hu02:ticket-reissue:ticket%201:/);
});
