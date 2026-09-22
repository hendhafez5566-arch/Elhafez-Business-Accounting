import assert from'node:assert/strict';
import test from'node:test';
import{executionContext,sourceReference,type ExecutionContext}from'@elhafez/contracts';
import type{Booking,BookingStatus}from'@elhafez/hajj-umrah-bookings';
import type{Program,Requirement}from'@elhafez/hajj-umrah-programs';
import type{RoomAssignment}from'@elhafez/hajj-umrah-rooming';
import type{VisaCase,VisaStatus}from'@elhafez/hajj-umrah-visa-operations';
import type{TicketRecord,TicketStatus}from'@elhafez/hajj-umrah-ticketing';
import type{ManifestAssignment,TransportRun,TransportRunStatus}from'@elhafez/hajj-umrah-transport-operations';
import type{Incident,OperationTask}from'@elhafez/hajj-umrah-trip-operations';
import type{Allocation}from'@elhafez/tourism-contract-inventory';
import{HajjUmrahReadinessApplicationService}from'./application/hajj-umrah-readiness.application-service.js';
import type{ReadinessAccess,ReadinessSources}from'./application/readiness.ports.js';
import type{ClosureEvidenceAdvance,ReadinessRepository}from'./application/readiness.repository.js';
import type{ClosureEvidenceRecord,ClosureEvidenceStatus}from'./domain/readiness.js';

const now='2027-04-20T10:00:00.000Z',ctx=executionContext('c1','b1','u1');

