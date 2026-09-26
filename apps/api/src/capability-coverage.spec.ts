import assert from'node:assert/strict';
import test from'node:test';
import{CapabilityCoverageController}from'./capability-coverage.controller.js';

function fixture(){
 const authorizations:string[]=[];
 const platform={
  currentUser:async()=>({id:'actor-1'}),
  requireBranchAccess:async(actorId:string,companyId:string,branchId:string)=>{assert.equal(actorId,'actor-1');assert.equal(companyId,'company-1');assert.equal(branchId,'branch-1');},
  authorize:async(_actorId:string,_companyId:string,permission:string)=>{authorizations.push(permission);},
 };
 const calls:{contract?:Record<string,unknown>;cost?:Record<string,unknown>}={};
 const inventory={createContract:async(input:Record<string,unknown>)=>{calls.contract=input;return{id:'contract-1',...input};}};
 const fx={};
 const cost={create:async(input:Record<string,unknown>)=>{calls.cost=input;return input;}};
 const controller=new CapabilityCoverageController(platform as never,inventory as never,fx as never,cost as never,{} as never,{} as never,{} as never);
 return{controller,calls,authorizations};
}

test('tourism contract UI delegates to canonical inventory owner with authenticated tenant context',async()=>{
 const{controller,calls,authorizations}=fixture();
 const result=await controller.createContract('Bearer token','company-1','branch-1',{type:'HOTEL',supplierId:'supplier-1',effectiveFrom:'2026-10-01',effectiveTo:'2026-10-31',commandKey:'cmd-1'});
 assert.equal(calls.contract?.companyId,'company-1');
 assert.equal(calls.contract?.supplierId,'supplier-1');
 assert.equal((result as{type:string}).type,'HOTEL');
 assert.ok(authorizations.includes('tourism.services.manage'));
});

test('cost center UI delegates to canonical cost owner under accounting operate permission',async()=>{
 const{controller,calls,authorizations}=fixture();
 await controller.createCostCenter('Bearer token','company-1','branch-1',{id:'CC001',code:'ops',name:'Operations'});
 assert.equal(calls.cost?.companyId,'company-1');
 assert.equal(calls.cost?.code,'OPS');
 assert.ok(authorizations.includes('accounting.finance.operate'));
});
