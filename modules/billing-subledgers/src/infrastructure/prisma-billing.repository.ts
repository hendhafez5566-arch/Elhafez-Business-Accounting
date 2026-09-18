/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from '@prisma/client';
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

export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly db: PrismaClient) {}

  private inv(value: any): Invoice {
    return {
      ...value,
      postingDate: value.postingDate.toISOString().slice(0, 10),
      createdAt: value.createdAt.toISOString(),
      lines: value.lines.map((line: any) => ({
        ...line,
        amount: line.amount.toString(),
        taxAmount: line.taxAmount?.toString(),
      })),
      baseTotal: value.baseTotal.toString(),
      outstanding: value.outstanding.toString(),
    };
  }

  private allocation(value: any): Allocation {
    return {
      ...value,
      amount: value.amount.toString(),
      appliedAmount: value.appliedAmount.toString(),
      advanceAmount: value.advanceAmount.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private advanceValue(value: any): Advance {
    return {
      ...value,
      amount: value.amount.toString(),
      available: value.available.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private adjustmentValue(value: any): Adjustment {
    return {
      ...value,
      amount: value.amount.toString(),
      appliedAmount: value.appliedAmount.toString(),
      advanceAmount: value.advanceAmount.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private consumptionValue(value: any): AdvanceConsumption {
    return {
      ...value,
      amount: value.amount.toString(),
      reversedAt: value.reversedAt?.toISOString(),
    };
  }

  private async upsertAllocation(db: any, value: Allocation) {
    await db.billingAllocation.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        appliedAmount: value.appliedAmount,
        advanceAmount: value.advanceAmount,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
    });
  }

  private async upsertAdvance(db: any, value: Advance) {
    await db.billingAdvance.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        available: value.available,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
    });
  }

  private async upsertAdjustment(db: any, value: Adjustment) {
    await db.billingAdjustment.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        ...value,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
      },
      update: {
        appliedAmount: value.appliedAmount,
        advanceAmount: value.advanceAmount,
        reversedAt: value.reversedAt ? new Date(value.reversedAt) : null,
        advanceId: value.advanceId,
      },
    });
  }

  async invoice(companyId: CompanyId, id: string) {
    const value = await this.db.billingInvoice.findUnique({
      where: { companyId_id: { companyId, id } },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async invoiceBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingInvoice.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async supplierExternal(companyId: CompanyId, partyId: string, externalNumber: string) {
    const value = await this.db.billingInvoice.findFirst({
      where: { companyId, type: 'SUPPLIER', partyId, externalInvoiceNumber: externalNumber },
      include: { lines: true },
    });
    return value ? this.inv(value) : undefined;
  }

  async invoices(companyId: CompanyId) {
    return (
      await this.db.billingInvoice.findMany({ where: { companyId }, include: { lines: true } })
    ).map((value) => this.inv(value));
  }

  async saveInvoice(value: Invoice) {
    await this.db.$transaction(async (tx) => {
      await tx.billingInvoice.upsert({
        where: { companyId_id: { companyId: value.companyId, id: value.id } },
        create: {
          ...value,
          postingDate: new Date(value.postingDate),
          lines: undefined,
        },
        update: {
          status: value.status,
          baseTotal: value.baseTotal,
          outstanding: value.outstanding,
          fxRateId: value.fxRateId,
          journalId: value.journalId,
          reversalJournalId: value.reversalJournalId,
          recognitionReference: value.recognitionReference,
        },
      });
      for (const line of value.lines) {
        await tx.billingInvoiceLine.upsert({
          where: { companyId_id: { companyId: value.companyId, id: line.id } },
          create: { ...line, companyId: value.companyId, invoiceId: value.id },
          update: {
            taxSnapshotId: line.taxSnapshotId,
            taxAmount: line.taxAmount,
            taxAccountId: line.taxAccountId,
          },
        });
      }
    });
  }

  async markInvoicePosting(companyId: CompanyId, id: string) {
    const current = await this.invoice(companyId, id);
    if (!current) throw new ContractValidationError('invoice', 'not found');
    if (current.status === 'POSTING') return current;
    if (current.status !== 'DRAFT') throw new ContractValidationError('status', 'invoice cannot enter posting');
    const updated = await this.db.billingInvoice.updateMany({
      where: { companyId, id, status: 'DRAFT' },
      data: { status: 'POSTING' },
    });
    if (updated.count !== 1) {
      const concurrent = await this.invoice(companyId, id);
      if (concurrent?.status === 'POSTING') return concurrent;
      throw new ContractValidationError('concurrency', 'invoice posting state changed; retry');
    }
    return (await this.invoice(companyId, id))!;
  }

  async beginCancellation(companyId: CompanyId, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const raw = await tx.billingInvoice.findUnique({
          where: { companyId_id: { companyId, id } },
          include: { lines: true },
        });
        if (!raw) throw new ContractValidationError('invoice', 'not found');
        const current = this.inv(raw);
        if (current.status === 'CANCELLING') return current;
        if (current.status !== 'POSTED') {
          throw new ContractValidationError('status', 'only posted invoice may cancel');
        }
        const [activeAllocations, activeAdjustments] = await Promise.all([
          tx.billingAllocation.count({
            where: {
              companyId,
              invoiceId: id,
              reversedAt: null,
              appliedAmount: { gt: 0 },
            },
          }),
          tx.billingAdjustment.count({
            where: { companyId, invoiceId: id, reversedAt: null },
          }),
        ]);
        if (activeAllocations > 0 || activeAdjustments > 0) {
          throw new ContractValidationError('invoice', 'BLOCKED: active downstream billing effects');
        }
        const updated = await tx.billingInvoice.updateMany({
          where: { companyId, id, status: 'POSTED' },
          data: { status: 'CANCELLING' },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed while cancelling; retry');
        }
        return { ...current, status: 'CANCELLING' as const };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async finalizeInvoicePosting(value: Invoice, allocations: readonly Allocation[], advances: readonly Advance[]) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingInvoice.updateMany({
          where: { companyId: value.companyId, id: value.id, status: 'POSTING' },
          data: {
            status: value.status,
            baseTotal: value.baseTotal,
            outstanding: value.outstanding,
            fxRateId: value.fxRateId,
            journalId: value.journalId,
          },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed while posting; retry');
        }
        for (const line of value.lines) {
          await tx.billingInvoiceLine.update({
            where: { companyId_id: { companyId: value.companyId, id: line.id } },
            data: {
              taxSnapshotId: line.taxSnapshotId,
              taxAmount: line.taxAmount,
              taxAccountId: line.taxAccountId,
            },
          });
        }
        for (const allocation of allocations) await this.upsertAllocation(tx, allocation);
        for (const advance of advances) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async saveCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount) {
    await this.db.billingCreditLimit.upsert({
      where: { companyId_partyId: { companyId, partyId } },
      create: { companyId, partyId, amount },
      update: { amount },
    });
  }

  async creditLimit(companyId: CompanyId, partyId: string) {
    const value = await this.db.billingCreditLimit.findUnique({
      where: { companyId_partyId: { companyId, partyId } },
    });
    return value?.amount.toString() as DecimalAmount | undefined;
  }

  async allocationBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAllocation.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.allocation(value) : undefined;
  }

  async saveAllocation(value: Allocation) {
    await this.upsertAllocation(this.db, value);
  }

  async saveAllocationEffect(value: Allocation, invoiceBefore?: Invoice, invoiceAfter?: Invoice, advance?: Advance) {
    await this.db.$transaction(
      async (tx) => {
        if ((invoiceBefore === undefined) !== (invoiceAfter === undefined)) {
          throw new ContractValidationError('invoice', 'allocation effect requires both invoice states');
        }
        if (invoiceBefore && invoiceAfter) {
          const updated = await tx.billingInvoice.updateMany({
            where: {
              companyId: invoiceBefore.companyId,
              id: invoiceBefore.id,
              status: invoiceBefore.status,
              outstanding: invoiceBefore.outstanding,
            },
            data: { outstanding: invoiceAfter.outstanding },
          });
          if (updated.count !== 1) {
            throw new ContractValidationError('concurrency', 'invoice changed; retry allocation');
          }
        }
        await this.upsertAllocation(tx, value);
        if (advance) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async allocations(companyId: CompanyId, invoiceId?: string) {
    return (
      await this.db.billingAllocation.findMany({
        where: { companyId, ...(invoiceId ? { invoiceId } : {}) },
      })
    ).map((value) => this.allocation(value));
  }

  async advance(companyId: CompanyId, id: string) {
    const value = await this.db.billingAdvance.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value ? this.advanceValue(value) : undefined;
  }

  async advances(companyId: CompanyId, partyKind: PartyKind, partyId: string) {
    return (
      await this.db.billingAdvance.findMany({ where: { companyId, partyKind, partyId } })
    ).map((value) => this.advanceValue(value));
  }

  async saveAdvance(value: Advance) {
    await this.upsertAdvance(this.db, value);
  }

  async consumptionBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAdvanceConsumption.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.consumptionValue(value) : undefined;
  }

  async saveAdvanceConsumptionEffect(
    consumption: AdvanceConsumption,
    advanceBefore: Advance,
    advanceAfter: Advance,
  ) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingAdvance.updateMany({
          where: {
            companyId: advanceBefore.companyId,
            id: advanceBefore.id,
            available: advanceBefore.available,
            reversedAt: advanceBefore.reversedAt ? new Date(advanceBefore.reversedAt) : null,
          },
          data: {
            available: advanceAfter.available,
            reversedAt: advanceAfter.reversedAt ? new Date(advanceAfter.reversedAt) : null,
          },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'advance changed; retry consumption');
        }
        await tx.billingAdvanceConsumption.create({
          data: {
            ...consumption,
            reversedAt: consumption.reversedAt ? new Date(consumption.reversedAt) : null,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async adjustment(companyId: CompanyId, id: string) {
    const value = await this.db.billingAdjustment.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value ? this.adjustmentValue(value) : undefined;
  }

  async adjustmentBySource(companyId: CompanyId, sourceType: string, sourceId: string) {
    const value = await this.db.billingAdjustment.findUnique({
      where: { companyId_sourceType_sourceId: { companyId, sourceType, sourceId } },
    });
    return value ? this.adjustmentValue(value) : undefined;
  }

  async adjustments(companyId: CompanyId, invoiceId?: string) {
    return (
      await this.db.billingAdjustment.findMany({
        where: { companyId, ...(invoiceId ? { invoiceId } : {}) },
      })
    ).map((value) => this.adjustmentValue(value));
  }

  async saveAdjustment(value: Adjustment) {
    await this.upsertAdjustment(this.db, value);
  }

  async saveAdjustmentEffect(value: Adjustment, invoiceBefore: Invoice, invoiceAfter: Invoice, advance?: Advance) {
    await this.db.$transaction(
      async (tx) => {
        const updated = await tx.billingInvoice.updateMany({
          where: {
            companyId: invoiceBefore.companyId,
            id: invoiceBefore.id,
            status: invoiceBefore.status,
            outstanding: invoiceBefore.outstanding,
          },
          data: { outstanding: invoiceAfter.outstanding },
        });
        if (updated.count !== 1) {
          throw new ContractValidationError('concurrency', 'invoice changed; retry adjustment');
        }
        await this.upsertAdjustment(tx, value);
        if (advance) await this.upsertAdvance(tx, advance);
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
