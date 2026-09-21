import assert from'node:assert/strict';
import test from'node:test';
import{companyId,executionContext}from'@elhafez/contracts';
import{supplierId,type SupplierProfile}from'./domain/supplier.js';
import type{SupplierAccess}from'./application/supplier-access.js';
import{SupplierManagementApplicationService}from'./application/supplier-management.application-service.js';
import{InMemorySupplierManagementRepository}from'./infrastructure/in-memory-supplier-management.repository.js';

class Access implements SupplierAccess{async requireBranch(){}async requirePermission(){}async audit(){}}
const company=companyId('company-a'),id=supplierId('supplier-a'),context=executionContext('company-a','branch-a','actor-a');
function profile(status:'ACTIVE'|'INACTIVE'='ACTIVE'):SupplierProfile{return{id,companyId:company,partyId:'party-a',supplierCode:'SUP-A',status,approvalStatus:'APPROVED',defaultCurrency:'EGP',creditDays:0,contactPerson:null,notes:null,createdAt:'2026-09-21T00:00:00Z',updatedAt:'2026-09-21T00:00:00Z'};}
async function setup(status:'ACTIVE'|'INACTIVE'='ACTIVE'){const repo=new InMemorySupplierManagementRepository();await repo.create(profile(status),[]);let n=0;const service=new SupplierManagementApplicationService(repo,{} as never,new Access(),()=>new Date('2026-09-21T00:00:00Z'),()=>('id-'+(++n)));return{repo,service};}

test('manual and dispute holds coexist and manual release cannot bypass dispute hold',async()=>{
 const s=await setup();await s.service.hold(context,id);await s.repo.ensureHold(company,id,'SUPPLIER_DISPUTE','d1','critical','actor','2026-09-21T00:00:01Z','hold-2');
 assert.equal((await s.repo.activeHolds(company,id)).length,2);assert.equal((await s.repo.find(company,id))?.status,'ON_HOLD');
 await s.service.releaseHold(context,id);assert.equal((await s.repo.find(company,id))?.status,'ON_HOLD');
 await assert.rejects(()=>s.service.releaseHold(context,id),/source-owned/);
 await assert.rejects(()=>s.service.assertSupplierReferenceUsableForProcurementForIntegration(company,'party-a'),/not approved and active/);
 await s.repo.releaseHoldSource(company,id,'SUPPLIER_DISPUTE','d1','resolved','actor','2026-09-21T00:00:02Z');
 assert.equal((await s.repo.find(company,id))?.status,'ACTIVE');
});

test('INACTIVE supplier is never activated by source hold release',async()=>{
 const s=await setup('INACTIVE');await s.repo.ensureHold(company,id,'SUPPLIER_DISPUTE','d1','critical','actor','2026-09-21T00:00:01Z','hold-1');
 assert.equal((await s.repo.find(company,id))?.status,'ON_HOLD');
 await s.repo.releaseHoldSource(company,id,'SUPPLIER_DISPUTE','d1','resolved','actor','2026-09-21T00:00:02Z');
 assert.equal((await s.repo.find(company,id))?.status,'INACTIVE');
});

test('duplicate and concurrent holds preserve any-active-hold invariant',async()=>{
 const s=await setup();
 const results=await Promise.all([
  s.repo.ensureHold(company,id,'SOURCE_A','1','a','actor','2026-09-21T00:00:01Z','h1'),
  s.repo.ensureHold(company,id,'SOURCE_B','2','b','actor','2026-09-21T00:00:01Z','h2'),
 ]);
 const replay=await s.repo.ensureHold(company,id,'SOURCE_A','1','a','actor','2026-09-21T00:00:03Z','different-id');
 assert.equal(replay.id,results[0]?.id);assert.equal((await s.repo.activeHolds(company,id)).length,2);
 await s.repo.releaseHoldSource(company,id,'SOURCE_A','1','one','actor','2026-09-21T00:00:04Z');assert.equal((await s.repo.find(company,id))?.status,'ON_HOLD');
 await s.repo.releaseHoldSource(company,id,'SOURCE_B','2','two','actor','2026-09-21T00:00:05Z');assert.equal((await s.repo.find(company,id))?.status,'ACTIVE');
});
