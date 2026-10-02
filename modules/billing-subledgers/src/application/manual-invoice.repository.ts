import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type { InvoiceDiscountMode, InvoiceType } from '../domain/billing.js';

export interface ManualInvoiceLineMetadata {
  id: string;
  accountId: string;
  description: string;
  quantity: DecimalAmount;
  unitPrice: DecimalAmount;
  discountMode: InvoiceDiscountMode;
  discount: DecimalAmount;
  amount: DecimalAmount;
  taxCode?: string;
  costCenterId?: string;
}

export interface ManualInvoiceMetadata {
  companyId: CompanyId;
  invoiceId: string;
  type: InvoiceType;
  recognitionDate?: string;
  paymentTerms?: string;
  lines: ManualInvoiceLineMetadata[];
}

export interface ManualInvoiceDraftCore {
  companyId: CompanyId;
  invoiceId: string;
  partyId: string;
  number: string;
  postingDate: string;
  dueDate?: string;
  currency: string;
  controlAccountId: string;
  requestHash: string;
  lines: Array<{
    id: string;
    accountId: string;
    amount: DecimalAmount;
    taxCode?: string;
  }>;
}

export const MANUAL_INVOICE_REPOSITORY = Symbol('MANUAL_INVOICE_REPOSITORY');

export interface ManualInvoiceRepository {
  metadata(companyId: CompanyId, invoiceId: string): Promise<ManualInvoiceMetadata | undefined>;
  saveMetadata(value: ManualInvoiceMetadata): Promise<void>;
  replaceDraft(value: ManualInvoiceDraftCore): Promise<void>;
  cancelDraft(companyId: CompanyId, invoiceId: string): Promise<void>;
}
