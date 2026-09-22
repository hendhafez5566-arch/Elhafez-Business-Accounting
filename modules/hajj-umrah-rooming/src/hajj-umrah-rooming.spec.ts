import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractValidationError, executionContext, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import { HajjUmrahRoomingApplicationService } from './application/hajj-umrah-rooming.application-service.js';
import type { RoomingRepository } from './application/rooming.repository.js';
import type { RoomingAccess } from './application/rooming.ports.js';
import type { RoomAssignment, RoomingHistory } from './domain/rooming.js';

class MemoryRooming implements RoomingRepository {
  readonly rows=new Map<string,RoomAssignment>();
  readonly logs:RoomingHistory[]=[];
  private tail:Promise<void>=Promise.resolve();

  private async atomic<T>(work:()=>Promise<T>|T):Promise<T>{
    const previous=this.tail;
    let release!:()=>void;
    this.tail=new Promise<void>(resolve=>{release=resolve});
    await previous;
    try{return await work();}finally{release();}
  }
  private check(value:RoomAssignment,capacity:number,excludeId?:string){
    const overlap=[...this.rows.values()].find(row=>row.companyId===value.companyId&&row.branchId===value.branchId&&row.travelerId===value.travelerId&&row.status==='ASSIGNED'&&row.id!==excludeId&&row.startDate<=value.endDate&&row.endDate>=value.startDate);
    if(overlap)throw new ContractValidationError('travelerId','traveler already has an overlapping room assignment');
    const count=[...this.rows.values()].filter(row=>row.companyId===value.companyId&&row.branchId===value.branchId&&row.allocationId===value.allocationId&&row.status==='ASSIGNED'&&row.id!==excludeId&&row.startDate<=value.endDate&&row.endDate>=value.startDate).length;
    if(count>=capacity)throw new ContractValidationError('capacity','hotel allocation capacity exceeded');
  }
  async createGuarded(value:RoomAssignment,history:RoomingHistory,capacity:number){return this.atomic(()=>{this.check(value,capacity);this.rows.set(value.id,value);this.logs.push(history);return value;});}
  async saveGuarded(value:RoomAssignment,history:RoomingHistory,capacity:number){return this.atomic(()=>{const current=this.rows.get(value.id);if(!current||current.status!=='ASSIGNED')throw new ContractValidationError('status','only active assignment can be moved');this.check(value,capacity,value.id);this.rows.set(value.id,value);this.logs.push(history);return value;});}
  async save(value:RoomAssignment,history:RoomingHistory){return this.atomic(()=>{this.rows.set(value.id,value);this.logs.push(history);return value;});}
  async swap(a:RoomAssignment,ha:RoomingHistory,capacityA:number,b:RoomAssignment,hb:RoomingHistory,capacityB:number){return this.atomic(()=>{const excluded=new Set([a.id,b.id]);const count=(value:RoomAssignment)=>[...this.rows.values()].filter(row=>!excluded.has(row.id)&&row.status==='ASSIGNED'&&row.allocationId===value.allocationId&&row.startDate<=value.endDate&&row.endDate>=value.startDate).length;if(a.allocationId===b.allocationId){const overlap=a.startDate<=b.endDate&&b.startDate<=a.endDate;const extra=overlap?2:1;if(count(a)+extra>capacityA||count(b)+extra>capacityB)throw new ContractValidationError('capacity','hotel allocation capacity exceeded');}else if(count(a)+1>capacityA||count(b)+1>capacityB)throw new ContractValidationError('capacity','hotel allocation capacity exceeded');this.rows.set(a.id,a);this.rows.set(b.id,b);this.logs.push(ha,hb);});}
  async get(companyId:string,branchId:string,id:string){const value=this.rows.get(id);return value?.companyId===companyId&&value.branchId===branchId?value:null;}
  async list(companyId:string,branchId:string,programId?:string){return[...this.rows.values()].filter(value=>value.companyId===companyId&&value.branchId===branchId&&(!programId||value.programId===programId));}
  async history(companyId:string,branchId:string,id:string){return this.logs.filter(value=>value.companyId===companyId&&value.branchId===branchId&&value.assignmentId===id);}
}
class Access implements RoomingAccess {
  async requireBranch(context:ExecutionContext){if(context.companyId!=='c1'||context.branchId!=='b1')throw new Error('branch denied');}
  async requirePermission(){}
  async audit(){}
}
const context=executionContext('c1','b1','u1');

