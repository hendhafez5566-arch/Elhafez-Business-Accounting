import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export interface InvoiceRevenueAllocation {
  readonly id: string;
  readonly companyId: CompanyId;
  readonly scheduleId: string;
  readonly accountId: string;
  readonly amount: DecimalAmount;
}

export const INVOICE_REVENUE_RECOGNITION_REPOSITORY = Symbol('INVOICE_REVENUE_RECOGNITION_REPOSITORY');

export interface InvoiceRevenueRecognitionRepository {
  listAllocations(companyId: CompanyId, scheduleId: string): Promise<InvoiceRevenueAllocation[]>;
  saveAllocations(values: readonly InvoiceRevenueAllocation[]): Promise<void>;
}
