import assert from'node:assert/strict';
import test from'node:test';
import{executionContext,type ExecutionContext}from'@elhafez/contracts';
import type{SupplierDisputesAccess}from'./application/supplier-disputes.access.js';
import{SupplierDisputesApplicationService}from'./application/supplier-disputes.application-service.js';
import{InMemorySupplierDisputesRepository}from'./infrastructure/in-memory-supplier-disputes.repository.js';
import{SupplierDisputesController}from'./infrastructure/supplier-disputes.controller.js';

class Access implements SupplierDisputesAccess{
 deny='';failAudit='';readonly audits=new Set<string>();
 async requireBranch(_c:ExecutionContext){}
 async requirePermission(_c:ExecutionContext,p:string){if(p===this.deny)throw new Error('permission denied');}
 async auditOnce(_c:ExecutionContext,key:string){if(this.failAudit===key){this.failAudit='';throw new Error('audit outage');}this.audits.add(key);}
}
class Suppliers{
 readonly holds=new Map<string,boolean>();ensureCalls=0;
 async supplierViewForIntegration(_c:ExecutionContext,id:string){return{supplier:{partyId:id}};}
 async ensureHoldForIntegration(_c:ExecutionContext,_supplier:string,_type:string,id:string){this.ensureCalls++;if(!this.holds.has(id))this.holds.set(id,true);return{};}
 async releaseHoldForIntegration(_c:ExecutionContext,_supplier:string,_type:string,id:string){if(!this.holds.get(id))throw new Error('hold missing');this.holds.set(id,false);return{};}
}
const context=executionContext('company-a','branch-a','actor-a');
function setup(){let id=0;const repo=new InMemorySupplierDisputesRepository(),suppliers=new Suppliers(),access=new Access(),service=new SupplierDisputesApplicationService(repo,suppliers as never,access,()=>new Date('2026-09-21T12:00:00Z'),()=>('dispute-'+(++id)));return{repo,suppliers,access,service};}

test('all four dispute severities validate and only CRITICAL auto-holds',async()=>{
 const s=setup();
 for(const severity of ['LOW','MEDIUM','HIGH'])await s.service.open(context,'party-a',{requestId:severity,severity,title:'Title',description:'Description'});
 assert.equal(s.suppliers.holds.size,0);
 const critical=await s.service.open(context,'party-a',{requestId:'critical',severity:'CRITICAL',title:'Critical',description:'Description'});
 assert.equal(s.suppliers.holds.get(critical.id),true);
 await assert.rejects(()=>s.service.open(context,'party-a',{requestId:'invalid',severity:'INVALID',title:'x',description:'y'}),/severity/);
 await assert.rejects(()=>s.service.open(context,'party-a',{requestId:'empty-title',severity:'LOW',title:' ',description:'y'}),/title/);
 await assert.rejects(()=>s.service.open(context,'party-a',{requestId:'empty-description',severity:'LOW',title:'x',description:' '}),/description/);
});

test('dispute create replay converges and conflicting replay rejects',async()=>{
 const s=setup(),input={requestId:'r1',severity:'CRITICAL',title:'Critical',description:'Description'} as const;
 const first=await s.service.open(context,'party-a',input),replay=await s.service.open(context,'party-a',input);
 assert.equal(first.id,replay.id);assert.equal(s.suppliers.holds.size,1);
 await assert.rejects(()=>s.service.open(context,'party-a',{...input,severity:'HIGH'}),/conflicting/);
});

test('terminal lifecycle is append-only and critical terminal transitions never auto-release',async()=>{
 const s=setup(),d=await s.service.open(context,'party-a',{requestId:'critical',severity:'CRITICAL',title:'Critical',description:'Description'});
 await assert.rejects(()=>s.service.releaseHold(context,'party-a',d.id,'release'),/resolved or cancelled/);
 await assert.rejects(()=>s.service.resolve(context,'party-a',d.id,' '),/resolution/);
 const resolved=await s.service.resolve(context,'party-a',d.id,'completed');
 assert.equal(resolved.status,'RESOLVED');assert.equal(resolved.history.length,2);assert.equal(s.suppliers.holds.get(d.id),true);
 await assert.rejects(()=>s.service.cancel(context,'party-a',d.id,'cancel'),/terminal/);
 s.access.deny='supplier.dispute.release_hold';await assert.rejects(()=>s.service.releaseHold(context,'party-a',d.id,'approved'),/permission/);
 s.access.deny='';await assert.rejects(()=>s.service.releaseHold(context,'party-a',d.id,' '),/releaseReason/);
 await s.service.releaseHold(context,'party-a',d.id,'approved');assert.equal(s.suppliers.holds.get(d.id),false);
 const cancelled=await s.service.open(context,'party-a',{requestId:'cancel',severity:'CRITICAL',title:'Other',description:'Description'});
 await assert.rejects(()=>s.service.cancel(context,'party-a',cancelled.id,' '),/cancellationReason/);
 const done=await s.service.cancel(context,'party-a',cancelled.id,'not valid');assert.equal(done.status,'CANCELLED');assert.equal(s.suppliers.holds.get(cancelled.id),true);
});

test('audit retry does not duplicate critical dispute or hold',async()=>{
 const s=setup();s.access.failAudit='supplier.dispute.hold-applied:dispute-1';
 const input={requestId:'retry',severity:'CRITICAL',title:'Critical',description:'Description'} as const;
 await assert.rejects(()=>s.service.open(context,'party-a',input),/audit outage/);
 const replay=await s.service.open(context,'party-a',input);
 assert.equal(replay.id,'dispute-1');assert.equal(s.suppliers.holds.size,1);
});

test('disputes isolate company branch and supplier',async()=>{
 const s=setup();await s.service.open(context,'party-a',{requestId:'r1',severity:'LOW',title:'T',description:'D'});
 assert.equal((await s.repo.list('company-a' as never,'branch-b','party-a')).length,0);
 assert.equal((await s.repo.list('company-b' as never,'branch-a','party-a')).length,0);
 assert.equal((await s.repo.list('company-a' as never,'branch-a','party-b')).length,0);
});

test('dispute controller resolves Bearer session through currentUser',async()=>{
 let token='',captured:ExecutionContext|undefined;
 const platform={currentUser:async(value:string)=>{token=value;return{id:'authenticated-user'};}};
 const service={list:async(value:ExecutionContext)=>{captured=value;return[];}};
 const controller=new SupplierDisputesController(service as never,platform as never);
 await controller.list('Bearer real-session','company-a','branch-a','party-a');
 assert.equal(token,'real-session');assert.equal(captured?.actorId,'authenticated-user');assert.notEqual(captured?.actorId,'real-session');
});
