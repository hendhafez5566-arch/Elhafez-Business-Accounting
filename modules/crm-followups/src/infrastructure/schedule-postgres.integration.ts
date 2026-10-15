/** Explicit disposable PostgreSQL acceptance. Not part of the fast unit-test glob. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { leadId, type Lead } from '@elhafez/crm-leads';
import { CrmFollowupsApplicationService } from '../application/crm-followups.application-service.js';
import type { CrmFollowupsAccess } from '../application/crm-followups-access.js';
import { scheduleRequest } from '../application/schedule-request.js';
import { PrismaCrmFollowupsRepository } from './prisma-crm-followups.repository.js';
import { followupId } from '../domain/followup.js';

const databaseUrl=process.env.FOLLOWUP_TEST_DATABASE_URL;
if(!databaseUrl)throw new Error('FOLLOWUP_TEST_DATABASE_URL must point to an already migrated disposable PostgreSQL database');
const url=new URL(databaseUrl);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/elhafez_followup_test')throw new Error('acceptance requires loopback database named elhafez_followup_test');
const company='retry-test-'+randomUUID(),context=executionContext(company,'branch-a','actor-a');
const input={requestId:'request-'+randomUUID(),leadId:'lead-a',responsibleUserId:'owner-a',interactionType:'CALL' as const,scheduledAt:'2026-12-10T10:00:00Z',nextAction:'Test only'};
const clients:Array<PrismaClient>=[];
let denied=false,closed=false;
const access:CrmFollowupsAccess={async requireBranch(){if(denied)throw new Error('access revoked');},async requirePermission(){if(denied)throw new Error('permission revoked');},async audit(){}};
const leads={async getForIntegration(c:ExecutionContext):Promise<Lead>{return {id:leadId('lead-a'),companyId:c.companyId,branchId:c.branchId,number:'L1',partyKind:'PERSON',displayName:'Fixture',legalName:null,phone:null,whatsappNumber:null,email:null,address:null,nationalIdentity:null,taxIdentity:null,source:'test',requestedService:null,expectedValue:null,currency:null,status:closed?'LOST':'CONTACTED',responsibleUserId:null,referralAgentId:null,notes:null,lostReason:null,preLostStatus:null,quotationReference:null,convertedCustomerId:null,createdAt:'x',updatedAt:'x'};}};
function connection(){const db=new PrismaClient({datasources:{db:{url:databaseUrl}}});clients.push(db);return db;}
const make=(db:PrismaClient)=>new CrmFollowupsApplicationService(new PrismaCrmFollowupsRepository(db),leads,access);
await test('durable schedule acceptance against disposable native PostgreSQL',async t=>{
 const a=connection(),b=connection(),serviceA=make(a),serviceB=make(b);
 try{
  let acceptedId='';
  await t.test('simultaneous connections create exactly one follow-up and one history',async()=>{
   const results=await Promise.all(Array.from({length:20},(_,i)=>(i%2?serviceA:serviceB).schedule(context,input)));
   assert.equal(new Set(results.map(row=>row.id)).size,1);acceptedId=results[0]!.id;
   assert.equal(await a.cfFollowup.count({where:{companyId:company,scheduleRequestId:input.requestId}}),1);
   assert.equal(await a.cfFollowupHistory.count({where:{companyId:company,followupId:acceptedId}}),1);
  });
  await t.test('fresh application/client recovers receipt after original client disconnects',async()=>{
   await a.$disconnect();const fresh=make(connection());
   assert.equal((await fresh.schedule(context,input)).id,acceptedId);
  });
  await t.test('different payload under the same identity cannot create a second effect',async()=>{
   await assert.rejects(()=>serviceB.schedule(context,{...input,nextAction:'changed'}),/different follow-up data/);
   assert.equal(await b.cfFollowup.count({where:{companyId:company,scheduleRequestId:input.requestId}}),1);
  });
  await t.test('history write failure rolls back follow-up and receipt together',async()=>{
   const existing=await b.cfFollowupHistory.findFirstOrThrow({where:{companyId:company,followupId:acceptedId}});
   const value=await serviceB.get(context,followupId(acceptedId));
   const id=followupId(randomUUID()),request=scheduleRequest('rollback-'+randomUUID(),context.actorId,['test']);
   await assert.rejects(()=>new PrismaCrmFollowupsRepository(b).createScheduledRequest({...value,id},{id:existing.id,companyId:context.companyId,branchId:context.branchId,followupId:id,leadId:value.leadId,kind:'SCHEDULED',detail:null,previousScheduledAt:null,scheduledAt:value.scheduledAt,actorId:context.actorId,occurredAt:value.createdAt},request));
   assert.equal(await b.cfFollowup.count({where:{companyId:company,id}}),0);
   assert.equal(await b.cfFollowup.count({where:{companyId:company,scheduleRequestId:request.id}}),0);
   const retry=await serviceB.schedule(context,{...input,requestId:request.id});assert.ok(retry.id);
  });
  await t.test('same identity is independent across branch, actor and company',async()=>{
   const scopes=[executionContext(company,'branch-b','actor-a'),executionContext(company,'branch-a','actor-b'),executionContext(company+'-other','branch-a','actor-a')];
   const results=await Promise.all(scopes.map(c=>serviceB.schedule(c,input)));
   assert.equal(new Set([acceptedId,...results.map(row=>row.id)]).size,4);
  });
  await t.test('retry retains cancellation and still checks current authorization',async()=>{
   await serviceB.cancel(context,followupId(acceptedId),'test');closed=true;
   assert.equal((await serviceB.schedule(context,input)).status,'CANCELLED');
   denied=true;await assert.rejects(()=>serviceB.schedule(context,input),/revoked/);
  });
 }finally{await Promise.all(clients.map(db=>db.$disconnect()));}
});