class MemoryRepo implements ReadinessRepository{
 readonly rows:ClosureEvidenceRecord[]=[];
 failAdvanceFrom:ClosureEvidenceStatus|null=null;
 async reserve(value:ClosureEvidenceRecord){const prior=this.rows.find(row=>row.companyId===value.companyId&&row.branchId===value.branchId&&row.programId===value.programId&&row.programUpdatedAt===value.programUpdatedAt);if(prior)return prior;this.rows.push(structuredClone(value));return structuredClone(value)}
 async findByProgramVersion(companyId:string,branchId:string,programId:string,programUpdatedAt:string){const value=this.rows.find(row=>row.companyId===companyId&&row.branchId===branchId&&row.programId===programId&&row.programUpdatedAt===programUpdatedAt);return value?structuredClone(value):null}
 async latestForProgram(companyId:string,branchId:string,programId:string){const value=[...this.rows].reverse().find(row=>row.companyId===companyId&&row.branchId===branchId&&row.programId===programId);return value?structuredClone(value):null}
 async advance(id:string,expectedStatus:ClosureEvidenceStatus,expectedRevision:number,next:ClosureEvidenceAdvance){
  if(this.failAdvanceFrom===expectedStatus){this.failAdvanceFrom=null;throw new Error(`injected advance failure after ${expectedStatus}`)}
  const index=this.rows.findIndex(row=>row.id===id);if(index<0)throw new Error('closure evidence not found');
  const current=this.rows[index]!;
  const order:Record<ClosureEvidenceStatus,number>={PREPARED:0,OWNER_CLOSED:1,FINANCE_CONFIRMED:2,COMPLETED:3};
  const expectedNext:Partial<Record<ClosureEvidenceStatus,ClosureEvidenceStatus>>={PREPARED:'OWNER_CLOSED',OWNER_CLOSED:'FINANCE_CONFIRMED',FINANCE_CONFIRMED:'COMPLETED'};
  if(expectedNext[expectedStatus]!==next.status)throw new Error('invalid transition');
  if(current.status!==expectedStatus||current.revision!==expectedRevision){if(order[current.status]>=order[next.status])return structuredClone(current);throw new Error('closure evidence CAS conflict')}
  const value:ClosureEvidenceRecord={...current,status:next.status,revision:current.revision+1,updatedAt:next.updatedAt,evidenceHash:next.evidenceHash??current.evidenceHash,evidence:next.evidence??current.evidence,...(next.financialEvidence!==undefined?{financialEvidence:next.financialEvidence}:current.financialEvidence!==undefined?{financialEvidence:current.financialEvidence}:{}),...(next.status==='COMPLETED'&&next.completedAt?{completedAt:next.completedAt}:current.completedAt?{completedAt:current.completedAt}:{})};
  this.rows[index]=value;return structuredClone(value);
 }
}
class Access implements ReadinessAccess{
 readonly audits:string[]=[];auditAttempts=0;failAuditAfterWriteOnce=false;
 async requireBranch(c:ExecutionContext){if(c.companyId!=='c1'||c.branchId!=='b1')throw new Error('branch denied')}
 async requirePermission(c:ExecutionContext){if(c.actorId==='denied')throw new Error('permission denied')}
 async auditOnce(_c:ExecutionContext,key:string){this.auditAttempts++;if(!this.audits.includes(key))this.audits.push(key);if(this.failAuditAfterWriteOnce){this.failAuditAfterWriteOnce=false;throw new Error('injected audit acknowledgement failure')}}
}
interface MutableState{
 bookingStatus:BookingStatus;rooming:boolean;visa:VisaStatus;ticket:TicketStatus;transport:boolean;run:TransportRunStatus;finance:boolean;
 task:boolean;incident:boolean;supply:boolean;roomingOwnerFailure:boolean;financeClose:number;financeCalls:number;financeCommandKeys:string[];ownerClose:number;ownerEntered:number;ownerFailure:boolean;ownerGate?:Promise<void>;
}
function makeProgram(requirements:readonly Requirement[]):Program{
 const components=[
  ...(requirements.includes('HOTEL')?[{type:'HOTEL' as const,title:'فندق',sequence:1,start:'2027-05-01',end:'2027-05-20',inventoryReference:'hotel-1'}]:[]),
  ...(requirements.includes('VISA')?[{type:'VISA' as const,title:'تأشيرة',sequence:2,start:'2027-04-01',inventoryReference:'visa-1'}]:[]),
  ...(requirements.includes('FLIGHT')?[{type:'FLIGHT' as const,title:'طيران',sequence:3,start:'2027-05-01',inventoryReference:'flight-1'}]:[]),
  ...(requirements.includes('TRANSPORT')?[{type:'TRANSPORT' as const,title:'نقل',sequence:4,start:'2027-05-01',end:'2027-05-20',inventoryReference:'bus-1'}]:[]),
 ];
 return{id:'p1',companyId:ctx.companyId,branchId:'b1',code:'UM-1',type:'UMRAH',seasonId:'s1',arabicName:'برنامج اختبار',snapshot:{departureDate:'2027-05-01',returnDate:'2027-05-20',salesStart:'2027-01-01',salesClose:'2027-04-01',capacity:'20',currency:'SAR',prices:{},requirements:[...requirements],components},temporaryHoldMinutes:20,status:'BOOKABLE',bookingOpen:true,currentVersion:1,currentVersionId:'pv1',createdAt:now,updatedAt:'2027-04-01T00:00:00.000Z'};
}
function makeBooking(id='b1',traveler='t1'):Booking{return{id,companyId:ctx.companyId,branchId:'b1',code:id,programId:'p1',customerId:'customer-1',customerPartyId:'party-1',travelerIds:[traveler],status:'CONFIRMED',financialState:'CONFIRMED',allocationIds:['ra','va','fa','ba'],createdAt:now,updatedAt:now}}
function allocation(id:string,resourceType:Allocation['resourceType'],resourceId:string):Allocation{return{id,companyId:ctx.companyId,contractId:'contract-'+id,contractVersionId:'version-'+id,resourceType,resourceId,program:sourceReference('HAJJ_UMRAH_PROGRAM','p1'),serviceDate:'2027-05-01',...(resourceType==='HOTEL'||resourceType==='TRANSPORT'?{periodEnd:'2027-05-20'}:{}),quantity:'1',status:'CONFIRMED',createdAt:now}as Allocation}

