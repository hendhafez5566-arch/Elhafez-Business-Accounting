import { ContractValidationError, type CompanyId } from '@elhafez/contracts';
import {
  dateOnly,
  type AccountingPeriod,
  type CloseHistory,
  type FiscalYear,
} from '../domain/period.js';
import type { PeriodRepository } from './period.repository.js';

export interface PostingAuthorization {
  companyId: CompanyId;
  fiscalYearId: string;
  periodId: string;
  postingDate: string;
}

export interface FiscalCloseInstruction {
  companyId: CompanyId;
  fiscalYearId: string;
  startDate: string;
  endDate: string;
  closeSequence: number;
}

export class PeriodControlApplicationService {
  constructor(private readonly repo: PeriodRepository) {}

  async createFiscalYear(input: FiscalYear): Promise<FiscalYear> {
    dateOnly(input.startDate);
    dateOnly(input.endDate);
    if (input.startDate > input.endDate) {
      throw new ContractValidationError('fiscalYear', 'invalid range');
    }
    if (
      (await this.repo.years(input.companyId)).some(
        (year) => input.startDate <= year.endDate && input.endDate >= year.startDate,
      )
    ) {
      throw new ContractValidationError('fiscalYear', 'overlapping fiscal year');
    }
    const value = { ...input, status: 'OPEN' as const };
    await this.repo.saveYear(value);
    return value;
  }

  async createPeriod(input: AccountingPeriod): Promise<AccountingPeriod> {
    dateOnly(input.startDate);
    dateOnly(input.endDate);
    const year = (await this.repo.years(input.companyId)).find(
      (value) => value.id === input.fiscalYearId,
    );
    if (!year) throw new ContractValidationError('fiscalYearId', 'not found for company');
    if (
      input.startDate < year.startDate ||
      input.endDate > year.endDate ||
      input.startDate > input.endDate
    ) {
      throw new ContractValidationError('period', 'must stay inside fiscal year');
    }
    if (
      (await this.repo.periods(input.companyId, input.fiscalYearId)).some(
        (period) => input.startDate <= period.endDate && input.endDate >= period.startDate,
      )
    ) {
      throw new ContractValidationError('period', 'overlapping period');
    }
    const value = { ...input, status: 'OPEN' as const };
    await this.repo.savePeriod(value);
    return value;
  }

  async setPeriodStatus(
    companyId: CompanyId,
    id: string,
    status: 'OPEN' | 'CLOSED',
  ): Promise<void> {
    const period = (await this.repo.periods(companyId)).find((value) => value.id === id);
    if (!period) throw new ContractValidationError('period', 'not found');
    await this.repo.savePeriod({ ...period, status });
  }

  async authorizePosting(
    companyId: CompanyId,
    postingDate: string,
  ): Promise<PostingAuthorization> {
    dateOnly(postingDate);
    const year = (await this.repo.years(companyId)).find(
      (value) => postingDate >= value.startDate && postingDate <= value.endDate,
    );
    if (!year) {
      throw new ContractValidationError('postingDate', 'no valid fiscal period exists');
    }
    if (year.status === 'CLOSED') {
      throw new ContractValidationError('postingDate', 'fiscal year is closed');
    }

    const period = (await this.repo.periods(companyId, year.id)).find(
      (value) => postingDate >= value.startDate && postingDate <= value.endDate,
    );
    if (!period) {
      throw new ContractValidationError('postingDate', 'no valid fiscal period exists');
    }
    if (period.status === 'CLOSED') {
      throw new ContractValidationError('postingDate', 'accounting period is closed');
    }

    return Object.freeze({
      companyId,
      fiscalYearId: year.id,
      periodId: period.id,
      postingDate,
    });
  }

