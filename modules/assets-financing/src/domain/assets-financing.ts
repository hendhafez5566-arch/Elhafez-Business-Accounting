import type { CompanyId, DecimalAmount } from '@elhafez/contracts';

export type AssetStatus = 'REGISTERING' | 'ACTIVE' | 'DISPOSING' | 'DISPOSED';
export interface Asset {
  id: string; companyId: CompanyId; code: string; name: string; description?: string;
  acquisitionValue: DecimalAmount; baseValue: DecimalAmount; currency: string;
  acquisitionDate: string; capitalizationDate: string; inServiceDate: string;
  residualValue: DecimalAmount; usefulLifeMonths: number; method: 'STRAIGHT_LINE';
  assetAccountId: string; capitalizationOffsetAccountId: string;
  accumulatedDepreciationAccountId: string; depreciationExpenseAccountId: string;
  disposalGainAccountId?: string; disposalLossAccountId?: string;
  status: AssetStatus; accumulatedDepreciation: DecimalAmount;
  capitalizationJournalId?: string; requestHash: string;
}
export interface AssetDepreciation { id:string; companyId:CompanyId; assetId:string; period:number; postingDate:string; amount:DecimalAmount; status:'POSTING'|'POSTED'; requestHash:string; journalId?:string }
export interface AssetDisposal { id:string; companyId:CompanyId; assetId:string; postingDate:string; proceeds:DecimalAmount; proceedsMode:'TREASURY'|'NON_CASH'; treasuryId?:string; proceedsClearingAccountId?:string; requestHash:string; status:'RESERVED'|'EFFECTS_POSTED'|'COMPLETED'; treasuryVoucherId?:string; journalId?:string }
export interface LoanInstallment { id:string; companyId:CompanyId; loanId:string; sequence:number; dueDate:string; principal:DecimalAmount; interest:DecimalAmount; status:'DUE'|'PAYING'|'PAID'; requestHash?:string; treasuryVoucherId?:string; journalId?:string }
export interface Loan { id:string; companyId:CompanyId; lenderId:string; reference:string; principal:DecimalAmount; outstandingPrincipal:DecimalAmount; currency:string; baseCurrency:string; baseAmount:DecimalAmount; liabilityAccountId:string; interestExpenseAccountId:string; status:'ORIGINATING'|'ORIGINATED'|'COMPLETED'; requestHash:string; fundingTreasuryId:string; originationTreasuryVoucherId?:string; installments:LoanInstallment[] }
export type ProvisionMovementKind='RECOGNIZE'|'INCREASE'|'USE'|'RELEASE';
export interface ProvisionMovement { id:string; companyId:CompanyId; provisionId:string; kind:ProvisionMovementKind; amount:DecimalAmount; sourceType:string; sourceId:string; requestHash:string; status:'RESERVED'|'POSTED'; offsetAccountId:string; journalId?:string; createdAt:string }
export interface Provision { id:string; companyId:CompanyId; name:string; provisionAccountId:string; expenseAccountId:string; releaseAccountId:string; available:DecimalAmount; requestHash:string; movements:ProvisionMovement[] }
export interface AllowanceMovement { id:string; companyId:CompanyId; allowanceId:string; kind:'RECOGNIZE'|'USE'|'RELEASE'; amount:DecimalAmount; sourceId:string; requestHash:string; status:'RESERVED'|'POSTED'; journalId?:string; billingAdjustmentId?:string; createdAt:string }
export interface Allowance { id:string; companyId:CompanyId; customerId?:string; sourceReference:string; allowanceAccountId:string; expenseAccountId:string; releaseAccountId:string; amount:DecimalAmount; used:DecimalAmount; available:DecimalAmount; requestHash:string; movements:AllowanceMovement[] }
export interface AllowanceWriteOff { id:string; companyId:CompanyId; allowanceId:string; invoiceId:string; amount:DecimalAmount; postingDate:string; requestHash:string; status:'RESERVED'|'PROCESSING'|'COMPLETED'|'RELEASED'; billingAdjustmentId?:string; failureReason?:string }
export interface PayrollLiability { id:string; accountId:string; amount:DecimalAmount; label:string }
export interface PayrollRun { id:string; companyId:CompanyId; sourceId:string; payrollPeriod:string; postingDate:string; currency:string; expenseTotal:DecimalAmount; expenseAccountId:string; liabilities:PayrollLiability[]; status:'ACCRUING'|'ACCRUED'|'PAYING'|'PAID'; requestHash:string; journalId?:string; treasuryVoucherId?:string }
