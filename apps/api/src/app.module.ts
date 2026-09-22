import { Module } from '@nestjs/common';
import { DataExchangeModule } from '@elhafez/data-exchange/nest';
import { PlatformOperationsModule } from '@elhafez/platform-operations/nest';
import { PlatformCoreModule } from '@elhafez/platform-core';
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
import { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import { ProcurementFinanceModule } from '@elhafez/procurement-finance/nest';
import { TourismContractInventoryModule } from '@elhafez/tourism-contract-inventory/nest';
import { TourismFinanceOrchestrationModule } from '@elhafez/tourism-finance-orchestration/nest';
import { HajjUmrahSeasonsModule } from '@elhafez/hajj-umrah-seasons/nest';
import { HajjUmrahProgramsModule } from '@elhafez/hajj-umrah-programs/nest';
import { HajjUmrahBookingsModule } from '@elhafez/hajj-umrah-bookings/nest';
import { HajjUmrahRoomingModule } from '@elhafez/hajj-umrah-rooming/nest';
import { HajjUmrahVisaOperationsModule } from '@elhafez/hajj-umrah-visa-operations/nest';
import { HajjUmrahTicketingModule } from '@elhafez/hajj-umrah-ticketing/nest';
import { HajjUmrahTransportOperationsModule } from '@elhafez/hajj-umrah-transport-operations/nest';
import { HajjUmrahTripOperationsModule } from '@elhafez/hajj-umrah-trip-operations/nest';
import { HajjUmrahReadinessModule } from '@elhafez/hajj-umrah-readiness/nest';
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
import { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import { SupplierManagementModule } from '@elhafez/supplier-management/nest';
import { SupplierEvaluationApplicationService } from '@elhafez/supplier-evaluation';
import { SupplierEvaluationModule } from '@elhafez/supplier-evaluation/nest';
import { SupplierDisputesApplicationService } from '@elhafez/supplier-disputes';
import { SupplierDisputesModule } from '@elhafez/supplier-disputes/nest';
import { ProcurementFulfillmentApplicationService } from '@elhafez/procurement-fulfillment';
import { ProcurementFulfillmentModule } from '@elhafez/procurement-fulfillment/nest';
import { TravelerManagementApplicationService } from '@elhafez/traveler-management';
import { TravelerManagementModule } from '@elhafez/traveler-management/nest';
import { FinancialReportingEvidenceAdapter } from './financial-reporting-evidence.adapter.js';
import { Ac14MigrationModule } from './ac14-migration/ac14-migration.module.js';
import { CrmSalesReadModelController } from './crm-sales-read-model.controller.js';
import { CrmSalesReadModelService } from './crm-sales-read-model.service.js';
import { SupplierIntelligenceReadModelController } from './supplier-intelligence-read-model.controller.js';
import { SupplierIntelligenceReadModelService } from './supplier-intelligence-read-model.service.js';
import { HajjUmrahController } from './hajj-umrah.controller.js';
import { HajjUmrahOperationsController } from './hajj-umrah-operations.controller.js';
import { SystemAdministrationController } from './system-administration.controller.js';
import { HajjUmrahReadinessController } from './hajj-umrah-readiness.controller.js';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({
  imports: [
    PlatformCoreModule, DataExchangeModule, PlatformOperationsModule, PartyRegistryModule, AgentManagementModule, CustomerManagementModule, CrmLeadsModule, CrmFollowupsModule, QuotationsModule, SupplierManagementModule, SupplierEvaluationModule, SupplierDisputesModule, ProcurementFulfillmentModule, TravelerManagementModule,
    PeriodControlModule, GeneralLedgerModule, FinancialControlsModule, TaxModule, BillingSubledgersModule, TreasurySettlementModule, PartyAccountingModule,
    ExpenseCommissionRecognitionModule, CostBudgetAccountingModule, AssetsFinancingModule, ProcurementFinanceModule, TourismContractInventoryModule,
    TourismFinanceOrchestrationModule, HajjUmrahSeasonsModule, HajjUmrahProgramsModule, HajjUmrahBookingsModule, HajjUmrahRoomingModule, HajjUmrahVisaOperationsModule, HajjUmrahTicketingModule, HajjUmrahTransportOperationsModule, HajjUmrahTripOperationsModule, HajjUmrahReadinessModule, FinancialReportingModule, Ac14MigrationModule,
  ],
  controllers: [SystemAdministrationController, CrmSalesReadModelController, SupplierIntelligenceReadModelController, HajjUmrahController, HajjUmrahOperationsController, HajjUmrahReadinessController],
  providers: [
    FinancialReportingEvidenceAdapter,
    {
      provide: SupplierIntelligenceReadModelService,
      useFactory: (suppliers: SupplierManagementApplicationService, evaluations: SupplierEvaluationApplicationService, disputes: SupplierDisputesApplicationService, procurement: ProcurementFinanceApplicationService, fulfillment: ProcurementFulfillmentApplicationService) => new SupplierIntelligenceReadModelService(suppliers,evaluations,disputes,procurement,fulfillment),
      inject: [SupplierManagementApplicationService, SupplierEvaluationApplicationService, SupplierDisputesApplicationService, ProcurementFinanceApplicationService, ProcurementFulfillmentApplicationService],
    },
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
