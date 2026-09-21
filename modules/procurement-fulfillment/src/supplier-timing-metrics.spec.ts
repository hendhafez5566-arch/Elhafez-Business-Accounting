import assert from'node:assert/strict';
import test from'node:test';
import{companyId,decimalAmount,type CompanyId}from'@elhafez/contracts';
import type{PurchaseOrder}from'@elhafez/procurement-finance';
import{ProcurementFulfillmentApplicationService}from'./application/procurement-fulfillment.application-service.js';
import{InMemoryProcurementFulfillmentRepository}from'./infrastructure/in-memory-procurement-fulfillment.repository.js';
const company=companyId('company-a');
function purchaseOrder(id:string,expectedDate?:string):PurchaseOrder{return{id,companyId:company,branchId:'branch-a',supplierId:'party-a',number:id,origin:'AUTO',status:'RECEIVED',...(expectedDate?{expectedDate}:{}),requestHash:id,createdAt:'2026-09-01T00:00:00Z',lines:[{id:id+'-line',companyId:company,purchaseOrderId:id,itemReference:'x',orderedQuantity:decimalAmount('10'),receivedQuantity:decimalAmount('10'),invoicedQuantity:decimalAmount('0')}]};}
const orders=[purchaseOrder('on-time','2026-09-10'),purchaseOrder('late','2026-09-01'),purchaseOrder('no-date'),purchaseOrder('no-evidence','2026-09-10')];
const procurement={purchaseOrdersForSupplierMetricsForIntegration:async(...args:[CompanyId,string,string])=>{assert.equal(args[0],company);assert.equal(args[1],'branch-a');assert.equal(args[2],'party-a');return orders;}};
test('timing classification uses latest sufficient applied receipt evidence and never fabricates completion from corrections',async()=>{
 const repo=new InMemoryProcurementFulfillmentRepository(),service=new ProcurementFulfillmentApplicationService(repo,procurement as never,{} as never);
 async function applied(id:string,purchaseOrderId:string,kind:'RECEIPT'|'CORRECTION',result:string,at:string){
  await repo.reserve({id,companyId:company,branchId:'branch-a',purchaseOrderId,lineId:purchaseOrderId+'-line',supplierId:'party-a',kind,status:'PENDING',requestedQuantity:decimalAmount(result),attachmentIds:[],actorId:'actor',requestHash:id,createdAt:at});
  await repo.complete(company,id,decimalAmount('0'),decimalAmount(result),at);
 }
 await applied('r1','on-time','RECEIPT','10','2026-09-09T12:00:00Z');
 await applied('c2','on-time','CORRECTION','10','2026-09-11T12:00:00Z');
 await applied('r2','late','RECEIPT','10','2026-09-02T12:00:00Z');
 await applied('r3','no-date','RECEIPT','10','2026-09-02T12:00:00Z');
 await applied('c1','no-evidence','CORRECTION','10','2026-09-02T12:00:00Z');
 const metrics=await service.supplierTimingMetricsForIntegration(company,'branch-a','party-a');
 assert.deepEqual(metrics,{fulfillmentCorrectionCount:2,onTimeCompletedCount:1,lateCompletedCount:1,unclassifiedTimingCount:2});
 assert.deepEqual(await service.supplierTimingMetricsForIntegration(company,'branch-a','party-a'),metrics);
});
