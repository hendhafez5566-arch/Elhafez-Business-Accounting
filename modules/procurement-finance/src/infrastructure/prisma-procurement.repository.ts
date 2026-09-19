import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ContractValidationError,
  companyId,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { ProcurementRepository } from '../application/procurement.repository.js';
import type {
  InvoiceConversion,
  ProcurementHistory,
  ProcurementPolicy,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  SupplierCommitment,
} from '../domain/procurement.js';

type DbClient = PrismaClient | Prisma.TransactionClient;
type QuantityRow = {
  orderedQuantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
  invoicedQuantity: Prisma.Decimal;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toAmount(value: Prisma.Decimal | string | number): DecimalAmount {
  return decimalAmount(String(value));
}

function derivedStatus(lines: QuantityRow[]): PurchaseOrderStatus {
  const hasInvoiced = lines.some((line) => line.invoicedQuantity.gt(0));
  const fullyInvoiced = lines.every((line) =>
    line.invoicedQuantity.equals(line.orderedQuantity),
  );
  if (fullyInvoiced) return 'INVOICED';
  if (hasInvoiced) return 'PARTIALLY_INVOICED';

  const hasReceived = lines.some((line) => line.receivedQuantity.gt(0));
  const fullyReceived = lines.every((line) =>
    line.receivedQuantity.equals(line.orderedQuantity),
  );
  if (fullyReceived) return 'RECEIVED';
  if (hasReceived) return 'PARTIALLY_RECEIVED';
  return 'APPROVED';
}

export class PrismaProcurementRepository implements ProcurementRepository {
  constructor(private readonly db: PrismaClient) {}

  private policyValue(row: {
    companyId: string;
    commitmentTiming: string;
    version: number;
    effectiveFrom: Date;
    requestHash: string;
  }): ProcurementPolicy {
    return {
      companyId: companyId(row.companyId),
      commitmentTiming: row.commitmentTiming as 'ON_PO_APPROVAL',
      version: row.version,
      effectiveFrom: dateOnly(row.effectiveFrom),
      requestHash: row.requestHash,
    };
  }

  private commitmentValue(row: {
    id: string;
    companyId: string;
    supplierId: string;
    sourceType: string;
    sourceId: string;
    status: string;
    effectiveDate: Date;
    cancelledAt: Date | null;
    cancelReason: string | null;
    requestHash: string;
    createdAt: Date;
  }): SupplierCommitment {
    return {
      id: row.id,
      companyId: companyId(row.companyId),
      supplierId: row.supplierId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      status: row.status as SupplierCommitment['status'],
      effectiveDate: dateOnly(row.effectiveDate),
      ...(row.cancelledAt ? { cancelledAt: row.cancelledAt.toISOString() } : {}),
      ...(row.cancelReason ? { cancelReason: row.cancelReason } : {}),
      requestHash: row.requestHash,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private poValue(row: {
    id: string;
    companyId: string;
    commitmentId: string | null;
    supplierId: string;
    number: string;
    origin: string;
    status: string;
    requestHash: string;
    createdAt: Date;
    lines: Array<{
      id: string;
      companyId: string;
      purchaseOrderId: string;
      itemReference: string;
      orderedQuantity: Prisma.Decimal;
      receivedQuantity: Prisma.Decimal;
      invoicedQuantity: Prisma.Decimal;
    }>;
  }): PurchaseOrder {
    return {
      id: row.id,
      companyId: companyId(row.companyId),
      ...(row.commitmentId ? { commitmentId: row.commitmentId } : {}),
      supplierId: row.supplierId,
      number: row.number,
      origin: row.origin as PurchaseOrder['origin'],
      status: row.status as PurchaseOrderStatus,
      requestHash: row.requestHash,
      createdAt: row.createdAt.toISOString(),
      lines: row.lines.map(
        (line): PurchaseOrderLine => ({
          id: line.id,
          companyId: companyId(line.companyId),
          purchaseOrderId: line.purchaseOrderId,
          itemReference: line.itemReference,
          orderedQuantity: toAmount(line.orderedQuantity),
          receivedQuantity: toAmount(line.receivedQuantity),
          invoicedQuantity: toAmount(line.invoicedQuantity),
        }),
      ),
    };
  }

  private conversionValue(row: {
    id: string;
    companyId: string;
    purchaseOrderId: string;
    lineId: string;
    billingInvoiceId: string;
    quantity: Prisma.Decimal;
    reopenedQuantity: Prisma.Decimal;
    requestHash: string;
    status: string;
    createdAt: Date;
  }): InvoiceConversion {
    return {
      id: row.id,
      companyId: companyId(row.companyId),
      purchaseOrderId: row.purchaseOrderId,
      lineId: row.lineId,
      billingInvoiceId: row.billingInvoiceId,
      quantity: toAmount(row.quantity),
      reopenedQuantity: toAmount(row.reopenedQuantity),
      requestHash: row.requestHash,
      status: row.status as InvoiceConversion['status'],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private historyValue(row: {
    id: string;
    companyId: string;
    aggregateId: string;
    kind: string;
    sourceReference: string | null;
    createdAt: Date;
  }): ProcurementHistory {
    return {
      id: row.id,
      companyId: companyId(row.companyId),
      aggregateId: row.aggregateId,
      kind: row.kind,
      ...(row.sourceReference ? { sourceReference: row.sourceReference } : {}),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async poWith(
    client: DbClient,
    companyIdValue: CompanyId,
    id: string,
  ): Promise<PurchaseOrder | undefined> {
    const row = await client.procPurchaseOrder.findUnique({
      where: { companyId_id: { companyId: companyIdValue, id } },
      include: { lines: true },
    });
    return row ? this.poValue(row) : undefined;
  }

  async policy(companyIdValue: CompanyId) {
    const row = await this.db.procPolicy.findUnique({
      where: { companyId: companyIdValue },
    });
    return row ? this.policyValue(row) : undefined;
  }

  async savePolicy(value: ProcurementPolicy) {
    const old = await this.db.procPolicy.findUnique({
      where: { companyId: value.companyId },
    });
    if (old) {
      if (old.requestHash !== value.requestHash) {
        throw new ContractValidationError('policy', 'conflicting replay');
      }
      return this.policyValue(old);
    }

    try {
      const created = await this.db.procPolicy.create({
        data: {
          companyId: value.companyId,
          commitmentTiming: value.commitmentTiming,
          version: value.version,
          effectiveFrom: new Date(value.effectiveFrom),
          requestHash: value.requestHash,
        },
      });
      return this.policyValue(created);
    } catch (error) {
      const replay = await this.policy(value.companyId);
      if (replay?.requestHash === value.requestHash) return replay;
      throw error;
    }
  }

  async commitment(companyIdValue: CompanyId, id: string) {
    const row = await this.db.procSupplierCommitment.findUnique({
      where: { companyId_id: { companyId: companyIdValue, id } },
    });
    return row ? this.commitmentValue(row) : undefined;
  }

  async commitmentBySource(companyIdValue: CompanyId, type: string, id: string) {
    const row = await this.db.procSupplierCommitment.findUnique({
      where: {
        companyId_sourceType_sourceId: {
          companyId: companyIdValue,
          sourceType: type,
          sourceId: id,
        },
      },
    });
    return row ? this.commitmentValue(row) : undefined;
  }

  async saveCommitment(value: SupplierCommitment, entry: ProcurementHistory) {
    const collision = await this.db.procSupplierCommitment.findUnique({
      where: { id: value.id },
    });
    if (collision) {
      if (collision.companyId !== value.companyId) {
        throw new ContractValidationError('commitment', 'company collision');
      }
      if (collision.requestHash !== value.requestHash) {
        throw new ContractValidationError('commitment', 'conflicting replay');
      }
      return this.commitmentValue(collision);
    }

    const source = await this.commitmentBySource(
      value.companyId,
      value.sourceType,
      value.sourceId,
    );
    if (source) {
      if (source.requestHash !== value.requestHash) {
        throw new ContractValidationError('source', 'conflicting replay');
      }
      return source;
    }

    try {
      await this.db.$transaction([
        this.db.procSupplierCommitment.create({
          data: {
            id: value.id,
            companyId: value.companyId,
            supplierId: value.supplierId,
            sourceType: value.sourceType,
            sourceId: value.sourceId,
            status: value.status,
            effectiveDate: new Date(value.effectiveDate),
            cancelledAt: value.cancelledAt ? new Date(value.cancelledAt) : undefined,
            cancelReason: value.cancelReason,
            requestHash: value.requestHash,
            createdAt: new Date(value.createdAt),
          },
        }),
        this.db.procCommitmentHistory.create({
          data: {
            id: entry.id,
            companyId: entry.companyId,
            aggregateId: entry.aggregateId,
            kind: entry.kind,
            sourceReference: entry.sourceReference,
            createdAt: new Date(entry.createdAt),
          },
        }),
      ]);
      return value;
    } catch (error) {
      const replay = await this.commitmentBySource(
        value.companyId,
        value.sourceType,
        value.sourceId,
      );
      if (replay?.requestHash === value.requestHash) return replay;
      throw error;
    }
  }

  async cancelCommitment(
    companyIdValue: CompanyId,
    id: string,
    reason: string,
    at: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const row = await tx.procSupplierCommitment.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id } },
        });
        if (!row) throw new ContractValidationError('commitment', 'not found');
        if (row.status === 'CANCELLED') return this.commitmentValue(row);

        const updated = await tx.procSupplierCommitment.update({
          where: { companyId_id: { companyId: companyIdValue, id } },
          data: {
            status: 'CANCELLED',
            cancelReason: reason,
            cancelledAt: new Date(at),
          },
        });
        const historyId = `${id}:cancel`;
        const oldHistory = await tx.procCommitmentHistory.findUnique({
          where: { id: historyId },
        });
        if (!oldHistory) {
          await tx.procCommitmentHistory.create({
            data: {
              id: historyId,
              companyId: companyIdValue,
              aggregateId: id,
              kind: 'CANCELLED',
              createdAt: new Date(at),
            },
          });
        }
        return this.commitmentValue(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async po(companyIdValue: CompanyId, id: string) {
    return this.poWith(this.db, companyIdValue, id);
  }

  async posByCommitment(companyIdValue: CompanyId, commitmentId: string) {
    const rows = await this.db.procPurchaseOrder.findMany({
      where: { companyId: companyIdValue, commitmentId },
      include: { lines: true },
    });
    return rows.map((row) => this.poValue(row));
  }

  async poByNumber(companyIdValue: CompanyId, number: string) {
    const row = await this.db.procPurchaseOrder.findUnique({
      where: { companyId_number: { companyId: companyIdValue, number } },
      include: { lines: true },
    });
    return row ? this.poValue(row) : undefined;
  }

  async savePo(value: PurchaseOrder, entry: ProcurementHistory) {
    const collision = await this.db.procPurchaseOrder.findUnique({
      where: { id: value.id },
      include: { lines: true },
    });
    if (collision) {
      if (collision.companyId !== value.companyId) {
        throw new ContractValidationError('purchaseOrder', 'company collision');
      }
      if (collision.requestHash !== value.requestHash) {
        throw new ContractValidationError('purchaseOrder', 'conflicting replay');
      }
      return this.poValue(collision);
    }

    try {
      await this.db.$transaction([
        this.db.procPurchaseOrder.create({
          data: {
            id: value.id,
            companyId: value.companyId,
            commitmentId: value.commitmentId,
            supplierId: value.supplierId,
            number: value.number,
            origin: value.origin,
            status: value.status,
            requestHash: value.requestHash,
            createdAt: new Date(value.createdAt),
            lines: {
              create: value.lines.map((line) => ({
                id: line.id,
                companyId: line.companyId,
                itemReference: line.itemReference,
                orderedQuantity: line.orderedQuantity,
                receivedQuantity: line.receivedQuantity,
                invoicedQuantity: line.invoicedQuantity,
              })),
            },
          },
        }),
        this.db.procPoHistory.create({
          data: {
            id: entry.id,
            companyId: entry.companyId,
            aggregateId: entry.aggregateId,
            kind: entry.kind,
            sourceReference: entry.sourceReference,
            createdAt: new Date(entry.createdAt),
          },
        }),
      ]);
      return value;
    } catch (error) {
      const replay = await this.po(value.companyId, value.id);
      if (replay?.requestHash === value.requestHash) return replay;
      const number = await this.poByNumber(value.companyId, value.number);
      if (number) throw new ContractValidationError('number', 'already used');
      throw error;
    }
  }

  async approvePo(
    companyIdValue: CompanyId,
    id: string,
    poHistory: ProcurementHistory,
    commitmentHistory?: ProcurementHistory,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const po = await tx.procPurchaseOrder.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id } },
          include: { lines: true },
        });
        if (!po) throw new ContractValidationError('purchaseOrder', 'not found');
        if (po.status === 'APPROVED') return this.poValue(po);
        if (po.status !== 'DRAFT') {
          throw new ContractValidationError('status', 'unsupported transition');
        }

        if (po.commitmentId) {
          const commitment = await tx.procSupplierCommitment.findUnique({
            where: {
              companyId_id: {
                companyId: companyIdValue,
                id: po.commitmentId,
              },
            },
          });
          if (!commitment || commitment.supplierId !== po.supplierId) {
            throw new ContractValidationError(
              'commitment',
              'same-company matching commitment required',
            );
          }
          if (commitment.status === 'CANCELLED') {
            throw new ContractValidationError(
              'commitment',
              'cancelled commitment cannot approve PO',
            );
          }
          if (commitment.status !== 'COMMITTED') {
            await tx.procSupplierCommitment.update({
              where: {
                companyId_id: {
                  companyId: companyIdValue,
                  id: commitment.id,
                },
              },
              data: { status: 'COMMITTED' },
            });
            if (commitmentHistory) {
              await tx.procCommitmentHistory.create({
                data: {
                  id: commitmentHistory.id,
                  companyId: commitmentHistory.companyId,
                  aggregateId: commitmentHistory.aggregateId,
                  kind: commitmentHistory.kind,
                  sourceReference: commitmentHistory.sourceReference,
                  createdAt: new Date(commitmentHistory.createdAt),
                },
              });
            }
          }
        }

        await tx.procPurchaseOrder.update({
          where: { companyId_id: { companyId: companyIdValue, id } },
          data: { status: 'APPROVED' },
        });
        await tx.procPoHistory.create({
          data: {
            id: poHistory.id,
            companyId: poHistory.companyId,
            aggregateId: poHistory.aggregateId,
            kind: poHistory.kind,
            sourceReference: poHistory.sourceReference,
            createdAt: new Date(poHistory.createdAt),
          },
        });

        return (await this.poWith(tx, companyIdValue, id))!;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transitionPo(
    companyIdValue: CompanyId,
    id: string,
    from: string[],
    to: string,
    entry: ProcurementHistory,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const po = await tx.procPurchaseOrder.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id } },
          include: { lines: true },
        });
        if (!po) throw new ContractValidationError('purchaseOrder', 'not found');
        if (po.status === to) return this.poValue(po);
        if (!from.includes(po.status)) {
          throw new ContractValidationError('status', 'unsupported transition');
        }

        await tx.procPurchaseOrder.update({
          where: { companyId_id: { companyId: companyIdValue, id } },
          data: { status: to },
        });
        await tx.procPoHistory.create({
          data: {
            id: entry.id,
            companyId: entry.companyId,
            aggregateId: entry.aggregateId,
            kind: entry.kind,
            sourceReference: entry.sourceReference,
            createdAt: new Date(entry.createdAt),
          },
        });
        return (await this.poWith(tx, companyIdValue, id))!;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async receive(
    companyIdValue: CompanyId,
    poId: string,
    lineId: string,
    quantity: DecimalAmount,
    commandId: string,
    requestHash: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const historyId = `${poId}:receipt:${commandId}`;
        const replay = await tx.procPoHistory.findUnique({ where: { id: historyId } });
        if (replay) {
          if (
            replay.companyId !== companyIdValue ||
            replay.requestHash !== requestHash
          ) {
            throw new ContractValidationError('command', 'conflicting replay');
          }
          return (await this.poWith(tx, companyIdValue, poId))!;
        }

        const po = await tx.procPurchaseOrder.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id: poId } },
        });
        if (
          !po ||
          !['APPROVED', 'PARTIALLY_RECEIVED', 'PARTIALLY_INVOICED'].includes(
            po.status,
          )
        ) {
          throw new ContractValidationError('purchaseOrder', 'not receivable');
        }

        const line = await tx.procPurchaseOrderLine.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id: lineId } },
        });
        if (!line || line.purchaseOrderId !== poId) {
          throw new ContractValidationError('line', 'not found');
        }

        const increment = new Prisma.Decimal(quantity);
        const maximumBefore = line.orderedQuantity.sub(increment);
        if (maximumBefore.isNegative()) {
          throw new ContractValidationError('quantity', 'over-receipt');
        }

        const changed = await tx.procPurchaseOrderLine.updateMany({
          where: {
            companyId: companyIdValue,
            id: lineId,
            purchaseOrderId: poId,
            receivedQuantity: { lte: maximumBefore },
          },
          data: { receivedQuantity: { increment } },
        });
        if (changed.count !== 1) {
          throw new ContractValidationError('quantity', 'over-receipt');
        }

        const lines = await tx.procPurchaseOrderLine.findMany({
          where: { companyId: companyIdValue, purchaseOrderId: poId },
        });
        await tx.procPurchaseOrder.update({
          where: { companyId_id: { companyId: companyIdValue, id: poId } },
          data: { status: derivedStatus(lines) },
        });
        await tx.procPoHistory.create({
          data: {
            id: historyId,
            companyId: companyIdValue,
            aggregateId: poId,
            kind: 'RECEIVED',
            sourceReference: commandId,
            requestHash,
            createdAt: new Date(),
          },
        });
        return (await this.poWith(tx, companyIdValue, poId))!;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async conversion(companyIdValue: CompanyId, id: string) {
    const row = await this.db.procInvoiceConversion.findUnique({
      where: { companyId_id: { companyId: companyIdValue, id } },
    });
    return row ? this.conversionValue(row) : undefined;
  }

  async reserveConversion(value: InvoiceConversion) {
    return this.db.$transaction(
      async (tx) => {
        const old = await tx.procInvoiceConversion.findUnique({
          where: {
            companyId_id: { companyId: value.companyId, id: value.id },
          },
        });
        if (old) {
          if (old.requestHash !== value.requestHash) {
            throw new ContractValidationError('conversion', 'conflicting replay');
          }
          return this.conversionValue(old);
        }

        const existingBillingLink = await tx.procInvoiceConversion.findUnique({
          where: {
            companyId_billingInvoiceId_lineId: {
              companyId: value.companyId,
              billingInvoiceId: value.billingInvoiceId,
              lineId: value.lineId,
            },
          },
        });
        if (existingBillingLink) {
          throw new ContractValidationError(
            'billingInvoiceId',
            'already linked to purchase-order line',
          );
        }

        const po = await tx.procPurchaseOrder.findUnique({
          where: {
            companyId_id: {
              companyId: value.companyId,
              id: value.purchaseOrderId,
            },
          },
        });
        if (
          !po ||
          !['PARTIALLY_RECEIVED', 'RECEIVED', 'PARTIALLY_INVOICED'].includes(
            po.status,
          )
        ) {
          throw new ContractValidationError(
            'purchaseOrder',
            'not invoice eligible',
          );
        }

        const line = await tx.procPurchaseOrderLine.findUnique({
          where: {
            companyId_id: { companyId: value.companyId, id: value.lineId },
          },
        });
        if (!line || line.purchaseOrderId !== value.purchaseOrderId) {
          throw new ContractValidationError('line', 'not found');
        }

        const increment = new Prisma.Decimal(value.quantity);
        const maximumBefore = line.receivedQuantity.sub(increment);
        if (maximumBefore.isNegative()) {
          throw new ContractValidationError('quantity', 'over-invoicing');
        }

        const changed = await tx.procPurchaseOrderLine.updateMany({
          where: {
            companyId: value.companyId,
            id: value.lineId,
            purchaseOrderId: value.purchaseOrderId,
            invoicedQuantity: { lte: maximumBefore },
          },
          data: { invoicedQuantity: { increment } },
        });
        if (changed.count !== 1) {
          throw new ContractValidationError('quantity', 'over-invoicing');
        }

        const created = await tx.procInvoiceConversion.create({
          data: {
            id: value.id,
            companyId: value.companyId,
            purchaseOrderId: value.purchaseOrderId,
            lineId: value.lineId,
            billingInvoiceId: value.billingInvoiceId,
            quantity: value.quantity,
            reopenedQuantity: value.reopenedQuantity,
            requestHash: value.requestHash,
            status: value.status,
            createdAt: new Date(value.createdAt),
          },
        });

        const lines = await tx.procPurchaseOrderLine.findMany({
          where: {
            companyId: value.companyId,
            purchaseOrderId: value.purchaseOrderId,
          },
        });
        await tx.procPurchaseOrder.update({
          where: {
            companyId_id: {
              companyId: value.companyId,
              id: value.purchaseOrderId,
            },
          },
          data: { status: derivedStatus(lines) },
        });
        return this.conversionValue(created);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async completeConversion(
    companyIdValue: CompanyId,
    id: string,
    billingInvoiceId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const row = await tx.procInvoiceConversion.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id } },
        });
        if (!row || row.billingInvoiceId !== billingInvoiceId) {
          throw new ContractValidationError('conversion', 'not reserved');
        }
        if (row.status === 'INVOICED') return this.conversionValue(row);
        if (row.status === 'REOPENED') {
          throw new ContractValidationError('conversion', 'already reopened');
        }

        const updated = await tx.procInvoiceConversion.update({
          where: { companyId_id: { companyId: companyIdValue, id } },
          data: { status: 'INVOICED' },
        });
        return this.conversionValue(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reopenConversion(
    companyIdValue: CompanyId,
    id: string,
    billingInvoiceId: string,
    eventId: string,
    requestHash: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        let conversion = await tx.procInvoiceConversion.findUnique({
          where: { companyId_id: { companyId: companyIdValue, id } },
        });
        if (
          !conversion ||
          conversion.billingInvoiceId !== billingInvoiceId ||
          conversion.status === 'RESERVED'
        ) {
          throw new ContractValidationError(
            'conversion',
            'completed matching conversion required',
          );
        }

        const historyId = `${conversion.purchaseOrderId}:reopen:${eventId}`;
        const replay = await tx.procPoHistory.findUnique({ where: { id: historyId } });
        if (replay) {
          if (
            replay.companyId !== companyIdValue ||
            replay.requestHash !== requestHash
          ) {
            throw new ContractValidationError('event', 'conflicting replay');
          }
          return this.conversionValue(conversion);
        }

        if (conversion.status === 'INVOICED') {
          const claimed = await tx.procInvoiceConversion.updateMany({
            where: {
              companyId: companyIdValue,
              id,
              status: 'INVOICED',
            },
            data: {
              status: 'REOPENED',
              reopenedQuantity: conversion.quantity,
            },
          });

          if (claimed.count === 1) {
            const changed = await tx.procPurchaseOrderLine.updateMany({
              where: {
                companyId: companyIdValue,
                id: conversion.lineId,
                purchaseOrderId: conversion.purchaseOrderId,
                invoicedQuantity: { gte: conversion.quantity },
              },
              data: {
                invoicedQuantity: { decrement: conversion.quantity },
              },
            });
            if (changed.count !== 1) {
              throw new ContractValidationError('quantity', 'invalid reopen');
            }
          }

          conversion = (await tx.procInvoiceConversion.findUnique({
            where: { companyId_id: { companyId: companyIdValue, id } },
          }))!;
        }

        const lines = await tx.procPurchaseOrderLine.findMany({
          where: {
            companyId: companyIdValue,
            purchaseOrderId: conversion.purchaseOrderId,
          },
        });
        await tx.procPurchaseOrder.update({
          where: {
            companyId_id: {
              companyId: companyIdValue,
              id: conversion.purchaseOrderId,
            },
          },
          data: { status: derivedStatus(lines) },
        });

        await tx.procPoHistory.create({
          data: {
            id: historyId,
            companyId: companyIdValue,
            aggregateId: conversion.purchaseOrderId,
            kind: 'INVOICE_REOPENED',
            sourceReference: billingInvoiceId,
            requestHash,
            createdAt: new Date(),
          },
        });
        return this.conversionValue(conversion);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async history(companyIdValue: CompanyId, aggregateId: string) {
    const [commitmentHistory, poHistory] = await Promise.all([
      this.db.procCommitmentHistory.findMany({
        where: { companyId: companyIdValue, aggregateId },
      }),
      this.db.procPoHistory.findMany({
        where: { companyId: companyIdValue, aggregateId },
      }),
    ]);
    return [...commitmentHistory, ...poHistory]
      .map((row) => this.historyValue(row))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}
