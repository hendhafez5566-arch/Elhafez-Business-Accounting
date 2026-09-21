/** Supplier Intelligence — Nest module. */
import { Module } from '@nestjs/common';
import { PrismaModule } from '@elhafez/platform-core';
import { SupplierIntelligenceApplicationService } from './application/supplier-intelligence.application-service.js';
import {
  SupplierIntelligenceRepository,
  SupplierIntelligenceRepositoryToken,
} from './application/supplier-intelligence.repository.js';
import { PrismaSupplierIntelligenceRepository } from './infrastructure/prisma-supplier-intelligence.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [
    SupplierIntelligenceApplicationService,
    {
      provide: SupplierIntelligenceRepositoryToken,
      useClass: PrismaSupplierIntelligenceRepository,
    },
  ],
  exports: [
    SupplierIntelligenceApplicationService,
    SupplierIntelligenceRepositoryToken,
  ],
})
export class SupplierIntelligenceModule {}
