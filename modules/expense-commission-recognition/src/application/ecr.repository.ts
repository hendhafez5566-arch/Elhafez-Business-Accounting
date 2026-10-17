import type { CompanyId,DecimalAmount } from '@elhafez/contracts';
import type { CommissionApprovalIntent,CommissionSettlement,CommissionSettlementRequest,Expense, RecognitionSchedule, SchedulePart, CommissionClaim, CommissionPayment, Accrual, SupplierAdvanceSettlement } from '../domain/ecr.js';
export const ECR_REPOSITORY=Symbol('ECR_REPOSITORY');
export interface EcrRepository {
 expense(companyId:CompanyId,id:string):Promise<Expense|undefined>; saveExpense(value:Expense):Promise<void>;
 schedule(companyId:CompanyId,id:string):Promise<RecognitionSchedule|undefined>;
 scheduleByInvoice(companyId:CompanyId,invoiceId:string,kind:string):Promise<RecognitionSchedule|undefined>;
 saveSchedule(value:RecognitionSchedule):Promise<void>;
 setInitialJournalId(companyId:CompanyId,scheduleId:string,journalId:string):Promise<void>;
 transitionRecognitionPart(companyId:CompanyId,scheduleId:string,partId:string,expectedStatus:SchedulePart['status'],expectedCycle:number,next:SchedulePart):Promise<SchedulePart>;
 reserveCommissionClaim(value:CommissionClaim):Promise<CommissionClaim>;
 completeCommissionApproval(companyId:CompanyId,id:string,intentHash:string,carryingBaseAmount:DecimalAmount,journalId:string):Promise<CommissionClaim>;
 beginCommissionApproval(companyId:CompanyId,id:string,intent:CommissionApprovalIntent):Promise<CommissionClaim>;
 beginCommissionReversal(companyId:CompanyId,id:string):Promise<CommissionClaim>;
 commissionSettlement(companyId:CompanyId,id:string):Promise<CommissionSettlement|undefined>;
 reserveCommissionSettlement(input:CommissionSettlementRequest):Promise<CommissionSettlement>;
 completeCommissionSettlement(companyId:CompanyId,id:string):Promise<CommissionSettlement>;
 claim(companyId:CompanyId,id:string):Promise<CommissionClaim|undefined>; saveClaim(value:CommissionClaim):Promise<void>;
 reserveCommissionPayment(companyId:CompanyId,claimId:string,payment:CommissionPayment):Promise<{claim:CommissionClaim;payment:CommissionPayment}>;
 finalizeCommissionPayment(companyId:CompanyId,claimId:string,payment:CommissionPayment):Promise<CommissionClaim>;
 accrual(companyId:CompanyId,id:string):Promise<Accrual|undefined>; saveAccrual(value:Accrual):Promise<void>;
 supplierSettlement(companyId:CompanyId,id:string):Promise<SupplierAdvanceSettlement|undefined>;
 saveSupplierSettlement(value:SupplierAdvanceSettlement):Promise<void>;
}
