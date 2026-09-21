import{createHash}from'node:crypto';
import{ContractValidationError,decimalAmount,type DecimalAmount,type ExecutionContext}from'@elhafez/contracts';
import type{
 ConvertToSupplierInvoiceInput,
 CreateDirectPurchaseInput,
 CreatePurchaseOrderInput,
 ProcurementFinanceApplicationService,
 PurchaseOrder,
 UpdatePurchaseOrderInput,
}from'@elhafez/procurement-finance';
import type{ProcurementAccess}from'./procurement-access.js';
import type{ProcurementFulfillmentRepository}from'./procurement-fulfillment.repository.js';
import type{ProcurementFulfillmentRecord}from'../domain/fulfillment.js';

const SCALE=10n**18n;
function scaled(value:DecimalAmount){const v=decimalAmount(value),negative=v.startsWith('-'),u=negative?v.slice(1):v,[w='0',f='']=u.split('.'),raw=BigInt(w+f.padEnd(18,'0'));return negative?-raw:raw;}
function positive(value:DecimalAmount,field:string){const v=decimalAmount(value);if(scaled(v)<=0n)throw new ContractValidationError(field,'must be positive');return v;}
function nonNegative(value:DecimalAmount,field:string){const v=decimalAmount(value);if(scaled(v)<0n)throw new ContractValidationError(field,'must be non-negative');return v;}
function required(value:string,field:string){const v=value.trim();if(!v)throw new ContractValidationError(field,'is required');return v;}
function hash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}

export const PROCUREMENT_OPERATIONS_PERMISSIONS=Object.freeze({
 read:'procurement.read',
 manage:'procurement.manage',
 approve:'procurement.approve',
 fulfillmentRead:'procurement.fulfillment.read',
 fulfillmentManage:'procurement.fulfillment.manage',
 directManage:'procurement.direct.manage',
 invoiceConvert:'procurement.invoice.convert',
});

export type CreateManualPurchaseOrderInput=Omit<CreatePurchaseOrderInput,'companyId'|'branchId'|'origin'|'number'>;
export type UpdateManualPurchaseOrderInput=Omit<UpdatePurchaseOrderInput,'companyId'|'branchId'>;
export type CreateDirectPurchaseOperationalInput=Omit<CreateDirectPurchaseInput,'companyId'|'branchId'>;
export type ConvertPurchaseOrderLineToSupplierInvoiceInput=Omit<ConvertToSupplierInvoiceInput,'companyId'>;

export interface RecordFulfillmentInput{
 readonly id:string;
 readonly purchaseOrderId:string;
 readonly lineId:string;
 readonly quantity:DecimalAmount;
 readonly note?:string;
 readonly attachmentIds?:readonly string[];
}
export interface CorrectFulfillmentInput{
 readonly id:string;
 readonly correctionOfId:string;
 readonly purchaseOrderId:string;
 readonly lineId:string;
 readonly targetReceivedQuantity:DecimalAmount;
 readonly reason:string;
 readonly note?:string;
 readonly attachmentIds?:readonly string[];
}

export class ProcurementFulfillmentApplicationService{
 constructor(
  private readonly repo:ProcurementFulfillmentRepository,
  private readonly procurement:Pick<ProcurementFinanceApplicationService,
   'createPurchaseOrder'|'updateDraftPurchaseOrder'|'approvePurchaseOrder'|'cancelPurchaseOrderWithReason'|
   'getPurchaseOrderForBranch'|'listPurchaseOrders'|'receivePurchaseOrderWithOutcome'|'adjustReceivedPurchaseOrderWithOutcome'|'createDirectPurchase'|'convertToSupplierInvoice'>,
  private readonly access:ProcurementAccess,
  private readonly now:()=>Date=()=>new Date(),
 ){}

 private async permission(c:ExecutionContext,p:string){await this.access.requireBranch(c);await this.access.requirePermission(c,p);}
 private line(po:PurchaseOrder,lineId:string){const line=po.lines.find((x)=>x.id===lineId);if(!line)throw new ContractValidationError('lineId','line was not found on purchase order');return line;}

