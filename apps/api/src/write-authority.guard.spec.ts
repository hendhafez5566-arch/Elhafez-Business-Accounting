import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { ContractValidationError } from '@elhafez/contracts';
import { WriteAuthorityGuard } from './write-authority.guard.js';
const http=(url:string,method='POST')=>new ExecutionContextHost([{method,url,headers:{'x-company-id':'company-a'}},{},()=>{}]);
test('all business mutation paths require company write authority independently of operation name',async()=>{const calls:string[]=[];const guard=new WriteAuthorityGuard({async assert(company,server){calls.push(company+':'+server);throw new ContractValidationError('authority','server is fenced');}},()=>undefined);for(const path of ['/hajj-umrah/operations/bookings','/accounting/settlements','/offline/commands','/saas-owner-malicious/write'])await assert.rejects(()=>guard.canActivate(http(path)),error=>error instanceof ForbiddenException);assert.equal(calls.length,4);});
test('read-only and exact authentication/enrollment paths do not grant economic write authority',async()=>{let calls=0;const guard=new WriteAuthorityGuard({async assert(){calls++;throw Error('must not run for a safe path');}});for(const path of ['/health','/hajj-umrah/operations/bookings'])assert.equal(await guard.canActivate(http(path,'GET')),true);for(const path of ['/saas/login','/offline/authority/enroll','/saas/credentials/initial-password'])assert.equal(await guard.canActivate(http(path)),true);assert.equal(calls,0);});
