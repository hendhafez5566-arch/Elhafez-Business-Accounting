import{crmGet,crmPatch,crmPost}from'./crm-core-client.js';
import{accountingApi,type AccountingOverview}from'./accounting-client.js';
import{managementControlApi,type ManagementOverview}from'./management-control-client.js';

export type ReportKey='EXECUTIVE_OVERVIEW'|'FINANCIAL_STATEMENTS'|'AR_AGING'|'AP_AGING'|'TREASURY'|'TAX'|'CRM_SALES'|'SUPPLIER_PROCUREMENT'|'HAJJ_UMRAH'|'EXCEPTIONS';
export interface SavedReport{readonly id:string;readonly name:string;readonly reportKey:ReportKey;readonly filters:Readonly<Record<string,unknown>>;readonly visibility:'PRIVATE'|'COMPANY';readonly active:boolean;readonly ownerActorId:string;readonly updatedAt:string}
export interface ReportSchedule{readonly id:string;readonly savedReportId:string;readonly cadence:'DAILY'|'WEEKLY'|'MONTHLY';readonly hourUtc:number;readonly weekday:number|null;readonly dayOfMonth:number|null;readonly channel:'IN_APP'|'EMAIL';readonly recipient:string|null;readonly enabled:boolean;readonly updatedAt:string}
export interface ReportingCenterData{readonly management:ManagementOverview;readonly accounting:AccountingOverview;readonly savedReports:readonly SavedReport[];readonly schedules:readonly ReportSchedule[]}
export interface ReportingCenterClient{
 load():Promise<ReportingCenterData>;
 createSavedReport(input:{name:string;reportKey:ReportKey;filters?:Readonly<Record<string,unknown>>;visibility:'PRIVATE'|'COMPANY'}):Promise<SavedReport>;
 updateSavedReport(id:string,input:Partial<Pick<SavedReport,'name'|'filters'|'visibility'|'active'>>):Promise<SavedReport>;
 createSchedule(input:{savedReportId:string;cadence:'DAILY'|'WEEKLY'|'MONTHLY';hourUtc:number;weekday?:number|null;dayOfMonth?:number|null;channel:'IN_APP'|'EMAIL';recipient?:string|null}):Promise<ReportSchedule>;
 updateSchedule(id:string,input:Partial<Pick<ReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'>>):Promise<ReportSchedule>;
}
export class HttpReportingCenterClient implements ReportingCenterClient{
 async load(){const[management,accounting,savedReports,schedules]=await Promise.all([managementControlApi.overview(),accountingApi.overview(),crmGet<readonly SavedReport[]>('/operational-reporting/saved-reports'),crmGet<readonly ReportSchedule[]>('/operational-reporting/schedules')]);return{management,accounting,savedReports,schedules};}
 async createSavedReport(input:{name:string;reportKey:ReportKey;filters?:Readonly<Record<string,unknown>>;visibility:'PRIVATE'|'COMPANY'}){return crmPost<SavedReport>('/operational-reporting/saved-reports',input);}
 async updateSavedReport(id:string,input:Partial<Pick<SavedReport,'name'|'filters'|'visibility'|'active'>>){return crmPatch<SavedReport>('/operational-reporting/saved-reports/'+encodeURIComponent(id),input);}
 async createSchedule(input:{savedReportId:string;cadence:'DAILY'|'WEEKLY'|'MONTHLY';hourUtc:number;weekday?:number|null;dayOfMonth?:number|null;channel:'IN_APP'|'EMAIL';recipient?:string|null}){return crmPost<ReportSchedule>('/operational-reporting/schedules',input);}
 async updateSchedule(id:string,input:Partial<Pick<ReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'>>){return crmPatch<ReportSchedule>('/operational-reporting/schedules/'+encodeURIComponent(id),input);}
}
