import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { executionContext } from '@elhafez/contracts';
import { NestFactory } from '@nestjs/core';
import { SupplierEvaluationApplicationService } from '@elhafez/supplier-evaluation';
import { SupplierDisputesApplicationService } from '@elhafez/supplier-disputes';
import { AppModule } from './app.module.js';
import { SupplierIntelligenceReadModelController, SUPPLIER_INTELLIGENCE_PERMISSIONS } from './supplier-intelligence-read-model.controller.js';
import { SupplierIntelligenceReadModelService } from './supplier-intelligence-read-model.service.js';

test('Supplier 360 composes public owner APIs, separates open/history disputes, and excludes bank data', async () => {
  const context = executionContext('co', 'br', 'actor');
  const supplier = { supplier:{supplierCode:'SUP-1',status:'ACTIVE',approvalStatus:'APPROVED',defaultCurrency:'EGP',creditDays:0,contactPerson:null,notes:null}, party:{id:'party-1',displayName:'Supplier'}, categories:['HOTEL'] };
  const evaluations=[{id:'e1',version:1,qualityScore:5,serviceScore:4,notes:null,evaluatedAt:'2026-09-21T00:00:00Z'}];
  const disputes=[
    {id:'d1',status:'OPEN',severity:'CRITICAL'},
    {id:'d2',status:'RESOLVED',severity:'HIGH'},
    {id:'d3',status:'CANCELLED',severity:'LOW'},
  ];
  const service = new SupplierIntelligenceReadModelService(
    { listForIntegration:async()=>[supplier], supplierViewForIntegration:async()=>supplier, holdStateForIntegration:async()=>({isHeld:true,activeHolds:[{id:'h1',sourceType:'SUPPLIER_DISPUTE',sourceId:'d1',reason:'critical',createdAt:'2026-09-21T00:00:00Z'}]}) } as never,
    { latestForIntegration:async()=>evaluations[0], listForIntegration:async()=>evaluations } as never,
    { listForIntegration:async()=>disputes } as never,
    { supplierPerformanceMetricsForIntegration:async()=>({poCount:2,cancelledPoCount:0,orderedQuantity:'10',receivedQuantity:'8',completionRatio:'0.8',completedPoCount:1}) } as never,
    { supplierTimingMetricsForIntegration:async()=>({fulfillmentCorrectionCount:1,onTimeCompletedCount:1,lateCompletedCount:0,unclassifiedTimingCount:0}) } as never,
  );
  const result=await service.overview(context,'party-1');
  assert.equal(result.supplier.supplierCode,'SUP-1');
  assert.deepEqual(result.supplier.categories,['HOTEL']);
  assert.equal(result.supplier.status,'ACTIVE');
  assert.equal(result.supplier.approvalStatus,'APPROVED');
  assert.equal(result.evaluation.latest?.id,'e1');
  assert.equal(result.evaluation.history.length,1);
  assert.equal(result.procurementMetrics.receivedQuantity,'8');
  assert.equal(result.disputes.open.length,1);
  assert.equal(result.disputes.history.length,3);
  assert.equal(result.holds.isHeld,true);
  assert.deepEqual(result.holds.criticalDisputeIds,['d1']);
  const serialized=JSON.stringify(result);
  assert.doesNotMatch(serialized,/bankAccounts|accountNumber|iban/i);
});

test('Supplier Intelligence controller resolves currentUser and enforces branch/read permissions', async () => {
  const permissions:string[]=[];let token='',actor='';
  const platform={
    currentUser:async(value:string)=>{token=value;return{id:'user-1'};},
    requireBranchAccess:async(value:string)=>{actor=value;},
    authorize:async(...args:[string,string])=>{assert.equal(args[0],'user-1');permissions.push(args[1]);},
  };
  const service={searchSuppliers:async()=>[],overview:async()=>({})};
  const controller=new SupplierIntelligenceReadModelController(service as never,platform as never);
  await controller.search('Bearer real-session','co','br',undefined);
  assert.equal(token,'real-session');
  assert.equal(actor,'user-1');
  assert.deepEqual(permissions,[SUPPLIER_INTELLIGENCE_PERMISSIONS.read]);
  permissions.length=0;
  await controller.overview('Bearer real-session','co','br','party-1');
  assert.deepEqual(permissions,[SUPPLIER_INTELLIGENCE_PERMISSIONS.read,SUPPLIER_INTELLIGENCE_PERMISSIONS.disputeRead]);
  await assert.rejects(()=>controller.search(undefined,'co','br',undefined),/authenticated company and branch context required/);
  await assert.rejects(()=>controller.search('Bearer real-session',undefined,'br',undefined),/authenticated company and branch context required/);
  await assert.rejects(()=>controller.search('Bearer real-session','co',undefined,undefined),/authenticated company and branch context required/);
});

test('Supplier Intelligence route metadata and real Nest composition register SP-03', async () => {
  const metadata=(Reflect as unknown as {getMetadata:(key:string,target:unknown)=>unknown}).getMetadata;
  assert.equal(metadata('path',SupplierIntelligenceReadModelController),'supplier-intelligence');
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  assert.ok(app.get(SupplierEvaluationApplicationService));
  assert.ok(app.get(SupplierDisputesApplicationService));
  assert.ok(app.get(SupplierIntelligenceReadModelService));
  await app.close();
});

test('SP-03 migration preserves legacy ON_HOLD suppliers without inventing branch identity', async () => {
  const sql=await readFile('../../prisma/migrations/20260921130000_sp03_supplier_evaluation_disputes/migration.sql','utf8');
  assert.match(sql,/LEGACY_MANUAL_HOLD/);
  assert.match(sql,/WHERE "status"='ON_HOLD'/);
  assert.match(sql,/"base_status".*ACTIVE/s);
  const insert=sql.slice(sql.indexOf('INSERT INTO "sm_supplier_holds"'),sql.indexOf('CREATE TABLE "se_supplier_evaluations"'));
  assert.doesNotMatch(insert,/branch_id/);
});
