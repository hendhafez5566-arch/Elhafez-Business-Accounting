import type { ExecutionContext } from '@elhafez/contracts';
import type { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import type { SupplierEvaluationApplicationService } from '@elhafez/supplier-evaluation';
import type { SupplierDisputesApplicationService } from '@elhafez/supplier-disputes';
import type { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import type { ProcurementFulfillmentApplicationService } from '@elhafez/procurement-fulfillment';

export class SupplierIntelligenceReadModelService {
  constructor(
    private readonly suppliers: Pick<SupplierManagementApplicationService, 'listForIntegration' | 'supplierViewForIntegration' | 'holdStateForIntegration'>,
    private readonly evaluations: Pick<SupplierEvaluationApplicationService, 'listForIntegration' | 'latestForIntegration'>,
    private readonly disputes: Pick<SupplierDisputesApplicationService, 'listForIntegration'>,
    private readonly procurement: Pick<ProcurementFinanceApplicationService, 'supplierPerformanceMetricsForIntegration'>,
    private readonly fulfillment: Pick<ProcurementFulfillmentApplicationService, 'supplierTimingMetricsForIntegration'>,
  ) {}

  async searchSuppliers(context: ExecutionContext, query?: string) {
    return this.suppliers.listForIntegration(context, query);
  }

  async overview(context: ExecutionContext, supplierPartyId: string) {
    const [supplier, latestEvaluation, evaluationHistory, disputeHistory, economic, timing, holdState] = await Promise.all([
      this.suppliers.supplierViewForIntegration(context, supplierPartyId),
      this.evaluations.latestForIntegration(context, supplierPartyId),
      this.evaluations.listForIntegration(context, supplierPartyId),
      this.disputes.listForIntegration(context, supplierPartyId),
      this.procurement.supplierPerformanceMetricsForIntegration(context.companyId, context.branchId, supplierPartyId),
      this.fulfillment.supplierTimingMetricsForIntegration(context.companyId, context.branchId, supplierPartyId),
      this.suppliers.holdStateForIntegration(context, supplierPartyId),
    ]);

    const activeHolds = holdState.activeHolds.map((hold) => ({
      id: hold.id,
      sourceType: hold.sourceType,
      sourceId: hold.sourceId,
      reason: hold.reason,
      createdAt: hold.createdAt,
    }));

    return {
      supplier: {
        party: supplier.party,
        supplierCode: supplier.supplier.supplierCode,
        categories: supplier.categories,
        status: supplier.supplier.status,
        approvalStatus: supplier.supplier.approvalStatus,
        defaultCurrency: supplier.supplier.defaultCurrency,
        creditDays: supplier.supplier.creditDays,
        contactPerson: supplier.supplier.contactPerson,
        notes: supplier.supplier.notes,
      },
      evaluation: { latest: latestEvaluation, history: evaluationHistory },
      procurementMetrics: { ...economic, ...timing },
      disputes: {
        open: disputeHistory.filter((item) => item.status === 'OPEN'),
        history: disputeHistory,
      },
      holds: {
        isHeld: holdState.isHeld,
        active: activeHolds,
        criticalDisputeIds: activeHolds
          .filter((hold) => hold.sourceType === 'SUPPLIER_DISPUTE')
          .map((hold) => hold.sourceId),
      },
    };
  }
}

export type SupplierIntelligenceOverview = Awaited<ReturnType<SupplierIntelligenceReadModelService['overview']>>;
