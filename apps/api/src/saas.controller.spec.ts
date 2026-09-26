import test from 'node:test';
import assert from 'node:assert/strict';
import {ForbiddenException,UnauthorizedException} from '@nestjs/common';
import {SaasError,type SaasControlPlaneApplicationService} from '@elhafez/saas-control-plane';
import {PlatformError,type PlatformCoreApplicationService} from '@elhafez/platform-core';
import {SaasOwnerController,SaasTenantController} from './saas.controller.js';

test('tenant provisioning requires owner MFA before any platform mutation',async()=>{
 let provisioned=false;
 const saas={beginCompanyProvisioning:async()=>{throw new SaasError('MFA_REQUIRED','mfa required')}} as unknown as SaasControlPlaneApplicationService;
 const platform={provisionCompanyForPlatformControl:async()=>{provisioned=true;return{};}} as unknown as PlatformCoreApplicationService;
 const controller=new SaasOwnerController(saas,platform);
 await assert.rejects(()=>controller.createCompany('Bearer owner-session','000000',{name:'Blocked',administratorUsername:'admin',temporaryPassword:'temporary-password',administratorDisplayName:'A'}),error=>error instanceof ForbiddenException);
 assert.equal(provisioned,false);
});

test('company listing requires a separate owner session rather than tenant permissions',async()=>{
 const saas={requireOwner:async()=>{throw new SaasError('AUTH_REQUIRED','owner required')}} as unknown as SaasControlPlaneApplicationService;
 let listed=false;
 const platform={listAllCompaniesForPlatformControl:async()=>{listed=true;return[];}} as unknown as PlatformCoreApplicationService;
 const controller=new SaasOwnerController(saas,platform);
 await assert.rejects(()=>controller.companies('Bearer tenant-session'),error=>error instanceof UnauthorizedException);
 assert.equal(listed,false);
});


test('tenant subscription status requires an authenticated tenant user before commercial metadata is returned',async()=>{let queried=false;const saas={subscriptionStatus:async()=>{queried=true;return{};}} as unknown as SaasControlPlaneApplicationService;const platform={} as unknown as PlatformCoreApplicationService;const controller=new SaasTenantController(saas,platform);await assert.rejects(()=>controller.status(undefined,'company-a'),error=>error instanceof UnauthorizedException);assert.equal(queried,false);});


test('tenant login uses Company Code plus company-scoped username and returns first-login state',async()=>{const expiresAt=new Date('2026-11-01T00:00:00Z');const saas={resolveCompanyCode:async()=>({companyId:'company-a',companyCode:'ELH-ABC'}),subscriptionStatus:async()=>({companyId:'company-a',companyCode:'ELH-ABC',mode:'SUBSCRIPTION',status:'EXPIRED',allowed:false,planId:'plan-a',currentPeriodEnd:new Date('2026-10-01T00:00:00Z'),gracePeriodEnd:null,entitlements:['*'],reason:'SUBSCRIPTION_EXPIRED'})} as unknown as SaasControlPlaneApplicationService;let loggedOut=false;const platform={loginCompany:async()=>({token:'tenant-token',userId:'user-a',username:'manager',mustChangePassword:true,expiresAt}),getCompany:async()=>({id:'company-a',name:'A',active:true,createdAt:new Date()}),listAccessibleBranches:async()=>[{id:'branch-a',companyId:'company-a',name:'الرئيسي',active:true,createdAt:new Date()}],logout:async()=>{loggedOut=true;}} as unknown as PlatformCoreApplicationService;const controller=new SaasTenantController(saas,platform);const result=await controller.login({companyCode:'ELH-ABC',username:'manager',password:'valid-password-value'});assert.equal(result.companyId,'company-a');assert.equal(result.companyName,'A');assert.equal(result.username,'manager');assert.equal(result.mustChangePassword,true);assert.equal(result.defaultBranchId,'branch-a');assert.equal(result.subscription.status,'EXPIRED');assert.equal(result.token,'tenant-token');assert.equal(loggedOut,false);});

