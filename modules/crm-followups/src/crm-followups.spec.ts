import assert from'node:assert/strict';import test from'node:test';import{executionContext,type ExecutionContext}from'@elhafez/contracts';import{leadId,type Lead,type LeadId}from'@elhafez/crm-leads';import type{CrmFollowupsAccess}from'./application/crm-followups-access.js';import type{FollowupLeadPort}from'./application/crm-followups-dependencies.port.js';import{CrmFollowupsApplicationService}from'./application/crm-followups.application-service.js';import{InMemoryCrmFollowupsRepository}from'./infrastructure/in-memory-crm-followups.repository.js';class Access implements CrmFollowupsAccess{async requireBranch(c:ExecutionContext){if(c.branchId==='blocked')throw new Error('branch access denied');}async requirePermission():Promise<void>{}async audit():Promise<void>{}}class Leads implements FollowupLeadPort{status:Lead['status']='CONTACTED';async getForIntegration(c:ExecutionContext,id:LeadId):Promise<Lead>{if(id!=='lead-1')throw new Error('lead missing');return{id,companyId:c.companyId,branchId:c.branchId,number:'L1',partyKind:'PERSON',displayName:'Lead',legalName:null,phone:null,whatsappNumber:null,email:null,address:null,nationalIdentity:null,taxIdentity:null,source:'Web',requestedService:null,expectedValue:null,currency:null,status:this.status,responsibleUserId:null,referralAgentId:null,notes:null,lostReason:null,preLostStatus:null,quotationReference:null,convertedCustomerId:null,createdAt:'x',updatedAt:'x'};}}function fixture(repo=new InMemoryCrmFollowupsRepository()){let n=0,now=new Date('2026-09-20T12:00:00Z');const leads=new Leads(),service=new CrmFollowupsApplicationService(repo,leads,new Access(),()=>now,()=> 'id-'+(++n));return{service,leads,repo,setNow:(x:string)=>{now=new Date(x);}};}const ctx=executionContext('co','br','user'),lid=leadId('lead-1');
test('schedule, due and overdue preserve branch scope',async()=>{const f=fixture(),v=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'owner',interactionType:'CALL',scheduledAt:'2026-09-20T13:00:00Z'});assert.equal((await f.service.due(ctx,'2026-09-20T14:00:00Z')).length,1);f.setNow('2026-09-20T14:00:00Z');assert.equal((await f.service.overdue(ctx)).length,1);assert.equal((await f.service.forLead(ctx,lid))[0]?.id,v.id);await assert.rejects(()=>f.service.get(executionContext('co','other','user'),v.id));});
test('valid completion and successor are committed together with history for both records',async()=>{
  const f=fixture();
  const v=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'owner',interactionType:'WHATSAPP',scheduledAt:'2026-09-20T13:00:00Z'});
  const r=await f.service.complete(ctx,v.id,{outcome:'Answered',nextAction:'Send details',nextScheduledAt:'2026-09-21T10:00:00Z'});
  assert.equal(r.completed.status,'COMPLETED');
  assert.equal(r.next?.previousFollowupId,v.id);
  assert.deepEqual((await f.service.history(ctx,v.id)).map(x=>x.kind),['SCHEDULED','COMPLETED']);
  assert.ok(r.next);
  if(!r.next)return;
  assert.deepEqual((await f.service.history(ctx,r.next.id)).map(x=>x.kind),['SCHEDULED']);
});
test('reschedule retains old and new schedule in history',async()=>{const f=fixture(),v=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'owner',interactionType:'MEETING',scheduledAt:'2026-09-20T13:00:00Z'});await f.service.reschedule(ctx,v.id,'2026-09-20T15:00:00Z');const h=await f.service.history(ctx,v.id);assert.equal(h[1]?.kind,'RESCHEDULED');assert.equal(h[1]?.previousScheduledAt,'2026-09-20T13:00:00.000Z');assert.equal(h[1]?.scheduledAt,'2026-09-20T15:00:00.000Z');});
test('cancel prevents destructive completion and correction void retains completed evidence',async()=>{const f=fixture(),a=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'u',interactionType:'EMAIL',scheduledAt:'2026-09-20T13:00:00Z'});await f.service.cancel(ctx,a.id,'No longer needed');await assert.rejects(()=>f.service.complete(ctx,a.id,{outcome:'x'}));const b=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'u',interactionType:'CALL',scheduledAt:'2026-09-20T13:00:00Z'});await f.service.complete(ctx,b.id,{outcome:'Wrong entry'});const corrected=await f.service.voidCompletion(ctx,b.id,'entered by mistake');assert.equal(corrected.status,'COMPLETED');assert.ok(corrected.completionVoidedAt);assert.equal((await f.service.history(ctx,b.id)).at(-1)?.kind,'COMPLETION_VOIDED');});
test('closed or invalid lead cannot receive a follow-up',async()=>{const f=fixture();f.leads.status='LOST';await assert.rejects(()=>f.service.schedule(ctx,{leadId:lid,responsibleUserId:'u',interactionType:'OTHER',scheduledAt:'2026-09-20T13:00:00Z'}),/closed lead/);await assert.rejects(()=>f.service.schedule(ctx,{leadId:'missing',responsibleUserId:'u',interactionType:'OTHER',scheduledAt:'2026-09-20T13:00:00Z'}),/lead missing/);});
test('unauthorized branch is rejected',async()=>{const f=fixture();await assert.rejects(()=>f.service.overdue(executionContext('co','blocked','u')),/branch access denied/);});

test('invalid nextScheduledAt leaves the original follow-up unchanged',async()=>{
  const f=fixture();
  const v=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'owner',interactionType:'CALL',scheduledAt:'2026-09-20T13:00:00Z'});
  await assert.rejects(()=>f.service.complete(ctx,v.id,{outcome:'Answered',nextScheduledAt:'not-a-date'}),/nextScheduledAt/);
  assert.equal((await f.service.get(ctx,v.id)).status,'SCHEDULED');
  assert.deepEqual((await f.service.history(ctx,v.id)).map(x=>x.kind),['SCHEDULED']);
});

test('failed successor creation rolls back completion and its history in memory',async()=>{
  const repo=new InMemoryCrmFollowupsRepository((stage)=>{if(stage==='before-next-create')throw new Error('successor create failed');});
  const f=fixture(repo);
  const v=await f.service.schedule(ctx,{leadId:lid,responsibleUserId:'owner',interactionType:'CALL',scheduledAt:'2026-09-20T13:00:00Z'});
  await assert.rejects(()=>f.service.complete(ctx,v.id,{outcome:'Answered',nextScheduledAt:'2026-09-21T10:00:00Z'}),/successor create failed/);
  assert.equal((await f.service.get(ctx,v.id)).status,'SCHEDULED');
  assert.deepEqual((await f.service.history(ctx,v.id)).map(x=>x.kind),['SCHEDULED']);
  assert.equal((await f.service.forLead(ctx,lid)).length,1);
});
