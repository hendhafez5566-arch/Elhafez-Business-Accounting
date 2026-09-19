import { ContractValidationError } from '@elhafez/contracts';
import type { CompanyId } from '@elhafez/contracts';
import type { EcrRepository } from '../application/ecr.repository.js';
import type { Expense, RecognitionSchedule, CommissionClaim, CommissionPayment, Accrual, SupplierAdvanceSettlement } from '../domain/ecr.js';
const S=10n**18n;function n(v:string){const [w,f='']=v.split('.');return BigInt(w+f.padEnd(18,'0'))}void S;
export class InMemoryEcrRepository implements EcrRepository {
 expenses:Expense[]=[]; schedules:RecognitionSchedule[]=[]; claims:CommissionClaim[]=[]; accruals:Accrual[]=[]; supplierSettlements:SupplierAdvanceSettlement[]=[];
 private put<T extends{id:string;companyId:CompanyId}>(a:T[],v:T){const collision=a.find(x=>x.id===v.id&&x.companyId!==v.companyId);if(collision)throw new ContractValidationError('companyId','ID belongs to another company');const i=a.findIndex(x=>x.id===v.id&&x.companyId===v.companyId);if(i<0)a.push(v);else a[i]=v}
 async expense(c:CompanyId,id:string){return this.expenses.find(x=>x.companyId===c&&x.id===id)} async saveExpense(v:Expense){this.put(this.expenses,v)}
 async schedule(c:CompanyId,id:string){return this.schedules.find(x=>x.companyId===c&&x.id===id)}
 async scheduleByInvoice(c:CompanyId,invoiceId:string,kind:string){return this.schedules.find(x=>x.companyId===c&&x.sourceInvoiceId===invoiceId&&x.kind===kind)}
 async saveSchedule(v:RecognitionSchedule){this.put(this.schedules,v)} async claim(c:CompanyId,id:string){return this.claims.find(x=>x.companyId===c&&x.id===id)} async saveClaim(v:CommissionClaim){this.put(this.claims,v)}
 async reserveCommissionPayment(c:CompanyId,id:string,p:CommissionPayment){const claim=this.claims.find(x=>x.companyId===c&&x.id===id);if(!claim)throw new ContractValidationError('claim','not found');const prior=claim.payments.find(x=>x.id===p.id);if(prior){if(prior.requestHash!==p.requestHash)throw new ContractValidationError('paymentId','conflicting replay');return{claim,payment:prior}}const reserved=claim.payments.reduce((t,x)=>t+n(x.amount),0n);if(reserved+n(p.amount)>n(claim.amount))throw new ContractValidationError('amount','commission overpayment');const next={...claim,payments:[...claim.payments,p]};this.put(this.claims,next);return{claim:next,payment:p}}
 async finalizeCommissionPayment(c:CompanyId,id:string,p:CommissionPayment){const claim=this.claims.find(x=>x.companyId===c&&x.id===id);if(!claim)throw new ContractValidationError('claim','not found');const nextPayments=claim.payments.map(x=>x.id===p.id?p:x);const paid=nextPayments.filter(x=>x.status==='POSTED').reduce((t,x)=>t+n(x.amount),0n);const next={...claim,payments:nextPayments,status:(paid===n(claim.amount)?'PAID':'PARTIALLY_PAID') as CommissionClaim['status']};this.put(this.claims,next);return next}
 async accrual(c:CompanyId,id:string){return this.accruals.find(x=>x.companyId===c&&x.id===id)} async saveAccrual(v:Accrual){this.put(this.accruals,v)}
 async supplierSettlement(c:CompanyId,id:string){return this.supplierSettlements.find(x=>x.companyId===c&&x.id===id)} async saveSupplierSettlement(v:SupplierAdvanceSettlement){this.put(this.supplierSettlements,v)}
}
