import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingSubledgersModule, BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import { TreasurySettlementModule, TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import { GeneralLedgerModule, GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import { PeriodControlModule } from '@elhafez/period-control';
import { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { CurrencyFxModule } from '@elhafez/currency-fx/nest';
import { FinancialControlsModule, FinancialControlsApplicationService } from '@elhafez/financial-controls';
import { ECR_REPOSITORY, type EcrRepository } from './application/ecr.repository.js';
import { ExpenseCommissionRecognitionApplicationService } from './application/ecr.application-service.js';
import {
  INVOICE_REVENUE_RECOGNITION_REPOSITORY,
  type InvoiceRevenueRecognitionRepository,
} from './application/invoice-revenue-recognition.repository.js';
import { InvoiceRevenueRecognitionApplicationService } from './application/invoice-revenue-recognition.application-service.js';
import { PrismaEcrRepository } from './infrastructure/prisma-ecr.repository.js';
import { PrismaInvoiceRevenueRecognitionRepository } from './infrastructure/prisma-invoice-revenue-recognition.repository.js';
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import { HISTORICAL_IMPORT_REPOSITORY, type HistoricalImportRepository } from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
import { COMMISSION_READ_REPOSITORY, type CommissionReadRepository } from './application/commission-read.repository.js';
import { CommissionReadApplicationService } from './application/commission-read.application-service.js';
import { PrismaCommissionReadRepository } from './infrastructure/prisma-commission-read.repository.js';

@Module({
  imports: [
    BillingSubledgersModule,
    TreasurySettlementModule,
    GeneralLedgerModule,
    PeriodControlModule,
    CurrencyFxModule,
    FinancialControlsModule,
  ],
  providers: [
    {
      provide: HISTORICAL_IMPORT_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaHistoricalImportRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: HistoricalImportApplicationService,
      useFactory: (repository: HistoricalImportRepository) => new HistoricalImportApplicationService(repository),
      inject: [HISTORICAL_IMPORT_REPOSITORY],
    },
    PrismaClient,
    {
      provide: ECR_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaEcrRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: INVOICE_REVENUE_RECOGNITION_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaInvoiceRevenueRecognitionRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: ExpenseCommissionRecognitionApplicationService,
      useFactory: (
        repository: EcrRepository,
        billing: BillingSubledgersApplicationService,
        treasury: TreasurySettlementApplicationService,
        ledger: GeneralLedgerApplicationService,
        fx: CurrencyFxApplicationService,
        controls: FinancialControlsApplicationService,
      ) => new ExpenseCommissionRecognitionApplicationService(repository, billing, treasury, ledger, fx, controls),
      inject: [
        ECR_REPOSITORY,
        BillingSubledgersApplicationService,
        TreasurySettlementApplicationService,
        GeneralLedgerApplicationService,
        CurrencyFxApplicationService,
        FinancialControlsApplicationService,
      ],
    },
    {
      provide: InvoiceRevenueRecognitionApplicationService,
      useFactory: (
        schedules: EcrRepository,
        allocations: InvoiceRevenueRecognitionRepository,
        billing: BillingSubledgersApplicationService,
        ledger: GeneralLedgerApplicationService,
        fx: CurrencyFxApplicationService,
      ) => new InvoiceRevenueRecognitionApplicationService(schedules, allocations, billing, ledger, fx),
      inject: [
        ECR_REPOSITORY,
        INVOICE_REVENUE_RECOGNITION_REPOSITORY,
        BillingSubledgersApplicationService,
        GeneralLedgerApplicationService,
        CurrencyFxApplicationService,
      ],
    },
    {
      provide: COMMISSION_READ_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaCommissionReadRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: CommissionReadApplicationService,
      useFactory: (repository: CommissionReadRepository) => new CommissionReadApplicationService(repository),
      inject: [COMMISSION_READ_REPOSITORY],
    },
  ],
  exports: [
    HistoricalImportApplicationService,
    ExpenseCommissionRecognitionApplicationService,
    InvoiceRevenueRecognitionApplicationService,
    CommissionReadApplicationService,
  ],
})
export class ExpenseCommissionRecognitionModule {}
