import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, sourceReference, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import { HajjUmrahBookingsApplicationService } from './application/hajj-umrah-bookings.application-service.js';
import type { BookingRepository } from './application/booking.repository.js';
import type { BookingAccess, BookingAgentPort, BookingFinancePort } from './application/booking.ports.js';
import type { Booking, BookingHistory } from './domain/booking.js';

class Repo implements BookingRepository {
  rows=new Map<string,Booking>(); logs:BookingHistory[]=[];
  key(c:string,b:string,id:string){return `${c}:${b}:${id}`;}
  async create(v:Booking,h:BookingHistory){if([...this.rows.values()].some(x=>x.companyId===v.companyId&&x.branchId===v.branchId&&x.code===v.code))throw Error('duplicate code');this.rows.set(this.key(v.companyId,v.branchId,v.id),v);this.logs.push(h);return v;}
  async save(v:Booking,h:BookingHistory){const key=this.key(v.companyId,v.branchId,v.id),old=this.rows.get(key);if((old?.revision??0)!==(v.revision??0))throw Error('revision conflict');const next={...v,revision:(v.revision??0)+1};this.rows.set(key,next);this.logs.push(h);return next;}
  async get(c:string,b:string,id:string){return this.rows.get(this.key(c,b,id))??null;}
  async list(c:string,b:string){return [...this.rows.values()].filter(x=>x.companyId===c&&x.branchId===b);}
  async history(c:string,b:string,id:string){return this.logs.filter(x=>x.companyId===c&&x.branchId===b&&x.bookingId===id);}
}
class Access implements BookingAccess{async requireBranch(c:ExecutionContext){if(c.companyId==='other'||c.branchId==='other')throw Error('branch denied');}async requirePermission(){}async audit(){}}
const program={id:'p1',companyId:'c1' as CompanyId,branchId:'b1',code:'P',type:'UMRAH' as const,seasonId:'s',arabicName:'عمرة',snapshot:{departureDate:'2027-01-10',returnDate:'2027-01-20',salesStart:'2026-01-01',salesClose:'2027-01-01',capacity:'10',currency:'SAR',prices:{},requirements:[],components:[]},temporaryHoldMinutes:15,status:'BOOKABLE' as const,bookingOpen:true,currentVersion:1,currentVersionId:'pv1',createdAt:'',updatedAt:''};
function fixture(){
  const repo=new Repo();let n=0;let confirmCalls=0,cancelCalls=0;let open=true;let debtorParty:string|undefined;let cancelResult:unknown={cancelled:true};
  const finance:BookingFinancePort={async confirm(i){debtorParty=i.customerPartyId;confirmCalls++;return{workflowId:'w1',allocations:i.inventories.map((_,x)=>({id:`alloc-${x+1}`,quantity:'1'}))};},async cancel(){cancelCalls++;return cancelResult;}};
  const agents:BookingAgentPort={async requireActive(_c,id){return{id:id as never,companyId:'c1' as CompanyId,partyId:id==='agent'?'party-a':'party-'+id,number:'A',status:'ACTIVE',notes:null,commission:{kind:'PERCENT' as const,value:'0',currency:null},createdAt:'',updatedAt:''};},async register(){}};const access:BookingAccess=new Access();
  const service=new HajjUmrahBookingsApplicationService(repo,access,{async require(){return{...program,bookingOpen:open};}},{async requireActive(_c,id){if(id==='bad')throw Error('traveler not found');return{id:id as never,companyId:'c1' as CompanyId,fullName:id,dateOfBirth:null,gender:null,nationality:null,partyId:null,customerId:'cust',status:'ACTIVE',createdAt:'',updatedAt:''};}},{async requireActive(_c,id){if(id==='foreign')throw Error('customer not found');return{id:id as never,companyId:'c1' as CompanyId,partyId:id==='cust'?'party-c':'party-responsible',number:'C',status:'ACTIVE',assignedAgentId:null,commercialNotes:null,createdAt:'',updatedAt:''};},async register(){}},agents,finance,()=>new Date('2026-09-22T00:00:00Z'),()=>`id-${++n}`);
  return{agents,access,finance,repo,service,debtorParty:()=>debtorParty,setOpen:(v:boolean)=>open=v,setCancel:(v:unknown)=>cancelResult=v,calls:()=>({confirmCalls,cancelCalls})};
}
const c=executionContext('c1','b1','u1');
const create={code:'B1',programId:'p1',customerId:'cust',travelerIds:['t1','t2']};
const confirm={commandKey:'confirm:B1',category:'OTHER' as const,costCenterId:'cc1',currency:'SAR',grossAmount:'1000',discountAmount:'0',postingDate:'2026-09-22',dueDate:'2027-01-01',invoiceNumber:'INV-B1',inventories:[{allocationId:'req-hotel',contractId:'hc',resourceType:'HOTEL',resourceId:'hotel-1',serviceDate:'2027-01-10',quantity:'2'},{allocationId:'req-flight',contractId:'fc',resourceType:'FLIGHT_BLOCK',resourceId:'flight-1',serviceDate:'2027-01-10',quantity:'2',flightSegmentReference:sourceReference('SEGMENT','seg-1')}]};

