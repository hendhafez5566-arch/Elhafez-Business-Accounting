import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalAmount} from '@elhafez/contracts';
import {CrmFinancialOperationsController} from './crm-financial-operations.controller.js';

type ApprovalInput={id:string;companyId:string;branchId:string;action:string;sourceType:string;sourceId:string;requesterActorId:string;amount:string};
function fixture(overrides:{receiptFails?:boolean;refundFails?:boolean;approvalRequired?:boolean}={}){
 const calls:{voids:string[];approval?:ApprovalInput}={voids:[]};
 const platform={currentUser:async()=>({id:'actor-1'}),requireBranchAccess:async()=>undefined,authorize:async()=>undefined};
 const receivables={
  listOpenInvoices:async()=>[{id:'invoice-1',companyId:'company-1',branchId:'branch-1',type:'AGENT',status:'POSTED',partyId:'party-1',number:'INV-1',postingDate:'2026-09-20',dueDate:'2026-09-30',currency:'EGP',sourceType:'TEST',sourceId:'invoice',requestHash:'hash',controlAccountId:'agent-ar',lines:[{id:'line',accountId:'revenue',amount:'100'}],baseTotal:'100',outstanding:'100',createdAt:'2026-09-20T00:00:00Z'}],
  listAvailableAdvances:async()=>[{id:'advance-1',companyId:'company-1',partyKind:'AGENT',partyId:'party-1',amount:'20',available:'20',sourceType:'RECEIPT',sourceId:'receipt'}],
  baseCurrency:async()=> 'EGP',
  createAndPostReceivableInvoice:async()=>({id:'invoice-created'}),
  applyReceipt:async()=>{if(overrides.receiptFails)throw new Error('billing allocation failed');return{id:'allocation-1'};},
  consumeAdvanceRefund:async()=>{if(overrides.refundFails)throw new Error('billing refund failed');return{id:'advance-1',available:'10'};},
 };
 const cash={post:async(input:{id:string;number:string})=>({id:input.id,number:input.number,status:'POSTED'})};
 const treasury={getTreasurySnapshot:async()=>({id:'cash',currency:'EGP'}),voidVoucher:async(_company:string,id:string)=>{calls.voids.push(id);return{id,status:'REVERSED'};}};
 const controls={
  evaluateApprovalRequirement:async()=>overrides.approvalRequired?{decision:'APPROVAL_REQUIRED',threshold:decimalAmount('50'),requiredAuthority:'approve.payment'}:{decision:'APPROVAL_NOT_REQUIRED'},
  requestApproval:async(input:ApprovalInput)=>{calls.approval=input;return{id:'approval-1',status:'PENDING'};},
  getApprovalDecision:async()=>undefined,
 };
 return{calls,controller:new CrmFinancialOperationsController(platform as never,receivables as never,cash as never,treasury as never,controls as never)};
}

const auth='Bearer token',company='company-1',branch='branch-1';

test('receipt orchestration compensates Treasury when Billing allocation fails',async()=>{
 const f=fixture({receiptFails:true});
 await assert.rejects(()=>f.controller.receipt(auth,company,branch,{commandKey:'cmd-receipt',partyKind:'AGENT',partyId:'party-1',invoiceId:'invoice-1',treasuryId:'cash',number:'RC-1',postingDate:'2026-09-29',amount:'25'}),/billing allocation failed/);
 assert.equal(f.calls.voids.length,1);
});

test('advance refund orchestration compensates Treasury when Billing consumption fails',async()=>{
 const f=fixture({refundFails:true});
 await assert.rejects(()=>f.controller.refund(auth,company,branch,{commandKey:'cmd-refund',partyKind:'AGENT',partyId:'party-1',advanceId:'advance-1',treasuryId:'cash',advanceAccountId:'agent-advance',number:'RF-1',postingDate:'2026-09-29',amount:'10'}),/billing refund failed/);
 assert.equal(f.calls.voids.length,1);
});

test('advance refund approval request is exact to PAYMENT source, command key and amount',async()=>{
 const f=fixture({approvalRequired:true});
 const result=await f.controller.requestRefundApproval(auth,company,branch,{commandKey:'cmd-approval',partyKind:'AGENT',amount:'60'});
 assert.equal(result.status,'PENDING');
 const request=f.calls.approval!;
 assert.equal(request.companyId,'company-1');
 assert.equal(request.branchId,'branch-1');
 assert.equal(request.action,'PAYMENT');
 assert.equal(request.sourceType,'CRM_AGENT_ADVANCE_REFUND_CASH');
 assert.equal(request.sourceId,'cmd-approval');
 assert.equal(request.requesterActorId,'actor-1');
 assert.equal(request.amount,'60');
 assert.equal(typeof request.id,'string');
 assert.equal(request.id.length,32);
});