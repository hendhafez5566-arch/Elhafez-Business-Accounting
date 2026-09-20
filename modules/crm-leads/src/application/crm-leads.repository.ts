import type { BranchId, CompanyId } from '@elhafez/contracts';import type { Lead,LeadHistory,LeadId,LeadStatus } from '../domain/lead.js';
export interface CrmLeadsRepository{
 nextNumber(companyId:CompanyId,branchId:BranchId):Promise<number>;
 create(value:Lead,history:LeadHistory):Promise<void>;
 update(value:Lead,history:LeadHistory):Promise<void>;
 find(companyId:CompanyId,branchId:BranchId,id:LeadId):Promise<Lead|undefined>;
 list(companyId:CompanyId,branchId:BranchId,filter?:{status?:LeadStatus;query?:string;responsibleUserId?:string}):Promise<Lead[]>;
 history(companyId:CompanyId,branchId:BranchId,id:LeadId):Promise<LeadHistory[]>;
}
export const CRM_LEADS_REPOSITORY=Symbol('CRM_LEADS_REPOSITORY');
