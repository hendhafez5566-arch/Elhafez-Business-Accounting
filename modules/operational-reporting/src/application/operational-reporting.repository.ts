import type{OperationalReportDelivery,OperationalReportSchedule,SavedOperationalReport}from'../domain/operational-reporting.js';
export interface OperationalReportingRepository{
 createSavedReport(input:SavedOperationalReport):Promise<SavedOperationalReport>;
 updateSavedReport(companyId:string,id:string,input:Pick<SavedOperationalReport,'name'|'filters'|'visibility'|'active'|'updatedAt'>):Promise<SavedOperationalReport>;
 findSavedReport(companyId:string,id:string):Promise<SavedOperationalReport|undefined>;
 listSavedReports(companyId:string):Promise<readonly SavedOperationalReport[]>;
 createSchedule(input:OperationalReportSchedule):Promise<OperationalReportSchedule>;
 updateSchedule(companyId:string,id:string,input:Pick<OperationalReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'|'updatedAt'>):Promise<OperationalReportSchedule>;
 listSchedules(companyId:string,savedReportId?:string):Promise<readonly OperationalReportSchedule[]>;
 listEnabledSchedules():Promise<readonly OperationalReportSchedule[]>;
 reserveDelivery(input:OperationalReportDelivery):Promise<OperationalReportDelivery>;
 claimDueDeliveries(now:string,limit:number):Promise<readonly OperationalReportDelivery[]>;
 saveDelivery(input:OperationalReportDelivery):Promise<OperationalReportDelivery>;
 listDeliveries(companyId:string,savedReportId?:string):Promise<readonly OperationalReportDelivery[]>;
}
export const OPERATIONAL_REPORTING_REPOSITORY=Symbol('OPERATIONAL_REPORTING_REPOSITORY');
