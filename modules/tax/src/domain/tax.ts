import type { CompanyId, DecimalAmount } from '@elhafez/contracts';
export interface TaxPolicy { id:string; companyId:CompanyId; code:string; effectiveFrom:string; rate:DecimalAmount; outputAccountId:string; inputAccountId:string }
export interface TaxSnapshot { id:string; companyId:CompanyId; policyId:string; code:string; effectiveAt:string; rate:DecimalAmount; taxableAmount:DecimalAmount; taxAmount:DecimalAmount; outputAccountId:string; inputAccountId:string; createdAt:string }
