import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractValidationError, executionContext, type CompanyId, type ExecutionContext } from '@elhafez/contracts';
import { HajjUmrahTransportOperationsApplicationService } from './application/hajj-umrah-transport-operations.application-service.js';
import type { TransportRepository } from './application/transport.repository.js';
import type { TransportAccess } from './application/transport.ports.js';
import type { ManifestAssignment, TransportHistory, TransportRun, TransportRunStatus } from './domain/transport.js';

class MemoryTransport implements TransportRepository {
  readonly runs=new Map<string,TransportRun>();
  readonly assignments=new Map<string,ManifestAssignment>();
  readonly logs:TransportHistory[]=[];
  private tail:Promise<void>=Promise.resolve();
  private pausedRunAction:string|null=null;
  private runEnteredResolve:(()=>void)|null=null;
  private runReleasePromise:Promise<void>|null=null;
  private runReleaseResolve:(()=>void)|null=null;
  private pauseAssignment=false;
  private assignmentEnteredResolve:(()=>void)|null=null;
  private assignmentReleasePromise:Promise<void>|null=null;
  private assignmentReleaseResolve:(()=>void)|null=null;

  pauseNextRunAction(action:string){
    this.pausedRunAction=action;
    const entered=new Promise<void>(resolve=>{this.runEnteredResolve=resolve;});
    this.runReleasePromise=new Promise<void>(resolve=>{this.runReleaseResolve=resolve;});
    return{entered,release:()=>this.runReleaseResolve?.()};
  }
  pauseNextAssignmentSave(){
    this.pauseAssignment=true;
    const entered=new Promise<void>(resolve=>{this.assignmentEnteredResolve=resolve;});
    this.assignmentReleasePromise=new Promise<void>(resolve=>{this.assignmentReleaseResolve=resolve;});
    return{entered,release:()=>this.assignmentReleaseResolve?.()};
  }
  private async maybePauseRun(action:string){
    if(this.pausedRunAction!==action)return;
    this.pausedRunAction=null;this.runEnteredResolve?.();await this.runReleasePromise;
    this.runEnteredResolve=null;this.runReleasePromise=null;this.runReleaseResolve=null;
  }
  private async maybePauseAssignment(){
    if(!this.pauseAssignment)return;
    this.pauseAssignment=false;this.assignmentEnteredResolve?.();await this.assignmentReleasePromise;
    this.assignmentEnteredResolve=null;this.assignmentReleasePromise=null;this.assignmentReleaseResolve=null;
  }
  private async atomic<T>(work:()=>Promise<T>|T):Promise<T>{
    const previous=this.tail;
    let release!:()=>void;
    this.tail=new Promise<void>(resolve=>{release=resolve});
    await previous;
    try{return await work();}finally{release();}
  }
  private stale(kind:'run'|'manifest',expected:number,actual:number){
    if(actual!==expected)throw new ContractValidationError('revision',`${kind} changed; reload and retry`);
  }

  async createRun(value:TransportRun,history:TransportHistory){this.runs.set(value.id,value);this.logs.push(history);return value;}
  async saveRun(value:TransportRun,history:TransportHistory,expectedRevision:number,expectedStatus:TransportRunStatus){
    await this.maybePauseRun(history.action);
    return this.atomic(()=>{
      const current=this.runs.get(value.id);
      if(!current)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',expectedRevision,current.revision);
      if(current.status!==expectedStatus)throw new ContractValidationError('status','transport run changed; reload and retry');
      this.runs.set(value.id,value);this.logs.push(history);return value;
    });
  }
  async getRun(companyId:string,branchId:string,id:string){const value=this.runs.get(id);return value?.companyId===companyId&&value.branchId===branchId?value:null;}
  async listRuns(companyId:string,branchId:string,programId?:string){return[...this.runs.values()].filter(value=>value.companyId===companyId&&value.branchId===branchId&&(!programId||value.programId===programId));}
  async assignGuarded(value:ManifestAssignment,history:TransportHistory,run:TransportRun,capacity:number){
    return this.atomic(()=>{
      const currentRun=this.runs.get(run.id);
      if(!currentRun)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',run.revision,currentRun.revision);
      if(currentRun.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');
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
        const reactivated={...existing,status:'ASSIGNED' as const,revision:existing.revision+1,updatedAt:value.updatedAt};
        this.assignments.set(existing.id,reactivated);
        this.logs.push({...history,aggregateId:existing.id,action:'REACTIVATED'});
        return reactivated;
      }
      this.assignments.set(value.id,value);this.logs.push(history);return value;
    });
  }
  async saveAssignment(value:ManifestAssignment,history:TransportHistory,expectedRevision:number,expectedRunRevision:number){
    await this.maybePauseAssignment();
    return this.atomic(()=>{
      const run=this.runs.get(value.runId);
      if(!run)throw new ContractValidationError('runId','transport run not found');
      this.stale('run',expectedRunRevision,run.revision);
      if(run.status!=='SCHEDULED')throw new ContractValidationError('status','manifest can only change before dispatch');
      const current=this.assignments.get(value.id);
      if(!current)throw new ContractValidationError('assignmentId','manifest assignment not found');
      this.stale('manifest',expectedRevision,current.revision);
      if(current.status!=='ASSIGNED')throw new ContractValidationError('status','manifest assignment is no longer active');
      this.assignments.set(value.id,value);this.logs.push(history);return value;
    });
  }
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

test('run creation validates canonical transport capacity evidence',async()=>{const value=fixture();const run=await value.service.createRun(context,firstRun);assert.equal(run.status,'SCHEDULED');assert.equal(run.revision,1);});

test('overlapping runs share the same canonical allocation capacity',async()=>{const value=fixture('1');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);await value.service.assignTraveler(context,a.id,'b1','t1');await assert.rejects(()=>value.service.assignTraveler(context,b.id,'b2','t2'),/capacity exceeded across overlapping runs/);});

