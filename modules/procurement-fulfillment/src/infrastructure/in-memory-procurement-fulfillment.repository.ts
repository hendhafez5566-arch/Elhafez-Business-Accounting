import{ContractValidationError,type CompanyId,type DecimalAmount}from'@elhafez/contracts';
import type{ProcurementFulfillmentRepository}from'../application/procurement-fulfillment.repository.js';
import type{ProcurementFulfillmentRecord}from'../domain/fulfillment.js';

export class InMemoryProcurementFulfillmentRepository implements ProcurementFulfillmentRepository{
 private rows=new Map<string,ProcurementFulfillmentRecord>();
 private key(c:CompanyId,id:string){return `${c}|${id}`;}
 async reserve(v:ProcurementFulfillmentRecord){
  const same=this.rows.get(this.key(v.companyId,v.id));
  if(same){if(same.requestHash!==v.requestHash)throw new ContractValidationError('id','conflicting fulfillment replay');return same;}
  const collision=[...this.rows.values()].find((x)=>x.id===v.id&&x.companyId!==v.companyId);
  if(collision)throw new ContractValidationError('id','cross-company fulfillment id collision');
  this.rows.set(this.key(v.companyId,v.id),v);return v;
 }
 async complete(c:CompanyId,id:string,previousReceivedQuantity:DecimalAmount,resultingReceivedQuantity:DecimalAmount,appliedAt:string){
  const old=this.rows.get(this.key(c,id));if(!old)throw new ContractValidationError('id','fulfillment evidence not found');
  if(old.status==='APPLIED')return old;
  const next:ProcurementFulfillmentRecord={...old,status:'APPLIED',previousReceivedQuantity,resultingReceivedQuantity,appliedAt};
  this.rows.set(this.key(c,id),next);return next;
 }
 async find(c:CompanyId,id:string){return this.rows.get(this.key(c,id));}
 async listForPurchaseOrder(c:CompanyId,b:string,po:string){return[...this.rows.values()].filter((x)=>x.companyId===c&&x.branchId===b&&x.purchaseOrderId===po).sort((a,z)=>a.createdAt.localeCompare(z.createdAt));}
}
