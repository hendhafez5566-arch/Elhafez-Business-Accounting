import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
import type {
  InvoiceConversion,
  ProcurementHistory,
  ProcurementPolicy,
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
  posByCommitment(companyId: CompanyId, commitmentId: string): Promise<PurchaseOrder[]>;
  poByNumber(companyId: CompanyId, number: string): Promise<PurchaseOrder | undefined>;
  savePo(value: PurchaseOrder, history: ProcurementHistory): Promise<PurchaseOrder>;
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
  ): Promise<PurchaseOrder>;

  conversion(companyId: CompanyId, id: string): Promise<InvoiceConversion | undefined>;
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
