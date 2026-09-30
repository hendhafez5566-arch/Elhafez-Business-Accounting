import test from'node:test';
import assert from'node:assert/strict';
import{AccountingWorkspaceController}from'./accounting-workspace.controller.js';

function build(input:{pending?:boolean;issue?:boolean;yearStatus?:'OPEN'|'CLOSED';voucherBranch?:string}={}){
 const calls={set:[]as string[],readiness:0,approvalBranches:[]as Array<string|undefined>,issueBranches:[]as Array<string|undefined>,posts:[]as Record<string,unknown>[],drafts:[]as Record<string,unknown>[],matches:[]as string[],cheques:[]as Record<string,unknown>[]};
 const periods=[{id:'p1',companyId:'c1',fiscalYearId:'fy1',startDate:'2026-01-01',endDate:'2026-01-31',status:'OPEN' as'OPEN'|'CLOSED'}];
 const years=[{id:'fy1',companyId:'c1',startDate:'2026-01-01',endDate:'2026-12-31',status:input.yearStatus??'OPEN' as'OPEN'|'CLOSED'}];
 const platform={currentUser:async()=>({id:'u1'}),requireBranchAccess:async()=>undefined,authorize:async()=>undefined};
 const periodOwner={listPeriods:async()=>periods,listFiscalYears:async()=>years,setPeriodStatus:async(_c:string,id:string,status:'OPEN'|'CLOSED')=>{calls.set.push(`${id}:${status}`);periods[0]!.status=status;}};
 const ledger={post:async(value:Record<string,unknown>)=>{calls.posts.push(value);return{id:'j1'};},activity:async()=>[],listAccounts:async()=>[]};
 const billing={listInvoices:async()=>[],createDraft:async(value:Record<string,unknown>)=>{calls.drafts.push(value);return{id:'inv1'};},postInvoice:async()=>({id:'inv1'}),getInvoice:async()=>undefined};
 const vouchers=[{id:'v1',branchId:input.voucherBranch??'b1',status:'POSTED',currency:'EGP'}];
 const treasury={listTreasuries:async()=>[],listVouchers:async()=>vouchers,manualMatch:async(_c:string,line:string,voucher:string)=>{calls.matches.push(`${line}:${voucher}`);return{id:'m1'};},issueCheque:async(value:Record<string,unknown>)=>{calls.cheques.push(value);return value;}};
 const controls={listApprovalPolicies:async()=>[],listApprovalRequests:async(_c:string,b?:string)=>{calls.approvalBranches.push(b);return input.pending?[{status:'PENDING'}]:[];},listControlIssues:async(_c:string,b?:string)=>{calls.issueBranches.push(b);return input.issue?[{}]:[];},evaluateCloseReadiness:async(value:{checks:{passed:boolean;key:string;detail:string}[]})=>{calls.readiness++;const blockers=value.checks.filter(check=>!check.passed);return{ready:blockers.length===0,blockers,warnings:[{key:'W',detail:'تنبيه'}]};}};
 const reporting={trialBalance:async()=>({}),incomeStatement:async()=>({}),balanceSheet:async()=>({}),treasury:async()=>({}),tax:async()=>({})};
 const chequeRead={list:async()=>[{id:'ch1',voucherId:'v1'}]};
 const controller=new AccountingWorkspaceController(platform as never,periodOwner as never,ledger as never,billing as never,treasury as never,{}as never,controls as never,reporting as never,undefined,undefined,chequeRead as never);
 return{controller,calls,periods};
}
const H=['Bearer token','c1','b1']as const;

test('period close evaluates company-wide blockers and never mutates when blocked',async()=>{
 const{controller,calls}=build({pending:true});
 const result=await controller.closePeriod(...H,'p1',{commandKey:'k1'});
 assert.equal(result.closed,false);assert.deepEqual(calls.set,[]);assert.equal(calls.readiness,1);
 assert.deepEqual(calls.approvalBranches,[undefined]);assert.deepEqual(calls.issueBranches,[undefined]);
});

test('ready period closes once and preserves warnings; replay creates no new evidence',async()=>{
 const{controller,calls}=build();
 const first=await controller.closePeriod(...H,'p1',{commandKey:'k1'});assert.equal(first.closed,true);assert.equal(first.warnings.length,1);assert.deepEqual(calls.set,['p1:CLOSED']);
 const second=await controller.closePeriod(...H,'p1',{commandKey:'k1'});assert.equal(second.alreadyClosed,true);assert.equal(calls.readiness,1);assert.deepEqual(calls.set,['p1:CLOSED']);
});

test('legacy status route cannot close and period reopen is blocked while fiscal year is closed',async()=>{
 const a=build();await assert.rejects(()=>a.controller.setPeriodStatus(...H,'p1',{status:'CLOSED'}));assert.deepEqual(a.calls.set,[]);
 const b=build({yearStatus:'CLOSED'});b.periods[0]!.status='CLOSED';await assert.rejects(()=>b.controller.reopenPeriod(...H,'p1'),/reopen the fiscal year/);assert.deepEqual(b.calls.set,[]);
});

test('opening balance workflows route to canonical GL and Billing owners',async()=>{
 const{controller,calls}=build();
 await controller.postOpeningBalances(...H,{commandKey:'gl1',number:'O1',postingDate:'2026-01-01',lines:[{accountId:'cash',debit:'10'},{accountId:'eq',credit:'10'}]});
 assert.equal(calls.posts[0]!.kind,'OPENING');assert.equal(calls.posts[0]!.branchId,'b1');
 await controller.postCustomerOpeningBalance(...H,{commandKey:'ar1',partyId:'cust1',number:'AR-O1',postingDate:'2026-01-01',currency:'EGP',controlAccountId:'ar',lines:[{accountId:'eq',amount:'10'}]});
 assert.equal(calls.drafts[0]!.type,'OPENING_CUSTOMER_BALANCE');assert.equal(calls.drafts[0]!.branchId,'b1');
});

test('manual bank match and cheque operations enforce current voucher branch',async()=>{
 const good=build();await good.controller.manualMatchBankLine(...H,'line1',{voucherId:'v1'});assert.deepEqual(good.calls.matches,['line1:v1']);
 await good.controller.issueCheque(...H,{commandKey:'ch',voucherId:'v1',direction:'OUTGOING',number:'1',amount:'10',currency:'EGP',issueDate:'2026-01-01'});assert.equal(good.calls.cheques.length,1);
 const bad=build({voucherBranch:'b2'});await assert.rejects(()=>bad.controller.manualMatchBankLine(...H,'line1',{voucherId:'v1'}),/current branch/);await assert.rejects(()=>bad.controller.issueCheque(...H,{commandKey:'ch',voucherId:'v1',direction:'OUTGOING',number:'1',amount:'10',currency:'EGP',issueDate:'2026-01-01'}),/current branch/);
});
