import test from 'node:test';
import assert from 'node:assert/strict';
import {ForbiddenException,ServiceUnavailableException,UnauthorizedException,type ExecutionContext} from '@nestjs/common';
import {SaasError,type SaasControlPlaneApplicationService} from '@elhafez/saas-control-plane';
import {PlatformError,type PlatformCoreApplicationService} from '@elhafez/platform-core';
import {SaasSubscriptionGuard,type MaintenanceStatusPort} from './saas-subscription.guard.js';

function context(path:string,headers:Record<string,string|undefined>={},method='GET'):ExecutionContext{
 return{switchToHttp:()=>({getRequest:()=>({originalUrl:path,headers,method})})} as unknown as ExecutionContext;
}
function operations(active=false):MaintenanceStatusPort{return{maintenanceStatus:async()=>active};}
function platform(overrides:Partial<PlatformCoreApplicationService>={}){
 return{currentCompanyUser:async()=>({id:'user-a'}),getCompany:async()=>({id:'company-a',name:'A',active:true,createdAt:new Date()}),requireCompanyCredentialReady:async()=>({username:'user-a'}),...overrides} as unknown as PlatformCoreApplicationService;
}
test('central SaaS guard fails closed for business requests without company context',async()=>{
 const saas={assertTenantAccess:async()=>({})} as unknown as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform(),operations());
 await assert.rejects(()=>guard.canActivate(context('/tourism-services',authorizationHeaders())),error=>error instanceof ForbiddenException);
});
test('central SaaS guard requires a tenant bearer session before subscription evaluation',async()=>{
 let subscriptionChecked=false;
 const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform(),operations());
 await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a'})),error=>error instanceof UnauthorizedException);
 assert.equal(subscriptionChecked,false);
});
test('central SaaS guard validates user-company membership before revealing subscription state',async()=>{
 let subscriptionChecked=false;
 const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform({getCompany:async()=>{throw new PlatformError('FORBIDDEN','outside company')}}),operations());
 await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),error=>error instanceof ForbiddenException);
 assert.equal(subscriptionChecked,false);
});
test('central SaaS guard rejects direct API access when server subscription authority denies an authorized company',async()=>{
 const calls:string[]=[];
 const saas={assertTenantAccess:async(companyId:string)=>{calls.push(companyId);throw new SaasError('SUBSCRIPTION_EXPIRED','expired')}} as unknown as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform(),operations());
 await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),error=>error instanceof ForbiddenException);
 assert.deepEqual(calls,['company-a']);
});
test('authorized tenant with valid subscription reaches business controllers',async()=>{
 const calls:string[]=[];
 const saas={assertTenantAccess:async(companyId:string)=>{calls.push('subscription:'+companyId);return{};}} as unknown as SaasControlPlaneApplicationService;
 const core=platform({currentCompanyUser:async()=>{calls.push('session');return{id:'user-a'} as never},getCompany:async(userId:string,companyId:string)=>{calls.push('company:'+userId+':'+companyId);return{id:companyId,name:'A',active:true,createdAt:new Date()} as never;},requireCompanyCredentialReady:async(userId:string,companyId:string)=>{calls.push('credentials:'+userId+':'+companyId);return{username:'admin'};}});
 const guard=new SaasSubscriptionGuard(saas,core,operations());
 assert.equal(await guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),true);
 assert.deepEqual(calls,['session','company:user-a:company-a','credentials:user-a:company-a','subscription:company-a']);
});
test('owner control, company-code resolution, subscription status and password recovery bypass tenant gate only',async()=>{
 const saas={assertTenantAccess:async()=>{throw new Error('must not be called')}} as unknown as SaasControlPlaneApplicationService;
 const core=platform({currentCompanyUser:async()=>{throw new Error('must not be called')}});
 const guard=new SaasSubscriptionGuard(saas,core,operations());
 for(const path of['/saas-owner/login','/saas/login','/saas/subscription-status','/saas/credentials','/saas/credentials/initial-password','/system-administration/recovery/request','/system-administration/recovery/reset'])assert.equal(await guard.canActivate(context(path)),true);
});
function authorizationHeaders(){return{authorization:'Bearer tenant-session'};}


