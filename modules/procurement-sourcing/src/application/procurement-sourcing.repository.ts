import type{BranchId,CompanyId}from'@elhafez/contracts';
import type{PurchaseRequisition,RequestForQuotation,SourcingAward,SupplierBid}from'../domain/procurement-sourcing.js';
export interface ProcurementSourcingRepository{
 nextNumber(companyId:CompanyId,branchId:BranchId,kind:'PR'|'RFQ'):Promise<number>;
 createRequisition(value:PurchaseRequisition):Promise<PurchaseRequisition>;
 updateRequisition(value:PurchaseRequisition):Promise<PurchaseRequisition>;
 findRequisition(companyId:CompanyId,branchId:BranchId,id:string):Promise<PurchaseRequisition|undefined>;
 listRequisitions(companyId:CompanyId,branchId:BranchId):Promise<readonly PurchaseRequisition[]>;
 createRfq(value:RequestForQuotation,requisition:PurchaseRequisition):Promise<RequestForQuotation>;
 updateRfq(value:RequestForQuotation):Promise<RequestForQuotation>;
 findRfq(companyId:CompanyId,branchId:BranchId,id:string):Promise<RequestForQuotation|undefined>;
 listRfqs(companyId:CompanyId,branchId:BranchId):Promise<readonly RequestForQuotation[]>;
 saveBid(value:SupplierBid):Promise<SupplierBid>;
 findBid(companyId:CompanyId,branchId:BranchId,id:string):Promise<SupplierBid|undefined>;
 listBids(companyId:CompanyId,branchId:BranchId,rfqId:string):Promise<readonly SupplierBid[]>;
 commitAward(input:{award:SourcingAward;requisition:PurchaseRequisition;rfq:RequestForQuotation;bids:readonly SupplierBid[]}):Promise<SourcingAward>;
 updateAward(value:SourcingAward):Promise<SourcingAward>;
 findAward(companyId:CompanyId,branchId:BranchId,id:string):Promise<SourcingAward|undefined>;
 findAwardByRfq(companyId:CompanyId,branchId:BranchId,rfqId:string):Promise<SourcingAward|undefined>;
 listAwards(companyId:CompanyId,branchId:BranchId):Promise<readonly SourcingAward[]>;
}
export const PROCUREMENT_SOURCING_REPOSITORY=Symbol('PROCUREMENT_SOURCING_REPOSITORY');
