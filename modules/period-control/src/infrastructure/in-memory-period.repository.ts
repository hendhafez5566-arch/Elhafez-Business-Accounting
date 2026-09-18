import type { CompanyId } from '@elhafez/contracts';
import type { PeriodRepository } from '../application/period.repository.js';
import type { AccountingPeriod, CloseHistory, FiscalYear } from '../domain/period.js';

export class InMemoryPeriodRepository implements PeriodRepository {
  private fiscalYears: FiscalYear[] = [];
  private accountingPeriods: AccountingPeriod[] = [];
  private history: CloseHistory[] = [];

  async years(companyId: CompanyId): Promise<FiscalYear[]> {
    return this.fiscalYears.filter((x) => x.companyId === companyId);
  }

  async periods(companyId: CompanyId, fiscalYearId?: string): Promise<AccountingPeriod[]> {
    return this.accountingPeriods.filter(
      (x) =>
        x.companyId === companyId &&
        (!fiscalYearId || x.fiscalYearId === fiscalYearId),
    );
  }

  async saveYear(value: FiscalYear): Promise<void> {
    this.fiscalYears = this.fiscalYears.filter(
      (x) => !(x.companyId === value.companyId && x.id === value.id),
    );
    this.fiscalYears.push(value);
  }

  async savePeriod(value: AccountingPeriod): Promise<void> {
    this.accountingPeriods = this.accountingPeriods.filter(
      (x) => !(x.companyId === value.companyId && x.id === value.id),
    );
    this.accountingPeriods.push(value);
  }

  async commitFiscalClose(year: FiscalYear, close: CloseHistory): Promise<void> {
    this.history = this.history.filter(
      (x) =>
        !(
          x.companyId === close.companyId &&
          x.fiscalYearId === close.fiscalYearId &&
          x.closeJournalId === close.closeJournalId
        ),
    );
    this.history.push(close);
    await this.saveYear(year);
  }

  async commitReopen(year: FiscalYear, close: CloseHistory): Promise<void> {
    this.history = this.history.filter(
      (x) =>
        !(
          x.companyId === close.companyId &&
          x.fiscalYearId === close.fiscalYearId &&
          x.closeJournalId === close.closeJournalId
        ),
    );
    this.history.push(close);
    await this.saveYear(year);
  }

  async closeHistory(companyId: CompanyId, fiscalYearId: string): Promise<CloseHistory[]> {
    return this.history.filter(
      (x) => x.companyId === companyId && x.fiscalYearId === fiscalYearId,
    );
  }
}
