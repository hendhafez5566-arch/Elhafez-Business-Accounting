import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type ExpenseForm = 'DIRECT_PAID' | 'SUPPLIER_PAYABLE' | 'PREPAID' | 'CANCELLATION_PENALTY';
export interface Expense {
  id: string; companyId: CompanyId; branchId?: string; form: ExpenseForm;
  sourceType: string; sourceId: string; currency: string; amount: DecimalAmount; baseAmount: DecimalAmount;
  status: 'DRAFT' | 'POSTED'; requestHash: string; expenseAccountId?: string; prepaidAccountId?: string;
  billingInvoiceId?: string; treasuryVoucherId?: string; journalId?: string; approvalRequestId?: string;
}
export interface SchedulePart { id: string; serviceDate: string; amount: DecimalAmount; status: 'PENDING'|'POSTED'|'REVERSED'; journalId?: string; reversalJournalId?: string }
export type RecognitionKind = 'PREPAID_EXPENSE'|'DEFERRED_REVENUE'|'DEFERRED_COST';
export interface RecognitionSchedule {
  id:string; companyId:CompanyId; kind:RecognitionKind; sourceType:string; sourceId:string; sourceInvoiceId?:string;
  currency:string; sourceAmount:DecimalAmount; baseAmount:DecimalAmount; deferredAccountId:string; recognitionAccountId:string;
  requestHash:string; initialJournalId?:string; parts:SchedulePart[];
}
export interface CommissionClaim {
  id:string; companyId:CompanyId; branchId?:string; agentPartyId:string; sourceType:string; sourceId:string;
  currency:string; amount:DecimalAmount; baseCarryingAmount:DecimalAmount;
  status:'DRAFT'|'APPROVED'|'PARTIALLY_PAID'|'PAID'|'REVERSED'; requestHash:string;
  approvalRequestId?:string; requesterActorId?:string; recognitionJournalId?:string; reversalJournalId?:string;
  expenseAccountId:string; liabilityAccountId:string; payments:CommissionPayment[];
}
export interface CommissionPayment {
  id:string; requestHash:string; status:'RESERVED'|'POSTED'; amount:DecimalAmount; paymentCurrency:string;
  /** Portion of the commission obligation settled, expressed in the claim currency. */
  claimAmountApplied:DecimalAmount;
  settlementBaseAmount:DecimalAmount; carryingBaseAmount:DecimalAmount; realizedFx:DecimalAmount;
  fxRateId?:string; treasuryVoucherId?:string;
}
export interface SupplierAdvanceSettlement {
  id:string; companyId:CompanyId; kind:'REFUND'|'CANCELLATION_PENALTY'; advanceId:string; supplierPartyId:string;
  amount:DecimalAmount; requestHash:string; status:'PROCESSING'|'RECOVERABLE_ERROR'|'POSTED';
  treasuryVoucherId?:string; journalId?:string; failureReason?:string;
}
export interface Accrual {
  id:string; companyId:CompanyId; sourceType:string; sourceId:string; amount:DecimalAmount; serviceDate:string;
  status:'POSTED'|'CLEARED'; journalId:string; requestHash:string; accruedRevenueAccountId:string; revenueAccountId:string;
  billingInvoiceId?:string; clearingJournalId?:string;
}
