import { Prisma, type PrismaClient } from '@prisma/client';
import { decimalAmount, type CompanyId } from '@elhafez/contracts';
import type { StandaloneServicesRepository } from '../application/standalone-services.repository.js';
import type { CommandReceipt, CommercialSnapshot, ServiceHistoryEntry, ServiceRevision, ServiceType, StandaloneService, StandaloneServiceStatus } from '../domain/service.js';

const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const service = (row: {
  id: string; companyId: string; branchId: string; number: string; status: string; revision: number;
  confirmedRevision: number | null; externalOperationId: string | null; pendingCommandKey: string | null;
  cancellationPostingDate: string | null;
  supplyPlanId: string | null; supplyPlanVersion: number | null; createdAt: Date; updatedAt: Date;
}): StandaloneService => ({
  id: row.id, companyId: row.companyId as CompanyId, branchId: row.branchId, number: row.number,
  status: row.status as StandaloneServiceStatus, revision: row.revision,
  ...(row.confirmedRevision !== null ? { confirmedRevision: row.confirmedRevision } : {}),
  ...(row.externalOperationId ? { externalOperationId: row.externalOperationId } : {}),
  ...(row.pendingCommandKey ? { pendingCommandKey: row.pendingCommandKey } : {}),
  ...(row.cancellationPostingDate ? { cancellationPostingDate: row.cancellationPostingDate } : {}),
  ...(row.supplyPlanId ? { supplyPlanId: row.supplyPlanId } : {}),
  ...(row.supplyPlanVersion !== null ? { supplyPlanVersion: row.supplyPlanVersion } : {}),
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
function serviceData(value: StandaloneService) {
  return { status: value.status, revision: value.revision, confirmedRevision: value.confirmedRevision ?? null,
    externalOperationId: value.externalOperationId ?? null, pendingCommandKey: value.pendingCommandKey ?? null,
    cancellationPostingDate: value.cancellationPostingDate ?? null,
    supplyPlanId: value.supplyPlanId ?? null, supplyPlanVersion: value.supplyPlanVersion ?? null,
    updatedAt: new Date(value.updatedAt) };
}
function revisionData(value: ServiceRevision) {
  return { serviceId: value.serviceId, revision: value.revision, serviceTypeId: value.serviceTypeId,
    category: value.category, serviceDate: value.serviceDate, periodEnd: value.periodEnd ?? null,
    quantity: value.quantity, debtorKind: value.debtorKind, debtorPartyId: value.debtorPartyId,
    customerPartyId: value.customerPartyId, beneficiaryPartyIds: json(value.beneficiaryPartyIds),
    details: json(value.details), commercial: json(value.commercial), financialTerms: json(value.financialTerms), createdAt: new Date(value.createdAt) };
}
function historyData(value: ServiceHistoryEntry) {
  return { id: value.id, serviceId: value.serviceId, revision: value.revision, kind: value.kind,
    actorId: value.actorId, evidence: value.evidence ? json(value.evidence) : Prisma.JsonNull,
    createdAt: new Date(value.createdAt) };
}
function receiptData(value: CommandReceipt) {
  return { companyId: value.companyId, commandKey: value.commandKey, payloadHash: value.payloadHash, result: json(value.result) };
}

export class PrismaStandaloneServicesRepository implements StandaloneServicesRepository {
  constructor(private readonly db: PrismaClient) {}
  async getType(companyId: CompanyId, id: string): Promise<ServiceType | null> {
    const row = await this.db.ssServiceType.findUnique({ where: { companyId_id: { companyId, id } } });
    return row ? { id: row.id, companyId: row.companyId as CompanyId, code: row.code, category: row.category as ServiceType['category'], nameAr: row.nameAr, active: row.active } : null;
  }
  async listTypes(companyId: CompanyId): Promise<readonly ServiceType[]> {
    return (await this.db.ssServiceType.findMany({ where: { companyId }, orderBy: { code: 'asc' } })).map(row => ({ id: row.id, companyId: row.companyId as CompanyId, code: row.code, category: row.category as ServiceType['category'], nameAr: row.nameAr, active: row.active }));
  }
  async saveType(value: ServiceType): Promise<void> {
    await this.db.ssServiceType.upsert({ where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: { ...value }, update: { code: value.code, category: value.category, nameAr: value.nameAr, active: value.active } });
  }
  async getService(companyId: CompanyId, id: string): Promise<StandaloneService | null> {
    const row = await this.db.ssService.findUnique({ where: { companyId_id: { companyId, id } } }); return row ? service(row) : null;
  }
  async listServices(companyId: CompanyId, branchId: string): Promise<readonly StandaloneService[]> {
    return (await this.db.ssService.findMany({ where: { companyId, branchId }, orderBy: { createdAt: 'desc' } })).map(service);
  }
  async getByNumber(companyId: CompanyId, branchId: string, number: string): Promise<StandaloneService | null> {
    const row = await this.db.ssService.findUnique({ where: { companyId_branchId_number: { companyId, branchId, number } } }); return row ? service(row) : null;
  }
  async getRevision(serviceId: string, revision: number): Promise<ServiceRevision | null> {
    const row = await this.db.ssServiceRevision.findUnique({ where: { serviceId_revision: { serviceId, revision } } });
    return row ? { serviceId: row.serviceId, revision: row.revision, serviceTypeId: row.serviceTypeId,
      category: row.category as ServiceRevision['category'], serviceDate: row.serviceDate,
      ...(row.periodEnd ? { periodEnd: row.periodEnd } : {}), quantity: decimalAmount(row.quantity.toString()),
      debtorKind: row.debtorKind as ServiceRevision['debtorKind'], debtorPartyId: row.debtorPartyId,
      customerPartyId: row.customerPartyId, beneficiaryPartyIds: row.beneficiaryPartyIds as string[],
      details: row.details as Record<string, unknown>, commercial: row.commercial as unknown as CommercialSnapshot,
      financialTerms: row.financialTerms as unknown as ServiceRevision['financialTerms'],
      createdAt: row.createdAt.toISOString() } : null;
  }
  async history(serviceId: string): Promise<readonly ServiceHistoryEntry[]> {
    const rows = await this.db.ssServiceHistory.findMany({ where: { serviceId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(row => ({ id: row.id, serviceId: row.serviceId, revision: row.revision,
      kind: row.kind as ServiceHistoryEntry['kind'], actorId: row.actorId,
      ...(row.evidence ? { evidence: row.evidence as Record<string, unknown> } : {}), createdAt: row.createdAt.toISOString() }));
  }
  async getReceipt(companyId: CompanyId, commandKey: string): Promise<CommandReceipt | null> {
    const row = await this.db.ssCommandReceipt.findUnique({ where: { companyId_commandKey: { companyId, commandKey } } });
    return row ? { companyId: row.companyId as CompanyId, commandKey: row.commandKey,
      payloadHash: row.payloadHash, result: row.result as unknown as StandaloneService } : null;
  }
  async createDraft(value: StandaloneService, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt): Promise<void> {
    await this.db.$transaction(async tx => {
      await tx.ssService.create({ data: { id: value.id, companyId: value.companyId, branchId: value.branchId,
        number: value.number, createdAt: new Date(value.createdAt), ...serviceData(value) } });
      await tx.ssServiceRevision.create({ data: revisionData(revision) });
      await tx.ssServiceHistory.create({ data: historyData(history) });
      await tx.ssCommandReceipt.create({ data: receiptData(receipt) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async amendDraft(value: StandaloneService, expectedRevision: number, revision: ServiceRevision, history: ServiceHistoryEntry, receipt: CommandReceipt): Promise<void> {
    await this.db.$transaction(async tx => {
      const updated = await tx.ssService.updateMany({ where: { id: value.id, companyId: value.companyId,
        branchId: value.branchId, status: 'DRAFT', revision: expectedRevision }, data: serviceData(value) });
      if (updated.count !== 1) throw new Error('stale draft revision');
      await tx.ssServiceRevision.create({ data: revisionData(revision) });
      await tx.ssServiceHistory.create({ data: historyData(history) });
      await tx.ssCommandReceipt.create({ data: receiptData(receipt) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async transition(value: StandaloneService, expectedStatus: StandaloneServiceStatus, history: ServiceHistoryEntry, receipt?: CommandReceipt): Promise<void> {
    await this.db.$transaction(async tx => {
      const updated = await tx.ssService.updateMany({ where: { id: value.id, companyId: value.companyId,
        branchId: value.branchId, status: expectedStatus, revision: value.revision }, data: serviceData(value) });
      if (updated.count !== 1) throw new Error('stale service status');
      await tx.ssServiceHistory.create({ data: historyData(history) });
      if (receipt) await tx.ssCommandReceipt.create({ data: receiptData(receipt) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
