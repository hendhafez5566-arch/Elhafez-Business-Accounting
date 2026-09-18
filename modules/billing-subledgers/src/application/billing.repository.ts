import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type {
  Advance,
  AdvanceConsumption,
  Adjustment,
  Allocation,
  Invoice,
  PartyKind,
} from '../domain/billing.js';

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');

export interface BillingRepository {
  invoice(companyId: CompanyId, id: string): Promise<Invoice | undefined>;
  invoiceBySource(companyId: CompanyId, sourceType: string, sourceId: string): Promise<Invoice | undefined>;
  supplierExternal(companyId: CompanyId, partyId: string, externalNumber: string): Promise<Invoice | undefined>;
  invoices(companyId: CompanyId): Promise<Invoice[]>;
  saveInvoice(value: Invoice): Promise<void>;
  finalizeInvoicePosting(value: Invoice, allocations: readonly Allocation[], advances: readonly Advance[]): Promise<void>;

  saveCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount): Promise<void>;
  creditLimit(companyId: CompanyId, partyId: string): Promise<DecimalAmount | undefined>;

  allocationBySource(companyId: CompanyId, sourceType: string, sourceId: string): Promise<Allocation | undefined>;
  saveAllocation(value: Allocation): Promise<void>;
  saveAllocationEffect(
    value: Allocation,
    invoiceBefore?: Invoice,
    invoiceAfter?: Invoice,
    advance?: Advance,
  ): Promise<void>;
  allocations(companyId: CompanyId, invoiceId?: string): Promise<Allocation[]>;

  advance(companyId: CompanyId, id: string): Promise<Advance | undefined>;
  advances(companyId: CompanyId, partyKind: PartyKind, partyId: string): Promise<Advance[]>;
  saveAdvance(value: Advance): Promise<void>;

  consumptionBySource(companyId: CompanyId, sourceType: string, sourceId: string): Promise<AdvanceConsumption | undefined>;
  saveAdvanceConsumptionEffect(
    consumption: AdvanceConsumption,
    advanceBefore: Advance,
    advanceAfter: Advance,
  ): Promise<void>;

  adjustment(companyId: CompanyId, id: string): Promise<Adjustment | undefined>;
  adjustmentBySource(companyId: CompanyId, sourceType: string, sourceId: string): Promise<Adjustment | undefined>;
  adjustments(companyId: CompanyId, invoiceId?: string): Promise<Adjustment[]>;
  saveAdjustment(value: Adjustment): Promise<void>;
  saveAdjustmentEffect(
    value: Adjustment,
    invoiceBefore: Invoice,
    invoiceAfter: Invoice,
    advance?: Advance,
  ): Promise<void>;
}
