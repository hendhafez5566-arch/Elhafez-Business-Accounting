import{crmGet,crmPatch,crmPost}from'./crm-core-client.js';
import{accountingApi,type AccountingOverview,type ReportRow}from'./accounting-client.js';
import{managementControlApi,type ManagementOverview}from'./management-control-client.js';

export type ReportKey='EXECUTIVE_OVERVIEW'|'FINANCIAL_STATEMENTS'|'AR_AGING'|'AP_AGING'|'TREASURY'|'TAX'|'PROGRAM_PROFITABILITY'|'CRM_SALES'|'SUPPLIER_PROCUREMENT'|'HAJJ_UMRAH'|'EXCEPTIONS';
export interface ReportScopeFilters{readonly from?:string;readonly to?:string;readonly asOf?:string}
export interface SavedReport{readonly id:string;readonly name:string;readonly reportKey:ReportKey;readonly filters:Readonly<Record<string,unknown>>;readonly visibility:'PRIVATE'|'COMPANY';readonly active:boolean;readonly ownerActorId:string;readonly updatedAt:string}
export interface ReportSchedule{readonly id:string;readonly savedReportId:string;readonly cadence:'DAILY'|'WEEKLY'|'MONTHLY';readonly hourUtc:number;readonly weekday:number|null;readonly dayOfMonth:number|null;readonly channel:'IN_APP'|'EMAIL';readonly recipient:string|null;readonly enabled:boolean;readonly updatedAt:string}
export interface ScopedStatements{readonly trialBalance:{readonly rows:readonly ReportRow[]};readonly incomeStatement:{readonly rows:readonly ReportRow[]};readonly balanceSheet:{readonly rows:readonly ReportRow[]}}
export interface AgingPosition{readonly evidenceId:string;readonly partyId?:string;readonly positionKind?:string;readonly dueDate?:string;readonly currency:string;readonly openAmount:string;readonly authoritativeReference?:{readonly sourceType:string;readonly sourceId:string}}
export interface AgingReport{readonly side:'CUSTOMER'|'SUPPLIER'|'AGENT';readonly positions:readonly AgingPosition[]}
export interface CurrencyTotalsReport{readonly totals:readonly {readonly currency:string;readonly amount:string}[]}
export interface ProgramAccountingReport{readonly programId:string;readonly byCurrency:readonly {readonly currency:string;readonly revenue:string;readonly cost:string;readonly profit:string;readonly costCenterIds?:readonly string[]}[]}
export interface ProgramOption{readonly id:string;readonly source:'TOURISM'|'HAJJ_UMRAH';readonly code:string;readonly name:string;readonly status:string}
export interface ReconciliationRunRow{readonly id:string;readonly branchId?:string;readonly type:string;readonly correlationId:string;readonly clean:boolean;readonly runAt:string}
export interface CloseReadinessRow{readonly id:string;readonly branchId?:string;readonly correlationId:string;readonly ready:boolean;readonly blockers:readonly string[];readonly warnings:readonly string[];readonly evaluatedAt:string}
export interface AuditTrailRow{readonly id:string;readonly actorId:string|null;readonly action:string;readonly resource:string;readonly entityId:string|null;readonly branchId:string|null;readonly metadata:Readonly<Record<string,unknown>>;readonly occurredAt:string}
export interface FinancialControlHistory{readonly reconciliationRuns:readonly ReconciliationRunRow[];readonly closeReadinessRuns:readonly CloseReadinessRow[];readonly auditEntries:readonly AuditTrailRow[]}
export interface ReportingCenterData{readonly management:ManagementOverview;readonly accounting:AccountingOverview;readonly financialHistory:FinancialControlHistory;readonly savedReports:readonly SavedReport[];readonly schedules:readonly ReportSchedule[]}
export interface ReportingCenterClient{
 load():Promise<ReportingCenterData>;
 statements(filters?:ReportScopeFilters):Promise<ScopedStatements>;
 aging(side:'CUSTOMER'|'SUPPLIER'|'AGENT',filters?:ReportScopeFilters):Promise<AgingReport>;
 treasury(filters?:ReportScopeFilters):Promise<CurrencyTotalsReport>;
 tax(filters?:ReportScopeFilters):Promise<CurrencyTotalsReport>;
 programs():Promise<readonly ProgramOption[]>;
 program(id:string,filters?:ReportScopeFilters):Promise<ProgramAccountingReport>;
 supplier(filters?:ReportScopeFilters):Promise<unknown>;
 createSavedReport(input:{name:string;reportKey:ReportKey;filters?:Readonly<Record<string,unknown>>;visibility:'PRIVATE'|'COMPANY'}):Promise<SavedReport>;
 updateSavedReport(id:string,input:Partial<Pick<SavedReport,'name'|'filters'|'visibility'|'active'>>):Promise<SavedReport>;
 createSchedule(input:{savedReportId:string;cadence:'DAILY'|'WEEKLY'|'MONTHLY';hourUtc:number;weekday?:number|null;dayOfMonth?:number|null;channel:'IN_APP'|'EMAIL';recipient?:string|null}):Promise<ReportSchedule>;
 updateSchedule(id:string,input:Partial<Pick<ReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'>>):Promise<ReportSchedule>;
}
function query(filters:ReportScopeFilters={}){const q=new URLSearchParams();if(filters.from)q.set('from',filters.from);if(filters.to)q.set('to',filters.to);if(filters.asOf)q.set('asOf',filters.asOf);return q.size?'?'+q.toString():'';}
type TourismProgramRow={id:string;code:string;nameAr:string;status:string};
type HajjProgramRow={id:string;code:string;arabicName:string;status:string};
export class HttpReportingCenterClient implements ReportingCenterClient{
 async load(){const[management,accounting,financialHistory,savedReports,schedules]=await Promise.all([managementControlApi.overview(),accountingApi.overview(),crmGet<FinancialControlHistory>('/management-control/financial-history'),crmGet<readonly SavedReport[]>('/operational-reporting/saved-reports'),crmGet<readonly ReportSchedule[]>('/operational-reporting/schedules')]);return{management,accounting,financialHistory,savedReports,schedules};}
 async statements(filters={}){return crmGet<ScopedStatements>('/accounting/reports/statements'+query(filters));}
 async aging(side:'CUSTOMER'|'SUPPLIER'|'AGENT',filters={}){const suffix=query(filters);return crmGet<AgingReport>('/accounting/reports/aging?side='+side+(suffix?'&'+suffix.slice(1):''));}
 async treasury(filters={}){return crmGet<CurrencyTotalsReport>('/accounting/reports/treasury'+query(filters));}
 async tax(filters={}){return crmGet<CurrencyTotalsReport>('/accounting/reports/tax'+query(filters));}
 async programs(){const[tourism,hajj]=await Promise.allSettled([crmGet<readonly TourismProgramRow[]>('/tourism/programs'),crmGet<readonly HajjProgramRow[]>('/hajj-umrah/programs')]);const rows:ProgramOption[]=[];if(tourism.status==='fulfilled')rows.push(...tourism.value.map(row=>({id:row.id,source:'TOURISM' as const,code:row.code,name:row.nameAr,status:row.status})));if(hajj.status==='fulfilled')rows.push(...hajj.value.map(row=>({id:row.id,source:'HAJJ_UMRAH' as const,code:row.code,name:row.arabicName,status:row.status})));if(tourism.status==='rejected'&&hajj.status==='rejected')throw tourism.reason instanceof Error?tourism.reason:new Error('تعذر تحميل البرامج.');return rows.sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id));}
 async program(id:string,filters={}){return crmGet<ProgramAccountingReport>('/accounting/reports/program/'+encodeURIComponent(id)+query(filters));}
 async supplier(filters={}){return crmGet('/accounting/reports/supplier'+query(filters));}
 async createSavedReport(input:{name:string;reportKey:ReportKey;filters?:Readonly<Record<string,unknown>>;visibility:'PRIVATE'|'COMPANY'}){return crmPost<SavedReport>('/operational-reporting/saved-reports',input);}
 async updateSavedReport(id:string,input:Partial<Pick<SavedReport,'name'|'filters'|'visibility'|'active'>>){return crmPatch<SavedReport>('/operational-reporting/saved-reports/'+encodeURIComponent(id),input);}
 async createSchedule(input:{savedReportId:string;cadence:'DAILY'|'WEEKLY'|'MONTHLY';hourUtc:number;weekday?:number|null;dayOfMonth?:number|null;channel:'IN_APP'|'EMAIL';recipient?:string|null}){return crmPost<ReportSchedule>('/operational-reporting/schedules',input);}
 async updateSchedule(id:string,input:Partial<Pick<ReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'>>){return crmPatch<ReportSchedule>('/operational-reporting/schedules/'+encodeURIComponent(id),input);}
}
