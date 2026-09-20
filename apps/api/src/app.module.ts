import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { PeriodControlModule } from '@elhafez/period-control';
import { GeneralLedgerModule } from '@elhafez/general-ledger';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersModule } from '@elhafez/billing-subledgers';
import { TreasurySettlementModule } from '@elhafez/treasury-settlement';
import { PartyAccountingModule } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionModule } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingModule } from '@elhafez/assets-financing';
import { CostBudgetAccountingModule } from '@elhafez/cost-budget-accounting';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration';
import { FinancialReportingModule } from '@elhafez/financial-reporting';
import { FinancialReportingEvidenceAdapter } from './financial-reporting-evidence.adapter.js';
import { Ac14MigrationModule } from './ac14-migration/ac14-migration.module.js';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({ imports: [PlatformCoreModule, PeriodControlModule, GeneralLedgerModule, FinancialControlsModule, TaxModule, BillingSubledgersModule, TreasurySettlementModule, PartyAccountingModule, ExpenseCommissionRecognitionModule, CostBudgetAccountingModule, AssetsFinancingModule, ProcurementFinanceModule, TourismContractInventoryModule, TourismFinanceOrchestrationModule, FinancialReportingModule, Ac14MigrationModule], providers: [FinancialReportingEvidenceAdapter] })
export class AppModule {}
