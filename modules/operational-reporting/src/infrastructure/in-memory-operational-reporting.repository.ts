import{ContractValidationError}from'@elhafez/contracts';
import type{OperationalReportingRepository}from'../application/operational-reporting.repository.js';
import type{OperationalReportSchedule,SavedOperationalReport}from'../domain/operational-reporting.js';
export class InMemoryOperationalReportingRepository implements OperationalReportingRepository{
 private saved=new Map<string,SavedOperationalReport>();private schedules=new Map<string,OperationalReportSchedule>();
 async createSavedReport(input:SavedOperationalReport){this.saved.set(input.id,structuredClone(input));return structuredClone(input);}
 async updateSavedReport(companyId:string,id:string,input:Pick<SavedOperationalReport,'name'|'filters'|'visibility'|'active'|'updatedAt'>){const current=await this.findSavedReport(companyId,id);if(!current)throw new ContractValidationError('savedReportId','saved report was not found');const next={...current,...structuredClone(input)};this.saved.set(id,next);return structuredClone(next);}
 async findSavedReport(companyId:string,id:string){const row=this.saved.get(id);return row?.companyId===companyId?structuredClone(row):undefined;}
 async listSavedReports(companyId:string){return[...this.saved.values()].filter(row=>row.companyId===companyId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(row=>structuredClone(row));}
 async createSchedule(input:OperationalReportSchedule){if(!await this.findSavedReport(input.companyId,input.savedReportId))throw new ContractValidationError('savedReportId','saved report was not found');this.schedules.set(input.id,structuredClone(input));return structuredClone(input);}
 async updateSchedule(companyId:string,id:string,input:Pick<OperationalReportSchedule,'cadence'|'hourUtc'|'weekday'|'dayOfMonth'|'channel'|'recipient'|'enabled'|'updatedAt'>){const current=[...this.schedules.values()].find(row=>row.id===id&&row.companyId===companyId);if(!current)throw new ContractValidationError('scheduleId','schedule was not found');const next={...current,...input};this.schedules.set(id,structuredClone(next));return structuredClone(next);}
 async listSchedules(companyId:string,savedReportId?:string){return[...this.schedules.values()].filter(row=>row.companyId===companyId&&(!savedReportId||row.savedReportId===savedReportId)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(row=>structuredClone(row));}
}