test('tenant login revokes a newly-created session when the user is outside the Company Code scope',async()=>{const saas={resolveCompanyCode:async()=>({companyId:'company-a',companyCode:'ELH-ABC'})} as unknown as SaasControlPlaneApplicationService;let revoked='';const platform={loginCompany:async()=>({token:'temporary-token',userId:'user-b',username:'other',mustChangePassword:false,expiresAt:new Date()}),getCompany:async()=>{throw new PlatformError('FORBIDDEN','outside company')},logout:async(token:string)=>{revoked=token;}} as unknown as PlatformCoreApplicationService;const controller=new SaasTenantController(saas,platform);await assert.rejects(()=>controller.login({companyCode:'ELH-ABC',username:'other',password:'valid-password-value'}),error=>error instanceof UnauthorizedException);assert.equal(revoked,'temporary-token');});


test('platform owner emergency suspension requires fresh MFA before changing company active state',async()=>{let updated=false;const saas={requireSensitiveOwner:async()=>{throw new SaasError('MFA_REQUIRED','mfa required')}} as unknown as SaasControlPlaneApplicationService;const platform={updateCompany:async()=>{updated=true;return{};}} as unknown as PlatformCoreApplicationService;const controller=new SaasOwnerController(saas,platform);await assert.rejects(()=>controller.platformSuspend('Bearer owner-session','000000','company-a'),error=>error instanceof ForbiddenException);assert.equal(updated,false);});

test('platform owner emergency suspension is separate from commercial subscription state',async()=>{const saas={requireSensitiveOwner:async()=>({id:'owner-a',email:'owner@example.test'})} as unknown as SaasControlPlaneApplicationService;let call:unknown;const platform={updateCompany:async(actorId:string,companyId:string,input:unknown)=>{call={actorId,companyId,input};return{id:companyId,name:'A',active:false,createdAt:new Date()};}} as unknown as PlatformCoreApplicationService;const controller=new SaasOwnerController(saas,platform);const result=await controller.platformSuspend('Bearer owner-session','123456','company-a');assert.equal(result.active,false);assert.deepEqual(call,{actorId:'owner-a',companyId:'company-a',input:{active:false}});});


test('tenant login revokes the session when no authorized active branch remains',async()=>{const saas={resolveCompanyCode:async()=>({companyId:'company-a',companyCode:'ELH-ABC'})} as unknown as SaasControlPlaneApplicationService;let revoked='';const platform={loginCompany:async()=>({token:'temporary-token',userId:'user-a',username:'admin',mustChangePassword:false,expiresAt:new Date()}),getCompany:async()=>({id:'company-a',name:'A',active:true,createdAt:new Date()}),listAccessibleBranches:async()=>[],logout:async(token:string)=>{revoked=token;}} as unknown as PlatformCoreApplicationService;const controller=new SaasTenantController(saas,platform);await assert.rejects(()=>controller.login({companyCode:'ELH-ABC',username:'admin',password:'valid-password-value'}),error=>error instanceof UnauthorizedException);assert.equal(revoked,'temporary-token');});


test('initial password endpoint is authenticated and may finalize a new username in the same first-login step',async()=>{let call:unknown;const saas={} as SaasControlPlaneApplicationService,platform={completeInitialPasswordChange:async(token:string,companyId:string,newPassword:string,newUsername?:string)=>{call={token,companyId,newPassword,newUsername};return{username:newUsername??'admin',mustChangePassword:false};}} as unknown as PlatformCoreApplicationService;const controller=new SaasTenantController(saas,platform);const result=await controller.initialPassword('Bearer tenant-token','company-a',{newPassword:'new-safe-password',newUsername:'director'});assert.deepEqual(call,{token:'tenant-token',companyId:'company-a',newPassword:'new-safe-password',newUsername:'director'});assert.equal(result.username,'director');assert.equal(result.mustChangePassword,false);});
