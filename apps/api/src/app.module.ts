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

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({ imports: [PlatformCoreModule, PeriodControlModule, GeneralLedgerModule, FinancialControlsModule, TaxModule, BillingSubledgersModule, TreasurySettlementModule, PartyAccountingModule, ExpenseCommissionRecognitionModule, CostBudgetAccountingModule, AssetsFinancingModule, ProcurementFinanceModule, TourismContractInventoryModule] })
export class AppModule {}
