import assert from'node:assert/strict';
import test from'node:test';
import{BadRequestException}from'@nestjs/common';
import{FinancialReportingController}from'./financial-reporting.controller.js';

function fixture(){
 const scopes:unknown[]=[];
 const platform={currentUser:async()=>({id:'user-a'}),requireBranchAccess:async()=>{},authorize:async()=>{}};
 const reporting={
  trialBalance:async(scope:unknown)=>{scopes.push(scope);return{kind:'tb'}},
  incomeStatement:async(scope:unknown)=>{scopes.push(scope);return{kind:'is'}},
  balanceSheet:async(scope:unknown)=>{scopes.push(scope);return{kind:'bs'}},
  aging:async(scope:unknown,side:string)=>{scopes.push({scope,side});return{side,positions:[]}},
  treasury:async(scope:unknown)=>{scopes.push(scope);return{totals:[]}},
  tax:async(scope:unknown)=>{scopes.push(scope);return{totals:[]}},
  getProgramAccountingSnapshot:async(scope:unknown,id:string)=>{scopes.push({scope,id});return{programId:id,byCurrency:[]}},
  supplier:async(scope:unknown)=>{scopes.push(scope);return{facts:[]}},
 };
 return{scopes,controller:new FinancialReportingController(reporting as never,platform as never)};
}

test('scoped reporting always derives company and branch from authenticated execution context',async()=>{
 const f=fixture();
 await f.controller.statements('Bearer token','company-a','branch-a','2026-09-01','2026-09-29');
 assert.equal(f.scopes.length,3);
 for(const scope of f.scopes)assert.deepEqual(scope,{companyId:'company-a',branchIds:['branch-a'],from:'2026-09-01',to:'2026-09-29'});
});

test('aging validates side and preserves canonical branch scope',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.controller.aging('Bearer token','company-a','branch-a','INVALID'),BadRequestException);
 const result=await f.controller.aging('Bearer token','company-a','branch-a','SUPPLIER',undefined,undefined,'2026-09-29');
 assert.equal(result.side,'SUPPLIER');
 assert.deepEqual(f.scopes.at(-1),{scope:{companyId:'company-a',branchIds:['branch-a'],asOf:'2026-09-29'},side:'SUPPLIER'});
});

test('report scope rejects malformed non-existent and inverted dates',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.controller.treasury('Bearer token','company-a','branch-a','2026-02-31'),BadRequestException);
 await assert.rejects(()=>f.controller.tax('Bearer token','company-a','branch-a','29/09/2026'),BadRequestException);
 await assert.rejects(()=>f.controller.statements('Bearer token','company-a','branch-a','2026-09-30','2026-09-01'),BadRequestException);
});
