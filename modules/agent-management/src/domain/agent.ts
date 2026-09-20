import { ContractValidationError, type CompanyId } from '@elhafez/contracts';
import type { PartyId } from '@elhafez/party-registry';
declare const agentIdBrand:unique symbol;
export type AgentId=string & {readonly [agentIdBrand]:'AgentId'};
export type AgentStatus='ACTIVE'|'SUSPENDED';
export type CommissionKind='FIXED'|'PERCENT';
export interface AgentCommissionTerms { readonly kind:CommissionKind; readonly value:string; readonly currency:string|null; }
export interface Agent { readonly id:AgentId; readonly companyId:CompanyId; readonly partyId:PartyId; readonly number:string; readonly status:AgentStatus; readonly notes:string|null; readonly commission:AgentCommissionTerms; readonly createdAt:string; readonly updatedAt:string; }
export interface AgentReference { readonly companyId:CompanyId; readonly agentId:AgentId; readonly sourceType:string; readonly sourceId:string; readonly createdAt:string; }
export const agentId=(value:string):AgentId=>{const v=value.trim();if(!v)throw new ContractValidationError('agentId','is required');return v as AgentId;};
export function decimal(value:string):string{const v=value.trim();if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(v))throw new ContractValidationError('value','must be a non-negative decimal with up to 6 decimals');return v;}
export function commissionTerms(input:AgentCommissionTerms):AgentCommissionTerms{
  const value=decimal(input.value);
  if(input.kind==='FIXED'){const currency=input.currency?.trim().toUpperCase();if(!currency)throw new ContractValidationError('currency','is required for fixed commission');return {kind:'FIXED',value,currency};}
  if(input.kind==='PERCENT'){if(BigInt(value.replace('.','').padEnd(value.includes('.')?value.length-1:1,'0'))<0n)throw new ContractValidationError('value','is invalid');return {kind:'PERCENT',value,currency:null};}
  throw new ContractValidationError('kind','is invalid');
}
