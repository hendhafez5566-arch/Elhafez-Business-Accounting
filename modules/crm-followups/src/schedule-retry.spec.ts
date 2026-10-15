import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { leadId, type Lead } from '@elhafez/crm-leads';
import { CrmFollowupsApplicationService } from './application/crm-followups.application-service.js';
import type { CrmFollowupsAccess } from './application/crm-followups-access.js';
import { InMemoryCrmFollowupsRepository } from './infrastructure/in-memory-crm-followups.repository.js';
const context=executionContext('co','br','actor');
const input={requestId:'schedule-request-0001',leadId:'lead',responsibleUserId:'owner',interactionType:'CALL' as const,scheduledAt:'2026-12-10T10:00:00Z',nextAction:'Send details'};
function fixture(){
 let blocked:'branch'|'permission'|null=null,closed=false,audits=0,sequence=0,failAudit=false;
 const repository=new InMemoryCrmFollowupsRepository();
 const access:CrmFollowupsAccess={async requireBranch(){if(blocked==='branch')throw new Error('branch denied');},async requirePermission(){if(blocked==='permission')throw new Error('permission denied');},async audit(_c,action){if(action==='followup.scheduled')audits++;if(failAudit){failAudit=false;throw new Error('audit transport failed');}}};
 const service=new CrmFollowupsApplicationService(repository,{async getForIntegration(c:ExecutionContext):Promise<Lead>{return {id:leadId('lead'),companyId:c.companyId,branchId:c.branchId,number:'L1',partyKind:'PERSON',displayName:'Fixture',legalName:null,phone:null,whatsappNumber:null,email:null,address:null,nationalIdentity:null,taxIdentity:null,source:'test',requestedService:null,expectedValue:null,currency:null,status:closed?'LOST':'CONTACTED',responsibleUserId:null,referralAgentId:null,notes:null,lostReason:null,preLostStatus:null,quotationReference:null,convertedCustomerId:null,createdAt:'x',updatedAt:'x'};}},access,()=>new Date('2026-10-15T10:00:00Z'),()=>`fixture-${++sequence}`);
 return {service,repository,block:(kind:'branch'|'permission'='branch')=>{blocked=kind;},failNextAudit:()=>{failAudit=true;},close:()=>{closed=true;},audits:()=>audits};
}
test('retry returns one follow-up with one schedule history and audit',async()=>{
 const f=fixture(),first=await f.service.schedule(context,input),retry=await f.service.schedule(context,input);
 assert.equal(retry.id,first.id);assert.equal((await f.service.forLead(context,leadId('lead'))).length,1);
 assert.equal((await f.service.history(context,first.id)).length,1);assert.equal(f.audits(),1);
});
test('concurrent identical requests converge',async()=>{
 const f=fixture(),rows=await Promise.all(Array.from({length:20},()=>f.service.schedule(context,input)));
 assert.equal(new Set(rows.map(row=>row.id)).size,1);assert.equal(f.audits(),1);
 assert.equal((await f.service.history(context,rows[0]!.id)).length,1);
});
test('accepted identity cannot be reused for changed data',async()=>{
 const f=fixture();await f.service.schedule(context,input);
 for(const change of [{leadId:'other'},{responsibleUserId:'other'},{scheduledAt:'2026-12-11T10:00:00Z'},{nextAction:'different'},{interactionType:'EMAIL' as const}])await assert.rejects(()=>f.service.schedule(context,{...input,...change}),/different follow-up data/);
 assert.equal((await f.service.forLead(context,leadId('lead'))).length,1);
});
test('normalization accepts equivalent timestamp and whitespace',async()=>{
 const f=fixture(),first=await f.service.schedule(context,input);
 const retry=await f.service.schedule(context,{...input,responsibleUserId:' owner ',scheduledAt:'2026-12-10T12:00:00+02:00',nextAction:' Send details '});assert.equal(retry.id,first.id);
});
test('replay preserves later cancellation and still works when lead has closed',async()=>{
 const f=fixture(),first=await f.service.schedule(context,input);await f.service.cancel(context,first.id,'not needed');f.close();
 const retry=await f.service.schedule(context,input);assert.equal(retry.id,first.id);assert.equal(retry.status,'CANCELLED');assert.equal((await f.service.history(context,first.id)).length,2);
});
test('replay requires current access before revealing any accepted result',async()=>{
 const f=fixture();await f.service.schedule(context,input);f.block();await assert.rejects(()=>f.service.schedule(context,input),/denied/);
});
test('request identity is separated by company, branch and actor',async()=>{
 const f=fixture(),scopes=[context,executionContext('other','br','actor'),executionContext('co','other','actor'),executionContext('co','br','other')];
 const rows=await Promise.all(scopes.map(c=>f.service.schedule(c,input)));assert.equal(new Set(rows.map(row=>row.id)).size,4);
});
test('legacy callers create separate follow-ups; invalid supplied keys create nothing',async()=>{
 const f=fixture(),{requestId,...legacy}=input;assert.ok(requestId);
 const a=await f.service.schedule(context,legacy),b=await f.service.schedule(context,legacy);assert.notEqual(a.id,b.id);
 for(const requestId of ['','short','contains spaces xxxxxxxxx', 'x'.repeat(129)])await assert.rejects(()=>f.service.schedule(context,{...input,requestId}),/requestId/);
 assert.equal((await f.service.forLead(context,leadId('lead'))).length,2);
});

test('permission revocation is checked even when branch remains available',async()=>{
 const f=fixture();await f.service.schedule(context,input);f.block('permission');await assert.rejects(()=>f.service.schedule(context,input),/permission denied/);
});
test('failure after durable creation can be retried without scheduling again',async()=>{
 const f=fixture();f.failNextAudit();await assert.rejects(()=>f.service.schedule(context,input),/audit transport failed/);
 const accepted=await f.service.schedule(context,input);
 assert.equal((await f.service.forLead(context,leadId('lead'))).length,1);assert.equal((await f.service.history(context,accepted.id)).length,1);
});
test('concurrent changed payloads under one key accept only one intent',async()=>{
 const f=fixture();const results=await Promise.allSettled([f.service.schedule(context,input),f.service.schedule(context,{...input,nextAction:'different'})]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
 assert.equal((await f.service.forLead(context,leadId('lead'))).length,1);
});
