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

function positive(value: DecimalAmount, field: string): DecimalAmount {
  const normalized = decimalAmount(value);
  if (scaled(normalized) <= 0n) {
    throw new ContractValidationError(field, 'must be positive');
  }
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
  commitmentId?: string;
  supplierId: string;
  number: string;
  origin: 'MANUAL' | 'AUTO';
  lines: {
    id: string;
    itemReference: string;
    orderedQuantity: DecimalAmount;
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
    const requestHash = fingerprint(input);
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
      ...input,
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
    if (!input.number.trim() || !input.supplierId.trim() || !input.lines.length) {
      throw new ContractValidationError(
        'purchaseOrder',
        'number, supplier and lines are required',
      );
    }

    const lineIds = new Set<string>();
    for (const line of input.lines) {
      if (!line.id.trim() || !line.itemReference.trim()) {
        throw new ContractValidationError('line', 'id and item reference are required');
      }
      if (lineIds.has(line.id)) {
        throw new ContractValidationError('line', 'duplicate line id');
      }
      lineIds.add(line.id);
      positive(line.orderedQuantity, 'orderedQuantity');
    }

    if (input.commitmentId) {
      const commitment = await this.repo.commitment(input.companyId, input.commitmentId);
      if (
        !commitment ||
        commitment.supplierId !== input.supplierId ||
        commitment.status === 'CANCELLED'
      ) {
        throw new ContractValidationError(
          'commitment',
          'active same-company matching commitment required',
        );
      }
    }

    const requestHash = fingerprint(input);
    const prior = await this.repo.po(input.companyId, input.id);
    if (prior) {
      if (prior.requestHash !== requestHash) {
        throw new ContractValidationError('purchaseOrder', 'conflicting replay');
      }
      return prior;
    }

    const number = await this.repo.poByNumber(input.companyId, input.number);
    if (number) throw new ContractValidationError('number', 'already used');

    const value: PurchaseOrder = {
      ...input,
      status: 'DRAFT',
      requestHash,
      createdAt: now(),
      lines: input.lines.map((line) => ({
        ...line,
        companyId: input.companyId,
        purchaseOrderId: input.id,
        orderedQuantity: positive(line.orderedQuantity, 'orderedQuantity'),
        receivedQuantity: decimalAmount('0'),
        invoicedQuantity: decimalAmount('0'),
      })),
    };

    return this.repo.savePo(
      value,
      history(input.companyId, input.id, 'CREATED'),
    );
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
    return this.repo.approvePo(
      companyId,
      id,
      history(companyId, id, 'APPROVED', String(policy.version)),
      po.commitmentId
        ? history(companyId, po.commitmentId, 'COMMITTED', id)
        : undefined,
    );
  }

  async receivePurchaseOrder(input: {
    companyId: CompanyId;
    purchaseOrderId: string;
    lineId: string;
    quantity: DecimalAmount;
    commandId: string;
  }) {
    if (!input.commandId.trim()) {
      throw new ContractValidationError('commandId', 'is required');
    }
    return this.repo.receive(
      input.companyId,
      input.purchaseOrderId,
      input.lineId,
      positive(input.quantity, 'quantity'),
      input.commandId,
      fingerprint(input),
    );
  }

  async cancelPurchaseOrder(companyId: CompanyId, id: string) {
    const blockers = await this.getCancellationBlockers(companyId, {
      purchaseOrderId: id,
    });
    if (blockers.length) {
      throw new ContractValidationError(
        'purchaseOrder',
        'supplier execution blocks cancellation',
      );
    }
    return this.repo.transitionPo(
      companyId,
      id,
      ['DRAFT', 'APPROVED'],
      'CANCELLED',
      history(companyId, id, 'CANCELLED'),
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
    const quantity = positive(input.quantity, 'quantity');
    const invoiceAmount = positive(input.billing.amount, 'billing.amount');
    const normalized = {
      ...input,
      quantity,
      billing: { ...input.billing, amount: invoiceAmount },
    };
    const requestHash = fingerprint(normalized);

    let conversion = await this.repo.conversion(input.companyId, input.id);
    if (conversion && conversion.requestHash !== requestHash) {
      throw new ContractValidationError('conversion', 'conflicting replay');
    }
    if (conversion?.status === 'INVOICED' || conversion?.status === 'REOPENED') {
      return conversion;
    }

    if (!conversion) {
      conversion = await this.repo.reserveConversion({
        id: input.id,
        companyId: input.companyId,
        purchaseOrderId: input.purchaseOrderId,
        lineId: input.lineId,
        billingInvoiceId: input.billing.invoiceId,
        quantity,
        reopenedQuantity: decimalAmount('0'),
        requestHash,
        status: 'RESERVED',
        createdAt: now(),
      });
    }

    const po = await this.getPurchaseOrder(input.companyId, input.purchaseOrderId);
    const line = po.lines.find((candidate) => candidate.id === input.lineId);
    if (!line) throw new ContractValidationError('line', 'not found');

    const invoice: CreateInvoiceInput = {
      id: input.billing.invoiceId,
      companyId: input.companyId,
      type: 'SUPPLIER',
      partyId: po.supplierId,
      number: input.billing.number,
      externalInvoiceNumber: input.billing.externalInvoiceNumber,
      postingDate: input.billing.postingDate,
      ...(input.billing.dueDate ? { dueDate: input.billing.dueDate } : {}),
      currency: currencyCode(input.billing.currency),
      sourceType: 'PROCUREMENT_PO',
      sourceId: input.id,
      controlAccountId: input.billing.controlAccountId,
      lines: [
        {
          id: `${input.billing.invoiceId}:${input.lineId}`,
          accountId: input.billing.accountId,
          amount: invoiceAmount,
          ...(input.billing.taxCode ? { taxCode: input.billing.taxCode } : {}),
        },
      ],
    };

    await this.billing.createDraft(invoice);
    const posted = await this.billing.postInvoice(
      input.companyId,
      input.billing.invoiceId,
    );
    if (posted.status !== 'POSTED') {
      throw new ContractValidationError('billingInvoice', 'supplier invoice did not post');
    }

    return this.repo.completeConversion(
      input.companyId,
      input.id,
      input.billing.invoiceId,
    );
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
}
