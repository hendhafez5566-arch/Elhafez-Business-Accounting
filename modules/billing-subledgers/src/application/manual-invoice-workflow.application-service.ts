import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import { BillingSubledgersApplicationService, type CreateInvoiceInput } from './billing-subledgers.application-service.js';
import type {
  ManualInvoiceLineMetadata,
  ManualInvoiceMetadata,
  ManualInvoiceRepository,
} from './manual-invoice.repository.js';
import type { Invoice, InvoiceDiscountMode, InvoiceType } from '../domain/billing.js';

const SCALE = 10n ** 18n;

function scaled(value: string, field: string): bigint {
  const normalized = decimalAmount(value as DecimalAmount);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  if (fraction.length > 18) throw new ContractValidationError(field, 'supports at most 18 fractional digits');
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
  return negative ? -result : result;
}

function decimal(value: bigint): DecimalAmount {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = absolute % SCALE;
  const suffix = fraction === 0n ? '' : `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`;
  return decimalAmount(`${negative ? '-' : ''}${whole}${suffix}`);
}

function requiredText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new ContractValidationError(field, 'is required');
  return normalized;
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export interface ManualInvoiceLineInput {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountMode: InvoiceDiscountMode;
  discount: string;
  taxCode?: string;
  accountId: string;
  costCenterId?: string;
}

export interface ManualInvoiceInput {
  invoiceId?: string;
  commandKey: string;
  companyId: CompanyId;
  branchId?: string;
  type: Extract<InvoiceType, 'CUSTOMER' | 'SUPPLIER' | 'AGENT'>;
  partyId: string;
  number: string;
  externalInvoiceNumber?: string;
  postingDate: string;
  dueDate?: string;
  recognitionDate?: string;
  paymentTerms?: string;
  currency: string;
  controlAccountId: string;
  lines: ManualInvoiceLineInput[];
}

export type ManualInvoiceSaveMode = 'DRAFT' | 'POSTED';

function normalizeLine(line: ManualInvoiceLineInput): ManualInvoiceLineMetadata {
  const description = requiredText(line.description, 'line.description');
  const accountId = requiredText(line.accountId, 'line.accountId');
  const quantityValue = scaled(line.quantity, 'line.quantity');
  const priceValue = scaled(line.unitPrice, 'line.unitPrice');
  const discountValue = scaled(line.discount || '0', 'line.discount');
  if (quantityValue <= 0n) throw new ContractValidationError('line.quantity', 'must be positive');
  if (priceValue < 0n) throw new ContractValidationError('line.unitPrice', 'must not be negative');
  if (discountValue < 0n) throw new ContractValidationError('line.discount', 'must not be negative');

  const gross = (quantityValue * priceValue) / SCALE;
  let discountAmount: bigint;
  if (line.discountMode === 'PERCENT') {
    if (discountValue > 100n * SCALE) throw new ContractValidationError('line.discount', 'percentage cannot exceed 100');
    discountAmount = (gross * discountValue) / (100n * SCALE);
  } else {
    discountAmount = discountValue;
  }
  if (discountAmount > gross) throw new ContractValidationError('line.discount', 'cannot exceed gross line value');
  const net = gross - discountAmount;
  if (net <= 0n) throw new ContractValidationError('line.amount', 'net line value must be positive');

  return {
    id: requiredText(line.id, 'line.id'),
    accountId,
    description,
    quantity: decimal(quantityValue),
    unitPrice: decimal(priceValue),
    discountMode: line.discountMode,
    discount: decimal(discountValue),
    amount: decimal(net),
    ...(line.taxCode?.trim() ? { taxCode: line.taxCode.trim() } : {}),
    ...(line.costCenterId?.trim() ? { costCenterId: line.costCenterId.trim() } : {}),
  };
}

export class ManualInvoiceWorkflowApplicationService {
  constructor(
    private readonly billing: BillingSubledgersApplicationService,
    private readonly workflowRepository: ManualInvoiceRepository,
  ) {}

