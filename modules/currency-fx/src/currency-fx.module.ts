import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CurrencyFxApplicationService } from './application/currency-fx.application-service.js';
import { CURRENCY_FX_REPOSITORY, type CurrencyFxRepository } from './application/currency-fx.repository.js';
import { PrismaCurrencyFxRepository } from './infrastructure/prisma-currency-fx.repository.js';

/** Production composition boundary; in-memory persistence is reserved for tests. */
@Module({
  providers: [
    PrismaClient,
    { provide: CURRENCY_FX_REPOSITORY, useFactory: (prisma: PrismaClient) => new PrismaCurrencyFxRepository(prisma), inject: [PrismaClient] },
    { provide: CurrencyFxApplicationService, useFactory: (repository: CurrencyFxRepository) => new CurrencyFxApplicationService(repository), inject: [CURRENCY_FX_REPOSITORY] },
  ],
  exports: [CurrencyFxApplicationService],
})
export class CurrencyFxModule {}
