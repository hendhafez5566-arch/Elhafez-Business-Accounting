import assert from'node:assert/strict';
import test from'node:test';
import{ContractValidationError,companyId,decimalAmount,executionContext,type ExecutionContext}from'@elhafez/contracts';
import type{PurchaseOrder}from'@elhafez/procurement-finance';
import type{ProcurementAccess}from'./application/procurement-access.js';
import{ProcurementFulfillmentApplicationService,PROCUREMENT_OPERATIONS_PERMISSIONS}from'./application/procurement-fulfillment.application-service.js';
import{InMemoryProcurementFulfillmentRepository}from'./infrastructure/in-memory-procurement-fulfillment.repository.js';

const company=companyId('company-a');
const ctx=executionContext(company,'branch-a','actor-a');

class Access implements ProcurementAccess{
 permissions:string[]=[];audits:string[]=[];
 async requireBranch(c:ExecutionContext){if(c.branchId==='blocked')throw new Error('branch denied');}
 async requirePermission(_c:ExecutionContext,p:string){this.permissions.push(p);}
 async audit(_c:ExecutionContext,a:string){this.audits.push(a);}
}
class ProcurementHarness{
 readonly pos=new Map<string,PurchaseOrder>();
 readonly receiptCommands=new Map<string,string>();
 readonly correctionCommands=new Map<string,string>();
 readonly cancelReasons:string[]=[];
 async createPurchaseOrder(input:any){const po:PurchaseOrder={...input,status:'DRAFT',requestHash:'create',createdAt:'2026-09-20T20:00:00.000Z',lines:input.lines.map((line:any)=>({...line,companyId:input.companyId,purchaseOrderId:input.id,receivedQuantity:decimalAmount('0'),invoicedQuantity:decimalAmount('0')}))};this.pos.set(input.id,po);return po;}
 async updateDraftPurchaseOrder(input:any){const old=this.pos.get(input.purchaseOrderId)!;const po:PurchaseOrder={...old,supplierId:input.supplierId,orderDate:input.orderDate,currency:input.currency,notes:input.notes,lines:input.lines.map((line:any)=>({...line,companyId:input.companyId,purchaseOrderId:input.purchaseOrderId,receivedQuantity:decimalAmount('0'),invoicedQuantity:decimalAmount('0')}))};this.pos.set(po.id,po);return po;}
 async approvePurchaseOrder(_c:string,id:string){const old=this.pos.get(id)!;const po={...old,status:'APPROVED' as const};this.pos.set(id,po);return po;}
 async cancelPurchaseOrderWithReason(_c:string,id:string,reason:string){this.cancelReasons.push(reason);const old=this.pos.get(id)!;const po={...old,status:'CANCELLED' as const};this.pos.set(id,po);return po;}
 async getPurchaseOrderForBranch(_c:string,b:string,id:string){const po=this.pos.get(id);if(!po)throw new ContractValidationError('purchaseOrder','not found');if(po.branchId!==b)throw new ContractValidationError('branchId','purchase order belongs to a different branch');return po;}
 async listPurchaseOrders(_c:string,b:string){return[...this.pos.values()].filter((x)=>x.branchId===b);}
 async receivePurchaseOrderWithOutcome(input:any){const key=input.commandId,hash=JSON.stringify(input);const prior=this.receiptCommands.get(key);if(prior&&prior!==hash)throw new ContractValidationError('command','conflicting replay');if(prior){const po=this.pos.get(input.purchaseOrderId)!;const line=po.lines.find((x)=>x.id===input.lineId)!;const previous=decimalAmount(String(Number(line.receivedQuantity)-Number(input.quantity)));return{purchaseOrder:po,previousReceivedQuantity:previous,resultingReceivedQuantity:line.receivedQuantity};}const old=this.pos.get(input.purchaseOrderId)!,line=old.lines.find((x)=>x.id===input.lineId)!,previousReceivedQuantity=line.receivedQuantity;const next=decimalAmount(String(Number(line.receivedQuantity)+Number(input.quantity)));if(Number(next)>Number(line.orderedQuantity))throw new ContractValidationError('quantity','over-receipt');const po={...old,status:Number(next)===Number(line.orderedQuantity)?'RECEIVED' as const:'PARTIALLY_RECEIVED' as const,lines:old.lines.map((x)=>x.id===line.id?{...x,receivedQuantity:next}:x)};this.pos.set(old.id,po);this.receiptCommands.set(key,hash);return{purchaseOrder:po,previousReceivedQuantity,resultingReceivedQuantity:next};}
 async adjustReceivedPurchaseOrderWithOutcome(input:any){const key=input.commandId,hash=JSON.stringify(input);const prior=this.correctionCommands.get(key);if(prior&&prior!==hash)throw new ContractValidationError('command','conflicting replay');if(prior){const po=this.pos.get(input.purchaseOrderId)!;const line=po.lines.find((x)=>x.id===input.lineId)!;return{purchaseOrder:po,previousReceivedQuantity:line.receivedQuantity,resultingReceivedQuantity:line.receivedQuantity};}const old=this.pos.get(input.purchaseOrderId)!,line=old.lines.find((x)=>x.id===input.lineId)!,previousReceivedQuantity=line.receivedQuantity;if(Number(input.newReceivedQuantity)>Number(line.orderedQuantity))throw new ContractValidationError('quantity','over-receipt');if(Number(input.newReceivedQuantity)<Number(line.invoicedQuantity))throw new ContractValidationError('quantity','cannot fall below invoiced quantity');const po={...old,status:Number(input.newReceivedQuantity)===0?'APPROVED' as const:'PARTIALLY_RECEIVED' as const,lines:old.lines.map((x)=>x.id===line.id?{...x,receivedQuantity:input.newReceivedQuantity}:x)};this.pos.set(old.id,po);this.correctionCommands.set(key,hash);return{purchaseOrder:po,previousReceivedQuantity,resultingReceivedQuantity:input.newReceivedQuantity};}
 async createDirectPurchase(input:any){return{id:input.invoiceId,status:'POSTED',branchId:input.branchId,sourceType:'PROCUREMENT_DIRECT'};}
 async convertToSupplierInvoice(input:any){return{id:input.id,companyId:input.companyId,purchaseOrderId:input.purchaseOrderId,lineId:input.lineId,billingInvoiceId:input.billing.invoiceId,quantity:input.quantity,reopenedQuantity:decimalAmount('0'),requestHash:'conversion',status:'INVOICED',createdAt:'2026-09-20T20:00:00.000Z'};}
}
function setup(){const procurement=new ProcurementHarness(),repo=new InMemoryProcurementFulfillmentRepository(),access=new Access(),service=new ProcurementFulfillmentApplicationService(repo,procurement as never,access,()=>new Date('2026-09-20T20:00:00Z'));return{procurement,repo,access,service};}
async function draft(s:ReturnType<typeof setup>){return s.service.createPurchaseOrder(ctx,{id:'po-1',supplierId:'supplier-party',number:'PO-1',orderDate:'2026-09-20',currency:'EGP',lines:[{id:'line-1',itemReference:'hotel',orderedQuantity:decimalAmount('10'),unitPrice:decimalAmount('100')}]});}
async function approved(s:ReturnType<typeof setup>){await draft(s);return s.service.approvePurchaseOrder(ctx,'po-1');}

