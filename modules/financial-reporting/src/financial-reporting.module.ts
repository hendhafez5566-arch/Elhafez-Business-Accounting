import { Module } from '@nestjs/common';
import { FinancialReportingApplicationService } from './application/financial-reporting.application-service.js';
import { InMemoryReportingProjectionRepository } from './infrastructure/in-memory-reporting-projection.repository.js';

@Module({ providers: [{ provide: FinancialReportingApplicationService, useFactory: () => new FinancialReportingApplicationService(new InMemoryReportingProjectionRepository()) }], exports: [FinancialReportingApplicationService] })
export class FinancialReportingModule {}