function fixture(requirements:readonly Requirement[]=['HOTEL','VISA','FLIGHT','TRANSPORT']){
 let program=makeProgram(requirements);
 let bookings:Booking[]=[makeBooking()];
 const state:MutableState={bookingStatus:'CONFIRMED',rooming:true,visa:'ISSUED',ticket:'ISSUED',transport:true,run:'SCHEDULED',finance:true,task:false,incident:false,supply:true,roomingOwnerFailure:false,financeClose:0,financeCalls:0,financeCommandKeys:[],ownerClose:0,ownerEntered:0,ownerFailure:false};
 const allocations=new Map<string,Allocation>([
  ['ra',allocation('ra','HOTEL','hotel-1')],['va',allocation('va','VISA','visa-1')],['fa',allocation('fa','FLIGHT_BLOCK','flight-1')],['ba',allocation('ba','TRANSPORT','bus-1')],
 ]);
 const sources:ReadinessSources={
  async program(_c,id){if(id!=='p1')throw new Error('program not found');return program},
  async closeProgramOwner(_c,_id,expected){state.ownerClose++;state.ownerEntered++;if(state.ownerGate)await state.ownerGate;if(program.status==='CLOSED')return program;if(state.ownerFailure)throw new Error('concurrent');if(program.updatedAt!==expected)throw new Error('concurrent');program={...program,status:'CLOSED',bookingOpen:false,returnRecordedAt:now,updatedAt:now};return program},
  async booking(_c,id){const value=bookings.find(row=>row.id===id);if(!value)throw new Error('booking not found');return{...value,status:state.bookingStatus}},
  async bookings(){return bookings.map(row=>({...row,status:state.bookingStatus}))},
  async traveler(_c,id){return{id,companyId:ctx.companyId,fullName:'مسافر '+id,dateOfBirth:null,gender:null,nationality:'EG',partyId:null,customerId:null,status:'ACTIVE',createdAt:now,updatedAt:now}as never},
  async passport(_c,id){return{id:'passport-'+id,companyId:ctx.companyId,travelerId:id,documentType:'PASSPORT',documentNumber:'P12345',issuingCountry:'EG',issuingPlace:null,holderNameSnapshot:'مسافر',issueDate:'2024-01-01',expiryDate:'2028-01-01',isCurrent:true,supersededByDocumentId:null,createdAt:now}as never},
  async rooming(){if(state.roomingOwnerFailure)throw new Error('rooming owner unavailable');if(!state.rooming)return[];return bookings.flatMap(booking=>booking.travelerIds.map(travelerId=>({id:'room-'+booking.id+travelerId,companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:booking.id,travelerId,allocationId:'ra',roomKey:'101',startDate:'2027-05-01',endDate:'2027-05-20',status:'ASSIGNED',revision:1,createdAt:now,updatedAt:now}as RoomAssignment)))},
  async visas(){return bookings.flatMap(booking=>booking.travelerIds.map(travelerId=>({id:'visa-'+booking.id+travelerId,companyId:ctx.companyId,branchId:'b1',bookingId:booking.id,programId:'p1',travelerId,passportDocumentId:'passport-'+travelerId,allocationId:'va',status:state.visa,attempt:1,createdAt:now,updatedAt:now}as VisaCase)))},
  async tickets(){return bookings.flatMap(booking=>booking.travelerIds.map(travelerId=>({id:'ticket-'+booking.id+travelerId,companyId:ctx.companyId,branchId:'b1',bookingId:booking.id,programId:'p1',travelerId,allocationId:'fa',flightBlockId:'flight-1',flightSegmentReference:sourceReference('FLIGHT_SEGMENT','seg'),pnr:'PNR',status:state.ticket,revision:1,createdAt:now,updatedAt:now}as TicketRecord)))},
  async transportRuns(){return state.transport?[{id:'run1',companyId:ctx.companyId,branchId:'b1',programId:'p1',allocationId:'ba',code:'BUS1',route:'A-B',startsAt:'2027-05-01T08:00:00.000Z',endsAt:'2027-05-01T12:00:00.000Z',status:state.run,revision:1,createdAt:now,updatedAt:now}as TransportRun]:[]},
  async manifest(){return state.transport?bookings.flatMap(booking=>booking.travelerIds.map(travelerId=>({id:'manifest-'+booking.id+travelerId,companyId:ctx.companyId,branchId:'b1',runId:'run1',bookingId:booking.id,travelerId,status:'ASSIGNED',revision:1,createdAt:now,updatedAt:now}as ManifestAssignment))):[]},
  async tasks(){return state.task?[{id:'task1',companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:'b1',title:'مهمة متأخرة',dueAt:'2027-04-19T00:00:00.000Z',status:'OPEN',createdAt:now,updatedAt:now}as OperationTask]:[]},
  async incidents(){return state.incident?[{id:'incident1',companyId:ctx.companyId,branchId:'b1',programId:'p1',bookingId:'b1',severity:'CRITICAL',summary:'بلاغ حرج',status:'OPEN',createdAt:now,updatedAt:now}as Incident]:[]},
  async services(){return[]},
  async allocation(_company,id){return allocations.get(id)??null},
  async supply(input){return{available:state.supply,resourceType:input.resourceType,resourceId:input.resourceId,contractId:'contract-'+input.resourceId,availableQuantity:state.supply?'10':'0'}as never},
  async bookingFinancial(){return state.finance?{ready:true,blockers:[],warnings:[],evidenceReferences:['booking-finance']}:{ready:false,blockers:['UNRESOLVED_WORKFLOW:BOOKING_DEPOSIT:w1'],warnings:[],evidenceReferences:['w1']}},
  async programFinancial(){return state.finance?{ready:true,blockers:[],warnings:[],evidenceReferences:['program-finance']}:{ready:false,blockers:['UNRESOLVED_WORKFLOW:PROGRAM_CLOSE:w2'],warnings:[],evidenceReferences:['w2']}},
  async closeFinancial(input){state.financeCalls++;if(!state.financeCommandKeys.includes(input.commandKey)){state.financeCommandKeys.push(input.commandKey);state.financeClose++}return{closed:true,workflowId:'wf-close'}},
  async programAccounting(){return{byCurrency:[{currency:'SAR',revenue:'1000',cost:'700',profit:'300'}]}},
 };
 const repo=new MemoryRepo(),access=new Access();let sequence=0;
 const service=new HajjUmrahReadinessApplicationService(repo,access,sources,()=>new Date(now),()=>`id-${++sequence}`);
 return{
  service,state,repo,access,
  get program(){return program},
  setProgram(update:Partial<Program>){program={...program,...update}},
  get bookings(){return bookings},
  setBookings(value:readonly Booking[]){bookings=[...value]},
  setBookingAllocations(ids:readonly string[]){bookings=bookings.map(row=>({...row,allocationIds:[...ids]}))},
 };
}

