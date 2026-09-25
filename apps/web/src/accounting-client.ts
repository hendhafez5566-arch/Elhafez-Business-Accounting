import{crmGet,crmPost}from'./crm-core-client.js';

export type AccountClassification='ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE';
export interface AccountRow{id:string;code:string;name:string;classification:AccountClassification;active:boolean;postable:boolean;parentId?:string;controlType?:string}
export interface FiscalYearRow{id:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface PeriodRow{id:string;fiscalYearId:string;startDate:string;endDate:string;status:'OPEN'|'CLOSED'}
export interface JournalLineRow{id:string;accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}
export interface JournalRow{id:string;number:string;postingDate:string;kind:string;sourceType:string;sourceId:string;reversalOfId?:string;lines:readonly JournalLineRow[]}
export interface InvoiceRow{id:string;branchId?:string;type:string;status:string;partyId:string;number:string;postingDate:string;dueDate?:string;currency:string;baseTotal:string;outstanding:string}
export interface TreasuryRow{id:string;code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string;active:boolean}
export interface VoucherRow{id:string;branchId?:string;treasuryId:string;kind:string;partyId:string;number:string;postingDate:string;currency:string;amount:string;status:string}
export interface ReportRow{accountId?:string;accountClass?:string;currency:string;amount:string}
export interface AccountingOverview{
 fiscalYears:FiscalYearRow[];periods:PeriodRow[];accounts:AccountRow[];journals:JournalRow[];invoices:InvoiceRow[];treasuries:TreasuryRow[];vouchers:VoucherRow[];
 reports:{trialBalance:{rows:ReportRow[]};incomeStatement:{rows:ReportRow[]};balanceSheet:{rows:ReportRow[]};treasury:{totals:{currency:string;amount:string}[]}};
}
export interface AccountingCapabilities{read:boolean;operate:boolean}
const base='/accounting';
export const accountingApi={
 capabilities:()=>crmGet<AccountingCapabilities>(base+'/capabilities'),
 overview:()=>crmGet<AccountingOverview>(base+'/overview'),
 createAccount:(input:{code:string;name:string;classification:AccountClassification;postable:boolean;parentId?:string;controlType?:string})=>crmPost<AccountRow>(base+'/accounts',input),
 createFiscalYear:(input:{startDate:string;endDate:string})=>crmPost<FiscalYearRow>(base+'/fiscal-years',input),
 createPeriod:(input:{fiscalYearId:string;startDate:string;endDate:string})=>crmPost<PeriodRow>(base+'/periods',input),
 postManualJournal:(input:{commandKey:string;number:string;postingDate:string;lines:{accountId:string;debit?:string;credit?:string;partyId?:string;costCenterId?:string}[]})=>crmPost<JournalRow>(base+'/manual-journals',input),
 createTreasury:(input:{code:string;name:string;type:'CASH'|'BANK';currency:string;glAccountId:string})=>crmPost<TreasuryRow>(base+'/treasuries',input),
};
