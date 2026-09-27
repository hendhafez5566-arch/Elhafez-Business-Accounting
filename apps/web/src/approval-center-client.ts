import{crmGet,crmPost}from'./crm-core-client.js';

export type FinancialApprovalAction='PAYMENT'|'PAID_EXPENSE'|'PARTY_NETTING'|'COMMISSION_APPROVAL'|'BOOKING_DISCOUNT'|'SERVICE_DISCOUNT';
export interface FinancialApprovalRequest{readonly id:string;readonly branchId?:string;readonly action:FinancialApprovalAction;readonly sourceType:string;readonly sourceId:string;readonly requesterActorId:string;readonly amount:string;readonly status:'PENDING'|'APPROVED'|'REJECTED';readonly requestedAt:string}
export interface FinancialApprovalPolicy{readonly id:string;readonly action:FinancialApprovalAction;readonly threshold:string;readonly active:boolean;readonly forbidSelfApproval:boolean;readonly requiredAuthority:string}
export interface QuotationApproval{readonly id:string;readonly number:string;readonly status:string;readonly approvalStatus:'NOT_REQUIRED'|'PENDING'|'APPROVED'|'REJECTED';readonly customerSnapshot:{readonly displayName:string};readonly currency:string;readonly currentRevisionId:string;readonly revisions:readonly {readonly id:string;readonly total:string;readonly discountTotal:string;readonly createdAt?:string}[];readonly updatedAt?:string}
export interface ApprovalCenterData{readonly financial:readonly FinancialApprovalRequest[];readonly policies:readonly FinancialApprovalPolicy[];readonly quotations:readonly QuotationApproval[]}
export interface ApprovalCenterClient{
 load():Promise<ApprovalCenterData>;
 decideFinancial(id:string,outcome:'APPROVED'|'REJECTED',reason?:string):Promise<unknown>;
 decideQuotation(id:string,approved:boolean,reason:string):Promise<unknown>;
}
export class HttpApprovalCenterClient implements ApprovalCenterClient{
 async load(){const[financial,policies,quotations]=await Promise.all([crmGet<readonly FinancialApprovalRequest[]>('/accounting/controls/approvals'),crmGet<readonly FinancialApprovalPolicy[]>('/accounting/controls/policies'),crmGet<readonly QuotationApproval[]>('/crm/quotations?q=')]);return{financial,policies,quotations};}
 async decideFinancial(id:string,outcome:'APPROVED'|'REJECTED',reason?:string){return crmPost('/accounting/controls/approvals/'+encodeURIComponent(id)+'/decision',{outcome,...(reason?.trim()?{reason:reason.trim()}:{})});}
 async decideQuotation(id:string,approved:boolean,reason:string){return crmPost('/crm/quotations/'+encodeURIComponent(id)+'/approval',{approved,reason:reason.trim()});}
}
