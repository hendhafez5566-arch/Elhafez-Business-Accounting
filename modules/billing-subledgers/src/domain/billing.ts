import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type InvoiceType = 'CUSTOMER' | 'SUPPLIER' | 'AGENT' | 'OPENING_CUSTOMER_BALANCE';
export type InvoiceStatus = 'DRAFT' | 'POSTING' | 'POSTED' | 'CANCELLING' | 'CANCELLED';
export type PartyKind = 'CUSTOMER' | 'SUPPLIER' | 'AGENT';

export interface InvoiceLine {
  costCenterId?:string;
  id: string;
  accountId: string;
  amount: DecimalAmount;
  taxCode?: string;
  taxSnapshotId?: string;
  taxAmount?: DecimalAmount;
  taxAccountId?: string;
}

export interface Invoice {
  economicOperationKey?:string;
  financialDimensions?:InvoiceFinancialDimensions;
  id: string;
  companyId: CompanyId;
  branchId?: string;
  type: InvoiceType;
  status: InvoiceStatus;
  partyId: string;
  number: string;
  externalInvoiceNumber?: string;
  postingDate: string;
  /** Contractual due date used by BR-010. Never inferred from posting date. */
  dueDate?: string;
  currency: string;
  fxRateId?: string;
  sourceType: string;
  sourceId: string;
  requestHash: string;
  controlAccountId: string;
  lines: InvoiceLine[];
  baseTotal: DecimalAmount;
  outstanding: DecimalAmount;
  journalId?: string;
  reversalJournalId?: string;
  recognitionReference?: string;
  deferred?: boolean;
  createdAt: string;
}

export interface Allocation {
  id: string;
  companyId: CompanyId;
  partyKind: PartyKind;
  partyId: string;
  invoiceId?: string;
  amount: DecimalAmount;
  appliedAmount: DecimalAmount;
  advanceAmount: DecimalAmount;
  sourceType: string;
  sourceId: string;
  settlementId?: string;
  settlementSequence?: number;
  carryingBaseAmount?: DecimalAmount;
  settlementBaseAmount?: DecimalAmount;
  realizedFx?: DecimalAmount;
  settlementFxRateId?: string;
  prefundingBaseAmount?: DecimalAmount;
  prefundingAccountId?: string;
  reclassificationJournalId?: string;
  reclassificationReversalJournalId?: string;
  restrictionSourceType?: string;
  restrictionSourceId?: string;
  requestHash: string;
  reversedAt?: string;
}

export interface Advance {
  economicOperationKey?:string;
  baseCurrency?:string;
  liabilityAccountId?:string;
  id: string;
  companyId: CompanyId;
  partyKind: PartyKind;
  partyId: string;
  amount: DecimalAmount;
  available: DecimalAmount;
  sourceType: string;
  sourceId: string;
  restrictionSourceType?: string;
  restrictionSourceId?: string;
  generatedByAdjustmentId?: string;
  reversedAt?: string;
}

export interface AdvanceConsumption {
  status?:'RESERVED'|'POSTED';
  evidence?:{voucherId:string;journalId:string;paymentCurrency:string;paymentAmount:DecimalAmount;fxRateId?:string};
  id: string;
  companyId: CompanyId;
  advanceId: string;
  amount: DecimalAmount;
  sourceType: string;
  sourceId: string;
  reversedAt?: string;
}

export interface Adjustment {
  documentAmount?:DecimalAmount;documentCurrency?:string;costCenterId?:string;
  id: string;
  companyId: CompanyId;
  invoiceId: string;
  kind: 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'WRITE_OFF';
  amount: DecimalAmount;
  appliedAmount: DecimalAmount;
  advanceAmount: DecimalAmount;
  sourceType: string;
  sourceId: string;
  requestHash: string;
  journalId: string;
  advanceId?: string;
  reversedAt?: string;
}

export interface InvoiceFinancialDimensions {currentCostCenterId?:string;history:readonly {operationId:string;fromCostCenterId?:string;costCenterId:string;postingDate:string;number:string;amount:DecimalAmount;journalId?:string}[];}
export interface BillingFinancialOperation {id:string;companyId:CompanyId;invoiceId:string;kind:'ADJUSTMENT'|'ADJUSTMENT_REVERSAL'|'COST_CENTER_TRANSFER';sourceType:string;sourceId:string;requestHash:string;snapshot:BillingOperationSnapshot;plan?:unknown;result?:unknown;status:'PENDING'|'COMPLETED';}
export interface ReserveBillingFinancialOperation {id:string;companyId:CompanyId;invoiceId:string;kind:BillingFinancialOperation['kind'];sourceType:string;sourceId:string;requestHash:string;baseCurrency:string;basePrecision:number;documentPrecision:number;adjustmentInput?:BillingAdjustmentRequest;reversalAdjustmentId?:string;}
export interface CompleteBillingFinancialOperation {companyId:CompanyId;id:string;requestHash:string;invoice:Invoice;result:unknown;adjustment?:Adjustment;advance?:Advance;}

export interface BillingOperationSnapshot {invoice:Invoice;adjustments:readonly Adjustment[];baseCurrency:string;basePrecision:number;documentPrecision:number;reversedAdjustment?:Adjustment;generatedAdvance?:Advance;}
export interface BillingAdjustmentRequest {id:string;companyId:CompanyId;invoiceId:string;kind:'CREDIT_NOTE'|'DEBIT_NOTE'|'WRITE_OFF';amount:DecimalAmount;sourceType:string;sourceId:string;postingDate:string;number:string;offsetAccountId:string;advanceAccountId?:string;enforceNonNegativeCharge?:boolean;documentAmount?:DecimalAmount;reason?:string;}
export interface InvoiceAdjustmentPlan {amount:DecimalAmount;appliedAmount:DecimalAmount;advanceAmount:DecimalAmount;outstanding:DecimalAmount;costCenterId?:string;documentAmount?:DecimalAmount;documentCurrency?:string;}
