import assert from'node:assert/strict';
import test from'node:test';
import{executionContext,sourceReference,type ExecutionContext}from'@elhafez/contracts';
import type{Booking}from'@elhafez/hajj-umrah-bookings';
import type{Program}from'@elhafez/hajj-umrah-programs';
import{HajjUmrahReadinessApplicationService}from'./application/hajj-umrah-readiness.application-service.js';
import type{ReadinessAccess,ReadinessSources}from'./application/readiness.ports.js';
import type{ReadinessRepository}from'./application/readiness.repository.js';
import type{ClosureEvidenceRecord}from'./domain/readiness.js';

const at='2027-04-20T10:00:00.000Z',ctx=executionContext('c1','b1','u1');
class MemoryRepo implements ReadinessRepository{
 rows:ClosureEvidenceRecord[]=[];
 async reserve(v:ClosureEvidenceRecord){const old=this.rows.find(x=>x.companyId===v.companyId&&x.branchId===v.branchId&&x.programId===v.programId&&x.programUpdatedAt===v.programUpdatedAt);if(old)return old;this.rows.push(v);return v}
 async findByProgramVersion(c:string,b:string,p:string,u:string){return this.rows.find(x=>x.companyId===c&&x.branchId===b&&x.programId===p&&x.programUpdatedAt===u)??null}
 async latestForProgram(c:string,b:string,p:string){return[...this.rows].reverse().find(x=>x.companyId===c&&x.branchId===b&&x.programId===p)??null}
 async save(v:ClosureEvidenceRecord){const i=this.rows.findIndex(x=>x.id===v.id);if(i>=0)this.rows[i]=v;else this.rows.push(v);return v}
}
class Access implements ReadinessAccess{
 audits:string[]=[];
 async requireBranch(c:ExecutionContext){if(c.companyId!=='c1'||c.branchId!=='b1')throw new Error('branch denied')}
 async requirePermission(c:ExecutionContext,_p:string){if(c.actorId==='denied')throw new Error('permission denied')}
 async auditOnce(_c:ExecutionContext,key:string){if(!this.audits.includes(key))this.audits.push(key)}
}
function fixture(requirements:any[]=['HOTEL','VISA','FLIGHT','TRANSPORT']){
 let program:any={id:'p1',companyId:ctx.companyId,branchId:'b1',code:'UM-1',type:'UMRAH',seasonId:'s1',arabicName:'برنامج اختبار',snapshot:{departureDate:'2027-05-01',returnDate:'2027-05-20',salesStart:'2027-01-01',salesClose:'2027-04-01',capacity:'20',currency:'SAR',prices:{},requirements,components:[
  ...(requirements.includes('HOTEL')?[{type:'HOTEL',title:'فندق',sequence:1,start:'2027-05-01',end:'2027-05-20',inventoryReference:'hotel-1'}]:[]),
  ...(requirements.includes('VISA')?[{type:'VISA',title:'تأشيرة',sequence:2,inventoryReference:'visa-1'}]:[]),
  ...(requirements.includes('FLIGHT')?[{type:'FLIGHT',title:'طيران',sequence:3,inventoryReference:'flight-1'}]:[]),
  ...(requirements.includes('TRANSPORT')?[{type:'TRANSPORT',title:'نقل',sequence:4,start:'2027-05-01',end:'2027-05-20',inventoryReference:'bus-1'}]:[]),
 ]},temporaryHoldMinutes:20,status:'BOOKABLE',bookingOpen:true,currentVersion:1,currentVersionId:'pv1',createdAt:at,updatedAt:'2027-04-01T00:00:00.000Z'};
 const state={bookingStatus:'CONFIRMED' as Booking['status'],rooming:true,visa:'ISSUED',ticket:'ISSUED',transport:true,run:'SCHEDULED',finance:true,task:false,incident:false,financeClose:0,ownerClose:0};
 const makeBooking=(id='b1',traveler='t1'):any=>({id,companyId:ctx.companyId,branchId:'b1',code:id,programId:'p1',customerId:'c',customerPartyId:'party',travelerIds:[traveler],status:state.bookingStatus,financialState:'CONFIRMED',allocationIds:[],createdAt:at,updatedAt:at});
 let bookings:any[]=[makeBooking()];
 const allocations:any={
  ra:{id:'ra',companyId:ctx.companyId,contractId:'hc',contractVersionId:'hv',resourceType:'HOTEL',resourceId:'hotel-1',program:sourceReference('HAJJ_UMRAH_PROGRAM','p1'),serviceDate:'2027-05-01',periodEnd:'2027-05-20',quantity:'1',status:'CONFIRMED',createdAt:at},
  va:{id:'va',companyId:ctx.companyId,contractId:'vc',contractVersionId:'vv',resourceType:'VISA',resourceId:'visa-1',program:sourceReference('HAJJ_UMRAH_PROGRAM','p1'),serviceDate:'2027-04-01',quantity:'1',status:'CONFIRMED',createdAt:at},
  ba:{id:'ba',companyId:ctx.companyId,contractId:'bc',contractVersionId:'bv',resourceType:'TRANSPORT',resourceId:'bus-1',program:sourceReference('HAJJ_UMRAH_PROGRAM','p1'),serviceDate:'2027-05-01',periodEnd:'2027-05-20',quantity:'20',status:'CONFIRMED',createdAt:at},
 };
 const sources:ReadinessSources={
  async program(_c,id){if(id!=='p1')throw new Error('not found');return program as Program},
  async closeProgramOwner(_c,_id,expected){state.ownerClose++;if(program.updatedAt!==expected)throw new Error('concurrent');program={...program,status:'CLOSED',bookingOpen:false,returnRecordedAt:at,updatedAt:at};return program},
  async booking(_c,id){const b=bookings.find(x=>x.id===id);if(!b)throw new Error('not found');return b},
  async bookings(){return bookings},
  async traveler(_c,id){return{id,companyId:ctx.companyId,fullName:id,status:'ACTIVE',dateOfBirth:null,gender:null,nationality:'EG',partyId:null,customerId:null,createdAt:at,updatedAt:at}as any},
  async passport(_c,id){return{id:'pass-'+id,companyId:ctx.companyId,travelerId:id,documentType:'PASSPORT',documentNumber:'P12345',issuingCountry:'EG',issuingPlace:null,holderNameSnapshot:id,issueDate:'2024-01-01',expiryDate:'2028-01-01',isCurrent:true,supersededByDocumentId:null,createdAt:at}as any},
  async rooming(){return state.rooming?bookings.flatMap((b:any)=>b.travelerIds.map((t:string)=>({id:'room-'+b.id+t,companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:b.id,travelerId:t,allocationId:'ra',roomKey:'101',startDate:'2027-05-01',endDate:'2027-05-20',status:'ASSIGNED',revision:1,createdAt:at,updatedAt:at}as any))):[]},
  async visas(){return bookings.flatMap((b:any)=>b.travelerIds.map((t:string)=>({id:'visa-'+b.id+t,companyId:ctx.companyId,branchId:'b1',bookingId:b.id,programId:'p1',travelerId:t,passportDocumentId:'pass-'+t,allocationId:'va',status:state.visa,attempt:1,createdAt:at,updatedAt:at}as any)))},
  async tickets(){return bookings.flatMap((b:any)=>b.travelerIds.map((t:string)=>({id:'ticket-'+b.id+t,companyId:ctx.companyId,branchId:'b1',bookingId:b.id,programId:'p1',travelerId:t,allocationId:'fa',flightBlockId:'flight-1',flightSegmentReference:sourceReference('FLIGHT_SEGMENT','seg'),pnr:'PNR',status:state.ticket,revision:1,createdAt:at,updatedAt:at}as any)))},
  async transportRuns(){return state.transport?[{id:'run1',companyId:ctx.companyId,branchId:'b1',programId:'p1',allocationId:'ba',code:'BUS1',route:'A-B',startsAt:at,endsAt:'2027-05-01T12:00:00.000Z',status:state.run,revision:1,createdAt:at,updatedAt:at}as any]:[]},
  async manifest(){return state.transport?bookings.flatMap((b:any)=>b.travelerIds.map((t:string)=>({id:'m-'+b.id+t,companyId:ctx.companyId,branchId:'b1',runId:'run1',bookingId:b.id,travelerId:t,status:'ASSIGNED',revision:1,createdAt:at,updatedAt:at}as any))):[]},
  async tasks(){return state.task?[{id:'task1',companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:'b1',title:'مهمة',dueAt:'2027-04-19T00:00:00.000Z',status:'OPEN',createdAt:at,updatedAt:at}as any]:[]},
  async incidents(){return state.incident?[{id:'inc1',companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:'b1',severity:'CRITICAL',summary:'بلاغ',status:'OPEN',createdAt:at,updatedAt:at}as any]:[]},
  async services(){return[]},async allocation(_c,id){return allocations[id]??null},
  async supply(i){return{available:true,resourceType:i.resourceType,resourceId:i.resourceId,contractId:'ct-'+i.resourceId,availableQuantity:'10' as any}},
  async bookingFinancial(){return state.finance?{ready:true,blockers:[],warnings:[],evidenceReferences:['fb']}:{ready:false,blockers:['UNRESOLVED_WORKFLOW:BOOKING_DEPOSIT:w1'],warnings:[],evidenceReferences:['w1']}},
  async programFinancial(){return state.finance?{ready:true,blockers:[],warnings:[],evidenceReferences:['fp']}:{ready:false,blockers:['UNRESOLVED_WORKFLOW:PROGRAM_CLOSE:w2'],warnings:[],evidenceReferences:['w2']}},
  async closeFinancial(){state.financeClose++;return{closed:true,workflowId:'wf'}},async programAccounting(){return{revenue:'1000',cost:'700'}},
 };
 const repo=new MemoryRepo(),access=new Access();let seq=0;const service=new HajjUmrahReadinessApplicationService(repo,access,sources,()=>new Date(at),()=>`id-${++seq}`);
 return{service,state,repo,access,get program(){return program as Program},setProgram(v:any){program={...program,...v}},get bookings(){return bookings as Booking[]},setBookings(v:Booking[]){bookings=[...v]}};
}


