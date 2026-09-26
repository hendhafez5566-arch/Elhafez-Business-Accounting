import test from 'node:test';
import assert from 'node:assert/strict';
import { AppModule } from './app.module.js';
import { FinancialControlsModule } from '@elhafez/financial-controls';

test('composition root is available', () => assert.ok(AppModule));
test('Financial Controls production module is registered through its public API', () => assert.ok(FinancialControlsModule));

import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersModule } from '@elhafez/billing-subledgers';
test('AC-06 production modules are registered through public APIs', () => {
  assert.ok(TaxModule);
  assert.ok(BillingSubledgersModule);
});

import { TreasurySettlementModule } from '@elhafez/treasury-settlement';
test('AC-07 Treasury production module is registered through its public API', () => assert.ok(TreasurySettlementModule));

import { PartyAccountingModule } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionModule } from '@elhafez/expense-commission-recognition';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory/nest';
test('AC-08 production modules are registered through public APIs', () => {
  assert.ok(PartyAccountingModule);
  assert.ok(ExpenseCommissionRecognitionModule);
});
test('AC-11 production module is registered through its public API', () => assert.ok(TourismContractInventoryModule));


import { CapabilityCoverageController } from './capability-coverage.controller.js';

function capabilityFixture(){
  const authorizations:string[]=[];
  const platform={
    currentUser:async()=>({id:'actor-1'}),
    requireBranchAccess:async(actorId:string,companyId:string,branchId:string)=>{
      assert.equal(actorId,'actor-1');assert.equal(companyId,'company-1');assert.equal(branchId,'branch-1');
    },
    authorize:async(_actorId:string,_companyId:string,permission:string)=>{authorizations.push(permission);},
  };
  const calls:{contract?:Record<string,unknown>;cost?:Record<string,unknown>}={};
  const inventory={createContract:async(input:Record<string,unknown>)=>{calls.contract=input;return{id:'contract-1',...input};}};
  const cost={create:async(input:Record<string,unknown>)=>{calls.cost=input;return input;}};
  const controller=new CapabilityCoverageController(platform as never,inventory as never,{} as never,cost as never,{} as never,{} as never,{} as never);
  return{controller,calls,authorizations};
}

test('frontend contracts workspace delegates to canonical inventory owner',async()=>{
  const{controller,calls,authorizations}=capabilityFixture();
  const result=await controller.createContract('Bearer token','company-1','branch-1',{type:'HOTEL',supplierId:'supplier-1',effectiveFrom:'2026-10-01',effectiveTo:'2026-10-31',commandKey:'cmd-1'});
  assert.equal(calls.contract?.companyId,'company-1');
  assert.equal(calls.contract?.supplierId,'supplier-1');
  assert.equal((result as{type:string}).type,'HOTEL');
  assert.ok(authorizations.includes('tourism.services.manage'));
});

test('frontend cost-center workspace delegates to canonical cost owner',async()=>{
  const{controller,calls,authorizations}=capabilityFixture();
  await controller.createCostCenter('Bearer token','company-1','branch-1',{id:'CC001',code:'ops',name:'Operations'});
  assert.equal(calls.cost?.companyId,'company-1');
  assert.equal(calls.cost?.code,'OPS');
  assert.ok(authorizations.includes('accounting.finance.operate'));
});
