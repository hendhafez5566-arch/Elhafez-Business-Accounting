import { Module } from '@nestjs/common';
import { PlatformCoreApplicationService, PlatformCoreModule } from '@elhafez/platform-core';
import { PeriodControlModule } from '@elhafez/period-control';
import { GeneralLedgerModule } from '@elhafez/general-ledger';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersApplicationService, BillingSubledgersModule } from '@elhafez/billing-subledgers';
import { TreasurySettlementModule } from '@elhafez/treasury-settlement';
import { PartyAccountingModule } from '@elhafez/party-accounting';
import { ExpenseCommissionRecognitionModule } from '@elhafez/expense-commission-recognition';
import { AssetsFinancingModule } from '@elhafez/assets-financing';
import { CostBudgetAccountingModule } from '@elhafez/cost-budget-accounting';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration';
import { FinancialReportingModule } from '@elhafez/financial-reporting';
import { PartyRegistryModule } from '@elhafez/party-registry';
import { AgentManagementApplicationService } from '@elhafez/agent-management';
import { AgentManagementModule } from '@elhafez/agent-management/nest';
import { CustomerManagementApplicationService } from '@elhafez/customer-management';
import { CustomerManagementModule } from '@elhafez/customer-management/nest';
import { CrmLeadsApplicationService } from '@elhafez/crm-leads';
import { CrmLeadsModule } from '@elhafez/crm-leads/nest';
import { CrmFollowupsApplicationService } from '@elhafez/crm-followups';
import { CrmFollowupsModule } from '@elhafez/crm-followups/nest';
import { QuotationsApplicationService } from '@elhafez/quotations';
import { QuotationsModule } from '@elhafez/quotations/nest';
import { SupplierManagementModule } from '@elhafez/supplier-management/nest';
import { TravelerManagementApplicationService } from '@elhafez/traveler-management';
import { TravelerManagementModule } from '@elhafez/traveler-management/nest';
import { FinancialReportingEvidenceAdapter } from './financial-reporting-evidence.adapter.js';
import { Ac14MigrationModule } from './ac14-migration/ac14-migration.module.js';
import { CrmSalesReadModelController } from './crm-sales-read-model.controller.js';
import { CrmSalesReadModelService } from './crm-sales-read-model.service.js';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({
  imports: [
    PlatformCoreModule, PartyRegistryModule, AgentManagementModule, CustomerManagementModule, CrmLeadsModule, CrmFollowupsModule, QuotationsModule, SupplierManagementModule, TravelerManagementModule,
    PeriodControlModule, GeneralLedgerModule, FinancialControlsModule, TaxModule, BillingSubledgersModule, TreasurySettlementModule, PartyAccountingModule,
    ExpenseCommissionRecognitionModule, CostBudgetAccountingModule, AssetsFinancingModule, ProcurementFinanceModule, TourismContractInventoryModule,
    TourismFinanceOrchestrationModule, FinancialReportingModule, Ac14MigrationModule,
  ],
  controllers: [CrmSalesReadModelController],
  providers: [
    FinancialReportingEvidenceAdapter,
    {
      provide: CrmSalesReadModelService,
      useFactory: (
        customers: CustomerManagementApplicationService,
        agents: AgentManagementApplicationService,
        leads: CrmLeadsApplicationService,
        followups: CrmFollowupsApplicationService,
        quotations: QuotationsApplicationService,
        travelers: TravelerManagementApplicationService,
        billing: BillingSubledgersApplicationService,
      ) => new CrmSalesReadModelService(customers, agents, leads, followups, quotations, travelers, billing),
      inject: [CustomerManagementApplicationService, AgentManagementApplicationService, CrmLeadsApplicationService, CrmFollowupsApplicationService, QuotationsApplicationService, TravelerManagementApplicationService, BillingSubledgersApplicationService],
    },
  ],
})
export class AppModule {}
