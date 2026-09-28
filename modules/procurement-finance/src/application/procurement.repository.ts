import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type {
  InvoiceConversion,
  ProcurementHistory,
  ProcurementPolicy,
  ProcurementQuantityMutationOutcome,
  PurchaseOrder,
  SupplierCommitment,
} from '../domain/procurement.js';

export const PROCUREMENT_REPOSITORY = Symbol('PROCUREMENT_REPOSITORY');

export interface ProcurementRepository {
  policy(companyId: CompanyId): Promise<ProcurementPolicy | undefined>;
  savePolicy(value: ProcurementPolicy): Promise<ProcurementPolicy>;

  commitment(companyId: CompanyId, id: string): Promise<SupplierCommitment | undefined>;
  commitmentBySource(
    companyId: CompanyId,
    type: string,
    id: string,
  ): Promise<SupplierCommitment | undefined>;
  saveCommitment(
    value: SupplierCommitment,
    history: ProcurementHistory,
  ): Promise<SupplierCommitment>;
  cancelCommitment(
    companyId: CompanyId,
    id: string,
    reason: string,
    at: string,
  ): Promise<SupplierCommitment>;

  po(companyId: CompanyId, id: string): Promise<PurchaseOrder | undefined>;
  listPos(companyId: CompanyId, branchId?: string): Promise<PurchaseOrder[]>;
  posByCommitment(companyId: CompanyId, commitmentId: string): Promise<PurchaseOrder[]>;
  poByNumber(companyId: CompanyId, branchId: string, number: string): Promise<PurchaseOrder | undefined>;
  nextPoNumber(companyId: CompanyId, branchId: string, year: number): Promise<number>;
  savePo(value: PurchaseOrder, history: ProcurementHistory): Promise<PurchaseOrder>;
  updateDraftPo(
    value: PurchaseOrder,
    commandId: string,
    requestHash: string,
    history: ProcurementHistory,
  ): Promise<PurchaseOrder>;
  approvePo(
    companyId: CompanyId,
    id: string,
    poHistory: ProcurementHistory,
    commitmentHistory?: ProcurementHistory,
  ): Promise<PurchaseOrder>;
  transitionPo(
    companyId: CompanyId,
    id: string,
    from: string[],
    to: string,
    history: ProcurementHistory,
  ): Promise<PurchaseOrder>;
  receive(
    companyId: CompanyId,
    poId: string,
    lineId: string,
    quantity: DecimalAmount,
    commandId: string,
    requestHash: string,
  ): Promise<ProcurementQuantityMutationOutcome>;
  adjustReceived(
    companyId: CompanyId,
    poId: string,
    lineId: string,
    newReceivedQuantity: DecimalAmount,
    commandId: string,
    requestHash: string,
    reason: string,
  ): Promise<ProcurementQuantityMutationOutcome>;

  conversion(companyId: CompanyId, id: string): Promise<InvoiceConversion | undefined>;
  listConversions(companyId:CompanyId,purchaseOrderId:string):Promise<InvoiceConversion[]>;
  reserveConversion(value: InvoiceConversion): Promise<InvoiceConversion>;
  completeConversion(
    companyId: CompanyId,
    id: string,
    billingInvoiceId: string,
  ): Promise<InvoiceConversion>;
  reopenConversion(
    companyId: CompanyId,
    id: string,
    billingInvoiceId: string,
    eventId: string,
    requestHash: string,
  ): Promise<InvoiceConversion>;

  history(companyId: CompanyId, aggregateId: string): Promise<ProcurementHistory[]>;
}
