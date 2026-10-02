import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TaxModule, TaxApplicationService } from '@elhafez/tax';
import { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import { CurrencyFxModule } from '@elhafez/currency-fx/nest';
import { GeneralLedgerModule, GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import { PeriodControlModule } from '@elhafez/period-control';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { BILLING_REPOSITORY, type BillingRepository } from './application/billing.repository.js';
import { BillingSubledgersApplicationService } from './application/billing-subledgers.application-service.js';
import { PartyReceivableApplicationService } from './application/party-receivable.application-service.js';
import {
  MANUAL_INVOICE_REPOSITORY,
  type ManualInvoiceRepository,
} from './application/manual-invoice.repository.js';
import { ManualInvoiceWorkflowApplicationService } from './application/manual-invoice-workflow.application-service.js';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository.js';
import { PrismaManualInvoiceRepository } from './infrastructure/prisma-manual-invoice.repository.js';
import { ManualInvoiceLedgerAdapter } from './infrastructure/manual-invoice-ledger.adapter.js';

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
  providers: [
    {
      provide: HISTORICAL_IMPORT_REPOSITORY,
      useFactory: (p: PrismaClient) => new PrismaHistoricalImportRepository(p),
      inject: [PrismaClient],
    },
    {
      provide: HistoricalImportApplicationService,
      useFactory: (r: HistoricalImportRepository) => new HistoricalImportApplicationService(r),
      inject: [HISTORICAL_IMPORT_REPOSITORY],
    },
    PrismaClient,
    {
      provide: BILLING_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaBillingRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: MANUAL_INVOICE_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaManualInvoiceRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: ManualInvoiceLedgerAdapter,
      useFactory: (gl: GeneralLedgerApplicationService, workflow: ManualInvoiceRepository) =>
        new ManualInvoiceLedgerAdapter(gl, workflow),
      inject: [GeneralLedgerApplicationService, MANUAL_INVOICE_REPOSITORY],
    },
    {
      provide: BillingSubledgersApplicationService,
      useFactory: (
        repository: BillingRepository,
        tax: TaxApplicationService,
        fx: CurrencyFxApplicationService,
        gl: ManualInvoiceLedgerAdapter,
      ) => new BillingSubledgersApplicationService(repository, tax, fx, gl),
      inject: [
        BILLING_REPOSITORY,
        TaxApplicationService,
        CurrencyFxApplicationService,
        ManualInvoiceLedgerAdapter,
      ],
    },
    {
      provide: ManualInvoiceWorkflowApplicationService,
      useFactory: (
        billing: BillingSubledgersApplicationService,
        repository: BillingRepository,
        workflow: ManualInvoiceRepository,
      ) => new ManualInvoiceWorkflowApplicationService(billing, repository, workflow),
      inject: [BillingSubledgersApplicationService, BILLING_REPOSITORY, MANUAL_INVOICE_REPOSITORY],
    },
    {
      provide: PartyReceivableApplicationService,
      useFactory: (repository: BillingRepository, billing: BillingSubledgersApplicationService, fx: CurrencyFxApplicationService) =>
        new PartyReceivableApplicationService(repository, billing, fx),
      inject: [BILLING_REPOSITORY, BillingSubledgersApplicationService, CurrencyFxApplicationService],
    },
  ],
  exports: [
    HistoricalImportApplicationService,
    BillingSubledgersApplicationService,
    ManualInvoiceWorkflowApplicationService,
    PartyReceivableApplicationService,
  ],
})
export class BillingSubledgersModule {}
