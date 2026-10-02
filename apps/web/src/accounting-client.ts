import { crmGet, crmPatch, crmPost } from './crm-core-client.js';

export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type FinancialAction = 'PAYMENT' | 'PAID_EXPENSE' | 'PARTY_NETTING' | 'COMMISSION_APPROVAL' | 'BOOKING_DISCOUNT' | 'SERVICE_DISCOUNT';
export interface AccountRow { id:string; code:string; name:string; classification:AccountClassification; active:boolean; postable:boolean; parentId?:string; controlType?:string }
export interface FiscalYearRow { id:string; startDate:string; endDate:string; status:'OPEN'|'CLOSED' }
export interface PeriodRow { id:string; fiscalYearId:string; startDate:string; endDate:string; status:'OPEN'|'CLOSED' }
export interface JournalLineRow { id:string; accountId:string; debit?:string; credit?:string; partyId?:string; costCenterId?:string }
export interface JournalRow { id:string; number:string; postingDate:string; kind:string; sourceType:string; sourceId:string; reversalOfId?:string; lines:readonly JournalLineRow[] }
export interface InvoiceLineRow {
  id:string; accountId:string; amount:string; taxAmount?:string; taxCode?:string;
  description?:string; quantity?:string; unitPrice?:string; discountMode?:'FIXED'|'PERCENT'; discount?:string; costCenterId?:string;
}
export interface InvoiceRow {
  id:string; branchId?:string; type:'CUSTOMER'|'SUPPLIER'|'AGENT'|'OPENING_CUSTOMER_BALANCE'; status:string; partyId:string; number:string;
  externalInvoiceNumber?:string; postingDate:string; dueDate?:string; recognitionDate?:string; paymentTerms?:string; currency:string; baseTotal:string;
  outstanding:string; controlAccountId:string; sourceType:string; sourceId:string; lines:readonly InvoiceLineRow[]; createdAt:string;
}
export interface TreasuryRow { id:string; code:string; name:string; type:'CASH'|'BANK'; currency:string; glAccountId:string; active:boolean }
export interface VoucherRow { id:string; branchId?:string; treasuryId:string; kind:'RECEIPT'|'PAYMENT'; partyKind:'CUSTOMER'|'SUPPLIER'|'AGENT'|'OWNER'; partyId:string; number:string; postingDate:string; currency:string; amount:string; status:string; sourceType:string; sourceId:string; allocationIds:readonly string[]; advanceId?:string; settlementId?:string; realizedFx?:string }
export interface TaxPolicyRow { id:string; code:string; effectiveFrom:string; rate:string; outputAccountId:string; inputAccountId:string }
export interface ApprovalPolicyRow { id:string; action:FinancialAction; threshold:string; active:boolean; forbidSelfApproval:boolean; requiredAuthority:string }
export interface ApprovalRequestRow { id:string; branchId?:string; action:FinancialAction; sourceType:string; sourceId:string; requesterActorId:string; amount:string; status:'PENDING'|'APPROVED'|'REJECTED'; requestedAt:string }
export interface ControlIssueRow { id:string; evidenceKey:string; sourceAmount:string; ledgerAmount:string; difference:string; detail:string; resolvedAt?:string; resolutionReference?:string }
export interface ReportRow { accountId?:string; accountClass?:string; currency:string; amount:string }
export interface AccountingOverview { fiscalYears:FiscalYearRow[]; periods:PeriodRow[]; accounts:AccountRow[]; journals:JournalRow[]; invoices:InvoiceRow[]; treasuries:TreasuryRow[]; vouchers:VoucherRow[]; taxPolicies:TaxPolicyRow[]; approvalPolicies:ApprovalPolicyRow[]; approvalRequests:ApprovalRequestRow[]; controlIssues:ControlIssueRow[]; reports:{trialBalance:{rows:ReportRow[]}; incomeStatement:{rows:ReportRow[]}; balanceSheet:{rows:ReportRow[]}; treasury:{totals:{currency:string;amount:string}[]}; tax:{totals:{currency:string;amount:string}[];facts:unknown[]}} }
export interface AccountingCapabilities { read:boolean; operate:boolean }
export interface CloseIssueRow { key:string; detail:string }
export interface DeferredCheckRow { key:string; label:string; status:string }
export interface PeriodCloseResult { closed:boolean; alreadyClosed:boolean; period:PeriodRow; ready:boolean; blockers:CloseIssueRow[]; warnings:CloseIssueRow[]; deferred:DeferredCheckRow[] }
export interface FiscalYearCloseResult { closed:boolean; alreadyClosed:boolean; fiscalYear:FiscalYearRow; blockers:CloseIssueRow[]; warnings:CloseIssueRow[]; deferred:DeferredCheckRow[]; journalId?:string }
export interface FiscalYearReopenResult { reopened:boolean; fiscalYear:FiscalYearRow; journalId?:string }
export interface BankLineRow { id:string; treasuryId:string; currency:string; signedAmount:string; valueDate:string; reference?:string; status:'UNMATCHED'|'AMBIGUOUS'|'MATCHED' }
export interface ChequeRow { id:string; voucherId:string; direction:'INCOMING'|'OUTGOING'; bankTreasuryId?:string; number:string; amount:string; currency:string; issueDate:string; dueDate?:string; status:'ISSUED'|'DEPOSITED'|'CLEARED'|'BOUNCED'|'VOIDED'; clearingReference?:string }
export interface OpeningLineInput { accountId:string; debit?:string; credit?:string; partyId?:string; costCenterId?:string }

