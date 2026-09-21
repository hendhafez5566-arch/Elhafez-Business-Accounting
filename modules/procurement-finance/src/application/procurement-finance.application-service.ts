import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type {
  BillingSubledgersApplicationService,
  CreateInvoiceInput,
} from '@elhafez/billing-subledgers';
import type { SupplierManagementApplicationService } from '@elhafez/supplier-management';
import type { ProcurementRepository } from './procurement.repository.js';
import type {
  ProcurementHistory,
  ProcurementPolicy,
  PurchaseOrder,
  SupplierCommitment,
} from '../domain/procurement.js';

const SCALE = 10n ** 18n;

function scaled(value: DecimalAmount): bigint {
  const normalized = decimalAmount(value);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  if (fraction.length > 18) {
    throw new ContractValidationError('decimal', 'supports at most 18 fractional digits');
  }
  const raw = BigInt(whole + fraction.padEnd(18, '0'));
  return negative ? -raw : raw;
}

function decimal(value: bigint): DecimalAmount {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = absolute % SCALE;
  const text =
    fraction === 0n
      ? whole.toString()
      : `${whole}.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`;
  return decimalAmount((negative ? '-' : '') + text);
}

function multiply(left: DecimalAmount, right: DecimalAmount, field: string): DecimalAmount {
  const product=scaled(left)*scaled(right);
  if(product%SCALE!==0n)throw new ContractValidationError(field,'result exceeds supported decimal precision');
  return decimal(product/SCALE);
}

function positive(value: DecimalAmount, field: string): DecimalAmount {
  const normalized = decimalAmount(value);
  if (scaled(normalized) <= 0n) {
    throw new ContractValidationError(field, 'must be positive');
  }
  return normalized;
}

function nonNegative(value: DecimalAmount, field: string): DecimalAmount {
  const normalized = decimalAmount(value);
  if (scaled(normalized) < 0n) {
    throw new ContractValidationError(field, 'must be non-negative');
  }
  return normalized;
}

