import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TourismFinanceOrchestrationApplicationService } from '@elhafez/tourism-finance-orchestration';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration/nest';
import { StandaloneServicesApplicationService } from './application/standalone-services.application-service.js';
import type { StandaloneServicesRepository } from './application/standalone-services.repository.js';
import { PrismaStandaloneServicesRepository } from './infrastructure/prisma-standalone-services.repository.js';
import { TourismFinanceConfirmationAdapter } from './infrastructure/tourism-finance-confirmation.adapter.js';

export const STANDALONE_SERVICES_REPOSITORY = Symbol('STANDALONE_SERVICES_REPOSITORY');
@Module({
  imports: [TourismFinanceOrchestrationModule],
  providers: [PrismaClient,
    { provide: STANDALONE_SERVICES_REPOSITORY, useFactory: (db: PrismaClient) => new PrismaStandaloneServicesRepository(db), inject: [PrismaClient] },
    { provide: StandaloneServicesApplicationService,
      useFactory: (repo: StandaloneServicesRepository, finance: TourismFinanceOrchestrationApplicationService) => new StandaloneServicesApplicationService(repo, new TourismFinanceConfirmationAdapter(finance)),
      inject: [STANDALONE_SERVICES_REPOSITORY, TourismFinanceOrchestrationApplicationService] },
  ],
  exports: [StandaloneServicesApplicationService],
})
export class StandaloneServicesModule {}
