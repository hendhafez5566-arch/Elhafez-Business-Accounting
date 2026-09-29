import {crmGet,crmPost} from './crm-core-client.js';

export type CrmFinancialPartyKind='CUSTOMER'|'AGENT';
export interface CrmFinancialInvoice{id:string;branchId?:string;type:'CUSTOMER'|'AGENT'|'OPENING_CUSTOMER_BALANCE';status:string;partyId:string;number:string;postingDate:string;dueDate?:string;currency:string;baseTotal:string;outstanding:string;controlAccountId:string}
export interface CrmFinancialAdvance{id:string;companyId:string;partyKind:CrmFinancialPartyKind;partyId:string;amount:string;available:string;sourceType:string;sourceId:string;restrictionSourceType?:string;restrictionSourceId?:string}
export interface CrmFinancialState{partyKind:CrmFinancialPartyKind;partyId:string;baseCurrency:string;invoices:CrmFinancialInvoice[];advances:CrmFinancialAdvance[]}
export interface RefundApprovalResult{status:'NOT_REQUIRED'|'PENDING'|'APPROVED'|'REJECTED';request?:{id:string;status:string};decision?:{outcome:'APPROVED'|'REJECTED'};requirement:{decision:string;threshold?:string;requiredAuthority?:string}}
const base='/crm/financial';
export const crmFinancialApi={
 state:(partyKind:CrmFinancialPartyKind,partyId:string)=>crmGet<CrmFinancialState>(`${base}/${partyKind}/${encodeURIComponent(partyId)}`),
 createInvoice:(input:{commandKey:string;partyKind:CrmFinancialPartyKind;partyId:string;number:string;postingDate:string;dueDate:string;currency:string;controlAccountId:string;lines:{accountId:string;amount:string;taxCode?:string}[]})=>crmPost<CrmFinancialInvoice>(base+'/invoices',input),
 postReceipt:(input:{commandKey:string;partyKind:CrmFinancialPartyKind;partyId:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string})=>crmPost<{voucher:{id:string;number:string};allocation:{id:string}}>(base+'/receipts',input),
 requestRefundApproval:(input:{commandKey:string;partyKind:CrmFinancialPartyKind;amount:string})=>crmPost<RefundApprovalResult>(base+'/advance-refunds/approval-requests',input),
 refundAdvance:(input:{commandKey:string;partyKind:CrmFinancialPartyKind;partyId:string;advanceId:string;treasuryId:string;advanceAccountId:string;number:string;postingDate:string;amount:string;approvalRequestId?:string})=>crmPost<{voucher:{id:string;number:string};advance:CrmFinancialAdvance}>(base+'/advance-refunds',input),
};