  async authorizeFiscalCloseReversal(
    companyId: CompanyId,
    postingDate: string,
    closeJournalId: string,
  ): Promise<PostingAuthorization> {
    dateOnly(postingDate);
    const year = (await this.repo.years(companyId)).find(
      (value) => postingDate >= value.startDate && postingDate <= value.endDate,
    );
    const history =
      year &&
      (await this.repo.closeHistory(companyId, year.id)).find(
        (value) => value.closeJournalId === closeJournalId && !value.reversalJournalId,
      );

    if (!year || year.status !== 'CLOSED' || !history) {
      throw new ContractValidationError(
        'reversal',
        'authorized closed-year close reference required',
      );
    }

    const period = (await this.repo.periods(companyId, year.id)).find(
      (value) => postingDate >= value.startDate && postingDate <= value.endDate,
    );
    if (!period) {
      throw new ContractValidationError('postingDate', 'no valid fiscal period exists');
    }

    return Object.freeze({
      companyId,
      fiscalYearId: year.id,
      periodId: period.id,
      postingDate,
    });
  }

  async prepareFiscalClose(
    companyId: CompanyId,
    fiscalYearId: string,
  ): Promise<FiscalCloseInstruction> {
    const year = (await this.repo.years(companyId)).find((value) => value.id === fiscalYearId);
    if (!year || year.status === 'CLOSED') {
      throw new ContractValidationError('fiscalYear', 'must be open');
    }

    const history = await this.repo.closeHistory(companyId, fiscalYearId);
    return Object.freeze({
      companyId,
      fiscalYearId,
      startDate: year.startDate,
      endDate: year.endDate,
      closeSequence: history.length + 1,
    });
  }

  async completeFiscalClose(
    instruction: FiscalCloseInstruction,
    result: { journalId: string },
    at = new Date().toISOString(),
  ): Promise<CloseHistory> {
    const year = (await this.repo.years(instruction.companyId)).find(
      (value) => value.id === instruction.fiscalYearId,
    );
    const existing = (await this.repo.closeHistory(
      instruction.companyId,
      instruction.fiscalYearId,
    )).find((value) => value.closeJournalId === result.journalId);

    if (existing) {
      if (year?.status === 'CLOSED') return existing;
      throw new ContractValidationError('fiscalYear', 'close history conflicts with open state');
    }
    if (!year || year.status !== 'OPEN') {
      throw new ContractValidationError('fiscalYear', 'must be open');
    }

    const history: CloseHistory = {
      id:
        'close:' +
        instruction.fiscalYearId +
        ':' +
        instruction.closeSequence +
        ':' +
        result.journalId,
      companyId: instruction.companyId,
      fiscalYearId: instruction.fiscalYearId,
      closeJournalId: result.journalId,
      closedAt: at,
    };

    await this.repo.commitFiscalClose({ ...year, status: 'CLOSED' }, history);
    return history;
  }

  async prepareReopen(companyId: CompanyId, fiscalYearId: string) {
    const year = (await this.repo.years(companyId)).find((value) => value.id === fiscalYearId);
    const history = (await this.repo.closeHistory(companyId, fiscalYearId))
      .filter((value) => !value.reversalJournalId)
      .at(-1);

    if (!year || year.status !== 'CLOSED' || !history) {
      throw new ContractValidationError('fiscalYear', 'closed year history required');
    }

    return Object.freeze({
      companyId,
      fiscalYearId,
      closeJournalId: history.closeJournalId,
    });
  }

  async completeReopen(
    input: { companyId: CompanyId; fiscalYearId: string; closeJournalId: string },
    result: { journalId: string },
    at = new Date().toISOString(),
  ): Promise<CloseHistory> {
    const year = (await this.repo.years(input.companyId)).find(
      (value) => value.id === input.fiscalYearId,
    );
    const history = (await this.repo.closeHistory(
      input.companyId,
      input.fiscalYearId,
    )).find((value) => value.closeJournalId === input.closeJournalId);

    if (!year || !history) throw new ContractValidationError('reopen', 'history missing');

    if (history.reversalJournalId) {
      if (history.reversalJournalId !== result.journalId) {
        throw new ContractValidationError('reopen', 'conflicting reversal');
      }
      if (year.status !== 'OPEN') {
        throw new ContractValidationError('reopen', 'reversal exists but year is not open');
      }
      return history;
    }

    if (year.status !== 'CLOSED') {
      throw new ContractValidationError('fiscalYear', 'must be closed');
    }

    const updated: CloseHistory = {
      ...history,
      reversalJournalId: result.journalId,
      reopenedAt: at,
    };

    await this.repo.commitReopen({ ...year, status: 'OPEN' }, updated);
    return updated;
  }
}
