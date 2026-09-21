import assert from 'node:assert/strict';
import test from 'node:test';
import { executionContext } from '@elhafez/contracts';
import { NestFactory } from '@nestjs/core';
import { SupplierEvaluationApplicationService } from '@elhafez/supplier-evaluation';
import { SupplierDisputesApplicationService } from '@elhafez/supplier-disputes';
import { AppModule } from './app.module.js';
import { SupplierIntelligenceReadModelController, SUPPLIER_INTELLIGENCE_PERMISSIONS } from './supplier-intelligence-read-model.controller.js';
import { SupplierIntelligenceReadModelService } from './supplier-intelligence-read-model.service.js';

test('Supplier 360 composes public owner APIs and excludes bank data', async () => {
  const context = executionContext('co', 'br', 'actor');
  const supplier = { supplier:{supplierCode:'SUP-1',status:'ACTIVE',approvalStatus:'APPROVED',defaultCurrency:'EGP',creditDays:0,contactPerson:null,notes:null}, party:{id:'party-1',displayName:'Supplier'}, categories:['HOTEL'] };
  const evaluations=[{id:'e1',version:1,qualityScore:5,serviceScore:4,notes:null,evaluatedAt:'2026-09-21T00:00:00Z'}];
  const disputes=[{id:'d1',status:'OPEN',severity:'CRITICAL'}];
  const service = new SupplierIntelligenceReadModelService(
    { listForIntegration:async()=>[supplier], supplierViewForIntegration:async()=>supplier, holdStateForIntegration:async()=>({isHeld:true,activeHolds:[{id:'h1',sourceType:'SUPPLIER_DISPUTE',sourceId:'d1',reason:'critical',createdAt:'2026-09-21T00:00:00Z'}]}) } as never,
    { latestForIntegration:async()=>evaluations[0], listForIntegration:async()=>evaluations } as never,
    { listForIntegration:async()=>disputes } as never,
    { supplierPerformanceMetricsForIntegration:async()=>({poCount:2,cancelledPoCount:0,orderedQuantity:'10',receivedQuantity:'8',completionRatio:'0.8',completedPoCount:1}) } as never,
    { supplierTimingMetricsForIntegration:async()=>({fulfillmentCorrectionCount:1,onTimeCompletedCount:1,lateCompletedCount:0,unclassifiedTimingCount:0}) } as never,
  );
  const result=await service.overview(context,'party-1');
  assert.equal(result.supplier.supplierCode,'SUP-1');
  assert.equal(result.procurementMetrics.receivedQuantity,'8');
  assert.equal(result.disputes.open.length,1);
  assert.equal(result.holds.isHeld,true);
  assert.equal('bankAccounts' in result.supplier,false);
  assert.equal('iban' in result.supplier,false);
});

test('Supplier Intelligence controller resolves currentUser and enforces branch/read permissions', async () => {
  const permissions:string[]=[];let token='';let actor='';
  const platform={currentUser:async(value:string)=>{token=value;return{id:'user-1'};},requireBranchAccess:async(value:string)=>{actor=value;},authorize:async(_u:string,p:string)=>{permissions.push(p);}};
  const service={searchSuppliers:async()=>[]};
  const controller=new SupplierIntelligenceReadModelController(service as never,platform as never);
  await controller.search('Bearer real-session','co','br',undefined);
  assert.equal(token,'real-session');
  assert.equal(actor,'user-1');
  assert.deepEqual(permissions,[SUPPLIER_INTELLIGENCE_PERMISSIONS.read]);
});

test('real Nest composition registers SP-03 services', async () => {
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  assert.ok(app.get(SupplierEvaluationApplicationService));
  assert.ok(app.get(SupplierDisputesApplicationService));
  await app.close();
});
