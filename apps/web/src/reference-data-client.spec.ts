import assert from'node:assert/strict';
import test from'node:test';
import{agentReferenceLabel,customerReferenceLabel,travelerReferenceLabel}from'./reference-data-client.js';

test('reference labels keep internal ids out of employee-facing choices',()=>{
 assert.equal(customerReferenceLabel({customer:{id:'c1',number:'C-001',status:'ACTIVE'},party:{id:'p1',displayName:'عميل تجريبي',phone:null}}),'C-001 — عميل تجريبي');
 assert.equal(agentReferenceLabel({agent:{id:'a1',number:'A-001',status:'ACTIVE'},party:{id:'p2',displayName:'وكيل تجريبي',phone:null}}),'A-001 — وكيل تجريبي');
 assert.equal(travelerReferenceLabel({id:'t1',fullName:'مسافر تجريبي',nationality:'مصري',customerId:'c1',status:'ACTIVE'}),'مسافر تجريبي — مصري');
});
