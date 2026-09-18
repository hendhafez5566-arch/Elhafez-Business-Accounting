import type { CompanyId } from '@elhafez/contracts'; import type { AccountingPeriod,CloseHistory,FiscalYear } from '../domain/period.js';
export const PERIOD_REPOSITORY=Symbol('PERIOD_REPOSITORY');
export interface PeriodRepository { years(companyId:CompanyId):Promise<FiscalYear[]>; periods(companyId:CompanyId,fiscalYearId?:string):Promise<AccountingPeriod[]>; saveYear(v:FiscalYear):Promise<void>; savePeriod(v:AccountingPeriod):Promise<void>; saveClose(v:CloseHistory):Promise<void>; closeHistory(companyId:CompanyId,fiscalYearId:string):Promise<CloseHistory[]> }
