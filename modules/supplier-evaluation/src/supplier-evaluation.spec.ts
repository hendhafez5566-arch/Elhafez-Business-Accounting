import assert from'node:assert/strict';
import test from'node:test';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import type{SupplierEvaluationAccess}from'./application/supplier-evaluation.access.js';
import{SupplierEvaluationApplicationService}from'./application/supplier-evaluation.application-service.js';
import{InMemorySupplierEvaluationRepository}from'./infrastructure/in-memory-supplier-evaluation.repository.js';
import{SupplierEvaluationController}from'./infrastructure/supplier-evaluation.controller.js';

class Access implements SupplierEvaluationAccess{
 readonly permissions:string[]=[];readonly audits=new Set<string>();deny='';
 async requireBranch(){}
 async requirePermission(_c:ExecutionContext,p:string){if(p===this.deny)throw new Error('permission denied');this.permissions.push(p);}
 async auditOnce(_c:ExecutionContext,key:string){this.audits.add(key);}
}
const supplierPort={supplierViewForIntegration:async(_c:ExecutionContext,id:string)=>({supplier:{partyId:id}})};
const context=executionContext('company-a','branch-a','actor-a');
function setup(){let id=0;const repo=new InMemorySupplierEvaluationRepository(),access=new Access(),service=new SupplierEvaluationApplicationService(repo,supplierPort as never,access,()=>new Date('2026-09-21T12:00:00Z'),()=>('evaluation-'+(++id)));return{repo,access,service};}

test('evaluation enforces integer 1..5 scores',async()=>{
 const s=setup();
 for(const value of [0,6,1.5])await assert.rejects(()=>s.service.create(context,'party-a',{requestId:'bad-'+value,qualityScore:value,serviceScore:5}),/integer from 1 to 5/);
 const ok=await s.service.create(context,'party-a',{requestId:'ok',qualityScore:1,serviceScore:5});
 assert.equal(ok.qualityScore,1);assert.equal(ok.serviceScore,5);
});

test('evaluation is append-only, idempotent, deterministic and concurrency-safe',async()=>{
 const s=setup();
 const first=await s.service.create(context,'party-a',{requestId:'r1',qualityScore:5,serviceScore:4,notes:'first'});
 const replay=await s.service.create(context,'party-a',{requestId:'r1',qualityScore:5,serviceScore:4,notes:'first'});
 assert.equal(replay.id,first.id);
 await assert.rejects(()=>s.service.create(context,'party-a',{requestId:'r1',qualityScore:4,serviceScore:4,notes:'first'}),/conflicting/);
 const concurrent=await Promise.all(Array.from({length:8},(_,i)=>s.service.create(context,'party-a',{requestId:'c-'+i,qualityScore:5,serviceScore:5})));
 assert.equal(new Set(concurrent.map(item=>item.version)).size,8);
 const history=await s.service.listForIntegration(context,'party-a');
 assert.equal(history.length,9);
 assert.equal(history[0]?.version,9);
 assert.equal((await s.service.latestForIntegration(context,'party-a'))?.version,9);
});

test('evaluation repository isolates company branch and supplier',async()=>{
 const s=setup();await s.service.create(context,'party-a',{requestId:'one',qualityScore:5,serviceScore:5});
 assert.equal((await s.repo.list('company-a' as never,'branch-b','party-a')).length,0);
 assert.equal((await s.repo.list('company-b' as never,'branch-a','party-a')).length,0);
 assert.equal((await s.repo.list('company-a' as never,'branch-a','party-b')).length,0);
});

test('evaluation permission failure prevents mutation',async()=>{
 const s=setup();s.access.deny='supplier.evaluation.manage';
 await assert.rejects(()=>s.service.create(context,'party-a',{requestId:'denied',qualityScore:5,serviceScore:5}),/permission denied/);
 assert.equal((await s.repo.list('company-a' as never,'branch-a','party-a')).length,0);
});

test('evaluation controller has runtime route metadata and resolves Bearer session through currentUser',async()=>{
 const metadata=(Reflect as unknown as {getMetadata:(key:string,target:unknown)=>unknown}).getMetadata;
 assert.equal(metadata('path',SupplierEvaluationController),'supplier-intelligence/:supplierPartyId/evaluations');
 let token='',captured:ExecutionContext|undefined;
 const platform={currentUser:async(value:string)=>{token=value;return{id:'authenticated-user'};}};
 const service={list:async(value:ExecutionContext)=>{captured=value;return[];}};
 const controller=new SupplierEvaluationController(service as never,platform as never);
 await controller.list('Bearer session-token','company-a','branch-a','party-a');
 assert.equal(token,'session-token');assert.equal(captured?.actorId,'authenticated-user');assert.notEqual(captured?.actorId,'session-token');
 await assert.rejects(()=>controller.create(undefined,'company-a','branch-a','party-a',{requestId:'x',qualityScore:5,serviceScore:5}),/authenticated company and branch context required/);
});