test('fully satisfied booking is READY and non-applicable transport never blocks',async()=>{
 const ready=fixture();assert.equal((await ready.service.bookingReadiness(ctx,'b1')).status,'READY');
 const noTransport=fixture(['HOTEL','FLIGHT']);noTransport.state.transport=false;assert.equal((await noTransport.service.bookingReadiness(ctx,'b1')).status,'READY');
});

test('booking readiness returns exact rooming visa ticket and transport blockers',async()=>{
 const f=fixture();f.state.rooming=false;assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(row=>row.code==='ROOMING_REQUIRED'));
 f.state.rooming=true;f.state.visa='SUBMITTED';assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(row=>row.code==='VISA_NOT_ISSUED'));
 f.state.visa='ISSUED';f.state.ticket='RESERVED';assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(row=>row.code==='TICKET_NOT_ISSUED'));
 f.state.ticket='ISSUED';f.state.transport=false;assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(row=>row.code==='TRANSPORT_ASSIGNMENT_MISSING'));
});

test('confirmed allocation remains valid supply evidence when remaining capacity is zero',async()=>{
 const f=fixture();f.state.supply=false;assert.equal((await f.service.bookingReadiness(ctx,'b1')).status,'READY');
 f.setBookingAllocations([]);assert.ok((await f.service.bookingReadiness(ctx,'b1')).blockers.some(row=>row.code==='SUPPLY_NOT_AVAILABLE'));
});

