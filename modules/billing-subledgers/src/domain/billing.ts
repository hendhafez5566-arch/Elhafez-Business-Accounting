import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type InvoiceType = 'CUSTOMER' | 'SUPPLIER' | 'AGENT' | 'OPENING_CUSTOMER_BALANCE';
export type InvoiceStatus = 'DRAFT' | 'POSTING' | 'POSTED' | 'CANCELLING' | 'CANCELLED';
export type PartyKind = 'CUSTOMER' | 'SUPPLIER' | 'AGENT';
export type InvoiceDiscountMode = 'FIXED' | 'PERCENT';

export interface InvoiceLine {
  id: string;
  accountId: string;
  /** Canonical net amount before tax, after quantity/price/discount calculation. */
  amount: DecimalAmount;
  description?: string;
  quantity?: DecimalAmount;
  unitPrice?: DecimalAmount;
  discountMode?: InvoiceDiscountMode;
  discount?: DecimalAmount;
  costCenterId?: string;
  taxCode?: string;
  taxSnapshotId?: string;
  taxAmount?: DecimalAmount;
  taxAccountId?: string;
}

export interface Invoice {
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
  /** Commercial/service recognition date preserved from the user workflow. */
  recognitionDate?: string;
  /** User-entered payment terms or invoice notes. */
  paymentTerms?: string;
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
  id: string;
  companyId: CompanyId;
  advanceId: string;
  amount: DecimalAmount;
  sourceType: string;
  sourceId: string;
  reversedAt?: string;
}

export interface Adjustment {
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