export interface CostCenterRow { id:string; code:string; name:string; status:'ACTIVE'|'INACTIVE'; parentId?:string }
export interface ManualInvoiceReferences {
  accounts: AccountRow[];
  revenueAccounts: AccountRow[];
  customerControlAccountId?: string;
  agentControlAccountId?: string;
  defaultRevenueAccountId?: string;
  costCenters: CostCenterRow[];
}
export interface ManualInvoiceLineInput {
  id:string; description:string; quantity:string; unitPrice:string; discountMode:'FIXED'|'PERCENT'; discount:string;
  taxCode?:string; accountId:string; costCenterId?:string;
}
export interface ManualInvoiceInput {
  commandKey:string; type:'CUSTOMER'|'AGENT'; partyId:string; number:string; postingDate:string; dueDate?:string; recognitionDate?:string;
  paymentTerms?:string; currency:string; saveMode:'DRAFT'|'POSTED'; lines:ManualInvoiceLineInput[];
}
export interface InvoiceAdjustmentRow {
  id:string; invoiceId:string; kind:'CREDIT_NOTE'|'DEBIT_NOTE'|'WRITE_OFF'; amount:string; appliedAmount:string; advanceAmount:string; journalId:string;
}

const base = '/accounting';
const enc = encodeURIComponent;
export const accountingApi = {
  capabilities: () => crmGet<AccountingCapabilities>(base + '/capabilities'),
  overview: () => crmGet<AccountingOverview>(base + '/overview'),
  createAccount: (input:{code:string;name:string;classification:AccountClassification;postable:boolean;parentId?:string;controlType?:string}) => crmPost<AccountRow>(base + '/accounts', input),
  createFiscalYear: (input:{startDate:string;endDate:string}) => crmPost<FiscalYearRow>(base + '/fiscal-years', input),
  createPeriod: (input:{fiscalYearId:string;startDate:string;endDate:string}) => crmPost<PeriodRow>(base + '/periods', input),
  setPeriodStatus: (id:string,status:'OPEN'|'CLOSED') => crmPost<PeriodRow>(base + '/periods/' + enc(id) + '/status', {status}),
  closePeriod: (id:string,commandKey:string) => crmPost<PeriodCloseResult>(base + '/periods/' + enc(id) + '/close', {commandKey}),
  reopenPeriod: (id:string) => crmPost<PeriodRow>(base + '/periods/' + enc(id) + '/reopen', {}),
  closeFiscalYear: (id:string,input:{commandKey:string;retainedEarningsAccountId:string;number:string}) => crmPost<FiscalYearCloseResult>(base + '/fiscal-years/' + enc(id) + '/close', input),
  reopenFiscalYear: (id:string,input:{number:string;postingDate?:string}) => crmPost<FiscalYearReopenResult>(base + '/fiscal-years/' + enc(id) + '/reopen', input),
  postManualJournal: (input:{commandKey:string;number:string;postingDate:string;lines:{accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}[]}) => crmPost<JournalRow>(base + '/manual-journals', input),
  postOpeningBalances: (input:{commandKey:string;number:string;postingDate:string;lines:OpeningLineInput[]}) => crmPost<JournalRow>(base + '/opening-balances/ledger', input),
  postCustomerOpeningBalance: (input:{commandKey:string;partyId:string;number:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;lines:{accountId:string;amount:string}[]}) => crmPost<InvoiceRow>(base + '/opening-balances/customers', input),
  createInvoice: (input:{commandKey:string;type:'CUSTOMER'|'SUPPLIER';partyId:string;number:string;externalInvoiceNumber?:string;postingDate:string;dueDate?:string;currency:string;controlAccountId:string;deferred?:boolean;lines:{accountId:string;amount:string;taxCode?:string}[]}) => crmPost<InvoiceRow>(base + '/invoices', input),
  cancelInvoice: (id:string,input:{postingDate:string;number:string}) => crmPost<InvoiceRow>(base + '/invoices/' + enc(id) + '/cancel', input),

  ensureManualInvoiceSetup: () => crmPost<ManualInvoiceReferences>(base + '/manual-invoices/setup', {}),
  manualInvoiceReferences: () => crmGet<ManualInvoiceReferences>(base + '/manual-invoices/references'),
  createManualInvoice: (input:ManualInvoiceInput) => crmPost<InvoiceRow>(base + '/manual-invoices', input),
  editManualInvoice: (id:string,input:ManualInvoiceInput) => crmPatch<InvoiceRow>(base + '/manual-invoices/' + enc(id), input),
  postManualInvoice: (id:string) => crmPost<InvoiceRow>(base + '/manual-invoices/' + enc(id) + '/post', {}),
  cancelManualInvoice: (id:string,input:{postingDate?:string;number?:string}) => crmPost<InvoiceRow>(base + '/manual-invoices/' + enc(id) + '/cancel', input),
  getManualInvoice: (id:string) => crmGet<InvoiceRow>(base + '/manual-invoices/' + enc(id)),
  createManualInvoiceAdjustment: (id:string,input:{commandKey:string;kind:'CREDIT_NOTE'|'DEBIT_NOTE';amount:string;postingDate:string;number:string;offsetAccountId:string}) => crmPost<InvoiceAdjustmentRow>(base + '/manual-invoices/' + enc(id) + '/adjustments', input),

  createTreasury: (input:{code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string}) => crmPost<TreasuryRow>(base + '/treasuries', input),
  postSettlement: (input:{commandKey:string;invoiceId:string;treasuryId:string;number:string;postingDate:string;amount:string;advanceAccountId?:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string;approvalRequestId?:string}) => crmPost<VoucherRow>(base + '/settlements', input),
  reverseVoucher: (id:string,input:{postingDate:string;number:string}) => crmPost<VoucherRow>(base + '/vouchers/' + enc(id) + '/reverse', input),
  transferBetweenTreasuries: (input:{commandKey:string;sourceTreasuryId:string;destinationTreasuryId:string;amount:string;postingDate:string;number:string}) => crmPost(base + '/treasury/transfers', input),
  recordCashCount: (input:{commandKey:string;treasuryId:string;countedAmount:string;countDate:string;adjustmentAccountId?:string;number?:string}) => crmPost(base + '/treasury/cash-counts', input),
  importBankLine: (input:{commandKey:string;treasuryId:string;currency:string;signedAmount:string;valueDate:string;reference?:string}) => crmPost<BankLineRow>(base + '/treasury/bank-lines', input),
  listBankLines: (treasuryId:string) => crmGet<BankLineRow[]>(base + '/treasury/' + enc(treasuryId) + '/bank-lines'),
  manualMatchBankLine: (lineId:string,voucherId:string) => crmPost(base + '/treasury/bank-lines/' + enc(lineId) + '/manual-match', {voucherId}),
  listCheques: () => crmGet<ChequeRow[]>(base + '/treasury/cheques'),
  issueCheque: (input:{commandKey:string;voucherId:string;direction:'INCOMING'|'OUTGOING';bankTreasuryId?:string;number:string;amount:string;currency:string;issueDate:string;dueDate?:string}) => crmPost<ChequeRow>(base + '/treasury/cheques', input),
  transitionCheque: (id:string,input:{status:ChequeRow['status'];reference?:string}) => crmPost<ChequeRow>(base + '/treasury/cheques/' + enc(id) + '/status', input),
  configureTax: (input:{code:string;effectiveFrom:string;rate:string;outputAccountId:string;inputAccountId:string}) => crmPost<TaxPolicyRow>(base + '/tax/policies', input),
  configureApprovalPolicy: (input:{action:FinancialAction;threshold:string;active:boolean;forbidSelfApproval:boolean;requiredAuthority:string}) => crmPost<ApprovalPolicyRow>(base + '/controls/policies', input),
  decideApproval: (id:string,input:{outcome:'APPROVED'|'REJECTED';reason?:string}) => crmPost(base + '/controls/approvals/' + enc(id) + '/decision', input),
};