test('current canonical evidence overrides booking lifecycle READY',async()=>{
 const f=fixture();f.state.bookingStatus='READY';
 assert.equal((await f.service.bookingReadiness(ctx,'b1')).status,'READY');
 f.state.task=true;f.state.incident=true;f.state.finance=false;
 const blocked=await f.service.bookingReadiness(ctx,'b1');
 assert.equal(blocked.status,'NOT_READY');
 assert.ok(blocked.blockers.some(row=>row.code==='OVERDUE_TASK'));
 assert.ok(blocked.blockers.some(row=>row.code==='SERIOUS_INCIDENT_OPEN'));
 assert.ok(blocked.blockers.some(row=>row.category==='FINANCIAL'&&row.code.startsWith('UNRESOLVED_WORKFLOW')));
});

test('program readiness aggregates exact blocking bookings and enforces branch isolation',async()=>{
 const f=fixture();f.setBookings([makeBooking('b1','t1'),makeBooking('b2','t2')]);f.state.rooming=false;
 const result=await f.service.programReadiness(ctx,'p1');assert.equal(result.status,'NOT_READY');assert.ok(result.blockers.some(row=>row.bookingId==='b2'));
 await assert.rejects(()=>f.service.programReadiness(executionContext('c1','b2','u1'),'p1'),/branch denied/);
 await assert.rejects(()=>f.service.programReadiness(executionContext('c2','b1','u1'),'p1'),/branch denied/);
});

test('owner evidence failure is never silently omitted',async()=>{
 const f=fixture();f.state.roomingOwnerFailure=true;
 const result=await f.service.programReadiness(ctx,'p1');
 assert.equal(result.status,'NOT_READY');
 assert.ok(result.blockers.some(row=>row.code==='OWNER_EVIDENCE_UNAVAILABLE'&&row.owner==='hajj-umrah-rooming'));
});

test('Booking 360 and Program 360 keep lifecycle financial and readiness states separate',async()=>{
 const f=fixture();
 const booking=await f.service.booking360(ctx,'b1');
 assert.equal(booking.booking.status,'CONFIRMED');assert.equal(booking.booking.financialState,'CONFIRMED');assert.equal(booking.readiness.status,'READY');assert.equal(booking.financialReadiness?.ready,true);
 const program=await f.service.program360(ctx,'p1');
 assert.equal(program.bookingSummary.total,1);assert.equal(program.travelers.length,1);assert.equal(program.readiness.status,'READY');assert.ok(program.supplyCoverage.length>=4);assert.ok(program.supplyCoverage.every(row=>row.status==='ALLOCATED'));
});

test('work queue derives canonical work once and resolved work disappears',async()=>{
 const f=fixture();f.state.task=true;
 const open=await f.service.workQueue(ctx,'p1');
 assert.equal(open.filter(row=>row.reference?.sourceId==='task1').length,1);
 assert.equal(open.find(row=>row.reference?.sourceId==='task1')?.priority,'HIGH');
 f.state.task=false;
 assert.equal((await f.service.workQueue(ctx,'p1')).filter(row=>row.reference?.sourceId==='task1').length,0);
});

test('closure blockers and financial blockers leave program state unchanged',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});
 let result=await f.service.closeProgram(ctx,'p1');assert.equal(result.closed,false);assert.equal(f.program.status,'IN_TRIP');assert.equal(f.state.financeClose,0);assert.equal(f.state.ownerClose,0);
 f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';f.state.finance=false;
 result=await f.service.closeProgram(ctx,'p1');assert.equal(result.closed,false);assert.equal(f.program.status,'IN_TRIP');assert.equal(f.state.ownerClose,0);
});

test('safe closure retains one durable completed record and replay is idempotent',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';
 const first=await f.service.closeProgram(ctx,'p1');
 assert.equal(first.closed,true);assert.equal(first.idempotent,false);assert.equal(f.program.status,'CLOSED');assert.equal(f.repo.rows.length,1);assert.equal(f.repo.rows[0]?.status,'COMPLETED');assert.equal(f.repo.rows[0]?.revision,3);assert.ok(f.repo.rows[0]?.completedAt);assert.equal(f.state.financeClose,1);assert.equal(f.state.ownerClose,1);
 const replay=await f.service.closeProgram(ctx,'p1');
 assert.equal(replay.closed,true);assert.equal(replay.idempotent,true);assert.equal(f.state.financeClose,1);assert.equal(f.state.financeCommandKeys.length,1);assert.equal(f.state.ownerClose,1);assert.equal(f.access.audits.length,1);
});

