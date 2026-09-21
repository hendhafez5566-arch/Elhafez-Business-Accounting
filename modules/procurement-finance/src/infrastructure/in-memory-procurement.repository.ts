import {
  ContractValidationError,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { ProcurementRepository } from '../application/procurement.repository.js';
import type {
  InvoiceConversion,
  ProcurementHistory,
  ProcurementPolicy,
  ProcurementQuantityMutationOutcome,
  PurchaseOrder,
  PurchaseOrderStatus,
  SupplierCommitment,
} from '../domain/procurement.js';

const SCALE = 10n ** 18n;

function scaled(value: DecimalAmount): bigint {
  const normalized = decimalAmount(value);
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = (negative ? normalized.slice(1) : normalized).split('.');
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

function derivedStatus(po: PurchaseOrder): PurchaseOrderStatus {
  const hasInvoiced = po.lines.some((line) => scaled(line.invoicedQuantity) > 0n);
  const fullyInvoiced = po.lines.every(
    (line) => scaled(line.invoicedQuantity) === scaled(line.orderedQuantity),
  );
  if (fullyInvoiced) return 'INVOICED';
  if (hasInvoiced) return 'PARTIALLY_INVOICED';

  const hasReceived = po.lines.some((line) => scaled(line.receivedQuantity) > 0n);
  const fullyReceived = po.lines.every(
    (line) => scaled(line.receivedQuantity) === scaled(line.orderedQuantity),
  );
  if (fullyReceived) return 'RECEIVED';
  if (hasReceived) return 'PARTIALLY_RECEIVED';
  return 'APPROVED';
}

export class InMemoryProcurementRepository implements ProcurementRepository {
  private readonly policies = new Map<string, ProcurementPolicy>();
  private readonly commitments = new Map<string, SupplierCommitment>();
  private readonly pos = new Map<string, PurchaseOrder>();
  private readonly conversions = new Map<string, InvoiceConversion>();
  private readonly histories: ProcurementHistory[] = [];
  private readonly receipts = new Map<string, {requestHash:string;previousReceivedQuantity:DecimalAmount;resultingReceivedQuantity:DecimalAmount}>();
  private readonly adjustments = new Map<string, {requestHash:string;previousReceivedQuantity:DecimalAmount;resultingReceivedQuantity:DecimalAmount}>();
  private readonly draftUpdates = new Map<string, string>();
  private readonly reopenEvents = new Map<string, string>();
  private lock = Promise.resolve();

  private key(companyId: CompanyId, id: string) {
    return `${companyId}:${id}`;
  }

  private async atomic<T>(operation: () => T | Promise<T>): Promise<T> {
    const prior = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async policy(companyId: CompanyId) {
    return this.policies.get(companyId);
  }

  async savePolicy(value: ProcurementPolicy) {
    const old = this.policies.get(value.companyId);
    if (old) {
      if (old.requestHash !== value.requestHash) {
        throw new ContractValidationError('policy', 'conflicting replay');
      }
      return old;
    }
    this.policies.set(value.companyId, value);
    return value;
  }

  async commitment(companyId: CompanyId, id: string) {
    return this.commitments.get(this.key(companyId, id));
  }

  async commitmentBySource(companyId: CompanyId, type: string, id: string) {
    return [...this.commitments.values()].find(
      (value) =>
        value.companyId === companyId && value.sourceType === type && value.sourceId === id,
    );
  }

  async saveCommitment(value: SupplierCommitment, entry: ProcurementHistory) {
    if (
      [...this.commitments.values()].some(
        (existing) => existing.id === value.id && existing.companyId !== value.companyId,
      )
    ) {
      throw new ContractValidationError('commitment', 'company collision');
    }
    const source = await this.commitmentBySource(
      value.companyId,
      value.sourceType,
      value.sourceId,
    );
    if (source) {
      if (source.requestHash !== value.requestHash) {
        throw new ContractValidationError('source', 'conflicting replay');
      }
      return source;
    }
    this.commitments.set(this.key(value.companyId, value.id), value);
    this.histories.push(entry);
    return value;
  }

  async cancelCommitment(companyId: CompanyId, id: string, reason: string, at: string) {
    const value = await this.commitment(companyId, id);
    if (!value) throw new ContractValidationError('commitment', 'not found');
    if (value.status === 'CANCELLED') return value;

    const next: SupplierCommitment = {
      ...value,
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledAt: at,
    };
    this.commitments.set(this.key(companyId, id), next);
    this.histories.push({
      id: `${id}:cancel`,
      companyId,
      aggregateId: id,
      kind: 'CANCELLED',
      createdAt: at,
    });
    return next;
  }

  async po(companyId: CompanyId, id: string) {
    const value = this.pos.get(this.key(companyId, id));
    return value ? structuredClone(value) : undefined;
  }

  async listPos(companyId: CompanyId, branchId?: string) {
    return [...this.pos.values()]
      .filter((value) => value.companyId === companyId && (!branchId || value.branchId === branchId))
      .map((value) => structuredClone(value));
  }

  async posByCommitment(companyId: CompanyId, commitmentId: string) {
    return [...this.pos.values()]
      .filter(
        (value) => value.companyId === companyId && value.commitmentId === commitmentId,
      )
      .map((value) => structuredClone(value));
  }

  async poByNumber(companyId: CompanyId, number: string) {
    const value = [...this.pos.values()].find(
      (candidate) => candidate.companyId === companyId && candidate.number === number,
    );
    return value ? structuredClone(value) : undefined;
  }

  async savePo(value: PurchaseOrder, entry: ProcurementHistory) {
    if (
      [...this.pos.values()].some(
        (existing) => existing.id === value.id && existing.companyId !== value.companyId,
      )
    ) {
      throw new ContractValidationError('purchaseOrder', 'company collision');
    }
    const old = await this.po(value.companyId, value.id);
    if (old) {
      if (old.requestHash !== value.requestHash) {
        throw new ContractValidationError('purchaseOrder', 'conflicting replay');
      }
      return old;
    }
    this.pos.set(this.key(value.companyId, value.id), structuredClone(value));
    this.histories.push(entry);
    return value;
  }

  async updateDraftPo(value: PurchaseOrder, commandId: string, requestHash: string, entry: ProcurementHistory) {
    return this.atomic(async () => {
      const command=this.key(value.companyId,`draft-update:${commandId}`);
      const prior=this.draftUpdates.get(command);
      if(prior){
        if(prior!==requestHash)throw new ContractValidationError('command','conflicting replay');
        return (await this.po(value.companyId,value.id))!;
      }
      const current=await this.po(value.companyId,value.id);
      if(!current)throw new ContractValidationError('purchaseOrder','not found');
      if(current.status!=='DRAFT')throw new ContractValidationError('status','only draft purchase order can be edited');
      if(current.branchId!==value.branchId||current.number!==value.number||current.origin!==value.origin)throw new ContractValidationError('purchaseOrder','immutable identity fields changed');
      if(current.lines.some((line)=>scaled(line.receivedQuantity)>0n||scaled(line.invoicedQuantity)>0n))throw new ContractValidationError('purchaseOrder','economic activity blocks draft edit');
      this.pos.set(this.key(value.companyId,value.id),structuredClone(value));
      this.draftUpdates.set(command,requestHash);
      this.histories.push(entry);
      return structuredClone(value);
    });
  }

  async approvePo(
    companyId: CompanyId,
    id: string,
    poHistory: ProcurementHistory,
    commitmentHistory?: ProcurementHistory,
  ) {
    return this.atomic(async () => {
      const po = await this.po(companyId, id);
      if (!po) throw new ContractValidationError('purchaseOrder', 'not found');
      if (po.status === 'APPROVED') return po;
      if (po.status !== 'DRAFT') {
        throw new ContractValidationError('status', 'unsupported transition');
      }

      if (po.commitmentId) {
        const commitment = await this.commitment(companyId, po.commitmentId);
        if (!commitment || commitment.supplierId !== po.supplierId) {
          throw new ContractValidationError(
            'commitment',
            'same-company matching commitment required',
          );
        }
        if (commitment.status === 'CANCELLED') {
          throw new ContractValidationError('commitment', 'cancelled commitment cannot approve PO');
        }
        if (commitment.status !== 'COMMITTED') {
          this.commitments.set(this.key(companyId, commitment.id), {
            ...commitment,
            status: 'COMMITTED',
          });
          if (commitmentHistory) this.histories.push(commitmentHistory);
        }
      }

      const next = { ...po, status: 'APPROVED' as const };
      this.pos.set(this.key(companyId, id), next);
      this.histories.push(poHistory);
      return next;
    });
  }

  async transitionPo(
    companyId: CompanyId,
    id: string,
    from: string[],
    to: string,
    entry: ProcurementHistory,
  ) {
    return this.atomic(async () => {
      const value = await this.po(companyId, id);
      if (!value) throw new ContractValidationError('purchaseOrder', 'not found');
      if (value.status === to) return value;
      if (!from.includes(value.status)) {
        throw new ContractValidationError('status', 'unsupported transition');
      }
      value.status = to as PurchaseOrder['status'];
      this.pos.set(this.key(companyId, id), value);
      this.histories.push(entry);
      return value;
    });
  }

  async receive(
    companyId: CompanyId,
    id: string,
    lineId: string,
    quantity: DecimalAmount,
    commandId: string,
    requestHash: string,
  ): Promise<ProcurementQuantityMutationOutcome> {
    return this.atomic(async () => {
      const command = this.key(companyId, commandId);
      const prior = this.receipts.get(command);
      if (prior) {
        if (prior.requestHash !== requestHash) {
          throw new ContractValidationError('command', 'conflicting replay');
        }
        return {purchaseOrder:(await this.po(companyId,id))!,previousReceivedQuantity:prior.previousReceivedQuantity,resultingReceivedQuantity:prior.resultingReceivedQuantity};
      }

      const po = await this.po(companyId, id);
      if (!po || !['APPROVED','PARTIALLY_RECEIVED','PARTIALLY_INVOICED'].includes(po.status)) {
        throw new ContractValidationError('purchaseOrder', 'not receivable');
      }
      const line = po.lines.find((candidate) => candidate.id === lineId);
      if (!line) throw new ContractValidationError('line', 'not found');

      const previousReceivedQuantity=line.receivedQuantity;
      const nextReceived = scaled(previousReceivedQuantity) + scaled(quantity);
      if (nextReceived > scaled(line.orderedQuantity)) {
        throw new ContractValidationError('quantity', 'over-receipt');
      }
      const resultingReceivedQuantity=decimal(nextReceived);
      line.receivedQuantity = resultingReceivedQuantity;
      po.status = derivedStatus(po);
      this.pos.set(this.key(companyId, id), po);
      this.receipts.set(command,{requestHash,previousReceivedQuantity,resultingReceivedQuantity});
      this.histories.push({id:`${id}:receipt:${commandId}`,companyId,aggregateId:id,kind:'RECEIVED',sourceReference:commandId,createdAt:new Date().toISOString()});
      return {purchaseOrder:po,previousReceivedQuantity,resultingReceivedQuantity};
    });
  }

  async adjustReceived(
    companyId: CompanyId,
    id: string,
    lineId: string,
    newReceivedQuantity: DecimalAmount,
    commandId: string,
    requestHash: string,
    reason: string,
  ) {
    return this.atomic(async () => {
      const command=this.key(companyId,`receipt-adjust:${commandId}`);
      const prior=this.adjustments.get(command);
      if(prior){
        if(prior.requestHash!==requestHash)throw new ContractValidationError('command','conflicting replay');
        return {purchaseOrder:(await this.po(companyId,id))!,previousReceivedQuantity:prior.previousReceivedQuantity,resultingReceivedQuantity:prior.resultingReceivedQuantity};
      }
      const po=await this.po(companyId,id);
      if(!po||!['APPROVED','PARTIALLY_RECEIVED','RECEIVED','PARTIALLY_INVOICED','INVOICED'].includes(po.status)){
        throw new ContractValidationError('purchaseOrder','not adjustable');
      }
      const line=po.lines.find((candidate)=>candidate.id===lineId);
      if(!line)throw new ContractValidationError('line','not found');
      const previousReceivedQuantity=line.receivedQuantity;
      const target=scaled(newReceivedQuantity);
      if(target<scaled(line.invoicedQuantity))throw new ContractValidationError('quantity','cannot fall below invoiced quantity');
      if(target>scaled(line.orderedQuantity))throw new ContractValidationError('quantity','over-receipt');
      const resultingReceivedQuantity=decimal(target);
      line.receivedQuantity=resultingReceivedQuantity;
      po.status=derivedStatus(po);
      this.pos.set(this.key(companyId,id),po);
      this.adjustments.set(command,{requestHash,previousReceivedQuantity,resultingReceivedQuantity});
      this.histories.push({
        id:`${id}:receipt-adjust:${commandId}`,
        companyId,
        aggregateId:id,
        kind:'RECEIPT_ADJUSTED',
        sourceReference:reason,
        createdAt:new Date().toISOString(),
      });
      return {purchaseOrder:po,previousReceivedQuantity,resultingReceivedQuantity};
    });
  }

  async conversion(companyId: CompanyId, id: string) {
    return this.conversions.get(this.key(companyId, id));
  }

  async reserveConversion(value: InvoiceConversion) {
    return this.atomic(async () => {
      const old = await this.conversion(value.companyId, value.id);
      if (old) {
        if (old.requestHash !== value.requestHash) {
          throw new ContractValidationError('conversion', 'conflicting replay');
        }
        return old;
      }

      const po = await this.po(value.companyId, value.purchaseOrderId);
      const line = po?.lines.find((candidate) => candidate.id === value.lineId);
      if (
        !po ||
        !line ||
        !['PARTIALLY_RECEIVED', 'RECEIVED', 'PARTIALLY_INVOICED'].includes(po.status)
      ) {
        throw new ContractValidationError('purchaseOrder', 'not invoice eligible');
      }

      const nextInvoiced = scaled(line.invoicedQuantity) + scaled(value.quantity);
      if (nextInvoiced > scaled(line.receivedQuantity)) {
        throw new ContractValidationError('quantity', 'over-invoicing');
      }

      line.invoicedQuantity = decimal(nextInvoiced);
      po.status = derivedStatus(po);
      this.pos.set(this.key(value.companyId, value.purchaseOrderId), po);
      this.conversions.set(this.key(value.companyId, value.id), value);
      return value;
    });
  }

  async completeConversion(companyId: CompanyId, id: string, billingInvoiceId: string) {
    const value = await this.conversion(companyId, id);
    if (!value || value.billingInvoiceId !== billingInvoiceId) {
      throw new ContractValidationError('conversion', 'not reserved');
    }
    if (value.status === 'INVOICED') return value;
    if (value.status === 'REOPENED') {
      throw new ContractValidationError('conversion', 'already reopened');
    }
    const next = { ...value, status: 'INVOICED' as const };
    this.conversions.set(this.key(companyId, id), next);
    return next;
  }

  async reopenConversion(
    companyId: CompanyId,
    id: string,
    billingInvoiceId: string,
    eventId: string,
    requestHash: string,
  ) {
    return this.atomic(async () => {
      const eventKey = this.key(companyId, eventId);
      const priorHash = this.reopenEvents.get(eventKey);
      if (priorHash) {
        if (priorHash !== requestHash) {
          throw new ContractValidationError('event', 'conflicting replay');
        }
        return (await this.conversion(companyId, id))!;
      }

      const value = await this.conversion(companyId, id);
      if (
        !value ||
        value.billingInvoiceId !== billingInvoiceId ||
        value.status === 'RESERVED'
      ) {
        throw new ContractValidationError(
          'conversion',
          'completed matching conversion required',
        );
      }

      if (value.status === 'REOPENED') {
        this.reopenEvents.set(eventKey, requestHash);
        return value;
      }

      const po = await this.po(companyId, value.purchaseOrderId);
      const line = po?.lines.find((candidate) => candidate.id === value.lineId);
      if (!po || !line || scaled(line.invoicedQuantity) < scaled(value.quantity)) {
        throw new ContractValidationError('quantity', 'invalid reopen');
      }

      line.invoicedQuantity = decimal(
        scaled(line.invoicedQuantity) - scaled(value.quantity),
      );
      po.status = derivedStatus(po);
      this.pos.set(this.key(companyId, po.id), po);

      const next = {
        ...value,
        reopenedQuantity: value.quantity,
        status: 'REOPENED' as const,
      };
      this.conversions.set(this.key(companyId, id), next);
      this.reopenEvents.set(eventKey, requestHash);
      this.histories.push({
        id: `${po.id}:reopen:${eventId}`,
        companyId,
        aggregateId: po.id,
        kind: 'INVOICE_REOPENED',
        sourceReference: billingInvoiceId,
        createdAt: new Date().toISOString(),
      });
      return next;
    });
  }

  async history(companyId: CompanyId, id: string) {
    return this.histories.filter(
      (entry) => entry.companyId === companyId && entry.aggregateId === id,
    );
  }
}
