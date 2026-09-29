/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import {companyId,decimalAmount} from '@elhafez/contracts';
import {PartyCashMovementApplicationService} from './application/party-cash-movement.application-service.js';
import {InMemoryTreasuryRepository} from './infrastructure/in-memory-treasury.repository.js';

const company=companyId('11111111-1111-4111-8111-111111111111');
const amount=(value:string)=>decimalAmount(value);
async function fixture(required=false){
 const repo=new InMemoryTreasuryRepository(),journals:any[]=[];
 await repo.saveTreasury({id:'cash',companyId:company,code:'CASH',name:'Cash',type:'CASH',currency:'EGP',glAccountId:'cash-gl',active:true});
 await repo.savePolicy({companyId:company,allowNegative:true});
 const approvals=new Map<string,any>();
 const controls={
  evaluateApprovalRequirement:async()=>required?{decision:'APPROVAL_REQUIRED',threshold:amount('50'),requiredAuthority:'approve.payment'}:{decision:'APPROVAL_NOT_REQUIRED'},
  getApprovalRequest:async(_companyId:string,id:string)=>approvals.get(id)?.request,
  getApprovalDecision:async(_companyId:string,id:string)=>approvals.get(id)?.decision,
 };
 const gl={post:async(input:any)=>{journals.push(input);return input;}};
 return{repo,journals,approvals,service:new PartyCashMovementApplicationService(repo,gl as any,controls as any)};
}

test('AGENT receipt posts treasury debit and agent receivable credit with replay safety',async()=>{
 const f=await fixture();
 const input={id:'agent-receipt',companyId:company,branchId:'branch-1',treasuryId:'cash',kind:'RECEIPT' as const,partyKind:'AGENT' as const,partyId:'agent-party',number:'AR-1',postingDate:'2026-09-29',currency:'EGP',amount:amount('25'),offsetAccountId:'agent-ar',sourceType:'CRM_PARTY_RECEIPT_CASH',sourceId:'command-1',actorId:'actor-1'};
 const first=await f.service.post(input),replay=await f.service.post(input);
 assert.equal(first.id,replay.id);
 assert.equal(first.partyKind,'AGENT');
 assert.equal(first.status,'POSTED');
 assert.deepEqual(f.journals[0]?.lines,[{accountId:'cash-gl',debit:'25'},{accountId:'agent-ar',credit:'25',partyId:'agent-party'}]);
 assert.equal(f.journals.length,1);
 await assert.rejects(()=>f.service.post({...input,amount:amount('26')}),/conflicting/i);
});

test('advance refund payment debits party advance liability and credits treasury',async()=>{
 const f=await fixture();
 const result=await f.service.post({id:'customer-refund',companyId:company,branchId:'branch-1',treasuryId:'cash',kind:'PAYMENT',partyKind:'CUSTOMER',partyId:'customer-party',number:'RF-1',postingDate:'2026-09-29',currency:'EGP',amount:amount('10'),offsetAccountId:'customer-advance',sourceType:'CRM_CUSTOMER_ADVANCE_REFUND_CASH',sourceId:'refund-1',actorId:'actor-1'});
 assert.equal(result.status,'POSTED');
 assert.deepEqual(f.journals[0]?.lines,[{accountId:'customer-advance',debit:'10',partyId:'customer-party'},{accountId:'cash-gl',credit:'10'}]);
});

test('payment requiring approval fails closed and accepts only exact approved evidence',async()=>{
 const f=await fixture(true);
 const input={id:'agent-refund',companyId:company,branchId:'branch-1',treasuryId:'cash',kind:'PAYMENT' as const,partyKind:'AGENT' as const,partyId:'agent-party',number:'RF-2',postingDate:'2026-09-29',currency:'EGP',amount:amount('60'),offsetAccountId:'agent-advance',sourceType:'CRM_AGENT_ADVANCE_REFUND_CASH',sourceId:'refund-2',actorId:'actor-1'};
 await assert.rejects(()=>f.service.post(input),/approval/i);
 f.approvals.set('approval-1',{request:{id:'approval-1',companyId:company,branchId:'branch-1',action:'PAYMENT',sourceType:input.sourceType,sourceId:input.sourceId,requesterActorId:'actor-1',amount:amount('60'),status:'PENDING'},decision:{outcome:'APPROVED'}});
 const result=await f.service.post({...input,approvalRequestId:'approval-1'});
 assert.equal(result.status,'POSTED');
 assert.equal(result.approvalRequestId,'approval-1');
});
