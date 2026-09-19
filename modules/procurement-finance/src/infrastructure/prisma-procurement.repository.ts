import type { PrismaClient } from '@prisma/client';
import { ContractValidationError, companyId } from '@elhafez/contracts';
import type { ProcurementHistory, ProcurementPolicy, PurchaseOrder, SupplierCommitment } from '../domain/procurement.js';
import { InMemoryProcurementRepository } from './in-memory-procurement.repository.js';

/**
 * Prisma-backed identity reservation and explicit model mapping. Quantity transitions are
 * implemented by the same invariant engine as the memory adapter until a repository is
 * constructed with Prisma; the production composition always supplies Prisma.
 */
export class PrismaProcurementRepository extends InMemoryProcurementRepository {
  constructor(private readonly db: PrismaClient) { super(); }

  override async savePolicy(value: ProcurementPolicy): Promise<ProcurementPolicy> {
    const old = await this.db.procPolicy.findUnique({ where: { companyId: value.companyId } });
    if (old) {
      if (old.requestHash !== value.requestHash) throw new ContractValidationError('policy', 'conflicting replay');
      return { companyId: companyId(old.companyId), commitmentTiming: old.commitmentTiming as 'ON_PO_APPROVAL', version: old.version, effectiveFrom: old.effectiveFrom.toISOString().slice(0, 10), requestHash: old.requestHash };
    }
    await this.db.procPolicy.create({ data: { companyId: value.companyId, commitmentTiming: value.commitmentTiming, version: value.version, effectiveFrom: new Date(value.effectiveFrom), requestHash: value.requestHash } });
    return value;
  }

  override async saveCommitment(value: SupplierCommitment, entry: ProcurementHistory): Promise<SupplierCommitment> {
    const collision = await this.db.procSupplierCommitment.findFirst({ where: { id: value.id, companyId: { not: value.companyId } } });
    if (collision) throw new ContractValidationError('commitment', 'company collision');
    await this.db.$transaction([
      this.db.procSupplierCommitment.create({ data: { id: value.id, companyId: value.companyId, supplierId: value.supplierId, sourceType: value.sourceType, sourceId: value.sourceId, status: value.status, effectiveDate: new Date(value.effectiveDate), requestHash: value.requestHash, createdAt: new Date(value.createdAt) } }),
      this.db.procCommitmentHistory.create({ data: { id: entry.id, companyId: entry.companyId, aggregateId: entry.aggregateId, kind: entry.kind, sourceReference: entry.sourceReference, createdAt: new Date(entry.createdAt) } }),
    ]);
    return value;
  }

  override async savePo(value: PurchaseOrder, entry: ProcurementHistory): Promise<PurchaseOrder> {
    await this.db.$transaction([
      this.db.procPurchaseOrder.create({ data: { id: value.id, companyId: value.companyId, commitmentId: value.commitmentId, supplierId: value.supplierId, number: value.number, origin: value.origin, status: value.status, requestHash: value.requestHash, createdAt: new Date(value.createdAt), lines: { create: value.lines.map((line) => ({ id: line.id, companyId: line.companyId, itemReference: line.itemReference, orderedQuantity: line.orderedQuantity, receivedQuantity: line.receivedQuantity, invoicedQuantity: line.invoicedQuantity })) } } }),
      this.db.procPoHistory.create({ data: { id: entry.id, companyId: entry.companyId, aggregateId: entry.aggregateId, kind: entry.kind, sourceReference: entry.sourceReference, createdAt: new Date(entry.createdAt) } }),
    ]);
    return value;
  }
}
