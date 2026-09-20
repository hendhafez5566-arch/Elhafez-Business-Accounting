import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CostBudgetAccountingApplicationService } from './application/cost-budget-accounting.application-service.js';
import { COST_CENTER_REPOSITORY, type CostCenterRepository } from './application/cost-center.repository.js';
import { PrismaCostCenterRepository } from './infrastructure/prisma-cost-center.repository.js';

/** Production composition boundary; in-memory persistence is reserved for tests. */
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({
  providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] },
    PrismaClient,
    { provide: COST_CENTER_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaCostCenterRepository(prisma), inject: [PrismaClient] },
    { provide: CostBudgetAccountingApplicationService, useFactory: (repository: CostCenterRepository) => new CostBudgetAccountingApplicationService(repository), inject: [COST_CENTER_REPOSITORY] },
  ],
  exports: [HistoricalImportApplicationService, CostBudgetAccountingApplicationService],
})
export class CostBudgetAccountingModule {}
