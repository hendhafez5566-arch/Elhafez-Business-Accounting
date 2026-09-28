import type{CompanyId,DecimalAmount}from'@elhafez/contracts';
import type{ProcurementFulfillmentRecord,SupplierConfirmationEvidence}from'../domain/fulfillment.js';

export interface ProcurementFulfillmentRepository{
 reserve(value:ProcurementFulfillmentRecord):Promise<ProcurementFulfillmentRecord>;
 complete(companyId:CompanyId,id:string,previousReceivedQuantity:DecimalAmount,resultingReceivedQuantity:DecimalAmount,appliedAt:string):Promise<ProcurementFulfillmentRecord>;
 find(companyId:CompanyId,id:string):Promise<ProcurementFulfillmentRecord|undefined>;
 listForPurchaseOrder(companyId:CompanyId,branchId:string,purchaseOrderId:string):Promise<ProcurementFulfillmentRecord[]>;
 saveSupplierConfirmation(value:SupplierConfirmationEvidence):Promise<SupplierConfirmationEvidence>;
 supplierConfirmation(companyId:CompanyId,id:string):Promise<SupplierConfirmationEvidence|undefined>;
 listSupplierConfirmations(companyId:CompanyId,branchId:string,purchaseOrderId:string):Promise<SupplierConfirmationEvidence[]>;
}
export const PROCUREMENT_FULFILLMENT_REPOSITORY=Symbol('PROCUREMENT_FULFILLMENT_REPOSITORY');
