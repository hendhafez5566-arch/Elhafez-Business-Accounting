import assert from'node:assert/strict';
import test from'node:test';
import{AccountingWorkspaceController}from'./accounting-workspace.controller.js';

function fixture(positionBranch='branch-a'){
 const calls:{ledgerBranch?:string;requestBranch?:string;issueBranch?:string;posted?:Record<string,unknown>;transfer?:Record<string,unknown>;cashCount?:Record<string,unknown>;bankLine?:Record<string,unknown>;manualMatch?:Record<string,unknown>}={};
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
  listVouchers:async()=>[{id:'va',branchId:'branch-a'},{id:'vb',branchId:'branch-b'},{id:'legacy'}],
  listTransfers:async()=>[{id:'transfer-a',number:'T-1'}],
  listCashCounts:async()=>[{id:'count-a',treasuryId:'cash'}],
  listBankLines:async()=>[{id:'line-a',treasuryId:'bank',status:'UNMATCHED'}],
  getCheque:async(_company:string,id:string)=>({id,voucherId:id==='cheque-b'?'vb':'va',status:'ISSUED'}),
  postVoucher:async(input:Record<string,unknown>)=>{calls.posted=input;return input;},
  voidVoucher:async()=>{throw new Error('must not reverse cross-branch voucher');},
  transfer:async(input:Record<string,unknown>)=>{calls.transfer=input;return input;},
  issueCheque:async(input:Record<string,unknown>)=>input,
  transitionCheque:async(_company:string,id:string,status:string)=>({id,status}),
  recordCashCount:async(input:Record<string,unknown>)=>{calls.cashCount=input;return input;},
  importBankLine:async(input:Record<string,unknown>)=>{calls.bankLine=input;return input;},
  autoMatch:async(_company:string,id:string)=>({id,mode:'AUTO'}),
  manualMatch:async(_company:string,id:string,voucherId:string,actorId:string)=>{calls.manualMatch={id,voucherId,actorId};return calls.manualMatch;},
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


test('Accounting Workspace exposes legacy-parity treasury operations through the canonical treasury owner',async()=>{
 const f=fixture();
 assert.equal((await f.controller.treasuryTransfers('Bearer token','company-a','branch-a'))[0]?.id,'transfer-a');
 await f.controller.treasuryTransfer('Bearer token','company-a','branch-a',{commandKey:'transfer-1',sourceTreasuryId:'cash',destinationTreasuryId:'bank',amount:'25',postingDate:'2026-09-28',number:'T-1'});
 assert.equal(f.calls.transfer?.sourceTreasuryId,'cash');
 const cheque=await f.controller.issueTreasuryCheque('Bearer token','company-a','branch-a',{commandKey:'cheque-1',voucherId:'va',direction:'INCOMING',bankTreasuryId:'bank',number:'CH-1',amount:'25',currency:'EGP',issueDate:'2026-09-28'});
 assert.equal(cheque.voucherId,'va');
 assert.equal((await f.controller.transitionTreasuryCheque('Bearer token','company-a','branch-a',String(cheque.id),{status:'DEPOSITED'})).status,'DEPOSITED');
 await f.controller.treasuryCashCount('Bearer token','company-a','branch-a',{commandKey:'count-1',treasuryId:'cash',countedAmount:'100',countDate:'2026-09-28'});
 assert.equal(f.calls.cashCount?.treasuryId,'cash');
 await f.controller.importTreasuryBankLine('Bearer token','company-a','branch-a',{commandKey:'line-1',treasuryId:'bank',currency:'EGP',signedAmount:'25',valueDate:'2026-09-28',reference:'R-1'});
 assert.equal(f.calls.bankLine?.treasuryId,'bank');
 assert.equal((await f.controller.treasuryBankLines('Bearer token','company-a','branch-a','bank'))[0]?.id,'line-a');
 await f.controller.manualMatchTreasuryBankLine('Bearer token','company-a','branch-a','line-a',{voucherId:'va'});
 assert.equal(f.calls.manualMatch?.actorId,'user-a');
});

test('Accounting Workspace treasury parity endpoints keep branch isolation for voucher-backed operations',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.controller.issueTreasuryCheque('Bearer token','company-a','branch-a',{commandKey:'cheque-b',voucherId:'vb',direction:'OUTGOING',number:'CH-B',amount:'10',currency:'EGP',issueDate:'2026-09-28'}),/current branch/);
 await assert.rejects(()=>f.controller.treasuryCheque('Bearer token','company-a','branch-a','cheque-b'),/current branch/);
 await assert.rejects(()=>f.controller.manualMatchTreasuryBankLine('Bearer token','company-a','branch-a','line-a',{voucherId:'vb'}),/current branch/);
});
