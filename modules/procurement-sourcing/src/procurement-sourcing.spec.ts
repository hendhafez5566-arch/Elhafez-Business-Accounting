import assert from'node:assert/strict';
import test from'node:test';
import{decimalAmount,executionContext,type CompanyId,type ExecutionContext}from'@elhafez/contracts';
import type{PurchaseOrder}from'@elhafez/procurement-finance';
import type{ProcurementSourcingAccess}from'./application/procurement-sourcing.access.js';
import type{SourcingProcurementPort,SourcingSupplierPort}from'./application/procurement-sourcing.ports.js';
import{ProcurementSourcingApplicationService,PROCUREMENT_SOURCING_PERMISSIONS}from'./application/procurement-sourcing.application-service.js';
import{InMemoryProcurementSourcingRepository}from'./infrastructure/in-memory-procurement-sourcing.repository.js';

class Access implements ProcurementSourcingAccess{
 readonly permissions:string[]=[];readonly audits:string[]=[];
 async requireBranch(c:ExecutionContext){if(c.branchId==='blocked')throw new Error('branch denied');}
 async requirePermission(_c:ExecutionContext,p:string){this.permissions.push(p);}
 async auditOnce(_c:ExecutionContext,_key:string,action:string){this.audits.push(action);}
}
class Suppliers implements SourcingSupplierPort{
 unusable=new Set<string>();
 async assertUsable(_companyId:CompanyId,reference:string){if(this.unusable.has(reference))throw new Error('supplier is not approved and active for procurement');return{partyId:reference.startsWith('legacy-')?'party-'+reference:reference};}
}
class Procurement implements SourcingProcurementPort{
 readonly pos=new Map<string,PurchaseOrder>();calls=0;
 async createPurchaseOrder(input:Parameters<SourcingProcurementPort['createPurchaseOrder']>[0]){this.calls++;const current=this.pos.get(input.id);if(current)return current;const po:PurchaseOrder={...input,number:'PO-2026-000001',status:'DRAFT',requestHash:'sourcing',createdAt:'2026-09-28T00:00:00.000Z',lines:input.lines.map(line=>({...line,companyId:input.companyId,purchaseOrderId:input.id,receivedQuantity:decimalAmount('0'),invoicedQuantity:decimalAmount('0')}))};this.pos.set(po.id,po);return po;}
 async getPurchaseOrder(_companyId:CompanyId,_branchId:string,id:string){const po=this.pos.get(id);if(!po)throw new Error('po not found');return po;}
}
const ctx=executionContext('company-a','branch-a','actor-a');
function fixture(){let n=0;const repo=new InMemoryProcurementSourcingRepository(),suppliers=new Suppliers(),procurement=new Procurement(),access=new Access(),service=new ProcurementSourcingApplicationService(repo,suppliers,procurement,access,()=>new Date('2026-09-28T00:00:00Z'),()=> 'id-'+(++n));return{repo,suppliers,procurement,access,service};}
async function approvedRequisition(f=fixture()){const req=await f.service.createRequisition(ctx,{currency:'EGP',needByDate:'2026-10-10',lines:[{id:'line-1',itemReference:'HOTEL',quantity:'2',targetUnitPrice:'100'},{id:'line-2',itemReference:'BUS',quantity:'1'}]});await f.service.submitRequisition(ctx,req.id);const approved=await f.service.decideRequisition(ctx,req.id,'APPROVED','احتياج تشغيلي معتمد');return{...f,req:approved};}
async function openRfq(){const f=await approvedRequisition();let rfq=await f.service.createRfq(ctx,f.req.id,{responseDeadline:'2026-10-01'});rfq=await f.service.inviteSupplier(ctx,rfq.id,'party-s1');rfq=await f.service.inviteSupplier(ctx,rfq.id,'party-s2');rfq=await f.service.sendRfq(ctx,rfq.id);return{...f,rfq};}
function bid(supplierReference:string,p1:string,p2:string){return{supplierReference,currency:'EGP',deliveryDate:'2026-10-05',lines:[{requisitionLineId:'line-1',quantity:'2',unitPrice:p1},{requisitionLineId:'line-2',quantity:'1',unitPrice:p2}]};}

