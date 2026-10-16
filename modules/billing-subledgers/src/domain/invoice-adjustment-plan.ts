import {ContractValidationError,decimalAmount,type DecimalAmount} from '@elhafez/contracts';
import type {BillingAdjustmentRequest,BillingOperationSnapshot,InvoiceAdjustmentPlan} from './billing.js';
const scale=10n**18n;
export function billingUnits(value:string){const text=decimalAmount(value),negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.');if(fraction.length>18)throw new ContractValidationError('amount','supports at most 18 fractional digits');const result=BigInt(whole+fraction.padEnd(18,'0'));if(result>=10n**38n)throw new ContractValidationError('amount','exceeds the owned decimal range');return negative?-result:result;}
export function billingDecimal(value:bigint):DecimalAmount{const negative=value<0n,absolute=negative?-value:value,whole=absolute/scale,fraction=absolute%scale;return decimalAmount((negative?'-':'')+whole.toString()+(fraction?'.'+fraction.toString().padStart(18,'0').replace(/0+$/,''):''));}
export function billingRatio(value:bigint,numerator:bigint,denominator:bigint,precision:number){if(denominator<=0n||!Number.isInteger(precision)||precision<0||precision>18)throw new ContractValidationError('ratio','positive denominator and currency precision required');const quantum=10n**BigInt(18-precision),signed=value*numerator,negative=signed<0n,product=negative?-signed:signed,divisor=denominator*quantum,result=(product/divisor+(product%divisor*2n>=divisor?1n:0n))*quantum;return negative?-result:result;}

export function planInvoiceAdjustment(snapshot:BillingOperationSnapshot,input:BillingAdjustmentRequest):InvoiceAdjustmentPlan{
 const invoice=snapshot.invoice,amount=billingUnits(input.amount),outstanding=billingUnits(invoice.outstanding),active=snapshot.adjustments.filter(x=>!x.reversedAt);
 if(amount<=0n||!['CREDIT_NOTE','DEBIT_NOTE','WRITE_OFF'].includes(input.kind))throw new ContractValidationError('adjustment','positive amount and valid adjustment kind required');
 if(input.kind==='WRITE_OFF'&&invoice.type!=='CUSTOMER')throw new ContractValidationError('writeOff','customer receivable required');
 if(input.kind==='WRITE_OFF'&&amount>outstanding)throw new ContractValidationError('writeOff','cannot exceed open receivable');
 const netBase=active.reduce((total,x)=>total+(x.kind==='DEBIT_NOTE'?billingUnits(x.amount):x.kind==='CREDIT_NOTE'?-billingUnits(x.amount):0n),billingUnits(invoice.baseTotal));
 if(input.enforceNonNegativeCharge&&input.kind==='CREDIT_NOTE'&&amount>netBase)throw new ContractValidationError('amount','credit exceeds remaining commercial charge');
 if(input.advanceAccountId&&input.kind==='CREDIT_NOTE'&&active.some(x=>x.kind==='WRITE_OFF'))throw new ContractValidationError('writeOff','settle or reverse the recorded write-off before a refund-generating credit');
 let documentAmount:DecimalAmount|undefined;
 if(input.documentAmount!==undefined){
  const requested=billingUnits(input.documentAmount),original=invoice.lines.reduce((sum,line)=>sum+billingUnits(line.amount)+billingUnits(line.taxAmount??'0'),0n);
  if(requested<=0n||original<=0n)throw new ContractValidationError('documentAmount','positive document amount required');
  const documentNet=active.reduce((total,x)=>total+(x.kind==='DEBIT_NOTE'?1n:x.kind==='CREDIT_NOTE'?-1n:0n)*(x.documentAmount!==undefined?billingUnits(x.documentAmount):billingRatio(billingUnits(x.amount),original,billingUnits(invoice.baseTotal),snapshot.documentPrecision)),original);
  const carrying=input.kind==='CREDIT_NOTE'&&requested===documentNet?netBase:billingRatio(requested,billingUnits(invoice.baseTotal),original,snapshot.basePrecision);
  if(amount!==carrying)throw new ContractValidationError('amount','base credit must match the historic document carrying amount');
  documentAmount=decimalAmount(input.documentAmount);
 }
 const applied=input.kind==='DEBIT_NOTE'?amount:amount<outstanding?amount:outstanding,advance=input.kind==='DEBIT_NOTE'?0n:amount-applied,costCenterId=invoice.financialDimensions?.currentCostCenterId??(invoice.lines.length===1?invoice.lines[0]?.costCenterId:undefined);
 return{amount:billingDecimal(amount),appliedAmount:billingDecimal(applied),advanceAmount:billingDecimal(advance),outstanding:billingDecimal(input.kind==='DEBIT_NOTE'?outstanding+applied:outstanding-applied),...(costCenterId?{costCenterId}:{}),...(documentAmount?{documentAmount,documentCurrency:invoice.currency}:{})};
}
