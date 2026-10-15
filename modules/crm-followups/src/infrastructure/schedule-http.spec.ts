import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ContractValidationError } from '@elhafez/contracts';
import { PlatformError } from '@elhafez/platform-core';
import { throwFollowupScheduleError } from './crm-followups.controller.js';

test('schedule contract errors become a structured HTTP 400 without changing their field',()=>{
 const error=new ContractValidationError('requestId','payload differs');
 assert.throws(()=>throwFollowupScheduleError(error),value=>{
  assert.ok(value instanceof BadRequestException);assert.equal(value.getStatus(),400);
  assert.deepEqual(value.getResponse(),{code:'VALIDATION_ERROR',field:'requestId',message:error.message});return true;
 });
});
test('authorization and unexpected errors remain intact for the canonical global handlers',()=>{
 for(const error of [new PlatformError('FORBIDDEN','permission denied'),new UnauthorizedException('session required'),new Error('database failed')])assert.throws(()=>throwFollowupScheduleError(error),value=>value===error);
});
