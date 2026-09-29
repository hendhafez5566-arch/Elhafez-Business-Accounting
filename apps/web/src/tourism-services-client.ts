import { crmGet, crmPatch, crmPost } from './crm-core-client.js';
export type ServiceCategory = 'HOTEL'|'FLIGHT'|'VISA'|'TRANSPORT'|'OTHER';
export type ServiceStatus = 'DRAFT'|'CONFIRMING'|'CONFIRMED'|'CANCELLATION_REQUESTED'|'CANCELLED'|'COMPLETED';
export interface ServiceType { id:string; code:string; category:ServiceCategory; nameAr:string; active:boolean }
export interface ServiceRow { id:string; number:string; status:ServiceStatus; revision:number; supplyPlanId?:string; supplyPlanVersion?:number; pendingCommandKey?:string; cancellationPostingDate?:string }
export interface ServiceRevision { revision:number; serviceTypeId:string; category:ServiceCategory; serviceDate:string; periodEnd?:string; quantity:string; debtorKind:'CUSTOMER'|'AGENT'; debtorPartyId:string; customerPartyId:string; beneficiaryPartyIds:string[]; details:Record<string,unknown>; commercial:{currency:string;grossAmount:string;discountAmount:string;netAmount:string}; financialTerms:{invoiceNumber:string;postingDate:string;dueDate:string;approvalRequestId?:string;commission?:{agentPartyId:string;amount:string}} }
export interface ServiceRecord { service:ServiceRow; revision:ServiceRevision; history:{kind:string;createdAt:string;actorId:string}[] }
export interface SupplyRequest { requestId:string; contractId:string; resourceType:string; resourceId:string; serviceDate:string; quantity:string; unit:string; currency:string; unitCost:string; periodEnd?:string }
export interface SupplyPlan { planId:string;version:number;expiresAt:string;lines:{resourceId:string;allocationQuantity:string;costAmount:string;currency:string}[];residuals:{quantity:string;currency:string;supplierId?:string;costAmount?:string;quoteReference?:string}[];totalsByCurrency:Record<string,string> }
export interface Fulfillment { case:{status:string;confirmedQuantity:string;deliveredQuantity:string;quantity:string};confirmations:{reference:string;supplierId?:string;quantity:string}[];deliveries:{quantity:string;at:string;note:string}[] }
export interface Voucher { id:string;number:string;status:'ISSUED'|'VOID';version:number }
export interface PrintableVoucher { number:string;version:number;serviceNumber:string;serviceType:string;serviceDate:string;periodEnd?:string;customerPartyId:string;beneficiaryPartyIds:string[];quantity:string;description:string;supplierId?:string;externalReference?:string;instructions:string;issuedAt:string }
export interface DraftInput { commandKey:string; number:string;serviceTypeId:string;serviceDate:string;periodEnd?:string;quantity:string;debtorKind:'CUSTOMER'|'AGENT';debtorPartyId:string;customerPartyId:string;beneficiaryPartyIds:string[];details:Record<string,unknown>;currency:string;grossAmount:string;discountAmount:string;invoiceNumber:string;postingDate:string;dueDate:string;approvalRequestId?:string }
const base='/tourism/services';
export interface TourismCapabilities {view:boolean;manage:boolean;confirm:boolean;cancel:boolean;fulfill:boolean;voucher:boolean}
export const tourismServicesApi={
 capabilities:()=>crmGet<TourismCapabilities>(`${base}/capabilities`),
 types:()=>crmGet<ServiceType[]>(`${base}/types`),
 saveType:(input:Omit<ServiceType,'companyId'>)=>crmPost<ServiceType>(`${base}/types`,input),
 list:()=>crmGet<ServiceRow[]>(base),
 get:(id:string)=>crmGet<ServiceRecord>(`${base}/${encodeURIComponent(id)}`),
 create:(input:DraftInput)=>crmPost<ServiceRow>(base,input),
 update:(id:string,input:DraftInput&{expectedRevision:number})=>crmPatch<ServiceRow>(`${base}/${encodeURIComponent(id)}`,input),
 plan:(id:string,input:{expectedRevision:number;requests:SupplyRequest[];externalQuotes?:{requestId:string;supplierId:string;currency:string;unitCost:string;quoteReference:string}[]})=>crmPost<SupplyPlan>(`${base}/${encodeURIComponent(id)}/supply-plan`,input),
 confirm:(id:string,input:{commandKey:string;expectedRevision:number;planId:string;planVersion:number})=>crmPost<ServiceRow>(`${base}/${encodeURIComponent(id)}/confirm`,input),
 fulfillment:(id:string)=>crmGet<Fulfillment|null>(`${base}/${encodeURIComponent(id)}/fulfillment`),
 supplierConfirm:(id:string,input:{commandKey:string;quantity:string;at:string;referenceType:string;reference:string;supplierId?:string;internalCoverage?:boolean})=>crmPost<Fulfillment>(`${base}/${encodeURIComponent(id)}/fulfillment/confirm`,input),
 deliver:(id:string,input:{commandKey:string;quantity:string;at:string;unit:string;note:string})=>crmPost<Fulfillment>(`${base}/${encodeURIComponent(id)}/fulfillment/deliver`,input),
 vouchers:(id:string)=>crmGet<Voucher[]>(`${base}/${encodeURIComponent(id)}/vouchers`),
 issueVoucher:(id:string,input:{commandKey:string;number:string;instructions:string})=>crmPost<Voucher>(`${base}/${encodeURIComponent(id)}/vouchers`,input),
 voidVoucher:(id:string,voucherId:string,input:{commandKey:string})=>crmPost<Voucher>(`${base}/${encodeURIComponent(id)}/vouchers/${encodeURIComponent(voucherId)}/void`,input),
 printable:(id:string,voucherId:string)=>crmGet<PrintableVoucher>(`${base}/${encodeURIComponent(id)}/vouchers/${encodeURIComponent(voucherId)}/print`),
 cancel:(id:string,input:{commandKey:string;postingDate:string})=>crmPost<ServiceRow>(`${base}/${encodeURIComponent(id)}/cancel`,input),
};