test('manual PO is branch-owned and draft commercial data is edited through owner contract',async()=>{const s=setup(),created=await draft(s);assert.equal(created.branchId,'branch-a');assert.equal(created.currency,'EGP');await assert.rejects(()=>s.service.getPurchaseOrder(executionContext(company,'branch-b','actor-a'),'po-1'),/different branch/);const changed=await s.service.updateDraftPurchaseOrder(ctx,{purchaseOrderId:'po-1',commandId:'u1',supplierId:'supplier-party',orderDate:'2026-09-21',currency:'USD',notes:'updated',lines:[{id:'line-2',itemReference:'transport',orderedQuantity:decimalAmount('2'),unitPrice:decimalAmount('50')}]});assert.equal(changed.currency,'USD');assert.equal(changed.lines[0]?.id,'line-2');assert.ok(s.access.permissions.includes(PROCUREMENT_OPERATIONS_PERMISSIONS.manage));});

test('fulfillment retry after evidence completion failure never double receives',async()=>{const s=setup();await approved(s);const original=s.repo.complete.bind(s.repo);let fail=true;s.repo.complete=async(...args)=>{if(fail){fail=false;throw new Error('evidence outage');}return original(...args);};const command={id:'f-1',purchaseOrderId:'po-1',lineId:'line-1',quantity:decimalAmount('4'),note:'first'};await assert.rejects(()=>s.service.recordFulfillment(ctx,command),/evidence outage/);assert.equal(s.procurement.pos.get('po-1')?.lines[0]?.receivedQuantity,'4');const retried=await s.service.recordFulfillment(ctx,command);assert.equal(retried.status,'APPLIED');assert.equal(s.procurement.pos.get('po-1')?.lines[0]?.receivedQuantity,'4');});