test('creates preliminary booking with canonical traveler validation and branch isolation',async()=>{const f=fixture();const b=await f.service.create(c,create);assert.equal(b.status,'PRELIMINARY');assert.equal(b.financialState,'UNCONFIRMED');assert.deepEqual(b.travelerIds,['t1','t2']);await assert.rejects(()=>f.service.get(executionContext('c1','other','u1'),b.id),/branch denied/);});
test('invalid traveler reference is rejected through owner boundary',async()=>{const f=fixture();await assert.rejects(()=>f.service.create(c,{...create,travelerIds:['bad']}),/traveler/);});
test('closed booking availability blocks confirmation before finance orchestration',async()=>{const f=fixture();const b=await f.service.create(c,create);f.setOpen(false);await assert.rejects(()=>f.service.confirm(c,b.id,confirm),/not open/);assert.equal(f.calls().confirmCalls,0);});
test('multi-allocation confirmation persists TFO allocation evidence and is idempotent',async()=>{const f=fixture();const b=await f.service.create(c,create);const first=await f.service.confirm(c,b.id,confirm);assert.deepEqual(first.allocationIds,['alloc-1','alloc-2']);const replay=await f.service.confirm(c,b.id,confirm);assert.equal(replay.id,b.id);assert.equal(f.calls().confirmCalls,1);await assert.rejects(()=>f.service.confirm(c,b.id,{...confirm,grossAmount:'999'}),/conflicting/);});
test('financial cancellation blocker never marks booking cancelled and history is retained',async()=>{const f=fixture();const b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);f.setCancel({blockers:[{type:'CUSTOMER_SETTLEMENT_REQUIRED'}]});const blocked=await f.service.cancel(c,b.id,{commandKey:'cancel:B1',postingDate:'2026-09-22',reason:'طلب العميل'});assert.equal(blocked.status,'CONFIRMED');assert.equal(blocked.financialState,'CANCELLATION_BLOCKED');const history=await f.service.historyFor(c,b.id);assert.ok(history.some(x=>x.action==='CANCELLATION_BLOCKED'));});
test('clean cancellation and lifecycle transitions preserve history',async()=>{const f=fixture();const b=await f.service.create(c,{...create,code:'B2'});await f.service.confirm(c,b.id,{...confirm,commandKey:'confirm:B2',invoiceNumber:'INV-B2'});const ready=await f.service.markReady(c,b.id);assert.equal(ready.status,'READY');const traveling=await f.service.startTravel(c,b.id);assert.equal(traveling.status,'TRAVELING');const completed=await f.service.complete(c,b.id);assert.equal(completed.status,'COMPLETED');const h=await f.service.historyFor(c,b.id);assert.deepEqual(h.map(x=>x.toStatus).filter(Boolean),['PRELIMINARY','CONFIRMED','READY','TRAVELING','COMPLETED']);});
test('clean confirmed cancellation becomes cancelled only after finance owner confirms',async()=>{const f=fixture();const b=await f.service.create(c,{...create,code:'B3'});await f.service.confirm(c,b.id,{...confirm,commandKey:'confirm:B3',invoiceNumber:'INV-B3'});const cancelled=await f.service.cancel(c,b.id,{commandKey:'cancel:B3',postingDate:'2026-09-22',reason:'إلغاء'});assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.financialState,'CANCELLED');});

