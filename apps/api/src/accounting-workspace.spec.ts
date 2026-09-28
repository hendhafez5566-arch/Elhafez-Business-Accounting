import assert from'node:assert/strict';
import test from'node:test';
import{AccountingWorkspaceController}from'./accounting-workspace.controller.js';

function fixture(positionBranch='branch-a'){
 const calls:{ledgerBranch?:string;requestBranch?:string;issueBranch?:string;posted?:Record<string,unknown>;cheque?:Record<string,unknown>;transition?:string}={};
 const platform={currentUser:async()=>({id:'user-a'}),requireBranchAccess:async()=>{},authorize:async()=>{}};
 const periods={listFiscalYears:async()=>[],listPeriods:async()=>[]};
 const ledger={listAccounts:async()=>[],activity:async(_company:string,branch?:string)=>{calls.ledgerBranch=branch;return[{id:'ja',branchId:'branch-a'},{id:'legacy'}];}};
 const billing={
  listInvoices:async()=>[{id:'ia',branchId:'branch-a'},{id:'ib',branchId:'branch-b'},{id:'legacy'}],
  getOpenPosition:async()=>({invoiceId:'invoice-a',companyId:'company-a',branchId:positionBranch,partyKind:'CUSTOMER',partyId:'party-a',invoiceType:'CUSTOMER',currency:'EGP',documentTotal:'100',outstanding:'100',baseTotal:'100',controlAccountId:'ar',status:'POSTED',postingDate:'2026-09-26',deferred:false}),
  getInvoice:async()=>({id:'invoice-b',branchId:'branch-b'}),
  cancelInvoice:async()=>{throw new Error('must not cancel cross-branch invoice');},
 };
 const treasury={
  listTreasuries:async()=>[],
  listVouchers:async()=>[{id:'va',branchId:'branch-a',status:'POSTED',kind:'RECEIPT',amount:'50',currency:'EGP'},{id:'vb',branchId:'branch-b',status:'POSTED',kind:'PAYMENT',amount:'10',currency:'EGP'},{id:'legacy'}],
  postVoucher:async(input:Record<string,unknown>)=>{calls.posted=input;return input;},
  voidVoucher:async()=>{throw new Error('must not reverse cross-branch voucher');},
  listCheques:async()=>[{id:'ca',voucherId:'va',status:'ISSUED'},{id:'cb',voucherId:'vb',status:'ISSUED'},{id:'cl',voucherId:'legacy',status:'ISSUED'}],
  getCheque:async(_company:string,id:string)=>({id,voucherId:id==='ca'?'va':id==='cb'?'vb':'legacy',status:'ISSUED'}),
  issueCheque:async(input:Record<string,unknown>)=>{calls.cheque=input;return input;},
  transitionCheque:async(_company:string,id:string)=>{calls.transition=id;return{id};},
 };
 const tax={listPolicies:async()=>[]};
 const controls={
  listApprovalPolicies:async()=>[],
  listApprovalRequests:async(_c:string,b?:string)=>{calls.requestBranch=b;return[{id:'ra',branchId:b}];},
  listControlIssues:async(_c:string,b?:string)=>{calls.issueBranch=b;return[{id:'ci',runId:'run'}];},
  getApprovalRequest:async()=>({id:'approval-b',branchId:'branch-b'}),
  decideApproval:async()=>{throw new Error('must not decide cross-branch approval');},
 };
 const reporting={trialBalance:async()=>({}),incomeStatement:async()=>({}),balanceSheet:async()=>({}),treasury:async()=>({}),tax:async()=>({})};
 return{calls,controller:new AccountingWorkspaceController(platform as never,periods as never,ledger as never,billing as never,treasury as never,tax as never,controls as never,reporting as never)};
}

test('Accounting Workspace overview exposes only current-branch operational records',async()=>{
 const f=fixture();
 const value=await f.controller.overview('Bearer token','company-a','branch-a');
 assert.deepEqual(value.invoices.map(x=>x.id),['ia']);
 assert.deepEqual(value.vouchers.map(x=>x.id),['va']);
 assert.equal(f.calls.ledgerBranch,'branch-a');
 assert.equal(f.calls.requestBranch,'branch-a');
 assert.equal(f.calls.issueBranch,'branch-a');
});

test('Accounting Workspace settlement targets the selected posted invoice exactly',async()=>{
 const f=fixture('branch-a');
 await f.controller.postSettlement('Bearer token','company-a','branch-a',{commandKey:'settle-a',invoiceId:'invoice-a',treasuryId:'cash',number:'R-1',postingDate:'2026-09-26',amount:'50'});
 assert.equal(f.calls.posted?.explicitPostedInvoiceId,'invoice-a');
 assert.equal(f.calls.posted?.branchId,'branch-a');
});

test('Accounting Workspace rejects cross-branch financial mutation targets',async()=>{
 const f=fixture('branch-b');
 await assert.rejects(()=>f.controller.postSettlement('Bearer token','company-a','branch-a',{commandKey:'settle-x',invoiceId:'invoice-b',treasuryId:'cash',number:'R-X',postingDate:'2026-09-26',amount:'10'}),/current branch/);
 await assert.rejects(()=>f.controller.cancelInvoice('Bearer token','company-a','branch-a','invoice-b',{postingDate:'2026-09-26',number:'C-1'}),/current branch/);
 await assert.rejects(()=>f.controller.reverseVoucher('Bearer token','company-a','branch-a','vb',{postingDate:'2026-09-26',number:'V-1'}),/current branch/);
 await assert.rejects(()=>f.controller.decideApproval('Bearer token','company-a','branch-a','approval-b',{outcome:'APPROVED'}),/current branch/);
});


test('cheque lifecycle is bound to the originating voucher branch',async()=>{
 const f=fixture();
 assert.deepEqual((await f.controller.cheques('Bearer token','company-a','branch-a')).map(x=>x.id),['ca']);
 await assert.rejects(()=>f.controller.cheque('Bearer token','company-a','branch-a','cb'),/current branch/);
 await assert.rejects(()=>f.controller.issueCheque('Bearer token','company-a','branch-a',{commandKey:'key-b',voucherId:'vb',direction:'INCOMING',number:'C-2',issueDate:'2026-09-26'}),/current branch/);
 await assert.rejects(()=>f.controller.transitionCheque('Bearer token','company-a','branch-a','cb',{status:'CLEARED'}),/current branch/);
 assert.equal(f.calls.cheque,undefined);assert.equal(f.calls.transition,undefined);
});

test('cheque issuance uses voucher amount and stable command identity',async()=>{
 const f=fixture();
 // A posted receipt from the current branch is the only source for the cheque amount and direction.
 const row=await f.controller.issueCheque('Bearer token','company-a','branch-a',{commandKey:'key-a',voucherId:'va',direction:'INCOMING',number:'C-1',issueDate:'2026-09-26'});
 assert.equal(row.voucherId,'va');assert.equal(row.direction,'INCOMING');
 const replay=await f.controller.issueCheque('Bearer token','company-a','branch-a',{commandKey:'key-a',voucherId:'va',direction:'INCOMING',number:'C-1',issueDate:'2026-09-26'});
 assert.equal(row.id,replay.id);
 await assert.rejects(()=>f.controller.issueCheque('Bearer token','company-a','branch-a',{commandKey:'key-a',voucherId:'va',direction:'OUTGOING',number:'C-1',issueDate:'2026-09-26'}),/direction/);
});
