import test from 'node:test';
import assert from 'node:assert/strict';
import { commandIdentity, type QueuedCommand } from './offline-command-store.js';
const original:QueuedCommand={id:'request-000000000001',grantId:'grant-0000000000001',deviceId:'device-000000000001',operation:'BOOKING_DEPOSIT',payload:{amount:'100',bookingId:'booking'},dependencies:['parent-000000000001'],capturedAt:'2026-10-15T10:00:00Z',state:'PENDING',reason:null,result:null};
test('restored duplicate identity covers every immutable request field',()=>{
 for(const change of [{id:'different'},{grantId:'different'},{deviceId:'different'},{operation:'BOOKING_CREATE' as const},{payload:{amount:'101',bookingId:'booking'}},{dependencies:[]},{capturedAt:'2026-10-15T10:00:01Z'}])assert.notEqual(commandIdentity(original),commandIdentity({...original,...change}));
});
test('identity ignores receipts and JSON object order while retaining array order',()=>{
 assert.equal(commandIdentity(original),commandIdentity({...original,payload:{bookingId:'booking',amount:'100'},state:'ACCEPTED',reason:'accepted',result:{voucher:'official'}}));
 assert.notEqual(commandIdentity({...original,dependencies:['first','second']}),commandIdentity({...original,dependencies:['second','first']}));
});