  private normalize(input: ManualInvoiceInput, existing?: Invoice) {
    if (!input.lines.length) throw new ContractValidationError('lines', 'at least one line is required');
    const lines = input.lines.map(normalizeLine);
    const id = existing?.id ?? input.invoiceId ?? `manual:${input.commandKey}`;
    const sourceType = existing?.sourceType ?? 'MANUAL_ACCOUNTING_INVOICE';
    const sourceId = existing?.sourceId ?? input.commandKey;
    const type = existing?.type ?? input.type;
    if (type === 'OPENING_CUSTOMER_BALANCE') throw new ContractValidationError('type', 'manual invoice type required');
    const core: CreateInvoiceInput = {
      id,
      companyId: input.companyId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      type,
      partyId: requiredText(input.partyId, 'partyId'),
      number: requiredText(input.number, 'number'),
      ...(input.externalInvoiceNumber?.trim() ? { externalInvoiceNumber: input.externalInvoiceNumber.trim() } : {}),
      postingDate: requiredText(input.postingDate, 'postingDate'),
      ...(input.dueDate?.trim() ? { dueDate: input.dueDate.trim() } : {}),
      currency: currencyCode(input.currency),
      sourceType,
      sourceId,
      controlAccountId: requiredText(input.controlAccountId, 'controlAccountId'),
      lines: lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        amount: line.amount,
        ...(line.taxCode ? { taxCode: line.taxCode } : {}),
      })),
      ...(input.recognitionDate && input.recognitionDate > input.postingDate ? { deferred: true } : {}),
    };
    const metadata: ManualInvoiceMetadata = {
      companyId: input.companyId,
      invoiceId: id,
      type,
      ...(input.recognitionDate?.trim() ? { recognitionDate: input.recognitionDate.trim() } : {}),
      ...(input.paymentTerms?.trim() ? { paymentTerms: input.paymentTerms.trim() } : {}),
      lines,
    };
    return { core, metadata };
  }

  private async enrich(invoice: Invoice): Promise<Invoice> {
    const metadata = await this.workflowRepository.metadata(invoice.companyId, invoice.id);
    if (!metadata) return invoice;
    const byId = new Map(metadata.lines.map((line) => [line.id, line]));
    return {
      ...invoice,
      ...(metadata.recognitionDate ? { recognitionDate: metadata.recognitionDate } : {}),
      ...(metadata.paymentTerms ? { paymentTerms: metadata.paymentTerms } : {}),
      lines: invoice.lines.map((line) => ({ ...line, ...(byId.get(line.id) ?? {}) })),
    };
  }

  async save(input: ManualInvoiceInput, mode: ManualInvoiceSaveMode): Promise<Invoice> {
    const existing = input.invoiceId ? await this.billing.getInvoice(input.companyId, input.invoiceId) : undefined;
    if (input.invoiceId && !existing) throw new ContractValidationError('invoice', 'not found');
    if (existing && existing.status !== 'DRAFT') throw new ContractValidationError('invoice', 'only draft invoices may be edited');
    if (existing && existing.type !== input.type) throw new ContractValidationError('type', 'draft invoice type cannot change');

    const { core, metadata } = this.normalize(input, existing);
    let draft: Invoice;
    if (existing) {
      await this.workflowRepository.replaceDraft({
        companyId: core.companyId,
        invoiceId: core.id,
        partyId: core.partyId,
        number: core.number,
        postingDate: core.postingDate,
        ...(core.dueDate ? { dueDate: core.dueDate } : {}),
        currency: core.currency,
        controlAccountId: core.controlAccountId,
        requestHash: fingerprint({ ...core, currency: currencyCode(core.currency) }),
        lines: core.lines,
      });
      draft = (await this.billing.getInvoice(core.companyId, core.id))!;
    } else {
      draft = await this.billing.createDraft(core);
    }
    await this.workflowRepository.saveMetadata(metadata);
    if (mode === 'POSTED') return this.enrich(await this.billing.postInvoice(core.companyId, draft.id));
    return this.enrich(draft);
  }

  async post(companyId: CompanyId, invoiceId: string): Promise<Invoice> {
    return this.enrich(await this.billing.postInvoice(companyId, invoiceId));
  }

  async cancel(companyId: CompanyId, invoiceId: string, postingDate?: string, number?: string): Promise<Invoice> {
    const invoice = await this.billing.getInvoice(companyId, invoiceId);
    if (!invoice) throw new ContractValidationError('invoice', 'not found');
    if (invoice.status === 'DRAFT') {
      await this.workflowRepository.cancelDraft(companyId, invoiceId);
      return this.enrich((await this.billing.getInvoice(companyId, invoiceId))!);
    }
    if (!postingDate || !number) throw new ContractValidationError('cancellation', 'posting date and reversal number are required');
    return this.enrich(await this.billing.cancelInvoice(companyId, invoiceId, postingDate, number));
  }

  async get(companyId: CompanyId, invoiceId: string): Promise<Invoice | undefined> {
    const invoice = await this.billing.getInvoice(companyId, invoiceId);
    return invoice ? this.enrich(invoice) : undefined;
  }

  async enrichMany(invoices: readonly Invoice[]): Promise<Invoice[]> {
    return Promise.all(invoices.map((invoice) => this.enrich(invoice)));
  }

  async metadata(companyId: CompanyId, invoiceId: string) {
    return this.workflowRepository.metadata(companyId, invoiceId);
  }
}
