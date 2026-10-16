import {ContractValidationError,decimalAmount} from '@elhafez/contracts';
import type {CommissionClaim,CommissionSettlement,CommissionSettlementRequest} from './ecr.js';
const scale=10n**18n;
function units(value:string){const text=decimalAmount(value),negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.');if(fraction.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits');const result=BigInt(whole+fraction.padEnd(18,'0'));return negative?-result:result;}
function decimal(value:bigint){const negative=value<0n,absolute=negative?-value:value,whole=absolute/scale,fraction=absolute%scale;return decimalAmount((negative?'-':'')+whole.toString()+(fraction?'.'+fraction.toString().padStart(18,'0').replace(/0+$/,''):''));}

/** Called while the owner holds all affected claim locks. Never reconstructs paid history. */
export function planCommissionSettlement(input:CommissionSettlementRequest,claims:readonly CommissionClaim[]):CommissionSettlement{
 if(claims.length!==input.claimIds.length||new Set(input.claimIds).size!==input.claimIds.length||input.expectedRemaining.length!==input.claimIds.length||new Set(input.expectedRemaining.map(x=>x.claimId)).size!==input.claimIds.length)throw new ContractValidationError('claims','exact unique claim and reviewed balance set required');
 const expected=new Map(input.expectedRemaining.map(x=>[x.claimId,x.amount]));let total=0n,baseTotal=0n;
 const entries=claims.map(claim=>{
  if(claim.companyId!==input.companyId||claim.branchId!==input.branchId||!input.claimIds.includes(claim.id)||claim.beneficiary)throw new ContractValidationError('claims','agent claims in the exact company and branch required');
  if(!['DRAFT','APPROVED','PARTIALLY_PAID','PAID'].includes(claim.status)||claim.payments.some(x=>x.status!=='POSTED'))throw new ContractValidationError('claim','resume pending approval, reversal or cash payment before settlement');
  if(claim.currency!==input.currency)throw new ContractValidationError('currency','all claims must use the reviewed settlement currency');
  const paid=claim.payments.reduce((sum,x)=>sum+units(x.claimAmountApplied),0n),paidBase=claim.payments.reduce((sum,x)=>sum+units(x.carryingBaseAmount),0n),remaining=units(claim.amount)-paid;
  if(remaining<0n||expected.get(claim.id)===undefined||units(expected.get(claim.id)!)!==remaining)throw new ContractValidationError('expectedRemaining','claim balance changed; review the new unpaid amount');
  if(claim.status!=='DRAFT'&&!claim.recognitionJournalId||claim.status==='DRAFT'&&claim.payments.length||claim.status==='PAID'&&remaining!==0n)throw new ContractValidationError('recognition','complete approval and payment carrying evidence required');
  const recognized=!!claim.recognitionJournalId,baseAmount=recognized?units(claim.baseCarryingAmount)-paidBase:0n;
  if(baseAmount<0n||(remaining===0n&&baseAmount!==0n)||(remaining>0n&&recognized&&baseAmount<=0n))throw new ContractValidationError('carryingBaseAmount','inconsistent remaining commission carrying evidence');
  total+=remaining;baseTotal+=baseAmount;
  return{claimId:claim.id,partyId:claim.agentPartyId,amount:decimal(remaining),baseAmount:decimal(baseAmount),recognized,expenseAccountId:claim.expenseAccountId,liabilityAccountId:claim.liabilityAccountId};
 });
 return{id:input.id,companyId:input.companyId,branchId:input.branchId,requestHash:input.requestHash,actorId:input.actorId,reason:input.reason,postingDate:input.postingDate,number:input.number,currency:input.currency,claims:entries,total:decimal(total),baseTotal:decimal(baseTotal),status:'RELEASING'};
}
