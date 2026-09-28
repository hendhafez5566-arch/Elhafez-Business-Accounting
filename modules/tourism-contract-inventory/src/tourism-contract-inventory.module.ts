import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CostBudgetAccountingApplicationService,
  CostBudgetAccountingModule,
} from '@elhafez/cost-budget-accounting';
import { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance/nest';
import { TourismContractInventoryApplicationServiceImpl } from './application/tourism-contract-inventory.application-service.impl.js';
import type {
  CostEffectPort,
  ProcurementPort,
} from './application/inventory.application-service.js';
import { PrismaTourismInventoryRepository } from './infrastructure/prisma-inventory.repository.js';
import { TourismInventoryReferenceQuery } from './infrastructure/tourism-inventory-reference.query.js';
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
      branchId: input.branchId,
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

import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({
  imports: [CostBudgetAccountingModule, ProcurementFinanceModule],
  providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] },
    PrismaClient,
    {
      provide: TourismInventoryReferenceQuery,
      useFactory: (prisma: PrismaClient) => new TourismInventoryReferenceQuery(prisma),
      inject: [PrismaClient],
    },
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
  exports: [HistoricalImportApplicationService, TOURISM_CONTRACT_INVENTORY_SERVICE, TourismInventoryReferenceQuery],
})
export class TourismContractInventoryModule {}