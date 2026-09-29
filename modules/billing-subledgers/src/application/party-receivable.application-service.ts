import {createHash} from 'node:crypto';
import {ContractValidationError,decimalAmount,type CompanyId,type DecimalAmount} from '@elhafez/contracts';
import type {CurrencyFxApplicationService} from '@elhafez/currency-fx';
import type {BillingRepository} from './billing.repository.js';
import type {BillingSubledgersApplicationService,CreateInvoiceInput} from './billing-subledgers.application-service.js';
import type {Advance,AdvanceConsumption,Allocation,Invoice,PartyKind} from '../domain/billing.js';

const SCALE=10n**18n;
const zero=decimalAmount('0');
function units(value:DecimalAmount,field='amount'){const text=decimalAmount(value),negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.');if(fraction.length>18)throw new ContractValidationError(field,'supports at most 18 fractional digits');const result=BigInt(whole+fraction.padEnd(18,'0'));return negative?-result:result;}
function decimal(value:bigint):DecimalAmount{const negative=value<0n,absolute=negative?-value:value,whole=absolute/SCALE,fraction=absolute%SCALE,text=fraction===0n?whole.toString():whole.toString()+'.'+fraction.toString().padStart(18,'0').replace(/0+$/,'');return decimalAmount((negative&&text!=='0'?'-':'')+text);}
function positive(value:DecimalAmount,field='amount'){const result=decimalAmount(value);if(units(result,field)<=0n)throw new ContractValidationError(field,'must be positive');return result;}
function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function invoiceKind(invoice:Invoice):PartyKind{return invoice.type==='SUPPLIER'?'SUPPLIER':invoice.type==='AGENT'?'AGENT':'CUSTOMER';}
function receivableType(kind:'CUSTOMER'|'AGENT',invoice:Invoice){return kind==='AGENT'?invoice.type==='AGENT':invoice.type==='CUSTOMER'||invoice.type==='OPENING_CUSTOMER_BALANCE';}

export type ReceivablePartyKind='CUSTOMER'|'AGENT';

/**
 * Billing-owned extension for CRM-facing receivable operations that were absent from the
 * original AC-06 public surface. It writes only existing Billing tables and keeps the
 * existing BillingSubledgersApplicationService as the invoice posting engine.
 */
export class PartyReceivableApplicationService{
 constructor(
  private readonly repo:BillingRepository,
  private readonly billing:Pick<BillingSubledgersApplicationService,'createDraft'|'postInvoice'>,
  private readonly fx:Pick<CurrencyFxApplicationService,'getBaseCurrency'>,
 ){}

 async baseCurrency(companyId:CompanyId){return (await this.fx.getBaseCurrency(companyId)).code;}

 async listOpenInvoices(companyId:CompanyId,kind:ReceivablePartyKind,partyId:string,branchId?:string):Promise<Invoice[]>{
  return (await this.repo.invoices(companyId)).filter(invoice=>invoice.partyId===partyId&&receivableType(kind,invoice)&&invoice.status==='POSTED'&&units(invoice.outstanding)>0n&&(branchId===undefined||invoice.branchId===branchId));
 }

 async listAvailableAdvances(companyId:CompanyId,kind:ReceivablePartyKind,partyId:string):Promise<Advance[]>{
  return (await this.repo.advances(companyId,kind,partyId)).filter(value=>!value.reversedAt&&units(value.available)>0n);
 }

 async createAndPostReceivableInvoice(input:Omit<CreateInvoiceInput,'type'>&{partyKind:ReceivablePartyKind}):Promise<Invoice>{
  const draft=await this.billing.createDraft({...input,type:input.partyKind});
  return this.billing.postInvoice(input.companyId,draft.id);
 }

 /** Explicit same-base-currency receipt allocation. Cash is posted by Treasury first; this
  * Billing step is idempotent and may create an advance only for genuine excess receipt. */
 async applyReceipt(input:{id:string;companyId:CompanyId;branchId?:string;partyKind:ReceivablePartyKind;partyId:string;invoiceId:string;amount:DecimalAmount;sourceId:string}):Promise<Allocation>{
  const amount=positive(input.amount),sourceType='CRM_PARTY_RECEIPT',requestHash=fingerprint({...input,amount,sourceType});
  const prior=await this.repo.allocationBySource(input.companyId,sourceType,input.sourceId);
  if(prior){if(prior.requestHash!==requestHash)throw new ContractValidationError('source','conflicting receipt replay');return prior;}
  const invoice=await this.repo.invoice(input.companyId,input.invoiceId);
  if(!invoice||invoice.status!=='POSTED'||invoice.partyId!==input.partyId||!receivableType(input.partyKind,invoice)||(input.branchId!==undefined&&invoice.branchId!==input.branchId))throw new ContractValidationError('invoice','posted receivable for the exact party and branch is required');
  const base=await this.fx.getBaseCurrency(input.companyId);
  if(invoice.currency!==base.code)throw new ContractValidationError('currency','CRM party receipt requires base-currency invoice evidence; use the accounting FX settlement workflow for foreign currency');
  const appliedUnits=units(amount)<=units(invoice.outstanding)?units(amount):units(invoice.outstanding),appliedAmount=decimal(appliedUnits),advanceAmount=decimal(units(amount)-appliedUnits);
  const allocation:Allocation={id:input.id,companyId:input.companyId,partyKind:input.partyKind,partyId:input.partyId,invoiceId:invoice.id,amount,appliedAmount,advanceAmount,sourceType,sourceId:input.sourceId,requestHash};
  const advance:Advance|undefined=units(advanceAmount)>0n?{id:'advance:'+input.id,companyId:input.companyId,partyKind:input.partyKind,partyId:input.partyId,amount:advanceAmount,available:advanceAmount,sourceType,sourceId:input.sourceId}:undefined;
  try{await this.repo.saveAllocationEffect(allocation,invoice,{...invoice,outstanding:decimal(units(invoice.outstanding)-appliedUnits)},advance);return allocation;}
  catch(error){const concurrent=await this.repo.allocationBySource(input.companyId,sourceType,input.sourceId);if(concurrent?.requestHash===requestHash)return concurrent;throw error;}
 }

 /** Consumes an existing Billing-owned advance after Treasury has posted the matching cash
  * refund. Restricted/source-bound advances remain blocked rather than being guessed. */
 async consumeAdvanceRefund(input:{companyId:CompanyId;partyKind:ReceivablePartyKind;partyId:string;advanceId:string;amount:DecimalAmount;sourceId:string}):Promise<Advance>{
  const amount=positive(input.amount),sourceType=input.partyKind==='AGENT'?'AGENT_ADVANCE_REFUND':'CUSTOMER_ADVANCE_REFUND';
  const prior=await this.repo.consumptionBySource(input.companyId,sourceType,input.sourceId);
  if(prior){if(prior.advanceId!==input.advanceId||prior.amount!==amount)throw new ContractValidationError('source','conflicting advance-refund replay');const current=await this.repo.advance(input.companyId,input.advanceId);if(!current)throw new ContractValidationError('advance','not found');return current;}
  const advance=await this.repo.advance(input.companyId,input.advanceId);
  if(!advance||advance.reversedAt||advance.partyKind!==input.partyKind||advance.partyId!==input.partyId)throw new ContractValidationError('advance','available advance for the exact party is required');
  if(advance.restrictionSourceId||advance.restrictionSourceType)throw new ContractValidationError('advance','source-restricted advance requires its owner-specific refund workflow');
  if(units(amount)>units(advance.available))throw new ContractValidationError('amount','refund exceeds available advance');
  const next={...advance,available:decimal(units(advance.available)-units(amount))};
  const consumption:AdvanceConsumption={id:sourceType+':'+input.sourceId,companyId:input.companyId,advanceId:advance.id,amount,sourceType,sourceId:input.sourceId};
  try{await this.repo.saveAdvanceConsumptionEffect(consumption,advance,next);return next;}
  catch(error){const concurrent=await this.repo.consumptionBySource(input.companyId,sourceType,input.sourceId);if(concurrent?.advanceId===advance.id&&concurrent.amount===amount)return (await this.repo.advance(input.companyId,advance.id))??next;throw error;}
 }
}
