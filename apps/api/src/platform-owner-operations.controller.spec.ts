import test from'node:test';
import assert from'node:assert/strict';
import{UnauthorizedException}from'@nestjs/common';
import type{SaasControlPlaneApplicationService}from'@elhafez/saas-control-plane';
import type{PlatformOperationsApplicationService}from'@elhafez/platform-operations';
import{PlatformOwnerOperationsController}from'./platform-owner-operations.controller.js';

test('owner recovery rejects missing owner authentication before operations access',async()=>{
 const controller=new PlatformOwnerOperationsController({} as SaasControlPlaneApplicationService,{} as PlatformOperationsApplicationService);
 await assert.rejects(controller.diagnostics(undefined),UnauthorizedException);
});

test('backup creation is platform scoped and protected by fresh owner MFA',async()=>{
 const calls:string[]=[];
 const saas={requireSensitiveOwner:async(token:string,otp:string)=>{calls.push('mfa:'+token+':'+otp);return{id:'owner-1'};}} as unknown as SaasControlPlaneApplicationService;
 const operations={createBackup:async(input:{actorId:string;companyId?:string})=>{calls.push('backup:'+input.actorId+':'+String(input.companyId));return{id:'b1',status:'VERIFIED'};}} as unknown as PlatformOperationsApplicationService;
 const controller=new PlatformOwnerOperationsController(saas,operations);
 const result=await controller.createBackup('Bearer owner-token','123456',{pin:true});
 assert.equal((result as {status:string}).status,'VERIFIED');
 assert.deepEqual(calls,['mfa:owner-token:123456','backup:owner-1:undefined']);
});

test('restore keeps maintenance active and revokes all platform-owner sessions only after successful restore',async()=>{
 const calls:string[]=[];
 const saas={
  requireSensitiveOwner:async()=>({id:'owner-1'}),
  revokeAllOwnerSessionsForRecovery:async()=>{calls.push('revoke-owner-sessions');return 3;},
 } as unknown as SaasControlPlaneApplicationService;
 const operations={
  restore:async()=>{calls.push('restore');return{id:'r1',backupId:'b1',actorId:'owner-1',status:'COMPLETED' as const,createdAt:new Date()};},
  maintenanceStatus:async()=>{calls.push('maintenance');return true;},
 } as unknown as PlatformOperationsApplicationService;
 const controller=new PlatformOwnerOperationsController(saas,operations);
 const result=await controller.restore('Bearer owner-token','123456',{backupId:'b1'});
 assert.equal((result as {ownerSessionsRevoked:number}).ownerSessionsRevoked,3);
 assert.equal((result as {maintenance:boolean}).maintenance,true);
 assert.deepEqual(calls,['restore','revoke-owner-sessions','maintenance']);
});

test('failed restore does not invalidate the current owner session',async()=>{
 let revoked=false;
 const saas={requireSensitiveOwner:async()=>({id:'owner-1'}),revokeAllOwnerSessionsForRecovery:async()=>{revoked=true;return 1;}} as unknown as SaasControlPlaneApplicationService;
 const operations={restore:async()=>({id:'r1',backupId:'b1',actorId:'owner-1',status:'FAILED' as const,createdAt:new Date(),error:'restore failed'})} as unknown as PlatformOperationsApplicationService;
 const controller=new PlatformOwnerOperationsController(saas,operations);
 const result=await controller.restore('Bearer owner-token','123456',{backupId:'b1'});
 assert.equal((result as {status:string}).status,'FAILED');assert.equal(revoked,false);
});

test('maintenance changes require a fresh owner MFA challenge',async()=>{
 const calls:string[]=[];
 const saas={requireSensitiveOwner:async(_token:string,otp:string)=>{calls.push('mfa:'+otp);return{id:'owner-1'};}} as unknown as SaasControlPlaneApplicationService;
 const operations={enterMaintenance:async()=>{calls.push('enter');return{active:true as const};},exitMaintenance:async()=>{calls.push('exit');return{active:false as const};}} as unknown as PlatformOperationsApplicationService;
 const controller=new PlatformOwnerOperationsController(saas,operations);
 await controller.enterMaintenance('Bearer t','111111');await controller.exitMaintenance('Bearer t','222222');
 assert.deepEqual(calls,['mfa:111111','enter','mfa:222222','exit']);
});
