import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractValidationError, executionContext, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import { HajjUmrahTransportOperationsApplicationService } from './application/hajj-umrah-transport-operations.application-service.js';
import type { TransportRepository } from './application/transport.repository.js';
import type { TransportAccess } from './application/transport.ports.js';
import type { ManifestAssignment, TransportHistory, TransportRun } from './domain/transport.js';

class MemoryTransport implements TransportRepository {
  readonly runs=new Map<string,TransportRun>();
  readonly assignments=new Map<string,ManifestAssignment>();
  readonly logs:TransportHistory[]=[];
  private tail:Promise<void>=Promise.resolve();

  private async atomic<T>(work:()=>Promise<T>|T):Promise<T>{
    const previous=this.tail;
    let release!:()=>void;
    this.tail=new Promise<void>(resolve=>{release=resolve});
    await previous;
    try{return await work();}finally{release();}
  }
  async createRun(value:TransportRun,history:TransportHistory){this.runs.set(value.id,value);this.logs.push(history);return value;}
  async saveRun(value:TransportRun,history:TransportHistory){return this.atomic(()=>{this.runs.set(value.id,value);this.logs.push(history);return value;});}
  async getRun(companyId:string,branchId:string,id:string){const value=this.runs.get(id);return value?.companyId===companyId&&value.branchId===branchId?value:null;}
  async listRuns(companyId:string,branchId:string,programId?:string){return[...this.runs.values()].filter(value=>value.companyId===companyId&&value.branchId===branchId&&(!programId||value.programId===programId));}
  async assignGuarded(value:ManifestAssignment,history:TransportHistory,run:TransportRun,capacity:number){
    return this.atomic(()=>{
      const currentRun=this.runs.get(run.id);
      if(!currentRun||currentRun.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');
      const existing=[...this.assignments.values()].find(row=>row.companyId===value.companyId&&row.branchId===value.branchId&&row.runId===value.runId&&row.travelerId===value.travelerId);
      if(existing&&existing.bookingId!==value.bookingId)throw new ContractValidationError('bookingId','retained manifest identity belongs to another booking');
      if(existing?.status==='ASSIGNED')return existing;
      const conflict=[...this.assignments.values()].find(row=>{
        if(row.companyId!==value.companyId||row.branchId!==value.branchId||row.travelerId!==value.travelerId||row.status!=='ASSIGNED'||row.runId===run.id)return false;
        const other=this.runs.get(row.runId);
        return Boolean(other&&['SCHEDULED','DISPATCHED'].includes(other.status)&&other.startsAt<run.endsAt&&other.endsAt>run.startsAt);
      });
      if(conflict)throw new ContractValidationError('travelerId','traveler already has a conflicting transport run');
      const used=[...this.assignments.values()].filter(row=>{
        if(row.companyId!==value.companyId||row.branchId!==value.branchId||row.status!=='ASSIGNED')return false;
        const other=this.runs.get(row.runId);
        return Boolean(other&&other.allocationId===run.allocationId&&['SCHEDULED','DISPATCHED'].includes(other.status)&&other.startsAt<run.endsAt&&other.endsAt>run.startsAt);
      }).length;
      if(used>=capacity)throw new ContractValidationError('capacity','transport allocation capacity exceeded across overlapping runs');
      if(existing){
        const reactivated={...existing,status:'ASSIGNED' as const,updatedAt:value.updatedAt};
        this.assignments.set(existing.id,reactivated);
        this.logs.push({...history,aggregateId:existing.id,action:'REACTIVATED'});
        return reactivated;
      }
      this.assignments.set(value.id,value);this.logs.push(history);return value;
    });
  }
  async saveAssignment(value:ManifestAssignment,history:TransportHistory){return this.atomic(()=>{this.assignments.set(value.id,value);this.logs.push(history);return value;});}
  async manifest(companyId:string,branchId:string,runId:string){return[...this.assignments.values()].filter(value=>value.companyId===companyId&&value.branchId===branchId&&value.runId===runId);}
  async activeManifestCount(companyId:string,branchId:string,runId:string){return(await this.manifest(companyId,branchId,runId)).filter(value=>value.status==='ASSIGNED').length;}
  async history(companyId:string,branchId:string,type:'RUN'|'MANIFEST',id:string){return this.logs.filter(value=>value.companyId===companyId&&value.branchId===branchId&&value.aggregateType===type&&value.aggregateId===id);}
}
class Access implements TransportAccess{
  async requireBranch(context:ExecutionContext){if(context.branchId!=='b1')throw new Error('branch denied');}
  async requirePermission(){}
  async audit(){}
}
const context=executionContext('c1','b1','u1');

function fixture(quantity='2'){
  const repo=new MemoryTransport();
  let sequence=0;
  const service=new HajjUmrahTransportOperationsApplicationService(
    repo,new Access(),
    {async requireTraveler(_context,bookingId,travelerId){return{id:bookingId,companyId:'c1' as CompanyId,branchId:'b1',code:'B',programId:'p1',customerId:'c',customerPartyId:'p',travelerIds:[travelerId],status:'CONFIRMED',financialState:'CONFIRMED',allocationIds:['a1'],createdAt:'',updatedAt:''}}},
    {async requireActive(_context,id){return{id:id as never,companyId:'c1' as CompanyId,fullName:'T',dateOfBirth:null,gender:null,nationality:null,partyId:null,customerId:null,status:'ACTIVE',createdAt:'',updatedAt:''}}},
    {async allocation(){return{id:'a1',companyId:'c1' as CompanyId,contractId:'tc',contractVersionId:'tv',resourceType:'TRANSPORT',resourceId:'bus-cap',program:{sourceType:'HAJJ_UMRAH_PROGRAM',sourceId:'p1'},serviceDate:'2027-01-01T00:00:00.000Z',periodEnd:'2027-01-02T00:00:00.000Z',quantity:quantity as never,status:'CONFIRMED',createdAt:''}}},
    ()=>new Date('2026-09-22T00:00:00Z'),()=>`id-${++sequence}`,
  );
  return{repo,service};
}
const firstRun={programId:'p1',allocationId:'a1',code:'RUN-1',route:'Makkah → Madinah',startsAt:'2027-01-01T10:00:00Z',endsAt:'2027-01-01T15:00:00Z'};
const secondRun={...firstRun,code:'RUN-2',startsAt:'2027-01-01T11:00:00Z',endsAt:'2027-01-01T14:00:00Z'};

test('run creation validates canonical transport capacity evidence',async()=>{const value=fixture();const run=await value.service.createRun(context,firstRun);assert.equal(run.status,'SCHEDULED');});

test('overlapping runs share the same canonical allocation capacity',async()=>{const value=fixture('1');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);await value.service.assignTraveler(context,a.id,'b1','t1');await assert.rejects(()=>value.service.assignTraveler(context,b.id,'b2','t2'),/capacity exceeded across overlapping runs/);});

