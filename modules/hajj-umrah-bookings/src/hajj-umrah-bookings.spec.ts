import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import { HajjUmrahBookingsApplicationService } from './application/hajj-umrah-bookings.application-service.js';
import type { BookingRepository } from './application/booking.repository.js';
import type { BookingAccess, BookingFinancePort } from './application/booking.ports.js';
import type { Booking, BookingHistory } from './domain/booking.js';

class Repo implements BookingRepository {
  rows=new Map<string,Booking>(); logs:BookingHistory[]=[];
  key(c:string,b:string,id:string){return `${c}:${b}:${id}`;}
  async create(v:Booking,h:BookingHistory){if([...this.rows.values()].some(x=>x.companyId===v.companyId&&x.branchId===v.branchId&&x.code===v.code))throw Error('duplicate code');this.rows.set(this.key(v.companyId,v.branchId,v.id),v);this.logs.push(h);return v;}
  async save(v:Booking,h:BookingHistory){this.rows.set(this.key(v.companyId,v.branchId,v.id),v);this.logs.push(h);return v;}
  async get(c:string,b:string,id:string){return this.rows.get(this.key(c,b,id))??null;}
  async list(c:string,b:string){return [...this.rows.values()].filter(x=>x.companyId===c&&x.branchId===b);}
  async history(c:string,b:string,id:string){return this.logs.filter(x=>x.companyId===c&&x.branchId===b&&x.bookingId===id);}
}
class Access implements BookingAccess{async requireBranch(c:ExecutionContext){if(c.companyId==='other'||c.branchId==='other')throw Error('branch denied');}async requirePermission(){}async audit(){}}
const program={id:'p1',companyId:'c1' as CompanyId,branchId:'b1',code:'P',type:'UMRAH' as const,seasonId:'s',arabicName:'عمرة',snapshot:{departureDate:'2027-01-10',returnDate:'2027-01-20',salesStart:'2026-01-01',salesClose:'2027-01-01',capacity:'10',currency:'SAR',prices:{},requirements:[],components:[]},temporaryHoldMinutes:15,status:'BOOKABLE' as const,bookingOpen:true,currentVersion:1,currentVersionId:'pv1',createdAt:'',updatedAt:''};
function fixture(){
  const repo=new Repo();let n=0;let confirmCalls=0,cancelCalls=0;let open=true;let cancelResult:unknown={cancelled:true};
  const finance:BookingFinancePort={async confirm(i){confirmCalls++;return{workflowId:'w1',allocations:i.inventories.map((_,x)=>({id:`alloc-${x+1}`,quantity:'1'}))};},async cancel(){cancelCalls++;return cancelResult;}};
  const service=new HajjUmrahBookingsApplicationService(repo,new Access(),{async require(){return{...program,bookingOpen:open};}},{async requireActive(_c,id){if(id==='bad')throw Error('traveler not found');return{id:id as never,companyId:'c1' as CompanyId,fullName:id,dateOfBirth:null,gender:null,nationality:null,partyId:null,customerId:'cust',status:'ACTIVE',createdAt:'',updatedAt:''};}},{async requireActive(){return{id:'cust' as never,companyId:'c1' as CompanyId,partyId:'party-c',number:'C',status:'ACTIVE',assignedAgentId:null,commercialNotes:null,createdAt:'',updatedAt:''};},async register(){}},{async requireActive(){return{id:'agent' as never,companyId:'c1' as CompanyId,partyId:'party-a',number:'A',status:'ACTIVE',notes:null,commission:{kind:'PERCENT' as const,value:'0',currency:null},createdAt:'',updatedAt:''};},async register(){}},finance,()=>new Date('2026-09-22T00:00:00Z'),()=>`id-${++n}`);
  return{repo,service,setOpen:(v:boolean)=>open=v,setCancel:(v:unknown)=>cancelResult=v,calls:()=>({confirmCalls,cancelCalls})};
}
const c=executionContext('c1','b1','u1');
const create={code:'B1',programId:'p1',customerId:'cust',travelerIds:['t1','t2']};
const confirm={commandKey:'confirm:B1',category:'OTHER' as const,costCenterId:'cc1',currency:'SAR',grossAmount:'1000',discountAmount:'0',postingDate:'2026-09-22',dueDate:'2027-01-01',invoiceNumber:'INV-B1',inventories:[{allocationId:'req-hotel',contractId:'hc',resourceType:'HOTEL',resourceId:'hotel-1',serviceDate:'2027-01-10',quantity:'2'},{allocationId:'req-flight',contractId:'fc',resourceType:'FLIGHT_BLOCK',resourceId:'flight-1',serviceDate:'2027-01-10',quantity:'2',flightSegmentReference:{sourceType:'SEGMENT',sourceId:'seg-1'}}]};

