import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  money,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import type { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import type { GeneralLedgerApplicationService, PostingLine } from '@elhafez/general-ledger';
import type { EcrRepository } from './ecr.repository.js';
import type {
  InvoiceRevenueAllocation,
  InvoiceRevenueRecognitionRepository,
} from './invoice-revenue-recognition.repository.js';
import type { RecognitionSchedule } from '../domain/ecr.js';

const SCALE = 10n ** 18n;

function scaled(value: DecimalAmount | string): bigint {
  const text = decimalAmount(value as DecimalAmount);
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
  return negative ? -result : result;
}

function dec(value: bigint): DecimalAmount {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = absolute % SCALE;
  const suffix = fraction === 0n ? '' : `.${fraction.toString().padStart(18, '0').replace(/0+$/, '')}`;
  return decimalAmount(`${negative ? '-' : ''}${whole}${suffix}`);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class InvoiceRevenueRecognitionApplicationService {
  constructor(
    private readonly schedules: EcrRepository,
    private readonly allocations: InvoiceRevenueRecognitionRepository,
    private readonly billing: Pick<BillingSubledgersApplicationService, 'getInvoice' | 'getOpenPosition' | 'recordRecognitionStarted'>,
    private readonly gl: Pick<GeneralLedgerApplicationService, 'post'>,
    private readonly fx: Pick<CurrencyFxApplicationService, 'getBaseCurrency' | 'calculateSettlement'>,
  ) {}

  private async baseAmount(companyId: CompanyId, currency: string, amount: DecimalAmount, postingDate: string) {
    const base = await this.fx.getBaseCurrency(companyId);
    const source = currencyCode(currency);
    if (source === base.code) return amount;
    const conversion = await this.fx.calculateSettlement(
      companyId,
      money(amount, source),
      base.code,
      `${postingDate}T23:59:59.999Z`,
    );
    return decimalAmount(conversion.converted.amount);
  }

  async scheduleManualInvoice(input: {
    companyId: CompanyId;
    invoiceId: string;
    recognitionDate: string;
    deferredAccountId: string;
  }): Promise<RecognitionSchedule> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.recognitionDate)) {
      throw new ContractValidationError('recognitionDate', 'explicit ISO date required');
    }
    const invoice = await this.billing.getInvoice(input.companyId, input.invoiceId);
    if (!invoice) throw new ContractValidationError('invoiceId', 'not found');
    if (invoice.status !== 'POSTED' || !invoice.deferred) {
      throw new ContractValidationError('invoiceId', 'posted explicitly deferred invoice required');
    }
    if (invoice.type !== 'CUSTOMER' && invoice.type !== 'AGENT') {
      throw new ContractValidationError('invoiceId', 'customer or agent receivable required');
    }
    if (input.recognitionDate <= invoice.postingDate) {
      throw new ContractValidationError('recognitionDate', 'must be after invoice date for deferred revenue');
    }

    const grouped = new Map<string, bigint>();
    for (const line of invoice.lines) {
      const amount = scaled(line.amount);
      if (amount <= 0n) throw new ContractValidationError('invoiceLine', 'positive revenue amount required');
      grouped.set(line.accountId, (grouped.get(line.accountId) ?? 0n) + amount);
    }
    if (!grouped.size) throw new ContractValidationError('invoiceLine', 'at least one revenue line required');

    const scheduleId = `manual-invoice-recognition:${invoice.id}`;
    const allocationValues: InvoiceRevenueAllocation[] = [];
    let sourceTotal = 0n;
    let baseTotal = 0n;
    for (const [accountId, sourceScaled] of grouped) {
      const sourceAmount = dec(sourceScaled);
      const baseAmount = await this.baseAmount(input.companyId, invoice.currency, sourceAmount, invoice.postingDate);
      sourceTotal += sourceScaled;
      baseTotal += scaled(baseAmount);
      allocationValues.push({
        id: `${scheduleId}:${accountId}`,
        companyId: input.companyId,
        scheduleId,
        accountId,
        amount: baseAmount,
      });
    }
    if (baseTotal <= 0n) throw new ContractValidationError('baseAmount', 'positive deferred revenue required');

    const normalized = {
      companyId: input.companyId,
      invoiceId: invoice.id,
      recognitionDate: input.recognitionDate,
      deferredAccountId: input.deferredAccountId,
      currency: invoice.currency,
      sourceAmount: dec(sourceTotal),
      baseAmount: dec(baseTotal),
      allocations: allocationValues.map((value) => ({ accountId: value.accountId, amount: value.amount })),
    };
    const requestHash = fingerprint(normalized);
    const existing = await this.schedules.scheduleByInvoice(input.companyId, invoice.id, 'DEFERRED_REVENUE');
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ContractValidationError('recognitionDate', 'deferred revenue schedule already exists with different terms');
      }
      return existing;
    }

    const schedule: RecognitionSchedule = {
      id: scheduleId,
      companyId: input.companyId,
      kind: 'DEFERRED_REVENUE',
      sourceType: 'MANUAL_ACCOUNTING_INVOICE',
      sourceId: invoice.sourceId,
      sourceInvoiceId: invoice.id,
      currency: invoice.currency,
      sourceAmount: dec(sourceTotal),
      baseAmount: dec(baseTotal),
      deferredAccountId: input.deferredAccountId,
      recognitionAccountId: allocationValues[0]!.accountId,
      requestHash,
      parts: [{
        id: `${scheduleId}:1`,
        serviceDate: input.recognitionDate,
        amount: dec(baseTotal),
        status: 'PENDING',
        cycle: 0,
      }],
    };

    await this.schedules.saveSchedule(schedule);
    await this.allocations.saveAllocations(allocationValues);
    const journalLines: PostingLine[] = allocationValues.map((value) => ({
      accountId: value.accountId,
      debit: value.amount,
    }));
    journalLines.push({ accountId: input.deferredAccountId, credit: dec(baseTotal) });
    const journal = await this.gl.post({
      id: `ecr-invoice-deferral:${invoice.id}`,
      companyId: input.companyId,
      ...(invoice.branchId ? { branchId: invoice.branchId } : {}),
      number: `${invoice.number}-DEF`,
      postingDate: invoice.postingDate,
      sourceType: 'ECR_INITIAL_DEFERRAL',
      sourceId: scheduleId,
      lines: journalLines,
    });
    await this.schedules.setInitialJournalId(input.companyId, scheduleId, journal.id);
    return { ...schedule, initialJournalId: journal.id };
  }

  async recognizeManualInvoice(input: {
    companyId: CompanyId;
    invoiceId: string;
    postingDate: string;
    number: string;
  }) {
    const schedule = await this.schedules.scheduleByInvoice(input.companyId, input.invoiceId, 'DEFERRED_REVENUE');
    if (!schedule) throw new ContractValidationError('recognitionSchedule', 'not found');
    if (schedule.parts.length !== 1) {
      throw new ContractValidationError('recognitionSchedule', 'manual invoice recognition expects one explicit service date');
    }
    const part = schedule.parts[0]!;
    if (part.status === 'POSTED') return part;
    if (input.postingDate < part.serviceDate) {
      throw new ContractValidationError('recognitionDate', 'recognition cannot precede the explicit service date');
    }
    const allocations = await this.allocations.listAllocations(input.companyId, schedule.id);
    if (!allocations.length) throw new ContractValidationError('recognitionAllocation', 'not found');
    const total = allocations.reduce((sum, value) => sum + scaled(value.amount), 0n);
    if (total !== scaled(part.amount)) {
      throw new ContractValidationError('recognitionAllocation', 'allocation total does not match recognition amount');
    }

    await this.billing.recordRecognitionStarted(input.companyId, input.invoiceId, `ECR:${schedule.id}`);
    const lines: PostingLine[] = [{ accountId: schedule.deferredAccountId, debit: part.amount }];
    for (const allocation of allocations) lines.push({ accountId: allocation.accountId, credit: allocation.amount });
    const journal = await this.gl.post({
      id: `ecr-invoice-recognition:${part.id}:${part.cycle}`,
      companyId: input.companyId,
      number: input.number,
      postingDate: input.postingDate,
      sourceType: 'ECR_RECOGNITION',
      sourceId: `${part.id}:${part.cycle}`,
      lines,
    });
    const posted = { ...part, status: 'POSTED' as const, journalId: journal.id };
    return this.schedules.transitionRecognitionPart(
      input.companyId,
      schedule.id,
      part.id,
      'PENDING',
      part.cycle,
      posted,
    );
  }
}
