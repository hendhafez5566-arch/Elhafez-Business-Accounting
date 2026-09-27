export interface OperationalReportingAccess{requirePermission(context:{companyId:string;actorId:string},permission:string):Promise<void>;auditOnce(context:{companyId:string;actorId:string},key:string,action:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>}
export const OPERATIONAL_REPORTING_ACCESS=Symbol('OPERATIONAL_REPORTING_ACCESS');
