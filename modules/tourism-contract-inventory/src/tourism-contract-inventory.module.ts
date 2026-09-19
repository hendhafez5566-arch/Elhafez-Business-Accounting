import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CostBudgetAccountingApplicationService,
  CostBudgetAccountingModule,
} from '@elhafez/cost-budget-accounting';
import {
  ProcurementFinanceApplicationService,
  ProcurementFinanceModule,
} from '@elhafez/procurement-finance';
import { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
import type {
  CostEffectPort,
  ProcurementPort,
} from './application/inventory.application-service.js';
import { PrismaTourismInventoryRepository } from './infrastructure/prisma-inventory.repository.js';
import {
  TOURISM_INVENTORY_REPOSITORY,
  type TourismInventoryRepository,
} from './infrastructure/inventory.repository.js';

export const TOURISM_CONTRACT_INVENTORY_SERVICE = Symbol(
  'TOURISM_CONTRACT_INVENTORY_SERVICE',
);

class CostPublicAdapter implements CostEffectPort {
  constructor(private readonly cost: CostBudgetAccountingApplicationService) {}

  async recordAllocationAdjustment(
    input: Parameters<CostEffectPort['recordAllocationAdjustment']>[0],
  ) {
    const effect = await this.cost.recordProgramAllocationCostEffect({
      id: input.effectId,
      companyId: input.companyId,
      program: input.program,
      allocationId: input.allocationId,
      previousQuantity: input.previousQuantity,
      newQuantity: input.newQuantity,
      amount: input.costAmount,
      postingDate: input.postingDate,
    });
    return { id: effect.id };
  }
}

class ProcurementPublicAdapter implements ProcurementPort {
  constructor(private readonly procurement: ProcurementFinanceApplicationService) {}

  async requestResidual(input: Parameters<ProcurementPort['requestResidual']>[0]) {
    const itemReference = String(input.referenceData.itemReference ?? input.type);
    const purchaseOrder = await this.procurement.createPurchaseOrder({
      id: input.requestId,
      companyId: input.companyId,
      number: `TCI-${input.requestId}`,
      supplierId: input.supplierId,
      origin: 'AUTO',
      lines: [
        {
          id: `${input.requestId}:1`,
          itemReference,
          orderedQuantity: input.quantity,
        },
      ],
    });
    return purchaseOrder.id;
  }
}

@Module({
  imports: [CostBudgetAccountingModule, ProcurementFinanceModule],
  providers: [
    PrismaClient,
    {
      provide: TOURISM_INVENTORY_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaTourismInventoryRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: TOURISM_CONTRACT_INVENTORY_SERVICE,
      useFactory: (
        repository: TourismInventoryRepository,
        cost: CostBudgetAccountingApplicationService,
        procurement: ProcurementFinanceApplicationService,
      ) =>
        new TourismContractInventoryApplicationServiceImpl(
          repository,
          new CostPublicAdapter(cost),
          new ProcurementPublicAdapter(procurement),
        ),
      inject: [
        TOURISM_INVENTORY_REPOSITORY,
        CostBudgetAccountingApplicationService,
        ProcurementFinanceApplicationService,
      ],
    },
  ],
  exports: [TOURISM_CONTRACT_INVENTORY_SERVICE],
})
export class TourismContractInventoryModule {}
