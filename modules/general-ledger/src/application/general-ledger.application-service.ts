import { createHash } from 'node:crypto';
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  type CompanyId,
  type DecimalAmount,
} from '@elhafez/contracts';
import type {
  FiscalCloseInstruction,
  PeriodControlApplicationService,
} from '@elhafez/period-control';
import type {
  CurrencyFxApplicationService,
  FxRateSnapshot,
} from '@elhafez/currency-fx';
import {
  absoluteExact,
  addExact,
  isPositive,
  subtractExact,
  sumExact,
  type Account,
  type Journal,
  type JournalKind,
  type JournalLine,
} from '../domain/ledger.js';
import type { LedgerRepository } from './ledger.repository.js';

export interface PostingLine {
  accountId: string;
  debit?: DecimalAmount;
  credit?: DecimalAmount;
  partyId?: string;
  costCenterId?: string;
  foreignAmount?: DecimalAmount;
  foreignCurrency?: string;
}

export interface PostingInstruction {
  id: string;
  companyId: CompanyId;
  number: string;
  postingDate: string;
  kind?: JournalKind;
  sourceType: string;
  sourceId: string;
  correlationId?: string;
  lines: readonly PostingLine[];
}

interface PostOptions {
  requestHash?: string;
  reversalOfId?: string;
  preservedFxLines?: readonly JournalLine[];
}

