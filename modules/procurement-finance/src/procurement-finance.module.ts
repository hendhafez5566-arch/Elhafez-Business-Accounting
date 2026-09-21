import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingSubledgersModule, BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import { SupplierManagementModule } from '@elhafez/supplier-management/nest';
import { PROCUREMENT_REPOSITORY, type ProcurementRepository } from './application/procurement.repository.js';
import { ProcurementFinanceApplicationService } from './application/procurement-finance.application-service.js';
import { PrismaProcurementRepository } from './infrastructure/prisma-procurement.repository.js';
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({ imports: [BillingSubledgersModule, SupplierManagementModule], providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] }, PrismaClient, { provide: PROCUREMENT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaProcurementRepository(p), inject: [PrismaClient] }, { provide: ProcurementFinanceApplicationService, useFactory: (r: ProcurementRepository, b: BillingSubledgersApplicationService, s: SupplierManagementApplicationService) => new ProcurementFinanceApplicationService(r, b, s), inject: [PROCUREMENT_REPOSITORY, BillingSubledgersApplicationService, SupplierManagementApplicationService] }], exports: [HistoricalImportApplicationService, ProcurementFinanceApplicationService] })
export class ProcurementFinanceModule {}
