import{ContractValidationError,type BranchId,type CompanyId}from'@elhafez/contracts';
export type ServiceCaseCategory='COMPLAINT'|'SUPPORT'|'REQUEST';
export type ServiceCasePriority='LOW'|'NORMAL'|'HIGH'|'CRITICAL';
export type ServiceCaseStatus='OPEN'|'IN_PROGRESS'|'WAITING_CUSTOMER'|'RESOLVED'|'CLOSED';
export interface ServiceCase{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly number:string;readonly customerId:string;readonly category:ServiceCaseCategory;readonly priority:ServiceCasePriority;readonly subject:string;readonly description:string;readonly status:ServiceCaseStatus;readonly assigneeUserId:string|null;readonly slaDueAt:string|null;readonly resolvedAt:string|null;readonly closedAt:string|null;readonly createdAt:string;readonly updatedAt:string}
export interface ServiceCaseNote{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly caseId:string;readonly authorId:string;readonly visibility:'INTERNAL'|'CUSTOMER';readonly body:string;readonly createdAt:string}
export interface ServiceCaseHistory{readonly id:string;readonly companyId:CompanyId;readonly branchId:BranchId;readonly caseId:string;readonly action:string;readonly actorId:string;readonly detail:string|null;readonly occurredAt:string}
export const required=(value:string,field:string)=>{const v=value.trim();if(!v)throw new ContractValidationError(field,'is required');return v};
export function isoDateTime(value:string|undefined|null,field:string){if(!value?.trim())return null;const d=new Date(value);if(Number.isNaN(d.valueOf()))throw new ContractValidationError(field,'must be a valid ISO date-time');return d.toISOString();}
