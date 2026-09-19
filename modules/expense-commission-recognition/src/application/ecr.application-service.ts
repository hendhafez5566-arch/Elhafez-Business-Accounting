import { createHash } from 'node:crypto';
import { ContractValidationError, currencyCode, decimalAmount, money, type CompanyId, type DecimalAmount } from '@elhafez/contracts';
import type { BillingSubledgersApplicationService } from '@elhafez/billing-subledgers';
import type { TreasurySettlementApplicationService } from '@elhafez/treasury-settlement';
import type { GeneralLedgerApplicationService } from '@elhafez/general-ledger';
import type { CurrencyFxApplicationService } from '@elhafez/currency-fx';
import type { FinancialControlsApplicationService } from '@elhafez/financial-controls';
import type { EcrRepository } from './ecr.repository.js';
import type { Expense, ExpenseForm, RecognitionKind, RecognitionSchedule, CommissionClaim, CommissionPayment, Accrual, SupplierAdvanceSettlement } from '../domain/ecr.js';
const S=10n**18n;
function n(v:DecimalAmount|string){const x=decimalAmount(v),neg=x.startsWith('-'),u=neg?x.slice(1):x,[w,f='']=u.split('.');if(f.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits');const z=BigInt(w+f.padEnd(18,'0'));return neg?-z:z}
function d(v:bigint){const neg=v<0n,a=neg?-v:v,w=a/S,f=a%S,t=f?w+'.'+f.toString().padStart(18,'0').replace(/0+$/,''):w.toString();return decimalAmount((neg?'-':'')+t)}
function pos(v:DecimalAmount){const x=decimalAmount(v);if(n(x)<=0n)throw new ContractValidationError('amount','must be positive');return x}
function h(v:unknown){return createHash('sha256').update(JSON.stringify(v)).digest('hex')}
function split(total:DecimalAmount,count:number,precision:number){if(!Number.isInteger(count)||count<1)throw new ContractValidationError('parts','positive integer required');if(!Number.isInteger(precision)||precision<0||precision>18)throw new ContractValidationError('precision','must be 0..18');const quantum=10n**BigInt(18-precision),whole=(n(total)/quantum)/BigInt(count)*quantum,result=Array<DecimalAmount>(count).fill(d(whole));result[count-1]=d(whole+(n(total)-whole*BigInt(count)));return result}

export class ExpenseCommissionRecognitionApplicationService {
 constructor(private readonly repo:EcrRepository,
  private readonly billing:Pick<BillingSubledgersApplicationService,'recordRecognitionStarted'|'getOpenPosition'|'getAdvance'|'consumeAdvance'>,
  private readonly treasury:Pick<TreasurySettlementApplicationService,'postOwnerPayment'|'postSupplierAdvanceRefundReceipt'|'getTreasurySnapshot'>,
  private readonly gl:Pick<GeneralLedgerApplicationService,'post'|'reverse'>,
  private readonly fx:Pick<CurrencyFxApplicationService,'getBaseCurrency'|'calculateSettlement'>,
  private readonly controls:Pick<FinancialControlsApplicationService,'evaluateApprovalRequirement'|'getApprovalRequest'|'getApprovalDecision'>){}

 async createExpense(input:{id:string;companyId:CompanyId;branchId?:string;form:ExpenseForm;sourceType:string;sourceId:string;currency:string;amount:DecimalAmount;baseAmount:DecimalAmount;expenseAccountId?:string;prepaidAccountId?:string;billingInvoiceId?:string;approvalRequestId?:string}):Promise<Expense>{
  const normalized={...input,currency:currencyCode(input.currency),amount:pos(input.amount),baseAmount:pos(input.baseAmount)},requestHash=h(normalized),prior=await this.repo.expense(input.companyId,input.id);
  if(prior){if(prior.requestHash!==requestHash)throw new ContractValidationError('source','conflicting replay');return prior}
  let status:Expense['status']='DRAFT';
  if(input.form==='SUPPLIER_PAYABLE'){
   if(!input.billingInvoiceId)throw new ContractValidationError('billingInvoiceId','supplier payable must remain Billing-owned');
   const invoice=await this.billing.getOpenPosition(input.companyId,input.billingInvoiceId);
   if(invoice.partyKind!=='SUPPLIER'||invoice.status!=='POSTED')throw new ContractValidationError('billingInvoiceId','posted Billing-owned supplier invoice required');
   status='POSTED';
  }
  if(input.form==='DIRECT_PAID'&&!input.expenseAccountId)throw new ContractValidationError('expenseAccountId','required');
  if(input.form==='PREPAID'&&(!input.expenseAccountId||!input.prepaidAccountId))throw new ContractValidationError('accounts','expense and prepaid accounts required');
  const value:Expense={...normalized,status,requestHash};await this.repo.saveExpense(value);return value;
 }
 private async requireApproval(expense:Expense,actorId:string){const requirement=await this.controls.evaluateApprovalRequirement({companyId:expense.companyId,action:'PAID_EXPENSE',amount:expense.baseAmount});if(requirement.decision==='APPROVAL_NOT_REQUIRED')return;if(!expense.approvalRequestId)throw new ContractValidationError('approval','required');const request=await this.controls.getApprovalRequest(expense.companyId,expense.approvalRequestId),decision=await this.controls.getApprovalDecision(expense.companyId,expense.approvalRequestId);if(!request||request.action!=='PAID_EXPENSE'||request.companyId!==expense.companyId||request.sourceType!==expense.sourceType||request.sourceId!==expense.sourceId||request.requesterActorId!==actorId||request.amount!==expense.baseAmount||request.branchId!==expense.branchId||decision?.outcome!=='APPROVED')throw new ContractValidationError('approval','does not authorize this exact paid expense')}
 async postPaidExpense(input:{companyId:CompanyId;expenseId:string;actorId:string;treasuryId:string;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
  let expense=await this.requiredExpense(input.companyId,input.expenseId);
  if(expense.status==='POSTED')return expense;
  if(expense.form!=='DIRECT_PAID'&&expense.form!=='PREPAID')throw new ContractValidationError('form','paid workflow requires DIRECT_PAID or PREPAID');
  const base=await this.fx.getBaseCurrency(input.companyId),at=input.postingDate+'T23:59:59.999Z',paymentCurrency=currencyCode(input.paymentCurrency);
  const economicBase=expense.currency===base.code
   ? {converted:money(expense.amount,base.code),rate:{rateId:'SAME_CURRENCY'}}
   : await this.fx.calculateSettlement(input.companyId,money(expense.amount,currencyCode(expense.currency)),base.code,at);
  if(n(economicBase.converted.amount)!==n(expense.baseAmount))throw new ContractValidationError('baseAmount','must match the dated FX value used for posting');
  const payment=expense.currency===paymentCurrency
   ? {converted:money(expense.amount,paymentCurrency),rate:{rateId:'SAME_CURRENCY'}}
   : await this.fx.calculateSettlement(input.companyId,money(expense.amount,currencyCode(expense.currency)),paymentCurrency,at);
  const settlementBase=paymentCurrency===base.code
   ? {converted:money(payment.converted.amount,base.code),rate:{rateId:'SAME_CURRENCY'}}
   : await this.fx.calculateSettlement(input.companyId,payment.converted,base.code,at);
  await this.requireApproval(expense,input.actorId);
  const account=expense.form==='DIRECT_PAID'?expense.expenseAccountId:expense.prepaidAccountId;
  if(!account)throw new ContractValidationError('account','required');
  const voucher=await this.treasury.postOwnerPayment({
   id:'expense:'+expense.id,companyId:expense.companyId,...(expense.branchId?{branchId:expense.branchId}:{}),
   treasuryId:input.treasuryId,ownerType:'EXPENSE',ownerId:expense.id,partyId:expense.id,number:input.number,
   postingDate:input.postingDate,amount:payment.converted.amount,paymentCurrency,
   carryingBaseAmount:expense.baseAmount,settlementBaseAmount:settlementBase.converted.amount,liabilityAccountId:account,
   ...(input.realizedFxGainAccountId?{realizedFxGainAccountId:input.realizedFxGainAccountId}:{}),
   ...(input.realizedFxLossAccountId?{realizedFxLossAccountId:input.realizedFxLossAccountId}:{}),
   fxRateId:settlementBase.rate.rateId,
  });
  if(voucher.status!=='POSTED'||!voucher.journalId)throw new ContractValidationError('voucher','owner payment did not complete');
  expense={...expense,status:'POSTED',treasuryVoucherId:voucher.id,journalId:voucher.journalId};await this.repo.saveExpense(expense);return expense;
 }


 async createRecognitionSchedule(input:{id:string;companyId:CompanyId;kind:RecognitionKind;sourceType:string;sourceId:string;sourceInvoiceId?:string;currency:string;sourceAmount:DecimalAmount;baseAmount:DecimalAmount;deferredAccountId:string;recognitionAccountId:string;serviceDates:string[];postingDate:string;number:string;precision?:number}):Promise<RecognitionSchedule>{
  if(!input.serviceDates.length||input.serviceDates.some(x=>!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x)))throw new ContractValidationError('serviceDates','explicit ISO service dates required');
  const sourceAmount=pos(input.sourceAmount),baseAmount=pos(input.baseAmount),normalized={...input,currency:currencyCode(input.currency),sourceAmount,baseAmount},requestHash=h(normalized);
  let value=await this.repo.schedule(input.companyId,input.id);
  if(value&&value.requestHash!==requestHash)throw new ContractValidationError('source','conflicting replay');
  if(!value){
   if(input.kind==='DEFERRED_REVENUE'||input.kind==='DEFERRED_COST'){
    if(!input.sourceInvoiceId)throw new ContractValidationError('sourceInvoiceId','deferred invoice required');
    const invoice=await this.billing.getOpenPosition(input.companyId,input.sourceInvoiceId),expected=input.kind==='DEFERRED_REVENUE'?'CUSTOMER':'SUPPLIER';
    if(invoice.partyKind!==expected||invoice.status!=='POSTED'||!invoice.deferred)throw new ContractValidationError('invoice','posted explicitly deferred '+expected+' invoice required');
    if(n(baseAmount)>n(invoice.baseTotal))throw new ContractValidationError('amount','schedule exceeds invoice economic amount');
   }else{
    const expense=await this.repo.expense(input.companyId,input.sourceId);
    if(!expense||expense.form!=='PREPAID'||expense.status!=='POSTED')throw new ContractValidationError('expense','posted prepaid expense required');
    if(n(baseAmount)>n(expense.baseAmount))throw new ContractValidationError('amount','schedule exceeds prepaid expense');
   }
   const base=await this.fx.getBaseCurrency(input.companyId);
   if(input.precision!==undefined&&input.precision!==base.precision)throw new ContractValidationError('precision','recognition parts must use base-currency precision');
   const amounts=split(baseAmount,input.serviceDates.length,base.precision);
   value={id:input.id,companyId:input.companyId,kind:input.kind,sourceType:input.sourceType,sourceId:input.sourceId,...(input.sourceInvoiceId?{sourceInvoiceId:input.sourceInvoiceId}:{}),currency:normalized.currency,sourceAmount,baseAmount,deferredAccountId:input.deferredAccountId,recognitionAccountId:input.recognitionAccountId,requestHash,parts:input.serviceDates.map((serviceDate,i)=>({id:input.id+':'+(i+1),serviceDate,amount:amounts[i]!,status:'PENDING'}))};
   try{await this.repo.saveSchedule(value)}catch(error){
    const collision=input.sourceInvoiceId?await this.repo.scheduleByInvoice(input.companyId,input.sourceInvoiceId,input.kind):undefined;
    if(!collision||collision.requestHash!==requestHash)throw error;
    value=collision;
   }
  }
  if((value.kind==='DEFERRED_REVENUE'||value.kind==='DEFERRED_COST')&&!value.initialJournalId){
   const revenue=value.kind==='DEFERRED_REVENUE';
   const journal=await this.gl.post({id:'ecr-deferral:'+value.id,companyId:value.companyId,number:input.number,postingDate:input.postingDate,sourceType:'ECR_INITIAL_DEFERRAL',sourceId:value.id,lines:revenue?[{accountId:value.recognitionAccountId,debit:value.baseAmount},{accountId:value.deferredAccountId,credit:value.baseAmount}]:[{accountId:value.deferredAccountId,debit:value.baseAmount},{accountId:value.recognitionAccountId,credit:value.baseAmount}]});
   value={...value,initialJournalId:journal.id};await this.repo.saveSchedule(value);
  }
  return value;
 }

 async postRecognitionPart(companyId:CompanyId,scheduleId:string,partId:string,postingDate:string,number:string){let schedule=await this.requiredSchedule(companyId,scheduleId);const index=schedule.parts.findIndex(x=>x.id===partId);if(index<0)throw new ContractValidationError('part','not found');const part=schedule.parts[index]!;if(part.status==='POSTED')return part;if(part.status!=='PENDING')throw new ContractValidationError('part','reversed part cannot post');if(postingDate<part.serviceDate)throw new ContractValidationError('serviceDate','recognition cannot precede explicit service date');if(schedule.sourceInvoiceId&&schedule.parts.every(x=>x.status==='PENDING'))await this.billing.recordRecognitionStarted(companyId,schedule.sourceInvoiceId,'ECR:'+schedule.id);const revenue=schedule.kind==='DEFERRED_REVENUE';const journal=await this.gl.post({id:'ecr-recognition:'+part.id,companyId,number,postingDate,sourceType:'ECR_RECOGNITION',sourceId:part.id,lines:revenue?[{accountId:schedule.deferredAccountId,debit:part.amount},{accountId:schedule.recognitionAccountId,credit:part.amount}]:[{accountId:schedule.recognitionAccountId,debit:part.amount},{accountId:schedule.deferredAccountId,credit:part.amount}]});const posted={...part,status:'POSTED' as const,journalId:journal.id};schedule={...schedule,parts:schedule.parts.map((x,i)=>i===index?posted:x)};await this.repo.saveSchedule(schedule);return posted}
 async reverseRecognitionPart(companyId:CompanyId,scheduleId:string,partId:string,postingDate:string,number:string){let schedule=await this.requiredSchedule(companyId,scheduleId);const index=schedule.parts.findIndex(x=>x.id===partId),part=schedule.parts[index];if(!part)throw new ContractValidationError('part','not found');if(part.status==='REVERSED')return part;if(part.status!=='POSTED'||!part.journalId)throw new ContractValidationError('part','posted part required');const reversal=await this.gl.reverse(companyId,part.journalId,postingDate,number),reversed={...part,status:'REVERSED' as const,reversalJournalId:reversal.id};schedule={...schedule,parts:schedule.parts.map((x,i)=>i===index?reversed:x)};await this.repo.saveSchedule(schedule);return reversed}

 async processSupplierRefund(input:{id:string;companyId:CompanyId;advanceId:string;supplierPartyId:string;treasuryId:string;amount:DecimalAmount;paymentCurrency:string;advanceAccountId:string;postingDate:string;number:string}){
  const amount=pos(input.amount),requestHash=h({...input,amount});
  let workflow=await this.repo.supplierSettlement(input.companyId,input.id);
  if(workflow&&workflow.requestHash!==requestHash)throw new ContractValidationError('source','conflicting supplier refund replay');
  workflow=workflow?{...workflow,status:'PROCESSING',failureReason:undefined}:{id:input.id,companyId:input.companyId,kind:'REFUND',advanceId:input.advanceId,supplierPartyId:input.supplierPartyId,amount,requestHash,status:'PROCESSING'} as SupplierAdvanceSettlement;
  await this.repo.saveSupplierSettlement(workflow);
  try{
   const base=await this.fx.getBaseCurrency(input.companyId),paymentCurrency=currencyCode(input.paymentCurrency);
   if(paymentCurrency!==base.code)throw new ContractValidationError('paymentCurrency','supplier advance refunds are base-currency only until Billing advances carry currency evidence');
   const treasury=await this.treasury.getTreasurySnapshot(input.companyId,input.treasuryId);
   if(!treasury.active||treasury.currency!==base.code)throw new ContractValidationError('treasuryId','active base-currency treasury required');
   const advance=await this.billing.getAdvance(input.companyId,input.advanceId);
   if(advance.partyKind!=='SUPPLIER'||advance.partyId!==input.supplierPartyId)throw new ContractValidationError('advance','supplier advance identity mismatch');
   const remaining=await this.billing.consumeAdvance({companyId:input.companyId,advanceId:input.advanceId,amount,sourceType:'SUPPLIER_ADVANCE_REFUND',sourceId:input.id});
   const voucher=await this.treasury.postSupplierAdvanceRefundReceipt({...input,amount,paymentCurrency});
   workflow={...workflow,status:'POSTED',treasuryVoucherId:voucher.id,failureReason:undefined};await this.repo.saveSupplierSettlement(workflow);
   return{voucher,advance:remaining};
  }catch(error){
   workflow={...workflow,status:'RECOVERABLE_ERROR',failureReason:error instanceof Error?error.message:'unknown failure'};await this.repo.saveSupplierSettlement(workflow);throw error;
  }
 }
 async postSupplierCancellationPenalty(input:{id:string;companyId:CompanyId;advanceId:string;supplierPartyId:string;amount:DecimalAmount;expenseAccountId:string;advanceAccountId:string;postingDate:string;number:string}){
  const amount=pos(input.amount),requestHash=h({...input,amount});
  let workflow=await this.repo.supplierSettlement(input.companyId,input.id);
  if(workflow&&workflow.requestHash!==requestHash)throw new ContractValidationError('source','conflicting supplier cancellation replay');
  workflow=workflow?{...workflow,status:'PROCESSING',failureReason:undefined}:{id:input.id,companyId:input.companyId,kind:'CANCELLATION_PENALTY',advanceId:input.advanceId,supplierPartyId:input.supplierPartyId,amount,requestHash,status:'PROCESSING'} as SupplierAdvanceSettlement;
  await this.repo.saveSupplierSettlement(workflow);
  try{
   const advance=await this.billing.getAdvance(input.companyId,input.advanceId);
   if(advance.partyKind!=='SUPPLIER'||advance.partyId!==input.supplierPartyId)throw new ContractValidationError('advance','supplier advance identity mismatch');
   const remaining=await this.billing.consumeAdvance({companyId:input.companyId,advanceId:input.advanceId,amount,sourceType:'SUPPLIER_CANCELLATION_CHARGE',sourceId:input.id});
   const journal=await this.gl.post({id:'ecr-supplier-cancellation:'+input.id,companyId:input.companyId,number:input.number,postingDate:input.postingDate,sourceType:'ECR_SUPPLIER_CANCELLATION',sourceId:input.id,lines:[{accountId:input.expenseAccountId,debit:amount},{accountId:input.advanceAccountId,credit:amount,partyId:input.supplierPartyId}]});
   const value:Expense={id:input.id,companyId:input.companyId,form:'CANCELLATION_PENALTY',sourceType:'SUPPLIER_CANCELLATION',sourceId:input.id,currency:'BASE',amount,baseAmount:amount,status:'POSTED',requestHash,expenseAccountId:input.expenseAccountId,journalId:journal.id};
   await this.repo.saveExpense(value);
   workflow={...workflow,status:'POSTED',journalId:journal.id,failureReason:undefined};await this.repo.saveSupplierSettlement(workflow);
   return{...value,remainingAdvance:remaining.available};
  }catch(error){
   workflow={...workflow,status:'RECOVERABLE_ERROR',failureReason:error instanceof Error?error.message:'unknown failure'};await this.repo.saveSupplierSettlement(workflow);throw error;
  }
 }


 async createCommissionClaim(input:{id:string;companyId:CompanyId;branchId?:string;agentPartyId:string;sourceType:string;sourceId:string;currency:string;amount:DecimalAmount;baseCarryingAmount:DecimalAmount;expenseAccountId:string;liabilityAccountId:string;approvalRequestId?:string;requesterActorId?:string}):Promise<CommissionClaim>{const normalized={...input,currency:currencyCode(input.currency),amount:pos(input.amount),baseCarryingAmount:pos(input.baseCarryingAmount)},requestHash=h(normalized),prior=await this.repo.claim(input.companyId,input.id);if(prior){if(prior.requestHash!==requestHash)throw new ContractValidationError('source','conflicting replay');return prior}const value:CommissionClaim={...normalized,status:'DRAFT',requestHash,payments:[]};await this.repo.saveClaim(value);return value}
 async approveCommission(companyId:CompanyId,id:string,postingDate:string,number:string):Promise<CommissionClaim>{
  let claim=await this.requiredClaim(companyId,id);if(claim.status!=='DRAFT')return claim;
  const base=await this.fx.getBaseCurrency(companyId),conversion=claim.currency===base.code?{converted:money(claim.amount,base.code),rate:{rateId:'SAME_CURRENCY'}}:await this.fx.calculateSettlement(companyId,money(claim.amount,currencyCode(claim.currency)),base.code,postingDate+'T23:59:59.999Z');
  const carrying=pos(conversion.converted.amount);
  const requirement=await this.controls.evaluateApprovalRequirement({companyId,action:'COMMISSION_APPROVAL',amount:carrying});
  if(requirement.decision==='APPROVAL_REQUIRED'){
   if(!claim.approvalRequestId||!claim.requesterActorId)throw new ContractValidationError('approval','required');
   const request=await this.controls.getApprovalRequest(companyId,claim.approvalRequestId),decision=await this.controls.getApprovalDecision(companyId,claim.approvalRequestId);
   if(!request||request.action!=='COMMISSION_APPROVAL'||request.companyId!==companyId||request.sourceType!==claim.sourceType||request.sourceId!==claim.sourceId||request.requesterActorId!==claim.requesterActorId||request.branchId!==claim.branchId||request.amount!==carrying||decision?.outcome!=='APPROVED')throw new ContractValidationError('approval','does not authorize exact claim');
  }
  const journal=await this.gl.post({id:'ecr-commission:'+id,companyId,number,postingDate,sourceType:'ECR_COMMISSION_APPROVAL',sourceId:id,lines:[{accountId:claim.expenseAccountId,debit:carrying},{accountId:claim.liabilityAccountId,credit:carrying,partyId:claim.agentPartyId}]});
  claim={...claim,baseCarryingAmount:carrying,status:'APPROVED',recognitionJournalId:journal.id};await this.repo.saveClaim(claim);return claim;
 }
 async payCommission(input:{companyId:CompanyId;claimId:string;paymentId:string;treasuryId:string;amount:DecimalAmount;paymentCurrency:string;postingDate:string;number:string;realizedFxGainAccountId?:string;realizedFxLossAccountId?:string}){
  let claim=await this.requiredClaim(input.companyId,input.claimId);
  if(claim.status!=='APPROVED'&&claim.status!=='PARTIALLY_PAID')throw new ContractValidationError('claim','approved outstanding claim required');
  const amount=pos(input.amount),paymentCurrency=currencyCode(input.paymentCurrency),requestHash=h({...input,amount,paymentCurrency});
  const existing=claim.payments.find(p=>p.id===input.paymentId);
  if(existing){
   if(existing.requestHash!==requestHash)throw new ContractValidationError('paymentId','conflicting replay');
   if(existing.status==='POSTED')return existing;
   const voucher=await this.treasury.postOwnerPayment({id:input.paymentId,companyId:input.companyId,...(claim.branchId?{branchId:claim.branchId}:{}),treasuryId:input.treasuryId,ownerType:'COMMISSION',ownerId:claim.id,partyId:claim.agentPartyId,debitPartyId:claim.agentPartyId,number:input.number,postingDate:input.postingDate,amount:existing.amount,paymentCurrency:existing.paymentCurrency,carryingBaseAmount:existing.carryingBaseAmount,settlementBaseAmount:existing.settlementBaseAmount,liabilityAccountId:claim.liabilityAccountId,...(input.realizedFxGainAccountId?{realizedFxGainAccountId:input.realizedFxGainAccountId}:{}),...(input.realizedFxLossAccountId?{realizedFxLossAccountId:input.realizedFxLossAccountId}:{}),fxRateId:existing.fxRateId});
   if(voucher.status!=='POSTED'||!voucher.journalId)throw new ContractValidationError('voucher','commission payment did not complete');
   const posted={...existing,status:'POSTED' as const,treasuryVoucherId:voucher.id};await this.repo.finalizeCommissionPayment(input.companyId,input.claimId,posted);return posted;
  }
  const base=await this.fx.getBaseCurrency(input.companyId),at=input.postingDate+'T23:59:59.999Z';
  const claimAppliedConversion=paymentCurrency===claim.currency?{converted:money(amount,currencyCode(claim.currency)),rate:{rateId:'SAME_CURRENCY'}}:await this.fx.calculateSettlement(input.companyId,money(amount,paymentCurrency),currencyCode(claim.currency),at);
  const claimAmountApplied=pos(claimAppliedConversion.converted.amount);
  const conversion=paymentCurrency===base.code?{converted:money(amount,base.code),rate:{rateId:'SAME_CURRENCY'}}:await this.fx.calculateSettlement(input.companyId,money(amount,paymentCurrency),base.code,at);
  const priorApplied=claim.payments.reduce((x,p)=>x+n(p.claimAmountApplied),0n),priorCarrying=claim.payments.reduce((x,p)=>x+n(p.carryingBaseAmount),0n);
  if(priorApplied+n(claimAmountApplied)>n(claim.amount))throw new ContractValidationError('amount','commission overpayment');
  const final=priorApplied+n(claimAmountApplied)===n(claim.amount);
  const carrying=final?d(n(claim.baseCarryingAmount)-priorCarrying):d(n(claim.baseCarryingAmount)*n(claimAmountApplied)/n(claim.amount));
  if(n(carrying)<=0n)throw new ContractValidationError('carryingBaseAmount','must remain positive');
  const reservation:CommissionPayment={id:input.paymentId,requestHash,status:'RESERVED',amount,paymentCurrency,claimAmountApplied,settlementBaseAmount:conversion.converted.amount,carryingBaseAmount:carrying,realizedFx:d(n(conversion.converted.amount)-n(carrying)),fxRateId:conversion.rate.rateId};
  const reserved=await this.repo.reserveCommissionPayment(input.companyId,input.claimId,reservation);
  if(reserved.payment.status==='POSTED')return reserved.payment;
  claim=reserved.claim;const payment=reserved.payment;
  const voucher=await this.treasury.postOwnerPayment({id:input.paymentId,companyId:input.companyId,...(claim.branchId?{branchId:claim.branchId}:{}),treasuryId:input.treasuryId,ownerType:'COMMISSION',ownerId:claim.id,partyId:claim.agentPartyId,debitPartyId:claim.agentPartyId,number:input.number,postingDate:input.postingDate,amount:payment.amount,paymentCurrency:payment.paymentCurrency,carryingBaseAmount:payment.carryingBaseAmount,settlementBaseAmount:payment.settlementBaseAmount,liabilityAccountId:claim.liabilityAccountId,...(input.realizedFxGainAccountId?{realizedFxGainAccountId:input.realizedFxGainAccountId}:{}),...(input.realizedFxLossAccountId?{realizedFxLossAccountId:input.realizedFxLossAccountId}:{}),fxRateId:payment.fxRateId});
  if(voucher.status!=='POSTED'||!voucher.journalId)throw new ContractValidationError('voucher','commission payment did not complete');
  const posted={...payment,status:'POSTED' as const,treasuryVoucherId:voucher.id};await this.repo.finalizeCommissionPayment(input.companyId,input.claimId,posted);return posted;
 }


 async accrueRevenue(input:{id:string;companyId:CompanyId;sourceType:string;sourceId:string;amount:DecimalAmount;serviceDate:string;number:string;accruedRevenueAccountId:string;revenueAccountId:string}):Promise<Accrual>{
  const amount=pos(input.amount),requestHash=h({...input,amount}),prior=await this.repo.accrual(input.companyId,input.id);
  if(prior){if(prior.requestHash!==requestHash)throw new ContractValidationError('source','conflicting accrual replay');return prior}
  const journal=await this.gl.post({id:'ecr-accrual:'+input.id,companyId:input.companyId,number:input.number,postingDate:input.serviceDate,sourceType:'ECR_ACCRUED_REVENUE',sourceId:input.id,lines:[{accountId:input.accruedRevenueAccountId,debit:amount},{accountId:input.revenueAccountId,credit:amount}]});
  const value:Accrual={id:input.id,companyId:input.companyId,sourceType:input.sourceType,sourceId:input.sourceId,amount,serviceDate:input.serviceDate,status:'POSTED',journalId:journal.id,requestHash,accruedRevenueAccountId:input.accruedRevenueAccountId,revenueAccountId:input.revenueAccountId};await this.repo.saveAccrual(value);return value;
 }
 async clearAccruedRevenue(input:{companyId:CompanyId;accrualId:string;billingInvoiceId:string;postingDate:string;number:string}){let accrual=await this.requiredAccrual(input.companyId,input.accrualId);if(accrual.status==='CLEARED'){if(accrual.billingInvoiceId!==input.billingInvoiceId)throw new ContractValidationError('billingInvoiceId','conflicting replay');return accrual}const invoice=await this.billing.getOpenPosition(input.companyId,input.billingInvoiceId);if(invoice.partyKind!=='CUSTOMER'||invoice.status!=='POSTED'||n(accrual.amount)>n(invoice.baseTotal))throw new ContractValidationError('invoice','posted customer invoice covering accrual required');const journal=await this.gl.post({id:'ecr-accrual-clear:'+accrual.id,companyId:input.companyId,number:input.number,postingDate:input.postingDate,sourceType:'ECR_ACCRUAL_CLEARING',sourceId:accrual.id,lines:[{accountId:accrual.revenueAccountId,debit:accrual.amount},{accountId:accrual.accruedRevenueAccountId,credit:accrual.amount}]});accrual={...accrual,status:'CLEARED',billingInvoiceId:input.billingInvoiceId,clearingJournalId:journal.id};await this.repo.saveAccrual(accrual);return accrual}
 private async requiredExpense(c:CompanyId,id:string){const x=await this.repo.expense(c,id);if(!x)throw new ContractValidationError('expense','not found');return x}private async requiredSchedule(c:CompanyId,id:string){const x=await this.repo.schedule(c,id);if(!x)throw new ContractValidationError('schedule','not found');return x}private async requiredClaim(c:CompanyId,id:string){const x=await this.repo.claim(c,id);if(!x)throw new ContractValidationError('claim','not found');return x}private async requiredAccrual(c:CompanyId,id:string){const x=await this.repo.accrual(c,id);if(!x)throw new ContractValidationError('accrual','not found');return x}
}
export const splitExactSchedule=split;