test('receipt correction is immutable evidence and cannot exceed ordered quantity',async()=>{const s=setup();await approved(s);await s.service.recordFulfillment(ctx,{id:'f-1',purchaseOrderId:'po-1',lineId:'line-1',quantity:decimalAmount('6')});const corrected=await s.service.correctFulfillment(ctx,{id:'c-1',correctionOfId:'f-1',purchaseOrderId:'po-1',lineId:'line-1',targetReceivedQuantity:decimalAmount('4'),reason:'supplier confirmation corrected'});assert.equal(corrected.kind,'CORRECTION');assert.equal(corrected.previousReceivedQuantity,'6');assert.equal(corrected.resultingReceivedQuantity,'4');assert.equal(s.procurement.pos.get('po-1')?.lines[0]?.receivedQuantity,'4');await assert.rejects(()=>s.service.correctFulfillment(ctx,{id:'c-2',correctionOfId:'c-1',purchaseOrderId:'po-1',lineId:'line-1',targetReceivedQuantity:decimalAmount('11'),reason:'bad'}),/over-receipt/);});

test('direct purchase delegates financial truth and preserves branch context',async()=>{const s=setup();const invoice=await s.service.createDirectPurchase(ctx,{id:'direct-1',supplierId:'supplier-party',invoiceId:'inv-1',number:'PINV-1',externalInvoiceNumber:'SUP-EXT-1',postingDate:'2026-09-20',currency:'EGP',controlAccountId:'ap',lines:[{id:'inv-line',accountId:'expense',amount:decimalAmount('250')}]});assert.equal(invoice.status,'POSTED');assert.equal(invoice.branchId,'branch-a');assert.equal(invoice.sourceType,'PROCUREMENT_DIRECT');assert.ok(s.access.permissions.includes(PROCUREMENT_OPERATIONS_PERMISSIONS.directManage));});

test('applied fulfillment retries platform audit after an audit outage without receiving twice',async()=>{
 const s=setup();await approved(s);
 const original=s.access.audit.bind(s.access);let fail=true;
 s.access.audit=async(...args)=>{if(fail&&args[1]==='procurement.fulfillment.recorded'){fail=false;throw new Error('audit outage');}return original(...args);};
 const command={id:'audit-f-1',purchaseOrderId:'po-1',lineId:'line-1',quantity:decimalAmount('3')};
 await assert.rejects(()=>s.service.recordFulfillment(ctx,command),/audit outage/);
 assert.equal((await s.repo.find(company,'audit-f-1'))?.status,'APPLIED');
 assert.equal(s.procurement.pos.get('po-1')?.lines[0]?.receivedQuantity,'3');
 const replay=await s.service.recordFulfillment(ctx,command);
 assert.equal(replay.status,'APPLIED');
 assert.equal(s.procurement.pos.get('po-1')?.lines[0]?.receivedQuantity,'3');
 assert.ok(s.access.audits.includes('procurement.fulfillment.recorded'));
});

test('operational PO cancellation requires and preserves a reason',async()=>{const s=setup();await draft(s);await assert.rejects(()=>s.service.cancelPurchaseOrder(ctx,'po-1',''),/reason/);const cancelled=await s.service.cancelPurchaseOrder(ctx,'po-1','supplier could not fulfill');assert.equal(cancelled.status,'CANCELLED');assert.deepEqual(s.procurement.cancelReasons,['supplier could not fulfill']);assert.ok(s.access.audits.includes('procurement.po.cancelled'));});

test('PO fulfillment can be converted to supplier invoice through the Procurement owner contract',async()=>{const s=setup();await approved(s);await s.service.recordFulfillment(ctx,{id:'inv-f-1',purchaseOrderId:'po-1',lineId:'line-1',quantity:decimalAmount('2')});const conversion=await s.service.convertPurchaseOrderLineToSupplierInvoice(ctx,{id:'conv-1',purchaseOrderId:'po-1',lineId:'line-1',quantity:decimalAmount('2'),billing:{invoiceId:'bill-1',number:'PINV-1',externalInvoiceNumber:'EXT-1',postingDate:'2026-09-20',currency:'EGP',controlAccountId:'ap',accountId:'expense',amount:decimalAmount('200')}});assert.equal(conversion.status,'INVOICED');assert.equal(conversion.purchaseOrderId,'po-1');assert.ok(s.access.permissions.includes(PROCUREMENT_OPERATIONS_PERMISSIONS.invoiceConvert));});
