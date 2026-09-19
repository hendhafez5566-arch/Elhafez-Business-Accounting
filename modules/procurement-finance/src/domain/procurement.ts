import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
export type CommitmentStatus='DRAFT'|'COMMITTED'|'CANCELLED'|'REOPENED';
export type PurchaseOrderStatus='DRAFT'|'APPROVED'|'PARTIALLY_RECEIVED'|'RECEIVED'|'PARTIALLY_INVOICED'|'INVOICED'|'CANCELLED'|'DISPOSED';
export type ProcurementPolicy={companyId:CompanyId;commitmentTiming:'ON_PO_APPROVAL';version:number;effectiveFrom:string;requestHash:string};
export type SupplierCommitment={id:string;companyId:CompanyId;supplierId:string;sourceType:string;sourceId:string;status:CommitmentStatus;effectiveDate:string;cancelledAt?:string;cancelReason?:string;requestHash:string;createdAt:string};
export type PurchaseOrderLine={id:string;companyId:CompanyId;purchaseOrderId:string;itemReference:string;orderedQuantity:DecimalAmount;receivedQuantity:DecimalAmount;invoicedQuantity:DecimalAmount};
export type PurchaseOrder={id:string;companyId:CompanyId;commitmentId?:string;supplierId:string;number:string;origin:'MANUAL'|'AUTO';status:PurchaseOrderStatus;requestHash:string;createdAt:string;lines:PurchaseOrderLine[]};
export type InvoiceConversion={id:string;companyId:CompanyId;purchaseOrderId:string;lineId:string;billingInvoiceId:string;quantity:DecimalAmount;reopenedQuantity:DecimalAmount;requestHash:string;status:'RESERVED'|'INVOICED'|'REOPENED';createdAt:string};
export type ProcurementHistory={id:string;companyId:CompanyId;aggregateId:string;kind:string;sourceReference?:string;createdAt:string};