test('booking readiness derives every applicable owner signal and ignores non-applicable transport',async()=>{
 const f=fixture();assert.equal((await f.service.bookingReadiness(ctx,'b1')).status,'READY');
 f.state.rooming=false;assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(x=>x.code==='ROOMING_REQUIRED'));f.state.rooming=true;
 f.state.visa='SUBMITTED';assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(x=>x.code==='VISA_NOT_ISSUED'));f.state.visa='ISSUED';
 f.state.ticket='RESERVED';assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(x=>x.code==='TICKET_NOT_ISSUED'));f.state.ticket='ISSUED';
 f.state.transport=false;assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(x=>x.code==='TRANSPORT_ASSIGNMENT_MISSING'));
 const noTransport=fixture(['HOTEL','FLIGHT']);noTransport.state.transport=false;assert.equal((await noTransport.service.bookingReadiness(ctx,'b1')).status,'READY');
});

test('operational and TFO blockers are actionable and current evidence overrides stale readiness',async()=>{
 const f=fixture();const first=await f.service.bookingReadiness(ctx,'b1');assert.equal(first.status,'READY');
 f.state.task=true;f.state.incident=true;f.state.finance=false;
 const blocked=await f.service.bookingReadiness(ctx,'b1');
 assert.ok(blocked.blockers.some(x=>x.code==='OVERDUE_TASK'));
 assert.ok(blocked.blockers.some(x=>x.code==='SERIOUS_INCIDENT_OPEN'));
 assert.ok(blocked.blockers.some(x=>x.category==='FINANCIAL'&&x.code.startsWith('UNRESOLVED_WORKFLOW')));
 f.state.task=false;f.state.incident=false;f.state.finance=true;f.state.ticket='RESERVED';
 assert.equal((await f.service.bookingReadiness(ctx,'b1')).status,'NOT_READY');
});

