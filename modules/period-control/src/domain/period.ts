import type { CompanyId } from '@elhafez/contracts';
export type PeriodStatus = 'OPEN'|'CLOSED';
export interface FiscalYear { id:string; companyId:CompanyId; startDate:string; endDate:string; status:PeriodStatus }
export interface AccountingPeriod { id:string; companyId:CompanyId; fiscalYearId:string; startDate:string; endDate:string; status:PeriodStatus }
export interface CloseHistory { id:string; companyId:CompanyId; fiscalYearId:string; closeJournalId:string; reversalJournalId?:string; closedAt:string; reopenedAt?:string }
export const dateOnly=(value:string):string=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00.000Z'))) throw new Error('date must be YYYY-MM-DD'); return value; };
