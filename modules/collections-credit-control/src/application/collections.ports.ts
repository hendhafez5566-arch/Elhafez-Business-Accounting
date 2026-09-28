import type{CompanyId,DecimalAmount,ExecutionContext}from'@elhafez/contracts';export const COLLECTIONS_ACCESS=Symbol('COLLECTIONS_ACCESS'),COLLECTIONS_BILLING=Symbol('COLLECTIONS_BILLING');
export interface CollectionsAccess{requireBranch(c:ExecutionContext):Promise<void>;requirePermission(c:ExecutionContext,p:string):Promise<void>;audit(c:ExecutionContext,action:string,id:string,metadata?:Record<string,unknown>):Promise<void>}
export interface CollectionInvoicePosition{invoiceId:string;branchId?:string;partyKind:string;partyId:string;currency:string;outstanding:DecimalAmount;status:string;postingDate:string}
export interface CollectionsBillingPort{position(companyId:CompanyId,invoiceId:string):Promise<CollectionInvoicePosition>}
