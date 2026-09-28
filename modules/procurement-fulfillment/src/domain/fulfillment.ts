import type{CompanyId,DecimalAmount}from'@elhafez/contracts';

export type FulfillmentKind='RECEIPT'|'CORRECTION';
export type FulfillmentStatus='PENDING'|'APPLIED';

export interface ProcurementFulfillmentRecord{
 readonly id:string;
 readonly companyId:CompanyId;
 readonly branchId:string;
 readonly purchaseOrderId:string;
 readonly lineId:string;
 readonly supplierId:string;
 readonly kind:FulfillmentKind;
 readonly status:FulfillmentStatus;
 readonly requestedQuantity:DecimalAmount;
 readonly previousReceivedQuantity?:DecimalAmount;
 readonly resultingReceivedQuantity?:DecimalAmount;
 readonly correctionOfId?:string;
 readonly reason?:string;
 readonly note?:string;
 readonly attachmentIds:readonly string[];
 readonly actorId:string;
 readonly requestHash:string;
 readonly createdAt:string;
 readonly appliedAt?:string;
}

export type SupplierConfirmationOutcome='CONFIRMED'|'DECLINED';
export interface SupplierConfirmationEvidence{
 readonly id:string;
 readonly companyId:CompanyId;
 readonly branchId:string;
 readonly purchaseOrderId:string;
 readonly supplierId:string;
 readonly outcome:SupplierConfirmationOutcome;
 readonly externalReference:string|null;
 readonly confirmedDeliveryDate:string|null;
 readonly note:string|null;
 readonly actorId:string;
 readonly requestHash:string;
 readonly occurredAt:string;
}
