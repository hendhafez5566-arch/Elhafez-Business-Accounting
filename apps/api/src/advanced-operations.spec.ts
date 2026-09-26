import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformError } from '@elhafez/platform-core';
import { AdvancedOperationsController } from './advanced-operations.controller.js';

function fixture(permissions:Record<string,boolean>={}){
  const calls:{permissions:string[];currency?:Record<string,unknown>;contractCompany?:string}={permissions:[]};
  const platform={
    currentUser:async()=>({id:'user-a'}),
    requireBranchAccess:async()=>{},
    authorize:async(_user:string,_company:string,permission:string)=>{
      calls.permissions.push(permission);
      if(permissions[permission]===false)throw new PlatformError('FORBIDDEN','permission denied');
    },
  };
  const fx={
    configure:async(input:Record<string,unknown>)=>{calls.currency=input;return input;},
    getBaseCurrency:async()=>({code:'EGP'}),
    publishRate:async(input:Record<string,unknown>)=>input,
    resolveRate:async()=>({rate:'50'}),
  };
  const costs={create:async(x:unknown)=>x,get:async()=>({}),deactivate:async()=>({}),createBudget:async(x:unknown)=>x,authorizeBudget:async()=>({}),checkBudget:async()=>({})};
  const parties={createGroup:async(x:unknown)=>x,proposeNetting:async(x:unknown)=>x,executeNetting:async()=>({}),reverseNetting:async()=>({})};
  const ecr={createExpense:async(x:unknown)=>x,postPaidExpense:async()=>({}),createCommissionClaim:async(x:unknown)=>x,approveCommission:async()=>({}),payCommission:async()=>({})};
  const assets={registerAsset:async(x:unknown)=>x,postDepreciation:async()=>({}),originateLoan:async(x:unknown)=>x,payLoanInstallment:async()=>({})};
  const inventory={
    createContract:async(input:{companyId:string})=>{calls.contractCompany=input.companyId;return input;},
    getContract:async()=>({id:'contract-a'}),getContractVersions:async()=>[],
    amendContract:async()=>({}),createHotelInventory:async()=>({}),createFlightBlock:async()=>({}),
    createTransportCapacity:async()=>({}),createVisaQuota:async()=>({}),createGenericService:async()=>({}),
    checkAvailability:async()=>({available:true,availableQuantity:'1'}),allocateCapacity:async()=>({}),
    getAllocation:async()=>({}),releaseAllocation:async()=>({}),
  };
  return{calls,controller:new AdvancedOperationsController(platform as never,fx as never,costs as never,parties as never,ecr as never,assets as never,inventory as never)};
}

test('advanced accounting operations stay company scoped and require accounting operate permission',async()=>{
  const f=fixture();
  await f.controller.configureCurrency('Bearer token','company-a','branch-a',{code:'EGP',precision:2,isBase:true,status:'ACTIVE'});
  assert.equal(f.calls.currency?.companyId,'company-a');
  assert.ok(f.calls.permissions.includes('accounting.finance.operate'));
});

test('shared inventory accepts Tourism management permission and remains company scoped',async()=>{
  const f=fixture();
  await f.controller.createContract('Bearer token','company-a','branch-a',{type:'HOTEL',effectiveFrom:'2026-10-01',effectiveTo:'2026-10-10'});
  assert.equal(f.calls.contractCompany,'company-a');
  assert.equal(f.calls.permissions.at(-1),'tourism.services.manage');
});

test('shared inventory falls back to Hajj/Umrah permission without bypassing authorization',async()=>{
  const f=fixture({'tourism.services.view':false});
  const result=await f.controller.getContract('Bearer token','company-a','branch-a','contract-a');
  assert.equal((result.contract as {id:string}).id,'contract-a');
  assert.deepEqual(f.calls.permissions.slice(-2),['tourism.services.view','hajj_umrah.programs.view']);
});