test('program readiness identifies blocking booking and branch isolation is server side',async()=>{
 const f=fixture();const second={...f.bookings[0]!,id:'b2',code:'B2',travelerIds:['t2']}as Booking;f.setBookings([f.bookings[0]!,second]);f.state.rooming=false;
 const result=await f.service.programReadiness(ctx,'p1');assert.equal(result.status,'NOT_READY');assert.ok(result.blockers.some(x=>x.bookingId==='b2'));
 await assert.rejects(()=>f.service.programReadiness(executionContext('c1','b2','u1'),'p1'),/branch denied/);
});

test('360 projections keep lifecycle financial state and readiness separate',async()=>{
 const f=fixture();const booking=await f.service.booking360(ctx,'b1');
 assert.equal(booking.booking.status,'CONFIRMED');assert.equal(booking.booking.financialState,'CONFIRMED');assert.equal(booking.readiness.status,'READY');assert.equal(booking.financialReadiness?.ready,true);
 const program=await f.service.program360(ctx,'p1');assert.equal(program.bookingSummary.total,1);assert.equal(program.travelers.length,1);assert.equal(program.readiness.status,'READY');assert.deepEqual(program.accounting,{revenue:'1000',cost:'700'});
});

test('work queue is derived and resolved work disappears',async()=>{
 const f=fixture();f.state.task=true;assert.ok((await f.service.workQueue(ctx,'p1')).some(x=>x.reference?.sourceId==='task1'));
 f.state.task=false;assert.ok(!(await f.service.workQueue(ctx,'p1')).some(x=>x.reference?.sourceId==='task1'));
});

test('closure blockers never mutate program state',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});
 let result=await f.service.closeProgram(ctx,'p1');assert.equal(result.closed,false);assert.equal(f.program.status,'IN_TRIP');assert.equal(f.state.financeClose,0);assert.equal(f.state.ownerClose,0);
 f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';f.state.finance=false;
 result=await f.service.closeProgram(ctx,'p1');assert.equal(result.closed,false);assert.equal(f.program.status,'IN_TRIP');assert.equal(f.state.ownerClose,0);
});

test('safe closure retains durable evidence and replay is idempotent',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';
 const first=await f.service.closeProgram(ctx,'p1');assert.equal(first.closed,true);assert.equal(f.program.status,'CLOSED');assert.equal(f.repo.rows[0]?.status,'COMPLETED');assert.equal(f.state.financeClose,1);assert.equal(f.state.ownerClose,1);
 const replay=await f.service.closeProgram(ctx,'p1');assert.equal(replay.closed,true);assert.equal(replay.idempotent,true);assert.equal(f.state.financeClose,1);assert.equal(f.state.ownerClose,1);assert.equal(f.access.audits.length,1);
});

test('permission enforcement precedes readiness evaluation',async()=>{
 const f=fixture();await assert.rejects(()=>f.service.programReadiness(executionContext('c1','b1','denied'),'p1'),/permission denied/);
});
