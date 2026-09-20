import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CurrencyFxApplicationService } from './application/currency-fx.application-service.js';
import { CURRENCY_FX_REPOSITORY, type CurrencyFxRepository } from './application/currency-fx.repository.js';
import { PrismaCurrencyFxRepository } from './infrastructure/prisma-currency-fx.repository.js';

/** Production composition boundary; in-memory persistence is reserved for tests. */
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({
  providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] },
    PrismaClient,
    { provide: CURRENCY_FX_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaCurrencyFxRepository(prisma), inject: [PrismaClient] },
    { provide: CurrencyFxApplicationService, useFactory: (repository: CurrencyFxRepository) => new CurrencyFxApplicationService(repository), inject: [CURRENCY_FX_REPOSITORY] },
  ],
  exports: [HistoricalImportApplicationService, CurrencyFxApplicationService],
})
export class CurrencyFxModule {}
