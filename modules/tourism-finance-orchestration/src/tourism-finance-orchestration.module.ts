import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  BillingSubledgersApplicationService,
  BillingSubledgersModule,
} from '@elhafez/billing-subledgers';
import {
  TreasurySettlementApplicationService,
  TreasurySettlementModule,
} from '@elhafez/treasury-settlement';
import {
  ExpenseCommissionRecognitionApplicationService,
  ExpenseCommissionRecognitionModule,
} from '@elhafez/expense-commission-recognition';
import { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance/nest';
import {
  CostBudgetAccountingApplicationService,
  CostBudgetAccountingModule,
} from '@elhafez/cost-budget-accounting';
import {
  FinancialControlsApplicationService,
  FinancialControlsModule,
} from '@elhafez/financial-controls';
import type { TourismContractInventoryApplicationService } from '@elhafez/tourism-contract-inventory';
import {
  TOURISM_CONTRACT_INVENTORY_SERVICE,
  TourismContractInventoryModule,
} from '@elhafez/tourism-contract-inventory/nest';
import {
  TOURISM_FINANCE_REPOSITORY,
  type TourismFinanceRepository,
} from './application/orchestration.repository.js';
import { TourismFinanceOrchestrationApplicationService } from './application/tourism-finance-orchestration.application-service.js';
import { HistoricalImportApplicationService } from './application/historical-import.application-service.js';
import {
  HISTORICAL_IMPORT_REPOSITORY,
  type HistoricalImportRepository,
} from './application/historical-import.repository.js';
import { PrismaHistoricalImportRepository } from './infrastructure/prisma-historical-import.repository.js';
import { PrismaTourismFinanceRepository } from './infrastructure/prisma-tourism-finance.repository.js';
import {
  BillingAdapter,
  CommissionAdapter,
  ControlsAdapter,
  CostAdapter,
  InventoryAdapter,
  ProcurementAdapter,
  TreasuryAdapter,
} from './infrastructure/tourism-finance-orchestration.adapters.js';

@Module({
  imports: [
    CostBudgetAccountingModule,
    TourismContractInventoryModule,
    ProcurementFinanceModule,
    BillingSubledgersModule,
    TreasurySettlementModule,
    ExpenseCommissionRecognitionModule,
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
      useFactory: (repository: HistoricalImportRepository) =>
        new HistoricalImportApplicationService(repository),
      inject: [HISTORICAL_IMPORT_REPOSITORY],
    },
    PrismaClient,
    {
      provide: TOURISM_FINANCE_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaTourismFinanceRepository(prisma),
      inject: [PrismaClient],
    },
    {
      provide: TourismFinanceOrchestrationApplicationService,
      useFactory: (
        repository: TourismFinanceRepository,
        billing: BillingSubledgersApplicationService,
        treasury: TreasurySettlementApplicationService,
        expense: ExpenseCommissionRecognitionApplicationService,
        cost: CostBudgetAccountingApplicationService,
        inventory: TourismContractInventoryApplicationService,
        procurement: ProcurementFinanceApplicationService,
        controls: FinancialControlsApplicationService,
      ) =>
        new TourismFinanceOrchestrationApplicationService(
          repository,
          new BillingAdapter(billing),
          new TreasuryAdapter(treasury),
          new CommissionAdapter(expense),
          new CostAdapter(cost),
          new InventoryAdapter(inventory),
          new ProcurementAdapter(procurement),
          new ControlsAdapter(controls),
        ),
      inject: [
        TOURISM_FINANCE_REPOSITORY,
        BillingSubledgersApplicationService,
        TreasurySettlementApplicationService,
        ExpenseCommissionRecognitionApplicationService,
        CostBudgetAccountingApplicationService,
        TOURISM_CONTRACT_INVENTORY_SERVICE,
        ProcurementFinanceApplicationService,
        FinancialControlsApplicationService,
      ],
    },
  ],
  exports: [
    HistoricalImportApplicationService,
    TourismFinanceOrchestrationApplicationService,
  ],
})
export class TourismFinanceOrchestrationModule {}