function requiredText(value: string | null | undefined, field: string): string {
  const normalized=value?.trim() ?? '';
  if (!normalized) throw new ContractValidationError(field, 'is required');
  return normalized;
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function now() {
  return new Date().toISOString();
}

function history(
  companyId: CompanyId,
  aggregateId: string,
  kind: string,
  sourceReference?: string,
): ProcurementHistory {
  return {
    id: `${aggregateId}:${kind}:${sourceReference ?? 'once'}`,
    companyId,
    aggregateId,
    kind,
    sourceReference,
    createdAt: now(),
  };
}

export interface CreateSupplierCommitmentInput {
  id: string;
  companyId: CompanyId;
  supplierId: string;
  sourceType: string;
  sourceId: string;
  effectiveDate: string;
}

export interface CreatePurchaseOrderInput {
  id: string;
  companyId: CompanyId;
  branchId: string;
  commitmentId?: string;
  supplierId: string;
  number?: string;
  origin: 'MANUAL' | 'AUTO';
  orderDate?: string;
  expectedDate?: string;
  currency?: string;
  externalReference?: string;
  notes?: string;
  lines: {
    id: string;
    itemReference: string;
    description?: string;
    orderedQuantity: DecimalAmount;
    unitPrice?: DecimalAmount;
    taxCode?: string;
  }[];
}

export interface UpdatePurchaseOrderInput {
  companyId: CompanyId;
  branchId: string;
  purchaseOrderId: string;
  commandId: string;
  supplierId: string;
  orderDate: string;
  expectedDate?: string;
  currency: string;
  externalReference?: string;
  notes?: string;
  lines: {
    id: string;
    itemReference: string;
    description?: string;
    orderedQuantity: DecimalAmount;
    unitPrice: DecimalAmount;
    taxCode?: string;
  }[];
}

export interface CreateDirectPurchaseInput {
  id: string;
  companyId: CompanyId;
  branchId: string;
  supplierId: string;
  invoiceId: string;
  number: string;
  externalInvoiceNumber: string;
  postingDate: string;
  dueDate?: string;
  currency: string;
  controlAccountId: string;
  lines: {
    id: string;
    accountId: string;
    amount: DecimalAmount;
    taxCode?: string;
  }[];
}

export interface ConvertToSupplierInvoiceInput {
  id: string;
  companyId: CompanyId;
  purchaseOrderId: string;
  lineId: string;
  quantity: DecimalAmount;
  billing: {
    invoiceId: string;
    number: string;
    externalInvoiceNumber: string;
    postingDate: string;
    dueDate?: string;
    currency: string;
    controlAccountId: string;
    accountId: string;
    amount: DecimalAmount;
    taxCode?: string;
  };
}

export class ProcurementFinanceApplicationService {
  constructor(
    private readonly repo: ProcurementRepository,
    private readonly billing: Pick<
      BillingSubledgersApplicationService,
      'createDraft' | 'postInvoice' | 'getOpenPosition'
    >,
    private readonly suppliers: Pick<
      SupplierManagementApplicationService,
      'assertSupplierReferenceUsableForProcurementForIntegration'
    >,
  ) {}

  async setPolicy(input: {
    companyId: CompanyId;
    commitmentTiming: string;
    version: number;
    effectiveFrom: string;
  }) {
    if (input.commitmentTiming !== 'ON_PO_APPROVAL') {
      throw new ContractValidationError(
        'commitmentTiming',
        'unsupported; UNKNOWN / NEEDS EVIDENCE',
      );
    }
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new ContractValidationError('version', 'must be a positive integer');
    }
    const value = {
      ...input,
      commitmentTiming: 'ON_PO_APPROVAL',
      requestHash: fingerprint(input),
    } as ProcurementPolicy;
    return this.repo.savePolicy(value);
  }

  async createSupplierCommitment(input: CreateSupplierCommitmentInput) {
    if (!input.supplierId.trim() || !input.sourceType.trim() || !input.sourceId.trim()) {
      throw new ContractValidationError(
        'commitment',
        'supplier and source are required',
      );
    }
    const supplier=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(input.companyId,input.supplierId);
    const normalizedInput={...input,supplierId:supplier.partyId};
    const requestHash = fingerprint(normalizedInput);
    const old = await this.repo.commitmentBySource(
      input.companyId,
      input.sourceType,
      input.sourceId,
    );
    if (old) {
      if (old.requestHash !== requestHash) {
        throw new ContractValidationError('source', 'conflicting replay');
      }
      return old;
    }

    const value: SupplierCommitment = {
      ...normalizedInput,
      status: 'DRAFT',
      requestHash,
      createdAt: now(),
    };
    return this.repo.saveCommitment(
      value,
      history(input.companyId, input.id, 'CREATED', `${input.sourceType}:${input.sourceId}`),
    );
  }

  async cancelSupplierCommitment(companyId: CompanyId, id: string, reason: string) {
    if (!reason.trim()) {
      throw new ContractValidationError('reason', 'is required');
    }
    const blockers = await this.getCancellationBlockers(companyId, {
      commitmentId: id,
    });
    if (blockers.length) {
      throw new ContractValidationError(
        'commitment',
        'supplier execution blocks cancellation',
      );
    }
    return this.repo.cancelCommitment(companyId, id, reason, now());
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    const branchId=requiredText(input.branchId,'branchId');
    const supplierId=requiredText(input.supplierId,'supplierId');
    if (!input.lines.length) throw new ContractValidationError('purchaseOrder','at least one line is required');
    let manualYear:number|undefined;
    if (input.origin==='MANUAL') {
      const orderDate=requiredText(input.orderDate,'orderDate');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(orderDate))throw new ContractValidationError('orderDate','must be YYYY-MM-DD');
      manualYear=Number(orderDate.slice(0,4));
      currencyCode(requiredText(input.currency,'currency'));
      if(input.number?.trim())throw new ContractValidationError('number','manual purchase-order number is owner-generated');
    }else{
      requiredText(input.number,'number');
    }

    const supplier=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(input.companyId,supplierId);
    const canonicalSupplierId=supplier.partyId;

    const lineIds=new Set<string>();
    const lines=input.lines.map((line)=>{
      const id=requiredText(line.id,'line.id');
      const itemReference=requiredText(line.itemReference,'line.itemReference');
      if(lineIds.has(id))throw new ContractValidationError('line','duplicate line id');
      lineIds.add(id);
      const orderedQuantity=positive(line.orderedQuantity,'orderedQuantity');
      const unitPrice=line.unitPrice===undefined?undefined:nonNegative(line.unitPrice,'unitPrice');
      if(input.origin==='MANUAL'&&unitPrice===undefined)throw new ContractValidationError('unitPrice','is required for manual purchase orders');
      return {
        id,
        itemReference,
        ...(line.description?.trim()?{description:line.description.trim()}:{}),
        orderedQuantity,
        ...(unitPrice!==undefined?{unitPrice}:{}),
        ...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{}),
      };
    });

    if (input.commitmentId) {
      const commitment=await this.repo.commitment(input.companyId,input.commitmentId);
      if(!commitment||commitment.status==='CANCELLED'){
        throw new ContractValidationError('commitment','active same-company matching commitment required');
      }
      const commitmentSupplier=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(input.companyId,commitment.supplierId);
      if(commitmentSupplier.partyId!==canonicalSupplierId){
        throw new ContractValidationError('commitment','active same-company matching commitment required');
      }
    }

    const prior=await this.repo.po(input.companyId,input.id);
    const numberValue=input.origin==='MANUAL'
      ? prior?.number ?? `PO-${manualYear}-${String(await this.repo.nextPoNumber(input.companyId,branchId,manualYear!)).padStart(6,'0')}`
      : requiredText(input.number,'number');

    const normalized:CreatePurchaseOrderInput={
      ...input,
      branchId,
      supplierId:canonicalSupplierId,
      number:numberValue,
      ...(input.orderDate?{orderDate:input.orderDate}:{}),
      ...(input.expectedDate?{expectedDate:input.expectedDate}:{}),
      ...(input.currency?{currency:currencyCode(input.currency)}:{}),
      ...(input.externalReference?.trim()?{externalReference:input.externalReference.trim()}:{}),
      ...(input.notes?.trim()?{notes:input.notes.trim()}:{}),
      lines,
    };
    const requestHash=fingerprint(input.origin==='MANUAL'?{...normalized,number:'OWNER_GENERATED'}:normalized);
    if(prior){
      if(prior.requestHash!==requestHash)throw new ContractValidationError('purchaseOrder','conflicting replay');
      return prior;
    }
    const byNumber=await this.repo.poByNumber(input.companyId,branchId,numberValue);
    if(byNumber)throw new ContractValidationError('number','already used');

    const value:PurchaseOrder={
      ...normalized,
      status:'DRAFT',
      requestHash,
      createdAt:now(),
      lines:lines.map((line)=>({
        ...line,
        companyId:input.companyId,
        purchaseOrderId:input.id,
        receivedQuantity:decimalAmount('0'),
        invoicedQuantity:decimalAmount('0'),
      })),
    };
    return this.repo.savePo(value,history(input.companyId,input.id,'CREATED'));
  }

  async updateDraftPurchaseOrder(input:UpdatePurchaseOrderInput){
    requiredText(input.branchId,'branchId');
    requiredText(input.commandId,'commandId');
    const current=await this.getPurchaseOrderForBranch(input.companyId,input.branchId,input.purchaseOrderId);
    if(current.status!=='DRAFT')throw new ContractValidationError('status','only draft purchase order can be edited');
    const supplier=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(input.companyId,input.supplierId);
    const lineIds=new Set<string>();
    const lines=input.lines.map((line)=>{
      const id=requiredText(line.id,'line.id');
      if(lineIds.has(id))throw new ContractValidationError('line','duplicate line id');
      lineIds.add(id);
      return {
        id,
        companyId:input.companyId,
        purchaseOrderId:current.id,
        itemReference:requiredText(line.itemReference,'line.itemReference'),
        ...(line.description?.trim()?{description:line.description.trim()}:{}),
        orderedQuantity:positive(line.orderedQuantity,'orderedQuantity'),
        unitPrice:nonNegative(line.unitPrice,'unitPrice'),
        ...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{}),
        receivedQuantity:decimalAmount('0'),
        invoicedQuantity:decimalAmount('0'),
      };
    });
    if(!lines.length)throw new ContractValidationError('lines','at least one line is required');
    const updated:PurchaseOrder={
      ...current,
      supplierId:supplier.partyId,
      orderDate:requiredText(input.orderDate,'orderDate'),
      ...(input.expectedDate?{expectedDate:input.expectedDate}:{expectedDate:undefined}),
      currency:currencyCode(input.currency),
      ...(input.externalReference?.trim()?{externalReference:input.externalReference.trim()}:{externalReference:undefined}),
      ...(input.notes?.trim()?{notes:input.notes.trim()}:{notes:undefined}),
      lines,
    };
    const hash=fingerprint(input);
    return this.repo.updateDraftPo(updated,input.commandId,hash,history(input.companyId,input.purchaseOrderId,'UPDATED',input.commandId));
  }

  async approvePurchaseOrder(companyId: CompanyId, id: string) {
    const policy = await this.repo.policy(companyId);
    if (!policy) {
      throw new ContractValidationError('policy', 'company procurement policy required');
    }
    if (policy.commitmentTiming !== 'ON_PO_APPROVAL') {
      throw new ContractValidationError(
        'commitmentTiming',
        'unsupported; UNKNOWN / NEEDS EVIDENCE',
      );
    }

    const po = await this.getPurchaseOrder(companyId, id);
    await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(companyId,po.supplierId);
    return this.repo.approvePo(
      companyId,
      id,
      history(companyId, id, 'APPROVED', String(policy.version)),
      po.commitmentId
        ? history(companyId, po.commitmentId, 'COMMITTED', id)
        : undefined,
    );
  }

  async receivePurchaseOrderWithOutcome(input: {
    companyId: CompanyId;
    purchaseOrderId: string;
    lineId: string;
    quantity: DecimalAmount;
    commandId: string;
  }) {
    if (!input.commandId.trim()) {
      throw new ContractValidationError('commandId', 'is required');
    }
    const normalized={...input,quantity:positive(input.quantity,'quantity')};
    return this.repo.receive(
      input.companyId,
      input.purchaseOrderId,
      input.lineId,
      normalized.quantity,
      input.commandId,
      fingerprint(normalized),
    );
  }

  async receivePurchaseOrder(input: {
    companyId: CompanyId;
    purchaseOrderId: string;
    lineId: string;
    quantity: DecimalAmount;
    commandId: string;
  }) {
    return (await this.receivePurchaseOrderWithOutcome(input)).purchaseOrder;
  }

  async adjustReceivedPurchaseOrderWithOutcome(input:{
    companyId:CompanyId;
    purchaseOrderId:string;
    lineId:string;
    newReceivedQuantity:DecimalAmount;
    commandId:string;
    reason:string;
  }){
    requiredText(input.commandId,'commandId');
    const reason=requiredText(input.reason,'reason');
    const normalized={...input,newReceivedQuantity:nonNegative(input.newReceivedQuantity,'newReceivedQuantity'),reason};
    return this.repo.adjustReceived(
      input.companyId,
      input.purchaseOrderId,
      input.lineId,
      normalized.newReceivedQuantity,
      input.commandId,
      fingerprint(normalized),
      reason,
    );
  }

  async adjustReceivedPurchaseOrder(input:{
    companyId:CompanyId;
    purchaseOrderId:string;
    lineId:string;
    newReceivedQuantity:DecimalAmount;
    commandId:string;
    reason:string;
  }){
    return (await this.adjustReceivedPurchaseOrderWithOutcome(input)).purchaseOrder;
  }

  async cancelPurchaseOrder(companyId: CompanyId, id: string) {
    return this.cancelPurchaseOrderInternal(companyId,id);
  }

  async cancelPurchaseOrderWithReason(companyId:CompanyId,id:string,reason:string){
    return this.cancelPurchaseOrderInternal(companyId,id,requiredText(reason,'reason'));
  }

  private async cancelPurchaseOrderInternal(companyId:CompanyId,id:string,reason?:string){
    const blockers=await this.getCancellationBlockers(companyId,{purchaseOrderId:id});
    if(blockers.length)throw new ContractValidationError('purchaseOrder','supplier execution blocks cancellation');
    return this.repo.transitionPo(
      companyId,
      id,
      ['DRAFT','APPROVED'],
      'CANCELLED',
      history(companyId,id,'CANCELLED',reason),
    );
  }

  async disposeDraftAutoPurchaseOrder(companyId: CompanyId, id: string) {
    const po = await this.getPurchaseOrder(companyId, id);
    if (po.origin === 'AUTO' && po.status === 'DISPOSED') return po;
    if (
      po.origin !== 'AUTO' ||
      po.status !== 'DRAFT' ||
      po.lines.some(
        (line) =>
          scaled(line.receivedQuantity) > 0n || scaled(line.invoicedQuantity) > 0n,
      )
    ) {
      throw new ContractValidationError(
        'purchaseOrder',
        'only economically empty draft auto PO can be disposed',
      );
    }
    return this.repo.transitionPo(
      companyId,
      id,
      ['DRAFT'],
      'DISPOSED',
      history(companyId, id, 'DISPOSED'),
    );
  }

  async convertToSupplierInvoice(input: ConvertToSupplierInvoiceInput) {
    const quantity=positive(input.quantity,'quantity');
    const invoiceAmount=positive(input.billing.amount,'billing.amount');
    const po=await this.getPurchaseOrder(input.companyId,input.purchaseOrderId);
    const line=po.lines.find((candidate)=>candidate.id===input.lineId);
    if(!line)throw new ContractValidationError('line','not found');

    const invoiceCurrency=currencyCode(input.billing.currency);
    if(po.currency&&invoiceCurrency!==po.currency)throw new ContractValidationError('billing.currency','must match purchase order currency');
    if(line.unitPrice!==undefined){
      const expectedAmount=multiply(quantity,line.unitPrice,'billing.amount');
      if(scaled(invoiceAmount)!==scaled(expectedAmount))throw new ContractValidationError('billing.amount','must equal invoiced quantity multiplied by purchase-order unit price');
    }
    if(line.taxCode&&input.billing.taxCode&&line.taxCode!==input.billing.taxCode)throw new ContractValidationError('billing.taxCode','must match purchase-order tax code');
    const invoiceTaxCode=input.billing.taxCode??line.taxCode;

    const normalized={
      ...input,
      quantity,
      billing:{...input.billing,amount:invoiceAmount,currency:invoiceCurrency,...(invoiceTaxCode?{taxCode:invoiceTaxCode}:{})},
    };
    const requestHash=fingerprint(normalized);

    let conversion=await this.repo.conversion(input.companyId,input.id);
    if(conversion&&conversion.requestHash!==requestHash)throw new ContractValidationError('conversion','conflicting replay');
    if(conversion?.status==='INVOICED'||conversion?.status==='REOPENED')return conversion;

    if(!conversion){
      conversion=await this.repo.reserveConversion({
        id:input.id,
        companyId:input.companyId,
        purchaseOrderId:input.purchaseOrderId,
        lineId:input.lineId,
        billingInvoiceId:input.billing.invoiceId,
        quantity,
        reopenedQuantity:decimalAmount('0'),
        requestHash,
        status:'RESERVED',
        createdAt:now(),
      });
    }

    const invoice:CreateInvoiceInput={
      id:input.billing.invoiceId,
      companyId:input.companyId,
      branchId:po.branchId,
      type:'SUPPLIER',
      partyId:po.supplierId,
      number:requiredText(input.billing.number,'billing.number'),
      externalInvoiceNumber:requiredText(input.billing.externalInvoiceNumber,'billing.externalInvoiceNumber'),
      postingDate:requiredText(input.billing.postingDate,'billing.postingDate'),
      ...(input.billing.dueDate?{dueDate:input.billing.dueDate}:{}),
      currency:invoiceCurrency,
      sourceType:'PROCUREMENT_PO',
      sourceId:input.id,
      controlAccountId:requiredText(input.billing.controlAccountId,'billing.controlAccountId'),
      lines:[{
        id:`${input.billing.invoiceId}:${input.lineId}`,
        accountId:requiredText(input.billing.accountId,'billing.accountId'),
        amount:invoiceAmount,
        ...(invoiceTaxCode?{taxCode:invoiceTaxCode}:{}),
      }],
    };

    await this.billing.createDraft(invoice);
    const posted=await this.billing.postInvoice(input.companyId,input.billing.invoiceId);
    if(posted.status!=='POSTED')throw new ContractValidationError('billingInvoice','supplier invoice did not post');
    return this.repo.completeConversion(input.companyId,input.id,input.billing.invoiceId);
  }

  async createDirectPurchase(input:CreateDirectPurchaseInput){
    const branchId=requiredText(input.branchId,'branchId');
    const supplierReference=requiredText(input.supplierId,'supplierId');
    if(!input.lines.length)throw new ContractValidationError('lines','at least one direct-purchase line is required');
    const supplier=await this.suppliers.assertSupplierReferenceUsableForProcurementForIntegration(input.companyId,supplierReference);
    const invoice:CreateInvoiceInput={
      id:requiredText(input.invoiceId,'invoiceId'),
      companyId:input.companyId,
      branchId,
      type:'SUPPLIER',
      partyId:supplier.partyId,
      number:requiredText(input.number,'number'),
      externalInvoiceNumber:requiredText(input.externalInvoiceNumber,'externalInvoiceNumber'),
      postingDate:requiredText(input.postingDate,'postingDate'),
      ...(input.dueDate?{dueDate:input.dueDate}:{}),
      currency:currencyCode(input.currency),
      sourceType:'PROCUREMENT_DIRECT',
      sourceId:requiredText(input.id,'id'),
      controlAccountId:requiredText(input.controlAccountId,'controlAccountId'),
      lines:input.lines.map((line)=>({
        id:requiredText(line.id,'line.id'),
        accountId:requiredText(line.accountId,'line.accountId'),
        amount:positive(line.amount,'line.amount'),
        ...(line.taxCode?.trim()?{taxCode:line.taxCode.trim()}:{}),
      })),
    };
    await this.billing.createDraft(invoice);
    const posted=await this.billing.postInvoice(input.companyId,invoice.id);
    if(posted.status!=='POSTED')throw new ContractValidationError('billingInvoice','supplier invoice did not post');
    return posted;
  }

  async reopenAfterSupplierInvoiceCancellation(input: {
    companyId: CompanyId;
    conversionId: string;
    billingInvoiceId: string;
    eventId: string;
  }) {
    if (!input.eventId.trim()) {
      throw new ContractValidationError('eventId', 'is required');
    }

    const conversion = await this.repo.conversion(input.companyId, input.conversionId);
    if (!conversion || conversion.billingInvoiceId !== input.billingInvoiceId) {
      throw new ContractValidationError('conversion', 'matching conversion required');
    }

    const po = await this.getPurchaseOrder(input.companyId, conversion.purchaseOrderId);
    const billingInvoice = await this.billing.getOpenPosition(
      input.companyId,
      input.billingInvoiceId,
    );
    if (
      billingInvoice.invoiceType !== 'SUPPLIER' ||
      billingInvoice.status !== 'CANCELLED' ||
      billingInvoice.partyId !== po.supplierId
    ) {
      throw new ContractValidationError(
        'billingInvoice',
        'confirmed cancelled supplier invoice required',
      );
    }

    return this.repo.reopenConversion(
      input.companyId,
      input.conversionId,
      input.billingInvoiceId,
      input.eventId,
      fingerprint(input),
    );
  }

  async getPurchaseOrder(companyId: CompanyId, id: string) {
    const value = await this.repo.po(companyId, id);
    if (!value) throw new ContractValidationError('purchaseOrder', 'not found');
    return value;
  }

  async getPurchaseOrderForBranch(companyId:CompanyId,branchId:string,id:string){
    const value=await this.getPurchaseOrder(companyId,id);
    if(value.branchId!==requiredText(branchId,'branchId'))throw new ContractValidationError('branchId','purchase order belongs to a different branch');
    return value;
  }

  async listPurchaseOrders(companyId:CompanyId,branchId:string){
    return this.repo.listPos(companyId,requiredText(branchId,'branchId'));
  }

  async getSupplierCommitment(companyId: CompanyId, id: string) {
    const value = await this.repo.commitment(companyId, id);
    if (!value) throw new ContractValidationError('commitment', 'not found');
    return value;
  }

  async getRemainingUninvoicedQuantities(companyId: CompanyId, id: string) {
    const po = await this.getPurchaseOrder(companyId, id);
    return po.lines.map((line) => ({
      lineId: line.id,
      quantity: decimal(
        scaled(line.receivedQuantity) - scaled(line.invoicedQuantity),
      ),
    }));
  }

  async getCancellationBlockers(
    companyId: CompanyId,
    query: { purchaseOrderId?: string; commitmentId?: string },
  ) {
    let pos = query.purchaseOrderId
      ? [await this.getPurchaseOrder(companyId, query.purchaseOrderId)]
      : [];

    if (query.commitmentId) {
      await this.getSupplierCommitment(companyId, query.commitmentId);
      pos = await this.repo.posByCommitment(companyId, query.commitmentId);
    }

    return pos.flatMap((po) => po.lines.flatMap((line) => {
      const result: Array<{type:'SUPPLIER_EXECUTION'|'SUPPLIER_INVOICE';purchaseOrderId:string;lineId:string}> = [];
      if (scaled(line.receivedQuantity) > 0n) result.push({ type: 'SUPPLIER_EXECUTION', purchaseOrderId: po.id, lineId: line.id });
      if (scaled(line.invoicedQuantity) > 0n) result.push({ type: 'SUPPLIER_INVOICE', purchaseOrderId: po.id, lineId: line.id });
      return result;
    }));
  }

  async getHistory(companyId: CompanyId, id: string) {
    return this.repo.history(companyId, id);
  }

  /**
   * BLOCKER-2: Public owner-controlled cleanup for program cancellation.
   * Procurement internally decides:
   * - AUTO DRAFT empty PO => dispose
   * - Other cancellable PO => cancel
   * - When canceling commitment, safely process linked clean POs
   * - Reject received/invoiced/economically active state
   * - Idempotent when already DISPOSED/CANCELLED
   * Compatible with BR-067/BR-069/BR-070/BR-071.
   */
  async cleanupForProgramCancellation(
    companyId: CompanyId,
    reference: { purchaseOrderId?: string; commitmentId?: string },
  ) {
    if (!reference.purchaseOrderId && !reference.commitmentId) {
      throw new ContractValidationError('reference', 'purchaseOrderId or commitmentId required');
    }

    if (reference.purchaseOrderId) {
      const po = await this.getPurchaseOrder(companyId, reference.purchaseOrderId);
      // BR-070: received/invoiced blocks
      const blockers = await this.getCancellationBlockers(companyId, { purchaseOrderId: po.id });
      if (blockers.length) {
        throw new ContractValidationError(
          'purchaseOrder',
          'supplier execution or invoice blocks cleanup',
        );
      }
      // Already cleaned
      if (po.status === 'DISPOSED' || po.status === 'CANCELLED') {
        return { id: po.id, status: po.status };
      }
      // BR-069: AUTO DRAFT empty => dispose
      if (po.origin === 'AUTO' && po.status === 'DRAFT') {
        return this.disposeDraftAutoPurchaseOrder(companyId, po.id);
      }
      // Other cancellable => cancel
      return this.cancelPurchaseOrder(companyId, po.id);
    }

    // Commitment cleanup
    const commitment = await this.getSupplierCommitment(companyId, reference.commitmentId!);
    if (commitment.status === 'CANCELLED') {
      return { id: commitment.id, status: commitment.status };
    }
    const linkedPOs = await this.repo.posByCommitment(companyId, commitment.id);
    // Clean linked POs first
    for (const po of linkedPOs) {
      const poBlockers = await this.getCancellationBlockers(companyId, { purchaseOrderId: po.id });
      if (poBlockers.length) {
        throw new ContractValidationError(
          'commitment',
          'linked PO has supplier execution or invoice',
        );
      }
      if (po.status !== 'DISPOSED' && po.status !== 'CANCELLED') {
        if (po.origin === 'AUTO' && po.status === 'DRAFT') {
          await this.disposeDraftAutoPurchaseOrder(companyId, po.id);
        } else {
          await this.cancelPurchaseOrder(companyId, po.id);
        }
      }
    }
    // Cancel commitment
    return this.cancelSupplierCommitment(companyId, commitment.id, 'program cancellation cleanup');
  }
}
