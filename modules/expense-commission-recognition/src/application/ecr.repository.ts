import type { CompanyId } from '@elhafez/contracts';
import type { Expense, RecognitionSchedule, SchedulePart, CommissionClaim, CommissionPayment, Accrual, SupplierAdvanceSettlement } from '../domain/ecr.js';
export const ECR_REPOSITORY=Symbol('ECR_REPOSITORY');
export interface EcrRepository {
 listExpenses(companyId:CompanyId,branchId?:string):Promise<Expense[]>;
 listSchedules(companyId:CompanyId):Promise<RecognitionSchedule[]>;
 listClaims(companyId:CompanyId,branchId?:string):Promise<CommissionClaim[]>;
 listAccruals(companyId:CompanyId):Promise<Accrual[]>;
 expense(companyId:CompanyId,id:string):Promise<Expense|undefined>; saveExpense(value:Expense):Promise<void>;
 schedule(companyId:CompanyId,id:string):Promise<RecognitionSchedule|undefined>;
 scheduleByInvoice(companyId:CompanyId,invoiceId:string,kind:string):Promise<RecognitionSchedule|undefined>;
 saveSchedule(value:RecognitionSchedule):Promise<void>;
 setInitialJournalId(companyId:CompanyId,scheduleId:string,journalId:string):Promise<void>;
 transitionRecognitionPart(companyId:CompanyId,scheduleId:string,partId:string,expectedStatus:SchedulePart['status'],expectedCycle:number,next:SchedulePart):Promise<SchedulePart>;
 claim(companyId:CompanyId,id:string):Promise<CommissionClaim|undefined>; saveClaim(value:CommissionClaim):Promise<void>;
 reserveCommissionPayment(companyId:CompanyId,claimId:string,payment:CommissionPayment):Promise<{claim:CommissionClaim;payment:CommissionPayment}>;
 finalizeCommissionPayment(companyId:CompanyId,claimId:string,payment:CommissionPayment):Promise<CommissionClaim>;
 accrual(companyId:CompanyId,id:string):Promise<Accrual|undefined>; saveAccrual(value:Accrual):Promise<void>;
 supplierSettlement(companyId:CompanyId,id:string):Promise<SupplierAdvanceSettlement|undefined>;
 saveSupplierSettlement(value:SupplierAdvanceSettlement):Promise<void>;
}
