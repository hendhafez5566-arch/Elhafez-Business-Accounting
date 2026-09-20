import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { FinancialReportingApplicationService } from './application/financial-reporting.application-service.js';
import { PrismaReportingProjectionRepository } from './infrastructure/prisma-reporting-projection.repository.js';

@Module({ providers: [PrismaClient, { provide: FinancialReportingApplicationService, useFactory: (db: PrismaClient) => new FinancialReportingApplicationService(new PrismaReportingProjectionRepository(db)), inject: [PrismaClient] }], exports: [FinancialReportingApplicationService] })
export class FinancialReportingModule {}