test('creates preliminary booking with canonical traveler validation and branch isolation',async()=>{const f=fixture();const b=await f.service.create(c,create);assert.equal(b.status,'PRELIMINARY');assert.equal(b.financialState,'UNCONFIRMED');assert.deepEqual(b.travelerIds,['t1','t2']);await assert.rejects(()=>f.service.get(executionContext('c1','other','u1'),b.id),/branch denied/);});
test('invalid traveler reference is rejected through owner boundary',async()=>{const f=fixture();await assert.rejects(()=>f.service.create(c,{...create,travelerIds:['bad']}),/traveler/);});
test('closed booking availability blocks confirmation before finance orchestration',async()=>{const f=fixture();const b=await f.service.create(c,create);f.setOpen(false);await assert.rejects(()=>f.service.confirm(c,b.id,confirm),/not open/);assert.equal(f.calls().confirmCalls,0);});
test('multi-allocation confirmation persists TFO allocation evidence and is idempotent',async()=>{const f=fixture();const b=await f.service.create(c,create);const first=await f.service.confirm(c,b.id,confirm);assert.deepEqual(first.allocationIds,['alloc-1','alloc-2']);const replay=await f.service.confirm(c,b.id,confirm);assert.equal(replay.id,b.id);assert.equal(f.calls().confirmCalls,1);await assert.rejects(()=>f.service.confirm(c,b.id,{...confirm,grossAmount:'999'}),/conflicting/);});
test('financial cancellation blocker never marks booking cancelled and history is retained',async()=>{const f=fixture();const b=await f.service.create(c,create);await f.service.confirm(c,b.id,confirm);f.setCancel({blockers:[{type:'CUSTOMER_SETTLEMENT_REQUIRED'}]});const blocked=await f.service.cancel(c,b.id,{commandKey:'cancel:B1',postingDate:'2026-09-22',reason:'طلب العميل'});assert.equal(blocked.status,'CONFIRMED');assert.equal(blocked.financialState,'CANCELLATION_BLOCKED');const history=await f.service.historyFor(c,b.id);assert.ok(history.some(x=>x.action==='CANCELLATION_BLOCKED'));});
test('clean cancellation and lifecycle transitions preserve history',async()=>{const f=fixture();const b=await f.service.create(c,{...create,code:'B2'});await f.service.confirm(c,b.id,{...confirm,commandKey:'confirm:B2',invoiceNumber:'INV-B2'});const ready=await f.service.markReady(c,b.id);assert.equal(ready.status,'READY');const traveling=await f.service.startTravel(c,b.id);assert.equal(traveling.status,'TRAVELING');const completed=await f.service.complete(c,b.id);assert.equal(completed.status,'COMPLETED');const h=await f.service.historyFor(c,b.id);assert.deepEqual(h.map(x=>x.toStatus).filter(Boolean),['PRELIMINARY','CONFIRMED','READY','TRAVELING','COMPLETED']);});
test('clean confirmed cancellation becomes cancelled only after finance owner confirms',async()=>{const f=fixture();const b=await f.service.create(c,{...create,code:'B3'});await f.service.confirm(c,b.id,{...confirm,commandKey:'confirm:B3',invoiceNumber:'INV-B3'});const cancelled=await f.service.cancel(c,b.id,{commandKey:'cancel:B3',postingDate:'2026-09-22',reason:'إلغاء'});assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.financialState,'CANCELLED');});
