/** Explicit disposable acceptance of the real production AppModule over HTTP. */
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreApplicationService } from '@elhafez/platform-core';
import { AppModule } from './app.module.js';
import { GlobalRequestSafetyPipe } from './global-request-safety.pipe.js';
import { PlatformErrorFilter } from './platform-error.filter.js';

const databaseUrl=process.env.FOLLOWUP_TEST_DATABASE_URL;
if(!databaseUrl||process.env.DATABASE_URL!==databaseUrl)throw new Error('real HTTP acceptance requires the same disposable DATABASE_URL and FOLLOWUP_TEST_DATABASE_URL');
const parsed=new URL(databaseUrl);
if(!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||parsed.pathname!=='/elhafez_followup_test')throw new Error('refusing non-disposable database');
process.env.SAAS_OWNER_BOOTSTRAP_TOKEN=randomBytes(32).toString('hex');
process.env.SAAS_OWNER_MFA_KEY=randomBytes(32).toString('base64url');
const password='Test-only-'+randomBytes(18).toString('hex');
const newPassword='Changed-test-'+randomBytes(18).toString('hex');

/** Standard TOTP client: server verification is not mocked or overridden. */
function otp(secret:string){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',key).update(counter).digest(),offset=digest[digest.length-1]!&15;
 return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
interface Tenant {token:string;userId:string;companyId:string;companyCode:string;defaultBranchId:string;mustChangePassword:boolean;}
interface Lead {id:string;}
interface Followup {id:string;status:string;}
await test('real AppModule HTTP + company sessions + subscription + RBAC + PostgreSQL',async t=>{
 const app=await NestFactory.create(AppModule,{logger:['error','warn']});
 app.useGlobalPipes(new GlobalRequestSafetyPipe());app.useGlobalFilters(new PlatformErrorFilter());
 await app.listen(0,'127.0.0.1');
 const origin=await app.getUrl(),platform=app.get(PlatformCoreApplicationService);
 let tenant:Tenant,second:Tenant,ownerToken='',mfaSecret='',leadId='',acceptedId='',limited:Tenant,roleId='',permissionId='';
 const ownerHeaders=()=>({authorization:`Bearer ${ownerToken}`,'x-owner-totp':otp(mfaSecret)});
 const headers=(value:Tenant)=>({authorization:`Bearer ${value.token}`,'x-company-id':value.companyId,'x-branch-id':value.defaultBranchId});
 async function request<T>(path:string,{method='POST',body,headers:extra={},status=201}:{method?:string;body?:unknown;headers?:Record<string,string>;status?:number}={}):Promise<T>{
  const response=await fetch(origin+path,{method,headers:{'content-type':'application/json',...extra},...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,status,`${method} ${path} returned unexpected HTTP status`);
  return await response.json() as T;
 }
 async function provision(name:string):Promise<Tenant>{
  const created=await request<{company:{id:string}}>('/saas-owner/companies',{headers:ownerHeaders(),body:{name,administratorUsername:'administrator',temporaryPassword:password,administratorDisplayName:'Acceptance admin'}});
  const plan=await request<{id:string}>('/saas-owner/plans',{headers:ownerHeaders(),body:{code:'TEST-'+randomUUID(),name:'Acceptance plan',intervalMonths:1,priceMinor:100,currency:'EGP',entitlements:[]}});
  await request('/saas-owner/companies/'+created.company.id+'/activate',{headers:ownerHeaders(),body:{planId:plan.id,months:1,paymentReference:'test-only',amountMinor:100,currency:'EGP',idempotencyKey:randomUUID()}});
  const companies=await request<Array<{company:{id:string};companyCode:string}>>('/saas-owner/companies',{method:'GET',headers:ownerHeaders(),status:200});
  const companyCode=companies.find(row=>row.company.id===created.company.id)?.companyCode;assert.ok(companyCode);
  return request<Tenant>('/saas/login',{body:{companyCode,username:'administrator',password}});
 }
 const command=()=>({requestId:'http-'+randomUUID(),leadId,responsibleUserId:tenant.userId,interactionType:'CALL',scheduledAt:'2026-12-10T10:00:00Z',nextAction:'HTTP acceptance'});
 try{
  await t.test('real owner bootstrap, MFA login and company subscription provisioning',async()=>{
   const boot=await request<{mfaSecret:string}>('/saas-owner/bootstrap',{headers:{'x-saas-bootstrap-token':process.env.SAAS_OWNER_BOOTSTRAP_TOKEN!},body:{email:'http-owner@example.test',password}});mfaSecret=boot.mfaSecret;
   const owner=await request<{token:string}>('/saas-owner/login',{body:{email:'http-owner@example.test',password,mfaCode:otp(mfaSecret)}});ownerToken=owner.token;
   tenant=await provision('HTTP Company A');second=await provision('HTTP Company B');assert.equal(tenant.mustChangePassword,true);
  });
  await t.test('temporary credentials cannot schedule; completing initial change permits business requests',async()=>{
   await request('/crm/followups',{headers:headers(tenant),body:{},status:403});
   for(const value of [tenant,second])await request('/saas/credentials/initial-password',{headers:headers(value),body:{newPassword}});
   const created=await request<Lead>('/crm/leads',{headers:headers(tenant),body:{partyKind:'PERSON',displayName:'Actual HTTP customer request',source:'Acceptance'}});leadId=created.id;assert.ok(leadId);
  });
  let acceptedCommand:ReturnType<typeof command>;
  await t.test('twenty authenticated concurrent requests produce one real follow-up and one history',async()=>{
   acceptedCommand=command();const results=await Promise.all(Array.from({length:20},()=>request<Followup>('/crm/followups',{headers:headers(tenant),body:acceptedCommand})));
   assert.equal(new Set(results.map(row=>row.id)).size,1);acceptedId=results[0]!.id;
   const history=await request<Array<{kind:string}>>('/crm/followups/'+acceptedId+'/history',{method:'GET',headers:headers(tenant),status:200});assert.deepEqual(history.map(row=>row.kind),['SCHEDULED']);
  });
  await t.test('changed payload and invalid body return explicit HTTP 400 without new scheduling',async()=>{
   const conflict=await request<{code:string;field:string}>('/crm/followups',{headers:headers(tenant),body:{...acceptedCommand,nextAction:'Changed'},status:400});assert.equal(conflict.field,'requestId');assert.equal(conflict.code,'VALIDATION_ERROR');
   for(const body of [{...command(),leadId:123},{...command(),responsibleUserId:null},{...command(),nextAction:456}])await request('/crm/followups',{headers:headers(tenant),body,status:400});
   const rows=await request<Followup[]>('/crm/followups/lead/'+leadId,{method:'GET',headers:headers(tenant),status:200});assert.equal(rows.length,1);
  });
  await t.test('real guard rejects missing tokens and forged company or branch scope',async()=>{
   await request('/crm/followups',{headers:{'x-company-id':tenant.companyId,'x-branch-id':tenant.defaultBranchId},body:command(),status:401});
   await request('/crm/followups',{headers:{...headers(tenant),'x-company-id':second.companyId,'x-branch-id':second.defaultBranchId},body:command(),status:401});
   await request('/crm/followups',{headers:{...headers(tenant),'x-branch-id':second.defaultBranchId},body:command(),status:403});
  });
  await t.test('lost HTTP response after real commit can be retried with one persisted effect',async()=>{
   const body=command();let droppedId='';
   const proxy=createServer(async(_req,res)=>{
    const response=await fetch(origin+'/crm/followups',{method:'POST',headers:{'content-type':'application/json',...headers(tenant)},body:JSON.stringify(body)});
    assert.equal(response.status,201);const result=await response.json() as Followup;droppedId=result.id;
    res.writeHead(201,{'content-type':'application/json'});res.flushHeaders();res.write('{"partial":');setTimeout(()=>res.destroy(),30);
   });
   await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));
   try{
    const address=proxy.address();assert.ok(address&&typeof address!=='string');
    await assert.rejects(async()=>{const response=await fetch(`http://127.0.0.1:${address.port}`,{method:'POST',signal:AbortSignal.timeout(5000)});await response.text();});
    const retry=await request<Followup>('/crm/followups',{headers:headers(tenant),body});assert.equal(retry.id,droppedId);
    const history=await request<Array<{kind:string}>>('/crm/followups/'+retry.id+'/history',{method:'GET',headers:headers(tenant),status:200});assert.deepEqual(history.map(row=>row.kind),['SCHEDULED']);
   }finally{await new Promise<void>(resolve=>proxy.close(()=>resolve()));}
  });
  let limitedCommand:ReturnType<typeof command>;
  await t.test('non-administrator scheduling obeys real role permission changes on replay',async()=>{
   roleId=await platform.createRole('http-limited-'+randomUUID());
   const existing=await platform.listPermissions();permissionId=existing.find(p=>p.name==='crm.followup.manage')?.id??await platform.createPermission('crm.followup.manage');await platform.grantPermission(tenant.companyId,roleId,permissionId);
   await platform.createCompanyUser({actorId:tenant.userId,companyId:tenant.companyId,branchId:tenant.defaultBranchId,username:'limited',temporaryPassword:password,displayName:'Limited acceptance user',roleId});
   limited=await request<Tenant>('/saas/login',{body:{companyCode:tenant.companyCode,username:'limited',password}});
   await request('/saas/credentials/initial-password',{headers:headers(limited),body:{newPassword}});
   limitedCommand=command();await request('/crm/followups',{headers:headers(limited),body:limitedCommand});
   await platform.revokePermission(tenant.companyId,roleId,permissionId);await request('/crm/followups',{headers:headers(limited),body:limitedCommand,status:403});
   await platform.grantPermission(tenant.companyId,roleId,permissionId);await request('/crm/followups',{headers:headers(limited),body:limitedCommand});
  });
  await t.test('revoked branch access blocks replay under an otherwise valid session',async()=>{
   await platform.revokeBranchAccess(limited.userId,limited.defaultBranchId);await request('/crm/followups',{headers:headers(limited),body:limitedCommand,status:403});
  });
  await t.test('cancelled follow-up remains cancelled when original command is retried',async()=>{
   await request('/crm/followups/'+acceptedId+'/cancel',{headers:headers(tenant),body:{reason:'Acceptance cancellation'}});
   const retry=await request<Followup>('/crm/followups',{headers:headers(tenant),body:acceptedCommand});assert.equal(retry.id,acceptedId);assert.equal(retry.status,'CANCELLED');
  });
  await t.test('subscription suspension blocks replay and logout revokes actual bearer session',async()=>{
   await request('/saas-owner/companies/'+tenant.companyId+'/suspend',{headers:ownerHeaders(),body:{}});await request('/crm/followups',{headers:headers(tenant),body:acceptedCommand,status:403});
   await request('/saas-owner/companies/'+tenant.companyId+'/resume',{headers:ownerHeaders(),body:{}});
   await request('/saas/logout',{headers:headers(tenant),body:{}});await request('/crm/followups',{headers:headers(tenant),body:acceptedCommand,status:401});
  });
 }finally{
  await app.close();await Promise.all(app.get(PrismaClient,{each:true}).map(db=>db.$disconnect()));
 }
});
