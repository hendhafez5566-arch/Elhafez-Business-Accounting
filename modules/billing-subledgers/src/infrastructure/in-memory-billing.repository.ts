import { ContractValidationError, type CompanyId, type DecimalAmount } from '@elhafez/contracts';
import type { BillingRepository } from '../application/billing.repository.js';
import type {
  Advance,
  AdvanceConsumption,
  Adjustment,
  Allocation,
  Invoice,
  PartyKind,
} from '../domain/billing.js';

export class InMemoryBillingRepository implements BillingRepository {
  readonly invoiceValues: Invoice[] = [];
  readonly allocationValues: Allocation[] = [];
  readonly advanceValues: Advance[] = [];
  readonly adjustmentValues: Adjustment[] = [];
  readonly consumptionValues: AdvanceConsumption[] = [];
  readonly limits = new Map<string, DecimalAmount>();

  private replace<T extends { companyId: CompanyId; id: string }>(values: T[], value: T): void {
    const index = values.findIndex((x) => x.companyId === value.companyId && x.id === value.id);
    if (index < 0) values.push(value);
    else values[index] = value;
  }

  async invoice(companyId: CompanyId, id: string) {
    return this.invoiceValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async invoiceBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.invoiceValues.find((x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId);
  }

  async supplierExternal(companyId: CompanyId, partyId: string, externalNumber: string) {
    return this.invoiceValues.find(
      (x) =>
        x.companyId === companyId &&
        x.type === 'SUPPLIER' &&
        x.partyId === partyId &&
        x.externalInvoiceNumber === externalNumber,
    );
  }

  async invoices(companyId: CompanyId) {
    return this.invoiceValues.filter((x) => x.companyId === companyId);
  }

  async saveInvoice(value: Invoice) {
    this.replace(this.invoiceValues, value);
  }

  async markInvoicePosting(companyId: CompanyId, id: string) {
    const value = await this.invoice(companyId, id);
    if (!value) throw new ContractValidationError('invoice', 'not found');
    if (value.status === 'POSTING') return value;
    if (value.status !== 'DRAFT') throw new ContractValidationError('status', 'invoice cannot enter posting');
    const next = { ...value, status: 'POSTING' as const };
    this.replace(this.invoiceValues, next);
    return next;
  }

  async beginCancellation(companyId: CompanyId, id: string) {
    const value = await this.invoice(companyId, id);
    if (!value) throw new ContractValidationError('invoice', 'not found');
    if (value.status === 'CANCELLING') return value;
    if (value.status !== 'POSTED') throw new ContractValidationError('status', 'only posted invoice may cancel');
    const activeAllocation = this.allocationValues.some(
      (item) => item.companyId === companyId && item.invoiceId === id && !item.reversedAt && item.appliedAmount !== '0',
    );
    const activeAdjustment = this.adjustmentValues.some(
      (item) => item.companyId === companyId && item.invoiceId === id && !item.reversedAt,
    );
    if (activeAllocation || activeAdjustment) {
      throw new ContractValidationError('invoice', 'BLOCKED: active downstream billing effects');
    }
    const next = { ...value, status: 'CANCELLING' as const };
    this.replace(this.invoiceValues, next);
    return next;
  }

  async finalizeInvoicePosting(value: Invoice, allocations: readonly Allocation[], advances: readonly Advance[]) {
    this.replace(this.invoiceValues, value);
    for (const allocation of allocations) this.replace(this.allocationValues, allocation);
    for (const advance of advances) this.replace(this.advanceValues, advance);
  }

  async saveCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount) {
    this.limits.set(`${companyId}:${partyId}`, amount);
  }

  async creditLimit(companyId: CompanyId, partyId: string) {
    return this.limits.get(`${companyId}:${partyId}`);
  }

  async allocationBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.allocationValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async saveAllocation(value: Allocation) {
    this.replace(this.allocationValues, value);
  }

  async saveAllocationEffect(value: Allocation, invoiceBefore?: Invoice, invoiceAfter?: Invoice, advance?: Advance) {
    if ((invoiceBefore === undefined) !== (invoiceAfter === undefined)) {
      throw new ContractValidationError('invoice', 'allocation effect requires both invoice states');
    }
    if (invoiceBefore && invoiceAfter) {
      const current = await this.invoice(invoiceBefore.companyId, invoiceBefore.id);
      if (!current || current.outstanding !== invoiceBefore.outstanding || current.status !== invoiceBefore.status) {
        throw new ContractValidationError('concurrency', 'invoice changed; retry allocation');
      }
      this.replace(this.invoiceValues, invoiceAfter);
    }
    this.replace(this.allocationValues, value);
    if (advance) this.replace(this.advanceValues, advance);
  }

  async allocations(companyId: CompanyId, invoiceId?: string) {
    return this.allocationValues.filter(
      (x) => x.companyId === companyId && (!invoiceId || x.invoiceId === invoiceId),
    );
  }

  async advance(companyId: CompanyId, id: string) {
    return this.advanceValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async advances(companyId: CompanyId, partyKind: PartyKind, partyId: string) {
    return this.advanceValues.filter(
      (x) => x.companyId === companyId && x.partyKind === partyKind && x.partyId === partyId,
    );
  }

  async saveAdvance(value: Advance) {
    this.replace(this.advanceValues, value);
  }

  async consumptionBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.consumptionValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async saveAdvanceConsumptionEffect(
    consumption: AdvanceConsumption,
    advanceBefore: Advance,
    advanceAfter: Advance,
  ) {
    const current = await this.advance(advanceBefore.companyId, advanceBefore.id);
    if (!current || current.available !== advanceBefore.available || current.reversedAt !== advanceBefore.reversedAt) {
      throw new ContractValidationError('concurrency', 'advance changed; retry consumption');
    }
    this.replace(this.advanceValues, advanceAfter);
    this.replace(this.consumptionValues, consumption);
  }

  async adjustment(companyId: CompanyId, id: string) {
    return this.adjustmentValues.find((x) => x.companyId === companyId && x.id === id);
  }

  async adjustmentBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    return this.adjustmentValues.find(
      (x) => x.companyId === companyId && x.sourceType === sourceType && x.sourceId === sourceId,
    );
  }

  async adjustments(companyId: CompanyId, invoiceId?: string) {
    return this.adjustmentValues.filter(
      (x) => x.companyId === companyId && (!invoiceId || x.invoiceId === invoiceId),
    );
  }

  async saveAdjustment(value: Adjustment) {
    this.replace(this.adjustmentValues, value);
  }

  async saveAdjustmentEffect(value: Adjustment, invoiceBefore: Invoice, invoiceAfter: Invoice, advance?: Advance) {
    const current = await this.invoice(invoiceBefore.companyId, invoiceBefore.id);
    if (!current || current.outstanding !== invoiceBefore.outstanding || current.status !== invoiceBefore.status) {
      throw new ContractValidationError('concurrency', 'invoice changed; retry adjustment');
    }
    this.replace(this.invoiceValues, invoiceAfter);
    this.replace(this.adjustmentValues, value);
    if (advance) this.replace(this.advanceValues, advance);
  }
}
