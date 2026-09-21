import assert from'node:assert/strict';
import test from'node:test';
import{companyId,decimalAmount}from'@elhafez/contracts';
import{ProcurementFinanceApplicationService}from'./application/procurement-finance.application-service.js';
import{InMemoryProcurementRepository}from'./infrastructure/in-memory-procurement.repository.js';
const company=companyId('company-a'),otherCompany=companyId('company-b');
const suppliers={
 assertSupplierReferenceUsableForProcurementForIntegration:async(...args:[unknown,string])=>({partyId:args[1]==='legacy'?'party-a':args[1]}),
 resolveSupplierReferenceForIntegration:async(...args:[unknown,string])=>({partyId:args[1]==='legacy'?'party-a':args[1]}),
};
async function seed(repo:InMemoryProcurementRepository,id:string,branch:string,supplier:string,status:'APPROVED'|'CANCELLED'|'RECEIVED',ordered:string,received:string,owner=company){
 await repo.savePo({id,companyId:owner,branchId:branch,supplierId:supplier,number:id,origin:'AUTO',status,requestHash:id,createdAt:'2026-09-21T00:00:00Z',lines:[{id:id+'-line',companyId:owner,purchaseOrderId:id,itemReference:'x',orderedQuantity:decimalAmount(ordered),receivedQuantity:decimalAmount(received),invoicedQuantity:decimalAmount('0')}]},{id:id+'-history',companyId:owner,aggregateId:id,kind:'CREATED',createdAt:'2026-09-21T00:00:00Z'});
}
test('supplier procurement metrics cover counts quantities ratio completion exact-decimal and isolation',async()=>{
 const repo=new InMemoryProcurementRepository(),service=new ProcurementFinanceApplicationService(repo,{} as never,suppliers as never);
 await seed(repo,'po-a','branch-a','party-a','RECEIVED','0.1','0.1');
 await seed(repo,'po-b','branch-a','legacy','RECEIVED','0.2','0.2');
 await seed(repo,'po-c','branch-a','party-a','CANCELLED','9','0');
 await seed(repo,'po-d','branch-b','party-a','RECEIVED','100','100');
 await seed(repo,'po-e','branch-a','party-b','RECEIVED','100','100');
 await seed(repo,'po-f','branch-a','party-a','RECEIVED','1000','1000',otherCompany);
 const metrics=await service.supplierPerformanceMetricsForIntegration(company,'branch-a','party-a');
 assert.deepEqual(metrics,{poCount:3,cancelledPoCount:1,orderedQuantity:'0.3',receivedQuantity:'0.3',completionRatio:'1',completedPoCount:2});
});
