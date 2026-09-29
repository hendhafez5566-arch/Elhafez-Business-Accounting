import test from 'node:test';
import assert from 'node:assert/strict';
import {companyId,decimalAmount} from '@elhafez/contracts';
import {PartyCashMovementApplicationService} from './application/party-cash-movement.application-service.js';
import {InMemoryTreasuryRepository} from './infrastructure/in-memory-treasury.repository.js';

const company=companyId('11111111-1111-4111-8111-111111111111');
const amount=(value:string)=>decimalAmount(value);
type LedgerPort=ConstructorParameters<typeof PartyCashMovementApplicationService>[1];
type ControlsPort=ConstructorParameters<typeof PartyCashMovementApplicationService>[2];
type Journal=Awaited<ReturnType<LedgerPort['post']>>;
type PostingInput=Parameters<LedgerPort['post']>[0];
type ApprovalRequest=NonNullable<Awaited<ReturnType<ControlsPort['getApprovalRequest']>>>;
type ApprovalDecision=NonNullable<Awaited<ReturnType<ControlsPort['getApprovalDecision']>>>;

async function fixture(required=false){
 const repo=new InMemoryTreasuryRepository(),journals:PostingInput[]=[];
 await repo.saveTreasury({id:'cash',companyId:company,code:'CASH',name:'Cash',type:'CASH',currency:'EGP',glAccountId:'cash-gl',active:true});
 await repo.savePolicy({companyId:company,allowNegative:true});
 const approvals=new Map<string,{request:ApprovalRequest;decision:ApprovalDecision}>();
 const controls:ControlsPort={
  evaluateApprovalRequirement:async()=>required?{decision:'APPROVAL_REQUIRED',policyId:'policy-payment',threshold:amount('50'),forbidSelfApproval:true,requiredAuthority:'approve.payment'}:{decision:'APPROVAL_NOT_REQUIRED'},
  getApprovalRequest:async(_companyId,id)=>approvals.get(id)?.request,
  getApprovalDecision:async(_companyId,id)=>approvals.get(id)?.decision,
 };
 const gl:LedgerPort={
  async post(input){
   journals.push(input);
   const journal:Journal={...input,kind:input.kind??'STANDARD',requestHash:`test:${input.id}`,lines:input.lines.map((line,index)=>({...line,id:`${input.id}:${index+1}`}))};
   return journal;
  },
 };
 return{repo,journals,approvals,service:new PartyCashMovementApplicationService(repo,gl,controls)};
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
 f.approvals.set('approval-1',{
  request:{id:'approval-1',companyId:company,branchId:'branch-1',action:'PAYMENT',sourceType:input.sourceType,sourceId:input.sourceId,requesterActorId:'actor-1',amount:amount('60'),status:'APPROVED',policyId:'policy-payment',policyThresholdSnapshot:amount('50'),policyForbidSelfApprovalSnapshot:true,policyRequiredAuthoritySnapshot:'approve.payment',requestedAt:'2026-09-29T00:00:00.000Z'},
  decision:{id:'decision-1',requestId:'approval-1',companyId:company,outcome:'APPROVED',actorId:'approver-1',decidedAt:'2026-09-29T00:05:00.000Z'},
 });
 const result=await f.service.post({...input,approvalRequestId:'approval-1'});
 assert.equal(result.status,'POSTED');
 assert.equal(result.approvalRequestId,'approval-1');
});
