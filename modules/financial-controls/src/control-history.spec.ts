import assert from'node:assert/strict';
import test from'node:test';
import{FinancialControlsApplicationService,type TrustedAuthorizationPort}from'./application/financial-controls.application-service.js';
import{InMemoryFinancialControlsRepository}from'./infrastructure/in-memory-financial-controls.repository.js';

class Authorization implements TrustedAuthorizationPort{async canApprove(){return false}async canAccessBranch(){return true}async canResolveControlIssue(){return false}}
function fixture(){const repository=new InMemoryFinancialControlsRepository();return{repository,service:new FinancialControlsApplicationService(repository,new Authorization())};}

test('reconciliation and close-readiness histories stay company and branch scoped',async()=>{
 const{service}=fixture();
 await service.evaluateIntegrity({id:'run-b1',companyId:'company-a',branchId:'branch-1',correlationId:'r-b1',runAt:'2026-09-29T10:00:00.000Z',comparisons:[{key:'cash',sourceAmount:'10',ledgerAmount:'10'}]});
 await service.evaluateIntegrity({id:'run-b2',companyId:'company-a',branchId:'branch-2',correlationId:'r-b2',runAt:'2026-09-29T11:00:00.000Z',comparisons:[{key:'cash',sourceAmount:'10',ledgerAmount:'9'}]});
 await service.evaluateIntegrity({id:'run-other',companyId:'company-b',branchId:'branch-1',correlationId:'r-other',runAt:'2026-09-29T12:00:00.000Z',comparisons:[{key:'cash',sourceAmount:'1',ledgerAmount:'1'}]});
 await service.evaluateCloseReadiness({id:'close-b1',companyId:'company-a',branchId:'branch-1',correlationId:'c-b1',evaluatedAt:'2026-09-29T10:30:00.000Z',checks:[{key:'integrity',passed:true,severity:'BLOCKER',detail:'clean'}]});
 await service.evaluateCloseReadiness({id:'close-b2',companyId:'company-a',branchId:'branch-2',correlationId:'c-b2',evaluatedAt:'2026-09-29T11:30:00.000Z',checks:[{key:'integrity',passed:false,severity:'BLOCKER',detail:'mismatch'}]});
 assert.deepEqual((await service.listReconciliationRuns('company-a','branch-1')).map(row=>row.id),['run-b1']);
 assert.deepEqual((await service.listCloseReadinessRuns('company-a','branch-1')).map(row=>row.id),['close-b1']);
 assert.equal((await service.listReconciliationRuns('company-a')).length,2);
 assert.equal((await service.listCloseReadinessRuns('company-b')).length,0);
});
