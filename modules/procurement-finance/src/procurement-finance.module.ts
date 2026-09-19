import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingSubledgersModule, BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import { PROCUREMENT_REPOSITORY, type ProcurementRepository } from './application/procurement.repository.js';
import { ProcurementFinanceApplicationService } from './application/procurement-finance.application-service.js';
import { PrismaProcurementRepository } from './infrastructure/prisma-procurement.repository.js';
@Module({ imports: [BillingSubledgersModule], providers: [PrismaClient, { provide: PROCUREMENT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaProcurementRepository(p), inject: [PrismaClient] }, { provide: ProcurementFinanceApplicationService, useFactory: (r: ProcurementRepository, b: BillingSubledgersApplicationService) => new ProcurementFinanceApplicationService(r, b), inject: [PROCUREMENT_REPOSITORY, BillingSubledgersApplicationService] }], exports: [ProcurementFinanceApplicationService] })
export class ProcurementFinanceModule {}
