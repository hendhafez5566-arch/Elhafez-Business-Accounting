import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CostBudgetAccountingApplicationService } from './application/cost-budget-accounting.application-service.js';
import { COST_CENTER_REPOSITORY, type CostCenterRepository } from './application/cost-center.repository.js';
import { PrismaCostCenterRepository } from './infrastructure/prisma-cost-center.repository.js';

/** Production composition boundary; in-memory persistence is reserved for tests. */
@Module({
  providers: [
    PrismaClient,
    { provide: COST_CENTER_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaCostCenterRepository(prisma), inject: [PrismaClient] },
    { provide: CostBudgetAccountingApplicationService, useFactory: (repository: CostCenterRepository) => new CostBudgetAccountingApplicationService(repository), inject: [COST_CENTER_REPOSITORY] },
  ],
  exports: [CostBudgetAccountingApplicationService],
})
export class CostBudgetAccountingModule {}
