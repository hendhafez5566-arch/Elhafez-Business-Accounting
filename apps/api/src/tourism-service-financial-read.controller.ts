import { Controller, Get, Headers, Param, UnauthorizedException } from '@nestjs/common';
import { executionContext, sourceReference, type ExecutionContext } from '@elhafez/contracts';
import { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import { PLATFORM_CORE_PERMISSIONS, PlatformCoreApplicationService } from '@elhafez/platform-core';
import { ProcurementFinanceApplicationService } from '@elhafez/procurement-finance';
import { StandaloneServicesApplicationService } from '@elhafez/standalone-services';
import { TourismFinanceReadApplicationService } from '@elhafez/tourism-finance-orchestration';
import { TOURISM_SERVICE_PERMISSIONS } from './tourism-services.controller.js';

type TourismServiceInvoicePosition = Record<string, unknown>;
export type TourismServiceFinancialReadView = {
  finance: unknown;
  customerInvoice: TourismServiceInvoicePosition | null;
  supplierInvoices: TourismServiceInvoicePosition[];
  purchaseOrders: Record<string, unknown>[];
};

@Controller('tourism/services')
export class TourismServiceFinancialReadController {
  static readonly runtimeDependencies = [
    StandaloneServicesApplicationService,
    TourismFinanceReadApplicationService,
    BillingSubledgersApplicationService,
    ProcurementFinanceApplicationService,
    PlatformCoreApplicationService,
  ] as const;

  constructor(
    private readonly services: StandaloneServicesApplicationService,
    private readonly finance: TourismFinanceReadApplicationService,
    private readonly billing: BillingSubledgersApplicationService,
    private readonly procurement: ProcurementFinanceApplicationService,
    private readonly platform: PlatformCoreApplicationService,
  ) {}

  @Get(':id/financials')
  async financials(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') serviceId: string,
  ): Promise<TourismServiceFinancialReadView> {
    const context = await this.context(authorization, companyId, branchId);
    const source = await this.services.getService(context.companyId, serviceId);
    if (source.service.branchId !== context.branchId) throw new UnauthorizedException('service outside branch');

    const finance = await this.finance.standaloneServiceFinancialView(
      context.companyId,
      context.branchId,
      sourceReference('TOURISM_SERVICE', serviceId),
    );
    if (!finance.reference) return { finance, customerInvoice: null, supplierInvoices: [], purchaseOrders: [] };

    const allInvoices = await this.billing.listInvoices(context.companyId);
    const customerInvoice = finance.reference.invoiceId
      ? await this.invoicePosition(allInvoices, context, finance.reference.invoiceId)
      : null;

    const purchaseOrders = await Promise.all(
      finance.reference.purchaseOrderIds.map((id) => this.procurement.getPurchaseOrderForBranch(context.companyId, context.branchId, id)),
    );
    const purchaseOrderIds = new Set(finance.reference.purchaseOrderIds);
    const supplierInvoiceRows = allInvoices.filter((invoice) =>
      invoice.type === 'SUPPLIER' &&
      invoice.branchId === context.branchId &&
      invoice.sourceType === 'PROCUREMENT_PO' &&
      purchaseOrderIds.has(invoice.sourceId)
    );
    const supplierInvoices = await Promise.all(
      supplierInvoiceRows.map((invoice) => this.invoicePosition(allInvoices, context, invoice.id)),
    );

    return {
      finance,
      customerInvoice,
      supplierInvoices: supplierInvoices.filter((item): item is TourismServiceInvoicePosition => Boolean(item)),
      purchaseOrders: purchaseOrders.map((po) => ({
        id: po.id,
        number: po.number,
        supplierId: po.supplierId,
        status: po.status,
        currency: po.currency,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        lines: po.lines.map((line) => ({
          id: line.id,
          itemReference: line.itemReference,
          description: line.description,
          orderedQuantity: line.orderedQuantity,
          receivedQuantity: line.receivedQuantity,
          invoicedQuantity: line.invoicedQuantity,
          unitPrice: line.unitPrice,
        })),
      })),
    };
  }

  private async invoicePosition(
    allInvoices: Awaited<ReturnType<BillingSubledgersApplicationService['listInvoices']>>,
    context: ExecutionContext,
    invoiceId: string,
  ): Promise<TourismServiceInvoicePosition | null> {
    const invoice = allInvoices.find((item) => item.id === invoiceId && item.branchId === context.branchId);
    if (!invoice) return null;
    const position = await this.billing.getOpenPosition(context.companyId, invoice.id);
    return {
      id: invoice.id,
      number: invoice.number,
      externalInvoiceNumber: invoice.externalInvoiceNumber,
      type: invoice.type,
      partyId: invoice.partyId,
      postingDate: invoice.postingDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      status: invoice.status,
      documentTotal: position.documentTotal,
      outstanding: position.outstanding,
      sourceType: invoice.sourceType,
      sourceId: invoice.sourceId,
    };
  }

  private async context(
    authorization: string | undefined,
    companyId: string | undefined,
    branchId: string | undefined,
  ): Promise<ExecutionContext> {
    if (!authorization?.startsWith('Bearer ') || !companyId || !branchId) {
      throw new UnauthorizedException('authenticated company and branch context required');
    }
    const user = await this.platform.currentUser(authorization.slice(7));
    const context = executionContext(companyId, branchId, user.id);
    await this.platform.requireBranchAccess(user.id, context.companyId, context.branchId);
    await this.platform.authorize(user.id, context.companyId, TOURISM_SERVICE_PERMISSIONS.view);
    await this.platform.authorize(user.id, context.companyId, PLATFORM_CORE_PERMISSIONS.accountingFinanceRead);
    return context;
  }
}