test('concurrent close callers converge to CLOSED and one durable COMPLETED evidence record',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';
 let release!:()=>void;f.state.ownerGate=new Promise<void>(resolve=>{release=resolve});
 const left=f.service.closeProgram(ctx,'p1'),right=f.service.closeProgram(ctx,'p1');
 while(f.state.ownerEntered<2)await new Promise<void>(resolve=>setImmediate(resolve));
 release();
 const results=await Promise.all([left,right]);
 assert.ok(results.every(result=>result.closed));
 assert.equal(f.program.status,'CLOSED');assert.equal(f.repo.rows.length,1);assert.equal(f.repo.rows[0]?.status,'COMPLETED');assert.equal(f.repo.rows[0]?.revision,3);
 assert.equal(f.state.financeClose,1);assert.equal(f.state.financeCommandKeys.length,1);assert.equal(f.access.audits.length,1);
});

test('failure after Program owner close but before evidence advance resumes safely on retry',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';f.repo.failAdvanceFrom='PREPARED';
 await assert.rejects(()=>f.service.closeProgram(ctx,'p1'),/injected advance failure/);
 assert.equal(f.program.status,'CLOSED');assert.equal(f.repo.rows[0]?.status,'PREPARED');assert.equal(f.state.financeClose,0);
 const retry=await f.service.closeProgram(ctx,'p1');
 assert.equal(retry.closed,true);assert.equal(f.repo.rows[0]?.status,'COMPLETED');assert.equal(f.state.financeClose,1);assert.equal(f.state.financeCommandKeys.length,1);assert.equal(f.access.audits.length,1);
});

test('failure after COMPLETED but before audit is recoverable and auditOnce eventually records exactly once',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';f.access.failAuditAfterWriteOnce=true;
 await assert.rejects(()=>f.service.closeProgram(ctx,'p1'),/injected audit acknowledgement failure/);
 assert.equal(f.program.status,'CLOSED');assert.equal(f.repo.rows[0]?.status,'COMPLETED');assert.equal(f.access.audits.length,1);assert.equal(f.state.financeClose,1);
 const retry=await f.service.closeProgram(ctx,'p1');
 assert.equal(retry.closed,true);assert.equal(f.access.auditAttempts,2);assert.equal(f.access.audits.length,1);assert.equal(f.state.financeClose,1);assert.equal(f.state.financeCommandKeys.length,1);
});

test('concurrent program amendment/version change cannot commit TFO close while Program remains IN_TRIP',async()=>{
 const f=fixture();f.setProgram({status:'IN_TRIP',departureRecordedAt:'2027-05-01T00:00:00.000Z'});f.state.bookingStatus='COMPLETED';f.state.run='COMPLETED';
 let release!:()=>void;f.state.ownerGate=new Promise<void>(resolve=>{release=resolve});
 const closing=f.service.closeProgram(ctx,'p1');
 while(f.state.ownerEntered<1)await new Promise<void>(resolve=>setImmediate(resolve));
 f.setProgram({updatedAt:'2027-04-02T00:00:00.000Z',currentVersion:2,currentVersionId:'pv2'});
 release();
 const result=await closing;
 assert.equal(result.closed,false);assert.equal(f.program.status,'IN_TRIP');assert.equal(f.state.financeClose,0);assert.equal(f.state.financeCalls,0);assert.equal(f.repo.rows[0]?.status,'PREPARED');
 assert.ok(result.blockers.some(row=>row.code==='CONCURRENT_PROGRAM_CHANGE'));
});

test('permission enforcement happens before readiness evaluation',async()=>{
 const f=fixture();await assert.rejects(()=>f.service.programReadiness(executionContext('c1','b1','denied'),'p1'),/permission denied/);
});