function fixture(quantity='2'){
  const repo=new MemoryRooming();
  let sequence=0;
  const allocations={
    h1:{id:'h1',companyId:'c1' as CompanyId,contractId:'hc',contractVersionId:'v',resourceType:'HOTEL' as const,resourceId:'hotel-1',program:{sourceType:'HAJJ_UMRAH_PROGRAM',sourceId:'p1'},serviceDate:'2027-01-01T00:00:00.000Z',periodEnd:'2027-01-20T00:00:00.000Z',quantity:quantity as never,status:'CONFIRMED' as const,createdAt:''},
    h2:{id:'h2',companyId:'c1' as CompanyId,contractId:'hc',contractVersionId:'v',resourceType:'HOTEL' as const,resourceId:'hotel-2',program:{sourceType:'HAJJ_UMRAH_PROGRAM',sourceId:'p1'},serviceDate:'2027-01-12T00:00:00.000Z',periodEnd:'2027-01-20T00:00:00.000Z',quantity:quantity as never,status:'CONFIRMED' as const,createdAt:''},
  };
  const service=new HajjUmrahRoomingApplicationService(
    repo,new Access(),
    {async requireTraveler(_context,bookingId,travelerId){return{id:bookingId,companyId:'c1' as CompanyId,branchId:'b1',code:'B',programId:'p1',customerId:'c',customerPartyId:'party',travelerIds:[travelerId],status:'CONFIRMED',financialState:'CONFIRMED',allocationIds:['h1','h2'],createdAt:'',updatedAt:''}}},
    {async require(){return{id:'p1',companyId:'c1' as CompanyId,branchId:'b1',code:'P',type:'UMRAH',seasonId:'s',arabicName:'P',snapshot:{departureDate:'2027-01-01',returnDate:'2027-01-20',salesStart:'',salesClose:'',capacity:'2',currency:'SAR',prices:{},requirements:[],components:[]},temporaryHoldMinutes:15,status:'BOOKABLE',bookingOpen:true,currentVersion:1,currentVersionId:'v',createdAt:'',updatedAt:''}}},
    {async requireActive(_context,id){return{id:id as never,companyId:'c1' as CompanyId,fullName:id,dateOfBirth:null,gender:null,nationality:null,partyId:null,customerId:null,status:'ACTIVE',createdAt:'',updatedAt:''}}},
    {async allocation(_companyId,id){return allocations[id as keyof typeof allocations]??null}},
    ()=>new Date('2026-09-22T00:00:00Z'),()=>`id-${++sequence}`,
  );
  return{repo,service};
}
const base={bookingId:'b1',travelerId:'t1',allocationId:'h1',roomKey:'R1',startDate:'2027-01-02',endDate:'2027-01-10'};

test('valid assignment is persisted from canonical hotel evidence',async()=>{const value=fixture();const assigned=await value.service.assign(context,base);assert.equal(assigned.status,'ASSIGNED');assert.equal((await value.service.list(context)).length,1);});

test('atomic rooming guard rejects overlapping assignments for one traveler',async()=>{const value=fixture();const results=await Promise.allSettled([
  value.service.assign(context,{...base,roomKey:'R1'}),
  value.service.assign(context,{...base,roomKey:'R2'}),
]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);});

test('atomic rooming guard cannot exceed allocation capacity under concurrency',async()=>{const value=fixture('1');const results=await Promise.allSettled([
  value.service.assign(context,{...base,bookingId:'b1',travelerId:'t1',roomKey:'R1'}),
  value.service.assign(context,{...base,bookingId:'b2',travelerId:'t2',roomKey:'R2'}),
]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const rejected=results.find(result=>result.status==='rejected');assert.match(String(rejected&&rejected.status==='rejected'?rejected.reason:''),/capacity/);});

test('reassignment and unassignment retain history atomically with state',async()=>{const value=fixture();const assigned=await value.service.assign(context,base);await value.service.reassign(context,assigned.id,{allocationId:'h1',roomKey:'R2',startDate:'2027-01-03',endDate:'2027-01-09'});await value.service.unassign(context,assigned.id);assert.deepEqual((await value.service.historyFor(context,assigned.id)).map(row=>row.action),['ASSIGNED','REASSIGNED','UNASSIGNED']);});

test('swap rejects a target hotel allocation that does not cover the traveler stay',async()=>{const value=fixture();const left=await value.service.assign(context,base);const right=await value.service.assign(context,{bookingId:'b2',travelerId:'t2',allocationId:'h2',roomKey:'R2',startDate:'2027-01-12',endDate:'2027-01-15'});await assert.rejects(()=>value.service.swap(context,left.id,right.id),/outside hotel allocation evidence window/);});

test('company and branch isolation are mandatory',async()=>{const value=fixture();const assigned=await value.service.assign(context,base);await assert.rejects(()=>value.service.historyFor(executionContext('c1','other','u1'),assigned.id),/branch denied/);});