test('public-route matching cannot be widened by a lookalike prefix',async()=>{const saas={assertTenantAccess:async()=>({})} as unknown as SaasControlPlaneApplicationService;const guard=new SaasSubscriptionGuard(saas,platform(),operations());await assert.rejects(()=>guard.canActivate(context('/saas-owner-malicious',authorizationHeaders())),error=>error instanceof ForbiddenException);});


test('tenant company provisioning is reserved for Owner Control Center even for an authenticated active tenant',async()=>{let subscriptionChecked=false;const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;const guard=new SaasSubscriptionGuard(saas,platform(),operations());await assert.rejects(()=>guard.canActivate(context('/system-administration/companies',{'x-company-id':'company-a',...authorizationHeaders()},'POST')),error=>error instanceof ForbiddenException);assert.equal(subscriptionChecked,false);});


test('administratively inactive company remains blocked even with a paid active subscription',async()=>{let subscriptionChecked=false;const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;const core=platform({getCompany:async()=>({id:'company-a',name:'A',active:false,createdAt:new Date()}) as never});const guard=new SaasSubscriptionGuard(saas,core,operations());await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),error=>error instanceof ForbiddenException);assert.equal(subscriptionChecked,false);});


test('supplied branch context is centrally verified before subscription access',async()=>{const calls:string[]=[];const saas={assertTenantAccess:async()=>{calls.push('subscription');return{};}} as unknown as SaasControlPlaneApplicationService;const core=platform({requireBranchAccess:async(userId:string,companyId:string,branchId:string)=>{calls.push(`branch:${userId}:${companyId}:${branchId}`);},requireCompanyCredentialReady:async()=>{calls.push('credentials');return{username:'admin'};}});const guard=new SaasSubscriptionGuard(saas,core,operations());assert.equal(await guard.canActivate(context('/tourism-services',{'x-company-id':'company-a','x-branch-id':'branch-a',...authorizationHeaders()})),true);assert.deepEqual(calls,['branch:user-a:company-a:branch-a','credentials','subscription']);});

test('invalid supplied branch is denied before subscription state is disclosed',async()=>{let subscriptionChecked=false;const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;const core=platform({requireBranchAccess:async()=>{throw new PlatformError('FORBIDDEN','branch denied')}});const guard=new SaasSubscriptionGuard(saas,core,operations());await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a','x-branch-id':'branch-x',...authorizationHeaders()})),error=>error instanceof ForbiddenException);assert.equal(subscriptionChecked,false);});

test('maintenance blocks tenant traffic inside the API even when the reverse proxy is bypassed',async()=>{
 const saas={assertTenantAccess:async()=>({})}as unknown as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform(),operations(true));
 await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),error=>error instanceof ServiceUnavailableException);
});
test('maintenance leaves only owner login logout and recovery operations reachable',async()=>{
 const saas={}as SaasControlPlaneApplicationService;
 const guard=new SaasSubscriptionGuard(saas,platform(),operations(true));
 for(const path of['/saas-owner/login','/saas-owner/logout','/saas-owner/operations/diagnostics','/saas-owner/operations/maintenance/exit'])assert.equal(await guard.canActivate(context(path)),true);
 await assert.rejects(()=>guard.canActivate(context('/saas-owner/companies')),error=>error instanceof ServiceUnavailableException);
 await assert.rejects(()=>guard.canActivate(context('/saas/login')),error=>error instanceof ServiceUnavailableException);
});


test('temporary company password is blocked server-side before subscription state is evaluated',async()=>{let subscriptionChecked=false;const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;const core=platform({requireCompanyCredentialReady:async()=>{throw new PlatformError('CREDENTIAL_CHANGE_REQUIRED','temporary password must be changed')}});const guard=new SaasSubscriptionGuard(saas,core,operations());await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-a',...authorizationHeaders()})),error=>error instanceof ForbiddenException);assert.equal(subscriptionChecked,false);});


test('company-bound session rejects a different company context before any business authority is consulted',async()=>{let subscriptionChecked=false;const saas={assertTenantAccess:async()=>{subscriptionChecked=true;return{};}} as unknown as SaasControlPlaneApplicationService;const core=platform({currentCompanyUser:async()=>{throw new PlatformError('UNAUTHENTICATED','valid company session required')}});const guard=new SaasSubscriptionGuard(saas,core,operations());await assert.rejects(()=>guard.canActivate(context('/tourism-services',{'x-company-id':'company-b',...authorizationHeaders()})),error=>error instanceof UnauthorizedException);assert.equal(subscriptionChecked,false);});
