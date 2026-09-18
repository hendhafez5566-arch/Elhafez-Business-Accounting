import type { PrismaClient } from '@prisma/client';
import { ContractValidationError, sourceReference, type CompanyId, type SourceReference } from '@elhafez/contracts';
import type { CostCenterRepository } from '../application/cost-center.repository.js';
import type { CostCenter, CostCenterId, ProgramCostCenterAssociation } from '../domain/cost-center.js';

export class PrismaCostCenterRepository implements CostCenterRepository {
  constructor(private readonly db: PrismaClient) {}

  async save(value: CostCenter): Promise<void> {
    const idCollision = await this.db.cbaCostCenter.findFirst({ where: { id: value.id, companyId: { not: value.companyId } } });
    if (idCollision) throw new ContractValidationError('costCenterId', 'is already owned by another company');
    if (value.parentId) {
      const parent = await this.db.cbaCostCenter.findUnique({ where: { companyId_id: { companyId: value.companyId, id: value.parentId } } });
      if (!parent) throw new ContractValidationError('parentId', 'parent must belong to the same company');
    }
    await this.db.cbaCostCenter.upsert({
      where: { companyId_id: { companyId: value.companyId, id: value.id } },
      create: value,
      update: { name: value.name, status: value.status, parentId: value.parentId },
    });
  }

  async find(companyId: CompanyId, id: CostCenterId): Promise<CostCenter | undefined> {
    return (await this.db.cbaCostCenter.findUnique({ where: { companyId_id: { companyId, id } } })) as CostCenter | undefined;
  }
  async findByCode(companyId: CompanyId, code: string): Promise<CostCenter | undefined> {
    return (await this.db.cbaCostCenter.findUnique({ where: { companyId_code: { companyId, code } } })) as CostCenter | undefined;
  }
  async saveAssociation(value: ProgramCostCenterAssociation): Promise<void> {
    const center = await this.find(value.companyId, value.costCenterId);
    if (!center) throw new ContractValidationError('costCenterId', 'cost center must belong to the association company');
    await this.db.cbaProgramCostCenter.create({ data: { companyId: value.companyId, sourceType: value.program.sourceType, sourceId: value.program.sourceId, costCenterId: value.costCenterId } });
  }
  async findAssociation(companyId: CompanyId, program: SourceReference): Promise<ProgramCostCenterAssociation | undefined> {
    const value = await this.db.cbaProgramCostCenter.findUnique({ where: { companyId_sourceType_sourceId: { companyId, sourceType: program.sourceType, sourceId: program.sourceId } } });
    return value ? { companyId, program: sourceReference(value.sourceType, value.sourceId), costCenterId: value.costCenterId as CostCenterId } : undefined;
  }
}