test('family of four keeps non-traveling financial customer separate and invoices only debtor',async()=>{const f=fixture();const b=await f.service.create(c,{...create,financialCustomerId:'responsible',familyReference:'FAMILY-1',travelerIds:['t1','t2','t3','t4']});assert.equal(b.customerId,'cust');assert.equal(b.financialCustomerId,'responsible');assert.equal(b.financialPartyId,'party-responsible');assert.equal(b.familyReference,'FAMILY-1');assert.equal(b.travelerIds.length,4);await f.service.confirm(c,b.id,confirm);assert.equal(f.debtorParty(),'party-responsible');assert.equal(f.calls().confirmCalls,1);});
test('financial customer is resolved through owner and cannot refer to a foreign company',async()=>{const f=fixture();await assert.rejects(()=>f.service.create(c,{...create,financialCustomerId:'foreign'}),/customer not found/);assert.equal(f.repo.rows.size,0);});

test('hold deadline extension and release preserve history and canonical reordered request identity',async()=>{
 const f=fixture();let holdCalls=0,releaseCalls=0;f.finance.hold=async()=>{holdCalls++;return{allocationId:'held-capacity'};};f.finance.releaseHold=async()=>{releaseCalls++;return{released:true};};
 const b=await f.service.create(c,create),input={requestId:'hold-request-000000001',expiresAt:'2026-09-22T00:10:00Z',inventory:confirm.inventories[0]!};await f.service.placeHold(c,b.id,input);await f.service.placeHold(c,b.id,{...input,inventory:{quantity:input.inventory.quantity,serviceDate:input.inventory.serviceDate,resourceId:input.inventory.resourceId,resourceType:input.inventory.resourceType,contractId:input.inventory.contractId,allocationId:input.inventory.allocationId}});assert.equal(holdCalls,1);
 await f.service.extendHold(c,b.id,'2026-09-22T00:20:00Z','Customer agreed to an extension');assert.equal((await f.service.get(c,b.id)).capacityHold?.expiresAt,'2026-09-22T00:20:00Z');assert.ok((await f.service.historyFor(c,b.id)).some(x=>x.action==='CAPACITY_HOLD_EXTENDED'));
 await f.service.releaseHold(c,b.id,'Customer explicitly released capacity');await f.service.cancel(c,b.id,{commandKey:'cancel-held',postingDate:'2026-09-22',reason:'Customer cancelled'});assert.equal(releaseCalls,1);assert.equal(f.calls().cancelCalls,0);
});

test('confirmation claims the booking before owner effects so preliminary cancellation and conflicting confirmation cannot win',async()=>{
 const f=fixture(),b=await f.service.create(c,create);let entered!:()=>void,resume!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>resume=resolve),original=f.finance.confirm;
 f.finance.confirm=async input=>{entered();await gate;return original(input);};const pending=f.service.confirm(c,b.id,confirm);await ready;await assert.rejects(()=>f.service.cancel(c,b.id,{commandKey:'cancel-racing',postingDate:'2026-09-22',reason:'Cancellation during confirmation'}),/confirmation has started/);await assert.rejects(()=>f.service.confirm(c,b.id,{...confirm,commandKey:'different-confirmation'}),/conflicting pending/);resume();const result=await pending;assert.equal(result.status,'CONFIRMED');assert.equal(f.calls().confirmCalls,1);assert.equal(f.calls().cancelCalls,0);assert.ok((await f.service.historyFor(c,b.id)).some(x=>x.action==='CONFIRMATION_REQUESTED'));
});
test('individual financial responsibilities resolve each debtor through the customer owner before confirmation',async()=>{const f=fixture(),b=await f.service.create(c,create);let charges:unknown;f.finance.confirm=async input=>{charges=input.customerCharges;return{allocations:[]};};await f.service.confirm(c,b.id,{...confirm,financialResponsibilities:[{travelerId:'t1',financialCustomerId:'cust',amount:'400'},{travelerId:'t2',financialCustomerId:'responsible',amount:'600'}]});assert.deepEqual(charges,[{travelerId:'t1',financialCustomerId:'cust',amount:'400',partyId:'party-c'},{travelerId:'t2',financialCustomerId:'responsible',amount:'600',partyId:'party-responsible'}]);});