export class GeneralLedgerApplicationService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly period: Pick<
      PeriodControlApplicationService,
      'authorizePosting' | 'authorizeFiscalCloseReversal'
    >,
    private readonly fx?: Pick<CurrencyFxApplicationService, 'resolveRate' | 'getBaseCurrency'>,
  ) {}

  async createAccount(account: Account): Promise<Account> {
    if (await this.repo.accountByCode(account.companyId, account.code)) {
      throw new ContractValidationError('code', 'already used');
    }
    if (account.parentId && !(await this.repo.account(account.companyId, account.parentId))) {
      throw new ContractValidationError('parentId', 'parent must belong to same company');
    }
    await this.repo.saveAccount(account);
    return account;
  }

  async updateAccount(
    companyId: CompanyId,
    id: string,
    change: Partial<Omit<Account, 'id' | 'companyId'>>,
  ): Promise<Account> {
    const account = await this.repo.account(companyId, id);
    if (!account) throw new ContractValidationError('account', 'not found');

    if (await this.repo.hasHistory(companyId, id)) {
      for (const key of ['code', 'classification', 'controlType', 'parentId'] as const) {
        if (change[key] !== undefined && change[key] !== account[key]) {
          throw new ContractValidationError(key, 'historical financial semantics are immutable');
        }
      }
    }

    const next = { ...account, ...change };
    if (next.parentId && !(await this.repo.account(companyId, next.parentId))) {
      throw new ContractValidationError('parentId', 'parent must belong to same company');
    }
    await this.repo.saveAccount(next);
    return next;
  }

  async post(instruction: PostingInstruction): Promise<Journal> {
    const requestHash = this.hashInstruction(instruction);
    const prior = await this.findIdempotent(instruction, requestHash);
    if (prior) return prior;

    const authorization = await this.period.authorizePosting(
      instruction.companyId,
      instruction.postingDate,
    );
    return this.postAuthorized(instruction, authorization.fiscalYearId, { requestHash });
  }

  private hashInstruction(instruction: PostingInstruction): string {
    return createHash('sha256').update(JSON.stringify(instruction)).digest('hex');
  }

  private async findIdempotent(
    instruction: PostingInstruction,
    requestHash: string,
  ): Promise<Journal | undefined> {
    const prior = await this.repo.journalBySource(
      instruction.companyId,
      instruction.sourceType,
      instruction.sourceId,
    );
    if (!prior) return undefined;
    if (prior.requestHash !== requestHash) {
      throw new ContractValidationError('source', 'conflicting duplicate source posting');
    }
    return prior;
  }

  private async postAuthorized(
    instruction: PostingInstruction,
    authorizedFiscalYearId?: string,
    options: PostOptions = {},
  ): Promise<Journal> {
    const requestHash = options.requestHash ?? this.hashInstruction(instruction);
    const prior = await this.findIdempotent(instruction, requestHash);
    if (prior) return prior;

    if (instruction.lines.length < 2) {
      throw new ContractValidationError('lines', 'at least two lines required');
    }

    const debits: DecimalAmount[] = [];
    const credits: DecimalAmount[] = [];
    const lines: JournalLine[] = [];
    let baseCurrency: Awaited<ReturnType<CurrencyFxApplicationService['getBaseCurrency']>> | undefined;

    for (const [index, line] of instruction.lines.entries()) {
      const debit = line.debit !== undefined ? decimalAmount(line.debit) : undefined;
      const credit = line.credit !== undefined ? decimalAmount(line.credit) : undefined;
      const debitPositive = debit !== undefined && isPositive(debit);
      const creditPositive = credit !== undefined && isPositive(credit);

      if (debitPositive === creditPositive) {
        throw new ContractValidationError('line', 'exactly one positive economic side required');
      }

      const account = await this.repo.account(instruction.companyId, line.accountId);
      if (!account || !account.active || !account.postable) {
        throw new ContractValidationError('account', 'not active and postable for company');
      }
      if (account.controlType && !line.partyId) {
        throw new ContractValidationError('partyId', 'control account requires party identity');
      }
      if (!account.controlType && line.partyId) {
        throw new ContractValidationError('partyId', 'party identity is only valid on control accounts');
      }
      if (
        instruction.kind === 'OPENING' &&
        (account.classification === 'REVENUE' || account.classification === 'EXPENSE')
      ) {
        throw new ContractValidationError('opening', 'BR-024 permits balance-sheet accounts only');
      }

      if ((line.foreignCurrency === undefined) !== (line.foreignAmount === undefined)) {
        throw new ContractValidationError(
          'foreignAmount',
          'foreign amount and currency must be supplied together',
        );
      }

      let snapshot: FxRateSnapshot | undefined;
      const preserved = options.preservedFxLines?.[index];
      if (preserved?.fxRateId && preserved.fxRate) {
        snapshot = {
          rateId: preserved.fxRateId,
          companyId: instruction.companyId,
          fromCurrency: currencyCode(preserved.foreignCurrency),
          toCurrency: currencyCode(preserved.foreignCurrency),
          effectiveAt: instruction.postingDate + 'T23:59:59.999Z',
          rate: preserved.fxRate,
          source: 'REVERSAL_SNAPSHOT',
        };
      } else if (line.foreignCurrency) {
        if (!this.fx) throw new ContractValidationError('fx', 'FX service required');
        baseCurrency ??= await this.fx.getBaseCurrency(instruction.companyId);
        snapshot = await this.fx.resolveRate(
          instruction.companyId,
          currencyCode(line.foreignCurrency),
          baseCurrency.code,
          instruction.postingDate + 'T23:59:59.999Z',
        );
      }

      if (debit) debits.push(debit);
      if (credit) credits.push(credit);

      lines.push({
        ...line,
        id: instruction.id + ':' + (index + 1),
        fxRateId: preserved?.fxRateId ?? snapshot?.rateId,
        fxRate: preserved?.fxRate ?? snapshot?.rate,
      });
    }

    if (sumExact(debits) !== sumExact(credits)) {
      throw new ContractValidationError(
        'journal',
        'BR-001 base currency debits and credits must balance',
      );
    }

    const journal = Object.freeze({
      ...instruction,
      kind: instruction.kind ?? 'STANDARD',
      requestHash,
      reversalOfId: options.reversalOfId,
      fiscalYearId: authorizedFiscalYearId,
      lines: Object.freeze(lines),
    }) as Journal;

    try {
      await this.repo.saveJournal(journal);
      return journal;
    } catch (error) {
      const concurrent = await this.repo.journalBySource(
        instruction.companyId,
        instruction.sourceType,
        instruction.sourceId,
      );
      if (concurrent) {
        if (concurrent.requestHash === requestHash) return concurrent;
        throw new ContractValidationError('source', 'conflicting duplicate source posting');
      }
      throw error;
    }
  }

  async reverse(
    companyId: CompanyId,
    journalId: string,
    postingDate: string,
    number: string,
  ): Promise<Journal> {
    const original = await this.repo.journal(companyId, journalId);
    if (!original) throw new ContractValidationError('journal', 'not found');

    const existing = (await this.repo.journals(companyId)).find(
      (journal) => journal.reversalOfId === journalId,
    );
    if (existing) return existing;

    const authorization =
      original.kind === 'FISCAL_CLOSE'
        ? await this.period.authorizeFiscalCloseReversal(companyId, postingDate, journalId)
        : await this.period.authorizePosting(companyId, postingDate);

    return this.postAuthorized(
      {
        id: 'reversal:' + journalId,
        companyId,
        number,
        postingDate,
        kind: 'REVERSAL',
        sourceType: 'JOURNAL_REVERSAL',
        sourceId: journalId,
        correlationId: original.correlationId,
        lines: original.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.credit,
          credit: line.debit,
          partyId: line.partyId,
          costCenterId: line.costCenterId,
          foreignAmount: line.foreignAmount,
          foreignCurrency: line.foreignCurrency,
        })),
      },
      authorization.fiscalYearId,
      { reversalOfId: journalId, preservedFxLines: original.lines },
    );
  }

  async closeFiscalYear(
    instruction: FiscalCloseInstruction,
    retainedEarningsAccountId: string,
    number: string,
  ): Promise<Journal> {
    const sourceId = instruction.fiscalYearId + ':' + instruction.closeSequence;
    const existing = await this.repo.journalBySource(
      instruction.companyId,
      'FISCAL_CLOSE',
      sourceId,
    );
    if (existing) return existing;

    const retainedEarnings = await this.repo.account(
      instruction.companyId,
      retainedEarningsAccountId,
    );
    if (
      !retainedEarnings ||
      !retainedEarnings.active ||
      !retainedEarnings.postable ||
      retainedEarnings.classification !== 'EQUITY' ||
      retainedEarnings.controlType
    ) {
      throw new ContractValidationError(
        'retainedEarningsAccountId',
        'active non-control EQUITY account is required',
      );
    }

    const zero = decimalAmount('0');
    const balances = new Map<string, DecimalAmount>();

    for (const journal of await this.repo.journals(instruction.companyId)) {
      if (journal.postingDate < instruction.startDate || journal.postingDate > instruction.endDate) {
        continue;
      }

      for (const line of journal.lines) {
        const account = await this.repo.account(instruction.companyId, line.accountId);
        if (
          !account ||
          (account.classification !== 'REVENUE' && account.classification !== 'EXPENSE')
        ) {
          continue;
        }

        let balance = balances.get(account.id) ?? zero;
        if (line.debit) balance = addExact(balance, line.debit);
        if (line.credit) balance = subtractExact(balance, line.credit);
        balances.set(account.id, balance);
      }
    }

    const lines: PostingLine[] = [];
    let net = zero;

    for (const [accountId, balance] of balances) {
      if (balance === '0') continue;
      net = addExact(net, balance);
      const amount = absoluteExact(balance);
      lines.push(
        isPositive(balance)
          ? { accountId, credit: amount }
          : { accountId, debit: amount },
      );
    }

    if (net !== '0') {
      const amount = absoluteExact(net);
      lines.push(
        isPositive(net)
          ? { accountId: retainedEarningsAccountId, debit: amount }
          : { accountId: retainedEarningsAccountId, credit: amount },
      );
    }

    if (lines.length === 0) {
      throw new ContractValidationError('close', 'no P&L balance to close');
    }

    return this.post({
      id: 'close:' + instruction.fiscalYearId + ':' + instruction.closeSequence,
      companyId: instruction.companyId,
      number,
      postingDate: instruction.endDate,
      kind: 'FISCAL_CLOSE',
      sourceType: 'FISCAL_CLOSE',
      sourceId,
      lines,
    });
  }

  async getJournal(companyId: CompanyId, id: string): Promise<Journal | undefined> {
    return this.repo.journal(companyId, id);
  }

  async activity(companyId: CompanyId): Promise<Journal[]> {
    return this.repo.journals(companyId);
  }
}
