import type{BranchId,CompanyId,DecimalAmount}from'@elhafez/contracts';

export type RequisitionStatus='DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'SOURCING'|'AWARDED'|'CLOSED'|'CANCELLED';
export type RfqStatus='DRAFT'|'SENT'|'CLOSED'|'CANCELLED';
export type SupplierBidStatus='RECEIVED'|'WITHDRAWN'|'AWARDED'|'REJECTED';

export interface PurchaseRequisitionLine{readonly id:string;readonly requisitionId:string;readonly itemReference:string;readonly description:string|null;readonly quantity:DecimalAmount;readonly targetUnitPrice:DecimalAmount|null;readonly requiredDate:string|null}
export interface PurchaseRequisition{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly number:string;readonly status:RequisitionStatus;readonly requestedBy:string;readonly needByDate:string|null;readonly currency:string|null;readonly notes:string|null;readonly approvedBy:string|null;readonly approvedAt:string|null;readonly approvalReason:string|null;readonly createdAt:string;readonly updatedAt:string;readonly lines:readonly PurchaseRequisitionLine[]}
export interface RequestForQuotation{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly requisitionId:string;readonly number:string;readonly status:RfqStatus;readonly responseDeadline:string;readonly notes:string|null;readonly createdBy:string;readonly createdAt:string;readonly sentAt:string|null;readonly closedAt:string|null;readonly supplierPartyIds:readonly string[]}
export interface SupplierBidLine{readonly id:string;readonly bidId:string;readonly requisitionLineId:string;readonly quantity:DecimalAmount;readonly unitPrice:DecimalAmount;readonly taxCode:string|null}
export interface SupplierBid{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly rfqId:string;readonly supplierPartyId:string;readonly currency:string;readonly validUntil:string|null;readonly deliveryDate:string|null;readonly terms:string|null;readonly status:SupplierBidStatus;readonly submittedAt:string;readonly lines:readonly SupplierBidLine[]}
export interface SourcingAward{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly requisitionId:string;readonly rfqId:string;readonly bidId:string;readonly supplierPartyId:string;readonly reason:string;readonly awardedBy:string;readonly awardedAt:string;readonly purchaseOrderId:string|null}
export interface BidComparisonRow{readonly bid:SupplierBid;readonly total:DecimalAmount;readonly complete:boolean}

export interface CreateRequisitionInput{readonly id?:string;readonly needByDate?:string|null;readonly currency?:string|null;readonly notes?:string|null;readonly lines:readonly{readonly id?:string;readonly itemReference:string;readonly description?:string|null;readonly quantity:string;readonly targetUnitPrice?:string|null;readonly requiredDate?:string|null}[]}
export interface UpdateRequisitionInput{readonly needByDate?:string|null;readonly currency?:string|null;readonly notes?:string|null;readonly lines:CreateRequisitionInput['lines']}
export interface CreateRfqInput{readonly id?:string;readonly responseDeadline:string;readonly notes?:string|null}
export interface RecordSupplierBidInput{readonly id?:string;readonly supplierReference:string;readonly currency:string;readonly validUntil?:string|null;readonly deliveryDate?:string|null;readonly terms?:string|null;readonly lines:readonly{readonly id?:string;readonly requisitionLineId:string;readonly quantity:string;readonly unitPrice:string;readonly taxCode?:string|null}[]}
