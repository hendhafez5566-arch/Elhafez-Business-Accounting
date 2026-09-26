import type { PrismaClient } from '@prisma/client';
import {
  ContractValidationError,
  sourceReference,
  type CompanyId,
  type SourceReference,
} from '@elhafez/contracts';
import type { CostCenterRepository } from '../application/cost-center.repository.js';
import type {
  Budget,
  BudgetActual,
  CostCenter,
  CostCenterId,
  ProgramAllocationCostEffect,
  ProgramCostCenterAssociation,
  TourismServiceActualization,
} from '../domain/cost-center.js';

export class PrismaCostCenterRepository implements CostCenterRepository {
  constructor(private readonly db: PrismaClient) {}

  async save(value: CostCenter): Promise<void> {
    const idCollision = await this.db.cbaCostCenter.findFirst({
      where: { id: value.id, companyId: { not: value.companyId } },
    });
    if (idCollision) {
      throw new ContractValidationError('costCenterId', 'is already owned by another company');
    }
    if (value.parentId) {
      const parent = await this.db.cbaCostCenter.findUnique({
        where: { companyId_id: { companyId: value.companyId, id: value.parentId } },
      });
      if (!parent) {
        throw new ContractValidationError('parentId', 'parent must belong to the same company');
      }
    }
    await this.db.cbaCostCenter.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: value,
      update: { name: value.name, status: value.status, parentId: value.parentId },
    });
  }

  async find(companyId: CompanyId, id: CostCenterId): Promise<CostCenter | undefined> {
    return (await this.db.cbaCostCenter.findUnique({
      where: { companyId_id: { companyId, id } },
    })) as CostCenter | undefined;
  }

  async findByCode(companyId: CompanyId, code: string): Promise<CostCenter | undefined> {
    return (await this.db.cbaCostCenter.findUnique({
      where: { companyId_code: { companyId, code } },
    })) as CostCenter | undefined;
  }

  async listCenters(companyId: CompanyId): Promise<CostCenter[]> {
    return (await this.db.cbaCostCenter.findMany({ where: { companyId }, orderBy: { code: 'asc' } })) as CostCenter[];
  }

  async listBudgets(companyId: CompanyId): Promise<Budget[]> {
    const rows = await this.db.cbaBudget.findMany({ where: { companyId }, orderBy: { periodStart: 'desc' }, select: { id: true } });
    return Promise.all(rows.map((row) => this.budget(companyId, row.id) as Promise<Budget>));
  }

  async saveAssociation(value: ProgramCostCenterAssociation): Promise<void> {
    const center = await this.find(value.companyId, value.costCenterId);
    if (!center) {
      throw new ContractValidationError(
        'costCenterId',
        'cost center must belong to the association company',
      );
    }
    await this.db.cbaProgramCostCenter.create({
      data: {
        companyId: value.companyId,
        sourceType: value.program.sourceType,
        sourceId: value.program.sourceId,
        costCenterId: value.costCenterId,
      },
    });
  }

  async findAssociation(
    companyId: CompanyId,
    program: SourceReference,
  ): Promise<ProgramCostCenterAssociation | undefined> {
    const value = await this.db.cbaProgramCostCenter.findUnique({
      where: {
        companyId_sourceType_sourceId: {
          companyId,
          sourceType: program.sourceType,
          sourceId: program.sourceId,
        },
      },
    });
    return value
      ? {
          companyId,
          program: sourceReference(value.sourceType, value.sourceId),
          costCenterId: value.costCenterId as CostCenterId,
        }
      : undefined;
  }

  async saveBudget(value: Budget): Promise<void> {
    const collision = await this.db.cbaBudget.findFirst({
      where: { id: value.id, companyId: { not: value.companyId } },
    });
    if (collision) throw new ContractValidationError('budget', 'id owned by another company');
    await this.db.cbaBudget.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: {
        id: value.id,
        companyId: value.companyId,
        costCenterId: value.costCenterId,
        periodStart: new Date(value.periodStart),
        periodEnd: new Date(value.periodEnd),
        currency: value.currency,
        amount: value.amount,
        status: value.status,
        requestHash: value.requestHash,
      },
      update: { status: value.status },
    });
  }

  async budget(companyId: CompanyId, id: string): Promise<Budget | undefined> {
    const value = await this.db.cbaBudget.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value
      ? {
          ...value,
          companyId,
          amount: String(value.amount) as Budget['amount'],
          periodStart: value.periodStart.toISOString().slice(0, 10),
          periodEnd: value.periodEnd.toISOString().slice(0, 10),
          costCenterId: value.costCenterId as CostCenterId,
          status: value.status as Budget['status'],
        }
      : undefined;
  }

  async budgets(companyId: CompanyId, costCenterId: CostCenterId): Promise<Budget[]> {
    const values = await this.db.cbaBudget.findMany({ where: { companyId, costCenterId } });
    return Promise.all(values.map((value) => this.budget(companyId, value.id) as Promise<Budget>));
  }

  async saveActual(value: BudgetActual): Promise<void> {
    const old = await this.db.cbaBudgetActual.findUnique({
      where: {
        companyId_journalId_journalLineId: {
          companyId: value.companyId,
          journalId: value.journalId,
          journalLineId: value.journalLineId,
        },
      },
    });
    if (old) {
      const identical =
        old.id === value.id &&
        old.companyId === value.companyId &&
        old.costCenterId === value.costCenterId &&
        old.postingDate.toISOString().slice(0, 10) === value.postingDate &&
        String(old.amount) === value.amount &&
        old.journalId === value.journalId &&
        old.journalLineId === value.journalLineId;
      if (!identical) throw new ContractValidationError('actual', 'conflicting replay');
      return;
    }
    await this.db.cbaBudgetActual.create({
      data: {
        id: value.id,
        companyId: value.companyId,
        costCenterId: value.costCenterId,
        postingDate: new Date(value.postingDate),
        amount: value.amount,
        journalId: value.journalId,
        journalLineId: value.journalLineId,
      },
    });
  }

  async actuals(companyId: CompanyId, costCenterId: CostCenterId): Promise<BudgetActual[]> {
    return (
      await this.db.cbaBudgetActual.findMany({ where: { companyId, costCenterId } })
    ).map((value) => ({
      ...value,
      companyId,
      costCenterId: value.costCenterId as CostCenterId,
      amount: String(value.amount) as BudgetActual['amount'],
      postingDate: value.postingDate.toISOString().slice(0, 10),
    }));
  }

  async saveProgramAllocationCostEffect(value: ProgramAllocationCostEffect): Promise<void> {
    const old = await this.db.cbaProgramAllocationCostEffect.findUnique({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
    });
    if (old) {
      if (old.requestHash !== value.requestHash) {
        throw new ContractValidationError('allocationCostEffect', 'conflicting replay');
      }
      return;
    }
    await this.db.cbaProgramAllocationCostEffect.create({
      data: {
        id: value.id,
        companyId: value.companyId,
        costCenterId: value.costCenterId,
        programSourceType: value.program.sourceType,
        programSourceId: value.program.sourceId,
        allocationId: value.allocationId,
        previousQuantity: value.previousQuantity,
        newQuantity: value.newQuantity,
        amount: value.amount,
        postingDate: new Date(value.postingDate),
        requestHash: value.requestHash,
        createdAt: new Date(value.createdAt),
      },
    });
  }

  async programAllocationCostEffect(
    companyId: CompanyId,
    id: string,
  ): Promise<ProgramAllocationCostEffect | undefined> {
    const value = await this.db.cbaProgramAllocationCostEffect.findUnique({
      where: { companyId_id: { companyId, id } },
    });
    return value
      ? {
          id: value.id,
          companyId: value.companyId as CompanyId,
          costCenterId: value.costCenterId as CostCenterId,
          program: sourceReference(value.programSourceType, value.programSourceId),
          allocationId: value.allocationId,
          previousQuantity: String(value.previousQuantity) as ProgramAllocationCostEffect['previousQuantity'],
          newQuantity: String(value.newQuantity) as ProgramAllocationCostEffect['newQuantity'],
          amount: String(value.amount) as ProgramAllocationCostEffect['amount'],
          postingDate: value.postingDate.toISOString().slice(0, 10),
          requestHash: value.requestHash,
          createdAt: value.createdAt.toISOString(),
        }
      : undefined;
  }

  async saveTourismServiceActualization(value: TourismServiceActualization): Promise<void> {
    const old = await this.db.cbaTourismServiceActualization.findUnique({ where: { companyId_id: { companyId: value.companyId, id: value.id } } });
    if (old) { if (old.requestHash !== value.requestHash) throw new ContractValidationError('tourismActualization', 'conflicting replay'); return; }
    await this.db.cbaTourismServiceActualization.create({ data: { id: value.id, companyId: value.companyId, costCenterId: value.costCenterId, programSourceType: value.program.sourceType, programSourceId: value.program.sourceId, serviceSourceType: value.service.sourceType, serviceSourceId: value.service.sourceId, evidenceSourceType: value.evidence.sourceType, evidenceSourceId: value.evidence.sourceId, amount: value.amount, postingDate: new Date(value.postingDate), requestHash: value.requestHash, createdAt: new Date(value.createdAt) } });
  }
  async tourismServiceActualization(companyId: CompanyId, id: string): Promise<TourismServiceActualization | undefined> {
    const value = await this.db.cbaTourismServiceActualization.findUnique({ where: { companyId_id: { companyId, id } } });
    return value ? { id: value.id, companyId: value.companyId as CompanyId, costCenterId: value.costCenterId as CostCenterId, program: sourceReference(value.programSourceType, value.programSourceId), service: sourceReference(value.serviceSourceType, value.serviceSourceId), evidence: sourceReference(value.evidenceSourceType, value.evidenceSourceId), amount: String(value.amount) as TourismServiceActualization['amount'], postingDate: value.postingDate.toISOString().slice(0, 10), requestHash: value.requestHash, createdAt: value.createdAt.toISOString() } : undefined;
  }
}
