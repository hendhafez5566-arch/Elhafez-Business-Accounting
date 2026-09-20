import type { BranchId, CompanyId } from '@elhafez/contracts';
import type { Quotation, QuotationCommunication, QuotationHistory, QuotationId } from '../domain/quotation.js';
export interface QuotationsRepository {
  nextNumber(companyId:CompanyId,branchId:BranchId):Promise<number>;
  create(value:Quotation,history:QuotationHistory):Promise<void>;
  save(value:Quotation,history:QuotationHistory):Promise<void>;
  find(companyId:CompanyId,branchId:BranchId,id:QuotationId):Promise<Quotation|undefined>;
  findBySourceLead(companyId:CompanyId,branchId:BranchId,leadId:string):Promise<Quotation|undefined>;
  list(companyId:CompanyId,branchId:BranchId,query?:string):Promise<Quotation[]>;
  addCommunication(value:QuotationCommunication):Promise<void>;
  communications(companyId:CompanyId,branchId:BranchId,quotationId:QuotationId):Promise<QuotationCommunication[]>;
}
export const QUOTATIONS_REPOSITORY=Symbol('QUOTATIONS_REPOSITORY');
