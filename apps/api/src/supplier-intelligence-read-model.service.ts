import type { ExecutionContext } from '@elhafez/contracts';
import type { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import type { SupplierEvaluationApplicationService } from '@elhafez/supplier-evaluation';
import type { SupplierDisputesApplicationService } from '@elhafez/supplier-disputes';
import type { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import type { ProcurementFulfillmentApplicationService } from '@elhafez/procurement-fulfillment';
import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import type { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';

const zeroAmount=(value:string)=>/^0(?:\.0+)?$/.test(value.trim());
type NamedRow = { id: string } & Record<string, unknown>;
type SupplierDisputeRow = { id:string; title:string; severity:string; status:string; openedAt:string } & Record<string, unknown>;
type SupplierHoldRow = { id:string; sourceType:string; sourceId:string; reason:string; createdAt:string } & Record<string, unknown>;
type SupplierPurchaseOrderRow = { id:string; number:string } & Record<string, unknown>;

export type SupplierIntelligenceOverview = {
  supplier: {
    party: { id:string; displayName:string } & Record<string, unknown>;
    supplierCode: string;
    categories: readonly string[];
    status: string;
    approvalStatus: string;
    defaultCurrency: unknown;
    creditDays: unknown;
    contactPerson: unknown;
    notes: unknown;
  };
  evaluation: { latest: NamedRow | undefined; history: readonly NamedRow[] };
  procurementMetrics: Record<string, unknown>;
  purchaseOrders: readonly SupplierPurchaseOrderRow[];
  disputes: { open: readonly SupplierDisputeRow[]; history: readonly SupplierDisputeRow[] };
  holds: { isHeld: boolean; active: readonly SupplierHoldRow[]; criticalDisputeIds: readonly string[] };
};

export class SupplierIntelligenceReadModelService {
  constructor(
    private readonly suppliers: Pick<SupplierManagementApplicationService, 'listForIntegration' | 'supplierViewForIntegration' | 'holdStateForIntegration'>,
    private readonly evaluations: Pick<SupplierEvaluationApplicationService, 'listForIntegration' | 'latestForIntegration'>,
    private readonly disputes: Pick<SupplierDisputesApplicationService, 'listForIntegration'>,
    private readonly procurement: Pick<ProcurementFinanceApplicationService, 'supplierPerformanceMetricsForIntegration' | 'purchaseOrdersForSupplierMetricsForIntegration'>,
    private readonly fulfillment: Pick<ProcurementFulfillmentApplicationService, 'supplierTimingMetricsForIntegration'>,
    private readonly billing: Pick<BillingSubledgersApplicationService, 'listInvoices' | 'getOpenPosition' | 'getAdvance'>,
    private readonly treasury: Pick<TreasurySettlementApplicationService, 'listVouchers'>,
  ) {}

  async searchSuppliers(context: ExecutionContext, query?: string) { return this.suppliers.listForIntegration(context, query); }

  async overview(context: ExecutionContext, supplierPartyId: string): Promise<SupplierIntelligenceOverview> {
    const [supplier, latestEvaluation, evaluationHistory, disputeHistory, economic, timing, holdState, purchaseOrders] = await Promise.all([
      this.suppliers.supplierViewForIntegration(context, supplierPartyId), this.evaluations.latestForIntegration(context, supplierPartyId), this.evaluations.listForIntegration(context, supplierPartyId), this.disputes.listForIntegration(context, supplierPartyId), this.procurement.supplierPerformanceMetricsForIntegration(context.companyId, context.branchId, supplierPartyId), this.fulfillment.supplierTimingMetricsForIntegration(context.companyId, context.branchId, supplierPartyId), this.suppliers.holdStateForIntegration(context, supplierPartyId), this.procurement.purchaseOrdersForSupplierMetricsForIntegration(context.companyId, context.branchId, supplierPartyId),
    ]);
    const activeHolds = holdState.activeHolds.map((hold) => ({ id: hold.id, sourceType: hold.sourceType, sourceId: hold.sourceId, reason: hold.reason, createdAt: hold.createdAt }));
    return {
      supplier: { party: supplier.party, supplierCode: supplier.supplier.supplierCode, categories: supplier.categories, status: supplier.supplier.status, approvalStatus: supplier.supplier.approvalStatus, defaultCurrency: supplier.supplier.defaultCurrency, creditDays: supplier.supplier.creditDays, contactPerson: supplier.supplier.contactPerson, notes: supplier.supplier.notes },
      evaluation: { latest: latestEvaluation, history: evaluationHistory },
      procurementMetrics: { ...economic, ...timing },
      purchaseOrders: purchaseOrders.map((po) => ({ id: po.id, number: po.number, status: po.status, orderDate: po.orderDate, expectedDate: po.expectedDate, currency: po.currency, externalReference: po.externalReference, notes: po.notes, lines: po.lines.map((line) => ({ id: line.id, itemReference: line.itemReference, description: line.description, orderedQuantity: line.orderedQuantity, receivedQuantity: line.receivedQuantity, invoicedQuantity: line.invoicedQuantity, unitPrice: line.unitPrice })) })),
      disputes: { open: disputeHistory.filter((item) => item.status === 'OPEN'), history: disputeHistory },
      holds: { isHeld: holdState.isHeld, active: activeHolds, criticalDisputeIds: activeHolds.filter((hold) => hold.sourceType === 'SUPPLIER_DISPUTE').map((hold) => hold.sourceId) },
    };
  }

  async financials(context: ExecutionContext, supplierPartyId: string) {
    const supplier = await this.suppliers.supplierViewForIntegration(context, supplierPartyId);
    if (supplier.party.id !== supplierPartyId) throw new Error('canonical supplier Party identity required');
    const [allInvoices, allVouchers] = await Promise.all([this.billing.listInvoices(context.companyId), this.treasury.listVouchers(context.companyId)]);
    const invoices = allInvoices.filter((invoice) => invoice.type === 'SUPPLIER' && invoice.partyId === supplierPartyId && invoice.branchId === context.branchId);
    const asOf=new Date().toISOString().slice(0,10);
    const positions = await Promise.all(invoices.map(async (invoice) => {
      const position = await this.billing.getOpenPosition(context.companyId, invoice.id);
      return { id: invoice.id, number: invoice.number, externalInvoiceNumber: invoice.externalInvoiceNumber, postingDate: invoice.postingDate, dueDate: invoice.dueDate, currency: invoice.currency, status: invoice.status, documentTotal: position.documentTotal, outstanding: position.outstanding, isOverdue:Boolean(invoice.dueDate&&invoice.dueDate<asOf&&invoice.status==='POSTED'&&!zeroAmount(position.outstanding)), sourceType: invoice.sourceType, sourceId: invoice.sourceId };
    }));
    const vouchers = allVouchers.filter((voucher) => voucher.partyKind === 'SUPPLIER' && voucher.partyId === supplierPartyId && voucher.branchId === context.branchId).map((voucher) => ({ id: voucher.id, number: voucher.number, kind: voucher.kind, postingDate: voucher.postingDate, currency: voucher.currency, amount: voucher.amount, status: voucher.status, treasuryId: voucher.treasuryId, sourceType: voucher.sourceType, sourceId: voucher.sourceId, advanceId: voucher.advanceId }));
    const advanceIds = [...new Set(vouchers.map((voucher) => voucher.advanceId).filter((id): id is string => Boolean(id)))];
    const activeAdvances = (await Promise.all(advanceIds.map(async (id) => { try { const advance = await this.billing.getAdvance(context.companyId, id); return advance.partyKind === 'SUPPLIER' && advance.partyId === supplierPartyId ? { id: advance.id, amount: advance.amount, available: advance.available, sourceType: advance.sourceType, sourceId: advance.sourceId, restrictionSourceType: advance.restrictionSourceType, restrictionSourceId: advance.restrictionSourceId } : null; } catch { return null; } }))).filter((advance): advance is NonNullable<typeof advance> => Boolean(advance));
    return { invoices: positions, vouchers, activeAdvances };
  }
}

export type SupplierFinancialOverview = Awaited<ReturnType<SupplierIntelligenceReadModelService['financials']>>;
