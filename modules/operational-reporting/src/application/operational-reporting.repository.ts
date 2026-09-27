import type{OperationalReportSchedule,SavedOperationalReport}from'../domain/operational-reporting.js';
export interface OperationalReportingRepository{
 createSavedReport(input:SavedOperationalReport):Promise<SavedOperationalReport>;
 updateSavedReport(companyId:string,id:string,input:Pick<SavedOperationalReport,'name'|'filters'|'visibility'|'active'|'updatedAt'>):Promise<SavedOperationalReport>;
 findSavedReport(companyId:string,id:string):Promise<SavedOperationalReport|undefined>;
 listSavedReports(companyId:string):Promise<readonly SavedOperationalReport[]>;
 createSchedule(input:OperationalReportSchedule):Promise<OperationalReportSchedule>;
 updateSchedule(companyId:string,id:string,input:Pick<OperationalReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'|'updatedAt'>):Promise<OperationalReportSchedule>;
 listSchedules(companyId:string,savedReportId?:string):Promise<readonly OperationalReportSchedule[]>;
}
export const OPERATIONAL_REPORTING_REPOSITORY=Symbol('OPERATIONAL_REPORTING_REPOSITORY');