test('requisition lifecycle is branch scoped and approval is explicit',async()=>{const f=fixture(),req=await f.service.createRequisition(ctx,{currency:'EGP',lines:[{itemReference:'ROOM',quantity:'1'}]});assert.equal(req.number,'PR-000001');await assert.rejects(()=>f.service.decideRequisition(ctx,req.id,'APPROVED','x'),/submitted/);await f.service.submitRequisition(ctx,req.id);const approved=await f.service.decideRequisition(ctx,req.id,'APPROVED','approved');assert.equal(approved.status,'APPROVED');assert.equal(approved.approvedBy,'actor-a');await assert.rejects(()=>f.service.getRequisition(executionContext('company-a','other','actor-a'),req.id),/not found/);assert.ok(f.access.permissions.includes(PROCUREMENT_SOURCING_PERMISSIONS.approve));});

test('RFQ only invites usable suppliers and cannot send empty',async()=>{const f=await approvedRequisition();let rfq=await f.service.createRfq(ctx,f.req.id,{responseDeadline:'2026-10-01'});await assert.rejects(()=>f.service.sendRfq(ctx,rfq.id),/at least one/);f.suppliers.unusable.add('bad');await assert.rejects(()=>f.service.inviteSupplier(ctx,rfq.id,'bad'),/not approved/);rfq=await f.service.inviteSupplier(ctx,rfq.id,'legacy-7');assert.deepEqual(rfq.supplierPartyIds,['party-legacy-7']);assert.equal((await f.service.sendRfq(ctx,rfq.id)).status,'SENT');});

test('bid comparison is deterministic and never auto-awards',async()=>{const f=await openRfq();await f.service.recordBid(ctx,f.rfq.id,bid('party-s1','90','50'));await f.service.recordBid(ctx,f.rfq.id,bid('party-s2','80','80'));const rows=await f.service.compare(ctx,f.rfq.id);assert.deepEqual(rows.map(row=>row.bid.supplierPartyId),['party-s1','party-s2']);assert.deepEqual(rows.map(row=>row.total),['230','240']);assert.equal(rows.every(row=>row.complete),true);assert.equal((await f.service.listAwards(ctx)).length,0);});

test('award is explicit reasoned and PO conversion stays in procurement-finance with retry safety',async()=>{const f=await openRfq();const one=await f.service.recordBid(ctx,f.rfq.id,bid('party-s1','100','50')),two=await f.service.recordBid(ctx,f.rfq.id,bid('party-s2','90','60'));await assert.rejects(()=>f.service.award(ctx,f.rfq.id,two.id,' '),/reason/);const award=await f.service.award(ctx,f.rfq.id,two.id,'أفضل شروط توريد مع السعر');assert.equal(award.supplierPartyId,'party-s2');assert.equal((await f.service.listBids(ctx,f.rfq.id)).find(x=>x.id===one.id)?.status,'REJECTED');const po=await f.service.createPurchaseOrderFromAward(ctx,award.id);assert.equal(po.supplierId,'party-s2');assert.equal(po.origin,'AUTO');assert.equal(po.externalReference,award.id);assert.equal((await f.service.getRequisition(ctx,award.requisitionId)).status,'CLOSED');const replay=await f.service.createPurchaseOrderFromAward(ctx,award.id);assert.equal(replay.id,po.id);assert.equal(f.procurement.calls,1);});

test('an RFQ rejects non-invited suppliers and mixed currencies',async()=>{const f=await openRfq();await assert.rejects(()=>f.service.recordBid(ctx,f.rfq.id,bid('party-x','1','1')),/not invited/);await f.service.recordBid(ctx,f.rfq.id,bid('party-s1','1','1'));await assert.rejects(()=>f.service.recordBid(ctx,f.rfq.id,{...bid('party-s2','1','1'),currency:'USD'}),/currency/);});
