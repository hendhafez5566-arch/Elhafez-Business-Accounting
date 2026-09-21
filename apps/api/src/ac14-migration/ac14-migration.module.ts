import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { CurrencyFxModule } from '@elhafez/currency-fx';
import { CostBudgetAccountingModule } from '@elhafez/cost-budget-accounting';
import { PeriodControlModule } from '@elhafez/period-control';
import { GeneralLedgerModule } from '@elhafez/general-ledger';
import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersModule } from '@elhafez/billing-subledgers';
import { TreasurySettlementModule } from '@elhafez/treasury-settlement';
import { PartyAccountingModule } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionModule } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingModule } from '@elhafez/assets-financing';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance/nest';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory/nest';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration/nest';
import { FinancialReportingModule } from '@elhafez/financial-reporting';
import { Ac14PreflightService } from './preflight.service.js';
import { Ac14MigrationCoordinator } from './coordinator.service.js';
import { AC14_OWNER_IMPORT_GATEWAY } from './owner-import.gateway.js';
import { ProductionAc14OwnerImportGateway } from './production-owner-import.gateway.js';
@Module({imports:[PlatformCoreModule,CurrencyFxModule,CostBudgetAccountingModule,PeriodControlModule,GeneralLedgerModule,TaxModule,BillingSubledgersModule,TreasurySettlementModule,PartyAccountingModule,ExpenseCommissionRecognitionModule,AssetsFinancingModule,ProcurementFinanceModule,FinancialControlsModule,TourismContractInventoryModule,TourismFinanceOrchestrationModule,FinancialReportingModule],providers:[Ac14PreflightService,Ac14MigrationCoordinator,ProductionAc14OwnerImportGateway,{provide:AC14_OWNER_IMPORT_GATEWAY,useExisting:ProductionAc14OwnerImportGateway}],exports:[Ac14PreflightService,Ac14MigrationCoordinator]})
export class Ac14MigrationModule {}