 async listPurchaseOrders(c:ExecutionContext){await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.read);return this.procurement.listPurchaseOrders(c.companyId,c.branchId);}
 async getPurchaseOrder(c:ExecutionContext,id:string){await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.read);return this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,id);}

 async createPurchaseOrder(c:ExecutionContext,input:CreateManualPurchaseOrderInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.manage);
  const value=await this.procurement.createPurchaseOrder({...input,companyId:c.companyId,branchId:c.branchId,origin:'MANUAL'});
  await this.access.audit(c,'procurement.po.created','purchase-order',value.id,{number:value.number});
  return value;
 }

 async updateDraftPurchaseOrder(c:ExecutionContext,input:UpdateManualPurchaseOrderInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.manage);
  await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,input.purchaseOrderId);
  const value=await this.procurement.updateDraftPurchaseOrder({...input,companyId:c.companyId,branchId:c.branchId});
  await this.access.audit(c,'procurement.po.updated','purchase-order',value.id,{commandId:input.commandId});
  return value;
 }

 async approvePurchaseOrder(c:ExecutionContext,id:string){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.approve);
  await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,id);
  const value=await this.procurement.approvePurchaseOrder(c.companyId,id);
  await this.access.audit(c,'procurement.po.approved','purchase-order',id,{});
  return value;
 }

 async cancelPurchaseOrder(c:ExecutionContext,id:string,reason:string){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.manage);
  await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,id);
  const why=required(reason,'reason');
  const value=await this.procurement.cancelPurchaseOrderWithReason(c.companyId,id,why);
  await this.access.audit(c,'procurement.po.cancelled','purchase-order',id,{reason:why});
  return value;
 }

 async createDirectPurchase(c:ExecutionContext,input:CreateDirectPurchaseOperationalInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.directManage);
  const value=await this.procurement.createDirectPurchase({...input,companyId:c.companyId,branchId:c.branchId});
  await this.access.audit(c,'procurement.direct.posted','supplier-invoice',value.id,{sourceId:input.id});
  return value;
 }

 async convertPurchaseOrderLineToSupplierInvoice(c:ExecutionContext,input:ConvertPurchaseOrderLineToSupplierInvoiceInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.invoiceConvert);
  await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,input.purchaseOrderId);
  const value=await this.procurement.convertToSupplierInvoice({...input,companyId:c.companyId});
  await this.access.audit(c,'procurement.po.supplier-invoice-converted','purchase-order',input.purchaseOrderId,{lineId:input.lineId,conversionId:input.id,billingInvoiceId:input.billing.invoiceId});
  return value;
 }

 async recordFulfillment(c:ExecutionContext,input:RecordFulfillmentInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.fulfillmentManage);
  const command={...input,companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,quantity:positive(input.quantity,'quantity'),attachmentIds:[...(input.attachmentIds??[])]};
  const requestHash=hash(command);
  let record=await this.repo.find(c.companyId,input.id);
  if(record){
   if(record.requestHash!==requestHash)throw new ContractValidationError('id','conflicting fulfillment replay');
   if(record.status==='APPLIED'){
    await this.access.audit(c,'procurement.fulfillment.recorded','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId},`procurement.fulfillment.recorded:${record.id}`);
    return record;
   }
  }else{
   const po=await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,input.purchaseOrderId),line=this.line(po,input.lineId);
   record=await this.repo.reserve({
    id:required(input.id,'id'),companyId:c.companyId,branchId:c.branchId,
    purchaseOrderId:po.id,lineId:line.id,supplierId:po.supplierId,kind:'RECEIPT',status:'PENDING',
    requestedQuantity:command.quantity,
    ...(input.note?.trim()?{note:input.note.trim()}:{}),attachmentIds:command.attachmentIds,
    actorId:c.actorId,requestHash,createdAt:this.now().toISOString(),
   });
   if(record.status==='APPLIED'){
    await this.access.audit(c,'procurement.fulfillment.recorded','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId},`procurement.fulfillment.recorded:${record.id}`);
    return record;
   }
  }
  const outcome=await this.procurement.receivePurchaseOrderWithOutcome({
   companyId:c.companyId,purchaseOrderId:record.purchaseOrderId,lineId:record.lineId,
   quantity:record.requestedQuantity,commandId:`fulfillment:${record.id}`,
  });
  const completed=await this.repo.complete(c.companyId,record.id,outcome.previousReceivedQuantity,outcome.resultingReceivedQuantity,this.now().toISOString());
  await this.access.audit(c,'procurement.fulfillment.recorded','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId},`procurement.fulfillment.recorded:${record.id}`);
  return completed;
 }

 async correctFulfillment(c:ExecutionContext,input:CorrectFulfillmentInput){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.fulfillmentManage);
  const target=nonNegative(input.targetReceivedQuantity,'targetReceivedQuantity'),reason=required(input.reason,'reason');
  const command={...input,companyId:c.companyId,branchId:c.branchId,actorId:c.actorId,targetReceivedQuantity:target,reason,attachmentIds:[...(input.attachmentIds??[])]};
  const requestHash=hash(command);
  let record=await this.repo.find(c.companyId,input.id);
  if(record){
   if(record.requestHash!==requestHash)throw new ContractValidationError('id','conflicting correction replay');
   if(record.status==='APPLIED'){
    await this.access.audit(c,'procurement.fulfillment.corrected','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId,correctionOfId:record.correctionOfId},`procurement.fulfillment.corrected:${record.id}`);
    return record;
   }
  }else{
   const original=await this.repo.find(c.companyId,required(input.correctionOfId,'correctionOfId'));
   if(!original||original.status!=='APPLIED'||original.branchId!==c.branchId||original.purchaseOrderId!==input.purchaseOrderId||original.lineId!==input.lineId)throw new ContractValidationError('correctionOfId','applied same-line fulfillment evidence required');
   const po=await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,input.purchaseOrderId),line=this.line(po,input.lineId);
   record=await this.repo.reserve({
    id:required(input.id,'id'),companyId:c.companyId,branchId:c.branchId,purchaseOrderId:po.id,lineId:line.id,
    supplierId:po.supplierId,kind:'CORRECTION',status:'PENDING',requestedQuantity:target,
    correctionOfId:original.id,reason,
    ...(input.note?.trim()?{note:input.note.trim()}:{}),attachmentIds:command.attachmentIds,
    actorId:c.actorId,requestHash,createdAt:this.now().toISOString(),
   });
   if(record.status==='APPLIED'){
    await this.access.audit(c,'procurement.fulfillment.corrected','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId,correctionOfId:record.correctionOfId},`procurement.fulfillment.corrected:${record.id}`);
    return record;
   }
  }
  const outcome=await this.procurement.adjustReceivedPurchaseOrderWithOutcome({
   companyId:c.companyId,purchaseOrderId:record.purchaseOrderId,lineId:record.lineId,
   newReceivedQuantity:record.requestedQuantity,commandId:`fulfillment-correction:${record.id}`,reason:record.reason!,
  });
  const completed=await this.repo.complete(c.companyId,record.id,outcome.previousReceivedQuantity,outcome.resultingReceivedQuantity,this.now().toISOString());
  await this.access.audit(c,'procurement.fulfillment.corrected','procurement-fulfillment',record.id,{purchaseOrderId:record.purchaseOrderId,lineId:record.lineId,correctionOfId:record.correctionOfId},`procurement.fulfillment.corrected:${record.id}`);
  return completed;
 }

 async listFulfillment(c:ExecutionContext,purchaseOrderId:string){
  await this.permission(c,PROCUREMENT_OPERATIONS_PERMISSIONS.fulfillmentRead);
  await this.procurement.getPurchaseOrderForBranch(c.companyId,c.branchId,purchaseOrderId);
  return this.repo.listForPurchaseOrder(c.companyId,c.branchId,purchaseOrderId);
 }
}
