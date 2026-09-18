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

@Module({
  imports: [
    TaxModule,
    CurrencyFxModule,
    GeneralLedgerModule,
    PeriodControlModule,
    FinancialControlsModule,
  ],
  providers: [
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
  exports: [BillingSubledgersApplicationService],
})
export class BillingSubledgersModule {}
