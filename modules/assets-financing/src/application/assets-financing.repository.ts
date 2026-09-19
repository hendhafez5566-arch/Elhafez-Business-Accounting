import type { CompanyId } from '@elhafez/contracts';
import type { Allowance,AllowanceWriteOff,Asset,AssetDepreciation,AssetDisposal,Loan,PayrollRun,Provision,ProvisionMovement } from '../domain/assets-financing.js';
export const ASSETS_FINANCING_REPOSITORY=Symbol('ASSETS_FINANCING_REPOSITORY');
export interface AssetsFinancingRepository {
 asset(c:CompanyId,id:string):Promise<Asset|undefined>; assetByCode(c:CompanyId,code:string):Promise<Asset|undefined>; saveAsset(v:Asset):Promise<void>; depreciation(c:CompanyId,id:string):Promise<AssetDepreciation|undefined>; reserveDepreciation(v:AssetDepreciation):Promise<AssetDepreciation>; finalizeDepreciation(v:AssetDepreciation,asset:Asset):Promise<void>; disposal(c:CompanyId,id:string):Promise<AssetDisposal|undefined>; finalizeDisposal(v:AssetDisposal,asset:Asset):Promise<void>;
 loan(c:CompanyId,id:string):Promise<Loan|undefined>; saveLoan(v:Loan):Promise<void>; reserveInstallment(c:CompanyId,loanId:string,installmentId:string,hash:string):Promise<LoanInstallmentResult>; finalizeInstallment(loan:Loan):Promise<void>;
 provision(c:CompanyId,id:string):Promise<Provision|undefined>; saveProvision(v:Provision):Promise<void>; applyProvisionMovement(v:ProvisionMovement):Promise<Provision>;
 allowance(c:CompanyId,id:string):Promise<Allowance|undefined>; saveAllowance(v:Allowance):Promise<void>; writeOff(c:CompanyId,id:string):Promise<AllowanceWriteOff|undefined>; reserveWriteOff(v:AllowanceWriteOff):Promise<AllowanceWriteOff>; finalizeWriteOff(v:AllowanceWriteOff):Promise<void>;
 payroll(c:CompanyId,id:string):Promise<PayrollRun|undefined>; payrollBySource(c:CompanyId,sourceId:string):Promise<PayrollRun|undefined>; savePayroll(v:PayrollRun):Promise<void>;
}
export interface LoanInstallmentResult { loan:Loan; installmentIndex:number }
