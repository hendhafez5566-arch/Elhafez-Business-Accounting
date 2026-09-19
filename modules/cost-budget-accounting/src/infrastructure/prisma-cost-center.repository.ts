import type { PrismaClient } from '@prisma/client';
import { ContractValidationError, sourceReference, type CompanyId, type SourceReference } from '@elhafez/contracts';
import type { CostCenterRepository } from '../application/cost-center.repository.js';
import type { Budget, BudgetActual, CostCenter, CostCenterId, ProgramCostCenterAssociation } from '../domain/cost-center.js';

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
  async saveBudget(value: Budget): Promise<void> {
    const collision=await this.db.cbaBudget.findFirst({where:{id:value.id,companyId:{not:value.companyId}}});if(collision)throw new ContractValidationError('budget','id owned by another company');
    await this.db.cbaBudget.upsert({where:{companyId_id:{companyId:value.companyId,id:value.id}},create:{...value,periodStart:new Date(value.periodStart),periodEnd:new Date(value.periodEnd)},update:{status:value.status}});
  }
  async budget(companyId:CompanyId,id:string):Promise<Budget|undefined>{const x=await this.db.cbaBudget.findUnique({where:{companyId_id:{companyId,id}}});return x?{...x,companyId,amount:String(x.amount) as Budget['amount'],periodStart:x.periodStart.toISOString().slice(0,10),periodEnd:x.periodEnd.toISOString().slice(0,10),costCenterId:x.costCenterId as CostCenterId,status:x.status as Budget['status']}:undefined}
  async budgets(companyId:CompanyId,costCenterId:CostCenterId){const xs=await this.db.cbaBudget.findMany({where:{companyId,costCenterId}});return Promise.all(xs.map(x=>this.budget(companyId,x.id) as Promise<Budget>))}
  async saveActual(value:BudgetActual){const old=await this.db.cbaBudgetActual.findUnique({where:{companyId_journalId_journalLineId:{companyId:value.companyId,journalId:value.journalId,journalLineId:value.journalLineId}}});if(old&&String(old.amount)!==value.amount)throw new ContractValidationError('actual','conflicting replay');if(!old)await this.db.cbaBudgetActual.create({data:{...value,postingDate:new Date(value.postingDate)}})}
  async actuals(companyId:CompanyId,costCenterId:CostCenterId):Promise<BudgetActual[]>{return(await this.db.cbaBudgetActual.findMany({where:{companyId,costCenterId}})).map(x=>({...x,companyId,costCenterId:x.costCenterId as CostCenterId,amount:String(x.amount) as BudgetActual['amount'],postingDate:x.postingDate.toISOString().slice(0,10)}))}
}
