import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { CurrencyFxApplicationService } from './application/currency-fx.application-service.js';
import { CURRENCY_FX_REPOSITORY, type CurrencyFxRepository } from './application/currency-fx.repository.js';
import { LIVE_FX_RATE_PROVIDER, type LiveFxRateProvider } from './application/live-fx-rate.provider.js';
import { CurrencyFxController } from './infrastructure/currency-fx.controller.js';
import { ExchangeRateApiLiveFxProvider } from './infrastructure/exchange-rate-api-live-fx.provider.js';
import { PrismaCurrencyFxRepository } from './infrastructure/prisma-currency-fx.repository.js';

/** Production composition boundary; in-memory persistence is reserved for tests. */
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({
  imports: [PlatformCoreModule],
  controllers: [CurrencyFxController],
  providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] },
    PrismaClient,
    { provide: CURRENCY_FX_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaCurrencyFxRepository(prisma), inject: [PrismaClient] },
    { provide: LIVE_FX_RATE_PROVIDER, useFactory: () => new ExchangeRateApiLiveFxProvider() },
    { provide: CurrencyFxApplicationService, useFactory: (repository: CurrencyFxRepository, live: LiveFxRateProvider) => new CurrencyFxApplicationService(repository, live), inject: [CURRENCY_FX_REPOSITORY, LIVE_FX_RATE_PROVIDER] },
  ],
  exports: [HistoricalImportApplicationService, CurrencyFxApplicationService],
})
export class CurrencyFxModule {}
