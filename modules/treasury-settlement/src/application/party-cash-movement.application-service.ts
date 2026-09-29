import {createHash} from 'node:crypto';
import {ContractValidationError,currencyCode,decimalAmount,type CompanyId,type DecimalAmount} from '@elhafez/contracts';
import type {GeneralLedgerApplicationService} from '@elhafez/general-ledger';
import type {FinancialControlsApplicationService} from '@elhafez/financial-controls';
import type {TreasuryRepository} from './treasury.repository.js';
import type {Voucher} from '../domain/treasury.js';

function units(value:DecimalAmount|string){const text=decimalAmount(value),negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.');if(fraction.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits');const result=BigInt(whole+fraction.padEnd(18,'0'));return negative?-result:result;}
function positive(value:DecimalAmount){const result=decimalAmount(value);if(units(result)<=0n)throw new ContractValidationError('amount','must be positive');return result;}
function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export type TreasuryReceivablePartyKind='CUSTOMER'|'AGENT';

/** Treasury-owned narrow cash boundary for CRM-originated customer/agent receivable and
 * advance-refund workflows. No CRM ledger or voucher persistence is introduced. */
export class PartyCashMovementApplicationService{
 constructor(
  private readonly repo:TreasuryRepository,
  private readonly gl:Pick<GeneralLedgerApplicationService,'post'>,
  private readonly controls:Pick<FinancialControlsApplicationService,'evaluateApprovalRequirement'|'getApprovalRequest'|'getApprovalDecision'>,
 ){}

 async post(input:{id:string;companyId:CompanyId;branchId?:string;treasuryId:string;kind:'RECEIPT'|'PAYMENT';partyKind:TreasuryReceivablePartyKind;partyId:string;number:string;postingDate:string;currency:string;amount:DecimalAmount;offsetAccountId:string;sourceType:string;sourceId:string;actorId?:string;approvalRequestId?:string}):Promise<Voucher>{
  const amount=positive(input.amount),treasury=await this.repo.treasury(input.companyId,input.treasuryId);
  if(!treasury||!treasury.active)throw new ContractValidationError('treasury','active treasury required');
  if(currencyCode(input.currency)!==treasury.currency)throw new ContractValidationError('currency','must equal selected treasury currency');
  if(!input.partyId.trim()||!input.offsetAccountId.trim()||!input.number.trim()||!input.sourceType.trim()||!input.sourceId.trim())throw new ContractValidationError('movement','party, account, number and source identity are required');
  const requestHash=fingerprint({...input,amount,currency:treasury.currency});
  let voucher=await this.repo.voucherBySource(input.companyId,input.sourceType,input.sourceId);
  if(voucher){if(voucher.requestHash!==requestHash)throw new ContractValidationError('source','conflicting cash-movement replay');if(voucher.status==='POSTED')return voucher;if(voucher.status!=='PROCESSING')throw new ContractValidationError('voucher','reversed/reversing voucher identity cannot be reposted');}
  else voucher={id:input.id,companyId:input.companyId,...(input.branchId?{branchId:input.branchId}:{}),treasuryId:input.treasuryId,kind:input.kind,partyKind:input.partyKind,partyId:input.partyId,number:input.number,postingDate:input.postingDate,currency:treasury.currency,amount,sourceType:input.sourceType,sourceId:input.sourceId,requestHash,status:'PROCESSING',...(input.actorId?{actorId:input.actorId}:{}),...(input.approvalRequestId?{approvalRequestId:input.approvalRequestId}:{}),allocationIds:[]};
  if(input.kind==='PAYMENT'){
   const requirement=await this.controls.evaluateApprovalRequirement({companyId:input.companyId,action:'PAYMENT',amount});
   if(requirement.decision==='APPROVAL_REQUIRED'){
    if(!input.approvalRequestId||!input.actorId)throw new ContractValidationError('approval','approved request and requesting actor are required');
    const request=await this.controls.getApprovalRequest(input.companyId,input.approvalRequestId),decision=await this.controls.getApprovalDecision(input.companyId,input.approvalRequestId);
    if(!request||request.action!=='PAYMENT'||request.amount!==amount||request.sourceType!==input.sourceType||request.sourceId!==input.sourceId||request.requesterActorId!==input.actorId||(input.branchId!==undefined&&request.branchId!==input.branchId)||decision?.outcome!=='APPROVED')throw new ContractValidationError('approval','approval evidence does not authorize this exact payment');
   }
  }
  voucher=await this.repo.reserveVoucher(voucher,(await this.repo.policy(input.companyId))?.allowNegative===true);
  const lines=input.kind==='RECEIPT'
   ?[{accountId:treasury.glAccountId,debit:amount},{accountId:input.offsetAccountId,credit:amount,partyId:input.partyId}]
   :[{accountId:input.offsetAccountId,debit:amount,partyId:input.partyId},{accountId:treasury.glAccountId,credit:amount}];
  const journal=await this.gl.post({id:'treasury-party:'+input.id,companyId:input.companyId,...(input.branchId?{branchId:input.branchId}:{}),number:input.number,postingDate:input.postingDate,sourceType:'TREASURY_PARTY_MOVEMENT',sourceId:input.sourceType+':'+input.sourceId,lines});
  voucher={...voucher,status:'POSTED',journalId:journal.id,carryingBaseAmount:amount,settlementBaseAmount:amount,realizedFx:decimalAmount('0')};
  await this.repo.saveVoucher(voucher);return voucher;
 }
}
