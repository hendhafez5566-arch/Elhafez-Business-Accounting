import test from 'node:test';
import assert from 'node:assert/strict';
import {UnauthorizedException} from '@nestjs/common';
import type {PlatformCoreApplicationService} from '@elhafez/platform-core';
import type {DataExchangeApplicationService} from '@elhafez/data-exchange';
import type {PlatformOperationsApplicationService} from '@elhafez/platform-operations';
import {SystemAdministrationController} from './system-administration.controller.js';
import type {SystemAdministrationDataExchangeBoundary} from './system-administration-data-exchange.js';

test('system administration rejects missing authentication context before data access',async()=>{
 const controller=new SystemAdministrationController(
  {} as unknown as PlatformCoreApplicationService,
  {} as unknown as DataExchangeApplicationService,
  {} as unknown as PlatformOperationsApplicationService,
  {datasets:()=>[]} as unknown as SystemAdministrationDataExchangeBoundary
 );
 await assert.rejects(controller.datasets(undefined,'company-a','branch-a'),UnauthorizedException);
});

test('system administration authorizes company and branch before exposing dataset capabilities',async()=>{
 const calls:string[]=[];
 const platform={
  currentUser:async()=>({id:'actor-a'}),
  requireBranchAccess:async(actorId:string,companyId:string,branchId:string)=>{calls.push(`branch:${actorId}:${companyId}:${branchId}`);},
  authorize:async(actorId:string,companyId:string,permission:string)=>{calls.push(`permission:${actorId}:${companyId}:${permission}`);}
 } as unknown as PlatformCoreApplicationService;
 const controller=new SystemAdministrationController(
  platform,
  {} as unknown as DataExchangeApplicationService,
  {} as unknown as PlatformOperationsApplicationService,
  {datasets:()=>[{id:'CUSTOMERS',label:'العملاء',requiredFields:['kind','displayName'],targetFields:['kind','displayName']}]} as unknown as SystemAdministrationDataExchangeBoundary
 );
 const result=await controller.datasets('Bearer token','company-a','branch-a');
 assert.equal(result[0]?.id,'CUSTOMERS');
 assert.deepEqual(calls,['branch:actor-a:company-a:branch-a','permission:actor-a:company-a:data_exchange.read']);
});