const agentChange={commandKey:'agent-change',newAgentId:'new-agent',currency:'SAR',reviewed:true,expectedAgreement:null,expectedRemaining:[],reason:'Customer requested another appointed agent',postingDate:'2026-09-22',number:'AGENT-CHANGE'};

test('agent change pins its snapshot and resumes after lost owner reply even when the new agent becomes inactive',async()=>{
 const f=fixture(),b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);let calls=0,registrations=0;
 f.agents.register=async()=>{registrations++;};f.finance.changeAgent=async input=>{calls++;assert.equal(input.newAgentPartyId,'party-new-agent');if(calls===1)throw Error('lost owner reply');return{workflowId:'change',newClaimIds:['new-claim']};};
 await assert.rejects(f.service.changeAgent(c,b.id,agentChange),/lost owner reply/);const pending=await f.service.get(c,b.id);assert.equal(pending.financialMutation?.state,'PENDING');
 f.agents.requireActive=async()=>{throw Error('agent now inactive');};
 const changed=await f.service.changeAgent(executionContext('c1','b1','supervisor'),b.id,agentChange);assert.equal(changed.agentId,'new-agent');assert.equal(changed.financialMutation?.state,'COMPLETED');assert.equal(registrations,1);
 await f.service.changeAgent(c,b.id,agentChange);assert.equal(calls,2);assert.equal(f.repo.logs.filter(x=>x.action==='AGENT_CHANGED').length,1);
 const history=f.repo.logs.find(x=>x.action==='AGENT_CHANGED')!;assert.equal((history.evidence as {requestedBy:string}).requestedBy,'u1');assert.equal(history.actorId,'supervisor');
 await assert.rejects(f.service.changeAgent(c,b.id,{...agentChange,reason:'Different immutable request reason'}),/conflicting agent change/);
});

test('pending agent change excludes cancellation and lifecycle transitions before other owner effects',async()=>{
 const f=fixture(),b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);let started!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 f.finance.changeAgent=async()=>{started();await gate;return{workflowId:'change'};};const changing=f.service.changeAgent(c,b.id,agentChange);await entered;
 await assert.rejects(f.service.cancel(c,b.id,{commandKey:'cancel',postingDate:'2026-09-22',reason:'Conflicting cancellation'}),/pending financial/);await assert.rejects(f.service.markReady(c,b.id),/pending financial/);assert.equal(f.calls().cancelCalls,0);release();await changing;
});

test('pending cancellation excludes agent reassignment before settling commission',async()=>{
 const f=fixture(),b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);let started!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});let changes=0;
 f.finance.cancel=async()=>{started();await gate;return{cancelled:true};};f.finance.changeAgent=async()=>{changes++;return{};};const cancelling=f.service.cancel(c,b.id,{commandKey:'cancel',postingDate:'2026-09-22',reason:'Confirmed cancellation'});await entered;
 await assert.rejects(f.service.changeAgent(c,b.id,agentChange),/pending financial/);assert.equal(changes,0);release();assert.equal((await cancelling).status,'CANCELLED');
});

test('agent change checks financial permission and reviewed agreement before reserving a booking',async()=>{
 const f=fixture(),b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);let changes=0;f.finance.changeAgent=async()=>{changes++;return{};};
 f.agents.snapshot=async()=>({agreementId:'agreement',agreementVersion:2,principalPartyId:'parent',subordinatePartyId:'party-new-agent',principalPercent:'50'});
 await assert.rejects(f.service.changeAgent(c,b.id,agentChange),/agreement changed/);assert.equal((await f.service.get(c,b.id)).financialMutation,undefined);
 f.access.requirePermission=async(_context,permission)=>{if(permission==='accounting.finance.operate')throw Error('financial operation denied');};
 await assert.rejects(f.service.changeAgent(c,b.id,agentChange),/financial operation denied/);assert.equal(changes,0);
});
