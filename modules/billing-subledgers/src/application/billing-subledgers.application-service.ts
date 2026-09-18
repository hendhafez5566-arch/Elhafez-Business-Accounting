import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  money,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { TaxApplicationService } from '@elhafez/tax';
import type { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import type { GeneralLedgerApplicationService, PostingLine } from '@elhafez/general-ledger';
import type { BillingRepository } from './billing.repository.js';
import type {
  Advance,
  AdvanceConsumption,
  Adjustment,
  Allocation,
  Invoice,
  InvoiceLine,
  InvoiceType,
  PartyKind,
} from '../domain/billing.js';

const SCALE = 10n ** 18n;
const zero = decimalAmount('0');

function scaled18(value: DecimalAmount, field = 'amount'): bigint {
  const text = decimalAmount(value);
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  if (fraction.length > 18) {
    throw new ContractValidationError(field, 'supports at most 18 fractional digits');
  }
  const result = BigInt(whole + fraction.padEnd(18, '0'));
  return negative ? -result : result;
}

function decimal18(value: bigint): DecimalAmount {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = absolute % SCALE;
  const text =
    fraction === 0n
      ? whole.toString()
      : whole.toString() + '.' + fraction.toString().padStart(18, '0').replace(/0+$/, '');
  return decimalAmount((negative && text !== '0' ? '-' : '') + text);
}

function checked(value: DecimalAmount, field = 'amount'): DecimalAmount {
  scaled18(value, field);
  return decimalAmount(value);
}

function positive(value: DecimalAmount, field = 'amount'): DecimalAmount {
  const result = checked(value, field);
  if (scaled18(result, field) <= 0n) throw new ContractValidationError(field, 'must be positive');
  return result;
}

function nonNegative(value: DecimalAmount, field = 'amount'): DecimalAmount {
  const result = checked(value, field);
  if (scaled18(result, field) < 0n) throw new ContractValidationError(field, 'must not be negative');
  return result;
}

function add(...values: DecimalAmount[]): DecimalAmount {
  return decimal18(values.reduce((total, value) => total + scaled18(value), 0n));
}

function subtract(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  return decimal18(scaled18(left) - scaled18(right));
}

function minimum(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  return scaled18(left) <= scaled18(right) ? left : right;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function expectedPartyKind(type: InvoiceType): PartyKind {
  return type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';
}

function foreignFields(
  isForeign: boolean,
  sourceAmount: DecimalAmount,
  currency: string,
): Pick<PostingLine, 'foreignAmount' | 'foreignCurrency'> {
  return isForeign ? { foreignAmount: sourceAmount, foreignCurrency: currency } : {};
}

export interface CreateInvoiceInput {
  id: string;
  companyId: CompanyId;
  branchId?: string;
  type: InvoiceType;
  partyId: string;
  number: string;
  externalInvoiceNumber?: string;
  postingDate: string;
  dueDate?: string;
  currency: string;
  sourceType: string;
  sourceId: string;
  controlAccountId: string;
  lines: { id: string; accountId: string; amount: DecimalAmount; taxCode?: string }[];
  deferred?: boolean;
}

export class BillingSubledgersApplicationService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly tax: Pick<TaxApplicationService, 'snapshotInvoiceLine'>,
    private readonly fx: Pick<CurrencyFxApplicationService, 'getBaseCurrency' | 'calculateSettlement'>,
    private readonly gl: Pick<GeneralLedgerApplicationService, 'post' | 'reverse'>,
  ) {}

  async createDraft(input: CreateInvoiceInput): Promise<Invoice> {
    if (!input.partyId.trim() || !input.number.trim() || !input.sourceType.trim() || !input.sourceId.trim()) {
      throw new ContractValidationError('invoice', 'party, number and source identity are required');
    }
    const normalized = { ...input, currency: currencyCode(input.currency) };
    const requestHash = fingerprint(normalized);
    const prior = await this.repo.invoiceBySource(input.companyId, input.sourceType, input.sourceId);
    if (prior) {
      if (prior.requestHash !== requestHash) throw new ContractValidationError('source', 'conflicting replay');
      return prior;
    }

    if (input.type === 'SUPPLIER') {
      if (!input.externalInvoiceNumber?.trim()) {
        throw new ContractValidationError('externalInvoiceNumber', 'required');
      }
      if (await this.repo.supplierExternal(input.companyId, input.partyId, input.externalInvoiceNumber)) {
        throw new ContractValidationError('externalInvoiceNumber', 'already used for supplier');
      }
    } else if (input.externalInvoiceNumber !== undefined) {
      throw new ContractValidationError('externalInvoiceNumber', 'is only valid for supplier invoices');
    }

    if (input.lines.length === 0) throw new ContractValidationError('lines', 'at least one invoice line is required');
    for (const line of input.lines) {
      positive(line.amount, 'line.amount');
      if (input.type === 'OPENING_CUSTOMER_BALANCE' && line.taxCode) {
        throw new ContractValidationError('taxCode', 'opening customer balances cannot carry invoice tax');
      }
    }

    const value: Invoice = {
      ...normalized,
      status: 'DRAFT',
      lines: input.lines.map((line) => ({ ...line })),
      baseTotal: zero,
      outstanding: zero,
      requestHash,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.repo.saveInvoice(value);
      return value;
    } catch (error) {
      const race = await this.repo.invoiceBySource(input.companyId, input.sourceType, input.sourceId);
      if (race?.requestHash === requestHash) return race;
      if (
        input.type === 'SUPPLIER' &&
        input.externalInvoiceNumber &&
        (await this.repo.supplierExternal(input.companyId, input.partyId, input.externalInvoiceNumber))
      ) {
        throw new ContractValidationError('externalInvoiceNumber', 'already used for supplier');
      }
      throw error;
    }
  }

  async setCreditLimit(companyId: CompanyId, partyId: string, amount: DecimalAmount): Promise<void> {
    await this.repo.saveCreditLimit(companyId, partyId, nonNegative(amount, 'creditLimit'));
  }

  private async convertToBase(
    companyId: CompanyId,
    sourceCurrency: string,
    amount: DecimalAmount,
    postingDate: string,
  ): Promise<{ amount: DecimalAmount; rateId?: string; baseCurrency: string }> {
    const base = await this.fx.getBaseCurrency(companyId);
    const from = currencyCode(sourceCurrency);
    checked(amount);
    if (from === base.code) return { amount, baseCurrency: base.code };
    const conversion = await this.fx.calculateSettlement(
      companyId,
      money(amount, from),
      base.code,
      postingDate + 'T23:59:59.999Z',
    );
    return {
      amount: checked(conversion.converted.amount, 'baseAmount'),
      rateId: conversion.rate.rateId,
      baseCurrency: base.code,
    };
  }

  async postInvoice(companyId: CompanyId, id: string): Promise<Invoice> {
    const invoice = await this.requiredInvoice(companyId, id);
    if (invoice.status === 'POSTED') return invoice;
    if (invoice.status !== 'DRAFT' && invoice.status !== 'POSTING') {
      throw new ContractValidationError('status', 'only draft/posting invoice may post');
    }

    const prepared: Array<{
      line: InvoiceLine;
      baseLine: DecimalAmount;
      baseTax: DecimalAmount;
    }> = [];
    let fxRateId: string | undefined;
    let foreignGross = zero;
    let baseTotal = zero;
    const base = await this.fx.getBaseCurrency(companyId);
    const invoiceCurrency = currencyCode(invoice.currency);
    const isForeign = invoiceCurrency !== base.code;

    for (const sourceLine of invoice.lines) {
      const lineAmount = positive(sourceLine.amount, 'line.amount');
      let line: InvoiceLine = { ...sourceLine, amount: lineAmount };
      if (sourceLine.taxCode) {
        const snapshot = await this.tax.snapshotInvoiceLine({
          companyId,
          code: sourceLine.taxCode,
          effectiveAt: invoice.postingDate,
          taxableAmount: lineAmount,
          sourceId: id + ':' + sourceLine.id,
        });
        line = {
          ...line,
          taxSnapshotId: snapshot.id,
          taxAmount: snapshot.taxAmount,
          taxAccountId: invoice.type === 'SUPPLIER' ? snapshot.inputAccountId : snapshot.outputAccountId,
        };
      }

      const baseLine = await this.convertToBase(companyId, invoice.currency, line.amount, invoice.postingDate);
      fxRateId ??= baseLine.rateId;
      let baseTaxAmount = zero;
      if (line.taxAmount && scaled18(line.taxAmount) > 0n) {
        const baseTax = await this.convertToBase(companyId, invoice.currency, line.taxAmount, invoice.postingDate);
        fxRateId ??= baseTax.rateId;
        baseTaxAmount = baseTax.amount;
      }

      foreignGross = add(foreignGross, line.amount, ...(line.taxAmount ? [line.taxAmount] : []));
      baseTotal = add(baseTotal, baseLine.amount, baseTaxAmount);
      prepared.push({ line, baseLine: baseLine.amount, baseTax: baseTaxAmount });
    }

    if (invoice.type === 'CUSTOMER') {
      const limit = await this.repo.creditLimit(companyId, invoice.partyId);
      if (limit !== undefined) {
        const exposure = add(
          ...(await this.repo.invoices(companyId))
            .filter(
              (value) =>
                value.partyId === invoice.partyId &&
                value.type === 'CUSTOMER' &&
                value.status === 'POSTED',
            )
            .map((value) => value.outstanding),
        );
        if (scaled18(add(exposure, baseTotal)) > scaled18(limit)) {
          throw new ContractValidationError('creditLimit', 'open exposure would exceed limit');
        }
      }
    }

    const postings: PostingLine[] = [];
    if (invoice.type === 'SUPPLIER') {
      for (const item of prepared) {
        postings.push({
          accountId: item.line.accountId,
          debit: item.baseLine,
          ...foreignFields(isForeign, item.line.amount, invoice.currency),
        });
        if (item.line.taxAmount && scaled18(item.baseTax) > 0n) {
          postings.push({
            accountId: item.line.taxAccountId!,
            debit: item.baseTax,
            ...foreignFields(isForeign, item.line.taxAmount, invoice.currency),
          });
        }
      }
      postings.push({
        accountId: invoice.controlAccountId,
        credit: baseTotal,
        partyId: invoice.partyId,
        ...foreignFields(isForeign, foreignGross, invoice.currency),
      });
    } else {
      postings.push({
        accountId: invoice.controlAccountId,
        debit: baseTotal,
        partyId: invoice.partyId,
        ...foreignFields(isForeign, foreignGross, invoice.currency),
      });
      for (const item of prepared) {
        postings.push({
          accountId: item.line.accountId,
          credit: item.baseLine,
          ...foreignFields(isForeign, item.line.amount, invoice.currency),
        });
        if (item.line.taxAmount && scaled18(item.baseTax) > 0n) {
          postings.push({
            accountId: item.line.taxAccountId!,
            credit: item.baseTax,
            ...foreignFields(isForeign, item.line.taxAmount, invoice.currency),
          });
        }
      }
    }

    if (invoice.status === 'DRAFT') await this.repo.markInvoicePosting(companyId, id);

    const journal = await this.gl.post({
      id: 'billing:' + id,
      companyId,
      number: invoice.number,
      postingDate: invoice.postingDate,
      kind: invoice.type === 'OPENING_CUSTOMER_BALANCE' ? 'OPENING' : undefined,
      sourceType: 'BILLING_INVOICE',
      sourceId: id,
      lines: postings,
    });

    let outstanding = baseTotal;
    const allocationUpdates: Allocation[] = [];
    const advances: Advance[] = [];
    for (const allocation of (await this.repo.allocations(companyId, id)).filter((value) => !value.reversedAt)) {
      const applied = minimum(allocation.amount, outstanding);
      const excess = subtract(allocation.amount, applied);
      outstanding = subtract(outstanding, applied);
      const updated: Allocation = { ...allocation, appliedAmount: applied, advanceAmount: excess };
      allocationUpdates.push(updated);
      if (scaled18(excess) > 0n) advances.push(this.advanceFromAllocation(updated, excess));
    }

    const posted: Invoice = {
      ...invoice,
      status: 'POSTED',
      lines: prepared.map((value) => value.line),
      baseTotal,
      outstanding,
      journalId: journal.id,
      ...(fxRateId ? { fxRateId } : {}),
    };
    await this.repo.finalizeInvoicePosting(posted, allocationUpdates, advances);
    return posted;
  }

  async applyAllocation(input: {
    id: string;
    companyId: CompanyId;
    partyKind: PartyKind;
    partyId: string;
    invoiceId?: string;
    amount: DecimalAmount;
    sourceType: string;
    sourceId: string;
    restrictionSourceType?: string;
    restrictionSourceId?: string;
  }): Promise<Allocation> {
    const amount = positive(input.amount);
    const normalized = { ...input, amount };
    const requestHash = fingerprint(normalized);
    const prior = await this.repo.allocationBySource(input.companyId, input.sourceType, input.sourceId);
    if (prior) {
      if (prior.requestHash !== requestHash) throw new ContractValidationError('source', 'conflicting replay');
      return prior;
    }

    let invoiceBefore: Invoice | undefined;
    let invoiceAfter: Invoice | undefined;
    let appliedAmount = zero;
    let advanceAmount = zero;
    let advance: Advance | undefined;

    if (input.invoiceId) {
      invoiceBefore = await this.requiredInvoice(input.companyId, input.invoiceId);
      if (invoiceBefore.partyId !== input.partyId) {
        throw new ContractValidationError('partyId', 'invoice party mismatch');
      }
      if (expectedPartyKind(invoiceBefore.type) !== input.partyKind) {
        throw new ContractValidationError('partyKind', 'allocation party kind does not match invoice');
      }

      if (invoiceBefore.status === 'DRAFT') {
        // A no-op invoice state touch gives the database transaction a status/outstanding compare-and-set.
        // This makes prefunding race safely with the DRAFT -> POSTING transition.
        invoiceAfter = { ...invoiceBefore };
      } else if (invoiceBefore.status === 'POSTED') {
        appliedAmount = minimum(amount, invoiceBefore.outstanding);
        advanceAmount = subtract(amount, appliedAmount);
        invoiceAfter = { ...invoiceBefore, outstanding: subtract(invoiceBefore.outstanding, appliedAmount) };
      } else {
        throw new ContractValidationError('invoice', 'allocation requires a draft or posted invoice');
      }
    } else {
      advanceAmount = amount;
    }

    const allocation: Allocation = {
      ...normalized,
      appliedAmount,
      advanceAmount,
      requestHash,
    };
    if (scaled18(advanceAmount) > 0n) advance = this.advanceFromAllocation(allocation, advanceAmount);

    try {
      await this.repo.saveAllocationEffect(
        allocation,
        invoiceAfter ? invoiceBefore : undefined,
        invoiceAfter,
        advance,
      );
      return allocation;
    } catch (error) {
      const concurrent = await this.repo.allocationBySource(input.companyId, input.sourceType, input.sourceId);
      if (concurrent) {
        if (concurrent.requestHash === requestHash) return concurrent;
        throw new ContractValidationError('source', 'conflicting replay');
      }
      throw error;
    }
  }

  private advanceFromAllocation(allocation: Allocation, amount: DecimalAmount): Advance {
    return {
      id: 'advance:' + allocation.id,
      companyId: allocation.companyId,
      partyKind: allocation.partyKind,
      partyId: allocation.partyId,
      amount,
      available: amount,
      sourceType: allocation.sourceType,
      sourceId: allocation.sourceId,
      ...(allocation.restrictionSourceType
        ? { restrictionSourceType: allocation.restrictionSourceType }
        : {}),
      ...(allocation.restrictionSourceId ? { restrictionSourceId: allocation.restrictionSourceId } : {}),
    };
  }

  async reverseAllocation(companyId: CompanyId, id: string): Promise<Allocation> {
    const allocation = (await this.repo.allocations(companyId)).find((value) => value.id === id);
    if (!allocation) throw new ContractValidationError('allocation', 'not found');
    if (allocation.reversedAt) return allocation;

    const generatedAdvance = await this.repo.advance(companyId, 'advance:' + id);
    if (
      generatedAdvance &&
      !generatedAdvance.reversedAt &&
      generatedAdvance.available !== generatedAdvance.amount
    ) {
      throw new ContractValidationError('allocation', 'generated advance has downstream consumption');
    }

    let invoiceBefore: Invoice | undefined;
    let invoiceAfter: Invoice | undefined;
    if (allocation.invoiceId && scaled18(allocation.appliedAmount) > 0n) {
      invoiceBefore = await this.requiredInvoice(companyId, allocation.invoiceId);
      if (invoiceBefore.status !== 'POSTED') {
        throw new ContractValidationError('invoice', 'allocation reversal requires posted invoice');
      }
      invoiceAfter = {
        ...invoiceBefore,
        outstanding: add(invoiceBefore.outstanding, allocation.appliedAmount),
      };
    }

    const reversedAt = new Date().toISOString();
    const reversed = { ...allocation, reversedAt };
    const reversedAdvance = generatedAdvance
      ? { ...generatedAdvance, available: zero, reversedAt }
      : undefined;
    await this.repo.saveAllocationEffect(
      reversed,
      invoiceAfter ? invoiceBefore : undefined,
      invoiceAfter,
      reversedAdvance,
    );
    return reversed;
  }

  /** AC-07 public settlement contract. Billing chooses and owns all economic allocations. */
  async settle(input: {
    id: string; companyId: CompanyId; partyKind: PartyKind; partyId: string;
    amount: DecimalAmount; settlementCurrency: string; settlementDate: string;
    explicitDraftInvoiceId?: string; restrictionSourceType?: string; restrictionSourceId?: string;
  }): Promise<{ settlementId: string; allocations: Allocation[]; advanceId?: string;
    carryingBaseAmount: DecimalAmount; settlementBaseAmount: DecimalAmount;
    realizedFx: DecimalAmount; fxRateId?: string }> {
    const amount = positive(input.amount);
    const base = await this.fx.getBaseCurrency(input.companyId);
    const conversion = input.settlementCurrency === base.code
      ? { converted: money(amount, base.code), rate: { rateId: 'SAME_CURRENCY' } }
      : await this.fx.calculateSettlement(input.companyId, money(amount, input.settlementCurrency), base.code, input.settlementDate + 'T23:59:59.999Z');
    const settlementBase = checked(conversion.converted.amount, 'settlementBaseAmount');
    const groupHash = fingerprint({ ...input, amount });
    const existing = (await this.repo.allocations(input.companyId)).filter((x) => x.settlementId === input.id);
    if (existing.length) {
      if (existing.some((x) => x.requestHash !== groupHash)) throw new ContractValidationError('settlement', 'conflicting replay');
      const completed = add(...existing.map((x) => x.settlementBaseAmount ?? x.amount));
      if (completed === settlementBase) return this.settlementResult(input.id, existing, settlementBase, conversion.rate.rateId);
    }
    let remaining = subtract(settlementBase, add(...existing.map((x) => x.settlementBaseAmount ?? x.amount)));
    let remainingSource = amount;
    let sequence = existing.reduce((maximum, value) => Math.max(maximum, value.settlementSequence ?? -1), -1) + 1;
    const candidates = input.explicitDraftInvoiceId
      ? [await this.requiredInvoice(input.companyId, input.explicitDraftInvoiceId)]
      : (await this.repo.invoices(input.companyId))
          .filter((x) => x.partyId === input.partyId && expectedPartyKind(x.type) === input.partyKind && x.status === 'POSTED' && scaled18(x.outstanding) > 0n)
          .sort((a, b) => {
            if (!a.dueDate || !b.dueDate) throw new ContractValidationError('dueDate', 'explicit due date evidence is required for settlement');
            return a.dueDate.localeCompare(b.dueDate) || a.postingDate.localeCompare(b.postingDate) || a.number.localeCompare(b.number) || a.id.localeCompare(b.id);
          });
    const result: Allocation[] = [...existing];
    for (const invoice of candidates) {
      if (scaled18(remaining) <= 0n) break;
      if (!invoice.dueDate) throw new ContractValidationError('dueDate', 'explicit due date evidence is required for settlement');
      let portion = invoice.status === 'DRAFT' ? remaining : minimum(remaining, invoice.outstanding);
      let settlementPortion = portion;
      if (invoice.status === 'POSTED' && invoice.currency === input.settlementCurrency && invoice.currency !== base.code) {
        const documentTotal = add(...invoice.lines.flatMap((line) => line.taxAmount ? [line.amount, line.taxAmount] : [line.amount]));
        if (remainingSource !== documentTotal || invoice.outstanding !== invoice.baseTotal) {
          throw new ContractValidationError('amount', 'partial foreign settlement requires an explicit deterministic allocation intent');
        }
        portion = invoice.outstanding;
        settlementPortion = remaining;
        remainingSource = zero;
      }
      const allocation = await this.applyAllocation({ id: `${input.id}:${sequence}`, companyId: input.companyId,
        partyKind: input.partyKind, partyId: input.partyId, invoiceId: invoice.id, amount: portion,
        sourceType: 'TREASURY_SETTLEMENT', sourceId: `${input.id}:${sequence}`,
        ...(input.restrictionSourceType ? { restrictionSourceType: input.restrictionSourceType } : {}),
        ...(input.restrictionSourceId ? { restrictionSourceId: input.restrictionSourceId } : {}) });
      const enriched: Allocation = { ...allocation, settlementId: input.id, settlementSequence: sequence,
        carryingBaseAmount: allocation.appliedAmount, settlementBaseAmount: settlementPortion,
        realizedFx: subtract(settlementPortion, allocation.appliedAmount),
        settlementFxRateId: conversion.rate.rateId, requestHash: groupHash };
      await this.repo.saveAllocation(enriched); result.push(enriched); remaining = subtract(remaining, settlementPortion); sequence++;
    }
    if (scaled18(remaining) > 0n) {
      const allocation = await this.applyAllocation({ id: `${input.id}:${sequence}`, companyId: input.companyId,
        partyKind: input.partyKind, partyId: input.partyId, amount: remaining,
        sourceType: 'TREASURY_SETTLEMENT', sourceId: `${input.id}:${sequence}`,
        ...(input.restrictionSourceType ? { restrictionSourceType: input.restrictionSourceType } : {}),
        ...(input.restrictionSourceId ? { restrictionSourceId: input.restrictionSourceId } : {}) });
      const enriched: Allocation = { ...allocation, settlementId: input.id, settlementSequence: sequence,
        carryingBaseAmount: zero, settlementBaseAmount: remaining, realizedFx: zero,
        settlementFxRateId: conversion.rate.rateId, requestHash: groupHash };
      await this.repo.saveAllocation(enriched); result.push(enriched);
    }
    return this.settlementResult(input.id, result, settlementBase, conversion.rate.rateId);
  }

  private settlementResult(id: string, allocations: Allocation[], settlementBase: DecimalAmount, fxRateId?: string) {
    const carrying = add(...allocations.map((x) => x.appliedAmount));
    const realizedFx = subtract(settlementBase, add(carrying, ...allocations.map((x) => x.advanceAmount)));
    const advance = allocations.find((x) => scaled18(x.advanceAmount) > 0n);
    return { settlementId: id, allocations, ...(advance ? { advanceId: 'advance:' + advance.id } : {}),
      carryingBaseAmount: carrying, settlementBaseAmount: settlementBase, realizedFx,
      ...(fxRateId ? { fxRateId } : {}) };
  }

  async reverseSettlement(companyId: CompanyId, settlementId: string): Promise<Allocation[]> {
    const values = (await this.repo.allocations(companyId)).filter((x) => x.settlementId === settlementId)
      .sort((a, b) => (b.settlementSequence ?? 0) - (a.settlementSequence ?? 0));
    if (!values.length) throw new ContractValidationError('settlement', 'not found');
    const reversed: Allocation[] = [];
    for (const value of values) reversed.push(await this.reverseAllocation(companyId, value.id));
    return reversed;
  }

  async createAdjustment(input: {
    id: string;
    companyId: CompanyId;
    invoiceId: string;
    kind: 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'WRITE_OFF';
    amount: DecimalAmount;
    sourceType: string;
    sourceId: string;
    postingDate: string;
    number: string;
    offsetAccountId: string;
  }): Promise<Adjustment> {
    const amount = positive(input.amount);
    const normalized = { ...input, amount };
    const requestHash = fingerprint(normalized);
    const prior = await this.repo.adjustmentBySource(input.companyId, input.sourceType, input.sourceId);
    if (prior) {
      if (prior.requestHash !== requestHash) throw new ContractValidationError('source', 'conflicting replay');
      return prior;
    }

    const invoice = await this.requiredInvoice(input.companyId, input.invoiceId);
    if (invoice.status !== 'POSTED') throw new ContractValidationError('invoice', 'must be posted');
    if (invoice.recognitionReference) {
      throw new ContractValidationError('recognition', 'adjustment blocked after recognition started');
    }
    if (input.kind === 'WRITE_OFF' && invoice.type !== 'CUSTOMER') {
      throw new ContractValidationError('writeOff', 'customer receivable required');
    }
    if (input.kind === 'WRITE_OFF' && scaled18(amount) > scaled18(invoice.outstanding)) {
      throw new ContractValidationError('writeOff', 'cannot exceed open receivable');
    }

    const reducesOutstanding = input.kind !== 'DEBIT_NOTE';
    const appliedAmount = reducesOutstanding ? minimum(amount, invoice.outstanding) : amount;
    const advanceAmount = reducesOutstanding ? subtract(amount, appliedAmount) : zero;

    const postings: PostingLine[] =
      input.kind === 'DEBIT_NOTE'
        ? [
            { accountId: invoice.controlAccountId, debit: amount, partyId: invoice.partyId },
            { accountId: input.offsetAccountId, credit: amount },
          ]
        : [
            { accountId: input.offsetAccountId, debit: amount },
            { accountId: invoice.controlAccountId, credit: amount, partyId: invoice.partyId },
          ];

    const journal = await this.gl.post({
      id: 'billing-adjustment:' + input.id,
      companyId: input.companyId,
      number: input.number,
      postingDate: input.postingDate,
      sourceType: 'BILLING_ADJUSTMENT',
      sourceId: input.id,
      lines: postings,
    });

    let advance: Advance | undefined;
    const adjustment: Adjustment = {
      ...normalized,
      appliedAmount,
      advanceAmount,
      requestHash,
      journalId: journal.id,
    };

    if (scaled18(advanceAmount) > 0n) {
      advance = {
        id: 'advance:adjustment:' + input.id,
        companyId: input.companyId,
        partyKind: expectedPartyKind(invoice.type),
        partyId: invoice.partyId,
        amount: advanceAmount,
        available: advanceAmount,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        generatedByAdjustmentId: input.id,
      };
      adjustment.advanceId = advance.id;
    }

    const nextInvoice = {
      ...invoice,
      outstanding: reducesOutstanding
        ? subtract(invoice.outstanding, appliedAmount)
        : add(invoice.outstanding, appliedAmount),
    };
    await this.repo.saveAdjustmentEffect(adjustment, invoice, nextInvoice, advance);
    return adjustment;
  }

  async reverseAdjustment(
    companyId: CompanyId,
    id: string,
    postingDate: string,
    number: string,
  ): Promise<Adjustment> {
    const adjustment = await this.repo.adjustment(companyId, id);
    if (!adjustment) throw new ContractValidationError('adjustment', 'not found');
    if (adjustment.reversedAt) return adjustment;

    const activeAllocations = (await this.repo.allocations(companyId, adjustment.invoiceId)).filter(
      (value) => !value.reversedAt && scaled18(value.appliedAmount) > 0n,
    );
    if (activeAllocations.length > 0) {
      throw new ContractValidationError('adjustment', 'BLOCKED: active downstream invoice allocations');
    }

    const generatedAdvance = adjustment.advanceId
      ? await this.repo.advance(companyId, adjustment.advanceId)
      : undefined;
    if (
      generatedAdvance &&
      !generatedAdvance.reversedAt &&
      generatedAdvance.available !== generatedAdvance.amount
    ) {
      throw new ContractValidationError('adjustment', 'BLOCKED: generated advance was consumed');
    }

    await this.gl.reverse(companyId, adjustment.journalId, postingDate, number);
    const invoice = await this.requiredInvoice(companyId, adjustment.invoiceId);
    if (invoice.status !== 'POSTED') {
      throw new ContractValidationError('invoice', 'adjustment reversal requires posted invoice');
    }

    const nextInvoice = {
      ...invoice,
      outstanding:
        adjustment.kind === 'DEBIT_NOTE'
          ? subtract(invoice.outstanding, adjustment.appliedAmount)
          : add(invoice.outstanding, adjustment.appliedAmount),
    };
    if (scaled18(nextInvoice.outstanding) < 0n) {
      throw new ContractValidationError('adjustment', 'BLOCKED: reversal would make outstanding negative');
    }

    const reversedAt = new Date().toISOString();
    const reversedAdjustment = { ...adjustment, reversedAt };
    const reversedAdvance = generatedAdvance
      ? { ...generatedAdvance, available: zero, reversedAt }
      : undefined;
    await this.repo.saveAdjustmentEffect(
      reversedAdjustment,
      invoice,
      nextInvoice,
      reversedAdvance,
    );
    return reversedAdjustment;
  }

  async recordRecognitionStarted(companyId: CompanyId, invoiceId: string, reference: string) {
    if (!reference.trim()) throw new ContractValidationError('recognitionReference', 'is required');
    const invoice = await this.requiredInvoice(companyId, invoiceId);
    if (!invoice.deferred) throw new ContractValidationError('invoice', 'not deferred');
    if (invoice.recognitionReference && invoice.recognitionReference !== reference) {
      throw new ContractValidationError('recognitionReference', 'already recorded');
    }
    const value = { ...invoice, recognitionReference: reference };
    await this.repo.saveInvoice(value);
    return value;
  }

  async cancelInvoice(
    companyId: CompanyId,
    id: string,
    postingDate: string,
    number: string,
  ): Promise<Invoice> {
    let invoice = await this.requiredInvoice(companyId, id);
    if (invoice.status === 'CANCELLED') return invoice;
    if (invoice.status === 'POSTED') invoice = await this.repo.beginCancellation(companyId, id);
    if (invoice.status !== 'CANCELLING' || !invoice.journalId) {
      throw new ContractValidationError('invoice', 'only posted/cancelling invoice may be cancelled');
    }

    const reversal = await this.gl.reverse(companyId, invoice.journalId, postingDate, number);
    const value = {
      ...invoice,
      status: 'CANCELLED' as const,
      reversalJournalId: reversal.id,
      outstanding: zero,
    };
    await this.repo.saveInvoice(value);
    return value;
  }

  async consumeAdvance(input: {
    companyId: CompanyId;
    advanceId: string;
    amount: DecimalAmount;
    sourceType: 'SUPPLIER_CANCELLATION_CHARGE' | 'CUSTOMER_CANCELLATION_FEE';
    sourceId: string;
    invoiceSourceType?: string;
    invoiceSourceId?: string;
  }): Promise<Advance> {
    const amount = positive(input.amount);
    const prior = await this.repo.consumptionBySource(
      input.companyId,
      input.sourceType,
      input.sourceId,
    );
    if (prior) {
      if (prior.advanceId !== input.advanceId || prior.amount !== amount) {
        throw new ContractValidationError('source', 'conflicting advance-consumption replay');
      }
      const current = await this.repo.advance(input.companyId, input.advanceId);
      if (!current) throw new ContractValidationError('advance', 'not found');
      return current;
    }

    const advance = await this.repo.advance(input.companyId, input.advanceId);
    if (!advance || advance.reversedAt) throw new ContractValidationError('advance', 'not available');
    if (scaled18(amount) > scaled18(advance.available)) {
      throw new ContractValidationError('amount', 'exceeds available advance');
    }
    if (
      advance.restrictionSourceId &&
      (advance.restrictionSourceId !== input.invoiceSourceId ||
        advance.restrictionSourceType !== input.invoiceSourceType)
    ) {
      throw new ContractValidationError('source', 'restricted advance cannot cross source');
    }

    const next = { ...advance, available: subtract(advance.available, amount) };
    const consumption: AdvanceConsumption = {
      id: input.sourceType + ':' + input.sourceId,
      companyId: input.companyId,
      advanceId: advance.id,
      amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    };

    try {
      await this.repo.saveAdvanceConsumptionEffect(consumption, advance, next);
      return next;
    } catch (error) {
      const concurrent = await this.repo.consumptionBySource(
        input.companyId,
        input.sourceType,
        input.sourceId,
      );
      if (concurrent?.advanceId === input.advanceId && concurrent.amount === amount) {
        return (await this.repo.advance(input.companyId, input.advanceId)) ?? next;
      }
      throw error;
    }
  }

  async invoiceOutstanding(companyId: CompanyId, id: string) {
    return (await this.requiredInvoice(companyId, id)).outstanding;
  }

  async availableAdvances(companyId: CompanyId, kind: PartyKind, partyId: string) {
    return (await this.repo.advances(companyId, kind, partyId)).filter(
      (value) => !value.reversedAt && scaled18(value.available) > 0n,
    );
  }

  private async requiredInvoice(companyId: CompanyId, id: string): Promise<Invoice> {
    const value = await this.repo.invoice(companyId, id);
    if (!value) throw new ContractValidationError('invoice', 'not found');
    return value;
  }
}
