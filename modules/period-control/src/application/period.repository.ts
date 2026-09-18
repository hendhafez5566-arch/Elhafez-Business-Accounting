import type { CompanyId } from '@elhafez/contracts';
import type { AccountingPeriod, CloseHistory, FiscalYear } from '../domain/period.js';

export const PERIOD_REPOSITORY = Symbol('PERIOD_REPOSITORY');

export interface PeriodRepository {
  years(companyId: CompanyId): Promise<FiscalYear[]>;
  periods(companyId: CompanyId, fiscalYearId?: string): Promise<AccountingPeriod[]>;
  saveYear(value: FiscalYear): Promise<void>;
  savePeriod(value: AccountingPeriod): Promise<void>;
  commitFiscalClose(year: FiscalYear, history: CloseHistory): Promise<void>;
  commitReopen(year: FiscalYear, history: CloseHistory): Promise<void>;
  closeHistory(companyId: CompanyId, fiscalYearId: string): Promise<CloseHistory[]>;
}
