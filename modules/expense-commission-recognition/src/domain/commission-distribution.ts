import { ContractValidationError, decimalAmount, type DecimalAmount } from '@elhafez/contracts';

export interface CommissionDistribution {
  readonly agreementId: string;
  readonly agreementVersion: number;
  readonly precision: number;
  readonly principalPartyId: string;
  readonly subordinatePartyId: string;
  readonly principalPercent: string;
}
export interface CommissionShare { readonly partyId: string; readonly amount: DecimalAmount; readonly role: 'PRINCIPAL'|'SUBORDINATE' }

/** Principal rounds down to a currency quantum; subordinate retains the remainder.
 * The total must already be expressed in that currency's configured precision.
 * Stable recipient order and the exact remainder policy are part of the snapshot.
 */
export function distributeCommission(total: string, agreement: CommissionDistribution): readonly CommissionShare[] {
  const amount=decimalAmount(total);
  if(amount.startsWith('-'))throw new ContractValidationError('commission','must be non-negative');
  if(!Number.isInteger(agreement.precision)||agreement.precision<0||agreement.precision>9)throw new ContractValidationError('precision','must be 0..9');
  if(!agreement.agreementId.trim()||!Number.isSafeInteger(agreement.agreementVersion)||agreement.agreementVersion<1)throw new ContractValidationError('agreement','versioned agreement required');
  if(!agreement.principalPartyId.trim()||!agreement.subordinatePartyId.trim()||agreement.principalPartyId===agreement.subordinatePartyId)throw new ContractValidationError('beneficiaries','two distinct parties required');
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(agreement.principalPercent))throw new ContractValidationError('principalPercent','percentage with up to six decimal places required');
  const [whole,fraction='']=amount.split('.');
  if(fraction.length>agreement.precision)throw new ContractValidationError('commission','amount exceeds currency precision');
  const quantum=10n**BigInt(agreement.precision);
  const minor=BigInt(whole!)*quantum+BigInt(fraction.padEnd(agreement.precision,'0')||'0');
  const [pct,pctFraction='']=agreement.principalPercent.split('.');
  const percent=BigInt(pct!)*1000000n+BigInt(pctFraction.padEnd(6,'0'));
  if(percent>100000000n)throw new ContractValidationError('principalPercent','must not exceed 100');
  const principal=minor*percent/100000000n;
  const format=(v:bigint)=>decimalAmount(agreement.precision?(`${v/quantum}.`+(v%quantum).toString().padStart(agreement.precision,'0').replace(/0+$/,'')).replace(/\.$/,''):v.toString());
  return [{partyId:agreement.principalPartyId,amount:format(principal),role:'PRINCIPAL'},{partyId:agreement.subordinatePartyId,amount:format(minor-principal),role:'SUBORDINATE'}];
}
