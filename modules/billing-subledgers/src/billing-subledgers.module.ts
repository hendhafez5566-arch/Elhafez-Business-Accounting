import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TaxModule, TaxApplicationService } from '@elhafez/tax';
import { CurrencyFxModule, CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { GeneralLedgerModule, GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import { PeriodControlModule } from '@elhafez/period-control';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { BILLING_REPOSITORY, type BillingRepository } from './application/billing.repository.js';
import { BillingSubledgersApplicationService } from './application/billing-subledgers.application-service.js';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository.js';

import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
@Module({
  imports: [
    TaxModule,
    CurrencyFxModule,
    GeneralLedgerModule,
    PeriodControlModule,
    FinancialControlsModule,
  ],
  providers: [{ provide: HISTORICAL_IMPORT_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p), inject: [PrismaClient] }, { provide: HistoricalImportApplicationService, useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r), inject: [HISTORICAL_IMPORT_REPOSITORY] },
    PrismaClient,
    {
      provide: BILLING_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaBillingRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: BillingSubledgersApplicationService,
      useFactory: (
        repository: BillingRepository,
        tax: TaxApplicationService,
        fx: CurrencyFxApplicationService,
        gl: GeneralLedgerApplicationService,
      ) => new BillingSubledgersApplicationService(repository, tax, fx, gl),
      inject: [
        BILLING_REPOSITORY,
        TaxApplicationService,
        CurrencyFxApplicationService,
        GeneralLedgerApplicationService,
      ],
    },
  ],
  exports: [HistoricalImportApplicationService, BillingSubledgersApplicationService],
})
export class BillingSubledgersModule {}
