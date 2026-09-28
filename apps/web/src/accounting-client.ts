import{crmGet,crmPost}from'./crm-core-client.js';

export type AccountClassification='ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE';
export type FinancialAction='PAYMENT'|'PAID_EXPENSE'|'PARTY_NETTING'|'COMMISSION_APPROVAL'|'BOOKING_DISCOUNT'|'SERVICE_DISCOUNT';
export interface AccountRow{id:string;code:string;name:string;classification:AccountClassification;active:boolean;postable:boolean;parentId?:string;controlType?:string}
export interface FiscalYearRow{id:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface PeriodRow{id:string;fiscalYearId:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface JournalLineRow{id:string;accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}
export interface JournalRow{id:string;number:string;postingDate:string;kind:string;sourceType:string;sourceId:string;reversalOfId?:string;lines:readonly JournalLineRow[]}
export interface InvoiceRow{id:string;branchId?:string;type:'CUSTOMER'|'SUPPLIER'|'OPENING_CUSTOMER_BALANCE';status:string;partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;baseTotal:string;outstanding:string;controlAccountId:string}
export interface TreasuryRow{id:string;code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string;active:boolean}
export interface VoucherRow{id:string;branchId?:string;treasuryId:string;kind:string;partyId:string;number:string;postingDate:string;currency:string;amount:string;status:string}
export interface TreasuryTransferRow{id:string;sourceTreasuryId:string;destinationTreasuryId:string;amount:string;postingDate:string;number:string;status:string;journalId?:string}
export interface TreasuryChequeRow{id:string;voucherId:string;direction:'INCOMING'|'OUTGOING';bankTreasuryId?:string;number:string;amount:string;currency:string;issueDate:string;dueDate?:string;status:'ISSUED'|'DEPOSITED'|'CLEARED'|'BOUNCED'|'VOIDED';clearingReference?:string}
export interface TreasuryCashCountRow{id:string;treasuryId:string;countedAmount:string;bookAmount:string;difference:string;countDate:string;adjustmentAccountId?:string;adjustmentJournalId?:string}
export interface TreasuryBankLineRow{id:string;treasuryId:string;currency:string;signedAmount:string;valueDate:string;reference?:string;status:'UNMATCHED'|'AMBIGUOUS'|'MATCHED'}
export interface TreasuryBankMatchRow{id:string;lineId:string;voucherId:string;mode:'AUTO'|'MANUAL';actorId?:string;matchedAt:string}
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
 treasuryTransfers:()=>crmGet<TreasuryTransferRow[]>(base+'/treasury/transfers'),
 transferTreasury:(input:{commandKey:string;sourceTreasuryId:string;destinationTreasuryId:string;amount:string;postingDate:string;number:string})=>crmPost<TreasuryTransferRow>(base+'/treasury/transfers',input),
 getTreasuryCheque:(id:string)=>crmGet<TreasuryChequeRow>(base+'/treasury/cheques/'+encodeURIComponent(id)),
 issueTreasuryCheque:(input:{commandKey:string;voucherId:string;direction:'INCOMING'|'OUTGOING';bankTreasuryId?:string;number:string;amount:string;currency:string;issueDate:string;dueDate?:string})=>crmPost<TreasuryChequeRow>(base+'/treasury/cheques',input),
 transitionTreasuryCheque:(id:string,input:{status:'DEPOSITED'|'CLEARED'|'BOUNCED'|'VOIDED';reference?:string})=>crmPost<TreasuryChequeRow>(base+'/treasury/cheques/'+encodeURIComponent(id)+'/status',input),
 treasuryCashCounts:(treasuryId?:string)=>crmGet<TreasuryCashCountRow[]>(base+'/treasury/cash-counts'+(treasuryId?'?treasuryId='+encodeURIComponent(treasuryId):'')),
 recordTreasuryCashCount:(input:{commandKey:string;treasuryId:string;countedAmount:string;countDate:string;adjustmentAccountId?:string;number?:string})=>crmPost<TreasuryCashCountRow>(base+'/treasury/cash-counts',input),
 treasuryBankLines:(treasuryId:string)=>crmGet<TreasuryBankLineRow[]>(base+'/treasury/bank-lines/'+encodeURIComponent(treasuryId)),
 importTreasuryBankLine:(input:{commandKey:string;treasuryId:string;currency:string;signedAmount:string;valueDate:string;reference?:string})=>crmPost<TreasuryBankLineRow>(base+'/treasury/bank-lines',input),
 autoMatchTreasuryBankLine:(id:string)=>crmPost<TreasuryBankLineRow|TreasuryBankMatchRow>(base+'/treasury/bank-lines/'+encodeURIComponent(id)+'/auto-match',{}),
 manualMatchTreasuryBankLine:(id:string,voucherId:string)=>crmPost<TreasuryBankMatchRow>(base+'/treasury/bank-lines/'+encodeURIComponent(id)+'/manual-match',{voucherId}),
 configureTax:(input:{code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string})=>crmPost<TaxPolicyRow>(base+'/tax/policies',input),
 configureApprovalPolicy:(input:{action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string})=>crmPost<ApprovalPolicyRow>(base+'/controls/policies',input),
 decideApproval:(id:string,input:{outcome:'APPROVED'|'REJECTED';reason?:string})=>crmPost(base+'/controls/approvals/'+encodeURIComponent(id)+'/decision',input),
};