test('concurrent manifest writes cannot over-consume shared allocation capacity',async()=>{const value=fixture('1');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);const results=await Promise.allSettled([
  value.service.assignTraveler(context,a.id,'b1','t1'),
  value.service.assignTraveler(context,b.id,'b2','t2'),
]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);});

test('traveler conflict is enforced across overlapping active runs',async()=>{const value=fixture('2');const a=await value.service.createRun(context,firstRun);const b=await value.service.createRun(context,secondRun);await value.service.assignTraveler(context,a.id,'b1','t1');await assert.rejects(()=>value.service.assignTraveler(context,b.id,'b1','t1'),/conflicting transport run/);});

test('removed traveler can be re-added by reactivating retained assignment and history',async()=>{const value=fixture('2');const run=await value.service.createRun(context,firstRun);const first=await value.service.assignTraveler(context,run.id,'b1','t1');assert.equal(first.revision,1);const removed=await value.service.removeTraveler(context,first.id,run.id);assert.equal(removed.revision,2);const reactivated=await value.service.assignTraveler(context,run.id,'b1','t1');assert.equal(reactivated.id,first.id);assert.equal(reactivated.status,'ASSIGNED');assert.equal(reactivated.revision,3);assert.deepEqual((await value.service.historyFor(context,'MANIFEST',first.id)).map(row=>row.action),['ASSIGNED','REMOVED','REACTIVATED']);});

test('removed manifest identity cannot be reused under another booking',async()=>{const value=fixture('2');const run=await value.service.createRun(context,firstRun);const first=await value.service.assignTraveler(context,run.id,'b1','t1');await value.service.removeTraveler(context,first.id,run.id);await assert.rejects(()=>value.service.assignTraveler(context,run.id,'b2','t1'),/retained manifest identity belongs to another booking/);});

test('dispatch and completion advance revisions and retain run history',async()=>{const value=fixture();const run=await value.service.createRun(context,firstRun);await value.service.assignTraveler(context,run.id,'b1','t1');const dispatched=await value.service.dispatch(context,run.id);assert.equal(dispatched.revision,2);const done=await value.service.complete(context,run.id);assert.equal(done.status,'COMPLETED');assert.equal(done.revision,3);assert.deepEqual((await value.service.historyFor(context,'RUN',run.id)).map(value=>value.action),['CREATED','DISPATCHED','COMPLETED']);});

test('stale cancel cannot overwrite a dispatch that wins the race',async()=>{
  const value=fixture();
  const run=await value.service.createRun(context,firstRun);
  const gate=value.repo.pauseNextRunAction('CANCELLED');
  const staleCancel=value.service.cancel(context,run.id,'operator cancellation');
  await gate.entered;
  const dispatched=await value.service.dispatch(context,run.id);
  assert.equal(dispatched.status,'DISPATCHED');
  assert.equal(dispatched.revision,2);
  gate.release();
  await assert.rejects(()=>staleCancel,/changed; reload and retry/);
  const persisted=await value.repo.getRun('c1','b1',run.id);
  assert.equal(persisted?.status,'DISPATCHED');
  assert.equal(persisted?.revision,2);
  assert.deepEqual((await value.service.historyFor(context,'RUN',run.id)).map(row=>row.action),['CREATED','DISPATCHED']);
});

test('manifest removal cannot commit after dispatch wins the race',async()=>{
  const value=fixture();
  const run=await value.service.createRun(context,firstRun);
  const assignment=await value.service.assignTraveler(context,run.id,'b1','t1');
  const gate=value.repo.pauseNextAssignmentSave();
  const staleRemoval=value.service.removeTraveler(context,assignment.id,run.id);
  await gate.entered;
  const dispatched=await value.service.dispatch(context,run.id);
  assert.equal(dispatched.status,'DISPATCHED');
  gate.release();
  await assert.rejects(()=>staleRemoval,/changed; reload and retry|before dispatch/);
  const manifest=await value.service.manifest(context,run.id);
  assert.equal(manifest[0]?.status,'ASSIGNED');
  assert.equal(manifest[0]?.revision,1);
  assert.deepEqual((await value.service.historyFor(context,'MANIFEST',assignment.id)).map(row=>row.action),['ASSIGNED']);
});
