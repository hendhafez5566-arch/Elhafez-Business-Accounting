import{crmGet,crmPost}from'./crm-core-client.js';

export type AccountClassification='ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE';
export type FinancialAction='PAYMENT'|'PAID_EXPENSE'|'PARTY_NETTING'|'COMMISSION_APPROVAL'|'BOOKING_DISCOUNT'|'SERVICE_DISCOUNT';
export interface AccountRow{id:string;code:string;name:string;classification:AccountClassification;active:boolean;postable:boolean;parentId?:string;controlType?:string}
export interface FiscalYearRow{id:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface PeriodRow{id:string;fiscalYearId:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface JournalLineRow{id:string;accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}
export interface JournalRow{id:string;number:string;postingDate:string;kind:string;sourceType:string;sourceId:string;reversalOfId?:string;lines:readonly JournalLineRow[]}
export interface InvoiceLineRow{id:string;accountId:string;amount:string;taxAmount?:string;taxCode?:string}
export interface InvoiceRow{id:string;branchId?:string;type:'CUSTOMER'|'SUPPLIER'|'AGENT'|'OPENING_CUSTOMER_BALANCE';status:string;partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;baseTotal:string;outstanding:string;controlAccountId:string;sourceType:string;sourceId:string;lines:readonly InvoiceLineRow[];createdAt:string}
export interface TreasuryRow{id:string;code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string;active:boolean}
export interface VoucherRow{id:string;branchId?:string;treasuryId:string;kind:'RECEIPT'|'PAYMENT';partyKind:'CUSTOMER'|'SUPPLIER'|'AGENT'|'OWNER';partyId:string;number:string;postingDate:string;currency:string;amount:string;status:string;sourceType:string;sourceId:string;allocationIds:readonly string[];advanceId?:string;settlementId?:string;realizedFx?:string}
export interface TaxPolicyRow{id:string;code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string}
export interface ApprovalPolicyRow{id:string;action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string}
export interface ApprovalRequestRow{id:string;branchId?:string;action:FinancialAction;sourceType:string;sourceId:string;requesterActorId:string;amount:string;status:'PENDING'|'APPROVED'|'REJECTED';requestedAt:string}
export interface ControlIssueRow{id:string;evidenceKey:string;sourceAmount:string;ledgerAmount:string;difference:string;detail:string;resolvedAt?:string;resolutionReference?:string}
export interface ReportRow{accountId?:string;accountClass?:string;currency:string;amount:string}
export interface AccountingOverview{
 fiscalYears:FiscalYearRow[];periods:PeriodRow[];accounts:AccountRow[];journals:JournalRow[];invoices:InvoiceRow[];treasuries:TreasuryRow[];vouchers:VoucherRow[];
 taxPolicies:TaxPolicyRow[];approvalPolicies:ApprovalPolicyRow[];approvalRequests:ApprovalRequestRow[];controlIssues:ControlIssueRow[];
 reports:{trialBalance:{rows:ReportRow[]};incomeStatement:{rows:ReportRow[]};balanceSheet:{rows:ReportRow[]};treasury:{totals:{currency:string;amount:string}[]};tax:{totals:{currency:string;amount:string}[];facts:unknown[]}};
}
export interface AccountingCapabilities{read:boolean;operate:boolean}
const base='/accounting';
export const accountingApi={
 capabilities:()=>crmGet<AccountingCapabilities>(base+'/capabilities'),
 overview:()=>crmGet<AccountingOverview>(base+'/overview'),
 createAccount:(input:{code:string;name:string;classification:AccountClassification;postable:boolean;parentId?:string;controlType?:string})=>crmPost<AccountRow>(base+'/accounts',input),
 createFiscalYear:(input:{startDate:string;endDate:string})=>crmPost<FiscalYearRow>(base+'/fiscal-years',input),
 createPeriod:(input:{fiscalYearId:string;startDate:string;endDate:string})=>crmPost<PeriodRow>(base+'/periods',input),
 setPeriodStatus:(id:string,status:'OPEN'|'CLOSED')=>crmPost<PeriodRow>(base+'/periods/'+encodeURIComponent(id)+'/status',{status}),
 postManualJournal:(input:{commandKey:string;number:string;postingDate:string;lines:{accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}[]})=>crmPost<JournalRow>(base+'/manual-journals',input),
 createInvoice:(input:{commandKey:string;type:'CUSTOMER'|'SUPPLIER';partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;deferred?:boolean;lines:{accountId:string;amount:string;taxCode?:string}[]})=>crmPost<InvoiceRow>(base+'/invoices',input),
 cancelInvoice:(id:string,input:{postingDate:string;number:string})=>crmPost<InvoiceRow>(base+'/invoices/'+encodeURIComponent(id)+'/cancel',input),
 createTreasury:(input:{code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string})=>crmPost<TreasuryRow>(base+'/treasuries',input),
 postSettlement:(input:{commandKey:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string;advanceAccountId?:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string;approvalRequestId?:string})=>crmPost<VoucherRow>(base+'/settlements',input),
 reverseVoucher:(id:string,input:{postingDate:string;number:string})=>crmPost<VoucherRow>(base+'/vouchers/'+encodeURIComponent(id)+'/reverse',input),
 configureTax:(input:{code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string})=>crmPost<TaxPolicyRow>(base+'/tax/policies',input),
 configureApprovalPolicy:(input:{action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string})=>crmPost<ApprovalPolicyRow>(base+'/controls/policies',input),
 decideApproval:(id:string,input:{outcome:'APPROVED'|'REJECTED';reason?:string})=>crmPost(base+'/controls/approvals/'+encodeURIComponent(id)+'/decision',input),
};