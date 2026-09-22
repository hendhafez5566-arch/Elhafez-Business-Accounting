import assert from'node:assert/strict';
import test from'node:test';
import{createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{findRoute}from'./routes.js';
import{createHajjUmrahReadinessApi,type Booking360,type Program360,type ReadinessResult}from'./hajj-umrah-readiness-client.js';
import{ReadinessWorkspaceView}from'./hajj-umrah-readiness-page.js';
import type{Program}from'./hajj-umrah-client.js';

const program:Program={id:'p1',code:'UM-1',type:'UMRAH',seasonId:'s1',arabicName:'برنامج العمرة',snapshot:{departureDate:'2027-05-01',returnDate:'2027-05-20',salesStart:'2027-01-01',salesClose:'2027-04-01',capacity:'20',currency:'SAR',prices:{},requirements:['HOTEL'],components:[]},temporaryHoldMinutes:20,status:'IN_TRIP',bookingOpen:false,currentVersion:1,currentVersionId:'pv1',departureRecordedAt:'2027-05-01T00:00:00.000Z'};
const ready:ReadinessResult={status:'READY',blockers:[],evidenceReferences:['e1']};
const blocked:ReadinessResult={status:'NOT_READY',blockers:[{category:'VISA',code:'VISA_NOT_ISSUED',message:'التأشيرة المطلوبة للمسافر غير صادرة.',owner:'hajj-umrah-visa-operations',responsibility:'التأشيرات',programId:'p1',bookingId:'b1',travelerId:'t1',evidenceReferences:[]}],evidenceReferences:[]};
const program360={program,bookingSummary:{total:1,statusCounts:{CONFIRMED:1}},bookings:[{id:'b1',code:'BK-1',programId:'p1',status:'CONFIRMED',financialState:'CONFIRMED'}],travelers:[],rooming:[],visas:[],tickets:[],transport:[],tasks:[],incidents:[],services:[],readiness:{...ready,bookingResults:{b1:ready}},closure:{canClose:true,program,blockers:[],evidenceReferences:[]},accounting:{byCurrency:[{currency:'SAR',revenue:'1000',cost:'700',profit:'300'}]}}as unknown as Program360;
const booking360={booking:{id:'b1',code:'BK-1',programId:'p1',status:'CONFIRMED',financialState:'CONFIRMED'},program,travelers:[],rooming:[],visas:[],tickets:[],transport:[],tasks:[],incidents:[],services:[],readiness:blocked,financialReadiness:{ready:false,blockers:['UNRESOLVED_WORKFLOW'],warnings:[],evidenceReferences:['w1']}}as unknown as Booking360;

test('HU-03 web client calls the real readiness endpoints and HTTP method',async()=>{
 const calls:Array<{path:string;method?:string}>=[];
 const api=createHajjUmrahReadinessApi(async <T>(path:string,init?:RequestInit)=>{calls.push({path,...(init?.method?{method:init.method}:{})});return{}as T});
 await api.programReadiness('program /1');await api.booking360('booking/1');await api.workQueue('p1');await api.reports('p1');await api.closeProgram('p1');
 assert.deepEqual(calls,[
  {path:'/hajj-umrah/readiness/program/program%20%2F1'},
  {path:'/hajj-umrah/readiness/booking/booking%2F1/360'},
  {path:'/hajj-umrah/readiness/program/p1/work-queue'},
  {path:'/hajj-umrah/readiness/program/p1/reports'},
  {path:'/hajj-umrah/readiness/program/p1/closure',method:'POST'},
 ]);
});

test('Booking 360 renders lifecycle financial and final readiness as separate states with actionable blocker',()=>{
 const html=renderToStaticMarkup(createElement(ReadinessWorkspaceView,{programs:[program],programId:'p1',onProgramChange:()=>undefined,tab:'booking360',onTabChange:()=>undefined,capabilities:{view:true,view360:true,reports:true,close:true},program360,booking360,bookingId:'b1',onBookingChange:()=>undefined,onCloseRequest:()=>undefined,closing:false}));
 assert.match(html,/دورة الحجز/);assert.match(html,/الحالة المالية/);assert.match(html,/الجاهزية النهائية/);assert.match(html,/التأشيرة المطلوبة للمسافر غير صادرة/);
});

test('permission-disabled closure UI does not expose a closure action',()=>{
 const html=renderToStaticMarkup(createElement(ReadinessWorkspaceView,{programs:[program],programId:'p1',onProgramChange:()=>undefined,tab:'closure',onTabChange:()=>undefined,capabilities:{view:true,view360:true,reports:true,close:false},bookingId:'',onBookingChange:()=>undefined,onCloseRequest:()=>undefined,closing:false}));
 assert.match(html,/لا توجد صلاحية لإغلاق البرنامج/);assert.doesNotMatch(html,/إغلاق البرنامج بأمان/);
});

test('readiness workspace route is registered as one focused Hajj and Umrah entry',()=>{
 const route=findRoute('/hajj-umrah/readiness');assert.equal(route.id,'hajj-umrah-readiness');assert.equal(route.label,'مركز الجاهزية والتشغيل');
});
