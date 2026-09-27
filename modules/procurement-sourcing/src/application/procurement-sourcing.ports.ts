import type{CompanyId,DecimalAmount}from'@elhafez/contracts';
import type{PurchaseOrder}from'@elhafez/procurement-finance';
export interface SourcingSupplierPort{assertUsable(companyId:CompanyId,reference:string):Promise<{readonly partyId:string}>}
export interface SourcingProcurementPort{
 createPurchaseOrder(input:{id:string;companyId:CompanyId;branchId:string;supplierId:string;origin:'AUTO';orderDate:string;expectedDate?:string;currency:string;externalReference:string;notes?:string;lines:{readonly id:string;readonly itemReference:string;readonly description?:string;readonly orderedQuantity:DecimalAmount;readonly unitPrice:DecimalAmount;readonly taxCode?:string}[]}):Promise<PurchaseOrder>;
 getPurchaseOrder(companyId:CompanyId,branchId:string,id:string):Promise<PurchaseOrder>;
}
export const SOURCING_SUPPLIER_PORT=Symbol('SOURCING_SUPPLIER_PORT');
export const SOURCING_PROCUREMENT_PORT=Symbol('SOURCING_PROCUREMENT_PORT');