test('concurrent manifest writes cannot over-consume shared allocation capacity',async()=>{const value=fixture('1');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);const results=await Promise.allSettled([
  value.service.assignTraveler(context,a.id,'b1','t1'),
  value.service.assignTraveler(context,b.id,'b2','t2'),
]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);});

test('traveler conflict is enforced across overlapping active runs',async()=>{const value=fixture('2');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);await value.service.assignTraveler(context,a.id,'b1','t1');await assert.rejects(()=>value.service.assignTraveler(context,b.id,'b1','t1'),/conflicting transport run/);});

test('removed traveler can be re-added by reactivating retained assignment and history',async()=>{const value=fixture('2');const run=await value.service.createRun(context,firstRun);const first=await value.service.assignTraveler(context,run.id,'b1','t1');await value.service.removeTraveler(context,first.id,run.id);const reactivated=await value.service.assignTraveler(context,run.id,'b1','t1');assert.equal(reactivated.id,first.id);assert.equal(reactivated.status,'ASSIGNED');assert.deepEqual((await value.service.historyFor(context,'MANIFEST',first.id)).map(row=>row.action),['ASSIGNED','REMOVED','REACTIVATED']);});

test('removed manifest identity cannot be reused under another booking',async()=>{const value=fixture('2');const run=await value.service.createRun(context,firstRun);const first=await value.service.assignTraveler(context,run.id,'b1','t1');await value.service.removeTraveler(context,first.id,run.id);await assert.rejects(()=>value.service.assignTraveler(context,run.id,'b2','t1'),/retained manifest identity belongs to another booking/);});

test('dispatch and completion retain run history',async()=>{const value=fixture();const run=await value.service.createRun(context,firstRun);await value.service.assignTraveler(context,run.id,'b1','t1');await value.service.dispatch(context,run.id);const done=await value.service.complete(context,run.id);assert.equal(done.status,'COMPLETED');assert.deepEqual((await value.service.historyFor(context,'RUN',run.id)).map(value=>value.action),['CREATED','DISPATCHED','COMPLETED']);});
