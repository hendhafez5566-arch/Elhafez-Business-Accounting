import assert from'node:assert/strict';
import test from'node:test';
import{FinancialControlHistoryController}from'./financial-control-history.controller.js';

function fixture(){
 const calls:{reconciliation?:string;close?:string}={};
 const controls={listReconciliationRuns:async(_company:string,branch:string)=>{calls.reconciliation=branch;return[{id:'run-a',branchId:branch}]},listCloseReadinessRuns:async(_company:string,branch:string)=>{calls.close=branch;return[{id:'close-a',branchId:branch}]}};
 const platform={currentUser:async()=>({id:'user-a'}),requireBranchAccess:async()=>{},authorize:async()=>{},listAudit:async()=>[
  {id:'a1',branchId:'branch-a',companyId:'company-a',actorId:'u',action:'x',resource:'r',entityId:'1',metadata:{},occurredAt:new Date('2026-09-29T10:00:00Z')},
  {id:'a2',branchId:'branch-b',companyId:'company-a',actorId:'u',action:'y',resource:'r',entityId:'2',metadata:{},occurredAt:new Date('2026-09-29T11:00:00Z')},
  {id:'a3',branchId:'branch-a',companyId:'company-a',actorId:'u',action:'z',resource:'r',entityId:'3',metadata:{},occurredAt:new Date('2026-09-29T12:00:00Z')},
 ]};
 return{calls,controller:new FinancialControlHistoryController(controls as never,platform as never)};
}

test('financial control history is branch scoped and audit entries are newest first',async()=>{const f=fixture();const result=await f.controller.history('Bearer token','company-a','branch-a');assert.equal(f.calls.reconciliation,'branch-a');assert.equal(f.calls.close,'branch-a');assert.deepEqual(result.auditEntries.map(row=>row.id),['a3','a1']);assert.deepEqual(result.reconciliationRuns.map((row:{id:string})=>row.id),['run-a']);assert.deepEqual(result.closeReadinessRuns.map((row:{id:string})=>row.id),['close-a']);});
