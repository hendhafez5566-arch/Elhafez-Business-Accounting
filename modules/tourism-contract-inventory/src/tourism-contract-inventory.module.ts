import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CostBudgetAccountingApplicationService, CostBudgetAccountingModule } from '@elhafez/cost-budget-accounting';
import { ProcurementFinanceApplicationService, ProcurementFinanceModule } from '@elhafez/procurement-finance';
import { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
import type { CostEffectPort, ProcurementPort } from './application/inventory.application-service.js';
import { PrismaTourismInventoryRepository } from './infrastructure/prisma-inventory.repository.js';
import { TOURISM_INVENTORY_REPOSITORY, type TourismInventoryRepository } from './infrastructure/inventory.repository.js';

export const TOURISM_CONTRACT_INVENTORY_SERVICE=Symbol('TOURISM_CONTRACT_INVENTORY_SERVICE');
class CostPublicAdapter implements CostEffectPort { constructor(private readonly cost:CostBudgetAccountingApplicationService){} async recordAllocationAdjustment(i:Parameters<CostEffectPort['recordAllocationAdjustment']>[0]){const center=await this.cost.resolveProgramCostCenter(i.companyId,i.program);await this.cost.consumeJournalPostedFact({id:i.effectId,companyId:i.companyId,costCenterId:center.id,postingDate:i.postingDate,amount:i.costAmount,journalId:`TCI:${i.allocationId}`,journalLineId:i.effectId})} }
class ProcurementPublicAdapter implements ProcurementPort { constructor(private readonly procurement:ProcurementFinanceApplicationService){} async requestResidual(i:Parameters<ProcurementPort['requestResidual']>[0]){const itemReference=String(i.referenceData.itemReference??i.type);const po=await this.procurement.createPurchaseOrder({id:i.requestId,companyId:i.companyId,number:`TCI-${i.requestId}`,supplierId:i.supplierId,origin:'AUTO',lines:[{id:`${i.requestId}:1`,itemReference,orderedQuantity:i.quantity}]});return po.id} }
@Module({imports:[CostBudgetAccountingModule,ProcurementFinanceModule],providers:[PrismaClient,{provide:TOURISM_INVENTORY_REPOSITORY,useFactory:(p:PrismaClient)=>new PrismaTourismInventoryRepository(p),inject:[PrismaClient]},{provide:TOURISM_CONTRACT_INVENTORY_SERVICE,useFactory:(r:TourismInventoryRepository,c:CostBudgetAccountingApplicationService,p:ProcurementFinanceApplicationService)=>new TourismContractInventoryApplicationServiceImpl(r,new CostPublicAdapter(c),new ProcurementPublicAdapter(p)),inject:[TOURISM_INVENTORY_REPOSITORY,CostBudgetAccountingApplicationService,ProcurementFinanceApplicationService]}],exports:[TOURISM_CONTRACT_INVENTORY_SERVICE]})
export class TourismContractInventoryModule {}
